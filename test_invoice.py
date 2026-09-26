import urllib.request
import json
import sqlite3

conn = sqlite3.connect('backend/appointments.db')
cursor = conn.cursor()
cursor.execute("INSERT OR IGNORE INTO orders (order_id, plan_id, plan_name, amount, doctor_name, phone, email, city, status) VALUES ('ORD-MOCK-1', 'pro', 'Professional Clinic', 2999, 'Mock Doctor', '1234567890', 'mock@swastik.ai', 'Mock City', 'PAID')")
conn.commit()

req = urllib.request.Request('http://localhost:8000/api/checkout/order/ORD-MOCK-1/invoice')
try:
    res = urllib.request.urlopen(req)
    print('HTTP Status:', res.status)
    print('Content-Type:', res.headers.get('Content-Type'))
    pdf_header = res.read(4)
    print('Is PDF?', pdf_header == b'%PDF')
except Exception as e:
    print('Error:', e)
