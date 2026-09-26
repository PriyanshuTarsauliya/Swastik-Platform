"""Unified Database Manager for Swastik AI.

Seamlessly supports:
1. PostgreSQL (production on Render via DATABASE_URL)
2. SQLite (local development / offline testing via appointments.db)
"""

import logging
import os
import re
import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Any

log = logging.getLogger("swastik-db")

DATABASE_URL = os.environ.get("DATABASE_URL", "").strip()

# Local SQLite fallback path
DEFAULT_SQLITE_PATH = Path(__file__).resolve().parent / "appointments.db"
DB_PATH = Path(os.environ.get("APPOINTMENTS_DB_PATH", DEFAULT_SQLITE_PATH))

IS_POSTGRES = bool(DATABASE_URL and (DATABASE_URL.startswith("postgres://") or DATABASE_URL.startswith("postgresql://")))

try:
    from psycopg2 import IntegrityError as PostgresIntegrityError
except ImportError:
    PostgresIntegrityError = sqlite3.IntegrityError

DBIntegrityError = (sqlite3.IntegrityError, PostgresIntegrityError)

if IS_POSTGRES:
    import psycopg2
    # Render sometimes gives postgres:// which SQLAlchemy/psycopg2 prefers as postgresql://
    if DATABASE_URL.startswith("postgres://"):
        DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)


class DictRowWrapper:
    """Provides uniform dict-like and index-like access across SQLite and Postgres."""
    def __init__(self, data: dict[str, Any], keys: list[str]):
        self._data = dict(data)
        self._keys = list(keys)

    def __getitem__(self, item: str | int) -> Any:
        if isinstance(item, int):
            return self._data[self._keys[item]]
        return self._data.get(item)

    def __contains__(self, item: str) -> bool:
        return item in self._data

    def get(self, key: str, default: Any = None) -> Any:
        return self._data.get(key, default)

    def keys(self):
        return self._data.keys()

    def values(self):
        return self._data.values()

    def items(self):
        return self._data.items()

    def __repr__(self):
        return repr(self._data)


class UniversalCursor:
    """Cursor wrapper that translates '?' placeholders to '%s' for Postgres and wraps rows."""
    def __init__(self, raw_cursor, is_postgres: bool):
        self.raw_cursor = raw_cursor
        self.is_postgres = is_postgres
        self.lastrowid = None

    def _translate_query(self, query: str) -> str:
        if not self.is_postgres:
            return query
        # In Postgres, replace ? placeholders with %s
        # Replace date('now') with CURRENT_DATE
        q = re.sub(r"\?", "%s", query)
        q = re.sub(r"date\('now'\)", "CURRENT_DATE", q, flags=re.IGNORECASE)
        return q

    def execute(self, query: str, params: tuple | list | dict | None = None):
        translated = self._translate_query(query)
        if self.is_postgres:
            # If it's an INSERT statement without RETURNING, append RETURNING id to capture lastrowid
            is_insert = translated.strip().upper().startswith("INSERT INTO")
            if is_insert and "RETURNING" not in translated.upper():
                translated += " RETURNING id"
                if params is None:
                    res = self.raw_cursor.execute(translated)
                else:
                    res = self.raw_cursor.execute(translated, params)
                try:
                    row = self.raw_cursor.fetchone()
                    if row:
                        self.lastrowid = row[0] if isinstance(row, (list, tuple)) else row.get("id")
                except Exception:
                    self.lastrowid = None
                return res

            if params is None:
                res = self.raw_cursor.execute(translated)
            else:
                res = self.raw_cursor.execute(translated, params)
            return res
        else:
            if params is None:
                res = self.raw_cursor.execute(translated)
            else:
                res = self.raw_cursor.execute(translated, params)
            self.lastrowid = getattr(self.raw_cursor, "lastrowid", None)
            return res

    def executemany(self, query: str, seq_of_params):
        translated = self._translate_query(query)
        return self.raw_cursor.executemany(translated, seq_of_params)

    def fetchone(self) -> DictRowWrapper | None:
        row = self.raw_cursor.fetchone()
        if row is None:
            return None
        if self.is_postgres:
            # psycopg2 RealDictRow
            return DictRowWrapper(dict(row), list(row.keys()))
        else:
            # sqlite3.Row
            return DictRowWrapper({k: row[k] for k in row.keys()}, list(row.keys()))

    def fetchall(self) -> list[DictRowWrapper]:
        rows = self.raw_cursor.fetchall()
        if not rows:
            return []
        if self.is_postgres:
            return [DictRowWrapper(dict(r), list(r.keys())) for r in rows]
        else:
            return [DictRowWrapper({k: r[k] for k in r.keys()}, list(r.keys())) for r in rows]

    def close(self):
        self.raw_cursor.close()


