`[REQ-SEC-008]` Конкретные юридические сроки retention определяются только по свежим официальным источникам и фиксируются в versioned matrix; до подтверждения система не выполняет необратимое автоматическое удаление юридически значимых данных.

`[REQ-SEC-009]` Data subject request, legal hold, tenant export и deletion имеют audit и не нарушают обязательное хранение.

`[REQ-SEC-010]` Security incident kill switches позволяют выключить provider, capability, mutation path, AI tools или compromised release без изменения core.

## 5 7 API event и schema compatibility

`[REQ-CMP-001]` Public/internal API и events имеют versioned schema и compatibility tests.

`[REQ-CMP-002]` Изменение поля проходит additive phase, consumer migration и controlled removal; silent semantic change запрещён.

`[REQ-CMP-003]` Provider adapters используют contract fixtures, deterministic replay и negative cases.

`[REQ-CMP-004]` Event consumer idempotent; schema registry или эквивалентный generated contract хранит producer/consumer ownership.

## 5 8 Observability и operations

`[REQ-OBS-001]` Structured logs, metrics, traces и audit используют correlation IDs: request, actor, tenant, deal, batch, provider operation и release SHA.

`[REQ-OBS-002]` SLO имеют alerts по symptom, а не только по CPU: availability, latency, error rate, queue age, stale sync, reconciliation gap, backup failure и cross-tenant denial anomalies.

`[REQ-OBS-003]` Для severity P0/P1/P2 определены owner, escalation, runbook, acknowledgement и resolution target.

`[REQ-OBS-004]` Founder видит business health; technical operations видит service health. Эти панели не подменяют друг друга.

## 5 9 Maintainability и инженерная чистота

`[REQ-MNT-001]` Typecheck, lint, formatting, dead-code check и tests для затронутых packages обязательны; новые предупреждения не допускаются.

`[REQ-MNT-002]` Critical domain, money, authority и regulatory branches имеют branch coverage не ниже 90%; changed-lines coverage не ниже 90%, если более строгий repository gate не требует большего.

`[REQ-MNT-003]` Дублирование нового product code не выше 3%; общая helper abstraction создаётся только при доказанном общем инварианте, а не ради формального DRY.

`[REQ-MNT-004]` Циклические зависимости, неограниченные функции/модули и скрытые global state запрещены; архитектурные границы проверяются автоматически.

`[REQ-MNT-005]` Любой новый public API, event, state transition и policy rule имеет владелец, schema, tests, error contract и migration/compatibility note.

`[REQ-MNT-006]` TODO/FIXME в активном acceptance path равен незавершённой работе, кроме ссылки на оформленный внешний blocker.

## 5 10 Правовая применимость и данные

ТЗ задаёт инженерные gates, а не индивидуальное юридическое заключение. Документ, код и поиск Codex не подтверждают право совершать регулируемую операцию. Подписанный договор, профессиональное заключение и реальные разрешения остаются внешними prerequisites.

`[REQ-LGX-001]` До затронутого production-действия завести LegalApplicabilityRecord: actual operating model, parties/roles, jurisdiction, source edition/effective dates, conclusion, limitations, owner, approval evidence, next review и gated capabilities.

`[REQ-LGX-002]` До real money обязательны письменные выводы по роли ООО в платежах/AML и банковскому договору, supply/quality/risk/disputes, tax/accounting, PD/AI, platform-law applicability и EPD/logistics конкретного маршрута. Платформа не является кошельком, банком, лабораторией или гарантом поставки по умолчанию.

`[REQ-LGX-003]` Отдельные conditional gates: персонализированные рекомендации; свободный user messaging/ОРИ; способ авторизации; trading/clearing; 44/223 procurement; реклама/маркировка/рассылки; коммерческая тайна; KII; валютные/экспортные/фитосанитарные операции. Неприменимость требует причины и актуальной квалификации, а не удобного флага.

`[REQ-LGX-004]` LegalInbox и operational notifications не подменяют свободный мессенджер. Claims, ranking, жалобы, adverse decisions, ограничения и appeal имеют версии правил и доказательства уведомления, если оно требуется.

`[REQ-LGX-005]` DataInventory: field → subject → purpose → basis → owner/system/country → recipients/processors → retention/deletion → backup → legal hold. Классы PUBLIC, INTERNAL, CONFIDENTIAL, TRADE_SECRET, PERSONAL_DATA, FINANCIAL_SENSITIVE, SECRET имеют отдельные controls.

`[REQ-LGX-006]` Для каждого класса до включения обработки утвердить конкретные сроки хранения, deletion/anonymization, backup expiry и исключения legal hold. Нельзя бесконечно хранить всё под предлогом «срок не выяснен»; неразрешённая новая обработка остаётся выключенной.

