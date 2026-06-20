# SR-5 — Redis: Rate-Limit + WebSocket Adapter Plan (platform-v7)

Status: **controlled-pilot / pre-integration · docs-only plan · NO runtime
change**. This plan prepares a Redis layer (shared cache, rate limiting,
distributed locks, websocket pub/sub) for future horizontal scaling of
`apps/api`, following `SCALE_READINESS_100K.md` (SR-5). It changes no runtime
code, no API behavior, **adds no dependencies**, touches no package/lockfile, no
Prisma schema, runs no migration, activates no DB-backed adapter, changes no
money path, no UI / landing, no live integration.

Honest framing (do not overstate):
- This is a **plan**, not an implementation. There is **no Redis**, **no rate
  limiting**, and **no websocket gateway** today — see §1 and §8.
- No `rate limited`, `DDoS protected`, `Redis-backed`, or `horizontally
  scalable websockets` claims.

---

## 1. Current honest status (from repo facts)

- **No Redis.** No `ioredis`/`redis` dependency and no Redis usage anywhere in
  `apps/api/src`. There is no shared cache, no distributed lock, no token bucket.
- **No rate limiting.** No `@nestjs/throttler`, no `Throttle` decorator, no
  gateway/middleware limiting requests — a single hot tenant can exhaust the
  single process.
- **WebSockets present but unwired.** `@nestjs/websockets`,
  `@nestjs/platform-socket.io`, `socket.io` are dependencies, but there is **no
  `WebSocketGateway` / `@WebSocketServer` / `SubscribeMessage`** in `src` and no
  WS adapter wired in `main.ts`. Realtime is dependency-only today.
- **Single process.** `app.listen(port)` only; any in-process realtime/cache/lock
  would not survive a second instance (see SR-1 §3).

**Net:** the Redis layer is entirely absent; the websocket packages are present
but not used; nothing throttles traffic. Correct for a single-node pilot; **not**
ready for multi-instance scale or abuse protection.

---

## 2. What is missing (gap list)

| Capability | Present today |
|---|---|
| Shared cache (Redis) | ❌ none |
| Rate limiting / throttling | ❌ none |
| Per-tenant / per-role quotas | ❌ none |
| Distributed locks (money critical sections, outbox dispatcher) | ❌ none (SR-2 §10, SR-4 §3 depend on this) |
| WebSocket Redis pub/sub adapter | ❌ socket.io unwired |
| Horizontal websocket fan-out (sticky/routing) | ❌ none |
| Ephemeral coordination (leader/lease) | ❌ none |
| `429` semantics + rate-limit headers | ❌ none |

---

## 3. Target Redis architecture

- **Managed Redis** (cluster in real envs; local docker for sandbox). One logical
  Redis used for several concerns, namespaced by key prefix:
  - **Cache** — read-through cache for hot, non-authoritative reads (e.g. deal
    cards, catalogs) with short TTLs; never the source of truth for money.
  - **Rate limiting** — token-bucket / sliding-window counters per key (§4).
  - **Distributed locks** — `SET NX PX` (or Redlock) for money critical sections
    and the outbox dispatcher (replaces the Postgres advisory lock option in
    SR-2 §10 / SR-4 §3 when multi-instance).
  - **WebSocket pub/sub** — socket.io Redis adapter for cross-instance fan-out
    (§5).
  - **Ephemeral coordination** — leader election / leases for singleton workers.
- **Behind a flag.** A `REDIS_URL` + feature flag enables the Redis path; the
  default stays in-memory/no-throttle so behavior is unchanged until activated.
- **No PII/secrets in Redis**; money state never lives in Redis (Postgres is the
  source of truth — SR-2).

Adding the Redis client is a **dependency change** and therefore a separate,
gated PR (SR5-B) — **not** part of this docs PR.

---

## 4. Rate-limit design

- **Keying**: limits are applied per `(tenant/orgId, role, route-class)` so one
  tenant cannot starve others; anonymous/auth endpoints keyed by IP.
- **Tiers** (illustrative, tuned later):
  - **Auth endpoints** — strict (e.g. login attempts) to blunt credential
    stuffing; failures feed the SR-3 `auth_failure_total` metric.
  - **Money actions** (reserve/release/adjust/callback) — **stricter** per-deal /
    per-actor limits; combined with the money idempotency keys (SR-4 §4) so a
    burst cannot create duplicate intents.
  - **Read/list endpoints** — generous.
