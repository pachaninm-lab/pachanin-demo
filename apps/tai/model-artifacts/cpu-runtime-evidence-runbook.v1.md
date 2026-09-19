# TAI AP-13C.1c immutable raw CPU runtime evidence

## Purpose

This slice defines the fail-closed evidence contract between real external CPU execution and later governed quality scoring. It can verify that Qwen and Mistral actually ran on the accepted dedicated host with exact immutable model bundles. It cannot assert platform accuracy, agro accuracy, model admission or production readiness.

Coordinator: issue `#2987`  
Parent execution issue: `#2971`

## Why runtime and quality are separate

Throughput, latency, memory and successful response capture do not prove that an answer is correct. Likewise, an LLM judging another LLM is not accepted as authoritative evidence.

AP-13C.1c therefore ends only in:

`RUNTIME_EVIDENCE_VERIFIED_PENDING_QUALITY_SCORING`

The later scoring slice must evaluate the exact retained raw observations against the accepted AP-14C policy before `tai.model-benchmark-evidence.v2` can become complete.

## Bound authority

The contract pins:

- Qwen/Qwen3-8B at revision `895c8d171bc03c30e113cd7a28c02494b5e068b7`, CPU `Q4_K_M`;
- mistralai/Mistral-7B-Instruct-v0.3 at revision `c170c708c41dac9275d15a8fff4eca08d52bab71`, CPU `Q4_K_M`;
- llama.cpp release `b9637`, commit `aedb2a5e9ca3d4064148bbb919e0ddc0c1b70ab3`;
- the dedicated `tai-model` host only;
- loopback-only inference and exact-version S3 egress;
- AP-14C suite `tai-platform-agro-58-v1` with 58 cases, 23 critical cases and locales RU/EN/ZH;
- 174 observations per model and 348 total raw observations;
- concurrency levels 1, 2 and 4;
- minimum 100 performance samples per profile;
- 100 forced primary-to-fallback transitions;
- a minimum one-hour, 1,000-request soak.

## Preconditions

Runtime execution must not start until all of these are real and current:

1. AP-13C.1 readiness status is `READY_FOR_EXTERNAL_EXECUTION` and not older than 24 hours;
2. both model bundles are externally immutable, exact-version restored and `VERIFIED`;
3. Selectel evidence storage is accepted with versioning and Object Lock;
4. AP-14C assessment is `ACCEPTED`, 58/58 reviewed and zero unreviewed;
5. the dedicated CPU host remains accepted;
6. exact-main is unchanged.

The current repository state does not satisfy these conditions, so the committed baseline remains `PENDING_RUNTIME_EXECUTION`.

## Required external evidence

The immutable evidence archive contains:

- exact readiness and bundle-finalization bindings;
- hardware identity without exposing the hostname;
- llama.cpp environment and artifact SHA-256 values;
- normalized llama-bench and request/concurrency metrics;
- operating-cost inputs in RUB without inventing costs;
- the exact AP-14C case manifest;
- a raw observation manifest containing only identities and digests;
- the full raw prompt/response payload used for later scoring;
- forced fallback protocol and metrics;
- one-hour soak metrics;
- every declared evidence file SHA-256 and size;
- exact S3 object version, archive digest, upload, retention and independent restore timestamps.

Raw prompts, responses, model bytes, GGUF files, logs, archives and credentials must never enter Git, pull requests, issue comments or GitHub Actions artifacts.

## Verification

Pending baseline:

```bash
cd apps/tai
python -m tai.cpu_runtime_evidence_cli verify-runtime-evidence \
  model-artifacts/cpu-runtime-evidence-authority.v1.json \
  model-artifacts/cpu-runtime-evidence.pending.json \
  /not-used /not-used
```

Exit code `2` and status `PENDING_RUNTIME_EXECUTION` are expected.

Completed external evidence:

```bash
python -m tai.cpu_runtime_evidence_cli verify-runtime-evidence \
  model-artifacts/cpu-runtime-evidence-authority.v1.json \
  /external/control/manifest.json \
  /external/original-evidence \
  /external/clean-restore \
  --output /external/control/verification-report.json
```

Exit code `0` is reserved for `RUNTIME_EVIDENCE_VERIFIED_PENDING_QUALITY_SCORING`.

## Fail-closed conditions

Verification rejects:

- stale, simulated or wrong-exact-main readiness;
- mutable or unversioned model/evidence locators;
- wrong model, revision, quantization, artifact or toolchain identity;
- missing concurrency levels or samples;
- threshold failures for throughput, latency, errors, RAM or startup;
- incomplete 58 × 3 × 2 raw observation coverage;
- prompt/response payload digest drift;
- failed fallback transitions or continuity violations;
- insufficient soak duration or requests;
- symlinks, path traversal, duplicate JSON keys, undeclared files or restore drift;
- same-root copies presented as independent restore;
- shortened external retention;
- any maturity inflation.

## Maturity boundary

Even after runtime evidence verifies:

- quality scoring status: `PENDING_QUALITY_SCORING`;
- benchmark status: `PENDING_BENCHMARK`;
- model admission: `PENDING_ADMISSION`;
- production operational status: `NOT_ATTESTED`.

CPU evidence does not satisfy the separate Qwen GPU/shared Q8_0 profile and cannot create joint model admission.
