"""GrainFlow ML Service — Price Predictor, Counterparty Scoring, Fraud Detector."""

from __future__ import annotations

import os
import time
import logging

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from opentelemetry import trace
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor

try:
    from prometheus_client import Counter, Histogram, generate_latest, CONTENT_TYPE_LATEST, CollectorRegistry
    PROM_REGISTRY = CollectorRegistry(auto_describe=True)
    ML_REQUEST_COUNT = Counter(
        "grainflow_ml_requests_total",
        "Total ML requests",
        ["endpoint", "status"],
        registry=PROM_REGISTRY,
    )
    ML_REQUEST_LATENCY = Histogram(
        "grainflow_ml_request_duration_seconds",
        "ML request latency",
        ["endpoint"],
        registry=PROM_REGISTRY,
    )
    PROM_ENABLED = True
except ImportError:
    PROM_ENABLED = False
    ML_REQUEST_COUNT = None
    ML_REQUEST_LATENCY = None

from routers import price, scoring, fraud, health

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# OpenTelemetry setup
OTEL_ENDPOINT = os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT", "http://otel-collector:4317")
provider = TracerProvider()
provider.add_span_processor(
    BatchSpanProcessor(OTLPSpanExporter(endpoint=OTEL_ENDPOINT, insecure=True))
)
trace.set_tracer_provider(provider)

app = FastAPI(
    title="GrainFlow ML Service",
    description="Predictive analytics: price forecasting, counterparty scoring, fraud detection",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://app.grainflow.ru"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

FastAPIInstrumentor.instrument_app(app)

# Request timing + prometheus middleware
@app.middleware("http")
async def add_process_time_header(request: Request, call_next):
    start_time = time.time()
    response = await call_next(request)
    process_time = (time.time() - start_time) * 1000
    response.headers["X-Process-Time-Ms"] = str(round(process_time, 2))

    if PROM_ENABLED and request.url.path.startswith("/api/ml/"):
        endpoint = request.url.path.split("/")[3] if len(request.url.path.split("/")) > 3 else "unknown"
        status = "2xx" if response.status_code < 300 else ("4xx" if response.status_code < 500 else "5xx")
        ML_REQUEST_COUNT.labels(endpoint=endpoint, status=status).inc()
        ML_REQUEST_LATENCY.labels(endpoint=endpoint).observe(process_time / 1000)

    return response


@app.get("/metrics", include_in_schema=False)
async def metrics():
    if not PROM_ENABLED:
        return Response("# prometheus_client not installed\n", media_type="text/plain")
    return Response(generate_latest(PROM_REGISTRY), media_type=CONTENT_TYPE_LATEST)

app.include_router(health.router, tags=["health"])
app.include_router(price.router, prefix="/api/ml/price", tags=["price-predictor"])
app.include_router(scoring.router, prefix="/api/ml/scoring", tags=["counterparty-scoring"])
app.include_router(fraud.router, prefix="/api/ml/fraud", tags=["fraud-detector"])


@app.post("/api/ml/reload", include_in_schema=True, tags=["admin"])
async def reload_models():
    """Hot-reload всех ML моделей без рестарта сервиса."""
    import importlib
    from routers import price as price_mod, scoring as scoring_mod, fraud as fraud_mod
    reloaded = []
    for mod in (price_mod, scoring_mod, fraud_mod):
        if hasattr(mod, "_reload_model"):
            try:
                mod._reload_model()
                reloaded.append(mod.__name__.split(".")[-1])
            except Exception as exc:
                logger.warning("reload failed for %s: %s", mod.__name__, exc)
    return {"status": "ok", "reloaded": reloaded}
