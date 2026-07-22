# TAI AP-13C.0 benchmark prerequisite closure

## Purpose

This contour makes every dependency of real model benchmarking explicit. It does not execute inference, accept a human review, provision external accounts, create a GPU host, admit a model or change production readiness.

Authority: `benchmark-prerequisite-authority.v1.json`  
Current observation: `benchmark-prerequisite-baseline.v1.json`  
Coordinator: issue `#2974`

## Current exact baseline

The current machine-readable assessment is intentionally `BLOCKED`:

- AP-13C/AP-13D v2 benchmark authority exists and is valid;
- the dedicated CPU host has been provisioned;
- immutable Selectel S3 storage inputs are absent;
- both model bundles remain `FAILED_CLOSED` before external storage mutation;
- the 58-case / 23-critical-case AP-14C corpus remains `PENDING_REVIEW`;
- no dedicated GPU host has been accepted;
- CPU/fallback and GPU benchmarks are `NOT_RUN`.

`production_operational_status` remains `NOT_ATTESTED`.

## Evaluate the matrix

```bash
cd apps/tai
python -m tai.benchmark_prerequisite_matrix_cli \
  model-artifacts/benchmark-prerequisite-authority.v1.json \
  model-artifacts/benchmark-prerequisite-baseline.v1.json \
  --evaluated-at 2026-07-21T14:20:00+00:00 \
  --output /tmp/tai-benchmark-prerequisites.json
```

Exit code `2` is expected while any prerequisite is missing, pending, stale or simulated. Exit code `0` is reserved for `READY_FOR_JOINT_MODEL_ADMISSION`.

## CPU/fallback execution gate

Issue `#2971` can start only when all of these are accepted:

1. AP-13C/AP-13D v2 authority;
2. both exact model bundles stored externally, bound to exact object versions and independently restored;
3. external evidence storage accepted;
4. all 58 AP-14C cases accepted under the governed independent-review policy;
5. dedicated CPU host accepted.

The CPU slice does not satisfy the Qwen GPU/shared profile and cannot produce joint model admission.

## GPU execution gate

Issue `#2972` additionally requires a dedicated GPU execution environment with exact hardware/runtime evidence. CPU measurements, model-card numbers or third-party benchmarks cannot substitute for this requirement.

## Human-review gate

Issue `#2973` closes only when:

```bash
node docs/platform-v7/autopilot/tai-ap-14c/gold-set-authority.mjs --require-accepted
```

returns exit code `0` on exact-main. Review records must remain attributable, independent, digest-bound and current for the exact case SHA-256 values.

## External S3 gate

The owner must create the Selectel service-user S3 key and store all required values only in GitHub repository secrets. The governed storage workflow then proves versioning, Object Lock COMPLIANCE retention, private access, exact object-version restore and digest equality. Code-only or same-host copies do not satisfy this gate.

## Updating observations

A prerequisite may be changed to its required status only from real evidence referenced by an immutable repository commit or a concrete GitHub issue/workflow evidence locator. Every update must preserve:

- exact owner issue;
- timezone-aware observation time;
- `simulated=false`;
- exact commit for code authority;
- no model files, benchmark payloads or credentials in Git.

Observations older than 30 days are treated as stale and block every slice.
