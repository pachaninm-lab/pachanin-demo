# TAI Agro OS v5.0 — Capability Matrix (re-attested)

Baseline SHA: `58986be7ec0aa21bb56623f1c389d8d0889db7e1`
Date: 2026-08-08

Status vocabulary is restricted to the v5.0 set: `NOT_IMPLEMENTED`, `PARTIAL`,
`IMPLEMENTED_NOT_ACCEPTED`, `PRODUCTION_ACCEPTED`, `BLOCKED`.

**No row in this matrix is `PRODUCTION_ACCEPTED`.** This environment has no REG.RU access, no
model host, and no evidence store, so no live acceptance could be produced. `IMPLEMENTED_NOT_ACCEPTED`
means code exists and local tests pass; it does not mean deployed.

`NOT_VERIFIED` in the Evidence column means the capability was not examined in depth during
Stage 0 — it is neither a pass nor a fail, and it must be attested before its contour starts.

---

## P0-A — Streaming, latency, observability

| Capability | Code | Test | Production evidence | Status | Gap |
|---|---|---|---|---|---|
| SSE transport with typed events | `ai-assistant-stream.contract.ts` (464 L) | contract spec 371 L, passing | none | `IMPLEMENTED_NOT_ACCEPTED` | Not deployed/attested at this SHA |
| Closed event vocabulary + forbidden write keys | same | same | none | `IMPLEMENTED_NOT_ACCEPTED` | — |
| Client cancel → BFF abort | `agro-chat/route.ts:229-241` | partial | none | `PARTIAL` | Abort reaches BFF+internal fetch; provider-side slot release unverified (no provider streaming to cancel) |
| **Token streaming from Qwen during inference** | `stream: false` at 2 call sites | — | none | **`NOT_IMPLEMENTED`** | Blocking completion, then 400-char slicing. Prohibition #3 violated. See TA-2 |
| Bounded semantic/safety buffer over live stream | absent | — | none | `NOT_IMPLEMENTED` | Redaction currently runs on the complete answer, not on chunk boundaries |
| Per-request metrics (TTFT, prefill, queue_wait, tok/s, traceId) | absent (0 files match) | — | none | `NOT_IMPLEMENTED` | Blocks baseline capture entirely |
| Baseline (30 reps × RU/EN/ZH, cold+warm) | — | — | none | `BLOCKED` | External: needs model host + instrumentation |
| p50 first-useful-text ≥70% better | — | — | none | `BLOCKED` | Unachievable until streaming exists; must not be claimed |

## P0-B — Conversation context, state, topic segments

| Capability | Code | Test | Production evidence | Status | Gap |
|---|---|---|---|---|---|
| **Budget priority keeps newest turns** | fixed at 3 sites this branch | 2 new tests + 31/31 suite | none | `IMPLEMENTED_NOT_ACCEPTED` | Needs live acceptance |
| Secret screening across full history window | strengthened with the above | covered by suite | none | `IMPLEMENTED_NOT_ACCEPTED` | — |
| Token-accurate budgeting (model tokens, reserved system/grounding/completion) | char-count only | — | none | `PARTIAL` | Budget is characters, not model tokens; no reservation split |
| Versioned typed `ConversationState` | **absent** | — | none | `NOT_IMPLEMENTED` | Entire §3.2 field set missing |
| Summary / topic segments / topic-shift detection | absent | — | none | `NOT_IMPLEMENTED` | §3.3 |
| New-conversation state isolation (server-side) | client-side array clear only | — | none | `PARTIAL` | No server-side proof that summary/references/object context are dropped |
| Multi-turn regression corpus (several thousand cases) | 338-line fixture | — | none | `NOT_IMPLEMENTED` | §3.4; ~3 orders of magnitude short |

## P0-C — Always-on core, load, recovery

| Capability | Status | Note |
|---|---|---|
| Private-network-only model host, no browser listener | `NOT_VERIFIED` | SSRF guards + private-host checks exist in `restricted-public-qwen.service.ts:535-545`; runtime topology not verifiable here |
| Supervisor, warm-up, readiness/liveness, drain | `NOT_VERIFIED` | Infra-side; requires REG.RU access |
| Bounded admission/queue, backpressure | `NOT_VERIFIED` | Keyword matches exist repo-wide; no TAI-specific admission path confirmed |
| Load matrix 1/5/10/25/50 → saturation | `BLOCKED` | External: no model host. **Numerical capacity must not be stated before measurement** |
| Fault/recovery matrix | `BLOCKED` | External |

## P1–P9 — Product contours

| Contour | Status | Basis |
|---|---|---|
| P1 Unified Agro Knowledge Core (ontology, source registry, provenance, hybrid retrieval, rerank, abstention) | `NOT_VERIFIED` → presumed `PARTIAL` at best | A public KB + grounding envelope exists; no evidence of source registry, authority/freshness weighting, rerank, or source→document→page→table→cell provenance |
| P2 Crop + deterministic calculators | `PARTIAL` | **5** calculators on main; +12 in unmerged #3623. Decimal discipline is correct where present |
| P3 TAI Expert / documents / OCR | `NOT_VERIFIED` | #3598 would enforce acceptance; implementation depth unconfirmed |
| P4 Livestock | `NOT_VERIFIED` | Keyword presence only |
| P5 Machinery | `NOT_VERIFIED` | Keyword presence only |
| P6 Trade / Deal-aware | `NOT_VERIFIED` | Large deal/lot codebase exists; TAI-side read-only deal awareness unattested |
| P7 Enterprise / Connect | `NOT_VERIFIED` | Connector-shaped code exists; **no integration may be called LIVE** without separate acceptance |
| P8 Event agents | `NOT_VERIFIED` | Outbox/idempotency primitives exist platform-wide; TAI agent contour unattested |
| P9 Commercial contour | `NOT_VERIFIED` | Billing must not be enabled without a separate owner decision |

## Cross-cutting

| Capability | Status | Note |
|---|---|---|
| Public/private contour separation | `PARTIAL` | `rejectPrivateShape()` + `PRIVATE_IDENTITY_KEYS` + private-source path rejection are real and well-constructed; end-to-end tenant isolation unattested at this SHA |
| Read-only tool authority | `PARTIAL` | `apps/api/src/modules/tai-tools/` has an assertion guard; provenance+audit per tool call unverified |
| No model write authority | `IMPLEMENTED_NOT_ACCEPTED` | `FORBIDDEN_ACTION_KEYS` in the contract + write-claim refusal in the service |
| Secret redaction in answers | `IMPLEMENTED_NOT_ACCEPTED` | `SECRET_PATTERN` refusal path, tested |
| RU/EN/ZH parity | `PARTIAL` | Three locales are threaded through prompts and copy; no complete tri-lingual regression gate |
| Mobile 320/390/430 | `NOT_VERIFIED` | Live-acceptance script targets 390×844 only |
| 45 000 accepted scenarios | `NOT_IMPLEMENTED` | Present corpus is ~338 lines of fixtures. **The figure 45 000 must not be cited in any form until the corpus exists and is scored** |
| Exact-main deployed on REG.RU | `BLOCKED` | External: no access from this environment |

---

## Attestation

Of the twelve Definition-of-Done conditions in v5.0 §10, **zero** are currently satisfiable
with evidence. The two P0 blockers that gate everything downstream are:

1. **TA-2** — Qwen is not streamed; the answer is completed then sliced.
2. **TA-5** — no TTFT/latency instrumentation, so no baseline can be captured.

Neither can be closed without the model host. Both are code-side prerequisites that *can* be
built before the host is available, and that is the correct next order of work.
