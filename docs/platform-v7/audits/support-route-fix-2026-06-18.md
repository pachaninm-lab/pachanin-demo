# Support route fix — 2026-06-18

Scope: platform-v7 shell polish.

Fix:

- header help icon no longer points to a missing `/platform-v7/support` route;
- header help icon now points to existing shared `/platform-v7/status?role=<role>`;
- static gate checks that the missing support route is not reintroduced.

Status remains controlled-pilot / pre-integration.
