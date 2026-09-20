# PC-CROP Two-Contour Team Operating Contract

Status: **ACTIVE COORDINATION CONTRACT**  
Purpose: make two separate ChatGPT execution accounts behave as one engineering team with GitHub as the shared asynchronous memory, dependency bus and handoff ledger.

This document grants no merge, production, security, payment, legal or external-communication authority. MASTER v2.1, repository governance, branch protection and production evidence remain authoritative.

## 1. Contours

### ACCOUNT_1_CORE

Primary mission: advance official MASTER execution, currently **R1 Founder/CEO core to PRODUCTION_PASS**.

Owns by default:
- backend/domain/server authority;
- owner/founder authority and controlled `open-as-role`;
- PostgreSQL/RLS/tenant isolation;
- permission and decision semantics;
- canonical DTO/API contracts required by R1;
- business-metric truthfulness and drill-down authority;
- audit, idempotency, concurrency and negative security cases;
- CI/security/release/production acceptance for its claimed R-slice.

It must not invent a competing UX visual language, duplicate FGIS work or create a second banking/finance implementation already owned by ACCOUNT_2_PRODUCT.

### ACCOUNT_2_PRODUCT

Primary mission: **UX/UI/product design/usability + FGIS + bank/finance product/integration surfaces**.

Owns by default:
- approved visual authority and design-system implementation;
- desktop/mobile/responsive/accessibility/i18n UX;
- public and role-facing product surfaces;
- FGIS product/integration UX and related adapter-facing work within canonical authority boundaries;
- bank/finance product/integration UX and provider-facing work within canonical money/settlement authority boundaries.

It must not create parallel owner authority, RLS/tenant semantics, settlement finality, money authority, role authority or R1 backend semantics. Missing authority becomes a DEPENDENCY to ACCOUNT_1_CORE.

## 2. Shared goal beats local optimization

Both contours optimize for one production platform and one MASTER score. A locally convenient duplicate implementation is a defect.

Rules:
- one canonical domain authority per concept;
- one semantic owner for an active slice;
- shared contracts before parallel implementation;
- no competing V2 core merely because another contour is busy;
- preserve unrelated work and never overwrite the other contour's branch;
- stale chat context never overrides live GitHub.

## 3. Mandatory TEAM PREFLIGHT

Before every new implementation slice each contour must:

1. fetch/re-read exact live `main`;
2. read the Team Hub issue body and latest coordination comments;
3. read this contract and applicable MASTER v2.1 sections;
4. list active PRs/branches from the other contour and inspect changed files;
5. inspect open DEPENDENCY, HANDOFF, CONFLICT and DECISION records;
6. check collision on:
   - paths/files;
   - API routes/contracts;
   - DB tables/migrations;
   - domain aggregates/state machines;
   - permissions/authority;
   - money/finality semantics;
   - external-provider bindings;
7. either claim a safe non-overlapping slice or resolve/raise a dependency first.

No implementation claim is valid if it was chosen from chat history without this preflight.

## 4. Coordination message types

Every significant cross-contour message in the Team Hub starts with one of these machine-readable headings.

### CLAIM

```
CLAIM
OWNER: ACCOUNT_1_CORE | ACCOUNT_2_PRODUCT
BASE_SHA: <40-char SHA>
AREA: <R/scope>
PR_OR_BRANCH: <reference>
SEMANTIC_SCOPE: <authority being owned>
PATH_SCOPE: <known paths/prefixes>
DO_NOT_TOUCH: <boundaries>
EXPECTED_OUTPUT: <contract/result>
```

### DEPENDENCY

```
DEPENDENCY
FROM: <account>
TO: <account>
PRIORITY: P0 | P1 | P2 | NORMAL
NEED: <exact contract/result>
CONSUMER: <feature/slice>
BLOCKS: <what is blocked>
ACCEPTANCE: <what counts as fulfilled>
```

### HANDOFF

