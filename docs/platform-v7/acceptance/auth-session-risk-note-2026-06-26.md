# Auth session risk note

Date: 2026-06-26

This branch is the first narrow hardening step for cabinet session issuance.

Known risk:
- if a deployed environment relies on direct body-role session issuance, it must explicitly opt into the controlled-pilot body-role boundary;
- otherwise production-like mode requires a verified backend role.

Reason:
- a browser-posted role must not be treated as the default trusted source for cabinet access.

Next layer:
- wire web login to backend auth and durable membership;
- then move server cabinet RBAC from report-only to enforce.