`[REQ-LGX-007]` Localization, cross-border, vendor/subprocessor location и training use проверяются для реального потока. Российский frontend не доказывает локализацию backend/AI. Отзыв согласия и data-subject workflow не удаляют обязательные бухгалтерские evidence без проверки основания.

`[REQ-LGX-008]` Future-effective изменения учёта, реестров перевозчиков и регулирования имеют scheduled review, test fixtures и versioned activation. Исторические даты/ставки MASTER не копируются как действующее право. Внешние контакты, согласия и legal approvals Codex не подписывает за владельца.

# 6 Жизненный цикл Гекты

Гекта — встроенный интеллектуальный слой платформы, а не отдельный чат и не источник истины.

## 6 1 Продуктовый контракт

`[REQ-AI-001]` UI Гекты использует общий App Shell, design tokens, typography, navigation и responsive behaviour.

`[REQ-AI-002]` Гекта понимает текущего пользователя, server-derived tenant/organization/role, route, объект, state, доступные actions, документы, деньги, evidence, deadlines и risk flags.

`[REQ-AI-003]` Гекта умеет объяснять, резюмировать, сравнивать, моделировать, готовить draft, рекомендовать и приоритизировать.

`[REQ-AI-004]` Гекта не может самостоятельно подтвердить authority, изменить роль/tenant, финализировать юридическое решение, выпустить деньги, подписать документ или скрыто изменить binding score.

`[REQ-AI-005]` Любой tool call проходит server-side authorization; side effect требует preview, explicit confirmation, idempotency и audit.

`[REQ-AI-006]` Mandatory flow работает без AI. При outage пользователь получает обычный детерминированный путь.

## 6 2 Model lifecycle

`[REQ-AI-007]` Каждый ответ и tool decision связывается с immutable `modelVersion`, `modelBundleDigest`, `systemPolicyVersion`, `promptTemplateVersion`, `toolContractVersion`, `retrievalPolicyVersion` и `evalCorpusVersion`.

`[REQ-AI-008]` Основная модель: pinned Qwen3-8B; резерв: pinned Mistral-7B-Instruct-v0.3, пока architecture decision не заменит их после полного regression eval.

`[REQ-AI-009]` Запрещены обязательные платные LLM API и внешняя векторная БД.

`[REQ-AI-010]` Любая смена модели, quantization, prompt, tool schema, retrieval или policy проходит offline regression, red-team, RU/EN/ZH eval и canary/rollback.

`[REQ-AI-011]` Eval corpus не менее 45 000 versioned cases с реальными role/state/risk patterns, без утечки production secrets и персональных данных.

`[REQ-AI-012]` Taxonomy ошибок: unsupported claim, stale source, wrong next action, wrong money, wrong authority, cross-tenant leak, prompt injection success, hidden instruction following, unauthorized side effect, omission of material risk.

`[REQ-AI-013]` Пороги: cross-tenant leak `0`; unauthorized side effect `0`; false authoritative status `0`; high-risk next-action correctness `100%`; critical money/rights hallucination `0`.

`[REQ-AI-014]` AI kill switch отключает generation или отдельные tools без остановки обязательных workflows.

`[REQ-AI-015]` Automatic rollback срабатывает при нарушении critical eval, security anomaly или росте production error budget.

`[REQ-AI-016]` Provenance ответа показывает пользователю фактические источники платформы и freshness там, где утверждение влияет на деньги, право, срок или действие.

## 6 3 Производительность Гекты

| **Метрика**                               | **Цель**                         |
|-------------------------------------------|----------------------------------|
| Warm TTFT p95                             | `≤ 3 s`                          |
| Cold TTFT p95                             | `≤ 10 s`                         |
| Простое объяснение end to end p95         | `≤ 12 s`                         |
| Сложный анализ p95                        | `≤ 30 s` или прогресс/streaming  |
| Tool authorization overhead p95           | `≤ 300 ms` без внешнего provider |
| Mandatory flow availability при AI outage | `100%`                           |

`[REQ-AI-017]` Streaming SSE, cancellation, timeout, retry boundaries и bounded context обязательны.

`[REQ-AI-018]` Resource budget фиксирует CPU, RAM, storage, queue, parallelism и maximum context; AI не может вытеснить transaction workloads.

## 6 4 Продуктовые режимы Гекты из MASTER

`[REQ-GKX-001]` Сохранить режимы Public, Crop, Livestock, Machinery, Trade, Expert/Documents, Deal Copilot и Enterprise как capabilities общего интерфейса, а не отдельные приложения. Для каждого определить разрешённые данные, tools, domain eval и границу риска.

