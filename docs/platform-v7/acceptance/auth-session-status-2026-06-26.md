# Auth session status

Date: 2026-06-26

Status: partial.

Covered in this branch:
- direct body-role cabinet session issuance is no longer unconditional;
- verified backend access token role is preferred when available;
- production-like mode can reject body-role issuance without verified backend role;
- static unit coverage records the boundary.

Still missing:
- web login is not yet fully wired to backend auth;
- backend auth still has demo and in-memory users/refresh tokens in current main;
- backend register still needs privileged role assignment hardening;
- durable session revoke is not closed;
- server cabinet RBAC is not enforce yet.

Readiness remains 72%.
