# TAI Agro OS v5.0 — Stage 0 Truth Audit

Date: 2026-08-08
Auditor: Claude Code, executing the v5.0 Stage 0 mandate ("Truth Audit, обязателен до разработки").
Branch: `claude/tai-agro-os-v5-spec-uhc88f`

This document records only what was verified by reading current source, running tests, and
querying the GitHub API. Where something was not verified, it is marked `NOT_VERIFIED` rather
than assumed. No status in this document may be upgraded without new evidence.

---

## 1. Exact source of truth

| Item | Value | How verified |
|---|---|---|
| Actual `origin/main` HEAD | **`58986be7ec0aa21bb56623f1c389d8d0889db7e1`** | `git fetch origin main && git log -1 origin/main` |
| main commit subject | `FIX: isolate public registration from presentation role` | same |
| main commit date | 2026-08-08 17:46:44 +0300 | same |
| SHA named in the v5.0 specification | `98102961fb78cea1c7d48420da07525401daee24` | specification text |
| Does the specified SHA exist? | Yes — `git cat-file -t` returns `commit` | `git cat-file -t 98102961…` |
| Is the specified SHA current main? | **No.** It is an ancestor superseded by later commits. | `git log -1 origin/main` |
| Working branch position | `claude/tai-agro-os-v5-spec-uhc88f` was created at `58986be7`, 0 commits ahead at audit start | `git rev-list --count origin/main..HEAD` |

**Finding TA-1 (P0).** The specification's stated baseline is stale. The spec itself instructs
"перепроверь перед началом и зафиксируй фактический SHA". The factual baseline for all v5.0
work is `58986be7ec0aa21bb56623f1c389d8d0889db7e1`. Every acceptance claim in this programme
must be bound to that SHA or its successors, never to `98102961`.

---

## 2. Streaming reality (P0-A)

The specification's prohibition #3 forbids simulated streaming: tokens must arrive from Qwen
*during* inference, not after a complete answer exists.

### 2.1 What the code actually does

| Layer | File | Behaviour | Verdict |
|---|---|---|---|
| Model request | `apps/api/src/modules/ai-insights/restricted-public-qwen.service.ts:200` | sends `stream: false` | blocking |
| Model request | `apps/api/src/modules/ai-insights/ai-assistant.service.ts:318` | sends `stream: false` | blocking |
| BFF | `apps/web/app/api/agro-chat/route.ts:286` | `answer = await callInternalModel(...)` — awaits the **complete** answer | blocking |
| BFF | `apps/web/app/api/agro-chat/route.ts:300` | `for (const chunk of chunkAnswer(answer.answer))` — slices the finished string | **simulated** |
| Chunker | `apps/api/src/modules/ai-insights/ai-assistant-stream.contract.ts:342-354` | `TOKEN_CHUNK_CHARS = 400`; `text.slice(index, index + step)` | fixed-size string slicing |
| Transport | same route, line 331 | genuine SSE: `text/event-stream`, typed frames, `streamId` | real transport |

Verification commands:

```
grep -rn "stream: true" --include=*.ts apps packages workers   # no model-request match
grep -rn "stream: false" --include=*.ts apps                   # two model call sites
grep -rn "\[DONE\]" apps/api/src/modules/ai-insights apps/web/app/api  # no upstream SSE parsing
```

The only `stream: true` in the tree is `decoder.decode(value, { stream: true })` in
`apps/web/lib/platform-v7/ai-gateway-stream.ts:382` — that is a `TextDecoder` reading the
BFF's own SSE in the browser, not provider streaming.

**Finding TA-2 (P0, blocking).** The TAI stack does **not** stream from Qwen. It performs a
blocking completion, then re-emits the finished answer as SSE `token` frames in 400-character
slices. The SSE transport, typed event contract, cancellation wiring and CSP headers are real
and well built; the *token source* is not. Any prior claim of "real streaming" describes the
transport, not the inference. Status: **`NOT_IMPLEMENTED`** against v5.0 §2.2.

