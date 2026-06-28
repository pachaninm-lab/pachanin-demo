"""Fraud Detector — выявление подозрительных паттернов в сделках и действиях пользователей."""

from __future__ import annotations

import os
import logging
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

fraud_model = None
_model_path = os.path.join(os.getenv("MODEL_PATH", "/app/models"), "fraud_detector.joblib")


def _load_model():
    global fraud_model
    try:
        import joblib
        fraud_model = joblib.load(_model_path)
        logger.info("Fraud detector model loaded")
    except FileNotFoundError:
        logger.warning("Fraud model not found — using rule-based fallback")
        fraud_model = None


_load_model()


def _reload_model():
    _load_model()


router = APIRouter()


class FraudCheckRequest(BaseModel):
    user_id: str
    organization_id: str
    action: str = Field(..., description="deal:create | payment:reserve | document:sign | status:transition")
    amount_kopecks: Optional[int] = Field(default=None, ge=0)
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None

    # Контекстуальные признаки
    actions_last_hour: int = Field(default=0, ge=0)
    new_counterparty: bool = Field(default=False)
    off_hours: bool = Field(default=False)  # 00:00 – 06:00 МСК
    amount_deviation_pct: float = Field(default=0.0, description="% отклонения суммы от средней по сделкам орг")
    document_mismatch: bool = Field(default=False)
    role_abuse_signal: bool = Field(default=False)  # попытка действия вне своей роли
    vpn_detected: bool = Field(default=False)
    previously_flagged: bool = Field(default=False)


class FraudCheckResponse(BaseModel):
    risk_score: float = Field(..., ge=0.0, le=1.0, description="0 — чисто, 1 — мошенничество")
    is_suspicious: bool
    flags: list[str]
    action: str  # ALLOW | REVIEW | BLOCK
    reason: Optional[str] = None


# Пороги
REVIEW_THRESHOLD = 0.45
BLOCK_THRESHOLD = 0.75


@router.post("/check", response_model=FraudCheckResponse)
async def check_fraud(req: FraudCheckRequest):
    """Проверка действия на признаки мошенничества."""
    try:
        flags = []
        score = 0.0

        if fraud_model is not None:
            features = _extract_features(req)
            score = float(fraud_model.predict_proba([features])[0][1])
        else:
            score, flags = _rule_based_score(req)

        is_suspicious = score >= REVIEW_THRESHOLD
        if score >= BLOCK_THRESHOLD:
            action = "BLOCK"
        elif score >= REVIEW_THRESHOLD:
            action = "REVIEW"
        else:
            action = "ALLOW"

        return FraudCheckResponse(
            risk_score=round(score, 4),
            is_suspicious=is_suspicious,
            flags=flags,
            action=action,
            reason=_reason(action, flags),
        )
    except Exception as exc:
        logger.exception("Fraud check failed: %s", exc)
        raise HTTPException(status_code=500, detail="Fraud check failed") from exc


def _rule_based_score(req: FraudCheckRequest) -> tuple[float, list[str]]:
    score = 0.0
    flags = []

    if req.previously_flagged:
        score += 0.40
        flags.append("PREVIOUSLY_FLAGGED")

    if req.role_abuse_signal:
        score += 0.35
        flags.append("ROLE_ABUSE")

    if req.document_mismatch:
        score += 0.30
        flags.append("DOCUMENT_MISMATCH")

    if req.actions_last_hour > 50:
        score += 0.25
        flags.append("HIGH_FREQUENCY")
    elif req.actions_last_hour > 20:
        score += 0.10
        flags.append("ELEVATED_FREQUENCY")

    if req.amount_kopecks and req.amount_kopecks > 100_000_000_00:  # > 100M ₽
        score += 0.20
        flags.append("LARGE_AMOUNT")

    if req.amount_deviation_pct > 200:
        score += 0.25
        flags.append("AMOUNT_ANOMALY")
    elif req.amount_deviation_pct > 100:
        score += 0.10
        flags.append("AMOUNT_ELEVATED")

    if req.vpn_detected and req.off_hours:
        score += 0.20
        flags.append("VPN_OFF_HOURS")
    elif req.vpn_detected:
        score += 0.10
        flags.append("VPN_DETECTED")

    if req.off_hours and req.amount_kopecks and req.amount_kopecks > 50_000_000_00:
        score += 0.15
        flags.append("LARGE_OFF_HOURS")

    if req.new_counterparty and req.amount_kopecks and req.amount_kopecks > 10_000_000_00:
        score += 0.15
        flags.append("NEW_COUNTERPARTY_LARGE")

    return min(1.0, score), flags


def _extract_features(req: FraudCheckRequest) -> list:
    return [
        req.actions_last_hour,
        1 if req.new_counterparty else 0,
        1 if req.off_hours else 0,
        req.amount_deviation_pct,
        1 if req.document_mismatch else 0,
        1 if req.role_abuse_signal else 0,
        1 if req.vpn_detected else 0,
        1 if req.previously_flagged else 0,
        (req.amount_kopecks or 0) / 1_000_000,
    ]


def _reason(action: str, flags: list[str]) -> Optional[str]:
    if action == "ALLOW":
        return None
    mapping = {
        "PREVIOUSLY_FLAGGED": "Пользователь ранее был отмечен как подозрительный",
        "ROLE_ABUSE": "Попытка действия вне допустимой роли",
        "DOCUMENT_MISMATCH": "Несоответствие документов в сделке",
        "HIGH_FREQUENCY": "Аномально высокая частота действий",
        "LARGE_AMOUNT": "Сумма превышает обычный диапазон",
        "AMOUNT_ANOMALY": "Сумма сильно отклоняется от среднего",
        "VPN_OFF_HOURS": "Вход через VPN в нерабочее время",
        "NEW_COUNTERPARTY_LARGE": "Крупная сделка с новым контрагентом",
    }
    reasons = [mapping.get(f, f) for f in flags[:3]]
    return "; ".join(reasons) if reasons else "Подозрительная активность"


@router.get("/patterns")
async def get_fraud_patterns():
    """Список активных правил обнаружения мошенничества."""
    return {
        "rules": [
            {"id": "ROLE_ABUSE", "description": "Действие вне роли пользователя", "weight": 0.35},
            {"id": "DOCUMENT_MISMATCH", "description": "Документы не совпадают с данными сделки", "weight": 0.30},
            {"id": "HIGH_FREQUENCY", "description": ">50 действий в час", "weight": 0.25},
            {"id": "AMOUNT_ANOMALY", "description": "Сумма >200% от среднего", "weight": 0.25},
            {"id": "VPN_OFF_HOURS", "description": "VPN + нерабочее время", "weight": 0.20},
            {"id": "LARGE_AMOUNT", "description": "Сумма >100M ₽", "weight": 0.20},
            {"id": "NEW_COUNTERPARTY_LARGE", "description": "Новый контрагент + >10M ₽", "weight": 0.15},
            {"id": "PREVIOUSLY_FLAGGED", "description": "Ранее помечен как подозрительный", "weight": 0.40},
        ],
        "thresholds": {
            "review": REVIEW_THRESHOLD,
            "block": BLOCK_THRESHOLD,
        },
        "model": "lightgbm_v1" if fraud_model else "rule_based",
    }
