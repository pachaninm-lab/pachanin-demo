# Next risk

After this branch, the next unresolved auth/session risk is backend-owned membership.

Current branch reduces one unsafe boundary but does not complete:
- durable auth sessions;
- backend login wiring from web;
- organization membership approval;
- role assignment lifecycle;
- server cabinet RBAC enforce.

Next code PR should harden backend register role assignment or wire backend-auth login behind a feature flag.
