| **ID** | **Решение и причина**                                                                                                                              |
|--------|----------------------------------------------------------------------------------------------------------------------------------------------------|
| V21-01 | Executive Layer и каноническая защищённая сделка MASTER включены в 4.8–4.20 и 8.1–8.2; исторические claims/status/SHA не импортируются как текущие |
| V21-02 | Четыре коммерческих origin сохранены; first paid Private/BYOD/Partner не ждёт публичной ликвидности                                                |
| V21-03 | Sequential означает один delivery slice через production; prerequisite promotion документируется, чтобы исключить циклы R4/R7/R8/R9                |
| V21-04 | PRE_RELEASE 100/100 и post-deploy live PASS разделены; никакой циклической приёмки                                                                 |
| V21-05 | Timeout банка означает unknown outcome; фраза «деньги не списались» без подтверждения запрещена                                                    |
| V21-06 | RPO уточнён по классам данных; атомарность DB не выдаётся за межплощадочную нулевую потерю                                                         |
| V21-07 | Сбер, Сфера Перевозки и Корпоративные подписки сохраняются целевыми bindings, без выдуманной доступности/API                                       |
| V21-08 | Legal/tax/future-effective положения превращены в applicability gates с обязательной свежей проверкой и профильным approval                        |
| V21-09 | Бизнес-метрики, договоры, реальные люди и repeat не подменяются кодом; 100% без обязательного внешнего evidence запрещены                          |
| V21-10 | Приоритет скорости и инициативы не отменяет permissions, обязательные проверки, денежное согласие, legal/security boundaries или инструкции среды  |

# 14 Запрещённые shortcuts

Запрещено считать задачей или доказательством:

- `MOCK_OK`, demo fallback или synthetic success в production;
- screenshot вместо backend/state evidence;
- зелёный UI при failed provider operation;
- перенос review с другого SHA;
- blind rerun без root-cause классификации;
- merge с красным обязательным gate;
- ручное изменение production DB ради прохождения E2E;
- hardcoded tenant/role/status/payment/finality;
- client-selected authority;
- float для денег;
- silent retry внешней mutation с unknown outcome;
- копирование чужого product code;
- новый parallel core;
- скрытый TODO вместо внешнего blocker;
- «временно» отключённые security/RLS/idempotency/audit;
- тест реальной подписью, платежом или government mutation без явного разрешения;
- отправка внешней коммуникации без одобрения владельца;
- заявление `PRODUCTION_PASS` или общего `100%` без exact-SHA live evidence; PRE_RELEASE 100/100 относится только к доказанной готовности к deploy.

# 15 Первые действия Codex после получения ТЗ

1.  Прочитать применимые инструкции репозитория и сохранить unrelated пользовательские изменения.
2.  Получить актуальный `origin/main`; определить exact SHA, production SHA, migration head, open PR и release state.
3.  Найти и сопоставить существующие реализации R0–R12; ничего не начинать заново.
4.  Создать/обновить gap map, traceability, dependency graph, risk register и execution state.
5.  Проверить, какие remaining-блоки уже фактически удовлетворяют новому DoD; не доверять старому PASS.
6.  Начать R0.1 и последовательно выполнять атомарные срезы до `PRODUCTION_PASS` по dependency queue. Discovery/docs/checks являются подэтапами delivery, а не поводом для бессмысленного redeploy; если изменения не нужны, текущий exact release принимается по свежим доказательствам KEEP без повторного кодирования.
7.  В каждом статусе указывать официальный процент и diagnostic progress текущей задачи.

Стартовый статус:

    OVERALL: 0/100 = 0%
    CURRENT: R0.1 Repository and production inventory — 0/N checks
    STATE: PRE_RELEASE
    EXACT HEAD: resolve from origin/main
    PRODUCTION SHA: resolve from REG.RU
    INTERNAL BLOCKERS: unknown until discovery
    EXTERNAL BLOCKERS: unknown until discovery
    NEXT: read governance and establish exact factual state

# 16 Финальный результат

ТЗ выполнено только когда одновременно истинны все условия:

