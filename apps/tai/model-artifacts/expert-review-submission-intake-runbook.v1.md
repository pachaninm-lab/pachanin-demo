# TAI AP-14C expert review submission intake

## Purpose

This offline contour validates review records completed by real external reviewers and writes candidate authority files for a separate human-reviewed pull request. It never creates, changes or approves an expert decision by itself.

Authority issue: `#2986`  
Parent checkpoint: `#2973`  
Packet command: `/tai prepare expert-review-packet exact-main`

## Inputs

Use the exact packet artifact published by the owner-only AP-14C packet workflow. The intake requires:

- `expert-review-packet.v1.json` from that artifact;
- one track-bound `intake-submission-<track-id>.v1.json` template from the same artifact;
- the current `expert-reviews.v1.json` authority;
- the packet's exact-main SHA and a timezone-aware evaluation timestamp.

The packet materializes one intake template for each governed reviewer track. Exact-main, corpus SHA-256, packet SHA-256 and `track_id` are already fixed. The coordinator fills only `submitter_id`, `submitted_at` and the non-empty `reviews` array. The template has exactly these fields:

```json
{
  "schema_version": "tai.expert-review-submission.v1",
  "exact_main_sha": "<40-character packet SHA>",
  "corpus_sha256": "<packet corpus SHA-256>",
  "packet_sha256": "<packet SHA-256>",
  "track_id": "platform-primary",
  "submitter_id": "<opaque non-placeholder coordinator identity>",
  "submitted_at": "2026-07-21T12:00:00Z",
  "reviews": []
}
```

Each review must use the unchanged record contract from its corresponding `track-<track-id>.v1.json` template. Human-only fields must be completed by the reviewer. `review_sha256` is SHA-256 over canonical JSON of the complete review record excluding `review_sha256` itself.

## Governed reviewer tracks

- `platform-primary` → `PLATFORM_OWNER`;
- `agro-primary` → `DOMAIN_EXPERT`;
- `critical-security` → `SECURITY_REVIEWER`;
- `critical-legal-method` → `LEGAL_OR_METHOD_REVIEWER`.

A submission may contain only cases assigned to its selected track. Partial submissions are allowed, but the reviews array must be non-empty.

## Execute locally

```bash
node apps/tai/model-artifacts/expert-review-submission-intake.mjs \
  --packet /secure/packet/expert-review-packet.v1.json \
  --submission /secure/packet/intake-submission-platform-primary.v1.json \
  --existing-reviews docs/platform-v7/autopilot/tai-ap-14c/expert-reviews.v1.json \
  --exact-main <packet-exact-main-sha> \
  --evaluated-at 2026-07-21T12:10:00Z \
  --output-reviews /secure/candidate/expert-reviews.v1.json \
  --output-assessment /secure/candidate/baseline-assessment.v1.json \
  --output-report /secure/candidate/intake-report.v1.json
```

Exit code `0` means only that candidate files were written. It does not accept the reviews. Any contract or provenance failure exits with code `2` before output files are written.

## Fail-closed controls

The intake rejects:

- packet, corpus or exact-main drift;
- any self-signed packet that redefines case contracts, reviewer tracks or review policy;
- stale `case_sha256` or a case outside the selected track;
- reviewer roles that do not match the track;
- placeholder reviewer or submitter identities;
- timestamps before packet generation, after submission or in the future;
- invalid evidence or review SHA-256 values;
- unknown or missing fields;
- duplicate review IDs or reviewer/case pairs;
- attempted replacement of an existing review;
- disagreement references to an unknown, different-case or same-reviewer record;
- stale packets whose baseline assessment no longer matches current authority.

Outputs are written atomically to three distinct caller-selected paths. Existing symbolic-link destinations are rejected.

## Human acceptance remains mandatory

A human must inspect the candidate diff, verify reviewer identity and external evidence outside automation, and open a bounded pull request updating only the governed review and assessment files plus required provenance metadata. The normal AP-14C authority must then pass on exact-head.

Until the real review policy is satisfied:

- expert review: `PENDING_REVIEW`;
- benchmark: `PENDING_BENCHMARK`;
- model admission: `PENDING_ADMISSION`;
- production operational status: `NOT_ATTESTED`.
