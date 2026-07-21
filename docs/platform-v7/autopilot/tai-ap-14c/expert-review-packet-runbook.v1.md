# TAI AP-14C.2 expert review packet runbook

## Purpose

This runbook prepares the governed 58-case AP-14C corpus for real independent human review. It does not create, infer or approve any expert decision.

The owner-only exact-main command is:

```text
/tai prepare expert-review-packet exact-main
```

It must be posted in issue `#2973` after the workflow is accepted into `main`.

## Output

The workflow emits bounded metadata only:

- one exact-main master packet;
- one `PLATFORM_OWNER` track with all 42 platform cases;
- one `DOMAIN_EXPERT` track with all 16 agro cases;
- one `SECURITY_REVIEWER` track with all 23 critical cases;
- one `LEGAL_OR_METHOD_REVIEWER` track with all 23 critical cases;
- an empty review-submission template using the accepted `tai.expert-reviews.v1` schema;
- a file manifest with exact SHA-256 and size for every emitted file.

Each case remains bound to its exact `case_sha256`, prompts, expected dispositions, required concepts, forbidden claims, citation policy and abstention reasons.

## Human review requirements

Normal platform cases require one `PLATFORM_OWNER` approval.

Normal agro cases require one independent `DOMAIN_EXPERT` approval.

Critical platform cases require at least:

1. one `PLATFORM_OWNER` approval;
2. one independent `SECURITY_REVIEWER` or `LEGAL_OR_METHOD_REVIEWER` approval.

Critical agro cases require at least:

1. one independent `DOMAIN_EXPERT` approval;
2. one independent `SECURITY_REVIEWER` or `LEGAL_OR_METHOD_REVIEWER` approval.

Reviewer identities must be opaque portable identifiers. A reviewer cannot submit more than one decision for the same case. Critical approvals must come from distinct reviewer identities and roles.

## Review record contract

Each completed record must contain:

```json
{
  "review_id": "portable-id",
  "case_id": "exact-case-id",
  "case_sha256": "exact-64-hex-case-digest",
  "reviewer_id": "opaque-reviewer-id",
  "reviewer_role": "PLATFORM_OWNER | DOMAIN_EXPERT | SECURITY_REVIEWER | LEGAL_OR_METHOD_REVIEWER",
  "decision": "APPROVED | REJECTED | NEEDS_CHANGES",
  "reviewed_at": "timezone-aware timestamp",
  "evidence_sha256": "SHA-256 of external review evidence",
  "disagreement_with_review_id": null,
  "review_sha256": "SHA-256 of canonical record without review_sha256"
}
```

External evidence can be a signed review form, meeting protocol, ticket export or other immutable review artifact. Evidence bytes remain outside Git; only their SHA-256 and locator are accepted later.

## Fail-closed rules

- Do not change expected results during review.
- A changed case digest invalidates the old review.
- `REJECTED` or `NEEDS_CHANGES` remains blocking until resolved through a new governed corpus revision and new review.
- Automation cannot populate reviewer identity, decision, timestamp, evidence digest or review digest.
- Review packets do not prove model accuracy or benchmark readiness.
- Self-attestation is not sufficient for the independent expert-review prerequisite.

## Completion condition

After real review records are committed through a separate acceptance PR, run:

```bash
node docs/platform-v7/autopilot/tai-ap-14c/gold-set-authority.mjs --require-accepted
```

Issue `#2973` can close only when that command passes on exact-main with:

- `accepted=true`;
- all 58 cases reviewed;
- zero stale records;
- zero open rejection or needs-changes decision;
- the required primary and secondary role coverage for every critical case.

## Maturity boundary

Review packet generation leaves:

- expert review: `PENDING_REVIEW`;
- benchmark: `PENDING_BENCHMARK`;
- model admission: `PENDING_ADMISSION`;
- production operational status: `NOT_ATTESTED`.
