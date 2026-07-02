"""Airflow DAG: ETL PostgreSQL → ClickHouse для аналитики."""

from __future__ import annotations

from datetime import datetime, timedelta

from airflow import DAG
from airflow.operators.python import PythonOperator
from airflow.utils.dates import days_ago

default_args = {
    "owner": "analytics-team",
    "retries": 2,
    "retry_delay": timedelta(minutes=15),
    "email_on_failure": True,
    "email": ["analytics@grainflow.ru"],
}

CH_HOST = "clickhouse"
CH_PORT = 9000
CH_DB = "grainflow"
PG_DSN = "host=postgres dbname=grainflow user=grainflow password=grainflow"


def etl_deals_to_clickhouse(**ctx):
    """Переносим завершённые сделки за последние сутки в ClickHouse."""
    import psycopg2
    from clickhouse_driver import Client

    since = ctx["data_interval_start"].isoformat()

    pg = psycopg2.connect(PG_DSN)
    cur = pg.cursor()
    cur.execute("""
        SELECT
            d.id,
            d."createdAt",
            d."sellerOrgId",
            d."buyerOrgId",
            d.region,
            d."cropType",
            d."cropClass",
            d."volumeTons",
            d."priceKopecks",
            d."totalKopecks",
            d.status
        FROM deals d
        WHERE d."updatedAt" >= %s
          AND d.status IN ('COMPLETED', 'CANCELLED', 'DISPUTE')
    """, (since,))
    rows = cur.fetchall()
    pg.close()

    if not rows:
        return {"inserted": 0}

    ch = Client(CH_HOST, port=CH_PORT, database=CH_DB)
    ch.execute("""
        INSERT INTO deals_fact (
            deal_id, created_at, seller_org_id, buyer_org_id,
            region, crop_type, crop_class,
            volume_tons, price_kopecks, total_kopecks, status
        ) VALUES
    """, [
        (r[0], r[1], r[2], r[3], r[4], r[5], r[6],
         float(r[7]), int(r[8] or 0), int(r[9] or 0), r[10])
        for r in rows
    ])
    return {"inserted": len(rows)}


def etl_payments_to_clickhouse(**ctx):
    """ETL проводок из ledger_entries в ClickHouse для финансовой аналитики."""
    import psycopg2
    from clickhouse_driver import Client

    since = ctx["data_interval_start"].isoformat()

    pg = psycopg2.connect(PG_DSN)
    cur = pg.cursor()
    cur.execute("""
        SELECT
            id, "dealId", "debitAccount", "creditAccount",
            "amountKopecks", currency, "entryType", "createdAt"
        FROM ledger_entries
        WHERE "createdAt" >= %s
    """, (since,))
    rows = cur.fetchall()
    pg.close()

    if not rows:
        return {"inserted": 0}

    ch = Client(CH_HOST, port=CH_PORT, database=CH_DB)
    ch.execute("""
        INSERT INTO ledger_fact (
            entry_id, deal_id, debit_account, credit_account,
            amount_kopecks, currency, entry_type, created_at
        ) VALUES
    """, [
        (r[0], r[1] or "", r[2], r[3], int(r[4]), r[5], r[6], r[7])
        for r in rows
    ])
    return {"inserted": len(rows)}


def refresh_materialized_views(**ctx):
    """Обновляем материализованные представления GMV и активности."""
    from clickhouse_driver import Client
    ch = Client(CH_HOST, port=CH_PORT, database=CH_DB)
    ch.execute("OPTIMIZE TABLE gmv_by_region_day FINAL")
    ch.execute("OPTIMIZE TABLE gmv_by_crop_day FINAL")
    return {"status": "refreshed"}


with DAG(
    dag_id="pg_to_clickhouse_etl",
    default_args=default_args,
    description="Ежечасный ETL сделок и проводок из PostgreSQL в ClickHouse",
    schedule_interval="@hourly",
    start_date=days_ago(1),
    catchup=False,
    tags=["etl", "clickhouse", "analytics"],
) as dag:
    load_deals = PythonOperator(
        task_id="etl_deals",
        python_callable=etl_deals_to_clickhouse,
    )
    load_payments = PythonOperator(
        task_id="etl_payments",
        python_callable=etl_payments_to_clickhouse,
    )
    refresh = PythonOperator(
        task_id="refresh_materialized_views",
        python_callable=refresh_materialized_views,
    )
    [load_deals, load_payments] >> refresh
