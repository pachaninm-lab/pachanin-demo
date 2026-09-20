`[REQ-ECX-007]` Time-to-cash использует отдельные timestamps accepted → eligible → instruction → bank accepted/final → beneficiary received, если подтверждено → 1С reconciled. Показывать интервалы и aging, не обещать мгновенный расчёт при неизвестной банковской стадии.

`[REQ-ECX-008]` Тарифы фиксируются в версии сделки, имеют payer, fee basis, cap/floor, refund/correction rules и disclosure. Исходная гипотеза: низкий порог входа продавца; фиксированная/ограниченная orchestration fee покупателя и subscription. Не включать неограниченный процент GMV без решения и доказанной ценности.

`[REQ-ECX-009]` Core/BYOD, Procurement Control, Automation Pro, Gekta Pro/Enterprise и disclosed partner revenue различаются в entitlement и учёте. Разовая клиентская интеграция не считается recurring SaaS ARR и не создаёт форк ядра.

## 4 19 Подписки и коммерческий запуск

`[REQ-BLX-001]` Subscription, Mandate/Acceptance, BillingCycle, PaymentRequest/Status и Dunning отделены от settlement товаров. «Корпоративные подписки» — целевой внешний binding, требующий отдельного исследования договора и capabilities.

`[REQ-BLX-002]` Не более одного успешного начисления/списания на согласованный billing cycle; mandate scope/version, cancellation, retry policy и refund доступны и проверяемы. Повторный callback не продлевает платный период дважды.

`[REQ-BLX-003]` Ошибка подписки не удерживает товарные средства и не меняет права сторон действующей сделки. Billing отключён до собственного acceptance A23; он не блокирует первую защищённую сделку без подписочного сценария.

`[REQ-GTX-001]` CRM ведёт TARGET_ACCOUNT → QUALIFIED_PAIN → ECONOMIC_BUYER_IDENTIFIED → PROCESS_MAPPED → VALUE_BASELINED → COMMERCIAL_COMMITMENT → ONBOARDING → FIRST_VALUE → FIRST_TRANSACTION → REPEAT → EXPANSION. Переходы требуют owner, evidence и exit criteria; название стадии сопоставить с существующим CRM.

`[REQ-GTX-002]` Коммерческий план сохраняет гипотезу минимум 20 discovery-разговоров по двум сегментам и 1–3 anchor buyers. Это работа с разрешёнными контактами и реальными ответами, а не команда Codex массово писать или создавать клиентов. Отсутствие подтверждения остаётся бизнес-блокером.

`[REQ-GTX-003]` First-value сценарий: частная партия → конституция → shipment и пробы → расхождение качества → локальное решение → approved SettlementBasis → разрешённый банковский расчёт → документы/1С → фактически заработанная комиссия.

`[REQ-GTX-004]` Marketplace liquidity acceptance и first paid workflow acceptance раздельны. Нельзя заявлять network effect без реальной supply/demand liquidity; отсутствие публичного match не обнуляет подтверждённую Private/BYOD выручку.

`[REQ-GTX-005]` Scale gate требует willingness-to-pay, repeat, channel CAC, известную CM2 и снижаемую support intensity. Отрицательная CM2 допустима для ограниченного запуска только при явно утверждённой субсидии с cap, owner и end date; это не подтверждённая прибыльность.

`[REQ-GTX-006]` Сохранить как проверяемые коммерческие гипотезы, не гарантии и не backend SLO: implementation gross margin ≥ 40%, recurring margin ≥ 65%, CAC payback ≤ 12 месяцев, годовое retention ≥ 80%, первое годовое обязательство ≥ 60%, time-to-live 6–8 недель. Точный знаменатель и cohort definition обязательны до измерения.

`[REQ-GTX-007]` Kill/review triggers: нет повторяющейся дорогой проблемы, спроса, WTP или repeat; CM2 неизвестна; сопровождение растёт; красный legal gate. Codex реализует измерение и готовит evidence, но не придумывает коммерческое одобрение.

## 4 20 Корпоративное управление и границы бизнеса

`[REQ-CPX-001]` Corporate Governance Register хранит документы ООО, cap table с reconciliation 100%, полномочия, related parties/conflicts, contract register, IP register и legal opinions. Заполнять только подлинными предоставленными документами; подписант и собственник не выводятся из должности в UI.

`[REQ-CPX-002]` IP chain of title покрывает код, дизайн, IaC, тесты, документы, datasets, domains и trademarks; договоры сотрудников/подрядчиков, лицензии OSS и данных, notices и исключения фиксируются. AI-generated код не освобождает от provenance/license checks.

