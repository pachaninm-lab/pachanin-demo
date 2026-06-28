"""Health check endpoints."""

from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()


class HealthResponse(BaseModel):
    status: str
    version: str = "1.0.0"
    models: dict


@router.get("/health", response_model=HealthResponse)
async def health():
    from routers.price import price_model
    from routers.scoring import scoring_model
    from routers.fraud import fraud_model

    return HealthResponse(
        status="ok",
        models={
            "price_predictor": "loaded" if price_model else "fallback",
            "counterparty_scoring": "loaded" if scoring_model else "fallback",
            "fraud_detector": "loaded" if fraud_model else "fallback",
        },
    )


@router.get("/ready")
async def ready():
    return {"status": "ready"}
