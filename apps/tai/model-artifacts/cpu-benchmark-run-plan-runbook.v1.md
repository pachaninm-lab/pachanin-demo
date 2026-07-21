# TAI AP-13C.1c.0 — exact external CPU benchmark run-plan authority

## Purpose

This slice compiles one deterministic, metadata-only execution plan before the external CPU/fallback runner may read protected Selectel S3 objects or connect to the dedicated model host. It does not execute a model, use SSH, read S3, mutate S3, finalize a benchmark, admit a model, activate routing, deploy inference or attest production.

Issues: `#2991`, runner `#2990`, parent `#2971`, program `#2726`.

## Required command

Owner-only issue comment on issue `#2991`:

`/tai compile cpu-fallback run-plan exact-main`

The owner workflow is permitted to read GitHub metadata and bounded GitHub Actions artifacts. It contains no model-host or S3 credentials. A missing or rejected prerequisite terminates before any protected-input access.

## Exact authorities

The compiler pins the Git blob identity and then validates the full contract of:

- `cpu-benchmark-execution-authority.v1.json`;
- `model-bundle-authority.v2.json`;
- `model-benchmark-admission-authority.v2.json`;
- `model-bundle-finalization-authority.v1.json`.

Their file SHA-256 and semantic authority SHA-256 values are written into the output plan.

## Required bounded inputs

The input index uses schema `tai.cpu-benchmark-run-plan-inputs.v1` and references only bounded JSON files under one evidence root:

1. exact-main readiness report with `READY_FOR_EXTERNAL_EXECUTION`;
2. accepted AP-14C assessment: 58/58 reviewed, 23 critical, no blockers;
3. accepted two-model immutable finalization report;
4. for Qwen and Mistral: external bundle manifest, S3 object record and `VERIFIED` report;
5. clean, absolute and independent benchmark restore roots;
6. GitHub workflow run and artifact identity for the finalization evidence root.

Each reference includes exact file SHA-256 and size. Duplicate JSON keys, unknown fields, path traversal, symlinks, file drift and oversized evidence fail closed.

## Cross-evidence binding

For each model the compiler requires equality across the finalization report, manifest, object record and verification report for:

- role, model ID and exact revision;
- archive SHA-256 and size;
- endpoint, region, bucket, key, VersionId and immutable locator;
- manifest SHA-256 and verification-report SHA-256;
- COMPLIANCE retention and expiry;
- governed Q4_K_M artifact path, SHA-256 and size;
- llama.cpp b9637 package identity and all four binary hashes.

The two model bundles must not reuse an archive, locator, VersionId or restore root. Toolchain binary maps must be identical across both bundles.

## Output

Accepted output status:

`RUN_PLAN_VERIFIED_READY_FOR_PROTECTED_ACCESS`

The output contains only identities, hashes, immutable locators, planned roots and deterministic benchmark policy. It never contains credentials, raw prompts, raw responses, model bytes, GGUF, Safetensors, archives or payload files.

The plan is valid for 24 hours. Both immutable objects must remain retained beyond the plan expiry plus the governed safety margin.

## Maturity boundary

Compilation does not mean that the benchmark ran or that either model passed:

- benchmark: `PENDING_BENCHMARK`;
- model admission: `PENDING_ADMISSION`;
- production operational status: `NOT_ATTESTED`.

The runner in `#2990` must independently verify the accepted plan digest before protected access and must still produce real runtime and quality evidence.