`[REQ-CPX-003]` RACI разделяет инициатора, согласующего, исполнителя, контролёра и плательщика услуги. Услуга или надбавка партнёра не включается в счёт без согласия уполномоченного плательщика. CEO platform visibility не даёт неограниченного доступа к закрытым данным чужих организаций.

`[REQ-CPX-004]` Company finance включает P&L, cash/runway, 13-week cash calendar, plan/fact, бюджет, обязательства, payroll/contractor costs, hiring approvals и scale gates. Не превращать платформу в ERP хозяйства или HR-систему без отдельного scope decision.

`[REQ-CPX-005]` ClaimRegistry хранит текст публичного обещания, evidence, owner, allowed surfaces, reviewedAt/expiresAt. Истёкшие и неподтверждённые claims о клиентах, выручке, сертификации, банковской гарантии или полной интеграции не публикуются.

# 5 Сквозные требования качества

## 5 1 Единый UX и публичная шапка

`[REQ-UX-001]` Главная и все публичные страницы, достижимые из неё, используют один `PublicHeader` contract: один компонент, одинаковые высота, логотип, размер и позиция логотипа, базовая навигация, RU/EN/ZH, вход/регистрация и mobile behaviour.

`[REQ-UX-002]` Страница может добавлять contextual action, но не может менять базовую геометрию шапки.

`[REQ-UX-003]` Контур охватывает как минимум Home, About, How it works, Gekta/AI, Trust, Contact, Privacy, Terms, Oferta, Login, Register и публичные Docs; фактический route inventory может расширить список.

`[REQ-UX-004]` Все авторизованные зоны используют один App Shell, design tokens, component system, navigation model и content language.

`[REQ-UX-005]` Главная кабинета отвечает за 5–10 секунд: где я, что происходит, что требуется сейчас, срок, деньги и что будет после действия.

`[REQ-UX-006]` Next-best-action детерминирован серверными state/policy/permissions; AI может объяснять, но не назначать authority.

`[REQ-UX-007]` Все экраны имеют loading, empty, partial, degraded, offline, forbidden, validation error, retryable error, non-retryable error и success states.

`[REQ-UX-008]` Формы сохраняют draft, показывают inline validation, единицы, формат, последствия и не заставляют повторно вводить уже известные данные.

`[REQ-UX-009]` Таблицы имеют mobile alternative, saved views, filter state, sorting, export authority и понятный empty state.

`[REQ-UX-010]` Критичное действие показывает объект, изменение, деньги/право, необратимость, получателя и способ восстановления.

## 5 2 Роли и 13 кабинетов

`[REQ-ROL-001]` Точный список 13 production кабинетов извлекается из фактического server-side role/route registry; Codex не придумывает и не переименовывает роли по памяти.

`[REQ-ROL-002]` Для каждого кабинета создаётся матрица `роль × объект × read/create/update/approve/sign/pay/admin`.

`[REQ-ROL-003]` Изменение роли посреди сделки не создаёт утечки и тупика; доступ пересчитывается сервером.

`[REQ-ROL-004]` Founder/CEO получает контролируемый режим «Открыть как роль» во все 13 кабинетов без подмены identity, tenant или audit actor.

`[REQ-ROL-005]` Вход в роль и возврат в Control Center не теряют контекст; banner явно показывает special mode, организацию, роль и ограничения.

`[REQ-ROL-006]` Любое действие Founder в role mode имеет реального actor, effective role, reason и audit; high-risk action требует обычной authority и MFA.

## 5 3 Mobile i18n и accessibility

`[REQ-A11-001]` Browser matrix: Safari iOS, Chrome Android, Chrome/Edge/Firefox desktop на поддерживаемых актуальных версиях, определённых в repository policy.

`[REQ-A11-002]` Обязательна проверка реальных mobile viewport, safe area, touch target не менее WCAG 2.2 AA baseline, keyboard, focus, screen reader labels и zoom 200%.

`[REQ-A11-003]` RU/EN/ZH проверяются на длинных строках, CJK fonts, pluralization, dates, units, decimal separators, currency и legal authoritative language.

`[REQ-A11-004]` WCAG 2.2 AA является минимальным уровнем; critical flows проходят automated и manual keyboard/screen-reader acceptance.

`[REQ-A11-005]` Слабая сеть не приводит к двойной mutation: draft, upload progress, idempotent retry, reconnect и conflict resolution обязательны.

## 5 4 Frontend и backend SLO

SLO измеряются на production-like профиле данных и нагрузки, без отключения security и авторизации.

