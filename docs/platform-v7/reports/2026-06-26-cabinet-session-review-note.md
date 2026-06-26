# Review note

This branch intentionally keeps the change narrow.

Reviewer focus:
- verify that direct `body.role` cabinet issuance is not allowed in production-like mode;
- verify that controlled-pilot/demo environments can still opt in explicitly;
- verify no shell, role cockpit, mobile UI, landing, package or lockfile changes are present.

Follow-up PRs must handle backend login wiring, durable auth/session, register role hardening and server RBAC enforce.
