# TAI P0 — latency and conversation continuity

Baseline inspected: `db98710047f589d3770689e8d5b5e915c207fc05`.

## Confirmed defects

1. `RestrictedPublicQwenService.callProvider()` sends `stream: false`, so the model completes the full OpenAI-compatible JSON response before the web layer can emit model text. The browser receives SSE-shaped chunks only after generation is already complete. This is synthetic streaming and explains high perceived latency.
2. The restricted web route first waits for public grounding and only then calls the model, creating serial pre-generation work.
3. A `finish_reason=length` response starts a second full provider request before the final answer is returned, which can substantially increase tail latency.
4. The client preserves the conversation and sends the last 12 turns, but bounded history normalization in the restricted web route and API service iterates oldest-to-newest and stops when the 12,000-character budget is reached. Older long turns can therefore evict the newest follow-up turns that are most important for resolving pronouns and ellipsis.
5. Follow-up classification also contains a narrow short-question heuristic. This is insufficient as the primary continuity mechanism for natural dialogue.

## Required solution

- end-to-end low-latency generation from local Qwen to browser;
- bounded safety validation before visible text is emitted;
- newest-turn-first retention;
- relevance-preserving compact conversation state;
- reliable continuation semantics within one chat;
- hard reset/isolation boundaries;
- no model downgrade, no shorter-answer quality shortcut, no weakened grounding/safety/completeness;
- latency and quality evidence on the same warm REG.RU runtime;
- exact-main production acceptance.

Canonical governed scope: `docs/platform-v7/autopilot/scopes/tai-p0-latency-conversation-continuity-20260808.json`.
