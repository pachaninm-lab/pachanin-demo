# AP-13C benchmark and AP-13D admission v2

## Boundary

This runbook consumes only complete, independently restored model bundles accepted under `tai.model-bundle-authority.v2`. It does not download weights, approve a license, fabricate measurements, activate a model or change production readiness.

The committed Qwen and Mistral benchmark manifests remain `PENDING_BENCHMARK` until real evidence exists. Pending verification and pending admission intentionally return exit code `2`.

## 1. Freeze the evaluation suite

Create an immutable suite containing exactly 58 cases, including exactly 23 critical cases. Preserve:

- suite manifest;
- case records and expected evidence;
- scoring/evaluator protocol;
- exact SHA-256 and byte size for every file.

Critical cases must cover unsupported-fact rejection, required abstention and safety boundaries. The benchmark authority requires:

- platform accuracy at least 95%;
- agro accuracy at least 90%;
- critical unsupported facts = 0;
- critical safety failures = 0;
- critical abstention misses = 0.

## 2. Bind the verified model bundles

For each candidate, record the canonical digest of:

- `model-bundle-authority.v2.json`;
- the completed bundle manifest;
- the `VERIFIED` bundle report;
- the immutable bundle archive and locator;
- every registered quantized artifact.

The benchmark verifier receives the bundle authority directly and recomputes its canonical digest. A copied or stale digest cannot substitute for the accepted authority.

## 3. Execute all required runtime profiles

Required profiles:

1. Qwen CPU `Q4_K_M`, concurrency 1/2/4;
2. Qwen GPU/shared `Q8_0`, concurrency 1/2/4/8;
3. Mistral fallback CPU `Q4_K_M`, concurrency 1/2/4.

For each profile preserve raw evidence for:

- exact hardware identity;
- exact software/runtime environment;
- prompt and generation tokens/sec;
- p95 and p99 latency;
- separate peak RAM and VRAM;
- cold start and warmup;
- request count, failures and error rate at every concurrency level;
- an explicit operating-cost calculation and assumptions.

Do not copy model-card or third-party benchmark numbers.

## 4. Exercise fallback

The primary benchmark must contain a real primary-to-Mistral fallback exercise with at least 100 triggered transitions. The accepted policy requires:

- zero failed transitions;
- p95 takeover <= 5 seconds;
- zero continuity violations;
- zero critical unsupported facts.

An identity declaration without a triggered fallback run is not evidence.

## 5. Run soak

Each model benchmark must include at least one one-hour soak with at least 1,000 requests. Preserve raw metrics and environment evidence. The authority permits at most 10 failed requests, zero critical failures and at most 512 MB memory drift.

## 6. Freeze and restore the evidence bundle

Upload only the benchmark evidence bundle to immutable/versioned external storage. Record archive SHA-256, byte size, upload time, retention interval and expiry. Download it into a clean restore root. The verifier rejects missing files, traversal, symlinks, non-regular files, hard-link aliases, size/hash mismatch and original/restore drift.

Model weights and GGUF artifacts remain in the accepted model bundle; do not copy them into Git.

## 7. Verify benchmark evidence

```bash
cd apps/tai
python -m tai.model_benchmark_admission_v2_cli verify-benchmark \
  model-artifacts/model-benchmark-admission-authority.v2.json \
  model-artifacts/model-bundle-authority.v2.json \
  /secure/benchmark/qwen/benchmark.v2.json \
  /secure/benchmark/qwen/original \
  /secure/benchmark/qwen/restored \
  --output /secure/benchmark/qwen/verification-report.v2.json
```

Repeat for Mistral. Exit `0` is reserved for `VERIFIED`. Pending, invalid or policy-failing evidence exits `2`.

## 8. Produce the joint admission decision

```bash
python -m tai.model_benchmark_admission_v2_cli admit \
  model-artifacts/model-benchmark-admission-authority.v2.json \
  /secure/benchmark/qwen/verification-report.v2.json \
  /secure/benchmark/mistral/verification-report.v2.json \
  --evaluated-at 2026-07-20T12:00:00+00:00 \
  --output /secure/benchmark/model-admission-decision.v2.json
```

`ADMITTED` requires both independent `VERIFIED` reports, exact profile sets, current measurements and verified bundle bindings. `PENDING_ADMISSION` or `REJECTED` exits `2`.

Admission is evidence only. Activation remains a separate reviewed production-composition change. `production_operational_status` remains `NOT_ATTESTED` until the later operational acceptance contour completes.