| **Метрика**                       | **Обязательный порог**                                                   |
|-----------------------------------|--------------------------------------------------------------------------|
| LCP p75 mobile                    | `≤ 2.5 s`                                                                |
| INP p75                           | `≤ 200 ms`                                                               |
| CLS p75                           | `≤ 0.1`                                                                  |
| Authenticated read API p95 / p99  | `≤ 600 ms / ≤ 1.5 s`                                                     |
| Transactional write API p95 / p99 | `≤ 1.0 s / ≤ 2.5 s` без внешнего ожидания                                |
| Online PostgreSQL query p95 / p99 | `≤ 100 ms / ≤ 300 ms`                                                    |
| 5xx rate                          | `< 0.5%` за 15 минут и `< 0.1%` за месяц для first-party API             |
| Availability                      | `≥ 99.9%` в месяц, исключая согласованное обслуживание                   |
| Authorized read capacity          | контрольная цель `≥ 490 read rps`; методика в 9.5                        |
| Одновременные пользователи        | контрольная цель `2 800 sessions`; не одновременных запросов             |
| DB pool peak utilization          | `< 80%` при acceptance load                                              |
| Outbox queue age p95 / max        | `≤ 5 s / ≤ 60 s` в штатном режиме                                        |
| Webhook acknowledgement           | `≤ 2 s`, обработка асинхронно                                            |
| Webhook processing p95            | `≤ 30 s`, если provider contract не строже                               |
| Regulatory delta sync             | `≤ 15 min` после доступности источника, если контракт поддерживает delta |
| Bank event reconciliation p95     | `≤ 5 min` после получения события                                        |
| Daily full reconciliation         | завершено до `06:00 Europe/Moscow`                                       |

`[REQ-PER-001]` Если фактический production baseline выше, регрессия ниже него запрещена.

`[REQ-PER-002]` Тяжёлые отчёты и bulk operations выполняются асинхронно с progress, cancellation и resource limits.

`[REQ-PER-003]` Load test включает tenant isolation, auth, realistic indexes, connection pool, queues и внешние stubs с заданной latency/error distribution.

`[REQ-PER-004]` Любое исключение из SLO требует измерения, root cause, компенсирующего контроля и time-bounded decision record; P0 money/authority paths исключений не допускают.

## 5 5 Reliability backup и DR

| **Объект**                                       | **RPO**               | **RTO**             | **Дополнительное требование**                          |
|--------------------------------------------------|-----------------------|---------------------|--------------------------------------------------------|
| PostgreSQL business data                         | `≤ 15 min`            | `≤ 60 min`          | PITR или эквивалент; restore drill каждые 30 дней      |
| Audit и transactional outbox принятых транзакций | логическая потеря `0` | вместе с PostgreSQL | одна транзакция с domain mutation                      |
| Object/document storage                          | по классу, см. 9.5    | `≤ 4 h`             | некритичные файлы ≤ 24 h; irreversible evidence строже |
| Runtime configuration/secrets references         | `≤ 24 h`              | `≤ 2 h`             | секреты не попадают в backup evidence                  |

`[REQ-REL-001]` Ежедневный backup не считается защитой без успешного автоматизированного restore verification.

`[REQ-REL-002]` Последний успешный restore drill не старше 30 дней; backup freshness и failure alert видимы Founder/operations.

`[REQ-REL-003]` Deployment имеет rollback runbook. Database migrations используют expand → migrate/backfill → contract.

`[REQ-REL-004]` Contract phase запрещён до подтверждения, что текущая и предыдущая release версии совместимы в установленном rollback window.

`[REQ-REL-005]` Необратимая migration требует verified backup, dry-run на production-like copy, measured duration, locking analysis и отдельный risk record.

`[REQ-REL-006]` Деградация внешнего сервиса не должна разрушать core; UI показывает источник, freshness, очередь и допустимое действие.

## 5 6 Security privacy и supply chain

`[REQ-SEC-001]` Server-side authorization, least privilege, tenant isolation, MFA для high-risk действий, CSRF/XSS/SSRF/injection defenses, rate limit и session controls обязательны.

`[REQ-SEC-002]` Secret scanning, SAST, dependency audit, CodeQL или эквивалент, container/image scan и IaC scan входят в release gates.

`[REQ-SEC-003]` Для release генерируются CycloneDX и SPDX SBOM, immutable provenance, exact source SHA, build digest и deployment digest.

`[REQ-SEC-004]` `CRITICAL_VULNERABILITIES=0`, `HIGH_VULNERABILITIES=0`, `UNKNOWN_PRODUCT_CODE=0`, `UNRESOLVED_LICENSES=0`.

`[REQ-SEC-005]` Зависимости и build actions pinned; floating `latest`, незафиксированный binary и сеть-зависимая недетерминированная сборка запрещены.

`[REQ-SEC-006]` Логи не содержат secret, private key, full token, необязательные персональные данные, банковские реквизиты или полный provider payload.

`[REQ-SEC-007]` Privacy classification хранит owner, purpose, legal basis, retention policy version, deletion/anonymization rule, backup retention и export restriction.
