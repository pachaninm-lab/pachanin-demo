# TAI Agro OS v5.0 — Architecture and Trust Boundaries

Baseline SHA: `58986be7ec0aa21bb56623f1c389d8d0889db7e1`
Date: 2026-08-08

Describes the boundaries **as they exist in code today**, separating what is enforced from what
is merely intended. Aspirational boundaries are marked; they are the dangerous ones.

---

## 1. Request path (public contour, as built)

```
Browser (PublicPlatformAssistant.tsx)
  │  POST /api/public-platform-assistant?stream=1     Accept: text/event-stream
  ▼
Next.js BFF route  (agro-chat / restricted-public-platform-assistant)
  │  · parses + normalises envelope (question, locale, history)
  │  · resolves grounding from the public knowledge base
  │  · classifies answer mode: verified_platform | general_agro
  │  · HMAC-signs the internal payload
  ▼
NestJS API  (RestrictedPublicQwenService)
  │  · rejectPrivateShape() on the whole request tree
  │  · normalise + screen history, build messages
  │  · SSRF/protocol/host guards on the model URL
  ▼
Qwen3-8B Q4_K_M via llama.cpp, OpenAI-compatible /v1/chat/completions
  │  ⚠ stream: false — the complete answer is awaited here
  ▼
API applies safety: write-claim refusal, secret refusal, grounding enforcement,
current-evidence boundary, link stripping
  ▼
BFF slices the finished answer into 400-char frames and emits SSE
  ▼
Browser renders frames progressively
```

**The boundary that is not where it looks.** Progressive rendering happens in the browser, but
the token boundary is a string slice in the BFF, not model output. Everything downstream of
the model call operates on a complete answer. This is the single most important architectural
fact in this document: the system is request/response wearing a streaming coat.

---

## 2. Enforced boundaries (verified in code)

| Boundary | Mechanism | Location |
|---|---|---|
| Browser cannot assert identity | Public contour accepts no tenant/role/subject/deal at all | `rejectPrivateShape()`, `restricted-public-qwen.service.ts:294` |
| Private keys cannot cross into public | `PRIVATE_KEY_PATTERN` rejects `*Id/*Key/*Secret/*Token/*Data/*State` for user, tenant, org, membership, role, staff, deal, document, payment, bank, lab, logistics, dispute, integration | same file, line 68 |
| Public citations cannot point at private routes | `PRIVATE_PUBLIC_SOURCE` rejects `/platform-v7/{deals,staff,admin,operator,buyer,seller,bank,logistics,driver,elevator,laboratory,surveyor,compliance,arbitrator,executive}` | line 69 |
| Citations must be platform-relative | `href` must match `^/platform-v7`, no `://`, no `..` | `normalizeSource()` |
| Model cannot claim it acted | `WRITE_CLAIM_PATTERN` (RU/EN/ZH) → request fails closed | line 70 |
| Model cannot leak secrets | `SECRET_PATTERN` (sk-, Bearer, AKIA/ASIA) on answers **and** on every history turn | lines 71, 267 |
| Stream cannot carry write verbs | `FORBIDDEN_ACTION_KEYS` rejected by the frame validator | `ai-assistant-stream.contract.ts:28` |
| Stream cannot carry identity | `PRIVATE_IDENTITY_KEYS` refused in the public contour | same, line 52 |
| Model host is not browser-reachable | Server-to-server only; API key never leaves the API; BFF signs with a separate HMAC secret | `callInternalModel()` |
| Model host SSRF containment | Protocol allow-list; plain HTTP permitted only to private hosts; host allow-list via `AI_ASSISTANT_ALLOWED_HOSTS` | lines 530-545 |
| Internal call integrity | HMAC-SHA256 over `version \| POST \| path \| timestamp \| sha256(body)` | `agro-chat/route.ts:413-418` |
| Feature is fail-closed | Absent `TAI_RESTRICTED_QWEN_PUBLIC_ENABLED=true` → `ServiceUnavailable` | line 89 |
| Bounded inputs | question 1 200 ch; grounding 20 000; response 1 MiB; history 12 turns / 2 000 ch / 12 000 total | lines 8-15 |

These are genuinely good. The public contour is designed so that a browser cannot name a tenant
even if it wants to — authority is absent by construction rather than checked and rejected.

---

## 3. Aspirational or unverified boundaries

| Boundary | Reality |
|---|---|
| Chunk-boundary safety | Redaction runs on the complete answer. With real streaming, a secret or `<think>` block could span two frames and evade a per-frame check. **Must be designed before streaming lands.** |
| Authenticated contour ABAC/RBAC/RLS | A private gateway path exists; server-authoritative object resolution not attested at this SHA |
| Tool provenance + audit per call | `tai-tools` module has an assertion guard; per-call provenance record and audit trail unverified |
| Document provenance source→page→table→cell | Not found |
| Tenant isolation end-to-end | Not attested at this SHA |
| Idempotency for any future write | No write path exists today — correct. Any future write needs action contract + server authz + idempotency key + confirmation + audit + result verification |

---

## 4. Public vs authenticated contour

| | Public TAI | Authenticated TAI |
|---|---|---|
| Allowed | general agro/agribusiness; public platform facts with citations | private object context **after** server authority resolution |
| Forbidden | deals, organisations, user documents, money, membership, private state | cross-tenant/role leakage; browser-selected authority |
| Enforcement today | strong and structural (see §2) | `NOT_VERIFIED` — must be attested before P6 |

---

## 5. Two things to preserve when streaming is implemented

1. **Keep the frame contract.** `ai-assistant-stream.contract.ts` is the one place both producer
   and relay validate against. Do not let a second "almost the same" contract appear — the file's
   own header warns about this, correctly.
2. **Move safety from answer-level to stream-level.** Every check in §2 that currently runs on a
   complete string needs a bounded, UTF-8-safe, cross-chunk equivalent. Streaming without this
   converts a working safety layer into a decorative one.
