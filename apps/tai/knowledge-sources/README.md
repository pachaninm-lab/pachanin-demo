# TAI official knowledge sources

This directory contains small governed catalogs and evidence schemas. It does not contain copied government datasets and does not claim that a registered source has been successfully loaded.

## Current catalog

`official-sources.v1.json` registers verified entrypoints for:

- Ministry of Agriculture open data and grain traceability;
- Rosstat agricultural production and producer-price publications;
- Eurasian Economic Commission grain regulation and quality requirements;
- Ministry of Transport railway-tariff documents;
- Bank of Russia key-rate history.

The agronomy-recommendation topic intentionally has no registered source yet. The coverage authority must report this as `GAP` even when every other source is healthy.

## Two different gates

1. **Catalog validation** proves only that owners, HTTPS entrypoints, hosts, formats, update intervals and topic requirements are structurally governed.
2. **Coverage assessment** requires actual source observations with a successful timestamp, latest publication timestamp, document count, observed topics and content digest.

A URL in the catalog is not knowledge. A source counts toward coverage only when its observation is current, successful, topic-matched and non-duplicated.

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

This catalog does not prove complete Russian agricultural knowledge, semantic-search quality, expert validation or production acceptance. Those require scheduled loaders, durable observations, domain gold sets and exact-main operational evidence. TAI remains `NOT_ATTESTED`.
