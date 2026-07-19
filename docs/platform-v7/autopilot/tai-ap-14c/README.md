# TAI AP-14C gold-set authority

This directory is a fail-closed AP-14C corpus authority for issue `#2788`.
It defines reviewable platform and Russian-agriculture question coverage without
claiming model quality or inventing expert approvals.

## Governed corpus

`gold-set-authority.mjs` deterministically materializes:

- 42 platform cases:
  - all 12 current TAI roles from `apps/tai/tai/policy.py`;
  - all 23 current canonical deal states from
    `apps/web/src/domain/types/index.ts`;
  - typo, transliteration, ambiguity, prompt-injection, role-override,
    secret-request and maturity-boundary cases;
- 16 agro cases:
  - all eight critical official-source topics from
    `apps/tai/knowledge-sources/official-sources.v1.json`;
  - typo, transliteration, ambiguity, stale-source, fabricated-law,
    unsafe agronomy and source-injection cases;
- an exact question-coverage registry binding every case to authority,
  citation minimum, freshness rule and abstention policy;
- a case manifest with stable prompt and case SHA-256 digests.

Every prompt has Russian, English and Chinese variants. Source authority is
bound to exact Git blob IDs. Official-source answers additionally require a
successful, fresh live observation; catalog registration alone is insufficient.

The historical AP-14C wording mentions 19 stages. Current repository authority
defines 23 canonical deal states; the existing one-deal CI title refers to
19 commands, not 19 current states. This corpus follows current exact-blob
authority and exposes both counts explicitly.

## Validation and materialization

```bash
node docs/platform-v7/autopilot/tai-ap-14c/gold-set-authority.mjs
node docs/platform-v7/autopilot/tai-ap-14c/gold-set-authority.test.mjs

node docs/platform-v7/autopilot/tai-ap-14c/gold-set-authority.mjs \
  --materialize /tmp/tai-ap-14c-gold
```

The materialized directory contains:

- `platform-gold.v1.json`;
- `agro-gold.v1.json`;
- `question-coverage.v1.json`;
- `case-manifest.v1.json`.

To require completed expert acceptance:

```bash
node docs/platform-v7/autopilot/tai-ap-14c/gold-set-authority.mjs \
  --require-accepted
```

Until real reviews are committed, that command exits with code `2`. Structural
validation without `--require-accepted` exits with code `0` and prints the
machine-readable pending assessment.

## Review protocol

`expert-reviews.v1.json` is intentionally empty. No human or domain review has
been fabricated. `baseline-assessment.v1.json` therefore reports
`PENDING_REVIEW`, `accepted=false`, and all 58 cases as unreviewed.

A real review record must contain:

- a portable `review_id`, opaque `reviewer_id` and allowed reviewer role;
- the exact `case_id` and current `case_sha256`;
- `APPROVED`, `REJECTED` or `NEEDS_CHANGES`;
- a timezone-aware review timestamp;
- a SHA-256 digest of external review evidence;
- an optional disagreement link;
- `review_sha256` over the complete record except that digest field.

Normal cases require one independent approval and the domain's primary reviewer
role. Critical cases require two independent approvals, including the primary
role and either a security or legal/method reviewer. Any open rejection or
needs-changes decision blocks acceptance.

Changing a prompt, expected disposition, concept, prohibited claim, authority,
freshness rule or citation policy changes the case/corpus digest. An existing
review then becomes stale and cannot be reused.

## Maturity boundary

This slice establishes corpus structure, coverage and review authority only.
It does not prove 95% platform accuracy, 90% agro accuracy, model admission,
live-source availability, semantic retrieval quality or production acceptance.
Those require real model observations, real expert decisions and exact-head
evaluation artifacts in later AP-14C/AP-13/AP-15 acceptance work.
