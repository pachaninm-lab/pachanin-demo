-- GrainFlow ClickHouse Data Warehouse Schema (ТЗ 12.1)
-- Sub-second аналитика: GMV, unit economics, price dynamics, fraud scores

-- ─── Факт: сделки ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS deals_fact ON CLUSTER grainflow_cluster
(
    deal_id             UUID,
    deal_number         String,
    created_date        Date,
    closed_date         Nullable(Date),
    seller_org_id       UUID,
    buyer_org_id        UUID,
    seller_region       LowCardinality(String),
    buyer_region        LowCardinality(String),
    crop_type           LowCardinality(String),
    crop_class          UInt8,
    volume_tons         Float32,
    price_per_ton_kopecks UInt64,
    total_amount_kopecks  UInt64,
    commission_kopecks    UInt64,
    deal_status         LowCardinality(String),
    time_to_close_hours Nullable(Float32),
    has_dispute         UInt8,          -- 0/1
    dispute_resolved    UInt8,
    quality_passed      UInt8,
    etn_issued          UInt8,
    edo_sent            UInt8,
    platform_version    LowCardinality(String) DEFAULT '3.0'
)
ENGINE = ReplicatedMergeTree('/clickhouse/tables/{shard}/deals_fact', '{replica}')
PARTITION BY toYYYYMM(created_date)
ORDER BY (seller_region, crop_type, created_date, deal_id)
SETTINGS index_granularity = 8192;

-- ─── Материализованное представление: GMV по дням ─────────────────────────────
CREATE MATERIALIZED VIEW IF NOT EXISTS gmv_by_day ON CLUSTER grainflow_cluster
ENGINE = ReplicatedSummingMergeTree('/clickhouse/tables/{shard}/gmv_by_day', '{replica}')
ORDER BY (date, crop_type, seller_region)
AS SELECT
    toDate(created_date)          AS date,
    crop_type,
    seller_region,
    sum(total_amount_kopecks)     AS gmv_kopecks,
    sum(commission_kopecks)       AS commission_kopecks,
    count()                       AS deals_count,
    sum(volume_tons)              AS volume_tons,
    countIf(has_dispute = 1)      AS disputes_count,
    countIf(deal_status = 'CLOSED') AS closed_count
FROM deals_fact
GROUP BY date, crop_type, seller_region;

-- ─── Факт: цены (для предиктивной аналитики) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS price_fact ON CLUSTER grainflow_cluster
(
    recorded_at     DateTime,
    crop_type       LowCardinality(String),
    crop_class      UInt8,
    region          LowCardinality(String),
    price_per_ton_kopecks UInt64,
    volume_tons     Float32,
    deal_id         Nullable(UUID),
    source          LowCardinality(String)  -- 'deal' | 'lot' | 'external_feed'
)
ENGINE = ReplicatedMergeTree('/clickhouse/tables/{shard}/price_fact', '{replica}')
PARTITION BY toYYYYMM(recorded_at)
ORDER BY (crop_type, region, recorded_at)
SETTINGS index_granularity = 8192;

-- ─── Скользящие средние цен (7 / 30 / 90 дней) ─────────────────────────────
CREATE VIEW IF NOT EXISTS price_moving_avg AS
SELECT
    toDate(recorded_at)     AS date,
    crop_type,
    region,
    avg(price_per_ton_kopecks) OVER (
        PARTITION BY crop_type, region
        ORDER BY toDate(recorded_at)
        ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
    ) AS avg_7d_kopecks,
    avg(price_per_ton_kopecks) OVER (
        PARTITION BY crop_type, region
        ORDER BY toDate(recorded_at)
        ROWS BETWEEN 29 PRECEDING AND CURRENT ROW
    ) AS avg_30d_kopecks,
    avg(price_per_ton_kopecks) OVER (
        PARTITION BY crop_type, region
        ORDER BY toDate(recorded_at)
        ROWS BETWEEN 89 PRECEDING AND CURRENT ROW
    ) AS avg_90d_kopecks,
    count() AS deals_in_period
FROM price_fact
GROUP BY date, crop_type, region
ORDER BY date DESC;

