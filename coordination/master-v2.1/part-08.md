| **Gate** | **Обязательное evidence**                                                               |
|----------|-----------------------------------------------------------------------------------------|
| G0       | Branch protection, required checks, immutable release и отсутствие необъяснённого drift |
| G1       | Exact-SHA P0 workflow со всеми обязательными terminal results и артефактом агрегации    |
| G2       | Constitution accepted обеими сторонами и immutable version                              |
| G3       | Tranche authority и суммы без aggregate-money shortcuts                                 |
| G4       | Локальный dispute/hold и разрешённый частичный release                                  |
| G5       | Две quality checkpoints, custody, sample seal/retention и arbitration                   |
| G6       | Unified EvidenceService и проверяемый bundle                                            |
| G7       | Настоящие maker/checker, step-up, self-approval deny и expiry                           |
| G8       | ProviderComplianceMatrix, ограничения и доказанное снятие                               |
| G9       | Один реально доступный банк с разрешённым проверенным finality                          |
| G10      | Один реально доступный ЭПД binding для применимого маршрута                             |
| G11      | Подтверждённые primary/backup, runbook и incident drill                                 |

`PROTECTED_DEAL_P0_ALL` нельзя вычислять из наличия файлов или старого SHA. До deploy возможен только `PROTECTED_DEAL_P0_PRE_RELEASE`; после deploy и разрешённых проверок G9/G10 — live/capability status. Реальное денежное движение требует отдельного разрешения на конкретный бизнес-сценарий. Отсутствие клиента или договора не разрешает тестовую операцию за него и не даёт общего FULL PASS.

# 9 Двухфазный выпуск и объективные 100 из 100

Предыдущее циклическое правило устранено. Live acceptance не требуется до deploy; оно является второй фазой после безопасного выпуска.

## 9 1 PRE RELEASE PASS

До production должны быть одновременно PASS:

1.  requirement traceability;
2.  architecture и data invariants;
3.  unit/domain/property tests;
4.  PostgreSQL/integration/contract tests;
5.  role/tenant/security negative tests;
6.  migrations, backward compatibility и rollback readiness;
7.  frontend/mobile/i18n/accessibility/visual regression;
8.  performance/load в production-like среде;
9.  SBOM/provenance/license/vulnerability/secret gates;
10. independent review и exact-head admission;
11. self-score `100/100 PRE_RELEASE` без critical FAIL.

`PRE_RELEASE_PASS = 100/100` разрешает deploy exact artifact.

## 9 2 DEPLOY

- release только из exact accepted head/current main согласно repository policy;
- immutable artifact digest;
- preflight database and capacity checks;
- staged migration;
- health and readiness;
- automatic abort/rollback criteria;
- release record с actor/time/SHA/digest/schema.

## 9 3 POST RELEASE LIVE ACCEPTANCE

После deploy обязательно:

1.  version/SHA/digest/schema match;
2.  live smoke;
3.  relevant role matrix;
4.  desktop/mobile/RU/EN/ZH;
5.  real PostgreSQL data path;
6.  audit/outbox/observability;
7.  SLO sanity and errors;
8.  no demo/mock fallback;
9.  rollback readiness;
10. evidence archive.

Только после этого:

`PRODUCTION_PASS = PASS`

Если live acceptance FAIL, задача остаётся незавершённой. Codex исправляет, повторяет pre-release gate для нового SHA, выпускает и проверяет снова.

## 9 4 Scorecard одной атомарной задачи

| **Категория**                         | **Баллы** |
|---------------------------------------|-----------|
| Functional correctness                | 15        |
| Data/money/legal correctness          | 15        |
| Architecture/compatibility            | 10        |
| Security/privacy/tenant isolation     | 10        |
| Tests/negative/concurrency/recovery   | 10        |
| UX/mobile/i18n/accessibility          | 10        |
| Performance/reliability/observability | 10        |
| Migration/rollback/release evidence   | 10        |
| Maintainability/no duplication        | 5         |
| External truth and documentation      | 5         |
| **Итого**                             | **100**   |

`[REQ-DOD-001]` Любой critical FAIL обнуляет release decision независимо от суммы.

`[REQ-DOD-002]` Внутренняя самооценка не является evidence; каждый балл подтверждается тестом, измерением, review или артефактом.

`[REQ-DOD-003]` Известных незакрытых P0/P1/P2 defects в затронутом scope и его критичных зависимостях перед production быть не должно. Незатронутый backlog не скрывается, но не создаёт бесконечный gate на весь проект. P3 допускается только вне текущего acceptance с documented non-regression proof.

## 9 5 Дополнительные условия выпуска и восстановления