class UniversalConnection:
    """Connection wrapper providing a uniform interface."""
    def __init__(self, raw_conn, is_postgres: bool):
        self.raw_conn = raw_conn
        self.is_postgres = is_postgres
        self.row_factory = None

    def cursor(self) -> UniversalCursor:
        if self.is_postgres:
            raw_cur = self.raw_conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        else:
            raw_cur = self.raw_conn.cursor()
        return UniversalCursor(raw_cur, self.is_postgres)

    def execute(self, query: str, params: tuple | list | dict | None = None) -> UniversalCursor:
        cur = self.cursor()
        cur.execute(query, params)
        return cur

    def commit(self):
        self.raw_conn.commit()

    def rollback(self):
        self.raw_conn.rollback()

    def close(self):
        self.raw_conn.close()


@contextmanager
def get_db():
    """Context manager yielding a connected UniversalConnection."""
    if IS_POSTGRES:
        conn = psycopg2.connect(DATABASE_URL)
        wrapped = UniversalConnection(conn, is_postgres=True)
        try:
            yield wrapped
            wrapped.commit()
        except Exception:
            wrapped.rollback()
            raise
        finally:
            wrapped.close()
    else:
        conn = sqlite3.connect(DB_PATH, timeout=10.0)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode = WAL;")
        conn.execute("PRAGMA synchronous = NORMAL;")
        conn.execute("PRAGMA busy_timeout = 5000;")
        conn.execute("PRAGMA cache_size = -64000;")
        conn.execute("PRAGMA foreign_keys = ON;")
        wrapped = UniversalConnection(conn, is_postgres=False)
        try:
            yield wrapped
            wrapped.commit()
        except Exception:
            wrapped.rollback()
            raise
        finally:
            wrapped.close()