Consequence: the §2.3 acceptance criterion (p50 time-to-first-useful-text improved ≥70%)
cannot be met by construction — first token cannot precede full generation when generation
must finish first. No latency claim may be made until the provider path streams.

### 2.2 What is genuinely present and reusable

The stream contract (`ai-assistant-stream.contract.ts`, 464 lines) is a real asset: a closed
event vocabulary (`meta`, `token`, `citation`, `assessment`, `done`, `error`), forbidden
write-verb keys, private-identity key rejection, and a single shared validator used by both
producer and relay. When provider streaming is implemented, this contract should be kept and
extended, not replaced.

---

## 3. Conversation context and state (P0-B)

### 3.1 ConversationState

```
grep -rln 'ConversationState\|conversationState\|topicSegment\|conversationTopic' \
  --include=*.ts --include=*.tsx .    # → no matches outside node_modules
```

**Finding TA-3 (P0).** The versioned server-side `ConversationState` required by v5.0 §3.2
(with `conversationTopic`, `entities`, `crop`, `topicSegments`, `unresolvedQuestions`, …)
**does not exist anywhere in the repository**. Status: **`NOT_IMPLEMENTED`**.

What exists instead: a browser-supplied `history` array of `{role, text}` turns, normalised
server-side, with no typed state, no summary layer, no topic segmentation and no explicit
New-Chat state boundary beyond the client clearing its own array.

### 3.2 History budget defect — found, reproduced, fixed

`normalizeHistory` existed in three places with identical logic:

- `apps/api/src/modules/ai-insights/restricted-public-qwen.service.ts:267`
- `apps/web/app/api/agro-chat/route.ts:543`
- `apps/web/app/api/restricted-public-platform-assistant/route.ts:473`

All three iterated the window **oldest → newest**, accumulating characters, and `break`ing when
`MAX_HISTORY_TOTAL_CHARS` (12 000) was exceeded. Because the loop breaks forward, the turns
discarded are the **most recent** ones.

Reproduction (written before the fix, observed failing):

> Six filler turns of 2 000 characters exhaust the 12 000-character budget. A short, decisive
> newest turn — `"Речь идёт об озимой пшенице."` (28 characters) — is then dropped. The model
> receives six blocks of ancient context and never learns the topic is winter wheat, so the
> follow-up `"а фосфор?"` has no referent.

This is precisely the behaviour v5.0 §3.1 prohibits: *«Никогда не оставляй старые сообщения
вместо недавних»*.

**Finding TA-4 (P0) — FIXED in this branch.** All three sites now spend the budget
newest-first and replay the kept turns in chronological order. Secret screening in the API
contour was strengthened at the same time: every candidate turn is screened, so whether a turn
is checked no longer depends on how long the preceding turns were.

Evidence: `apps/api` `restricted-public-qwen` suites — 31/31 pass; full `ai-insights` module —
110/110 pass. Web typecheck (`pnpm --filter @pc/web typecheck`) exits 0.

Scope boundary: this repairs *budget priority*. It does **not** deliver §3.2 `ConversationState`,
§3.3 summarisation/topic segmentation, or the §3.4 multi-turn regression corpus. Those remain
`NOT_IMPLEMENTED`.

---

## 4. Observability (P0-A §2.1)

```
grep -rlEi 'ttft|time_to_first|first_useful|prefill' --include=*.ts --include=*.py \
  apps packages workers    # → 0 files
```

**Finding TA-5 (P0).** None of the required per-request metrics exist: no `model_ttft_ms`, no
`first_useful_text_ms`, no `prefill_ms`, no `queue_wait_ms`, no `tokens_per_second`, no
`traceId` correlation across the chain. The service returns an aggregate `latencyMs` only.

Consequence: **no baseline can be computed from the current code**, so the §2.1 mandate
("до изменения производительности сними baseline") is currently unexecutable. Instrumentation
is a prerequisite for, not a consequence of, the streaming work. Status: `NOT_IMPLEMENTED`.

