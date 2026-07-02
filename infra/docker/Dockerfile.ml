# GrainFlow ML Service — Python 3.11 FastAPI
# Price predictor, counterparty scoring, fraud detector

FROM python:3.11-slim AS base

WORKDIR /app

# Системные зависимости для scikit-learn / LightGBM
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

FROM base AS deps
COPY apps/ml/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

FROM deps AS production

COPY apps/ml/ .

RUN adduser --disabled-password --no-create-home mluser
USER mluser

ENV PYTHONUNBUFFERED=1
ENV PORT=8001

EXPOSE 8001

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8001/health')"

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001"]
