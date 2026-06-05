"""
One-time (idempotent) backfill: label live programs with the model.

For every live program (draft_batch_id IS NULL) that has no category yet, predict
its category and write:
  * program.category
  * a program_label row (label_source='MODEL_V2', note='conf=..;margin=..')

DB credentials are read from the repo-root .env (DB_HOST/DB_PORT/POSTGRES_*),
overridable via CLI flags. Predictions run directly against the loaded model
(no HTTP service needed).

Examples
--------
    python label_backfill.py --from 20260601 --to 20260607
    python label_backfill.py                 # everything still unlabeled
    python label_backfill.py --force         # relabel even already-set rows
    python label_backfill.py --dry-run       # predict + summarize, write nothing
"""

import argparse
import os
import sys
import warnings
from collections import Counter

import joblib
import numpy as np
import pandas as pd
import psycopg2
import psycopg2.extras

warnings.filterwarnings("ignore", category=UserWarning)

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
DEFAULT_MODEL_PATH = os.path.join(ROOT, "model_v2_text_channel.pkl")
ENV_PATH = os.path.join(ROOT, ".env")


def load_env(path):
    """Minimal .env parser (KEY=VALUE lines)."""
    env = {}
    if os.path.exists(path):
        with open(path, encoding="utf-8") as fh:
            for line in fh:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                k, v = line.split("=", 1)
                env[k.strip()] = v.strip()
    return env


def softmax(scores):
    e = np.exp(scores - scores.max(axis=1, keepdims=True))
    return e / e.sum(axis=1, keepdims=True)


def predict(model, df):
    """Return (labels, confidences, margins)."""
    classes = list(model.classes_)
    scores = np.asarray(model.decision_function(df))
    if scores.ndim == 1:
        scores = np.column_stack([-scores, scores])
    proba = softmax(scores)
    top = proba.argmax(axis=1)
    labels = [classes[i] for i in top]
    conf = proba[np.arange(len(proba)), top]
    part = np.sort(scores, axis=1)
    margin = part[:, -1] - part[:, -2]
    return labels, conf, margin


def main():
    ap = argparse.ArgumentParser(description="Backfill program categories with the model.")
    ap.add_argument("--from", dest="date_from", help="begin_time date prefix lower bound, YYYYMMDD")
    ap.add_argument("--to", dest="date_to", help="begin_time date prefix upper bound, YYYYMMDD")
    ap.add_argument("--force", action="store_true", help="relabel programs that already have a category")
    ap.add_argument("--dry-run", action="store_true", help="predict and summarize but do not write")
    ap.add_argument("--limit", type=int, default=None, help="cap number of programs (for testing)")
    ap.add_argument("--model", default=os.environ.get("MODEL_PATH", DEFAULT_MODEL_PATH))
    # DB overrides (default from .env)
    env = load_env(ENV_PATH)
    ap.add_argument("--host", default=env.get("DB_HOST", "localhost"))
    ap.add_argument("--port", default=env.get("DB_PORT", "5432"))
    ap.add_argument("--db", default=env.get("POSTGRES_DB", "bss-db-schema"))
    ap.add_argument("--user", default=env.get("POSTGRES_USER", "postgres"))
    ap.add_argument("--password", default=env.get("POSTGRES_PASSWORD", ""))
    args = ap.parse_args()

    print(f"[backfill] loading model {os.path.abspath(args.model)}")
    model = joblib.load(args.model)

    print(f"[backfill] connecting to {args.host}:{args.port}/{args.db}")
    conn = psycopg2.connect(
        host=args.host, port=args.port, dbname=args.db,
        user=args.user, password=args.password, connect_timeout=15,
    )
    conn.autocommit = False
    cur = conn.cursor()

    # Select live programs to label, with channel display name for the model.
    where = ["p.draft_batch_id IS NULL"]
    params = []
    if not args.force:
        where.append("p.category IS NULL")
    if args.date_from:
        where.append("substring(p.begin_time,1,8) >= %s")
        params.append(args.date_from)
    if args.date_to:
        where.append("substring(p.begin_time,1,8) <= %s")
        params.append(args.date_to)
    sql = (
        "SELECT p.id, p.name, p.content, c.name AS channel_name "
        "FROM program p LEFT JOIN channel c ON p.channel_id = c.id "
        "WHERE " + " AND ".join(where) + " ORDER BY p.id"
    )
    if args.limit:
        sql += f" LIMIT {int(args.limit)}"

    cur.execute(sql, params)
    rows = cur.fetchall()
    print(f"[backfill] {len(rows)} programs to label")
    if not rows:
        conn.close()
        return

    ids = [r[0] for r in rows]
    df = pd.DataFrame(
        {
            "text": [((r[1] or "").strip() + " " + (r[2] or "").strip()).strip() for r in rows],
            "channel_name": [(r[3] or "").strip() for r in rows],
        }
    )

    print("[backfill] predicting ...")
    labels, conf, margin = predict(model, df)

    # --- summary (per-category counts + confidence histogram) -------------
    print("\n=== Predicted category distribution ===")
    for cat, n in Counter(labels).most_common():
        print(f"  {cat:9s} {n}")

    print("\n=== Confidence histogram (softmax proxy) ===")
    buckets = [0.0, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.01]
    hist = Counter()
    for c in conf:
        for b0, b1 in zip(buckets, buckets[1:]):
            if b0 <= c < b1:
                hist[f"{b0:.1f}-{b1 if b1 <= 1 else 1.0:.1f}"] += 1
                break
    for b0, b1 in zip(buckets, buckets[1:]):
        key = f"{b0:.1f}-{b1 if b1 <= 1 else 1.0:.1f}"
        bar = "#" * (hist[key] * 40 // max(1, len(conf)))
        print(f"  {key}: {hist[key]:5d} {bar}")
    print(f"  mean confidence = {float(np.mean(conf)):.3f} | mean margin = {float(np.mean(margin)):.3f}")

    if args.dry_run:
        print("\n[backfill] --dry-run: no changes written.")
        conn.close()
        return

    # --- write back -------------------------------------------------------
    cat_updates = [(labels[i], ids[i]) for i in range(len(ids))]
    label_rows = [
        (ids[i], labels[i], f"conf={conf[i]:.4f};margin={margin[i]:.4f}")
        for i in range(len(ids))
    ]

    print("\n[backfill] writing program.category ...")
    psycopg2.extras.execute_batch(
        cur, "UPDATE program SET category = %s WHERE id = %s", cat_updates, page_size=500
    )

    print("[backfill] upserting program_label (MODEL_V2) ...")
    psycopg2.extras.execute_values(
        cur,
        "INSERT INTO program_label (program_id, category, label_source, is_verified, note, create_time, update_time) "
        "VALUES %s "
        "ON CONFLICT (program_id, label_source) DO UPDATE SET "
        "category = EXCLUDED.category, note = EXCLUDED.note, update_time = NOW()",
        label_rows,
        template="(%s, %s, 'MODEL_V2', FALSE, %s, NOW(), NOW())",
        page_size=500,
    )

    conn.commit()
    print(f"[backfill] committed: {len(ids)} programs labeled.")
    conn.close()


if __name__ == "__main__":
    sys.exit(main())
