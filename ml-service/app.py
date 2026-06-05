"""
BSS category-prediction microservice.

Serves the trained scikit-learn model (model_v2_text_channel.pkl) over HTTP so the
Java backend (which can't unpickle a Python model) can label programs by category.

The model is a Pipeline:
    ColumnTransformer[ TfidfVectorizer('text') + OneHotEncoder('channel_name') ] -> LinearSVC

so the only inputs that matter are:
    text          = program name + " " + content
    channel_name  = the channel's display name (OneHotEncoder uses handle_unknown='ignore',
                    so unseen channel names are harmless)

LinearSVC is not probabilistic, so "confidence" is a *proxy*: softmax over the
decision_function scores. We also return the raw decision `margin` (top1 - top2),
which is often the more useful signal for evaluation.

Endpoints:
    GET  /health   -> {"status": "ok", "classes": [...], "model_path": "..."}
    POST /predict  -> body {"items": [{"name","content","channel_name"}, ...]}
                      resp {"results": [{"label","confidence","margin"}, ...]}

Run (from ml-service/, with the venv active):
    python app.py                      # waitress on 0.0.0.0:5005
    # or: waitress-serve --port=5005 app:app
"""

import os
import warnings

import joblib
import numpy as np
import pandas as pd
from flask import Flask, jsonify, request

# The model was pickled with sklearn 1.6.1 / numpy 2.x; suppress the harmless
# InconsistentVersionWarning if a slightly different patch version is installed.
warnings.filterwarnings("ignore", category=UserWarning)

# --- config ---------------------------------------------------------------

# Default: model_v2_text_channel.pkl in the project root (one level up).
DEFAULT_MODEL_PATH = os.path.join(os.path.dirname(__file__), "..", "model_v2_text_channel.pkl")
MODEL_PATH = os.environ.get("MODEL_PATH", DEFAULT_MODEL_PATH)
PORT = int(os.environ.get("PORT", "5005"))
HOST = os.environ.get("HOST", "0.0.0.0")

# --- model load (once, at import) -----------------------------------------

print(f"[ml-service] loading model from {os.path.abspath(MODEL_PATH)} ...")
MODEL = joblib.load(MODEL_PATH)
CLASSES = list(MODEL.classes_)
print(f"[ml-service] model loaded. classes = {CLASSES}")

app = Flask(__name__)
# Keep Vietnamese characters readable in JSON responses (don't \uXXXX-escape).
app.config["JSON_AS_ASCII"] = False
app.json.ensure_ascii = False


# --- helpers --------------------------------------------------------------

def _build_text(item: dict) -> str:
    """Recreate the training `text` feature: name + ' ' + content."""
    name = (item.get("name") or "").strip()
    content = (item.get("content") or "").strip()
    return (name + " " + content).strip()


def _softmax(scores: np.ndarray) -> np.ndarray:
    """Row-wise softmax (numerically stable). scores: (n, n_classes)."""
    e = np.exp(scores - scores.max(axis=1, keepdims=True))
    return e / e.sum(axis=1, keepdims=True)


def _predict_frame(df: pd.DataFrame):
    """
    Return (labels, confidences, margins) as plain Python lists.

    confidence = softmax probability of the predicted class (0..1, proxy).
    margin     = (highest decision score) - (second highest), per row.
    """
    # decision_function -> (n, n_classes). LinearSVC has it; fall back to
    # predict_proba if a future model is probabilistic.
    if hasattr(MODEL, "decision_function"):
        scores = np.asarray(MODEL.decision_function(df))
        if scores.ndim == 1:  # binary edge case -> expand to 2 columns
            scores = np.column_stack([-scores, scores])
        proba = _softmax(scores)
    else:  # pragma: no cover - current model uses decision_function
        proba = np.asarray(MODEL.predict_proba(df))
        scores = proba

    top_idx = proba.argmax(axis=1)
    labels = [CLASSES[i] for i in top_idx]
    confidences = proba[np.arange(len(proba)), top_idx]

    # margin between best and second-best decision score
    if scores.shape[1] >= 2:
        part = np.sort(scores, axis=1)
        margins = part[:, -1] - part[:, -2]
    else:
        margins = np.zeros(len(scores))

    return (
        labels,
        [round(float(c), 4) for c in confidences],
        [round(float(m), 4) for m in margins],
    )


# --- routes ---------------------------------------------------------------

@app.get("/health")
def health():
    return jsonify(status="ok", classes=CLASSES, model_path=os.path.abspath(MODEL_PATH))


@app.post("/predict")
def predict():
    payload = request.get_json(silent=True) or {}
    items = payload.get("items")
    if not isinstance(items, list):
        return jsonify(error="Body must be JSON with an 'items' array."), 400
    if len(items) == 0:
        return jsonify(results=[])

    df = pd.DataFrame(
        {
            "text": [_build_text(it) for it in items],
            "channel_name": [(it.get("channel_name") or "").strip() for it in items],
        }
    )

    labels, confidences, margins = _predict_frame(df)
    results = [
        {"label": labels[i], "confidence": confidences[i], "margin": margins[i]}
        for i in range(len(items))
    ]
    return jsonify(results=results)


if __name__ == "__main__":
    try:
        from waitress import serve

        print(f"[ml-service] serving on http://{HOST}:{PORT} (waitress)")
        serve(app, host=HOST, port=PORT)
    except ImportError:
        print(f"[ml-service] waitress not found, using Flask dev server on :{PORT}")
        app.run(host=HOST, port=PORT)