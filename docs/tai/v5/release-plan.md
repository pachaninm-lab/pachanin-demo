# TAI Agro OS v5.0 — Release Plan (P0–P10)

Baseline SHA: `58986be7ec0aa21bb56623f1c389d8d0889db7e1`
Date: 2026-08-08

Rule inherited from the specification and binding on this plan: **a stage may not be closed by
code, a green PR, or a document.** A stage closes only with exact-SHA production evidence on
REG.RU. No stage below may be relabelled accepted without that.

---

## 0. Standing external blockers

These gate every production acceptance in this plan and cannot be resolved from a development
session:

| Blocker | Needed for | Owner action required |
|---|---|---|
| No REG.RU access from the build environment | every live acceptance, §10 sequence | provide deploy path / runner |
| No Qwen model host reachable | baseline, TTFT, load, saturation, live matrix | provide private model endpoint + key |
| No immutable evidence store | evidence bundles | provide S3-compatible target |

Until these exist, the maximum achievable status for any stage is
`IMPLEMENTED_NOT_ACCEPTED`. Recording a stage as accepted without them is prohibited.

---

## Stage sequence

### P0-0 — Truth Audit ✅ delivered
Artifacts: `truth-audit.md`, `capability-matrix.md`, `architecture-boundaries.md`,
`evaluation-inventory.md`, this plan.
Status: **`IMPLEMENTED_NOT_ACCEPTED`** (documents exist; audit of 35 residual PRs deferred).
Evidence owner: repository.

### P0-A1 — Observability first *(next; unblocked, do this before streaming)*
Instrument the full chain with `traceId` correlation: `queue_wait_ms`, `routing_ms`,
`grounding_ms`, `prompt_assembly_ms`, `prompt_tokens`, `prefill_ms`, `model_ttft_ms`,
`first_useful_text_ms`, `completion_tokens`, `tokens_per_second`, `generation_ms`,
`postprocess_ms`, `total_ms`, `cancelled`, `timeout_class`, `error_class`, `fallback_used`,
`model_identity`, `retrieval_version`, `context_tokens`, `compression_ratio`.
No prompts, PII, secrets, tenant content or document text in metrics.
Dependency: none. **This must precede P0-A2** — without it there is no baseline and the ≥70%
criterion is unmeasurable.
Exit: metrics emitted and unit-tested; baseline capture script ready to run against a host.

### P0-A2 — Real Qwen streaming
Switch both call sites to `stream: true`, parse OpenAI-compatible SSE (`data:` frames,
`[DONE]`), and pipe deltas through a bounded, UTF-8-safe semantic/safety buffer to the existing
frame contract. Retire `chunkAnswer()` from the live path.
Hard requirement carried from `architecture-boundaries.md` §5: every safety check currently
applied to the complete answer needs a cross-chunk equivalent — `<think>` blocks, secrets and
write-claims can span frame boundaries.
Exit: automated proof that first visible meaningful text precedes provider completion; cancel,
disconnect, malformed chunk, redaction and partial-recovery E2E; then baseline comparison.
**The ≥70% figure is reported as measured, not asserted.** If unreachable on fixed hardware,
record `BLOCKED/PARTIAL` with the demonstrated bottleneck — do not restate the criterion.

### P0-B — Context, state, topic segments
Budget priority ✅ fixed (truth-audit TA-4). Remaining: token-accurate budgeting with reserved
system/grounding/completion shares; versioned typed server-side `ConversationState`; summary +
topic segmentation with server-side New-Chat isolation; multi-turn regression corpus covering
pronoun, ellipsis, follow-up, correction, comparison, continuation, topic shift, return-to-topic,
parameter change, document/deal continuation, contradiction, long conversation and reset — in
RU/EN/ZH, including the mandated wheat→nitrogen→phosphorus→cow sequence.

### P0-C — Always-on core, load, recovery
Persistent non-root runtime, supervisor, model-digest verification, warm-up, readiness/liveness,
drain, bounded admission/queue, backpressure, timeout/cancellation, crash recovery, graceful
shutdown. Load matrix 1/5/10/25/50 → measured saturation. Fault matrix per §4.2.
**Capacity numbers are stated only after measurement.**
Status: `BLOCKED` on model host.

### P1 — Unified Agro Knowledge Core
One core for all contours. Ontology, source registry + authority, geography, applicability,
published/retrieved dates, freshness, ingestion runs, parser/retrieval/index versions, document
hash, chunk provenance. Retrieval: deterministic filter → lexical → semantic → hybrid fusion →
rerank → authority/freshness weighting → dedup → citation assembly → confidence/abstention.
Private tenant corpus physically isolated from public.
Every time-sensitive answer carries source + publication date + retrieval date + geography, or
states plainly that the live value is unconfirmed.

### P2 — Crop + deterministic calculators
Rebase #3623 onto current main (see truth-audit §6), de-duplicate against the 5 existing
calculators, then close the full target set. Decimal/integer authority only; explicit
units/rounding/version/inputs/provenance. The model selects and explains calculators; it is
never the arithmetic source.

### P3 — Expert / documents / OCR
Quarantine → malware/content policy → MIME signature validation → size/page/cell limits →
isolated parser → timeout → prompt-injection detection/redaction. Provenance to page/table/cell.
Sequence #3598's CI enforcement **after** the implementation it enforces.

### P4 Livestock → P5 Machinery → P6 Trade/Deal-aware → P7 Enterprise/Connect → P8 Event agents → P9 Commercial
Strictly in this order, each with its own vertical acceptance. P6 requires the authenticated
contour's ABAC/RBAC/RLS to be attested first (`architecture-boundaries.md` §3). P7 connectors are
`capable`, never `LIVE`, until a named integration passes its own production acceptance. P9 must
not enable paid billing without a separate written owner decision.

### P10 — Corpus, load/fault/DR, final attestation
Build the evaluator **before** scaling the corpus (`evaluation-inventory.md` §4). Then the §10
production sequence and the immutable evidence bundle bound to exact SHA, image digests, model
digest, index and corpus versions.

---

## Old PR handling

Decisions for the six named PRs are recorded in `truth-audit.md` §6: five `REBASE`, one
`PARTIALLY_REUSABLE`, zero `MERGE`. The 35 residual open PRs — mostly stale release triggers
based on `eae723d5` — are adjudicated as a separate housekeeping task; none is a v5.0
dependency. No stale branch may be merged without rebasing onto current main and re-running the
full check set.

---

## Prohibition on false closure

A stage is reported with one of: `NOT_IMPLEMENTED`, `PARTIAL`, `IMPLEMENTED_NOT_ACCEPTED`,
`PRODUCTION_ACCEPTED`, `BLOCKED` + named external blocker. The words *done*, *production*,
*live*, *full*, *accepted* and the figure *45k* are not to be used for any item lacking the
corresponding exact evidence.
