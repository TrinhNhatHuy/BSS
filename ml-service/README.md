# BSS ML service

Serves `model_v2_text_channel.pkl` (program → category classifier) over HTTP, and
provides a one-time DB backfill script. Kept separate from the Java backend because
the model is a Python pickle that can't be loaded in the JVM.

Categories: `Kids, Music, News, Others, SeriesFR, SeriesVN, Sports`.

## Setup (one time)

```powershell
cd ml-service
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

> The model needs **numpy ≥ 2** and **scikit-learn 1.6.1** — different from the
> repo's global Python env, so always use this dedicated `.venv`.

## Run the prediction service

```powershell
.\.venv\Scripts\python.exe app.py        # waitress on http://0.0.0.0:5005
```

Env overrides: `PORT` (default 5005), `HOST`, `MODEL_PATH`.

### Endpoints

```
GET  /health
  -> {"status":"ok","classes":[...],"model_path":"..."}

POST /predict
  body  {"items":[{"name":"...","content":"...","channel_name":"..."}, ...]}
  resp  {"results":[{"label":"News","confidence":0.67,"margin":2.27}, ...]}
```

`confidence` is a softmax over the LinearSVC `decision_function` (a **proxy** —
LinearSVC isn't probabilistic). `margin` = top1 − top2 decision score.

The Spring backend calls `/predict` (see `MlClient.java`, `ml.service.url`) to
lazily label each day's programs the first time that day's home page is viewed.

## One-time backfill (label existing programs)

Labels live programs (`draft_batch_id IS NULL`) that have no category yet, writing
`program.category` and a `program_label` row (`label_source = MODEL_V2`,
`note = "conf=..;margin=.."`). Reads DB creds from the repo-root `.env` by default.

```powershell
# Recent dates (today + demo days). Omit --from/--to to label everything.
.\.venv\Scripts\python.exe label_backfill.py --from 20260601 --to 20260607

.\.venv\Scripts\python.exe label_backfill.py --force      # relabel even if set
.\.venv\Scripts\python.exe label_backfill.py --dry-run    # predict + summarize, no writes
```

Prints a per-category count and a confidence histogram for evaluation. Idempotent.