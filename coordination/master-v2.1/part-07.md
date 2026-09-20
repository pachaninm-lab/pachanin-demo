`[REQ-R8-008]` Delta sync checkpointed, idempotent, replayable; delete/cancel/supersede не теряются.

`[REQ-R8-009]` Создание/отмена СДИЗ и lot реализуются только после подтверждения contract, access, signing и legal preconditions.

`[REQ-R8-010]` ACK не равен final success; финальность определяется official response/reconciliation.

### ЗСН Семеноводство и Сатурн

`[REQ-R8-011]` Production Field связывает parcel geometry, organization right, season, crop, source evidence и freshness.

`[REQ-R8-012]` Geometry проходит validity, CRS, area, overlap и boundary tests.

`[REQ-R8-013]` Seeds flow хранит sale submission, status и buyer confirmation как отдельные external operations.

`[REQ-R8-014]` Saturn adapter metadata-driven: формы/справочники не зашиваются необоснованно; domain хранит product, batch, plan, act и external state.

### ЭПД и conditional systems

`[REQ-R8-015]` EPD states: `DRAFT`, `READY_TO_SIGN`, `PARTIALLY_SIGNED`, `SIGNED`, `SENT_TO_OPERATOR`, `OPERATOR_ACCEPTED`, `DELIVERED_TO_GIS_EPD`, `GOVERNMENT_ACCEPTED`, `CORRECTION_REQUIRED`, `CANCELLED`, `FINALIZED`.

`[REQ-R8-016]` Оператор ЭПД не является core authority; менять оператора можно через binding.

`[REQ-R8-017]` Argus-Fito, VetIS и Росаккредитация активируются только при подтверждённой applicability; отсутствие необходимости не считается незавершённой интеграцией.

`[REQ-R8-018]` Никакой реальной government mutation не выполняется только ради acceptance.

`R8_PASS`: полный internal production-grade contour PASS; каждая capability имеет честную maturity. Внешне заблокированные capabilities не получают `LIVE_ACCEPTED`, но не блокируют завершение независимой внутренней части. Официальный R8 progress засчитывается только по Definition of Done, указанному в разделе 10.

## R9 1С ЭДО ЭПД банки логистика и партнёры 9 points

### Атомарные срезы

1.  `R9.1` 1С import/export/reconciliation.
2.  `R9.2` ЭДО documents, signatures, corrections и archive.
3.  `R9.3` Multi-bank settlement и finance requests.
4.  `R9.4` Logistics bindings: own fleet, direct carrier, ATI reference.
5.  `R9.5` Laboratory/surveyor/elevator/insurance partner factory.
6.  `R9.6` Provider onboarding, commercial rules, SLA и live/blocked matrix.

### Требования и приёмка

`[REQ-R9-001]` 1С поддерживает партии, контрагентов, договоры, первичные документы, payments/settlements и reconciliation через собственный adapter contract.

`[REQ-R9-002]` Accounting conflict видим, не перезаписывается молча; выбранное разрешение versioned и audited.

`[REQ-R9-003]` ЭДО provider-neutral; документы, corrections, rejection, signature evidence и delivery status маппятся в Document Engine.

`[REQ-R9-004]` Multi-bank поддерживает несколько providers и schemes; Сбер может быть reference adapter, но не частью core.

`[REQ-R9-005]` ATI может быть reference logistics adapter; отсутствие ATI не блокирует own fleet/direct carrier.

`[REQ-R9-006]` Partner onboarding создаёт provider, capabilities, coverage, SLA, price rule, credentials reference, binding, contract tests и operational owner.

`[REQ-R9-007]` Provider outage имеет fallback/degraded policy без false success.

`R9_PASS`: каждый внутренне доступный adapter contract-tested и live-accepted; недоступные внешние договоры/credentials оформлены как точные blockers; core E2E продолжает работать допустимым путём.

## R10 Гекта 8 points

### Атомарные срезы

1.  `R10.1` Context assembly и source permissions.
2.  `R10.2` Native UX, SSE и conversation state.
3.  `R10.3` Explain/summarize/compare/simulate/draft/recommend.
4.  `R10.4` Next action и safe tools.
5.  `R10.5` Model/policy/tool lifecycle и rollback.
6.  `R10.6` 45k+ eval, red-team, RU/EN/ZH, latency и outage acceptance.

### Приёмка

`[REQ-R10-001]` Ответы grounded в разрешённых platform sources, различают факт, вывод, гипотезу и риск.

`[REQ-R10-002]` Prompt injection в document/provider/user content не изменяет system policy, role, tenant или tool authority.

