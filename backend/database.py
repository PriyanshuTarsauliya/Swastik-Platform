"""Unified Database Manager for Swastik AI.

Seamlessly supports:
1. PostgreSQL (production on Render via DATABASE_URL)
2. SQLite (local development / offline testing via appointments.db)
"""

import os
import re
import logging
import sqlite3
from pathlib import Path
from typing import Any, Optional, Dict, List, Union
from contextlib import contextmanager

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
    from psycopg2 import extras
    # Render sometimes gives postgres:// which SQLAlchemy/psycopg2 prefers as postgresql://
    if DATABASE_URL.startswith("postgres://"):
        DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)


class DictRowWrapper:
    """Provides uniform dict-like and index-like access across SQLite and Postgres."""
    def __init__(self, data: Dict[str, Any], keys: List[str]):
        self._data = dict(data)
        self._keys = list(keys)

    def __getitem__(self, item: Union[str, int]) -> Any:
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

    def execute(self, query: str, params: Optional[Union[tuple, list, dict]] = None):
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

    def fetchone(self) -> Optional[DictRowWrapper]:
        row = self.raw_cursor.fetchone()
        if row is None:
            return None
        if self.is_postgres:
            # psycopg2 RealDictRow
            return DictRowWrapper(dict(row), list(row.keys()))
        else:
            # sqlite3.Row
            return DictRowWrapper({k: row[k] for k in row.keys()}, list(row.keys()))

    def fetchall(self) -> List[DictRowWrapper]:
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

    def execute(self, query: str, params: Optional[Union[tuple, list, dict]] = None) -> UniversalCursor:
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
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
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
                CREATE TABLE IF NOT EXISTS appointments (
                    id SERIAL PRIMARY KEY,
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
                    order_id TEXT UNIQUE NOT NULL,
                    plan_id TEXT NOT NULL,
                    plan_name TEXT NOT NULL,
                    amount INTEGER NOT NULL,
                    doctor_name TEXT NOT NULL,
                    clinic_name TEXT NOT NULL,
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
                    session_id TEXT UNIQUE NOT NULL,
                    caller_name TEXT DEFAULT 'Anonymous Caller',
                    phone TEXT,
                    duration_seconds INTEGER DEFAULT 0,
                    summary TEXT,
                    transcript_json TEXT,
                    chief_complaint TEXT DEFAULT '',
                    urgency_level TEXT DEFAULT 'Routine',
                    action_items TEXT DEFAULT '',
                    audio_url TEXT DEFAULT '',
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
                CREATE TABLE IF NOT EXISTS users (
                    id SERIAL PRIMARY KEY,
                    name TEXT NOT NULL,
                    email TEXT UNIQUE NOT NULL,
                    password_hash TEXT NOT NULL,
                    salt TEXT NOT NULL,
                    role TEXT DEFAULT 'doctor',
                    clinic_name TEXT DEFAULT 'Dr. Sharma''s Clinic',
                    phone TEXT DEFAULT '',
                    avatar_url TEXT DEFAULT '',
                    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
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
                CREATE TABLE IF NOT EXISTS appointments (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
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
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            db.execute("""
                CREATE TABLE IF NOT EXISTS orders (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    order_id TEXT UNIQUE NOT NULL,
                    plan_id TEXT NOT NULL,
                    plan_name TEXT NOT NULL,
                    amount INTEGER NOT NULL,
                    doctor_name TEXT NOT NULL,
                    clinic_name TEXT NOT NULL,
                    phone TEXT NOT NULL,
                    email TEXT,
                    city TEXT,
                    status TEXT DEFAULT 'PENDING',
                    payment_method TEXT,
                    transaction_ref TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            db.execute("""
                CREATE TABLE IF NOT EXISTS call_logs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    session_id TEXT UNIQUE NOT NULL,
                    caller_name TEXT DEFAULT 'Anonymous Caller',
                    phone TEXT,
                    duration_seconds INTEGER DEFAULT 0,
                    summary TEXT,
                    transcript_json TEXT,
                    chief_complaint TEXT DEFAULT '',
                    urgency_level TEXT DEFAULT 'Routine',
                    action_items TEXT DEFAULT '',
                    audio_url TEXT DEFAULT '',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
                CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    email TEXT UNIQUE NOT NULL,
                    password_hash TEXT NOT NULL,
                    salt TEXT NOT NULL,
                    role TEXT DEFAULT 'doctor',
                    clinic_name TEXT DEFAULT 'Dr. Sharma''s Clinic',
                    phone TEXT DEFAULT '',
                    avatar_url TEXT DEFAULT '',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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

            # SQLite migration checks
            cur = db.cursor()
            cur.execute("PRAGMA table_info(call_logs)")
            cols = {row[1] for row in cur.fetchall()}
            if "chief_complaint" not in cols:
                db.execute("ALTER TABLE call_logs ADD COLUMN chief_complaint TEXT DEFAULT ''")
            if "urgency_level" not in cols:
                db.execute("ALTER TABLE call_logs ADD COLUMN urgency_level TEXT DEFAULT 'Routine'")
            if "action_items" not in cols:
                db.execute("ALTER TABLE call_logs ADD COLUMN action_items TEXT DEFAULT ''")
            if "audio_url" not in cols:
                db.execute("ALTER TABLE call_logs ADD COLUMN audio_url TEXT DEFAULT ''")

            cur.execute("PRAGMA table_info(appointments)")
            appt_cols = {row[1] for row in cur.fetchall()}
            if "reschedule_count" not in appt_cols:
                db.execute("ALTER TABLE appointments ADD COLUMN reschedule_count INTEGER DEFAULT 0")

    log.info("Database initialized successfully (engine=%s)", "PostgreSQL" if IS_POSTGRES else "SQLite")
