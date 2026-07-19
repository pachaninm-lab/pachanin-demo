# TAI official knowledge sources

This directory contains small governed catalogs and evidence schemas. It does not contain copied government datasets and does not claim that a registered source has been successfully loaded.

## Current catalog

`official-sources.v1.json` registers verified entrypoints for:

- Ministry of Agriculture open data and grain traceability;
- Rosstat agricultural production and producer-price publications;
- Eurasian Economic Commission grain regulation and quality requirements;
- Russian Agricultural Center national phytosanitary and agronomy forecast;
- Ministry of Transport railway-tariff documents;
- Bank of Russia key-rate history.

The catalog contains six official sources and governed authority for all eight critical topics. Registration still does not count as coverage: the agronomy source, like every other source, must be successfully observed and pass freshness policy.

## Three different gates

1. **Catalog validation** proves only that owners, HTTPS entrypoints, hosts, formats, update intervals and topic requirements are structurally governed.
2. **Observation execution** uses the existing PostgreSQL loader lease authority, the pinned fail-closed HTTPS fetcher and source-specific metadata adapters. Loader completion, observation and run evidence are committed atomically under the lease token and version.
3. **Coverage assessment** requires actual source observations with a successful timestamp, latest publication timestamp, document count, observed topics and content digest.
4. **Source-health assessment** chains bounded refresh cycles, retains the latest rerun per run ID, calculates consecutive failures, refresh staleness, publication expiry and authority-review due dates, and emits deterministic dashboard and alert digests.

A URL in the catalog is not knowledge. A source counts toward coverage only when its observation is current, successful, topic-matched and non-duplicated.

## Observation execution semantics

- one due source is claimed through `tai_loader_state` with a fenced lease;
- every fetch is read-only and constrained by the source host policy;
- adapters extract metadata only: publication timestamp, document count and catalog-bounded topics;
- source HTML remains untrusted and never changes prompts, policies or tool permissions;
- a `304 Not Modified` response is accepted only when a durable baseline observation already exists;
- retryable or permanent failure never changes `last_success_at` to the failure time;
- when a baseline exists, a failure observation carries the unchanged last-success and a non-zero `consecutive_failures`, so coverage fails closed;
- a stale lease token cannot commit loader state, observation or run evidence;
- every accepted run has an immutable SHA-256 evidence record bound to its source, worker and lease token.

The adapters cover the metadata shapes for Bank of Russia, Rosstat, EEC, Ministry of Transport, Ministry of Agriculture/Open Data and the Russian Agricultural Center. CI uses deterministic fixtures and does not depend on live government endpoints.

The permanent exact-main workflow restores only versioned prior health artifacts, validates their digest chain, uploads current evidence before enforcing health, and has read-only repository/Actions permissions. A manual acceptance requires `6/6` observed sources and `8/8` covered topics; scheduled runs fail on critical source-health alerts while preserving the artifact.

## CLI

Validate the catalog without claiming coverage:

```bash
cd apps/tai
python -m tai.source_coverage_cli validate-catalog \
  knowledge-sources/official-sources.v1.json
```

Assess a real observation snapshot:

```bash
cd apps/tai
python -m tai.source_coverage_cli assess \
  knowledge-sources/official-sources.v1.json \
  /secure/evidence/source-observations.v1.json \
  --at 2026-07-19T12:00:00+00:00 \
  --output /secure/evidence/source-coverage-assessment.json
```

Exit codes:

- `0` — catalog valid, or every critical coverage topic is currently covered;
- `2` — invalid evidence, stale/unobserved/gap topic or any other fail-closed condition.

## Observation schema

```json
{
  "schema_version": "tai.source-observations.v1",
  "observations": [
    {
      "source_id": "official.rosstat.agriculture",
      "observed_at": "2026-07-19T10:00:00+00:00",
      "latest_publication_at": "2026-07-15T00:00:00+00:00",
      "last_success_at": "2026-07-19T10:00:00+00:00",
      "document_count": 3,
      "consecutive_failures": 0,
      "observed_topics": [
        "GRAIN_MARKET_PRICES",
        "AGRICULTURE_PRODUCTION"
      ],
      "content_sha256": "<lowercase SHA-256>"
    }
  ]
}
```

## Maturity boundary

This control plane does not prove complete Russian agricultural knowledge, live-source availability, semantic-search quality, expert validation or production acceptance. Those require controlled live observations, scheduled operational evidence, domain gold sets and exact-main acceptance. TAI remains `NOT_ATTESTED`.
