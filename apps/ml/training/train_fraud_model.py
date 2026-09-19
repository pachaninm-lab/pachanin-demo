"""Train fraud detection model from labeled audit events."""

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
            ae."userId",
            ae."organizationId",
            ae."eventType" AS action,
            (ae.metadata->>'amountKopecks')::bigint AS amount_kopecks,
            (ae.metadata->>'actionsLastHour')::int AS actions_last_hour,
            (ae.metadata->>'newCounterparty')::boolean AS new_counterparty,
            (ae.metadata->>'offHours')::boolean AS off_hours,
            (ae.metadata->>'amountDeviationPct')::float AS amount_deviation_pct,
            (ae.metadata->>'documentMismatch')::boolean AS document_mismatch,
            (ae.metadata->>'roleAbuseSignal')::boolean AS role_abuse_signal,
            (ae.metadata->>'vpnDetected')::boolean AS vpn_detected,
            (ae.metadata->>'previouslyFlagged')::boolean AS previously_flagged,
            CASE WHEN (ae.metadata->>'isFraud')::boolean THEN 1 ELSE 0 END AS label
        FROM audit_events ae
        WHERE ae.metadata ? 'isFraud'
          AND ae."createdAt" > NOW() - INTERVAL '180 days'
        LIMIT 200000
    """
    return pd.read_sql(query, conn)


def featurize(df: pd.DataFrame) -> np.ndarray:
    return np.column_stack([
        df["actions_last_hour"].fillna(0).astype(float),
        df["new_counterparty"].fillna(False).astype(int),
        df["off_hours"].fillna(False).astype(int),
        df["amount_deviation_pct"].fillna(0).astype(float),
        df["document_mismatch"].fillna(False).astype(int),
        df["role_abuse_signal"].fillna(False).astype(int),
        df["vpn_detected"].fillna(False).astype(int),
        df["previously_flagged"].fillna(False).astype(int),
        (df["amount_kopecks"].fillna(0).astype(float) / 1_000_000),
    ])


def train(X: np.ndarray, y: np.ndarray):
    from lightgbm import LGBMClassifier
    fraud_ratio = (y == 0).sum() / max(1, (y == 1).sum())
    model = LGBMClassifier(
        n_estimators=500,
        learning_rate=0.05,
        max_depth=6,
        scale_pos_weight=fraud_ratio,
        random_state=42,
        verbose=-1,
        is_unbalance=True,
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

    if len(df) < 100:
        logger.warning("Not enough labeled events (%d), skipping fraud model training", len(df))
        return

    fraud_count = df["label"].sum()
    logger.info("Loaded %d events (%d fraud, %d legit)", len(df), fraud_count, len(df) - fraud_count)

    X = featurize(df)
    y = df["label"].values

    model = train(X, y)
    out_path = os.path.join(MODEL_OUTPUT, "fraud_detector.joblib")
    joblib.dump(model, out_path)
    logger.info("Fraud detector saved to %s", out_path)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    main()
