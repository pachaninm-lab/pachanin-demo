# TAI internal Safe Tool gateway

This module exposes only request-bound, non-authoritative TAI tools under:

`POST /api/internal/tai/tools/:toolName`

The route bypasses user bearer authentication only so the dedicated `TaiToolAssertionGuard` can authenticate the TAI service assertion. Every request must carry:

- `X-TAI-Tool-Assertion`;
- `X-TAI-Tool-Signature`;
- `X-Idempotency-Key`.

The assertion is HMAC-bound to the exact method, canonical route, JSON body, tool name and mode, user, tenant, session, trace, call and idempotency key, with a maximum 30-second TTL.

Registered tools:

- `getDealSummary` — read-only;
- `getRoleNextActions` — read-only;
- `prepareCommandDraft` — draft only.

The gateway re-resolves the caller's current PostgreSQL membership and active `DealParticipant` before returning any deal data. It never accepts role or organization authority from the model. `prepareCommandDraft` does not execute a command and cannot mutate the deal.
