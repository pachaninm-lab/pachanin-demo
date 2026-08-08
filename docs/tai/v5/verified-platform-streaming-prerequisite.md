# Bounded task: incremental grounding enforcement

Status: `NOT_IMPLEMENTED` — prerequisite for streaming the `verified_platform` contour.
Raised from: `apps/api/src/modules/ai-insights/restricted-public-qwen.service.ts` (`generateStream`)
Baseline: `b71e4bc303c91304b569bbc635706b3f05d7e560`

## Why `verified_platform` is not streamed

`generateStream()` refuses `verified_platform` and returns
`{ kind: 'error', errorClass: 'streaming_unsupported_mode' }`. This is a deliberate capability
signal, not a gap left by accident, and it must not be replaced by a silent fallback to the
blocking path dressed up as a stream.

The reason is `enforcePlatformGrounding`. In this contour the model is not the authority: the
supplied public grounding is. The function compares the finished answer against that grounding
and **keeps only the sentences the grounding supports**, discarding the rest. It needs the whole
answer because a sentence's fate depends on text that may not have arrived yet.

Streaming it as currently written would mean emitting sentences to a browser and *then*
discovering the grounding check removes them. The user would have already read an ungrounded
claim about the platform. That is precisely the failure the check exists to prevent, so making
the contour "stream" without changing the check would convert a working safety property into a
decorative one.

## What has to be true before this contour can stream

1. **Sentence-level admission.** Grounding enforcement must decide per completed unit (sentence
   or clause) rather than per answer, so a unit is either admitted or dropped before emission —
   never emitted and retracted. A stream has no retraction primitive, and inventing one in the
   UI ("ignore what you just read") is not an acceptable substitute.
2. **A holdback boundary.** The safety buffer already withholds a bounded suffix
   (`MAX_HOLDBACK_CHARS`). Grounding admission needs its own boundary — the last sentence
   terminator — and the two must compose without unbounded growth when the model produces a very
   long unterminated span.
3. **Equivalence proof.** For a corpus of answers, streamed admission must produce the same text
   as `enforcePlatformGrounding` on the complete answer. If the two disagree, the streamed path
   is a second, weaker grounding rule, which is the outcome to avoid.
4. **Abstention parity.** When nothing survives admission, the streamed path must reach the same
   `verifiedFallback` outcome as the blocking path, rather than emitting an empty answer that
   reads as the assistant having considered the question and had nothing to say.
5. **No authority downgrade.** Streaming must not become a reason to relax what counts as
   grounded. If a unit cannot be admitted from the supplied grounding, it is dropped in both
   paths.

## Out of scope

- Changing what `enforcePlatformGrounding` considers grounded.
- Streaming any contour that carries tenant, deal, document or role authority. Those remain
  server-derived and outside the public streaming path entirely.

## Acceptance

- Streamed and blocking `verified_platform` answers agree on a fixed corpus, RU/EN/ZH.
- No emitted unit is later contradicted or withdrawn.
- Abstention behaviour identical between paths.
- The `streaming_unsupported_mode` signal is removed only when the above hold; until then it
  stays, and any UI that asks for a stream in this mode renders the complete answer.
