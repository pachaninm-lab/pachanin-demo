# TAI AP-13C.1d — governed human quality scoring authority

## Purpose

This slice verifies the semantic quality of the exact Qwen and Mistral raw observations retained by AP-13C.1c. It is deterministic, fail-closed and human-scored. It does not use an LLM as judge and does not infer answer quality from successful runtime execution.

Coordinator: issue `#2993`  
Remediation: issue `#2997`  
Parents: `#2971`, `#2788`, `#2726`  
Runtime authority: `#2987`

## Required evidence chain

Quality verification starts only after a real AP-13C.1c report has status:

`RUNTIME_EVIDENCE_VERIFIED_PENDING_QUALITY_SCORING`

The verifier does not trust that report in isolation. It must:

1. load the exact governed AP-13C.1c runtime authority;
2. rerun AP-13C.1c verification against the runtime manifest plus independent original and restored evidence roots;
3. require the supplied runtime report to exactly equal the reproduced report;
4. require a self-digested accepted AP-14C assessment with all 58 expert-reviewed cases and no blockers;
5. bind the quality case manifest to that exact assessment and corpus;
6. derive the metadata-only quality observation index directly from the verified AP-13C.1c raw manifest and raw payload;
7. verify every reviewer identity against a server-signed, MFA-bound assertion;
8. reproduce every reviewer evidence file from immutable original and independently restored roots.

There is no caller-supplied free-standing observation index. Its digest is deterministic output from the verified evidence chain. The derived index contains the exact Cartesian product of two model profiles, 58 cases and RU/EN/ZH — 348 observations — with each case, prompt, response and trace SHA-256.

Raw prompts, raw responses, reviewer notes, signing secrets and reviewer evidence remain outside Git and GitHub artifacts.

## Authenticated reviewer authority

Submitter-declared `scorer_id` and `scorer_role` are not authority.

Each scorer must have one server-issued `tai.reviewer-identity-assertion.v1` bound to:

- exact subject identity and reviewer role;
- issuer `TAI_SERVER_IDENTITY`;
- audience `TAI_QUALITY_SCORING`;
- approved key ID and signature algorithm;
- successful TOTP, WebAuthn or hardware-key MFA;
- bounded issue/expiry timestamps and maximum MFA age;
- a canonical HMAC-SHA256 signature verified with an external operator-owned secret.

The signing secret is never committed. The verifier receives its external file path and a separate operator-trusted SHA-256 trust anchor. A supplied secret, key ID, role or signature cannot establish its own authority.

## Human scoring policy

Normal observations require one independent primary scorer:

- platform case → `PLATFORM_OWNER`;
- agro case → `DOMAIN_EXPERT`.

Critical observations require two independent scorers:

- the required domain primary role; and
- one of `SECURITY_REVIEWER`, `LEGAL_REVIEWER`, `METHOD_REVIEWER`.

The verifier rejects duplicate scorer identities, duplicate annotation IDs, stale case/prompt/response/trace digests, incomplete model/locale coverage, open disagreement, conflicting decisions, unknown roles, unauthenticated identities, expired assertions and stale MFA.

## Deterministic annotation contract

Every annotation records only bounded metadata and verdicts:

- profile, case and locale;
- case, prompt, response and trace SHA-256;
- authenticated scorer identity, role and assertion ID;
- timestamp and external evidence SHA-256, size, object key and immutable VersionId;
- PASS/FAIL decision;
- disposition validity;
- required concepts present;
- forbidden claims absent;
- citation authority, support and freshness validity;
- abstention validity;
- unsupported-fact and safety-failure counts;
- disagreement reference;
- annotation self-digest.

No free-form answer, reviewer note or evidence payload is accepted inside the scoring manifest.

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

## Immutable external evidence boundary

The annotation set and reviewer evidence must be retained in immutable versioned Selectel S3 for at least 90 days.

The external manifest binds every annotation to one evidence file with:

- safe relative path;
- SHA-256 and byte size;
- immutable object key and VersionId;
- retention deadline;
- exact annotation ID.

The verifier checks the supplied manifest byte-for-byte against copies restored under two distinct root identities. It then reads each evidence file from both roots and requires identical payload, digest and size. Symlinks, path traversal, missing files, duplicate object identities, shortened retention, declared-only digests and original/restore drift fail closed.

The AP-13C.1c runtime roots are separate mandatory inputs and are independently reverified before quality scoring.

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
  apps/tai/model-artifacts/cpu-runtime-evidence-authority.v1.json \
  /secure/runtime/cpu-runtime-verification.v1.json \
  /secure/runtime/cpu-runtime-evidence.v1.json \
  /secure/runtime/original-root \
  /secure/runtime/independent-restored-root \
  /secure/ap14c/accepted-assessment.v1.json \
  /secure/ap14c/gold-case-manifest.v1.json \
  /secure/quality/quality-scoring-evidence.v1.json \
  /run/secrets/tai-reviewer-identity-hmac \
  /secure/quality/reviewer-evidence-manifest.v1.json \
  /secure/quality/original-root \
  /secure/quality/independent-restored-root \
  --trusted-identity-secret-sha256 "$TAI_REVIEWER_IDENTITY_SECRET_SHA256" \
  --evaluated-at 2026-07-21T18:00:00Z \
  --output /secure/quality/quality-scoring-verification.v1.json
```

The digest variable is supplied from operator-trusted configuration, not from the scoring manifest or reviewer evidence. The command fails closed when any trusted input is missing.

## Release rule

Acceptance is bound to one stable final branch SHA. Any code, test, scope or documentation change invalidates prior exact-head evidence and requires the full repository gate set to complete again on the new SHA before merge.

## Maturity boundary

This slice does not finalize the benchmark, supply the separate GPU profile, admit a model, activate routing, deploy inference or attest production.

Until later benchmark finalization and joint admission:

- benchmark: `PENDING_BENCHMARK`;
- model admission: `PENDING_ADMISSION`;
- production operational status: `NOT_ATTESTED`.
