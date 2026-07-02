"""Airflow DAG: еженедельное переобучение ML моделей GrainFlow."""

from __future__ import annotations

from datetime import datetime, timedelta

from airflow import DAG
from airflow.operators.python import PythonOperator
from airflow.operators.bash import BashOperator
from airflow.utils.dates import days_ago

default_args = {
    "owner": "ml-team",
    "depends_on_past": False,
    "retries": 2,
    "retry_delay": timedelta(minutes=10),
    "email_on_failure": True,
    "email": ["ml-alerts@grainflow.ru"],
}

with DAG(
    dag_id="ml_weekly_retraining",
    default_args=default_args,
    description="Еженедельное переобучение Price, Scoring и Fraud моделей",
    schedule_interval="0 2 * * 1",  # каждый понедельник в 02:00
    start_date=days_ago(1),
    catchup=False,
    tags=["ml", "retraining"],
) as dag:

    train_price = BashOperator(
        task_id="train_price_model",
        bash_command=(
            "cd /opt/ml && "
            "python training/train_price_model.py && "
            "echo 'Price model trained OK'"
        ),
        env={
            "DATABASE_URL": "{{ var.value.get('DATABASE_URL') }}",
            "MODEL_PATH": "/opt/ml/models",
        },
    )

    train_scoring = BashOperator(
        task_id="train_scoring_model",
        bash_command=(
            "cd /opt/ml && "
            "python training/train_scoring_model.py && "
            "echo 'Scoring model trained OK'"
        ),
        env={
            "DATABASE_URL": "{{ var.value.get('DATABASE_URL') }}",
            "MODEL_PATH": "/opt/ml/models",
        },
    )

    train_fraud = BashOperator(
        task_id="train_fraud_model",
        bash_command=(
            "cd /opt/ml && "
            "python training/train_fraud_model.py && "
            "echo 'Fraud model trained OK'"
        ),
        env={
            "DATABASE_URL": "{{ var.value.get('DATABASE_URL') }}",
            "MODEL_PATH": "/opt/ml/models",
        },
    )

    reload_models = BashOperator(
        task_id="reload_ml_service",
        bash_command=(
            "curl -s -X POST http://ml-service:8001/api/ml/reload || "
            "echo 'Hot-reload not supported, restart required'"
        ),
    )

    [train_price, train_scoring, train_fraud] >> reload_models