-- ─── Факт: организации (скоринг, KYC, активность) ───────────────────────────
CREATE TABLE IF NOT EXISTS org_metrics ON CLUSTER grainflow_cluster
(
    org_id              UUID,
    period_month        Date,
    role                LowCardinality(String),
    region              LowCardinality(String),
    deals_as_seller     UInt32,
    deals_as_buyer      UInt32,
    gmv_as_seller_kopecks UInt64,
    gmv_as_buyer_kopecks  UInt64,
    disputes_initiated  UInt16,
    disputes_won        UInt16,
    avg_deal_time_hours Float32,
    fraud_flags         UInt16,
    kyc_status          LowCardinality(String),
    counterparty_score  Float32       -- 0.0 – 100.0
)
ENGINE = ReplicatedReplacingMergeTree('/clickhouse/tables/{shard}/org_metrics', '{replica}', period_month)
PARTITION BY toYear(period_month)
ORDER BY (org_id, period_month)
SETTINGS index_granularity = 8192;

-- ─── GPS события (логистика, IoT) ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS gps_events ON CLUSTER grainflow_cluster
(
    vehicle_id      String,
    shipment_id     Nullable(String),
    deal_id         Nullable(UUID),
    recorded_at     DateTime64(3),
    lat             Float64,
    lon             Float64,
    speed_kmh       Nullable(Float32),
    heading_deg     Nullable(Float32),
    geofence_event  Nullable(LowCardinality(String)),  -- 'ENTER' | 'EXIT'
    geofence_kind   Nullable(LowCardinality(String)),  -- 'LOADING' | 'UNLOADING' | ...
    alert_type      Nullable(LowCardinality(String))   -- 'LATE_ARRIVAL' | 'IDLE_TOO_LONG' | ...
)
ENGINE = ReplicatedMergeTree('/clickhouse/tables/{shard}/gps_events', '{replica}')
PARTITION BY toDate(recorded_at)
ORDER BY (vehicle_id, recorded_at)
TTL toDate(recorded_at) + INTERVAL 1 YEAR
SETTINGS index_granularity = 8192;

-- ─── Аудит-события (агрегат для аналитики, не замена PostgreSQL) ─────────────
CREATE TABLE IF NOT EXISTS audit_summary ON CLUSTER grainflow_cluster
(
    event_date  Date,
    action      LowCardinality(String),
    actor_role  LowCardinality(String),
    entity_type LowCardinality(String),
    outcome     LowCardinality(String),
    count       UInt64
)
ENGINE = ReplicatedSummingMergeTree('/clickhouse/tables/{shard}/audit_summary', '{replica}')
ORDER BY (event_date, action, actor_role, entity_type, outcome)
PARTITION BY toYYYYMM(event_date)
SETTINGS index_granularity = 8192;

-- ─── Unit Economics (агрегат по месяцам для дашборда) ────────────────────────
CREATE MATERIALIZED VIEW IF NOT EXISTS unit_economics_monthly ON CLUSTER grainflow_cluster
ENGINE = ReplicatedAggregatingMergeTree('/clickhouse/tables/{shard}/unit_economics_monthly', '{replica}')
ORDER BY (period_month)
AS SELECT
    toStartOfMonth(created_date)            AS period_month,
    sumState(total_amount_kopecks)          AS gmv_state,
    sumState(commission_kopecks)            AS revenue_state,
    countState()                            AS deals_state,
    countIfState(deal_status = 'CLOSED')    AS closed_deals_state,
    countIfState(has_dispute = 1)           AS dispute_deals_state,
    avgState(time_to_close_hours)           AS avg_close_time_state
FROM deals_fact
GROUP BY period_month;

-- ─── Запрос для дашборда unit economics (пример) ─────────────────────────────
-- SELECT
--     period_month,
--     sumMerge(gmv_state)            AS gmv_kopecks,
--     sumMerge(revenue_state)        AS revenue_kopecks,
--     countMerge(deals_state)        AS total_deals,
--     countMerge(closed_deals_state) AS closed_deals,
--     sumMerge(revenue_state) / nullIf(sumMerge(gmv_state), 0) AS take_rate,
--     avgMerge(avg_close_time_state) AS avg_close_hours
-- FROM unit_economics_monthly
-- GROUP BY period_month
-- ORDER BY period_month;
