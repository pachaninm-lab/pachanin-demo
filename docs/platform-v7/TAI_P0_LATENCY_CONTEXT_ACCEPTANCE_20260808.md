# Acceptance — TAI latency and same-chat continuity

## Latency

- Measure baseline and candidate on the same warm REG.RU Qwen runtime and fixed RU/EN/ZH corpus.
- Record queue time, prompt/prefill time where available, time-to-first-useful-answer, total model latency, prompt tokens and completion tokens.
- Candidate must reduce median time-to-first-useful-answer by at least 70% versus baseline.
- No smaller model, lower-quality quantization, reduced answer-length ceiling, disabled grounding or weakened completeness/safety gates may be used to obtain the gain.
- Browser must receive useful answer text before complete model generation, through a bounded validated streaming path.

## Conversation continuity

Required continuation classes:

- pronoun: "А если она выше?" after a moisture discussion;
- ellipsis: "А для озимой?" after a crop-specific answer;
- causal continuation: "Почему?";
- comparison: "Сравни с предыдущим вариантом";
- parameter carry-over: "А если 18%?";
- correction: "Нет, я имел в виду после уборки";
- explicit topic shift: a complete new agricultural question must not inherit the old subject incorrectly.

For every class, the newest relevant user and assistant turns must survive the bounded context window. A reset/new-chat must remove all prior dialogue context. Public context may affect semantics only and must never grant private data access or execution authority.

## Quality and safety

Existing exact-model-identity, agro-wide, disease-completeness, current-evidence, secret, write-claim, RU/EN/ZH, mobile and isolation gates remain mandatory and may not be weakened.

## Production completion

Code PR terminal PASS -> merge -> exact-main images -> REG.RU release -> Qwen activation -> live validated streaming -> continuity corpus -> mobile Chromium -> postflight -> immutable evidence.
