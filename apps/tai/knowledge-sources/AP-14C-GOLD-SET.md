# AP-14C platform/agro gold-set authority

This slice creates a deterministic, fail-closed authority for platform and Russian-agriculture question sets. It does not label AI-generated questions as expert-approved.

## Candidate baseline

`build_platform_agro_candidate` produces 42 cases:

- 21 platform cases;
- 21 agro cases;
- 14 semantic variant groups;
- Russian, English and Chinese variants for every group;
- explicit answer vs abstention disposition;
- required authority IDs, citation minimums, required concepts and forbidden claims.

The baseline is bound to the AP-14D.1 live evidence run `29688374038`. CBR evidence is current. EEC evidence is stale. Rosstat and Mintrans were unobserved in that run. Agronomy is represented as a formal source gap. Therefore the baseline cannot pass the current-authority gate.

## Human-review invariant

A question is approved only when a durable review record contains:

- a human reviewer identity and role;
- review timestamp;
- decision;
- exact criteria SHA-256;
- durable evidence URI;
- comment SHA-256.

Reviewer identities or roles containing `ai`, `bot` or `assistant` are rejected. No model or automated agent can create accepted expert-review evidence.

## Acceptance

The default authority requires:

- at least 20 platform and 20 agro questions;
- RU/EN/ZH coverage for every semantic variant group;
- at least one approved human review per question;
- every critical question approved;
- every authority used for an answer current and usable.

The 42-case candidate satisfies the count and language gates but intentionally fails human-review and authority-freshness gates. It is a reviewable candidate, not a production gold set.

## CLI

Emit the exact-head candidate:

```bash
python -m tai.gold_set_cli emit-candidate \
  --exact-head "$GIT_SHA" \
  --created-at 2026-07-19T14:00:00+00:00 \
  --output /secure/evidence/platform-agro-candidate.json
```

Assess a reviewed manifest:

```bash
python -m tai.gold_set_cli assess \
  /secure/evidence/platform-agro-reviewed.json \
  --at 2026-07-19T14:00:00+00:00 \
  --output /secure/evidence/platform-agro-assessment.json
```

Exit `0` means accepted. Exit `2` means invalid or not accepted.

TAI remains `NOT_ATTESTED` until human review, current authority evidence and exact-main evaluation results exist.
