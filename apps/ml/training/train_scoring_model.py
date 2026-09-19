"""Train counterparty scoring model from platform organization history."""

from __future__ import annotations

import os
import logging
import joblib
import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)

MODEL_OUTPUT = os.getenv("MODEL_PATH", "/app/models")
DB_URL = os.getenv("DATABASE_URL", "postgresql://grainflow:grainflow@localhost:5432/grainflow")


def load_data(conn) -> pd.DataFrame:
    query = """
        SELECT
            o.id AS organization_id,
            COUNT(d.id) FILTER (WHERE d.status = 'COMPLETED') AS total_deals,
            COUNT(d.id) FILTER (WHERE d.status = 'CANCELLED') AS cancelled_deals,
            COUNT(d.id) FILTER (WHERE d.status = 'DISPUTE') AS dispute_deals,
            COALESCE(AVG(d."volumeTons") FILTER (WHERE d.status = 'COMPLETED'), 0) AS avg_volume,
            COALESCE(SUM(d."priceKopecks" * d."volumeTons") FILTER (WHERE d.status = 'COMPLETED'), 0) AS total_gmv,
            COALESCE(AVG(EXTRACT(DAY FROM d."updatedAt" - d."createdAt")) FILTER (WHERE d.status = 'COMPLETED'), 0) AS avg_days,
            EXTRACT(DAY FROM NOW() - o."createdAt") AS platform_age_days,
            CASE WHEN o."kycStatus" = 'APPROVED' THEN 1 ELSE 0 END AS kyc_approved,
            CASE WHEN o."amlStatus" = 'CLEAR' THEN 1 ELSE 0 END AS aml_clear,
            COALESCE(o."latePayments", 0) AS late_payments
        FROM organizations o
        LEFT JOIN deals d ON d."sellerOrgId" = o.id OR d."buyerOrgId" = o.id
        GROUP BY o.id
        HAVING COUNT(d.id) >= 5
    """
    return pd.read_sql(query, conn)


def compute_label(row: pd.Series) -> float:
    """Heuristic score 0-100 for training label."""
    score = 50.0
    total = max(1, row["total_deals"])
    score += min(20, row["total_deals"] * 0.4)
    score -= (row["cancelled_deals"] / total) * 20
    score -= (row["dispute_deals"] / total) * 15
    if row["platform_age_days"] >= 365:
        score += 10
    elif row["platform_age_days"] >= 90:
        score += 5
    score += row["kyc_approved"] * 10
    score -= row["late_payments"] * 5
    return float(max(0, min(100, score)))


def train(X: np.ndarray, y: np.ndarray):
    from lightgbm import LGBMRegressor
    model = LGBMRegressor(
        n_estimators=300,
        learning_rate=0.05,
        max_depth=5,
        random_state=42,
        verbose=-1,
    )
    model.fit(X, y)
    return model


def main():
    import psycopg2

    os.makedirs(MODEL_OUTPUT, exist_ok=True)

    conn = psycopg2.connect(DB_URL)
    try:
        df = load_data(conn)
    finally:
        conn.close()

    if len(df) < 50:
        logger.warning("Not enough organizations (%d), skipping training", len(df))
        return

    logger.info("Loaded %d organizations for scoring model training", len(df))

    feature_cols = [
        "total_deals", "cancelled_deals", "dispute_deals", "avg_volume",
        "total_gmv", "avg_days", "platform_age_days", "kyc_approved",
        "aml_clear", "late_payments",
    ]
    X = df[feature_cols].fillna(0).values.astype(float)
    y = df.apply(compute_label, axis=1).values

    model = train(X, y)
    out_path = os.path.join(MODEL_OUTPUT, "scoring_model.joblib")
    joblib.dump(model, out_path)
    logger.info("Scoring model saved to %s", out_path)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    main()
