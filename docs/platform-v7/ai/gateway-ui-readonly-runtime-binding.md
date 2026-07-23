# TAI AP-17 — Gateway/UI read-only runtime binding

Status: `IMPLEMENTED_IN_DRAFT_PR`
Production status: `NOT_ACTIVATED`
Attestation status: `NOT_ATTESTED`

This document defines the fail-closed boundary between the public/private assistant UI and an admitted local TAI runtime. It does not attest model quality, deployment, production availability or REG.RU live smoke.

## 1. Authority boundary

- Public UI has no user, tenant, membership, Deal or cabinet access.
- Private identity, tenant, organization, membership, role and Deal visibility are resolved only by the authenticated API.
- Browser-provided locale, page path, Deal identifier and history are untrusted hints.
- Every response is `mode=read_only` and `actionAllowed=false`.
- No write tool, confirmation flow, payment, signature, auction, quality, dispute or document mutation is exposed.

## 2. Activation gate

Production traffic is permitted only when all of the following server-side values are present and exact:

- `AI_ASSISTANT_RUNTIME_MODE=admitted-read-only`
- `AI_ASSISTANT_READINESS_URL`
- `AI_ASSISTANT_BASE_URL`
- `AI_ASSISTANT_MODEL`
- `AI_ASSISTANT_ALLOWED_HOSTS`
- `AI_ASSISTANT_EXPECTED_MODEL_ID`
- `AI_ASSISTANT_EXPECTED_MODEL_SHA256`
- `AI_ASSISTANT_EXPECTED_RUNTIME_ID`
- `AI_ASSISTANT_EXPECTED_RUNTIME_DIGEST`
- `AI_ASSISTANT_EXPECTED_ADMISSION_SHA256`

Optional protected values:

- `AI_ASSISTANT_READINESS_TOKEN`
- `AI_ASSISTANT_API_KEY`
- `AI_ASSISTANT_READINESS_TIMEOUT_MS`
- `AI_ASSISTANT_READINESS_MAX_AGE_SECONDS`

The readiness payload must match `tai.read-only-runtime-readiness.v1`, be fresh, unexpired, `READY`, `read_only`, `actionAllowed=false`, and `READ_ONLY_ADMITTED`. Any mismatch returns unavailable and leaves UI input disabled.

## 3. Stream contract

Both assistants consume `tai.ai-assistant.stream.v1` through the strict browser parser:

1. `meta`
2. one or more `token`
3. `citations`
4. `decision`
5. `done`

The parser rejects:

- non-SSE content types;
- missing, duplicate or out-of-order sequence numbers;
- request/correlation changes;
- write capability;
- malformed citations or unsafe paths;
- missing confidence/freshness;
- final answer, citations or decision that differ from streamed data.

## 4. No-fallback rule

When admitted runtime mode is selected:

- public POST never returns a bundled static answer;
- private runtime responses cannot use the deterministic provider;
- JSON/network fallback cannot masquerade as SSE because the parser requires `text/event-stream`;
- runtime/provider failure returns a retryable unavailable state;
- no synthetic or mock response is presented as live AI.

The public knowledge registry remains grounding input and catalog metadata only.

## 5. User experience

Public and private surfaces provide:

- progressive rendering;
- cancel and retry;
- citations;
- confidence and freshness;
- abstention/error state;
- limitations;
- RU/EN/ZH copy;
- keyboard escape/focus handling;
- mobile layout and reduced-motion handling.

Private inputs and starter prompts remain disabled until authenticated readiness is `READY`.

## 6. Exact-head acceptance

Required before review-ready:

- workflow `TAI Gateway UI Read-only Binding` PASS on the exact PR head;
- API and web TypeScript PASS;
- focused API contract tests PASS;
- public/private browser contract tests PASS;
- governed path audit PASS;
- static no-fallback audit PASS;
- repository security/runtime/design gates PASS;
- zero open P1/P2 review threads.

A green PR still does not prove model execution, deployment or production traffic.

## 7. Activation sequence

1. Merge only after coordinator verifies exact-head PASS.
2. Deploy runtime separately with immutable model/runtime/admission identities.
3. Configure server-only variables with those exact identities.
4. Verify readiness from the application host without exposing secrets to the browser.
5. Run authenticated private and unauthenticated public RU/EN/ZH smoke.
6. Verify citations, confidence, abstention, cancel, timeout and tenant isolation.
7. Enable production routing only after exact-revision REG.RU evidence is stored.

## 8. Rollback

Immediate rollback is server-side:

1. Set `AI_ASSISTANT_RUNTIME_MODE` to a value other than `admitted-read-only`, or remove the readiness/provider variables.
2. Restart the application workload.
3. Confirm public POST returns unavailable and private UI reports runtime unavailable.
4. Confirm no static answer, deterministic provider or write path activates.
5. Preserve correlation-safe logs and exact revision metadata for incident review.

Rollback does not require changing user, role, Deal or financial data.
