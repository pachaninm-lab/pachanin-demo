"""Price Predictor — predicts grain price per ton based on region, class, date, market data."""

from __future__ import annotations

import os
import logging
from datetime import date
from typing import Optional

import numpy as np
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

# Lazy-loaded model
price_model = None
_model_path = os.path.join(os.getenv("MODEL_PATH", "/app/models"), "price_predictor.joblib")


def _load_model():
    global price_model
    try:
        import joblib
        price_model = joblib.load(_model_path)
        logger.info("Price predictor model loaded from %s", _model_path)
    except FileNotFoundError:
        logger.warning("Price model not found at %s — using heuristic fallback", _model_path)
        price_model = None


_load_model()

router = APIRouter()

# Регионы России — базовые цены (в копейках за тонну, мягкая пшеница 4 класс)
REGION_BASE_PRICES: dict[str, int] = {
    "Краснодарский край": 1_700_000,
    "Ставропольский край": 1_650_000,
    "Ростовская область": 1_680_000,
    "Воронежская область": 1_600_000,
    "Тамбовская область": 1_580_000,
    "Курская область": 1_560_000,
    "Белгородская область": 1_590_000,
    "Оренбургская область": 1_520_000,
    "Саратовская область": 1_540_000,
    "Волгоградская область": 1_530_000,
    "Алтайский край": 1_490_000,
    "Омская область": 1_500_000,
    "Новосибирская область": 1_480_000,
    "DEFAULT": 1_550_000,
}

# Корректировки по классу зерна
CLASS_ADJUSTMENTS: dict[str, float] = {
    "1": 1.15,
    "2": 1.08,
    "3": 1.03,
    "4": 1.00,
    "5": 0.88,
    "FEED": 0.72,
}

# Сезонные коэффициенты
SEASONAL_COEFFICIENTS = {
    7: 0.95,  # июль — уборка, цены снижаются
    8: 0.93,  # август — пик уборки
    9: 0.96,  # сентябрь
    10: 0.99, # октябрь
    11: 1.02, # ноябрь
    12: 1.04, # декабрь
    1: 1.05,  # январь
    2: 1.05,  # февраль
    3: 1.04,  # март
    4: 1.03,  # апрель
    5: 1.01,  # май
    6: 0.98,  # июнь — предуборочный
}


class PricePredictRequest(BaseModel):
    region: str = Field(..., description="Регион производства")
    crop_type: str = Field(..., description="Культура: WHEAT | BARLEY | CORN | SUNFLOWER | SOY")
    crop_class: str = Field(default="4", description="Класс: 1-5, FEED")
    volume_tons: float = Field(..., gt=0, description="Объём в тоннах")
    delivery_date: Optional[date] = Field(default=None, description="Дата поставки")
    quality: Optional[dict] = Field(default=None, description="Показатели качества ГОСТ")


class PricePredictResponse(BaseModel):
    price_per_ton_kopecks: int
    total_kopecks: int
    confidence_interval: dict
    factors: dict
    model: str


@router.post("/predict", response_model=PricePredictResponse)
async def predict_price(req: PricePredictRequest):
    """Предсказание цены на зерно по параметрам сделки."""
    try:
        if price_model is not None:
            # ML модель (LightGBM)
            features = _extract_features(req)
            price_kopecks = int(price_model.predict([features])[0])
            model_name = "lightgbm_v1"
            confidence = {"low": int(price_kopecks * 0.94), "high": int(price_kopecks * 1.06)}
        else:
            # Эвристика-фоллбэк
            price_kopecks, confidence, factors = _heuristic_price(req)
            model_name = "heuristic_fallback"

        total = int(price_kopecks * req.volume_tons)

        return PricePredictResponse(
            price_per_ton_kopecks=price_kopecks,
            total_kopecks=total,
            confidence_interval=confidence,
            factors=_get_factors(req),
            model=model_name,
        )
    except Exception as exc:
        logger.exception("Price prediction failed: %s", exc)
        raise HTTPException(status_code=500, detail="Price prediction failed") from exc


def _heuristic_price(req: PricePredictRequest) -> tuple[int, dict, dict]:
    base = REGION_BASE_PRICES.get(req.region, REGION_BASE_PRICES["DEFAULT"])

    # Культура
    crop_mult = {"WHEAT": 1.0, "BARLEY": 0.82, "CORN": 0.90, "SUNFLOWER": 2.10, "SOY": 1.95}.get(
        req.crop_type.upper(), 1.0
    )

    # Класс
    class_mult = CLASS_ADJUSTMENTS.get(req.crop_class, 1.0)

    # Сезон
    month = req.delivery_date.month if req.delivery_date else date.today().month
    season_mult = SEASONAL_COEFFICIENTS.get(month, 1.0)

    # Объём (скидка за большой объём)
    volume_mult = 1.0
    if req.volume_tons > 1000:
        volume_mult = 0.98
    elif req.volume_tons > 5000:
        volume_mult = 0.96

    price = int(base * crop_mult * class_mult * season_mult * volume_mult)
    spread = int(price * 0.06)
    return price, {"low": price - spread, "high": price + spread}, {}


def _get_factors(req: PricePredictRequest) -> dict:
    return {
        "region": req.region,
        "crop_type": req.crop_type,
        "crop_class": req.crop_class,
        "seasonality": "applied",
        "volume_discount": req.volume_tons > 1000,
    }


def _extract_features(req: PricePredictRequest) -> list:
    month = req.delivery_date.month if req.delivery_date else date.today().month
    return [
        hash(req.region) % 100,
        hash(req.crop_type) % 20,
        int(req.crop_class) if req.crop_class.isdigit() else 4,
        req.volume_tons,
        month,
    ]


@router.get("/market-index")
async def get_market_index(region: str, crop_type: str = "WHEAT"):
    """Рыночный индекс цен по региону и культуре."""
    base = REGION_BASE_PRICES.get(region, REGION_BASE_PRICES["DEFAULT"])
    crop_mult = {"WHEAT": 1.0, "BARLEY": 0.82, "CORN": 0.90, "SUNFLOWER": 2.10, "SOY": 1.95}.get(
        crop_type.upper(), 1.0
    )
    month = date.today().month
    price = int(base * crop_mult * SEASONAL_COEFFICIENTS.get(month, 1.0))
    return {
        "region": region,
        "crop_type": crop_type,
        "index_kopecks_per_ton": price,
        "trend": "stable",
        "updated_at": date.today().isoformat(),
    }