- **Algorithm**: sliding-window or token bucket in Redis (atomic via Lua), so the
  limit is shared across instances.
- **Semantics**: over-limit returns **HTTP 429** with `Retry-After` and
  `RateLimit-Limit/Remaining/Reset` headers; never silently drops; money actions
  prefer 429 + retry over partial application.
- **Fallback**: when Redis is disabled (default), the limiter is a no-op or a
  per-process in-memory bucket — documented as **not** a real shared limit.

---

## 5. WebSocket adapter design

- **Gateway** (later): a `WebSocketGateway` for realtime deal/shipment/money
  updates, **authenticated on connect** (JWT), with rooms scoped by
  `orgId`/`role` so a client only receives events for its own tenant.
- **Redis adapter**: socket.io `@socket.io/redis-adapter` so events published on
  one instance fan out to clients connected to any instance — the prerequisite
  for horizontal websocket scale.
- **Routing**: sticky sessions (LB) or a stateless token handshake; documented as
  a deploy requirement before multi-instance realtime.
- **Backpressure**: per-connection send limits and room-size caps to protect the
  tier; disconnect on auth expiry.
- **No money authority over WS**: websockets are notification-only; the canonical
  state stays in the HTTP/DB path (no money mutation via socket events).

---

## 6. Phased PR plan (each gated; none started here)

1. **SR5-A (docs)** — this plan + the rate-limit/key/header **contract** and the
   websocket room/auth contract. *(this PR)*
2. **SR5-B (deps/config, flagged)** — add the Redis client + `REDIS_URL` config +
   docker-compose Redis for sandbox; **flag off by default**, no behavior change.
   (Dependency change — separate approval.)
3. **SR5-C** — rate-limit middleware/guard behind the flag (in-memory no-op
   default); `429` + headers; tiers from §4; metrics (SR-3).
4. **SR5-D** — websocket gateway + Redis adapter behind the flag; auth-on-connect;
   org/role rooms.
5. **SR5-E** — Redis distributed locks wired into the money critical section and
   the outbox dispatcher (**money-path gated** — money §8 gate + SR-4).

All money-effecting changes remain behind the money gate; SR-5 ships only A here.

---

## 7. Acceptance criteria (per phase)

- **SR5-B**: app builds/boots unchanged with the flag off; Redis sandbox spins up;
  with the flag on, a Redis health check passes. No behavior change when off.
- **SR5-C**: over-limit returns `429` with correct headers; limits are shared
  across two instances pointing at the same Redis; money-action limits enforced;
  existing specs green with the flag off.
- **SR5-D**: an event published on instance A reaches a client on instance B;
  clients only receive their org/role rooms; unauthenticated connect rejected.
- **SR5-E**: concurrent money critical sections serialize via the lock; the outbox
  dispatcher processes each entry once across instances (ties SR-4 §3).

---

## 8. Risk register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| New dependency (Redis client) scope creep | med | med | isolated to SR5-B, flagged, separate approval |
| Rate limit blocks legitimate money retries | med | high | money idempotency (SR-4) so retries are safe; 429 + Retry-After, generous money retry budget |
| Redis outage degrades the app | med | high | fail-open for reads/limits, fail-safe (block) for money locks; documented degraded mode |
| WS auth/room leak (cross-tenant events) | low | high | auth-on-connect + org/role rooms + tests |
| Lock not released (deadlock) | low | high | TTL on locks (`PX`), idempotent critical sections |
| Treating Redis as source of truth for money | low | high | Postgres is SoT; Redis is cache/coordination only |

---

## 9. Honesty gate

Until the phases land and are tested, do **not** claim:
- "rate limited" / "DDoS protected" / "abuse protected";
- "Redis-backed" / "distributed cache" / "distributed locks";
- "horizontally scalable websockets" / "realtime at scale" / "multi-instance";
- "high availability".

Allowed framing: *controlled-pilot, single-node; no Redis, no rate limiting,
websocket packages present but unwired; Redis cache/limits/locks/ws-adapter are
planned, not implemented; money-path locks remain gated.*

This document implements none of the above. It is a plan and a contract.
