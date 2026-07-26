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
- `getDealRisks` — read-only;
- `getDocumentStatus` — read-only, optional `documentId`;
- `getLogisticsStatus` — read-only, optional `shipmentId`;
- `getLaboratoryStatus` — read-only, optional `sampleId`;
- `getMoneyReadiness` — read-only;
- `getDisputeStatus` — read-only, optional `disputeId`;
- `getEvidenceTimeline` — read-only;
- `getIntegrationStatus` — read-only.

Every tool the service exposes is `READ_ONLY`, and `TaiToolMode` has no other member. Owner decision of 26.07.2026 makes TAI informational for this industrial release: it explains, shows evidence and recommends, and the person carries out every platform action by hand. `prepareCommandDraft` was removed rather than left in place unused — it returned a ready-to-POST command envelope with an endpoint, a command id and an idempotency key, which is a prepared platform command whether or not anything sent it.

Nine of the ten read tools are projections of the same `workspace(dealId, user)` call, so they all pass through one membership and RLS check and none of them widens what the caller could already read. The optional identifier narrows the returned collection; an identifier belonging to another deal simply yields an empty projection, because the workspace never contained it.

`getEvidenceTimeline` returns at most the 100 most recent events with `eventCount`, `returnedCount` and `truncated`, so a long-running deal stays within the adapter's response budget instead of being refused wholesale.

`getIntegrationStatus` is the exception: outbox delivery state is not in the workspace projection, and widening that projection would change what every existing deal endpoint returns, so it has its own read on the same authority. `IndustrialDealCommandGateway.integrationStatus` resolves membership first and then queries inside the trusted RLS context, exactly like the workspace path.

What it returns is delivery metadata only. The select list is a whitelist: `payload`, `lastError`, the lease columns, `idempotencyKey` and `triggeredByUserId` are never read, because none of them is delivery state and all of them would end up in an answer a model relays. The entry list is capped at the 100 most recent rows with `returnedCount` and `truncated`, while `countsByStatus` and `deadLetterCount` are aggregated across the whole deal — a deal whose dead letters are older than its hundred most recent rows must not report zero of them.

The gateway re-resolves the caller's current PostgreSQL membership and active `DealParticipant` before returning any deal data. It never accepts role or organization authority from the model. No route through this service can create, prepare or execute a platform command, and no user confirmation changes that: confirmation is not consulted anywhere on the path, because under the owner decision a confirmed action is still an action the person performs, not one TAI performs.
