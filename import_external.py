# insert_external_programs.py

import psycopg2
import pandas as pd
from dotenv import load_dotenv
import os

load_dotenv()

conn = psycopg2.connect(
    host="localhost",
    port=5433,
    dbname=os.getenv("POSTGRES_DB"),
    user=os.getenv("POSTGRES_USER"),
    password=os.getenv("POSTGRES_PASSWORD")
)
cur = conn.cursor()

# Your manually collected external data
# Prepare a list of dicts — fill in what you have
external_programs = [
    {
        "channel_id": "DANANG",
        "name": "Thiếu nhi",
        "content": "Điều kì diệu từ quá khứ LH42",
        "begin_time": "20251118161500",
        "end_time": "20251118164500"
    },
    {
        "channel_id": "DANANG",
        "name": "Thiếu nhi",
        "content": "Kem và cậu bạn thần kỳ LH42",
        "begin_time": "20260102161500",
        "end_time": "20260102164500"
    },
    {
        "channel_id": "DANANG",
        "name": "Thiếu nhi",
        "content": "Em yêu câu thơ bài chòi LH42",
        "begin_time": "20260204161500",
        "end_time": "20260204164500"
    },
    {
        "channel_id": "DANANG",
        "name": "Thiếu nhi",
        "content": "Em yêu điệu lý quê mình LH42",
        "begin_time": "20260106161500",
        "end_time": "20260106164500"
    },
    {
        "channel_id": "DANANG",
        "name": "Thiếu nhi",
        "content": "Từ cao nguyên em hát LH42",
        "begin_time": "20251121161500",
        "end_time": "20251121164500"
    },
    {
        "channel_id": "DANANG",
        "name": "Thiếu nhi",
        "content": "Bay cao những ước mơ LH42",
        "begin_time": "20251117161500",
        "end_time": "20251117164500"
    },
    {
        "channel_id": "DANANG",
        "name": "Thiếu nhi",
        "content": "Sự tích con kiến LH42",
        "begin_time": "20251120161500",
        "end_time": "20251120164500"
    },
    {
        "channel_id": "DANANG",
        "name": "Thiếu nhi",
        "content": "Chuyện của A Minh LH42",
        "begin_time": "20251113161500",
        "end_time": "20251113164500"
    },
    {
        "channel_id": "DANANG",
        "name": "Thiếu nhi",
        "content": "Cô giáo bản em LH41",
        "begin_time": "20251119161500",
        "end_time": "20251119164500"
    },
    {
        "channel_id": "DANANG",
        "name": "Thiếu nhi",
        "content": "Thắp sáng ước mơ vùng biển LH42",
        "begin_time": "20260107161500",
        "end_time": "20260107164500"
    },
    {
        "channel_id": "VTV5",
        "name": "Thiếu nhi",
        "content": "Vầng trăng của em",
        "begin_time": "20260509183500",
        "end_time": "20260509190000"
    },
    {
        "channel_id": "VTV5",
        "name": "Thiếu nhi",
        "content": "Khoảng trời tuổi thơ",
        "begin_time": "20251207160000",
        "end_time": "20251207163000"
    },
    {
        "channel_id": "VTV5",
        "name": "Thiếu nhi",
        "content": "Thực hành nấu mâm cơm ngày Tết",
        "begin_time": "20260216140000",
        "end_time": "20260216143000"
    },
    {
        "channel_id": "VTV5",
        "name": "Thiếu nhi",
        "content": "Tết  rộn ràng khắp nơi",
        "begin_time": "20260218171500",
        "end_time": "20260218180000"
    },
    {
        "channel_id": "VTV5",
        "name": "Thiếu nhi",
        "content": "Đi để lớn lên",
        "begin_time": "20260404184000",
        "end_time": "20260404190000"
    },
    {
        "channel_id": "THANHHOA",
        "name": "Thiếu nhi",
        "content": "Tìm hiểu về ngày Tết Dương lịch",
        "begin_time": "20260101163000",
        "end_time": "20260101164000"
    },
    {
        "channel_id": "SONLA",
        "name": "Tạp chí thiếu nhi",
        "content": "",
        "begin_time": "20260404175400",
        "end_time": "20260404181000"
    },
    
    
]

inserted_ids = []

for prog in external_programs:
    cur.execute("""
        INSERT INTO program
            (channel_id, name, content, begin_time, end_time, create_time)
        VALUES (%s, %s, %s, %s, %s, NOW())
        RETURNING id
    """, (
        prog["channel_id"],
        prog["name"],
        prog["content"],
        prog["begin_time"],
        prog["end_time"]
    ))
    
    new_id = cur.fetchone()[0]
    inserted_ids.append(new_id)

conn.commit()
cur.close()
conn.close()

print(f"Inserted {len(inserted_ids)} external programs")
print(f"IDs: {inserted_ids[:10]} ...")