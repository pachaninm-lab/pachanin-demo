# TAI Agro OS v4.0 — exact-main implementation audit

**Audit baseline:** `aee6f0d32300a33983fd71b6a09ddf497d9394fd`  
**Repository:** `pachaninm-lab/pachanin-demo`  
**Audit date:** 2026-07-31  
**Evidence boundary:** repository state only. Merge history, documentation or isolated tests are not treated as REG.RU live acceptance.

## Executive verdict

TAI already has a substantial governed architectural core, a read-only public interface and a local-model contour. TAI Agro OS Master Specification v4.0 is **not implemented as a complete product**. The exact-main repository itself records the remaining gaps: measured official-source coverage, semantic/hybrid retrieval, document and vision processing, complete product intelligence, distributed operational acceptance, HA/DR, load/fault/soak evidence and full domain gold sets.

The correct starting point is not a rewrite. The correct starting point is to preserve the current server-authoritative, tenant-isolated and read-only safety boundary, then add a canonical v4 domain ontology, deterministic calculators, measurable domain coverage and staged acceptance evidence.

## Evidence already present in exact-main

- FastAPI foundation and versioned contracts.
- Server-authoritative identity and deny-by-default policy.
- Governed knowledge ingestion, recovery and PostgreSQL loader authority.
- Generation-fenced lexical retrieval.
- Grounded RAG with citations and abstention.
- Local model registry/router and protected private-network transport.
- Bounded agent/tool runtime and deterministic evaluation authority.
- Exact-main application release attestation mechanisms.
- Read-only Platform Safe Tool bridge with ten read-only tools.
- Public assistant UI with streaming transport contracts and mobile acceptance work.
- Explicit prohibition of autonomous platform writes in the current release.

Primary repository evidence:

- `apps/tai/README.md`
- `apps/tai/ROADMAP.md`
- `apps/tai/tai/gateway_acceptance.py`
- `apps/tai/governance/gateway-exact-main-acceptance.v1.json`
- `apps/web/components/platform-v7/PublicPlatformAssistant.tsx`

## Stage matrix

| Stage | Status at audited main | Accepted evidence | Missing before v4 acceptance |
|---|---|---|---|
| 1. TAI Always-On Core | PARTIAL | Streaming contracts, local model routing, bounded public runtime, release mechanisms | Distributed queue/backpressure, model draining, warm-up authority, HA/DR, load/fault/restore/backlog/soak and exact operational attestation |
| 2. Unified Agro Knowledge Core | PARTIAL | Governed ingestion, lexical retrieval, grounded RAG, source governance foundation | Full v4 ontology, measured source coverage/freshness, embeddings, hybrid retrieval, reranker and domain gold sets |
| 3. TAI Crop | NOT_ACCEPTED | General public agro-answer contour only; this is not product evidence | Field/season/crop models, technology maps, resources, deterministic crop calculators, economics, mobile field workflows and E2E acceptance |
| 4. TAI Livestock | NOT_ACCEPTED | No accepted livestock operating contour found | Animal/herd registry, feeding, reproduction, productivity, health boundaries, microclimate, biosecurity, calculators and E2E acceptance |
| 5. TAI Machinery | NOT_ACCEPTED | No accepted machinery intelligence contour found | Canonical machine identity, manuals, serial ranges, maintenance, fault codes, parts compatibility, telemetry, TCO calculators and safety tests |
| 6. TAI Expert | NOT_ACCEPTED | Knowledge ingestion exists | PDF/scans/tables/certificates pipeline, quarantine, page/table/row/cell provenance, document injection defence and acceptance |
| 7. TAI Trade | PARTIAL | Ten read-only platform tools for Deal status, risks, documents, logistics, laboratory, money readiness, disputes and evidence | Full v4 product packaging and domain evaluation; write tools remain intentionally absent |
| 8. TAI Enterprise and Connect | PARTIAL / UNVERIFIED | Versioned platform bridge and integration-oriented repository components exist | Accepted 1C/ERP/EDI/TMS/WMS/LIMS connectors, per-integration technical acceptance, SDK/OEM/white-label commercial boundaries |
| 9. Event agents | NOT_ACCEPTED | No complete cross-domain event-monitoring acceptance found | Event schemas, thresholds, provenance, notification policy, prepared action boundary and replay/idempotency tests |
| 10. Commercial contour | NOT_ACCEPTED | Organization and role infrastructure belongs primarily to the main platform | TAI product plans, quotas, API keys, usage reporting, white-label controls, sales materials and manual billing process |

## Cross-cutting constraints retained

1. TAI remains informational/read-only until a separate owner decision and new acceptance authorizes writes.
2. No model, agent or calculator may select tenant or role from client input.
3. Critical calculations must be deterministic, versioned and input-auditable.
4. Agronomic, veterinary and machinery safety recommendations must fail closed when required source data is absent.
5. Integration status is not “connected” until separate technical acceptance exists.
6. Merge is not deployment evidence; REG.RU exact-main live acceptance remains a separate gate.

## First implementation slice started by this branch

This branch establishes the smallest safe v4 foundation:

- exact-main implementation audit and machine-readable stage matrix;
- canonical immutable ontology registry for 90 required entities across crop, livestock, machinery and agribusiness;
- first deterministic Decimal-based calculators for seed requirement, field capacity, average daily gain, feed conversion and machine-hour cost;
- fail-closed validation and focused tests.

The owner-approved full specification is issued as the companion document `TAI Agro OS Master Specification v4.0`. This slice does **not** claim full TAI Crop, Livestock, Machinery, Expert, Enterprise or production readiness.