`[REQ-RLX-001]` Каждая категория scorecard содержит evidence refs и бинарный PASS по применимым checks. N/A допустим только с обоснованием неприменимости, независимой проверкой и фиксированным scope; N/A не скрывает непройденный тест. Самооценка 100/100 — gate доказательств, не гарантия отсутствия неизвестных ошибок.

`[REQ-RLX-002]` Deployment разрешён после PRE_RELEASE_PASS без преждевременного заявления live PASS. Новый, ещё не проверенный live provider включается только для разрешённого ограниченного acceptance; до этого публичная capability выключена. Failure приводит к disable/rollback и сохранению evidence.

`[REQ-RLX-003]` Полный месячный SLO не требуется до первого deploy. PRE_RELEASE использует production-like load; initial live acceptance — минимум 30 минут наблюдения по затронутому критичному flow без потери денег/данных и с нормальным error/latency. Далее действует rolling 30-day SLO; нарушения открывают incident и review статуса.

`[REQ-RLX-004]` Acceptance load manifest задаёт hardware/build, dataset size, tenants, auth, read/write mix, RPS, concurrency/think time, warm-up ≥ 5 минут и steady phase ≥ 30 минут. Порог 490 read RPS и 2 800 sessions — заданная контрольная цель, не заявленный измеренный production baseline. Сессии не означают 2 800 одновременных запросов; capacity должна доказываться отдельно от latency.

`[REQ-RLX-005]` Domain/audit/outbox атомарность даёт нулевую логическую потерю относительно восстановленной DB-транзакции. Она не даёт физический RPO 0 при потере площадки. Для обычных business данных RPO ≤ 15 минут; для принятого необратимого financial/legal command и evidence до внешней отправки нужен восстановимый durable intent/evidence вне отказавшей площадки либо эквивалентная доказанная схема нулевой потери этого класса.

`[REQ-RLX-006]` Если инфраструктура не обеспечивает требуемую сохранность irreversible intent/evidence, production money/signature capability остаётся закрытой до решения, а тесты не объявляют RPO 0. Внешняя банковская выписка помогает сверке, но не восстанавливает утраченное пользовательское согласие.

`[REQ-RLX-007]` Общий object-storage RPO ≤ 24 часов применим к воспроизводимым/некритичным файлам. Принятые подписанные документы, basis и юридически значимые evidence защищаются до ack/внешнего действия по более строгому профилю. Restore drill включает DB, objects, integrity и outbox replay без повторного внешнего эффекта.

`[REQ-RLX-008]` Error budget считается отдельно для first-party requests и end-to-end journey с внешними зависимостями; ожидаемые policy denials не 5xx. Planned maintenance не исключается задним числом. Incident owner, alert route и escalation реально проверяются.

# 10 Внешние блокеры и критерий завершения

## 10 1 External blocker record

Каждый внешний blocker содержит:

- ID и затронутый REQ/capability;
- точного внешнего владельца;
- чего не хватает: contract, credentials, certificate, agreement, CAPTCHA, signature, registration, approval;
- какие официальные источники проверены и когда;
- что уже реализовано внутри;
- contract test и fixture status;
- почему live test невозможен;
- минимальное действие владельца/партнёра;
- влияние на пользовательский flow;
- безопасный degraded/fallback path;
- maturity и запрещённый ложный статус.

## 10 2 INTERNAL EXHAUSTION

`INTERNAL_EXHAUSTION` допустим только если:

1.  весь возможный код, schema, UI, tests, contracts, fixtures, security и docs завершены;
2.  вся действительно независимая разрешённая внутренняя работа выполнена или доказанно отсутствует; новая authority не получалась обходным путём;
3.  остаются только внешние действия вне permissions Codex;
4.  каждый blocker оформлен по 10.1;
5.  ни один blocker не скрыт под `TODO`, mock success или optimistic label.

Внешне заблокированная capability может быть `CONTRACT_PENDING` или `EXTERNAL_ACCESS_PENDING`. Она не может получить `LIVE_ACCEPTED`. Если capability обязательна для заявленного production E2E, соответствующий R-блок и официальный процент остаются незавершёнными; Codex завершает состояние как `INTERNAL_EXHAUSTION`, а не `FULL PASS`. Необязательная или доказанно неприменимая capability не блокирует R-блок, если applicability versioned и подтверждена. Revenue Slice до реальной комиссии не получает PASS без фактического разрешённого денежного evidence; non-monetary acceptance нельзя выдавать за выручку.

# 11 Прогресс и отчётность

## 11 1 Два показателя

**Официальный показатель:**

`OVERALL_PRODUCTION_PROGRESS = сумма весов только R-блоков с PRODUCTION_PASS`

`PARTIAL`, `CODE_COMPLETE`, `PR_OPEN`, `CI_PARTIAL` и `DEPLOYED_NOT_ACCEPTED` дают 0 официальных points.

