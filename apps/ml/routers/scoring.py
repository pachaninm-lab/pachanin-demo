"""Counterparty Scoring — надёжность контрагента 0–100 на основе истории сделок."""

from __future__ import annotations

import os
import logging
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

scoring_model = None
_model_path = os.path.join(os.getenv("MODEL_PATH", "/app/models"), "scoring_model.joblib")


def _load_model():
    global scoring_model
    try:
        import joblib
        scoring_model = joblib.load(_model_path)
        logger.info("Scoring model loaded")
    except FileNotFoundError:
        logger.warning("Scoring model not found — using heuristic fallback")
        scoring_model = None


_load_model()

router = APIRouter()


class ScoringRequest(BaseModel):
    organization_id: str
    inn: Optional[str] = None
    total_deals: int = Field(default=0, ge=0, description="Кол-во завершённых сделок")
    cancelled_deals: int = Field(default=0, ge=0)
    dispute_deals: int = Field(default=0, ge=0)
    avg_deal_volume_tons: float = Field(default=0.0, ge=0)
    total_gmv_kopecks: int = Field(default=0, ge=0)
    avg_days_to_close: float = Field(default=0.0, ge=0)
    platform_age_days: int = Field(default=0, ge=0)
    kyc_status: str = Field(default="APPROVED")
    aml_status: str = Field(default="CLEAR")
    sanction_hit: bool = Field(default=False)
    late_payments: int = Field(default=0, ge=0)
    factoring_overdue: bool = Field(default=False)


class ScoringResponse(BaseModel):
    organization_id: str
    score: int = Field(..., ge=0, le=100)
    grade: str  # A+ | A | B+ | B | C | D | F
    risk_level: str  # LOW | MEDIUM | HIGH | CRITICAL
    factors: dict
    recommendation: str


def _score_to_grade(score: int) -> tuple[str, str]:
    if score >= 90:
        return "A+", "LOW"
    elif score >= 80:
        return "A", "LOW"
    elif score >= 70:
        return "B+", "MEDIUM"
    elif score >= 60:
        return "B", "MEDIUM"
    elif score >= 45:
        return "C", "HIGH"
    elif score >= 25:
        return "D", "HIGH"
    else:
        return "F", "CRITICAL"


@router.post("/score", response_model=ScoringResponse)
async def score_counterparty(req: ScoringRequest):
    """Скоринг контрагента по истории платформы."""
    try:
        if req.sanction_hit:
            score = 0
            grade, risk = "F", "CRITICAL"
            return ScoringResponse(
                organization_id=req.organization_id,
                score=score,
                grade=grade,
                risk_level=risk,
                factors={"sanction_hit": True},
                recommendation="Сделки запрещены: контрагент в санкционном списке",
            )

        if scoring_model is not None:
            features = [
                req.total_deals,
                req.cancelled_deals,
                req.dispute_deals,
                req.avg_deal_volume_tons,
                req.total_gmv_kopecks / 1_000_000,
                req.avg_days_to_close,
                req.platform_age_days,
                1 if req.kyc_status == "APPROVED" else 0,
                1 if req.aml_status == "CLEAR" else 0,
                req.late_payments,
            ]
            score = int(min(100, max(0, scoring_model.predict([features])[0])))
        else:
            score = _heuristic_score(req)

        if req.factoring_overdue:
            score = max(0, score - 25)
        if req.aml_status != "CLEAR":
            score = max(0, score - 20)

        grade, risk = _score_to_grade(score)

        return ScoringResponse(
            organization_id=req.organization_id,
            score=score,
            grade=grade,
            risk_level=risk,
            factors=_factors(req),
            recommendation=_recommendation(score, req),
        )
    except Exception as exc:
        logger.exception("Scoring failed: %s", exc)
        raise HTTPException(status_code=500, detail="Scoring failed") from exc


def _heuristic_score(req: ScoringRequest) -> int:
    score = 50  # базовый

    # История сделок
    if req.total_deals >= 50:
        score += 20
    elif req.total_deals >= 20:
        score += 12
    elif req.total_deals >= 5:
        score += 6

    # Отмены и споры
    if req.total_deals > 0:
        cancel_rate = req.cancelled_deals / req.total_deals
        dispute_rate = req.dispute_deals / req.total_deals
        score -= int(cancel_rate * 20)
        score -= int(dispute_rate * 15)

    # Возраст на платформе
    if req.platform_age_days >= 365:
        score += 10
    elif req.platform_age_days >= 90:
        score += 5

    # KYC
    if req.kyc_status == "APPROVED":
        score += 10

    # Просрочки
    score -= req.late_payments * 5

    return max(0, min(100, score))


def _factors(req: ScoringRequest) -> dict:
    return {
        "total_deals": req.total_deals,
        "cancel_rate": round(req.cancelled_deals / max(1, req.total_deals), 3),
        "dispute_rate": round(req.dispute_deals / max(1, req.total_deals), 3),
        "platform_age_days": req.platform_age_days,
        "kyc_approved": req.kyc_status == "APPROVED",
        "aml_clear": req.aml_status == "CLEAR",
        "late_payments": req.late_payments,
        "factoring_overdue": req.factoring_overdue,
    }


def _recommendation(score: int, req: ScoringRequest) -> str:
    if score >= 80:
        return "Надёжный контрагент. Стандартные условия сделки."
    elif score >= 60:
        return "Умеренный риск. Рекомендуется escrow и проверка документов."
    elif score >= 40:
        return "Повышенный риск. Требуется предоплата или банковская гарантия."
    else:
        return "Высокий риск. Сделка требует одобрения Compliance офицера."
