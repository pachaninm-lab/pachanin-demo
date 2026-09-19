"""Train price prediction model using historical deal data from PostgreSQL."""

from __future__ import annotations

import os
import logging
import joblib
import numpy as np
import pandas as pd
from datetime import datetime

logger = logging.getLogger(__name__)

MODEL_OUTPUT = os.getenv("MODEL_PATH", "/app/models")
DB_URL = os.getenv("DATABASE_URL", "postgresql://grainflow:grainflow@localhost:5432/grainflow")

REGION_CODES = {
    "Краснодарский край": 1, "Ставропольский край": 2, "Ростовская область": 3,
    "Воронежская область": 4, "Тамбовская область": 5, "Курская область": 6,
    "Белгородская область": 7, "Оренбургская область": 8, "Саратовская область": 9,
    "Волгоградская область": 10, "Алтайский край": 11, "Омская область": 12,
    "Новосибирская область": 13,
}

CROP_CODES = {"WHEAT": 1, "BARLEY": 2, "CORN": 3, "SUNFLOWER": 4, "SOY": 5}


def load_data(conn) -> pd.DataFrame:
    query = """
        SELECT
            d.region,
            d."cropType" AS crop_type,
            d."cropClass" AS crop_class,
            d."volumeTons" AS volume_tons,
            d."priceKopecks" AS price_kopecks,
            EXTRACT(MONTH FROM d."createdAt") AS month
        FROM deals d
        WHERE d.status = 'COMPLETED'
          AND d."priceKopecks" IS NOT NULL
          AND d."priceKopecks" > 0
          AND d."volumeTons" > 0
        ORDER BY d."createdAt" DESC
        LIMIT 100000
    """
    return pd.read_sql(query, conn)


def featurize(df: pd.DataFrame) -> tuple[np.ndarray, np.ndarray]:
    X = np.column_stack([
        df["region"].map(REGION_CODES).fillna(0).astype(int),
        df["crop_type"].map(CROP_CODES).fillna(1).astype(int),
        pd.to_numeric(df["crop_class"].replace({"FEED": "6"}), errors="coerce").fillna(4).astype(int),
        df["volume_tons"].astype(float),
        df["month"].astype(int),
    ])
    y = df["price_kopecks"].astype(float).values
    return X, y


def train(X: np.ndarray, y: np.ndarray):
    from lightgbm import LGBMRegressor
    model = LGBMRegressor(
        n_estimators=500,
        learning_rate=0.05,
        max_depth=6,
        num_leaves=63,
        subsample=0.8,
        colsample_bytree=0.8,
        random_state=42,
        n_jobs=-1,
        verbose=-1,
    )
    model.fit(X, y, eval_set=[(X, y)], callbacks=[])
    return model


def main():
    import psycopg2
    from psycopg2 import sql

    os.makedirs(MODEL_OUTPUT, exist_ok=True)

    logger.info("Connecting to database...")
    conn = psycopg2.connect(DB_URL)
    try:
        df = load_data(conn)
    finally:
        conn.close()

    if len(df) < 100:
        logger.warning("Not enough data (%d rows), skipping training", len(df))
        return

    logger.info("Loaded %d deal records, training model...", len(df))
    X, y = featurize(df)
    model = train(X, y)

    out_path = os.path.join(MODEL_OUTPUT, "price_predictor.joblib")
    joblib.dump(model, out_path)
    logger.info("Price predictor saved to %s", out_path)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    main()