`[REQ-R10-003]` Draft никогда не выглядит как подписанный/отправленный документ.

`[REQ-R10-004]` Гекта корректно работает в контексте всех фактических ролей и Deal 360.

`[REQ-R10-005]` Обязательные workflows выдерживают отключение AI.

`R10_PASS`: все AI critical thresholds из раздела 6 PASS на exact model/policy/tool versions; production canary и rollback доказаны.

## R11 Ролевой UX настройки support и reality acceptance 5 points

### Атомарные срезы

1.  `R11.1` Единый App Shell, navigation и Action Center.
2.  `R11.2` Task Inbox, notifications, search и collaboration.
3.  `R11.3` Personal, organization, workspace, deal defaults, provider, security, integration, signature, finance, Gekta, privacy и developer settings.
4.  `R11.4` Role-specific settings и smart defaults.
5.  `R11.5` Support/customer success и assisted-digital paths.
6.  `R11.6` Reality acceptance для всех ролей, mobile и degraded scenarios.

### Требования и приёмка

`[REQ-R11-001]` Настройка показывает scope, inheritance, effective date, affected workflows и rollback/default.

`[REQ-R11-002]` Smart default объясним, может быть изменён уполномоченным пользователем и не меняет юридическое действие без confirmation.

`[REQ-R11-003]` Notification дедуплицируется, имеет severity, channel, quiet hours, escalation и deep link на действие.

`[REQ-R11-004]` Global search permission-aware и ищет сделки, партии, организации, документы, задачи и provider operations.

`[REQ-R11-005]` Support видит разрешённый context и audit, но не получает скрытый доступ к tenant/secret.

`[REQ-R11-006]` Ни один кабинет не считается законченным без первого входа, основной работы, настроек, mobile, error, external outage, exception и recovery acceptance.

`R11_PASS`: exact role registry покрыт reality matrix; известных P0/P1/P2 UX defects = 0.

## R12 Финальное hardening 4 points

### Атомарные срезы

1.  `R12.1` Security/supply-chain/privacy final gates.
2.  `R12.2` Full load, soak, concurrency и recovery.
3.  `R12.3` Backup restore и rollback drill.
4.  `R12.4` Full S01–S15 cross-role production acceptance.
5.  `R12.5` Documentation, runbooks, final truth и 100/100 release.

### Приёмка

`[REQ-R12-001]` Все REQ имеют traceability и evidence; orphan requirement и orphan critical code path = 0.

`[REQ-R12-002]` Все SLO, RPO/RTO, security, accessibility, i18n, mobile, tenant, ledger и AI gates PASS.

`[REQ-R12-003]` Release exact-current-main, deployment exact digest, DB head и live version совпадают.

`[REQ-R12-004]` Rollback/restore выполнены практически, а не описаны только в runbook.

`[REQ-R12-005]` Final truth содержит честный список live-accepted external capabilities и оставшихся contractual/credential blockers.

`R12_PASS`: финальные gates этого блока доказаны; итог 100% возможен только если независимо закрыты R0–R11. Сам R12 не проверяется условием, включающим его собственный ещё не начисленный вес.

# 8 Cross role acceptance scenarios

| **ID** | **Сценарий**                                                | **Обязательное доказательство**                                        |
|--------|-------------------------------------------------------------|------------------------------------------------------------------------|
| S01    | Seller создаёт declared batch и публикует непроверенный lot | Маркировка, risk acknowledgement, допустимые и заблокированные этапы   |
| S02    | Buyer создаёт procurement request и получает seller offer   | Канонический offer, permissions, notifications, diff                   |
| S03    | Переговоры меняют цену, количество и доставку               | Immutable versions, accepted snapshot, netback/landed cost             |
| S04    | Частичное резервирование и конкурирующие buyer              | No double sell, concurrency/retry evidence                             |
| S05    | Договор и документы                                         | Version/digest, authority preflight, correction path                   |
| S06    | Смена машины/водителя и слабая сеть                         | Idempotent field flow, no duplicate event                              |
| S07    | Лабораторное отклонение                                     | Independent evidence, formula adjustment, соседние роли                |
| S08    | Частичная поставка и частичный спор                         | Quantity ledger, hold/adjustment, unresolved balance                   |
| S09    | Изменение роли посреди сделки                               | Немедленный server-side access update, no leak/dead end                |
| S10    | ФГИС недоступна или stale                                   | Degraded state, queue/reconciliation, correct blocking stage           |
| S11    | Bank webhook дублируется/запаздывает/неясен                 | Idempotency, unknown outcome, reconciliation, no double posting        |
| S12    | Комиссия ООО                                                | Rule snapshot, ledger separation, accrual/collection/refund            |
| S13    | Founder открывает каждый из 13 ЛК                           | 13/13 open/action/return, banner, audit, no authority bypass           |
| S14    | Гекта получает prompt injection и просит high-risk tool     | Injection blocked, preview/confirmation, unauthorized side effect = 0  |
| S15    | Rollback и восстановление                                   | Previous release compatibility, DB restore, queue recovery, live smoke |

