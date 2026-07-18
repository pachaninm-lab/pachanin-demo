# TAI delivery roadmap

Статус на 18.07.2026. Источник истины — exact-main, а не номера старых этапов
master-issue #2726.

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

## Архитектурное решение

TAI остаётся в monorepo в `apps/tai`, но имеет отдельные ownership и release
boundaries. Это разрешённая целевая архитектура до отдельного решения владельца о
физическом выносе. Контракты с основной платформой должны быть версионированы;
AI не получает authority Сделки, денег, ролей, ставок, подписей или споров.

Причина решения: сейчас ценность и риск сосредоточены в корректной интеграции TAI с
server-authoritative контекстом платформы. Физический перенос репозитория добавит
операционную стоимость, но не закроет ни один пользовательский или safety-инвариант.

## AP-10 — работающий AI-продукт и эксплуатационные контуры

Последовательность узких authority-срезов:

1. Единый orchestration runtime и новый API contract.
2. Фактические локальные model artifacts, benchmark и CPU/GPU profiles.
3. Полная Platform Knowledge Base и измеримый registry coverage.
4. Реальные governed-источники российского АПК.
5. Semantic/hybrid retrieval, embeddings и reranker.
6. Document/vision ingestion с page-level provenance и quarantine.
7. Platform Expert и Deal Copilot.
8. Реальные Safe Tool adapters к серверным командам.
9. UI и операционная административная панель.
10. Security, legal/licensing, observability, HA/DR, load/fault/soak.

Каждый срез обязан сохранять:

- server-authoritative identity, tenant и roles;
- 0 autonomous privileged write;
- confirmation перед разрешённым write;
- provenance и version для проверяемых утверждений;
- abstention при недостатке evidence;
- exact-head tests и machine-readable evidence.

## AP-11 — release и промышленная приёмка

1. Immutable containers, Helm/Kubernetes, staging и controlled rollout/rollback.
2. Фактические platform/agro gold sets и human/domain review.
3. CPU, GPU и fallback evaluation.
4. 12-role end-to-end acceptance по всем этапам Сделки.
5. Security, tenant isolation, load, fault, restore и soak evidence.
6. Единый exact-main canonical acceptance manifest с итогом PASS/FAIL.

## Запрет на завышение зрелости

До AP-11 PASS разрешена формулировка: «архитектурное ядро TAI с изолированными
exact-commit доказательствами». Запрещено заявлять завершённую промышленную
AI-платформу, production acceptance, полное знание АПК или фактическую работу
официальных источников без соответствующих model/data/deployment/evaluation evidence.