---

## 5. Test and CI truth

### 5.1 Pre-existing failures on exact main

On a clean checkout of `58986be7` with `pnpm install --frozen-lockfile`, the TAI web suites
fail **before any change of mine**:

```
cd apps/web && npx vitest run --config vitest.config.ts \
  tests/unit/platformV7AgroChatModelFirstRoute.test.ts \
  tests/unit/platformV7RestrictedPublicQwenRoute.test.ts \
  tests/unit/platformV7AiGatewayStream.test.ts \
  tests/unit/platformV7PublicAssistantStreamContract.test.ts \
  tests/unit/platformV7PublicAssistantStreamBinding.test.tsx \
  tests/unit/platformV7PrivateGatewayStreamProxy.test.ts
→ Test Files 4 failed | 2 passed;  Tests 25 failed | 62 passed
```

Confirmed identical before and after my change (`git stash` comparison), so my change is
regression-free but the 25 failures are real and pre-existing. Observed failure classes:

- expected frame sequence `['meta','citation','token',…]` vs a different 6-element sequence;
- `SyntaxError: "undefined" is not valid JSON`;
- grounding text mismatch (expected `Сделка`, got `Канонический контур: условия и цена →…`);
- **cross-site denial returns `200` where the test asserts `403`** — a security-relevant assertion.

Some of these may be environment-sensitive (unset origin/allow-list variables in a bare
sandbox). That distinction is **not yet established** and is tracked as an open item; none of
them may be dismissed as "environmental" without evidence.

### 5.2 CI coverage gap

`.github/workflows/ci.yml:49` runs exactly five hand-picked web unit files:
`shellRolePolicy`, `platformV7DriverRoleShellGuard`, `platformV7BankPaymentBasisRoutesManifest`,
`platformV7RootWorkEntry`, `roleContinuityPanel`.

Workflow references for the TAI suites:

| Test file | Workflows referencing it |
|---|---|
| `platformV7RestrictedPublicQwenRoute.test.ts` | **0** |
| `platformV7AgroChatModelFirstRoute.test.ts` | **0** |
| `platformV7PublicAssistantStreamContract.test.ts` | **0** |
| `platformV7PublicAssistantStreamBinding.test.tsx` | **0** |
| `taiSemanticAcceptanceCorpus.test.ts` | **0** |
| `platformV7AiGatewayStream` | 2 (TAI-specific, path/dispatch-gated) |
| `restricted-public-qwen.*` | 2 (TAI-specific, path-gated) |

Path triggers for the two BFF routes I modified:
`apps/web/app/api/agro-chat/route.ts` → **0 workflows**;
`apps/web/app/api/restricted-public-platform-assistant/route.ts` → **0 workflows**.
`apps/api/.../restricted-public-qwen.service.ts` → covered by
`tai-restricted-qwen-reg-ru-activation.yml`.

**Finding TA-6 (P0).** A green CI result on this repository does **not** attest the TAI
contour. The majority of TAI assistant tests are executed by no workflow at all, and 25 of them
currently fail. Per the v5.0 rule that "зелёный PR ≠ production PASS", CI colour must not be
cited as TAI evidence until these suites are both green and wired into a required workflow.

---

## 6. Old PR disposition

41 pull requests are open. **Every one of the six PRs named in the specification has a stale
base**, so under the v5.0 decision table none qualifies for `MERGE` (which requires
"только актуальная ветка"). Bases verified via the GitHub API.