`[REQ-ACC-001]` Каждый сценарий исполняется с positive, negative, retry, concurrent и recovery вариантами там, где применимо.

`[REQ-ACC-002]` E2E не заменяет domain/contract/integration/security tests; test pyramid обязателен.

`[REQ-ACC-003]` Production acceptance не использует реальные юридические или денежные mutation без отдельного разрешённого тестового механизма.

## 8 1 Приёмка защищённой сделки из MASTER

Сценарии A01–A24 проверяются сверх S01–S15. Каждый содержит Given/When/Then, точный REQ, роли, данные, expected domain и external state, negative branch, cleanup policy, test ID и evidence. Автотестовый контур использует явно маркированные test fixtures; production не получает демонстрационные бизнес-данные.

| **ID** | **Сценарий и проверяемый результат**                                                                |
|--------|-----------------------------------------------------------------------------------------------------|
| A01    | Полный happy path одного транша до банковского finality, комиссии, документов и сверки              |
| A02    | Два транша; спор второго удерживает только разрешённую спорную часть                                |
| A03    | Недостача в пути; расчёт по принятому количеству и локальный dispute                                |
| A04    | Груз не прибыл; нет автоматической выплаты, custody и incident сохранены                            |
| A05    | Качество хуже; корректировка только по согласованной формуле и показателю                           |
| A06    | Конфликт лабораторий; контрольная проба/арбитраж, undisputed release по policy                      |
| A07    | ЭПД unavailable; pending и запрет преждевременного затронутого действия                             |
| A08    | Bank timeout; UNKNOWN, reconciliation, без слепого повтора или заявления об отсутствии списания     |
| A09    | Duplicate callback; один эффект, одинаковый воспроизводимый результат                               |
| A10    | Callback amount/currency mismatch; block и incident                                                 |
| A11    | Администратор меняет сумму напрямую; deny, только corrective workflow с evidence и MFA              |
| A12    | Потеря связи при upload; resume без дубля, до ack нет accepted evidence                             |
| A13    | Водитель/провайдер запрашивает чужую финансовую информацию; deny на API и в export                  |
| A14    | Замена счёта получателя; authority, MFA, risk policy, уведомление и version без retroactive reroute |
| A15    | Спор без scope/amount; validation deny, сумма выводится из основания                                |
| A16    | Решение выше threshold; другой approver, MFA, expiry, self-approval deny                            |
| A17    | Provider не live; capability недоступна, simulation не становится production authority              |
| A18    | Crash после durable callback; replay сохраняет ровно один business effect                           |
| A19    | Удаление/подмена evidence; deny или контролируемая superseding correction, integrity evidence       |
| A20    | Close; балансы, документы, basis и EvidenceBundle согласованы                                       |
| A21    | Целевой EPD binding; разрешённый live E2E, correction/cancellation и повтор callback                |
| A22    | Provider restriction; запрещён обход новым binding/beneficiary или ручным unlock                    |
| A23    | Подписка с mandate; один charge/cycle и изоляция от денег сделки                                    |
| A24    | Incident drill; реальные primary/backup, ack/update, recovery reconciliation и postmortem           |

Protected Deal P0 включает A01–A22 и A24. A23 обязателен перед включением billing и входит в полный scope, но не prerequisite первой сделки без подписки. Неприменимый маршрутный шаг обосновывается applicability record; нельзя объявить весь P0 неприменимым, чтобы получить PASS.

## 8 2 Контрольные gates раздела 247 MASTER

P0-01 private visibility; P0-02 constitution; P0-03 tranches; P0-04 bank money flow; P0-05 quality/sample custody; P0-06 partial release; P0-07 scoped disputes; P0-08 EvidenceService; P0-09 DealPassport; P0-10 durable adapters; P0-11 maker/checker; P0-12 rollout/incident metrics; P0-13 целевой ЭПД; P0-14 provider compliance; P0-15 primary/backup incident team. Для каждого завести самостоятельную строку source traceability с префиксом `MASTER53:P0-`.
