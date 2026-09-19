# platform-v7 next PR breakdown

Linked issues: #1974 #1984 #1982 #1981 #1976 #1978 #1979

## Rule

Split broad work. Do not pause platform-v7 execution because the target architecture is large.

## PR A — seller cabinet functional pass

Type: UI

Allowed scope:

- exact seller cabinet files only;
- docs only if needed to record state.

Acceptance:

- first screen states what happened;
- first screen states what is blocked;
- first screen states money at risk;
- first screen states responsible party;
- first screen gives one next action;
- CTAs point to existing route/action/section or have safe disabled state;
- mobile shell remains stable;
- no unsupported live-readiness claim.

Blocked files:

- `apps/landing/**`;
- backend/DB/auth/session/API files;
- package and lockfiles.

## PR B — buyer cabinet functional pass

Type: UI

Same acceptance as seller pass. Exact buyer cabinet files only.

## PR C — bank cabinet functional pass

Type: UI

Same acceptance as seller pass. Exact bank cabinet files only.

## PR D — operator/executive cabinet functional pass

Type: UI

Same acceptance as seller pass. Exact operator/executive files only.

## PR E — compliance cabinet functional pass

Type: UI

Same acceptance as seller pass. Exact compliance files only.

## Runtime PR lanes under #1982

These must not be hidden inside UI PRs:

1. Persistent deal state.
2. Server-side roles and organization isolation.
3. Deal state machine and action journal.
4. Document/evidence workflow.
5. Money ledger and bank reconciliation basis.
6. External adapter modes.
7. Load readiness.
8. Monitoring, logs, alerts, rollback and backup.

## Merge gate

Merge only when:

- GitHub checks are green or skipped;
- Netlify relevant status is ready/success;
- PR is mergeable;
- changed files pass #1978;
- smoke checklist #1979 remains satisfied.