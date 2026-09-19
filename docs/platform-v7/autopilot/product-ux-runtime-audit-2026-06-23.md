# platform-v7 product/UX runtime audit checkpoint

Linked issues: #1974 #1984 #1982 #1981 #1976 #1978 #1979

## Current status

platform-v7 remains controlled-pilot / pre-integration. Do not describe it as live-ready or production-ready until the runtime layers in #1982 exist and are verified.

## Audit result

This checkpoint converts the product/UX audit into exact follow-up PR lanes without broadening UI work into backend/runtime scope.

### Source-of-truth constraints

- Netlify is the active frontend hosting gate.
- Vercel and Deno deprecated external statuses are non-blocking unless branch protection rejects merge.
- `apps/landing` must stay untouched.
- Backend, DB, auth, session, API, package and lockfiles must stay untouched inside UI PRs.
- Current maturity language must stay `controlled-pilot / pre-integration`.

## Finding matrix

| Lane | Finding | Risk | Next PR scope |
| --- | --- | --- | --- |
| Shell/routing | Role cabinets must preserve stable shell, header and bottom navigation on mobile. | High | shared shell or exact cabinet shell file only |
| Cabinet first screen | Each role first screen must answer: what happened, what is blocked, money at risk, responsible party, next action. | High | one role cabinet per PR |
| CTA reality | Every main action must route to an existing path, scroll to an existing section, run a local safe action, or be disabled with a reason. | High | exact role file only |
| Status truth | UI/docs must separate current controlled-pilot state from target live-readiness. | Critical | copy/docs only, no runtime claims |
| Runtime readiness | Persistent data, server-side roles, deal runtime, documents/evidence, money ledger, adapters, load, monitoring, backup and ops controls are not UI polish tasks. | Critical | separate #1982 PRs by runtime layer |

## Exact next PR sequence

1. Seller cabinet functional pass under #1976: exact seller cabinet files only.
2. Buyer cabinet first-screen pass: exact buyer cabinet files only.
3. Bank cabinet first-screen pass: exact bank cabinet files only.
4. Operator/executive cabinet first-screen pass: exact role files only.
5. Compliance cabinet first-screen pass: exact role files only.
6. Lab/elevator/field role pass only where exact files exist.
7. Separate #1982 runtime PRs for data, access, deal state, documents, money, integrations, load and ops.

## Review gate

Use #1978 and #1979 for every PR:

- changed files are narrow and allowed;
- no `apps/landing` changes;
- no backend/DB/auth/session/API/package/lockfile drift inside UI PRs;
- Netlify status is success/ready when relevant;
- GitHub Actions are green or intentionally skipped;
- mergeability is clean;
- no fake-live claims.

## Controller decision

No live-readiness claim is allowed from this audit. The next safe execution step is a small seller cabinet PR linked to #1976, unless an already-open clean PR is available for merge.