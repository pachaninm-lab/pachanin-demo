# platform-v7 scope guard for cabinet PRs

Linked issues: #1974 #1984 #1981 #1976 #1978 #1979

## Allowed for UI cabinet PRs

- Exact role-cabinet component/page files.
- Exact shared shell/CSS files only when the linked issue calls for shell or mobile layout.
- Documentation that records state or gate decisions.

## Disallowed without explicit separate runtime PR

- `apps/landing/**`
- Backend, DB, auth, session and API files.
- Package manifests and lockfiles.
- Broad rewrites under all of `apps/web/app/platform-v7`.
- Claims that current system is production/live-ready.

## Cabinet acceptance standard

Each cabinet first screen must answer:

1. what happened;
2. what is blocked;
3. money at risk;
4. responsible party;
5. next action.

Each CTA must be real: route, section, local safe action, or disabled state with a reason.

## Runtime separation

Persistent data, server-side roles, deal runtime, evidence workflow, money ledger, external adapters, load readiness, monitoring, backup and operational controls belong to separate #1982 PRs.