def init_db():
    """Initialize database tables for either PostgreSQL or SQLite."""
    with get_db() as db:
        if IS_POSTGRES:
            # PostgreSQL schema
            db.execute("""
                CREATE TABLE IF NOT EXISTS users (
                    id SERIAL PRIMARY KEY,
                    name TEXT NOT NULL,
                    email TEXT UNIQUE NOT NULL,
                    password_hash TEXT NOT NULL,
                    salt TEXT NOT NULL,
                    role TEXT DEFAULT 'doctor',
                    phone TEXT DEFAULT '',
                    avatar_url TEXT DEFAULT '',
                    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
                )
            """)
            db.execute("""
                CREATE TABLE IF NOT EXISTS clinics (
                    id TEXT PRIMARY KEY,
                    owner_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                    name TEXT NOT NULL,
                    system_prompt TEXT,
                    theme_color TEXT DEFAULT '#10B981',
                    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
                )
            """)
            db.execute("""
                CREATE TABLE IF NOT EXISTS appointments (
                    id SERIAL PRIMARY KEY,
                    clinic_id TEXT REFERENCES clinics(id) ON DELETE CASCADE,
                    patient_name TEXT NOT NULL,
                    slot_time TEXT NOT NULL,
                    phone TEXT,
                    age TEXT,
                    gender TEXT,
                    category TEXT,
                    consultation_mode TEXT,
                    fee TEXT DEFAULT '₹499',
                    status TEXT DEFAULT 'CONFIRMED',
                    reschedule_count INTEGER DEFAULT 0,
                    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
                )
            """)
            db.execute("""
                CREATE TABLE IF NOT EXISTS orders (
                    id SERIAL PRIMARY KEY,
                    clinic_id TEXT REFERENCES clinics(id) ON DELETE CASCADE,
                    order_id TEXT UNIQUE NOT NULL,
                    plan_id TEXT NOT NULL,
                    plan_name TEXT NOT NULL,
                    amount INTEGER NOT NULL,
                    doctor_name TEXT NOT NULL,
                    phone TEXT NOT NULL,
                    email TEXT,
                    city TEXT,
                    status TEXT DEFAULT 'PENDING',
                    payment_method TEXT,
                    transaction_ref TEXT,
                    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
                )
            """)
            db.execute("""
                CREATE TABLE IF NOT EXISTS call_logs (
                    id SERIAL PRIMARY KEY,
                    clinic_id TEXT REFERENCES clinics(id) ON DELETE CASCADE,
                    session_id TEXT UNIQUE NOT NULL,
                    caller_name TEXT DEFAULT 'Anonymous Caller',
                    phone TEXT,
                    duration_seconds INTEGER DEFAULT 0,
                    summary TEXT,
                    transcript_json TEXT,
                    chief_complaint TEXT DEFAULT '',
                    urgency_level TEXT DEFAULT 'Routine',
                    action_items TEXT DEFAULT '',
                    outcome TEXT DEFAULT 'Unclassified',
                    audio_url TEXT DEFAULT '',
                    avg_snr REAL DEFAULT 0.0,
                    avg_erle REAL DEFAULT 0.0,
                    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
                )
            """)
            db.execute("""
                CREATE TABLE IF NOT EXISTS settings (
                    key TEXT PRIMARY KEY,
                    value TEXT,
                    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
                )
            """)
            db.execute("""
                CREATE TABLE IF NOT EXISTS user_sessions (
                    token TEXT PRIMARY KEY,
                    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    expires_at TIMESTAMPTZ NOT NULL,
                    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
                )
            """)
        else:
            # SQLite schema
            db.execute("""
                CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    email TEXT UNIQUE NOT NULL,
                    password_hash TEXT NOT NULL,
                    salt TEXT NOT NULL,
                    role TEXT DEFAULT 'doctor',
                    phone TEXT DEFAULT '',
                    avatar_url TEXT DEFAULT '',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            db.execute("""
                CREATE TABLE IF NOT EXISTS clinics (
                    id TEXT PRIMARY KEY,
                    owner_user_id INTEGER,
                    name TEXT NOT NULL,
                    system_prompt TEXT,
                    theme_color TEXT DEFAULT '#10B981',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(owner_user_id) REFERENCES users(id) ON DELETE CASCADE
                )
            """)
            db.execute("""
                CREATE TABLE IF NOT EXISTS appointments (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    clinic_id TEXT,
                    patient_name TEXT NOT NULL,
                    slot_time TEXT NOT NULL,
                    phone TEXT,
                    age TEXT,
                    gender TEXT,
                    category TEXT,
                    consultation_mode TEXT,
                    fee TEXT DEFAULT '₹499',
                    status TEXT DEFAULT 'CONFIRMED',
                    reschedule_count INTEGER DEFAULT 0,
                    reminder_24h_sent INTEGER DEFAULT 0,
                    reminder_2h_sent INTEGER DEFAULT 0,
                    no_show_recovery_sent INTEGER DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(clinic_id) REFERENCES clinics(id) ON DELETE CASCADE
                )
            """)
            db.execute("""
                CREATE TABLE IF NOT EXISTS orders (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    clinic_id TEXT,
                    order_id TEXT UNIQUE NOT NULL,
                    plan_id TEXT NOT NULL,
                    plan_name TEXT NOT NULL,
                    amount INTEGER NOT NULL,
                    doctor_name TEXT NOT NULL,
                    phone TEXT NOT NULL,
                    email TEXT,
                    city TEXT,
                    status TEXT DEFAULT 'PENDING',
                    payment_method TEXT,
                    transaction_ref TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(clinic_id) REFERENCES clinics(id) ON DELETE CASCADE
                )
            """)
            db.execute("""
                CREATE TABLE IF NOT EXISTS call_logs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    clinic_id TEXT,
                    session_id TEXT UNIQUE NOT NULL,
                    caller_name TEXT DEFAULT 'Anonymous Caller',
                    phone TEXT,
                    duration_seconds INTEGER DEFAULT 0,
                    summary TEXT,
                    transcript_json TEXT,
                    chief_complaint TEXT DEFAULT '',
                    urgency_level TEXT DEFAULT 'Routine',
                    action_items TEXT DEFAULT '',
                    outcome TEXT DEFAULT 'Unclassified',
                    audio_url TEXT DEFAULT '',
                    avg_snr REAL DEFAULT 0.0,
                    avg_erle REAL DEFAULT 0.0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(clinic_id) REFERENCES clinics(id) ON DELETE CASCADE
                )
            """)
            db.execute("""
                CREATE TABLE IF NOT EXISTS settings (
                    key TEXT PRIMARY KEY,
                    value TEXT,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            db.execute("""
                CREATE TABLE IF NOT EXISTS user_sessions (
                    token TEXT PRIMARY KEY,
                    user_id INTEGER NOT NULL,
                    expires_at TIMESTAMP NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
                )
            """)

        # ── High-Performance Database Indexes ──────────────────
        indexes = [
            "CREATE INDEX IF NOT EXISTS idx_appointments_clinic_date ON appointments(clinic_id, created_at DESC)",
            "CREATE INDEX IF NOT EXISTS idx_appointments_phone ON appointments(phone)",
            "CREATE INDEX IF NOT EXISTS idx_call_logs_clinic_created ON call_logs(clinic_id, created_at DESC)",
            "CREATE INDEX IF NOT EXISTS idx_call_logs_session ON call_logs(session_id)",
            "CREATE INDEX IF NOT EXISTS idx_orders_clinic ON orders(clinic_id)",
            "CREATE INDEX IF NOT EXISTS idx_orders_order_id ON orders(order_id)",
            "CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(token)",
            "CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON user_sessions(user_id)",
            "CREATE INDEX IF NOT EXISTS idx_clinics_owner ON clinics(owner_user_id)",
        ]
        for idx_sql in indexes:
            try:
                db.execute(idx_sql)
            except Exception:
                pass

        # ── Multi-tenant extensions (idempotent) ─────────────────
        _add_multi_tenant_tables(db, IS_POSTGRES)

        log.info("Database initialized successfully (engine=%s)", "PostgreSQL" if IS_POSTGRES else "SQLite")


def _add_multi_tenant_tables(db, is_postgres: bool):
    """Add multi-tenant tables and columns. Safe to call on every startup."""

    # ── ALTER clinics table: add new columns ──
    new_clinic_cols = [
        ("slug", "TEXT"),
        ("timezone", "TEXT DEFAULT 'Asia/Kolkata'"),
        ("languages", "TEXT DEFAULT 'en,hi'"),
        ("voice_persona", "TEXT DEFAULT 'warm_professional'"),
        ("status", "TEXT DEFAULT 'active'"),
        ("plan_id", "TEXT"),
    ]
    for col_name, col_def in new_clinic_cols:
        try:
            db.execute(f"ALTER TABLE clinics ADD COLUMN {col_name} {col_def}")
        except Exception:
            pass  # Column already exists

    try:
        db.execute("ALTER TABLE call_logs ADD COLUMN outcome TEXT DEFAULT 'Unclassified'")
    except Exception:
        pass

    new_appt_cols = [
        ("reminder_24h_sent", "INTEGER DEFAULT 0"),
        ("reminder_2h_sent", "INTEGER DEFAULT 0"),
        ("no_show_recovery_sent", "INTEGER DEFAULT 0"),
    ]
    for col_name, col_def in new_appt_cols:
        try:
            db.execute(f"ALTER TABLE appointments ADD COLUMN {col_name} {col_def}")
        except Exception:
            pass

    new_user_cols = [
        ("is_verified", "INTEGER DEFAULT 0"),
        ("otp_code", "TEXT DEFAULT ''"),
    ]
    for col_name, col_def in new_user_cols:
        try:
            db.execute(f"ALTER TABLE users ADD COLUMN {col_name} {col_def}")
        except Exception:
            pass

    new_appt_cols = [
        ("reminder_24h_sent", "INTEGER DEFAULT 0"),
        ("reminder_2h_sent", "INTEGER DEFAULT 0"),
        ("no_show_recovery_sent", "INTEGER DEFAULT 0"),
    ]
    for col_name, col_def in new_appt_cols:
        try:
            db.execute(f"ALTER TABLE appointments ADD COLUMN {col_name} {col_def}")
        except Exception:
            pass

    # ── Plans table ──
    if is_postgres:
        db.execute("""
            CREATE TABLE IF NOT EXISTS plans (
                id TEXT PRIMARY KEY,
                name TEXT,
                monthly_price_inr INTEGER,
                included_minutes INTEGER,
                overage_paise_per_min INTEGER,
                max_phone_numbers INTEGER DEFAULT 0,
                allows_widget INTEGER DEFAULT 1,
                allows_smart_link INTEGER DEFAULT 1,
                allows_phone INTEGER DEFAULT 0
            )
        """)
    else:
        db.execute("""
            CREATE TABLE IF NOT EXISTS plans (
                id TEXT PRIMARY KEY,
                name TEXT,
                monthly_price_inr INTEGER,
                included_minutes INTEGER,
                overage_paise_per_min INTEGER,
                max_phone_numbers INTEGER DEFAULT 0,
                allows_widget INTEGER DEFAULT 1,
                allows_smart_link INTEGER DEFAULT 1,
                allows_phone INTEGER DEFAULT 0
            )
        """)

    # ── Clinic Profile table ──
    if is_postgres:
        db.execute("""
            CREATE TABLE IF NOT EXISTS clinic_profile (
                clinic_id TEXT PRIMARY KEY REFERENCES clinics(id) ON DELETE CASCADE,
                greeting TEXT,
                services TEXT,
                working_hours TEXT,
                address TEXT,
                booking_rules TEXT,
                escalation_number TEXT,
                custom_instructions TEXT,
                doctor_name TEXT,
                consultation_fee TEXT DEFAULT '₹499'
            )
        """)
    else:
        db.execute("""
            CREATE TABLE IF NOT EXISTS clinic_profile (
                clinic_id TEXT PRIMARY KEY,
                greeting TEXT,
                services TEXT,
                working_hours TEXT,
                address TEXT,
                booking_rules TEXT,
                escalation_number TEXT,
                custom_instructions TEXT,
                doctor_name TEXT,
                consultation_fee TEXT DEFAULT '₹499',
                FOREIGN KEY(clinic_id) REFERENCES clinics(id) ON DELETE CASCADE
            )
        """)

    # ── Clinic Channels table ──
    if is_postgres:
        db.execute("""
            CREATE TABLE IF NOT EXISTS clinic_channels (
                id SERIAL PRIMARY KEY,
                clinic_id TEXT REFERENCES clinics(id) ON DELETE CASCADE,
                channel_type TEXT NOT NULL,
                identifier TEXT NOT NULL,
                provider TEXT,
                provider_sid TEXT,
                is_active INTEGER DEFAULT 1,
                UNIQUE(channel_type, identifier)
            )
        """)
    else:
        db.execute("""
            CREATE TABLE IF NOT EXISTS clinic_channels (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                clinic_id TEXT,
                channel_type TEXT NOT NULL,
                identifier TEXT NOT NULL,
                provider TEXT,
                provider_sid TEXT,
                is_active INTEGER DEFAULT 1,
                UNIQUE(channel_type, identifier),
                FOREIGN KEY(clinic_id) REFERENCES clinics(id) ON DELETE CASCADE
            )
        """)

    # ── Usage Monthly rollup table ──
    if is_postgres:
        db.execute("""
            CREATE TABLE IF NOT EXISTS usage_monthly (
                clinic_id TEXT REFERENCES clinics(id) ON DELETE CASCADE,
                year_month TEXT,
                minutes_used REAL DEFAULT 0,
                PRIMARY KEY (clinic_id, year_month)
            )
        """)
    else:
        db.execute("""
            CREATE TABLE IF NOT EXISTS usage_monthly (
                clinic_id TEXT,
                year_month TEXT,
                minutes_used REAL DEFAULT 0,
                PRIMARY KEY (clinic_id, year_month),
                FOREIGN KEY(clinic_id) REFERENCES clinics(id) ON DELETE CASCADE
            )
        """)

    # ── Index for fast channel lookups ──
    try:
        db.execute("CREATE INDEX IF NOT EXISTS idx_channels_lookup ON clinic_channels(channel_type, identifier)")
    except Exception:
        pass

    # ── Seed default plans ──
    _seed_plans(db)

    db.commit()
    log.info("Multi-tenant tables initialized successfully")


def _seed_plans(db):
    """Seed the three default subscription plans if none exist."""
    cursor = db.cursor()
    cursor.execute("SELECT COUNT(*) FROM plans")
    count = cursor.fetchone()[0]
    if count > 0:
        return

    default_plans = [
        ("starter", "Starter", 2999, 200, 1200, 0, 1, 1, 0),
        ("growth", "Growth", 7499, 500, 1100, 1, 1, 1, 1),
        ("clinic_pro", "Clinic Pro", 14999, 1200, 1000, 3, 1, 1, 1),
    ]
    for plan in default_plans:
        cursor.execute("""
            INSERT INTO plans (id, name, monthly_price_inr, included_minutes,
                             overage_paise_per_min, max_phone_numbers,
                             allows_widget, allows_smart_link, allows_phone)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, plan)

    log.info("Seeded %d default plans", len(default_plans))
