# TAI AP-13C.1c immutable raw CPU runtime evidence

## Purpose

This slice defines and verifies external runtime evidence for the real Qwen3-8B CPU `Q4_K_M` profile and the Mistral-7B-Instruct-v0.3 CPU fallback profile. It does not execute a benchmark from GitHub, score semantic answer quality, admit a model, activate a runtime or attest production.

Coordinator: issue `#2987`  
Parent: `#2971`  
Prerequisite authority: `#2977`

## Current boundary

The exact-main prerequisite report is currently `BLOCKED` because all of the following are still absent:

- accepted immutable Qwen and Mistral bundles in Selectel S3;
- accepted external evidence storage;
- accepted expert review for all 58 AP-14C cases.

Therefore the committed manifest remains `PENDING_RUNTIME_EXECUTION`. No inference or model-host operation is claimed.

## Runtime evidence is not quality evidence

A runtime result may verify only measured facts such as:

- exact restored bundle and llama.cpp identities;
- dedicated `tai-model` host identity and loopback-only inference;
- concurrency `1`, `2`, `4`;
- prompt and generation throughput;
- p95/p99 latency and error rate;
- peak RAM, cold start and warmup;
- operating-cost inputs in RUB;
- one-hour / 1,000-request soak;
- 100 forced primary-to-fallback transitions;
- complete raw response capture.

It must not convert response text into platform accuracy, agro accuracy, citation validity or unsupported-fact claims. Those are handled by the later governed quality-scoring slice.

## Required AP-14C coverage

Each runtime profile must execute every accepted case in every required locale:

- 58 cases;
- locales `ru`, `en`, `zh`;
- 174 observations per profile;
- 348 observations total across Qwen and Mistral.

The verifier requires the exact Cartesian product of profile, case and locale. Missing, duplicate, failed or altered observations are rejected.

## External evidence layout

The original and independently restored evidence roots must contain exactly the declared files, including:

- `suite/case-manifest.json`;
- `raw-observations/manifest.json`;
- one raw JSONL file for each model profile;
- one runtime metrics file for each model profile;
- `toolchain/manifest.json`;
- `fallback/metrics.json`;
- `soak/metrics.json`;
- `storage/manifest.json`.

Raw prompts, responses and logs remain only in immutable external storage. They must never enter Git, GitHub Actions artifacts or PR comments.

The verifier rejects path traversal, absolute paths, backslashes, symlinks, non-regular files, undeclared files, duplicate paths, forbidden model/archive suffixes, digest mismatch, size mismatch, identical restore roots and hard-linked original/restored files.

## CLI

Validate the committed authority:

```bash
python -m tai.cpu_runtime_evidence_cli validate-authority \
  apps/tai/model-artifacts/cpu-runtime-evidence-authority.v1.json
```

Validate a pending or complete manifest:

```bash
python -m tai.cpu_runtime_evidence_cli validate-manifest \
  apps/tai/model-artifacts/cpu-runtime-evidence.pending.json
```

Independently verify a completed external evidence set:

```bash
python -m tai.cpu_runtime_evidence_cli verify-evidence \
  apps/tai/model-artifacts/cpu-runtime-evidence-authority.v1.json \
  /path/to/cpu-runtime-evidence.complete.json \
  /path/to/original-evidence-root \
  /path/to/independent-restored-root \
  --evaluated-at 2026-07-21T16:00:00+00:00
```

A successful verification returns `RUNTIME_EVIDENCE_VERIFIED_PENDING_QUALITY_SCORING`. This is not benchmark admission.

## Maturity boundary

Until runtime evidence and the separate quality-scoring evidence both pass:

- runtime verification: `PENDING_RUNTIME_EXECUTION` or `RUNTIME_EVIDENCE_VERIFIED_PENDING_QUALITY_SCORING`;
- quality scoring: `PENDING_QUALITY_SCORING`;
- benchmark: `PENDING_BENCHMARK`;
- model admission: `PENDING_ADMISSION`;
- production operational status: `NOT_ATTESTED`.

## Next governed slice

AP-13C.1d must score the immutable raw observations against the accepted AP-14C authority using deterministic checks and governed human review. It must not use an unbounded LLM-as-judge or infer accuracy from runtime metrics.
