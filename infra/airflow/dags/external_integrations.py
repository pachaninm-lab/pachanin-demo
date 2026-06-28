"""Airflow DAGs для интеграций с внешними государственными системами."""

from __future__ import annotations

from datetime import datetime, timedelta

import requests
from airflow import DAG
from airflow.operators.python import PythonOperator
from airflow.operators.empty import EmptyOperator
from airflow.utils.dates import days_ago

default_args = {
    "owner": "integration-team",
    "depends_on_past": False,
    "retries": 3,
    "retry_delay": timedelta(minutes=30),
    "email_on_failure": True,
    "email": ["integration-alerts@grainflow.ru"],
}

# ──────────────────────────────────────────────────────────────────────────────
# DAG 1: Росстат — индексы цен, урожайность
# ──────────────────────────────────────────────────────────────────────────────
def fetch_rosstat_indices(**ctx):
    """Забираем индексы цен производителей зерна из API Росстата."""
    api_url = "https://rosstat.gov.ru/opendata/api/v1"
    datasets = ["price_producers_grain", "harvest_forecast"]
    results = []
    for ds in datasets:
        try:
            resp = requests.get(f"{api_url}/{ds}", timeout=60)
            resp.raise_for_status()
            results.append({"dataset": ds, "rows": len(resp.json().get("data", []))})
        except Exception as e:
            results.append({"dataset": ds, "error": str(e)})
    ctx["ti"].xcom_push(key="rosstat_results", value=results)
    return results


def load_rosstat_to_clickhouse(**ctx):
    results = ctx["ti"].xcom_pull(key="rosstat_results")
    from clickhouse_driver import Client
    client = Client("clickhouse", port=9000, database="grainflow")
    for r in (results or []):
        if "error" not in r:
            client.execute(
                "INSERT INTO external_indices (source, dataset, fetched_at, rows_count) VALUES",
                [["rosstat", r["dataset"], datetime.utcnow(), r["rows"]]],
            )


with DAG(
    dag_id="rosstat_price_indices",
    default_args=default_args,
    description="Ежедневный импорт ценовых индексов Росстата",
    schedule_interval="0 6 * * *",
    start_date=days_ago(1),
    catchup=False,
    tags=["external", "rosstat"],
) as rosstat_dag:
    fetch = PythonOperator(task_id="fetch_rosstat", python_callable=fetch_rosstat_indices)
    load = PythonOperator(task_id="load_to_clickhouse", python_callable=load_rosstat_to_clickhouse)
    fetch >> load


# ──────────────────────────────────────────────────────────────────────────────
# DAG 2: ФНС — проверка ИНН и статуса контрагента
# ──────────────────────────────────────────────────────────────────────────────
def sync_fns_status(**ctx):
    """Обновляем статус организаций через ФНС ЕГРЮЛ API."""
    import psycopg2
    conn = psycopg2.connect(
        host="postgres", database="grainflow", user="grainflow", password="grainflow"
    )
    cur = conn.cursor()
    cur.execute("""
        SELECT id, inn FROM organizations
        WHERE "kycStatus" != 'REJECTED'
          AND (fns_checked_at IS NULL OR fns_checked_at < NOW() - INTERVAL '7 days')
        LIMIT 500
    """)
    orgs = cur.fetchall()

    updated = 0
    for org_id, inn in orgs:
        if not inn:
            continue
        try:
            resp = requests.get(
                f"https://egrul.nalog.ru/search.json?query={inn}&region=&page=1",
                timeout=10,
            )
            if resp.status_code == 200:
                data = resp.json()
                is_active = any(r.get("inn") == inn for r in data.get("rows", []))
                cur.execute(
                    "UPDATE organizations SET fns_checked_at = NOW(), fns_active = %s WHERE id = %s",
                    (is_active, org_id),
                )
                updated += 1
        except Exception:
            pass

    conn.commit()
    conn.close()
    return {"checked": len(orgs), "updated": updated}


with DAG(
    dag_id="fns_inn_verification",
    default_args=default_args,
    description="Еженедельная проверка ИНН организаций через ФНС ЕГРЮЛ",
    schedule_interval="0 3 * * 0",
    start_date=days_ago(1),
    catchup=False,
    tags=["external", "fns", "kyc"],
) as fns_dag:
    PythonOperator(task_id="sync_fns_status", python_callable=sync_fns_status)


# ──────────────────────────────────────────────────────────────────────────────
# DAG 3: Росфинмониторинг — санкционные списки
# ──────────────────────────────────────────────────────────────────────────────
def sync_sanctions_list(**ctx):
    """Синхронизация санкционных списков Росфинмониторинга."""
    sanctions_urls = [
        "https://www.fedsfm.ru/documents/terrorists-catalog-portal-act",
    ]
    import psycopg2
    conn = psycopg2.connect(
        host="postgres", database="grainflow", user="grainflow", password="grainflow"
    )
    cur = conn.cursor()

    for url in sanctions_urls:
        try:
            resp = requests.get(url, timeout=120)
            resp.raise_for_status()
            # В продакшне — парсинг XML из Росфинмониторинга
            # Здесь — заглушка, реальная логика добавляется при интеграции
            cur.execute("""
                INSERT INTO external_sync_log (source, status, synced_at, detail)
                VALUES ('rosfinmonitoring', 'ok', NOW(), %s)
            """, (f"fetched {len(resp.content)} bytes",))
        except Exception as e:
            cur.execute("""
                INSERT INTO external_sync_log (source, status, synced_at, detail)
                VALUES ('rosfinmonitoring', 'error', NOW(), %s)
            """, (str(e)[:500],))

    # Обновляем sanction_hit для совпадений
    cur.execute("""
        UPDATE organizations SET "sanctionHit" = TRUE
        WHERE inn IN (SELECT inn FROM sanctions_list WHERE active = TRUE)
          AND "sanctionHit" = FALSE
    """)
    conn.commit()
    conn.close()


with DAG(
    dag_id="sanctions_list_sync",
    default_args=default_args,
    description="Ежедневная синхронизация санкционных списков Росфинмониторинга",
    schedule_interval="0 1 * * *",
    start_date=days_ago(1),
    catchup=False,
    tags=["external", "aml", "sanctions"],
) as sanctions_dag:
    PythonOperator(task_id="sync_sanctions", python_callable=sync_sanctions_list)


# ──────────────────────────────────────────────────────────────────────────────
# DAG 4: Минсельхоз — квоты и субсидии
# ──────────────────────────────────────────────────────────────────────────────
def fetch_minselhoz_quotas(**ctx):
    """Импорт квот на экспорт зерна из API Минсельхоза."""
    try:
        resp = requests.get(
            "https://mcx.gov.ru/api/export-quotas?year=2024",
            timeout=60,
        )
        if resp.status_code == 200:
            data = resp.json()
            ctx["ti"].xcom_push(key="quotas", value=data)
            return {"status": "ok", "records": len(data.get("quotas", []))}
    except Exception as e:
        return {"status": "error", "error": str(e)}


with DAG(
    dag_id="minselhoz_export_quotas",
    default_args=default_args,
    description="Еженедельный импорт экспортных квот Минсельхоза",
    schedule_interval="0 8 * * 1",
    start_date=days_ago(1),
    catchup=False,
    tags=["external", "minselhoz"],
) as minselhoz_dag:
    PythonOperator(task_id="fetch_quotas", python_callable=fetch_minselhoz_quotas)