**Диагностический показатель текущей задачи:**

`CURRENT_TASK_EXECUTION = passed acceptance checks / total acceptance checks`

Он показывает движение внутри крупного R-блока, но не увеличивает официальный процент.

## 11 2 Формат каждого короткого статуса

    OVERALL: 31/100 = 31%
    CURRENT: R7.4 Canonical Deal — 18/23 checks
    STATE: PRE_RELEASE | DEPLOYING | LIVE_ACCEPTANCE | PRODUCTION_PASS | BLOCKED
    EXACT HEAD: <sha>
    PRODUCTION SHA: <sha or none>
    INTERNAL BLOCKERS: <count>
    EXTERNAL BLOCKERS: <count>
    NEXT: <одно конкретное действие>

`[REQ-PRG-001]` Процент указывается всегда.

`[REQ-PRG-002]` Процент не повышается за количество кода, commits, PR или effort.

`[REQ-PRG-003]` После сообщения статуса Codex продолжает текущую работу, если сессия и инструменты позволяют.

## 11 3 Прогресс этой редакции и бизнес результаты

Версия 2.1 сохраняет веса R0–R12, сумма 100, и расширяет критерии MASTER. Это новый acceptance baseline; проценты старых редакций не переносятся автоматически. Уже работающее исключается из реализации только по проверенному KEEP, оставаясь в регрессионной защите. Для закрытого блока обязательны все его применимые исходные и добавленные требования.

Стартовый зачёт по этой редакции: `0/100 = 0%`. Это отсутствие нового production evidence, не оценка всей платформы. Codex должен заменить стартовое значение результатом discovery, если подтверждены полные блоки. Документ сам по себе не начисляет production points.

Отдельно вести `TECHNICAL_DELIVERY`, `LIVE_CAPABILITY`, `COMMERCIAL_OUTCOME` и `EXTERNAL_APPROVALS`. Dashboard с корректным пустым состоянием может пройти собственную приёмку данных; он не доказывает клиентов, WTP или repeat. R7 не получает полный PASS без разрешённой фактической комиссии. Технические 100% нельзя представлять как выполненные бизнес-цели, если обязательный commercial gate остаётся открыт.

Каждый статус сообщает официальный процент, текущий slice/check count, exact SHA, production SHA, blocker и следующий шаг. Отчёт краткий и не требует ожидания ответа для уже разрешённого продолжения. Codex не обещает фоновую работу после завершения сессии; для продолжения сохраняет воспроизводимый execution-state, очередь и evidence.

# 12 Traceability и артефакты evidence

## 12 1 Матрица

Минимальные колонки `requirements-traceability.csv`:

`REQ_ID, SOURCE_ID, APPLICABILITY, REQUIREMENT_VERSION, R_BLOCK, DESCRIPTION, CODE_PATHS, DB_MIGRATIONS, CONFIG, TEST_IDS, CI_RUN, REVIEW, RELEASE_SHA, IMAGE_DIGEST, LIVE_EVIDENCE, STATUS, OWNER, UPDATED_AT`

`[REQ-TRC-001]` Каждый REQ этого документа получает строку.

`[REQ-TRC-002]` Один test может покрывать несколько REQ, но связь явная.

`[REQ-TRC-003]` Critical implementation path без REQ также фиксируется как orphan и устраняется либо обосновывается.

`[REQ-TRC-004]` Generated evidence привязано к exact SHA и не редактируется вручную после PASS.

## 12 2 Обязательные release artifacts

- implementation plan и dependency graph;
- gap map;
- requirement traceability;
- role/capability matrix;
- state machines и invariants;
- API/event schemas;
- migration and rollback plan;
- external source registry;
- external blocker registry;
- threat model;
- privacy/retention matrix;
- SBOM CycloneDX и SPDX;
- provenance/attestation;
- test/eval reports;
- load/SLO report;
- accessibility/i18n/mobile report;
- backup/restore evidence;
- release/live acceptance report;
- final truth.

# 13 Change control

`[REQ-CHG-001]` Codex может улучшать архитектуру и добавлять необходимое, если это уменьшает риск, стоимость владения или переделку и не расширяет бизнес scope произвольно.

`[REQ-CHG-002]` Нельзя самостоятельно удалить requirement, снизить SLO, ослабить security, заменить PostgreSQL authority, разрешить client authority или уменьшить acceptance.

`[REQ-CHG-003]` Material delta фиксируется до merge: `before → after → reason → alternatives → risk → evidence → impact on schedule/progress`.

`[REQ-CHG-004]` Срочное исправление production incident допускает сокращённый process только по documented emergency policy, с последующим полным evidence restoration.

## 13 1 Решения объединённой редакции
