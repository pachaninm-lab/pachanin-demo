# TAI Agro OS v4 — Stage 1 Always-On Core

**Implementation baseline:** `0fd66be4bb758ed4c986a028c8c26890fd28ec41`  
**Infrastructure:** existing REG.RU only  
**New recurring cost:** 0 RUB  
**Authority:** informational/read-only; no new platform, financial or veterinary write authority

## Implemented in this slice

- bounded FIFO admission before `/v1/platform/answer`;
- explicit maximum in-flight requests and bounded wait queue;
- fail-closed overload response with `Retry-After`;
- queue timeout and cancellation cleanup without leaked permits;
- local-model warm-up on application startup;
- periodic local inference health probe;
- consecutive-failure tracking;
- circuit opening after a configured failure threshold;
- automatic probe and recovery after circuit cooldown;
- durable health publication through `tai_local_model_health`;
- pressure, warm-up, failure and repository-write counters;
- hidden `/health/runtime` operational endpoint;
- focused deterministic tests for FIFO, rejection, timeout, warm-up, circuit recovery and repository failure.

## Production variables

All values are optional and have bounded defaults. Invalid values fail production composition closed.

```text
TAI_MODEL_MAX_QUEUE=16
TAI_MODEL_QUEUE_TIMEOUT_SECONDS=10
TAI_MODEL_SUPERVISOR_INTERVAL_SECONDS=30
TAI_MODEL_WARMUP_TIMEOUT_SECONDS=15
TAI_MODEL_CIRCUIT_FAILURE_THRESHOLD=3
TAI_MODEL_CIRCUIT_OPEN_SECONDS=30
TAI_MODEL_LATENCY_WINDOW=50
```

`TAI_MODEL_MAX_INFLIGHT` remains the single configured model concurrency authority already defined by the production runtime. Stage 1 reuses it; it does not introduce a competing concurrency value.

## Runtime behavior

1. A request to `/v1/platform/answer` first enters the bounded FIFO gate.
2. When all safe slots are occupied, the request waits only inside the configured queue budget.
3. When the queue is full or the wait budget expires, TAI returns a retryable generic 503 without exposing model, host, circuit or infrastructure internals.
4. At startup and periodically while idle, the supervisor sends a minimal deterministic inference request to the approved local endpoint.
5. Results update durable model health, including status, slots, queue depth, p95 probe latency and circuit deadline.
6. Repeated failures open the circuit. No probe is sent until cooldown expires. The next successful probe restores `READY` automatically.
7. Warm-up is skipped while real requests are active or queued, so the health probe does not compete with user work.

## Security and truthfulness boundaries

- Endpoint policy remains local/private-network only.
- Browser traffic never calls the model host directly.
- No tenant, role or membership is accepted from the client.
- No write tool is enabled.
- Health output contains counters and status only; it contains no endpoint, model secret, prompt, tenant or user data.
- This slice does not change model admission, artifact digest, licence or benchmark authority.

## Not accepted yet

This implementation is not a Stage 1 production PASS by itself. The following remain separately required:

- full repository checks on the exact head;
- exact-head merge into current main;
- exact-main REG.RU deployment;
- live startup warm-up evidence against the real Qwen3-8B service;
- load, overload, fault, recovery, backlog and soak evidence;
- process restart and rollback evidence;
- multi-process/distributed admission authority;
- HA/DR acceptance;
- true token streaming acceptance for the canonical TAI runtime;
- RU/EN/ZH and mobile live acceptance.

No production or Always-On completion claim is allowed until those checks are attached to the exact deployed main SHA.
