# Category-prediction microservice.
# Build context is the PROJECT ROOT (so we can COPY the model from the repo root):
#   docker build -f ml-service/Dockerfile -t bss-ml-service .
# In docker-compose this is wired as:
#   build: { context: ., dockerfile: ./ml-service/Dockerfile }
FROM python:3.11-slim

WORKDIR /app

# Install deps first for layer caching. Wheels exist for numpy/scipy/scikit-learn/
# pandas/psycopg2-binary, so no compiler toolchain is needed on slim.
COPY ml-service/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# App code + the trained model (model lives in the repo root).
COPY ml-service/app.py ./app.py
COPY ml-service/label_backfill.py ./label_backfill.py
COPY model_v2_text_channel.pkl ./model_v2_text_channel.pkl

ENV MODEL_PATH=/app/model_v2_text_channel.pkl
ENV HOST=0.0.0.0
ENV PORT=5005
EXPOSE 5005

CMD ["python", "app.py"]
