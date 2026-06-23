# Platform V7 Runtime PR Split Control

Status: **docs/control only**. This file changes no product code, backend, DB, auth, session, API, packages, lockfiles, deploy config or apps/landing.

Linked work:
- Queue: #1974
- Acceleration protocol: #1984
- UX/system audit: #1981
- Real operation readiness: #1982
- Seller cabinet pass: #1976
- Review gate: #1978
- QA checklist: #1979

## Why this control exists

platform-v7 is moving through useful UI and cabinet work, but real high-volume deal execution readiness cannot be delivered by UI polish alone. The platform still needs runtime, data, access, document/evidence, money, integration, load and operations layers before any live-readiness claim is valid.

This control prevents broad work from being hidden inside visual PRs and gives autonomous agents an exact split plan for the next safe PRs.

## Current truth boundary

Current status remains **controlled-pilot / pre-integration** unless and until the required runtime layers exist.

Do not claim:
- production-ready;
- fully live;
- secure server-side cabinet isolation as a completed enforcement layer unless enforcement is implemented and verified;
- real fund release;
- live bank, EDO, FGIS, EPD, GPS, elevator or lab integration;
- high-volume operational readiness.

## Active PR triage rule

Before creating new code PRs, agents must check open PRs:

1. If a PR is narrow, mergeable, non-draft, green/skipped, Netlify-ready/success and clean in changed files, it may be merged.
2. If a PR is red, fix only from logs and only inside the exact PR scope.
3. If a PR is broad, stale, stacked, not mergeable or mixed-scope, do not force it into main. Split the surviving value into smaller PRs.
4. Codex review quota exhaustion alone is not a blocker. Use Actions, changed files, Netlify, issue gates and source-of-truth files.
5. Vercel and Deno deprecated external deploy statuses are non-blocking unless GitHub branch protection rejects merge.

## Small PR split plan

### PR A — seller cabinet first-screen reality pass

Type: UI

Allowed scope:
- exact seller cabinet files only;
- exact seller shell/CSS files only if needed for mobile/shell layout;
- tests limited to seller cabinet and guard copy.

Acceptance:
- first screen states what happened;
- blocker is explicit;
- money at risk is explicit;
- responsible party is explicit;
- next safe action is route-backed, section-backed or honestly disabled with reason;
- no fake live-bank/live-payment claims;
- no backend, DB, auth, API, package or lockfile edits.

### PR B — buyer cabinet exposure pass

Type: UI

Allowed scope:
- exact buyer cabinet files;
- tests limited to buyer first screen and copy guards.

Acceptance:
- buyer sees deal exposure, document risk and next action above the fold;
- buyer is not encouraged to enter unrelated role cabinets;
- money language stays basis/review language, not fund-control language.

### PR C — bank review-basis pass

Type: UI / money-copy guard

Allowed scope:
- exact bank cabinet/release-safety/readiness files;
- copy guard tests.

Acceptance:
- bank sees evidence basis, blockers, responsible party and next review action;
- platform never claims it releases real money;
- missing external adapter states are shown as pre-integration/pending, not live.

### PR D — runtime state-machine design

Type: runtime/docs first, implementation later

Allowed scope for first PR:
- docs/platform-v7/runtime/** or equivalent architecture document.

Acceptance:
- define deal states, transitions, idempotency keys, event journal, action receipts and concurrency risks;
- no UI claims changed;
- no implementation hidden inside docs PR.

### PR E — data persistence design

Type: data/docs first, implementation later

Allowed scope for first PR:
- docs/platform-v7/data/** or equivalent architecture document.

Acceptance:
- define durable entities for organizations, users, roles, lots, bids, deals, documents, logistics, quality, payments, disputes, evidence and audit;
- define migration and rollback boundaries;
- no package/lockfile edits unless a later explicit implementation PR requires them.

### PR F — access enforcement plan

Type: access/docs first, implementation later

Acceptance:
- distinguish report-only RBAC from blocking enforcement;
- define trusted session source, organization isolation and denied-action logging;
- avoid claiming server-side enforcement is complete unless tests prove it.

### PR G — operations/load/backup plan

Type: ops/load/docs first

Acceptance:
- define load targets, latency budgets, monitoring, logs, alerts, rollback, backup and restore;
- no deploy config mutation unless in a separate ops PR.

## Review gate checklist

Every PR must state:
- type: UI/data/runtime/access/money/documents/integration/load/ops/QA/docs;
- linked issue;
- exact changed-file scope;
- forbidden files not touched: apps/landing, backend, DB, auth, session, API, packages and lockfiles unless explicitly scoped;
- current status remains controlled-pilot/pre-integration;
- Netlify is the active frontend gate.

## Next autonomous action

If no clean mergeable PR exists, continue with **PR A: seller cabinet first-screen reality pass** from #1976, using #1981 acceptance criteria and keeping runtime/data/access work separate under #1982.
