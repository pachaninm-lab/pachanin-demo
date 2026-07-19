# TAI delivery roadmap

Статус на 19.07.2026. Источник истины — exact-main и exact-head evidence, а не исходная нумерация master-issue #2726.

## Принято в main

| Этап | Содержание | PR | Merge commit |
| --- | --- | --- | --- |
| AP-00–AP-02 | Foundation, contracts, policy, базовый Platform Knowledge | #2727 | `bba7ba14164d21954dd6afcd31d935a6662a248b` |
| AP-03 | Source governance и durable ingestion recovery | #2728 | `b6e765744f88edb5530b946594fc0d742bb669ac` |
| AP-04 | Managed loaders, leases, checkpoints и recovery audit | #2729 | `d43eef6310cc608bce200c3f0d237bb7930ae8e5` |
| AP-05 | Governed lexical retrieval и generation fencing | #2730 | `f14f0023f8e4b48a6b135346635bf78111655ea8` |
| AP-06 | Context assembly, grounded RAG и citation enforcement | #2731 | `30dc18c2526dbe8c0af22d45100b822ab50a7774` |
| AP-07 | Governed local model runtime/router | #2732 | `182cf17a7779930c13c0066df14ac15bfcb32835` |
| AP-08 | Safe agent tools и durable confirmation authority | #2734 | `234e2d6ef3a290cee008e2df74c8e3b24fc3a16f` |
| AP-09 | Deterministic evaluation и red-team authority | #2735 | `297149187c552ba8a19057bb80f8bdbd002d9e7b` |
| AP-11 | Exact-main application release authority и production composition | #2760–#2762 | до `f99955ba69a85cd9e3afcfc17864a8314c66d122` |
| AP-12A | Governed deterministic Safe Tool planner | #2763 | `f99955ba69a85cd9e3afcfc17864a8314c66d122` |

## Архитектурное решение

TAI остаётся в monorepo в `apps/tai`, но имеет отдельные ownership и release boundaries. Это разрешённая целевая архитектура до отдельного решения владельца о физическом выносе. Контракты с основной платформой должны быть версионированы; AI не получает authority Сделки, денег, ролей, ставок, подписей или споров.

Причина решения: сейчас ценность и риск сосредоточены в корректной интеграции TAI с server-authoritative контекстом платформы. Физический перенос репозитория добавит операционную стоимость, но не закроет ни один пользовательский или safety-инвариант.

## Текущая программа завершения

1. **AP-13 — реальные локальные модели**
   - AP-13A: immutable artifact/license/benchmark/admission authority и fail-closed production readiness;
   - AP-13B: выбор кандидатов, digest-pinned artifacts, license review, quantization;
   - AP-13C: воспроизводимые CPU/GPU/fallback benchmark и measured operating cost;
   - AP-13D: фактический admission минимум primary + fallback моделей.
2. **AP-14 — измеримая база знаний платформы и российского АПК**
   - official-source registry, freshness/expiry, coverage, gold sets, human/domain review.
3. **AP-15 — semantic/hybrid retrieval**
   - embeddings, lexical+semantic fusion, reranker, retrieval benchmark.
4. **AP-16 — documents and vision**
   - PDF, scans, tables, certificates, page-level provenance, quarantine, document injection defense.
5. **AP-17 — product intelligence**
   - Platform Expert, Deal Copilot, proactive deal-event guidance, user AI UI and admin panel.
6. **AP-18 — Safe Tools and confirmed actions**
   - domain adapters for documents, logistics, laboratory, disputes, support and money; every write requires server authorization, idempotency, audit and explicit user confirmation.
7. **AP-19 — operational acceptance**
   - distributed admission/backpressure, rate limits, queues, model draining, HA/DR, observability, load/fault/restore/backlog/soak, 12-role E2E and one exact-main operational manifest.

Каждый срез обязан сохранять:

- server-authoritative identity, tenant и roles;
- 0 autonomous privileged write;
- confirmation перед разрешённым write;
- provenance и version для проверяемых утверждений;
- abstention при недостатке evidence;
- exact-head tests и machine-readable evidence.

## Промышленная приёмка

Финальная operational attestation требует одновременно:

1. фактически допущенные primary/fallback local model artifacts;
2. platform/agro gold sets и human/domain review;
3. CPU, GPU и fallback evaluation;
4. 12-role end-to-end acceptance по всем этапам Сделки;
5. security, tenant isolation, load, fault, restore и soak evidence;
6. единый exact-main canonical acceptance manifest с итогом PASS/FAIL.

## Запрет на завышение зрелости

До полного AP-19 PASS разрешена формулировка: «архитектурное ядро TAI с изолированными exact-commit доказательствами». Запрещено заявлять завершённую промышленную AI-платформу, production acceptance, полное знание АПК или фактическую работу официальных источников без соответствующих model/data/deployment/evaluation evidence.
