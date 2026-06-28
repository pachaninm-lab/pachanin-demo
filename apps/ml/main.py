"""GrainFlow ML Service — Price Predictor, Counterparty Scoring, Fraud Detector."""

from __future__ import annotations

import os
import time
import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from opentelemetry import trace
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor

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

# Request timing middleware
@app.middleware("http")
async def add_process_time_header(request: Request, call_next):
    start_time = time.time()
    response = await call_next(request)
    process_time = (time.time() - start_time) * 1000
    response.headers["X-Process-Time-Ms"] = str(round(process_time, 2))
    return response

app.include_router(health.router, tags=["health"])
app.include_router(price.router, prefix="/api/ml/price", tags=["price-predictor"])
app.include_router(scoring.router, prefix="/api/ml/scoring", tags=["counterparty-scoring"])
app.include_router(fraud.router, prefix="/api/ml/fraud", tags=["fraud-detector"])
