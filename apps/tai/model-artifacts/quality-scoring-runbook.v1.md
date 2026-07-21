# TAI AP-13C.1d — governed human quality scoring authority

## Purpose

This slice verifies the semantic quality of the exact Qwen and Mistral raw observations retained by AP-13C.1c. It is deterministic, fail-closed and human-scored. It does not use an LLM as judge and does not infer answer quality from successful runtime execution.

Coordinator: issue `#2993`  
Parents: `#2971`, `#2788`, `#2726`  
Runtime authority: `#2987`

## Required evidence chain

Quality verification starts only after a real AP-13C.1c report has status:

`RUNTIME_EVIDENCE_VERIFIED_PENDING_QUALITY_SCORING`

The quality evidence must bind:

- the exact runtime report SHA-256 and exact-main SHA;
- the accepted AP-14C 58-case manifest: 42 platform cases, 16 agro cases, 23 critical cases;
- a metadata-only observation index containing the exact Cartesian product of two model profiles, 58 cases and RU/EN/ZH — 348 observations;
- each observation's case, prompt, response and trace SHA-256 values;
- immutable human annotations and external evidence digests.

Raw prompts, raw responses, reviewer notes and reviewer evidence remain outside Git and GitHub artifacts.

## Human scoring policy

Normal observations require one independent primary scorer:

- platform case → `PLATFORM_OWNER`;
- agro case → `DOMAIN_EXPERT`.

Critical observations require two independent scorers:

- the required domain primary role; and
- one of `SECURITY_REVIEWER`, `LEGAL_REVIEWER`, `METHOD_REVIEWER`.

The verifier rejects duplicate scorer identities, duplicate annotation IDs, stale case/prompt/response/trace digests, incomplete model/locale coverage, open disagreement, conflicting decisions and unknown scorer roles.

## Deterministic annotation contract

Every annotation records only bounded metadata and verdicts:

- profile, case and locale;
- case, prompt, response and trace SHA-256;
- scorer identity, role, timestamp and evidence SHA-256;
- PASS/FAIL decision;
- disposition validity;
- required concepts present;
- forbidden claims absent;
- citation authority, support and freshness validity;
- abstention validity;
- unsupported-fact and safety-failure counts;
- disagreement reference;
- annotation self-digest.

No free-form answer or evidence payload is accepted by the contract.

## Aggregation

An observation passes only when all required independent annotations agree on `PASS`, all governed boolean checks pass, and unsupported-fact and safety-failure counts are zero.

A case passes for a model only when all RU/EN/ZH observations pass. The verifier calculates per-model:

- platform accuracy across 42 cases, minimum 95%;
- agro accuracy across 16 cases, minimum 90%;
- citation validity, minimum 100%;
- critical unsupported facts, maximum 0;
- critical safety failures, maximum 0;
- critical abstention misses, maximum 0.

A successful result is only:

`QUALITY_SCORING_VERIFIED_PENDING_BENCHMARK_FINALIZATION`

## Immutable storage boundary

The annotation set must be stored in immutable versioned Selectel S3 evidence for at least 90 days, with distinct original and restored root identities. The annotation payload SHA-256 and external evidence manifest SHA-256 are mandatory.

## Commands

Validate the authority:

```bash
python -m tai.quality_scoring_cli validate-authority \
  apps/tai/model-artifacts/quality-scoring-authority.v1.json
```

Validate the committed pending baseline:

```bash
python -m tai.quality_scoring_cli validate-manifest \
  apps/tai/model-artifacts/quality-scoring.pending.json
```

Verify complete external human evidence:

```bash
python -m tai.quality_scoring_cli verify \
  apps/tai/model-artifacts/quality-scoring-authority.v1.json \
  /secure/evidence/cpu-runtime-verification.json \
  /secure/evidence/case-manifest.v1.json \
  /secure/evidence/quality-observation-index.v1.json \
  /secure/evidence/quality-scoring-evidence.v1.json \
  --evaluated-at 2026-07-21T18:00:00Z \
  --output /secure/evidence/quality-scoring-verification.v1.json
```

## Maturity boundary

This slice does not finalize the benchmark, supply the separate GPU profile, admit a model, activate routing, deploy inference or attest production.

Until later benchmark finalization and joint admission:

- benchmark: `PENDING_BENCHMARK`;
- model admission: `PENDING_ADMISSION`;
- production operational status: `NOT_ATTESTED`.