`[REQ-GKX-002]` Conversation state содержит topic/domain/intent/entities и known facts/assumptions. Последнее уточнение выше старой summary; короткое «по пятой машине?» разрешается к доступному объекту. New Conversation сбрасывает контекст; смена tenant не переносит закрытые данные.

`[REQ-GKX-003]` `GektaEvidenceAnswer` включает answer, точные SourceObjects/versions/locators, relevant clauses/parameters, confidence, missing evidence, suggested next action и humanApprovalRequired. Confidence не является финансовым или юридическим разрешением.

`[REQ-GKX-004]` Document Expert использует quarantine, MIME validation, parser isolation, limits, malware/prompt-injection defenses и provenance. Документы клиента не становятся общим training corpus. Результат анализа содержит ссылки на exact page/table/record.

`[REQ-GKX-005]` Vendor/model register покрывает модели, embeddings/rerankers, OCR/parsers и external APIs: version, hash, license, deployment location, data classes, subprocessors, retention/training policy, security evidence, known failures и replacement/disable path.

`[REQ-GKX-006]` Перед сменой model/prompt/tool/retriever/eval corpus обязательны versioned regression eval RU/EN/ZH, domains, roles, multi-turn, groundedness, hallucination taxonomy, injection и excessive-agency tests. Ухудшение критической correctness не компенсируется меньшей latency или cost.

`[REQ-GKX-007]` Persistent runtime, real SSE streaming, bounded queue, backpressure, cancellation и admission control проверяются при concurrency 1/5/10/25/50. TTFT, total latency, success/degrade rate и resource cost измеряются раздельно; реальные лимиты не маскируются демо-ответом.

`[REQ-GKX-008]` Gekta Basic/Deal Copilot измеряет снижение support/exception handling; Pro/Enterprise — доказанную дополнительную ценность. Нельзя называть её юристом, банком, аккредитованной лабораторией или автономным арбитром; опасные аграрные/ветеринарные решения требуют профильного источника и human boundary.

# 7 Программа исполнения R0 R12

Официальный прогресс считается только по полностью закрытым R-блокам. Внутри крупного блока используются атомарные срезы. Каждый срез проходит собственный `PRE_RELEASE_PASS → DEPLOY → POST_RELEASE_LIVE_ACCEPTANCE → PRODUCTION_PASS`. Codex не начинает следующую независимую delivery-задачу до закрытия активной; необходимые prerequisites и внешние blockers обрабатываются по 7.1. Сам R-блок получает points только после закрытия целиком.

| **Блок**  | **Результат**                                             | **Вес** |
|-----------|-----------------------------------------------------------|---------|
| R0        | Фактическое состояние и устойчивый release/review gate    | 5       |
| R1        | Founder/CEO и доступ владельца во все 13 ЛК               | 7       |
| R2        | Единая публичная шапка, главная и публичные маршруты      | 5       |
| R3        | Аналитический dashboard                                   | 6       |
| R4        | Финансовый dashboard                                      | 7       |
| R5        | Проверка юрлиц и ИП ФНС ЕГРЮЛ/ЕГРИП                       | 6       |
| R6        | Config Foundation                                         | 6       |
| R7        | Revenue Slice до комиссии ООО                             | 18      |
| R8        | Regulatory Core и ФГИС                                    | 14      |
| R9        | 1С, ЭДО/ЭПД, банки, логистика и партнёрские bindings      | 9       |
| R10       | Гекта production-grade                                    | 8       |
| R11       | Ролевой UX, настройки, support и reality acceptance       | 5       |
| R12       | Общесистемное hardening и финальный production acceptance | 4       |
| **Итого** |                                                           | **100** |

## 7 1 Последовательность с учётом зависимостей

R0–R12 — области ответственности и веса, а не запрет сначала сделать необходимый prerequisite. Одновременно активен один атомарный delivery slice. Обычный цикл: конкретный результат → implementation → проверки → PRE_RELEASE_PASS → deploy → live acceptance → PRODUCTION_PASS → короткий отчёт → следующий slice. Read-only discovery, тесты и review могут выполняться параллельно в пределах этой задачи и доступных правил среды.

После discovery Codex фиксирует serial execution queue и dependency graph. Если R1/R3/R4 требует ещё несуществующий ledger, policy или adapter, соответствующий prerequisite выносится вперёд как отдельный slice с исходным R-владельцем. Нельзя начинать недоказанный зависимый UI с fake numbers. Переупорядочение не удаляет требование, не даёт частичных points и не позволяет начать постороннюю разработку до закрытия активной задачи.
