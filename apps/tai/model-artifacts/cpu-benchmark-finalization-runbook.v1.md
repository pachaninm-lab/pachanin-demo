# TAI AP-13C.1e — governed CPU/fallback benchmark finalization

## Purpose

This slice joins the accepted AP-13C.1c runtime contour and AP-13C.1d human quality contour without pretending that the primary Qwen benchmark is complete. The joint AP-13C/AP-13D authority still requires the Qwen `GPU_SHARED` `Q8_0` profile.

Coordinator: issue `#2998`  
Parents: `#2971`, `#2862`, `#2726`  
Runtime authority: `#2987`  
Quality authority: `#2993`

## Honest output boundary

A successful AP-13C.1e result means only:

- Qwen CPU `Q4_K_M` runtime and quality evidence have been reproduced;
- the primary Qwen benchmark remains `PENDING_BENCHMARK` because `qwen3-8b-gpu-shared-q8-0` is absent;
- a real Mistral fallback `tai.model-benchmark-evidence.v2` candidate has passed the existing joint v2 verifier;
- joint benchmark and model admission remain pending.

Success status:

`CPU_FALLBACK_BENCHMARK_FINALIZATION_VERIFIED_PENDING_GPU`

This status is not model admission and not production attestation.

## Required evidence chain

The verifier independently performs all of the following:

1. reproduces the AP-13C.1c runtime report from the governed runtime authority, runtime manifest and independent original/restored evidence roots;
2. requires the supplied runtime report to equal the reproduced report exactly;
3. reproduces AP-13C.1d quality scoring from the governed quality authority, accepted AP-14C assessment, exact case manifest and immutable human scoring manifest;
4. requires the supplied quality report to equal the reproduced report exactly;
5. runs the existing `tai.model-benchmark-admission-authority.v2` verifier against the Mistral fallback candidate and its independent evidence roots;
6. cross-checks the Mistral candidate's CPU metrics, concurrency matrix, artifact digest and quality aggregates against the reproduced AP-13C evidence;
7. records the missing Qwen GPU profile as a mandatory blocker rather than relabeling CPU evidence.

## Mistral fallback candidate

The fallback candidate must use the canonical schema:

`tai.model-benchmark-evidence.v2`

It must contain:

- exact Mistral model/revision and role `FALLBACK`;
- exact immutable bundle binding and CPU `Q4_K_M` artifact digest;
- AP-14C evaluation suite identity;
- quality values derived from the reproduced Mistral human scoring aggregate;
- CPU runtime metrics and concurrency `1/2/4` derived from AP-13C.1c;
- a real fallback-model soak package accepted by the canonical benchmark verifier;
- immutable original/restored benchmark evidence.

The candidate cannot contain another fallback exercise because it is itself the fallback model.

## Qwen primary boundary

The finalization manifest records:

- verified CPU profile: `qwen3-8b-cpu-q4-k-m`;
- required missing profile: `qwen3-8b-gpu-shared-q8-0`;
- status: `CPU_EVIDENCE_VERIFIED_PENDING_GPU_SHARED_Q8_0`.

No AP-13C.1e code path can emit a COMPLETE Qwen benchmark candidate. The later GPU slice must produce independently verified GPU evidence before primary finalization becomes legal.

## Commands

Validate the authority:

```bash
python -m tai.cpu_benchmark_finalization_cli validate-authority \
  apps/tai/model-artifacts/cpu-benchmark-finalization-authority.v1.json
```

Validate the pending baseline:

```bash
python -m tai.cpu_benchmark_finalization_cli validate-manifest \
  apps/tai/model-artifacts/cpu-benchmark-finalization.pending.json
```

Verify complete real evidence:

```bash
python -m tai.cpu_benchmark_finalization_cli verify \
  apps/tai/model-artifacts/cpu-benchmark-finalization-authority.v1.json \
  apps/tai/model-artifacts/model-benchmark-admission-authority.v2.json \
  apps/tai/model-artifacts/model-bundle-authority.v2.json \
  apps/tai/model-artifacts/cpu-runtime-evidence-authority.v1.json \
  /secure/runtime/runtime-verification.json \
  /secure/runtime/runtime-manifest.json \
  /secure/runtime/original \
  /secure/runtime/restored \
  apps/tai/model-artifacts/quality-scoring-authority.v1.json \
  /secure/quality/quality-verification.json \
  /secure/quality/quality-scoring-manifest.json \
  /secure/ap14c/accepted-assessment.json \
  /secure/ap14c/case-manifest.json \
  /secure/benchmark/mistral-benchmark.json \
  /secure/benchmark/original \
  /secure/benchmark/restored \
  /secure/finalization/finalization.json \
  --evaluated-at 2026-07-21T20:00:00Z \
  --output /secure/finalization/verification.json
```

## Fail-closed cases

The verifier rejects:

- forged or stale runtime/quality summaries;
- any report which cannot be reproduced from immutable evidence;
- substituted response, trace, bundle or artifact digests;
- quality aggregates not equal to the human-scored Mistral profile;
- CPU evidence presented as `GPU_SHARED` or `Q8_0`;
- a missing explicit GPU blocker;
- an unverified canonical Mistral benchmark candidate;
- same-root or mutable finalization storage;
- threshold or joint-authority drift.

## Maturity boundary

After successful AP-13C.1e verification:

- Qwen primary benchmark: `PENDING_BENCHMARK`;
- Mistral fallback benchmark: `VERIFIED`;
- joint benchmark: `PENDING_BENCHMARK`;
- model admission: `PENDING_ADMISSION`;
- production operational status: `NOT_ATTESTED`.