```
HANDOFF
FROM: <account>
TO: <account>
PR: <number>
EXACT_HEAD_OR_MERGE_SHA: <SHA>
CONTRACTS: <API/DTO/state/schema>
EVIDENCE: <tests/CI/live refs>
LIMITATIONS: <truthful residuals>
READY_FOR_CONSUMER: YES | NO
```

### DECISION

```
DECISION
ID: <stable id>
SCOPE: <cross-team scope>
DECISION: <canonical rule>
SUPERSEDES: <id or none>
RATIONALE: <short>
EVIDENCE: <links>
```

### PEER_REVIEW_REQUEST

Used to ask the other contour to review integration assumptions or contract compatibility. It never impersonates repository-required independent review.

### CONFLICT

```
CONFLICT
OWNERS: <both>
COLLISION: <file/domain/authority>
EXISTING_OWNER: <account or unresolved>
SAFE_STATE: <what stops>
RESOLUTION_NEEDED: <exact decision>
```

### CHECKPOINT

```
CHECKPOINT
ACCOUNT: <account>
DONE: <result>
ACTIVE: <claim>
PR_HEAD: <PR/SHA>
WAITING_ON: <dependencies>
BLOCKERS: <real blockers>
SAFE_NEXT: <next non-overlapping action>
```

## 5. Conflict policy

- Existing valid CLAIM keeps semantic ownership until HANDOFF/DONE or an explicit DECISION changes it.
- The second contour does not implement a parallel authority while a collision is unresolved.
- File overlap is a warning; semantic authority overlap is a hard stop.
- A UI consumer may proceed against an agreed contract while backend is implemented separately.
- A backend producer may implement contracts without replacing the approved visual implementation.
- If safe partitioning is impossible, raise CONFLICT instead of force-pushing, reverting or overwriting the other contour.

## 6. Dependency service level

When a cross-contour dependency blocks productive work:
1. prioritize production/security/data-loss blockers first;
2. then unblock the other contour if the dependency is bounded and on the critical path;
3. return immediately to the owning MASTER slice after handoff;
4. continue independent work on the requesting contour rather than idle if possible.

## 7. Shared decision memory

Any decision that can affect the other contour must be written to GitHub. Important architectural agreements may not live only in one ChatGPT conversation.

If chat and GitHub disagree:
- current repository/production facts win for factual state;
- MASTER/governance win for requirements/authority;
- latest explicit owner decision wins within those boundaries;
- Team Hub records the resulting coordination state.

## 8. Definition of Done is shared

Neither contour may call work complete merely because code exists or a PR is merged.

For MASTER delivery, use:
`exact-head → required review/gates → merge → exact-current-main → exact-SHA release → REG.RU live acceptance → required observation/evidence → PRODUCTION_PASS`.

A cross-contour HANDOFF can be ready before PRODUCTION_PASS, but must say exactly what maturity it has.

## 9. User is product owner, not dispatcher

The two contours self-coordinate ordinary engineering work through GitHub. They ask the user only for:
- a genuine business/product choice with no established authority;
- external credential/contract/approval/signature/CAPTCHA/MFA that tools cannot lawfully supply;
- a high-risk action requiring owner confirmation;
- an unresolved conflict that cannot be solved from MASTER, repository governance and existing decisions.

They do not ask the user to relay ordinary status or API contracts between accounts.

## 10. Current bootstrap split

Last known accepted production/main at team setup:
`5da8e80744908413102214f91dd68018911b892e`

Official MASTER status:
- R0 = PRODUCTION_PASS
- IR-20 = PRODUCTION_PASS
- OVERALL = 5/100 = 5%

Active bootstrap claims:
- ACCOUNT_1_CORE: R1 core; governance PR #5468.
- ACCOUNT_2_PRODUCT: canonical UX/UI; draft PR #5465; declared parallel FGIS and bank/finance lane.

These are bootstrap facts only. Every session must refresh live GitHub before relying on them.

## 11. Main/production protection

Coordination updates belong in the Team Hub issue and this coordination branch. Do not move `main` merely to update team status. Formal source changes still use ordinary governed PRs and exact-head evidence.

The coordination branch is shared memory, not release authority and not a bypass around normal review.
