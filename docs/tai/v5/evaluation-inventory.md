# TAI Agro OS v5.0 — Evaluation Inventory

Baseline SHA: `58986be7ec0aa21bb56623f1c389d8d0889db7e1`
Date: 2026-08-08

Purpose: state what evaluation material actually exists, what it proves, and how far it is from
the v5.0 target of **45 000 accepted scenarios**.

---

## 1. What exists

| Artifact | Size | What it actually is |
|---|---|---|
| `apps/web/tests/fixtures/tai-semantic-acceptance-corpus.ts` | 338 lines | Question texts paired with role+page routing context. Exercises the *admission router*, not answer quality |
| `shared/ai-local-kb.seed.jsonl` | 41 lines | Public knowledge seed records |
| `scripts/tai-potato-mobile-live-acceptance.mjs` | ~22 cases | Live endpoint + mobile UI acceptance: RU-dominant, 1 EN, 1 ZH, 1 context follow-up. Requires a deployed stack |
| `apps/api/.../restricted-public-qwen.service.spec.ts` | 17 tests | Transport, grounding, safety, history budget |
| `apps/api/.../restricted-public-qwen.quality.spec.ts` | — | System-prompt coverage assertions |
| `apps/api/.../restricted-public-qwen.disease-completeness.spec.ts` | — | Plant-disease completeness floor |
| `apps/api/.../ai-assistant-stream.contract.spec.ts` | 371 lines | Frame validation and SSE encoding |
| TAI web unit suites | 87 tests across 6 files | **25 currently failing** on exact main (see truth-audit §5.1) |

Total genuine TAI test count is in the low hundreds, and a quarter of the web portion is red.

---

## 2. Distance to target

| Domain | v5.0 minimum | Present (accepted, scored, evidenced) | Gap |
|---|---|---|---|
| Crop | 10 000 | 0 | 10 000 |
| Livestock | 10 000 | 0 | 10 000 |
| Machinery | 12 000 | 0 | 12 000 |
| Trade / Business | 5 000 | 0 | 5 000 |
| Enterprise | 3 000 | 0 | 3 000 |
| Security / Authority | 3 000 | 0 | 3 000 |
| RU / EN / ZH / Mobile | 2 000 | 0 | 2 000 |
| **Total** | **45 000** | **0** | **45 000** |

"Present = 0" is deliberate and is the honest number. The v5.0 definition of an accepted case
requires: scenario id, language, contour, inputs/context, expected constraints, scoring rubric,
exact artifact/version, result, evidence, and reviewer policy. **No artifact in this repository
carries that structure.** The existing tests are valuable engineering tests; none of them is an
accepted scenario in the v5.0 sense, so counting them toward 45 000 would be exactly the
misrepresentation prohibition #10 forbids.

Multi-turn matrix (§3.4, "several thousand cases"): 1 context-follow-up case exists in the live
script, plus the 2 history-budget tests added in this branch. Gap: effectively the whole set.

---

## 3. What is missing structurally, not just in volume

1. **No evaluator.** There is no scoring harness — no rubric application, no factuality /
   completeness / relevance / context-resolution / hallucination / safety dimensions, no
   abstention scoring. Assertions are substring and HTTP-shape checks.
2. **No versioned corpus identity.** No corpus version, evaluator version, retrieval/index
   version or model-identity binding recorded with results.
3. **No immutable evidence store.** Live acceptance writes JSON to a local evidence dir; there is
   no immutable, SHA-bound bundle.
4. **No A/B baseline mechanism.** §9 requires every latency/retrieval/prompt change to run A/B
   against an exact baseline. No baseline exists (no instrumentation — truth-audit §4), so this
   gate is currently unenforceable.
5. **Generated-case validation policy absent.** §9 requires independent validation, dedup and
   sampling before generated cases count as accepted. No such pipeline exists.

---

## 4. A caution about the shape of the target

The 45 000 figure is only meaningful if each case is independently checkable. The cheapest way
to reach it — templating questions across crops × problems × locales — produces a large number
that proves very little, and §9 explicitly refuses it. The honest path is:

1. Build the evaluator and evidence schema **first**, at small scale (hundreds of cases).
2. Prove the rubric distinguishes good from bad answers on known-bad outputs.
3. Only then scale the corpus, with dedup and human-sampled validation as gates.

Scaling before step 2 produces 45 000 rows and zero information.

---

## 5. Immediate honest position

Any statement that TAI has "45k accepted scenarios", "full acceptance", or "corpus coverage"
would be false at this SHA. The permitted statement is:

> TAI has a low-hundreds engineering test suite, partially red on exact main, no scoring
> evaluator, and no accepted-scenario corpus. The 45 000 target is `NOT_IMPLEMENTED`.
