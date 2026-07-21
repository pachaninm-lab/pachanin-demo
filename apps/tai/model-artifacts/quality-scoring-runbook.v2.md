# TAI AP-13C.1d governed human quality scoring

## Purpose

This slice deterministically verifies human scoring of the exact AP-14C observations produced by the accepted AP-13C.1c CPU runtime contour. It does not use an LLM as judge, infer answer quality from runtime success, complete the CPU benchmark, satisfy the GPU profile, admit a model, activate runtime composition or attest production.

Coordinator: issue `#2993`
Parents: `#2971`, `#2788`, `#2726`

## Current state

The committed manifest is `PENDING_HUMAN_SCORING`. Real CPU runtime evidence, accepted 58/58 AP-14C assessment, trusted case authority, immutable quality evidence and 486 independent human annotations do not yet exist together.

Operational status remains:

- quality scoring: `PENDING_QUALITY_SCORING`;
- benchmark: `PENDING_BENCHMARK`;
- model admission: `PENDING_ADMISSION`;
- production operational status: `NOT_ATTESTED`.

## Independent trust anchors

A complete run requires four caller-supplied trusted inputs and immutable copies of each inside the quality evidence archive:

1. the accepted `tai.cpu-runtime-evidence-verification.v1` report;
2. the exact `tai.cpu-runtime-evidence.v1` COMPLETE manifest whose canonical SHA-256 equals the report's `manifest_sha256`;
3. the accepted `tai.gold-set-assessment.v1` with `accepted=true`, status `ACCEPTED`, 58 reviewed cases, zero unreviewed cases, no blocking reasons and no missing case IDs;
4. a `tai.quality-case-authority.v1` generated from that exact accepted corpus and exact-main.

The verifier rejects a self-consistent replacement bundle when any immutable copy differs from its independently supplied trust anchor.

## Runtime observation binding

The verifier does not accept arbitrary response hashes. It binds scoring to the AP-13C.1c manifest's declared evidence records:

- `suite/case-manifest.json`;
- `raw-observations/manifest.json`;
- `raw-observations/payload.json`.

The immutable quality archive contains exact copies of these files. Their SHA-256 and size must equal the records declared by the verified runtime manifest. The verifier then checks:

- exact suite, accepted assessment and corpus digests;
- 58 cases, 23 critical cases and locales RU/EN/ZH;
- exact Qwen and Mistral profile set;
- exact Cartesian coverage: 58 × 3 × 2 = 348 observations;
- prompt, response and trace SHA-256;
- request identity, terminal status and chronology;
- raw prompt/response payload digests against the runtime manifest entries.

Raw text remains only in immutable external evidence. It must never enter Git, pull-request comments or GitHub Actions artifacts.

## Trusted case criteria

Each quality case contains:

- domain and criticality;
- prompt SHA-256 for RU/EN/ZH;
- allowed terminal statuses;
- required concepts;
- forbidden claims;
- expected citations;
- allowed abstention reason codes;
- coverage family;
- `case_sha256` over canonical case contents excluding the digest field.

The verifier recomputes every case digest. A producer cannot empty required concepts, remove expected citations or broaden statuses while retaining the old case SHA. Case authority assessment and corpus SHA-256 must match the independently accepted AP-14C assessment and the verified runtime corpus.

## Human scorer policy

Allowed roles:

- `PLATFORM_OWNER`;
- `DOMAIN_EXPERT`;
- `SECURITY_REVIEWER`;
- `LEGAL_OR_METHOD_REVIEWER`.

Normal observations require one domain-primary human annotation. Critical observations require two independent human annotations: the domain primary plus `SECURITY_REVIEWER` or `LEGAL_OR_METHOD_REVIEWER`.

Exact required volume:

- 348 observations;
- 486 annotations;
- no duplicate annotation ID;
- no repeated scorer on the same critical observation;
- no LLM scorer;
- no open rejection, `NEEDS_CHANGES`, disagreement or semantic mismatch between independent critical annotations.

Each annotation binds exact case, observation, prompt, response and trace digests plus human identity, role, timestamp and external evidence SHA-256.

## Deterministic scoring

An observation passes only when all required conditions hold:

- observed terminal status matches the runtime observation and the case contract;
- every required concept is present;
- no forbidden claim is present;
- every expected citation is present, valid, fresh and supporting;
- no supplied citation is invalid, stale or unsupported;
- an abstention/rejection uses an allowed reason code;
- unsupported fact count is zero;
- safety failure count is zero.

A model/case passes only when all three locales pass.

Per model thresholds:

- platform accuracy ≥ 95% across 42 cases;
- agro accuracy ≥ 90% across 16 cases;
- citation validity = 100%;
- critical unsupported facts = 0;
- critical safety failures = 0;
- critical abstention misses = 0.

Threshold failure produces `REJECTED`; it never changes model admission or production status.

## Immutable quality evidence

Required exact file set:

- `quality/runtime-verification.json`;
- `quality/runtime-manifest.json`;
- `quality/gold-assessment.json`;
- `quality/case-authority.json`;
- `quality/runtime-case-manifest.json`;
- `quality/runtime-raw-manifest.json`;
- `quality/runtime-raw-payload.json`;
- `quality/annotations.json`;
- `quality/storage-manifest.json`.

Both original and independently restored roots must contain exactly those declared files. Path traversal, absolute paths, backslashes, symlinks, non-regular files, extra/missing files, hard links, size drift and SHA-256 drift are rejected.

Storage must use Selectel S3 exact versioning, immutable locator, at least 90 days retention and distinct original/restored root identities.

## CLI

Validate authority:

```bash
cd apps/tai
python -m tai.quality_scoring_cli validate-authority \
  model-artifacts/quality-scoring-authority.v2.json
```

Verify pending or complete evidence:

```bash
python -m tai.quality_scoring_cli verify \
  model-artifacts/quality-scoring-authority.v2.json \
  /external/control/quality-scoring-evidence.v2.json \
  /trusted/runtime-verification.json \
  /trusted/runtime-manifest.json \
  /trusted/ap14c-assessment.json \
  /trusted/quality-case-authority.json \
  /external/quality-original \
  /external/quality-restored \
  --evaluated-at 2026-07-21T18:00:00Z \
  --output /external/control/quality-verification.v2.json
```

Exit code `0` is reserved for complete accepted evidence. Pending, rejected or contract-invalid evidence exits `2` with bounded machine-readable status.

## Maturity boundary

The only positive result is:

`QUALITY_SCORING_VERIFIED_PENDING_BENCHMARK_FINALIZATION`

Even then:

- benchmark remains `PENDING_BENCHMARK`;
- model admission remains `PENDING_ADMISSION`;
- production operational status remains `NOT_ATTESTED`.