- R0–R12 получили `PRODUCTION_PASS`;
- `OVERALL_PRODUCTION_PROGRESS = 100/100 = 100%`;
- реальный пользователь проходит revenue E2E до доказанной комиссии ООО;
- Founder управляет платформой и безопасно открывает все 13 фактических кабинетов;
- публичная часть имеет единую шапку и единый продуктовый язык;
- аналитический, финансовый и Founder dashboards разделены и используют реальные данные;
- ФНС и применимые regulatory contours честно встроены в сделку;
- внешние integrations provider-neutral и не создают false success;
- Гекта работает как безопасный встроенный помощник, а обязательные процессы не зависят от неё;
- SLO, RPO/RTO, security, supply chain, privacy, mobile, accessibility, RU/EN/ZH, load, rollback и restore доказаны;
- code, schema, docs, tests, CI evidence и production exact SHA согласованы;
- известных незакрытых P0/P1/P2 дефектов итогового acceptance scope нет; отсутствие неизвестных дефектов не гарантируется;
- ни одна незавершённая внешняя capability не названа live-accepted.

### 16 1 Итоговый статус Codex

    OVERALL: 100/100 = 100%
    STATE: FULL PASS
    EXACT MAIN: <sha>
    PRODUCTION SHA: <same sha>
    PRODUCTION DIGEST: <digest>
    DB SCHEMA HEAD: <migration>
    EXTERNAL LIVE CAPABILITIES: <verified list>
    EXTERNAL BLOCKERS: <honest residual list or 0>
    REVENUE E2E: PASS
    FINAL TRUTH: <repository path>

# 17 Источники и карта покрытия MASTER

## 17 1 Канон и исторические материалы

Входы редакции: основной post-registration master из pasted(3).txt; «Тз дизайн 10.09.»; «Тз фгисы»; ТЗ для Codex v2.0; MASTER_DOCUMENT_v5.3_EXECUTIVE_CANONICAL_02.09.2026 и последнее указание владельца об исполнительном режиме. Требования UX, ФГИС и v2.0 сохраняются вместе с добавленными условиями MASTER; более узкая первая коммерческая поставка не удаляет оставшуюся программу.

В MASTER применять Executive Control Layer и канонические части I, III, IV, VI, VII, VIII и IX; исторические части II/V, старые проценты, статусы, PR и SHA использовать лишь как указатели для discovery. Protected Deal v5.2 и раздел 247 задают обязательные контрольные требования; их датированные выводы о коде требуют повторной проверки. Изменения v2.1 перечислены в 13.1. При новой неразрешённой коллизии остановить затронутое изменение, записать conflict и запросить решение, не выбирать удобный менее строгий вариант.

Исключены из повторной реализации только подтверждённые KEEP; источник не исключается целиком по названию «старый». Каждое исходное требование получает disposition KEEP_REGRESSION, REMAINING, CONDITIONAL, SUPERSEDED_WITH_REASON либо EXTERNAL_BLOCKER. Маркетинговые гипотезы хранятся отдельно от фактической готовности. Доля совпавших ключевых слов не является процентом покрытия.

## 17 2 Проверка внешних источников

Перед реализацией конкретного внешнего поведения Codex проверяет официальную документацию, действующую редакцию и применимость. Source registry хранит проверенную страницу/документ, timestamp, hash, edition, effective dates, owner, affected REQ и approval. Ниже стартовые первичные указатели, не подтверждение конкретного доступа или готовая юридическая квалификация.

- ФНС, переход ставок и операций: [официальное разъяснение ФНС](https://www.nalog.gov.ru/rn74/ifns/ifns32/info/16596381/). Не применять одну ставку ко всем товарам и сторонам; расчёт выбирается по подтверждённой policy.
- Минтранс, ГИС ЭПД и документы: [официальный раздел ГИС ЭПД](https://www.mintrans.gov.ru/activities/376). Проверять действующие требования и исключения конкретного маршрута, а не только общую дату перехода.
- Правовые акты: [официальное опубликование](https://publication.pravo.gov.ru/). Для каждого legal gate нужна конкретная применимая редакция и профессиональное заключение, а не ссылка на главную страницу вместо evidence.
- Технические первичные источники: документация используемого PostgreSQL и frameworks, репозиторий/документация фактического провайдера, [WCAG 2.2](https://www.w3.org/TR/WCAG22/), [Core Web Vitals](https://web.dev/articles/vitals), [OWASP ASVS](https://owasp.org/www-project-application-security-verification-standard/), [NIST SSDF](https://csrc.nist.gov/Projects/ssdf). Версии фиксировать при execution; список не является заявлением о сертификации или соответствии стандарту.

## 17 3 Реестр возможностей MASTER

Все идентификаторы Capability Matrix MASTER сохранены ниже. Source ID не означает DONE. Колонка назначения указывает основной домен и семейства REQ; точный delivery owner и атомарные tests Codex связывает при R0. Базовые identity/registration строки проверяются на регрессию, а не запускают переписывание регистрации.