| PR | Title | Base SHA | Current? | Decision | Justification |
|---|---|---|---|---|---|
| #3623 | TAI Agro OS v4: expand deterministic calculator core | `96698227` | no | **REBASE** | 12 Decimal calculators, 2 files, +441 lines, isolated and valuable; only the base is stale. Re-verify against the live calculator set to avoid duplicates before landing. |
| #3674 | P0: enforce plant-disease answer completeness | `8e24af07` | no | **REBASE** | Touches `restricted-public-qwen.service.ts` + quality spec + live-acceptance script. Self-contained and testable. Note: it appends server-authored text to the model answer behind the `GENERAL_AGRO_PLANT_DISEASE_COMPLETENESS_FLOOR` flag — acceptable because disclosed, but it must stay disclosed on rebase. |
| #3666 | P0: harden agro-wide live acceptance evidence | `a8c9476c` | no | **PARTIALLY_REUSABLE** | The evidence-persistence changes (write progress before asserting, so failures are diagnosable) and the forbidden-secret additions are genuinely valuable. The concurrent widening of single-term `support` into multi-term `supportGroups` relaxes matching and must be re-reviewed term by term against §"не ослаблять тесты" before any part lands. |
| #3659 | fix(tai): repair orphan runtime role through direct ACL proof | `ba06e606` | no | **REBASE** | Production DB privilege repair with fail-closed boundary checks and count-only redacted evidence. Security-sensitive; requires fresh review plus a rehearsal against current schema, not a fast-forward. |
| #3581 | TAI: require real Qwen evidence and separate full-admission deploy | `eae723d5` | no | **REBASE** | Draft. Directly relevant to the v5.0 "no hidden fallback" requirement; its intent is aligned with P0 and should be carried forward on the current base. |
| #3598 | ci(tai): enforce exact-main live document and OCR acceptance | `eae723d5` | no | **REBASE** | CI enforcement for P3 documents/OCR. Valuable once P3 has an implementation to enforce against; sequence it behind P3. |

Not one of these was assigned `MERGE`, and none was judged by title, absence of conflict, or an
old green CI run — the specification forbids exactly that.

The remaining 35 open PRs were not individually adjudicated in this pass. Many are stale release
triggers (`release/trigger-*`, `Publish exact … image`) whose base is `eae723d5`, dozens of
commits behind. Adjudicating them is tracked in the release plan; none of them is a v5.0
dependency.

---

## 7. Capability spot-checks

| Area | Verified fact |
|---|---|
| Deterministic calculators | `apps/tai/tai/agro_calculators.py` defines **5** public calculators (seed requirement, effective field capacity, average daily gain, feed conversion, machine-hour cost) plus 6 private helpers. PR #3623 would add 12 more. This is far from the Master Specification target set. |
| Acceptance corpus | `apps/web/tests/fixtures/tai-semantic-acceptance-corpus.ts` is 338 lines of question/context pairs; `shared/ai-local-kb.seed.jsonl` has 41 lines. The v5.0 target is 45 000 *accepted, scored, evidenced* cases. Present scale is ~3 orders of magnitude short. |
| Tool authority | `apps/api/src/modules/tai-tools/` exists with an assertion guard and a controller — a real read-tool boundary, audited separately in `architecture-boundaries.md`. |
| Livestock / Machinery / OCR | Keyword sweeps return matches, but keyword presence is not capability. Marked `NOT_VERIFIED` pending per-contour attestation; see `capability-matrix.md`. |

---

## 8. Audit gate result

The v5.0 Stage 0 gate asks whether code audit and production evidence agree, whether every old
PR has a decision, and whether the capability matrix has been re-attested.

- Code audit: **complete for P0-A, P0-B, observability, CI and the six named PRs.**
- Production evidence: **not obtainable from this environment.** This session has no REG.RU
  access, no model host, no deployed revision and no S3/evidence store. Therefore no live
  matrix, no baseline measurement and no production acceptance can be produced here. This is a
  hard external blocker, recorded as such rather than worked around.
- Old PR decisions: **six named PRs adjudicated; 35 remaining deferred with a stated plan.**
- Capability re-attestation: see `capability-matrix.md`.

Per the specification's own instruction, P0 latency/context is recorded as:

**`DEFINED / NOT_IMPLEMENTED / NOT_PRODUCTION_ACCEPTED`**

with the single exception of the history-budget defect (TA-4), which is now
`IMPLEMENTED_NOT_ACCEPTED` — code and tests exist and pass locally; no production evidence.
