# export_to_label.py

import psycopg2
import pandas as pd
from dotenv import load_dotenv
import os

# Load your existing .env file so you don't hardcode credentials
load_dotenv()

# Connect to your postgres — note port 5433 (your host mapping)
conn = psycopg2.connect(
    host="localhost",
    port=5433,                          # your host port from docker-compose
    dbname=os.getenv("POSTGRES_DB"),
    user=os.getenv("POSTGRES_USER"),
    password=os.getenv("POSTGRES_PASSWORD")
)

query = """
    SELECT
        p.id                                                       AS id,
        COALESCE(p.name, '')                                       AS name,
        COALESCE(p.content, '')                                    AS content,
        COALESCE(p.name,'') || ' ' || COALESCE(p.content, '')     AS text,
        c.id                                                       AS channel_id,
        c.name                                                     AS channel_name,
        p.begin_time,
        p.end_time
    FROM program p
    JOIN channel c ON c.id = p.channel_id
    LEFT JOIN program_label pl ON pl.program_id = p.id
    WHERE pl.id IS NULL
      AND p.draft_batch_id IS NULL
    ORDER BY p.create_time DESC
    LIMIT 6000
"""

df = pd.read_sql(query, conn)
conn.close()

# Basic validation before saving
print(f"Exported rows : {len(df)}")
print(f"Empty text    : {(df['text'].str.strip() == '').sum()}")
print(f"Channels      : {df['channel_name'].nunique()} unique channels")
print()
print(df['channel_name'].value_counts())

# Save
output_path = "E:/Users/Downloads/to_label.csv"
df.to_csv(output_path, index=False, encoding='utf-8-sig')
print(f"\nSaved to {output_path}")