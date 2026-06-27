"""
Airflow DAG — Регуляторные отчёты (ТЗ 12.3)
Автоматическая генерация и отправка отчётов:
  - Минсельхоз: XML МСХ (ежемесячно, 5-го числа)
  - Росстат: Excel 29-сх (ежеквартально, 10-го числа)
  - ФНС: XML ОНФ (ежеквартально)
  - Росфинмониторинг: ФЭС 407 (при пороговых операциях — триггер отдельным DAG)
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timedelta

from airflow import DAG
from airflow.decorators import task
from airflow.models import Variable
from airflow.providers.http.hooks.http import HttpHook

logger = logging.getLogger(__name__)

GRAINFLOW_API_URL = Variable.get("GRAINFLOW_API_URL", default_var="http://grainflow-api/api")
GRAINFLOW_ADMIN_TOKEN = Variable.get("GRAINFLOW_ADMIN_TOKEN", default_var="")

default_args = {
    "owner": "compliance",
    "depends_on_past": False,
    "retries": 3,
    "retry_delay": timedelta(minutes=15),
    "email_on_failure": True,
    "email": ["compliance@grainflow.ru"],
}

# ── Минсельхоз (ежемесячно) ────────────────────────────────────────────────────

with DAG(
    dag_id="regulatory_minselhhoz_monthly",
    description="Ежемесячный отчёт Минсельхоз (XML МСХ)",
    default_args=default_args,
    schedule_interval="0 8 5 * *",  # 5-е число каждого месяца в 08:00
    start_date=datetime(2026, 1, 1),
    catchup=False,
    tags=["compliance", "regulatory", "minselhhoz"],
) as dag_msх:

    @task(task_id="generate_minselhhoz_report")
    def generate_minselhhoz_report(**context):
        import requests
        period = context["ds"][:7]  # YYYY-MM
        resp = requests.post(
            f"{GRAINFLOW_API_URL}/compliance/regulatory-reports/generate",
            headers={"Authorization": f"Bearer {GRAINFLOW_ADMIN_TOKEN}"},
            json={"reportType": "MINSELHHOZ_XML", "params": {"period": period}},
            timeout=120,
        )
        resp.raise_for_status()
        result = resp.json()
        logger.info("Минсельхоз отчёт сгенерирован: %s", result)
        return result

    @task(task_id="audit_minselhhoz_submission")
    def audit_submission(report_result: dict, **context):
        logger.info(
            "Отчёт Минсельхоз за %s готов к отправке: reportId=%s rowCount=%s",
            context["ds"][:7],
            report_result.get("reportId"),
            report_result.get("rowCount"),
        )
        # В prod: upload via sFTP / Минсельхоз API
        return {"status": "submitted", "reportId": report_result.get("reportId")}

    generate_minselhhoz_report() >> audit_submission(generate_minselhhoz_report())


# ── Росстат (ежеквартально) ────────────────────────────────────────────────────

with DAG(
    dag_id="regulatory_rosstat_quarterly",
    description="Ежеквартальный отчёт Росстат (Excel 29-сх)",
    default_args=default_args,
    schedule_interval="0 8 10 1,4,7,10 *",  # 10-е число первого месяца квартала
    start_date=datetime(2026, 1, 1),
    catchup=False,
    tags=["compliance", "regulatory", "rosstat"],
) as dag_rosstat:

    @task(task_id="generate_rosstat_29skh")
    def generate_rosstat(**context):
        import requests
        year = context["ds"][:4]
        month = int(context["ds"][5:7])
        quarter = (month - 1) // 3 + 1
        resp = requests.post(
            f"{GRAINFLOW_API_URL}/compliance/regulatory-reports/generate",
            headers={"Authorization": f"Bearer {GRAINFLOW_ADMIN_TOKEN}"},
            json={"reportType": "ROSSTAT_29SKH", "params": {"year": year, "quarter": quarter}},
            timeout=180,
        )
        resp.raise_for_status()
        result = resp.json()
        logger.info("Росстат 29-сх отчёт: %s", result)
        return result

    generate_rosstat()


# ── ФНС (ежеквартально) ────────────────────────────────────────────────────────

with DAG(
    dag_id="regulatory_fns_quarterly",
    description="Ежеквартальный отчёт ФНС (XML ОНФ)",
    default_args=default_args,
    schedule_interval="0 9 15 1,4,7,10 *",  # 15-е число первого месяца квартала
    start_date=datetime(2026, 1, 1),
    catchup=False,
    tags=["compliance", "regulatory", "fns"],
) as dag_fns:

    @task(task_id="generate_fns_onf")
    def generate_fns(**context):
        import requests
        year = context["ds"][:4]
        month = int(context["ds"][5:7])
        quarter = (month - 1) // 3 + 1
        resp = requests.post(
            f"{GRAINFLOW_API_URL}/compliance/regulatory-reports/generate",
            headers={"Authorization": f"Bearer {GRAINFLOW_ADMIN_TOKEN}"},
            json={"reportType": "FNS_ONF_XML", "params": {"year": year, "quarter": quarter}},
            timeout=180,
        )
        resp.raise_for_status()
        result = resp.json()
        logger.info("ФНС ОНФ отчёт: %s", result)
        return result

    generate_fns()


# ── Росфинмониторинг — событийный (триггер при пороге 600 000 ₽) ───────────────

with DAG(
    dag_id="regulatory_rosfinmonitoring_threshold",
    description="Росфинмониторинг ФЭС 407 — по событию (threshold > 600 000 руб)",
    default_args=default_args,
    schedule_interval=None,  # триггер: ExternalTaskSensor или webhook
    start_date=datetime(2026, 1, 1),
    catchup=False,
    tags=["compliance", "regulatory", "rosfinmonitoring", "aml"],
) as dag_rfm:

    @task(task_id="generate_fes_407")
    def generate_fes(**context):
        import requests
        params = context.get("dag_run") and context["dag_run"].conf or {}
        deal_id = params.get("dealId", "unknown")
        amount = params.get("amountKopecks", 0)

        logger.info("Генерация ФЭС 407 для сделки %s, сумма %s коп", deal_id, amount)
        resp = requests.post(
            f"{GRAINFLOW_API_URL}/compliance/regulatory-reports/generate",
            headers={"Authorization": f"Bearer {GRAINFLOW_ADMIN_TOKEN}"},
            json={
                "reportType": "ROSFINMONITORING_FES_407",
                "params": {"dealId": deal_id, "amountKopecks": amount},
            },
            timeout=60,
        )
        resp.raise_for_status()
        return resp.json()

    generate_fes()
