# ТЕХНИЧЕСКОЕ ЗАДАНИЕ
## GrainFlow — Платформа цифровизации сделок в АПК
### Версия 3.0-PRODUCTION | Федеральный масштаб
**Дата:** 27 июня 2026  
**Статус:** Финальная версия для промышленной разработки  
**Основание:** Синтез ТЗ v1, ТЗ v2-FINAL, gap-анализа реальной архитектуры (repo state: platform-v7)

---

## СОДЕРЖАНИЕ

1. [Цели и позиционирование](#1-цели-и-позиционирование)
2. [Текущее состояние и принципы эволюции](#2-текущее-состояние)
3. [Архитектура production-grade](#3-архитектура)
4. [Инфраструктурный фундамент](#4-инфраструктура)
5. [Функциональные модули по ролям](#5-роли-и-функционал)
6. [Полный цикл сделки](#6-цикл-сделки)
7. [Финансовый контур](#7-финансовый-контур)
8. [Документооборот и УКЭП](#8-документооборот)
9. [Логистика и IoT](#9-логистика)
10. [Интеграционный слой и SDK](#10-интеграции)
11. [Безопасность и Compliance](#11-безопасность)
12. [ML и аналитика](#12-ml-и-аналитика)
13. [DevOps и наблюдаемость](#13-devops)
14. [UI/UX и мобильная стратегия](#14-uiux)
15. [Тестирование и качество](#15-тестирование)
16. [Роадмап реализации](#16-роадмап)
17. [Критерии приёмки](#17-acceptance-criteria)

---

## 1. ЦЕЛИ И ПОЗИЦИОНИРОВАНИЕ

### 1.1 Миссия платформы

GrainFlow — федеральная цифровая платформа для сквозной автоматизации зерновых сделок: от поля производителя до судна экспортёра. Платформа является **операционной системой зернового рынка**: она не заменяет участников, а даёт им единую цифровую среду с юридически значимым документооборотом, защищёнными деньгами и прозрачной логистикой.

### 1.2 Целевые группы

| Группа | Роль на платформе | Ценность |
|--------|-------------------|----------|
| Производители (фермеры, агрохолдинги) | Продавцы | Доступ к рынку, безопасная оплата, цифровые документы |
| Трейдеры / Переработчики | Покупатели | Проверенный товар, история поставщика, автодокументы |
| Элеваторы | Хранение + приёмка | Цифровые акты, интеграция с весовыми |
| Логистические операторы | Перевозка | Электронные накладные, GPS, расчёт тарифов |
| Экспортёры | Внешний рынок | Incoterms-автоматика, таможня, мультивалюта |
| Лаборатории / Инспекторы | Качество | Сертификаты с УКЭП, привязка к сделке |
| Банки / Факторинговые компании | Финансирование | Скоринг на данных платформы, escrow-интеграция |
| Государственные регуляторы | Надзор | API-доступ к агрегированным данным, ФГИС-синхронизация |
| Кооперативы | Объединение | Multi-tenancy, общий пул заявок |

### 1.3 Масштаб и целевые показатели (3 года)

| Метрика | Год 1 (пилот) | Год 2 (рост) | Год 3 (федеральный) |
|---------|--------------|-------------|---------------------|
| Активные организации | 500 | 5 000 | 50 000 |
| Сделок в месяц | 200 | 5 000 | 50 000 |
| GMV в месяц | 500 млн ₽ | 10 млрд ₽ | 100 млрд ₽ |
| Регионов присутствия | 3 | 30 | 85 |
| Одновременных пользователей | 500 | 5 000 | 50 000 |

---

## 2. ТЕКУЩЕЕ СОСТОЯНИЕ

### 2.1 Что уже реализовано (подтверждено кодом)

**Архитектурный фундамент (закрыт):**
- Deal lifecycle state machine (draft → signed → shipped → paid)
- RBAC с 11 ролями + object/tenant/route scope boundaries
- Money integer (копейки), ledger-invariants, ledger-source
- Settlement engine, DisputeMoneyHold, DisputeEvidence, EvidenceFile
- Outbox pattern (OutboxEntry + OutboxService)
- Audit logging (AuditEvent)
- Lab module (LabSample + LabTest + LabsService)
- Document versioning (DealDocument)
- JWT auth, ActionExecutorService (RBAC enforce)
- 684 unit/integration теста, 26 CI/CD workflows
- 100+ UI-роутов для всех ролей (platform-v7)
- Anti-fraud module (skeleton)

**Критические технические долги (блокеры production):**
- База данных: **SQLite → требует миграции на PostgreSQL**
- Нет Kafka, Redis, ClickHouse
- Нет УКЭП / КриптоПро
- Нет MFA
- Все интеграции в sandbox/fixture режиме

### 2.2 Принцип эволюции

Разработка ведётся **эволюционно**: текущий код является фундаментом, не выбрасывается. Каждый этап добавляет production-слой поверх существующих boundaries.

**Приоритет принятия решений:**
1. Не сломать работающий код
2. Каждый шаг должен быть обратимым
3. Сначала data safety, потом feature richness
4. Интеграции через adapter pattern — live можно подключить в любой момент без изменения бизнес-логики

---

## 3. АРХИТЕКТУРА

### 3.1 Принципы

| Принцип | Реализация |
|---------|-----------|
| Domain-Driven Design | Bounded contexts, агрегаты, репозитории |
| Event Sourcing (для сделок) | DealEvents — append-only с hash chain |
| CQRS | Раздельные read/write модели для сделок и аудита |
| Outbox Pattern | Гарантированная доставка событий через БД |
| Saga Orchestration | Оркестратор сделки (не хореография) |
| Adapter Pattern | Все интеграции через контракт-интерфейс, mock/live взаимозаменяемы |
| Zero Trust | Каждый запрос верифицируется, нет доверенных сетей |
| Defense in Depth | WAF → Rate Limit → Auth → RBAC → Object Scope → RLS |

### 3.2 Ограниченные контексты (Bounded Contexts)

```
┌─────────────────────────────────────────────────────────────────┐
│                        API GATEWAY                              │
│          (Rate Limiting | Auth | WAF | Routing)                 │
└──────────────────────┬──────────────────────────────────────────┘
                       │
         ┌─────────────┴──────────────┐
         ▼                            ▼
┌─────────────────┐        ┌─────────────────────┐
│   IAM Context   │        │  Deal & Transaction  │
│  (Auth, RBAC,   │        │  Engine (Saga,       │
│  MFA, УКЭП,     │        │  State Machine,      │
│  Sessions)      │        │  Events, Outbox)     │
└─────────────────┘        └──────────┬──────────┘
                                      │
         ┌────────────────────────────┼────────────────────────────┐
         ▼                            ▼                            ▼
┌──────────────┐          ┌──────────────────┐         ┌──────────────────┐
│  Финансовый  │          │   Документы &    │         │  Логистика &     │
│  контур      │          │   ЭДО & УКЭП     │         │  Трекинг & IoT   │
│  (Escrow,    │          │   (Templates,    │         │  (Route, GPS,    │
│  Ledger,     │          │   Signatures,    │         │  Elevator,       │
│  Settlement, │          │   EDO Adapters)  │         │  Weighing)       │
│  Factoring)  │          └──────────────────┘         └──────────────────┘
└──────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│              Integration Layer (Adapter SDK)                    │
│  ФГИС | ФНС | ФТС | ЭДО | GPS | Банк | РЖД | Лаборатории      │
└─────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│          Analytics & ML Layer (ClickHouse + Airflow)            │
│    Цены | Урожайность | Скоринг | Риски | GMV | Unit Economics  │
└─────────────────────────────────────────────────────────────────┘
```

### 3.3 Технологический стек (production target)

| Слой | Технология | Обоснование |
|------|-----------|-------------|
| **Backend** | NestJS (TypeScript) | Существующий стек, оставляем |
| **Frontend** | Next.js 14 + React 18 | Существующий стек |
| **ORM** | Prisma | Существующий стек |
| **База данных** | **PostgreSQL 16** (миграция с SQLite) | RLS, JSONB, надёжность, шардирование |
| **Message Broker** | **Kafka** (3 брокера, RF=3) | Гарантированная доставка, event log |
| **Cache** | **Redis Cluster** (3M+3R) | Сессии, rate limit, очереди |
| **Search** | Elasticsearch / OpenSearch | Поиск заявок, полнотекст |
| **Analytics DB** | **ClickHouse** | Sub-second аналитика, GMV, отчёты |
| **ETL** | Apache Airflow | Пайплайны данных, регуляторные отчёты |
| **File Storage** | S3-compatible (Yandex Object Storage / MinIO) | Документы, фото, evidence |
| **Container** | Docker (distroless) | Существующий |
| **Orchestration** | **Kubernetes** (3M+3W, HPA, VPA) | Горизонтальное масштабирование |
| **Service Mesh** | Istio / Linkerd | mTLS между сервисами |
| **API Gateway** | Kong / KrakenD | Rate limit, auth, routing, WAF |
| **Secrets** | **HashiCorp Vault** | Все секреты, ротация, токенизация |
| **CI/CD** | GitHub Actions + ArgoCD | Существующий + GitOps |
| **IaC** | Terraform + Helm | Воспроизводимая инфраструктура |
| **Observability** | Prometheus + Grafana + Loki + Tempo | Метрики, логи, трейсы |
| **УКЭП** | КриптоПро DSS (облако) | Юридически значимые подписи по 63-ФЗ |
| **ML** | Python (scikit-learn, LightGBM) + FastAPI | Предсказательные модели |

---

## 4. ИНФРАСТРУКТУРА

### 4.1 Миграция SQLite → PostgreSQL (Этап 0, БЛОКЕР)

Это первоочерёдная задача. Без PostgreSQL невозможны: RLS, транзакционные гарантии денег, шардирование, production-scale.

**Шаги миграции:**
1. Написать новые Prisma-схемы для PostgreSQL (с типами UUID, JSONB, TIMESTAMPTZ)
2. Добавить поля `hash`, `prevHash` в AuditEvent и DealEvent
3. Написать миграционные скрипты (Flyway / Prisma migrate)
4. Настроить Row-Level Security по `tenant_id` и `organization_id`
5. Добавить индексы: B-tree по FK, GIN по JSONB-полям
6. Настроить 1 master + 2 read-replicas
7. Запустить dual-write (SQLite + PostgreSQL) на переходный период
8. Верифицировать данные, переключить, отключить SQLite

**Схема PostgreSQL (расширение существующей):**

```sql
-- Новые поля в существующих таблицах
ALTER TABLE "AuditEvent" 
  ADD COLUMN hash TEXT NOT NULL DEFAULT '',
  ADD COLUMN prev_hash TEXT,
  ADD COLUMN tenant_id UUID NOT NULL DEFAULT gen_random_uuid();

ALTER TABLE "Deal"
  ADD COLUMN tenant_id UUID NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN saga_state JSONB DEFAULT '{}';

-- Row-Level Security
ALTER TABLE "Deal" ENABLE ROW LEVEL SECURITY;
CREATE POLICY deal_tenant_isolation ON "Deal"
  USING (tenant_id = current_setting('app.current_tenant')::UUID);

-- Partition audit log by month (append-only, high volume)
CREATE TABLE "AuditEvent" (
  id UUID DEFAULT gen_random_uuid(),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  tenant_id UUID NOT NULL,
  actor_id UUID NOT NULL,
  actor_role TEXT NOT NULL,
  action TEXT NOT NULL,
  object_type TEXT NOT NULL,
  object_id UUID,
  before_state JSONB,
  after_state JSONB,
  hash TEXT NOT NULL,
  prev_hash TEXT,
  ip INET,
  user_agent TEXT,
  PRIMARY KEY (id, timestamp)
) PARTITION BY RANGE (timestamp);

-- Запрет на UPDATE/DELETE для append-only
CREATE RULE no_update_audit AS ON UPDATE TO "AuditEvent" DO INSTEAD NOTHING;
CREATE RULE no_delete_audit AS ON DELETE TO "AuditEvent" DO INSTEAD NOTHING;
```

### 4.2 Kafka — Event Backbone

**Топики:**
```
grainflow.deals.events          # Все события сделки
grainflow.deals.commands        # Команды оркестратора
grainflow.payments.events       # Платёжные события
grainflow.logistics.events      # GPS, статусы ТС
grainflow.documents.events      # ЭДО статусы
grainflow.integrations.inbound  # Входящие события от интеграций
grainflow.integrations.outbound # Исходящие в интеграции
grainflow.audit.events          # Audit trail (append-only)
grainflow.notifications         # Уведомления
grainflow.outbox.dead-letter    # DLQ
```

**Требования:** RF=3, min.insync.replicas=2, retention=30 дней, log compaction для state topics.

### 4.3 Kubernetes манифесты

```yaml
# HPA для deal-service
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
spec:
  minReplicas: 2
  maxReplicas: 20
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
    - type: External
      external:
        metric:
          name: kafka_consumer_lag
        target:
          type: AverageValue
          averageValue: "100"
```

### 4.4 Vault — управление секретами

- Все API-ключи интеграций (ФГИС, ФНС, банки, ЭДО) — только в Vault
- Dynamic secrets для PostgreSQL (short-lived credentials)
- PKI для mTLS-сертификатов между сервисами
- Transit Secrets Engine для column-level encryption ПДн
- Автоматическая ротация каждые 30 дней

### 4.5 Хранение и резервное копирование

| Данные | Хранилище | Retention | Backup |
|--------|-----------|-----------|--------|
| PostgreSQL (transactional) | Primary + 2 read-replicas | Бессрочно | WAL streaming + daily snapshot, 30 дней |
| Kafka (events) | 3 brokers | 30 дней hot | S3 для cold (1 год) |
| S3 (документы, фото) | Yandex Object Storage | Бессрочно | Cross-region replication |
| ClickHouse (аналитика) | 2 shards + 2 replicas | 5 лет | Daily backup → S3 |
| Audit logs (PostgreSQL partition) | WORM-like (no DELETE rule) | 5 лет | Immutable S3 bucket |
| Redis | Cluster, AOF persistence | 7 дней | RDB snapshot daily |

---

## 5. РОЛИ И ФУНКЦИОНАЛ

### 5.1 Ролевая модель (RBAC + ABAC)

Существующие 11 ролей сохраняются и расширяются:

| Роль | Описание | Ключевые права |
|------|----------|----------------|
| `FARMER` | Производитель / Продавец | Создание заявок, управление лотами, просмотр своих сделок |
| `BUYER` | Трейдер / Переработчик / Покупатель | Поиск заявок, создание предложений, управление закупками |
| `LOGISTICIAN` | Диспетчер / Логист | Назначение ТС, маршруты, управление флотом |
| `DRIVER` | Водитель | Подтверждение рейса, GPS-отметки, фото при погрузке/выгрузке |
| `ELEVATOR` | Оператор элеватора | Приёмка, взвешивание, акты, несоответствия |
| `LAB` | Лаборант | Создание проб, ввод результатов, выдача сертификатов |
| `ACCOUNTING` | Бухгалтер / Финансист | Просмотр платежей, счетов, актов сверки |
| `EXECUTIVE` | Руководитель (read-only aggregate) | Дашборд по организации, отчёты, нет прав на изменение |
| `SUPPORT_MANAGER` | Поддержка платформы | Просмотр сделок для помощи пользователям, без финансовых прав |
| `ADMIN` | Администратор платформы | Полный доступ, управление организациями, арбитраж |
| `GUEST` | Незарегистрированный | Публичные страницы, форма регистрации |
| `COMPLIANCE_OFFICER` | Офицер комплаенса | Аудит-лог, KYC/AML, блокировки, отчёты регулятору |
| `ARBITRATOR` | Арбитр спорных ситуаций | Дело спора, заморозка денег, вынесение решения |

**Новые роли (12-13):** `COMPLIANCE_OFFICER` и `ARBITRATOR` выделяются в отдельные роли с отдельным cockpit'ом и MFA-обязательным доступом.

### 5.2 ABAC правила (через OPA / Policy Engine)

```rego
# Пользователь видит только сделки своей организации
allow if {
    input.action == "deal:read"
    deal := data.deals[input.resource.id]
    deal.seller_org_id == input.user.organization_id
}

# Арбитр видит только назначенные ему дела
allow if {
    input.action == "dispute:read"
    dispute := data.disputes[input.resource.id]
    dispute.arbitrator_id == input.user.id
    input.user.role == "ARBITRATOR"
}

# EXECUTIVE видит только агрегаты — не сырые платежи
deny if {
    input.user.role == "EXECUTIVE"
    input.resource.type == "payment"
    input.action != "payment:aggregate:read"
}
```

### 5.3 Cockpit'ы по ролям (durable backend + UI)

Каждый cockpit = выделенный read-model (CQRS) + UI + permissions.

#### Farmer Cockpit
- Дашборд: активные заявки, статусы сделок, деньги к получению
- Создание заявки с умным заполнением (история + рыночные цены)
- Карточка сделки: полный timeline событий
- Финансовая выписка: платежи, комиссии, налоговые документы
- Интеграция с 1С (выгрузка УПД, счетов)

#### Buyer Cockpit
- Карта заявок (геовизуализация, кластеры, heatmap)
- Сравнение до 5 заявок по параметрам
- История поставщика: рейтинг, среднее время отгрузки, отзывы
- Портфель закупок: план vs факт по культурам
- Форвардные контракты с привязкой к индексу

#### Driver App (мобильный, offline-first)
- Задание рейса: маршрут, адреса, контакты
- GPS-отметка автоматически при въезде в геозону
- Фото-фиксация: погрузка (пломбы, номер ТС, накладная), выгрузка (состояние груза)
- Подпись актов (УКЭП или простая ЭП водителя)
- Offline-очередь: все действия сохраняются локально, синхронизируются при появлении сети

#### Elevator Cockpit
- Приёмка груза: ввод веса брутто/нетто, влажности, засорённости
- Сравнение с заявленными в сделке параметрами → автоматический расчёт отклонений и штрафов
- Фото-фиксация: зерно, весовая распечатка, пломбы
- Электронный акт приёмки с УКЭП
- История хранения: остатки по культурам, температура, срок

#### Lab Cockpit
- Заказ анализа: привязка к сделке, место и время пробоотбора
- Ввод результатов: показатели по ГОСТ (влажность, натура, сорная примесь, белок, клейковина, ИДК, ФПД, падение)
- Автоматическая проверка на соответствие + расчёт градации и цены
- Генерация сертификата качества с УКЭП аккредитованного лаборанта
- Импорт из лабораторного оборудования (CSV, XML)

#### Arbitrator Cockpit (новый, durable)
- Список назначенных споров с приоритетом
- Дело спора: все доказательства, переписка, история сделки
- Инструменты: запрос доп. доказательств, консультация эксперта, запрос в лабораторию
- Вынесение решения: сумма возврата, виновная сторона, обоснование
- Автоматическое исполнение решения через settlement engine

#### Compliance Cockpit (новый, durable)
- Очередь KYC/AML проверок (новые организации)
- Санкционный скрининг (OFAC, ЕС, ООН, Росфинмониторинг)
- Флаги подозрительной активности от anti-fraud модуля
- Блокировка пользователей / организаций с audit-записью
- Регуляторные отчёты: Росфинмониторинг (форматы XML), Роскомнадзор, Минсельхоз

#### Executive Cockpit (read-only aggregate)
- GMV, количество сделок, средний чек — в реальном времени
- Тепловая карта активности по регионам
- Воронка: заявки → предложения → сделки → оплаченные
- NPS, время закрытия сделки, количество споров
- СТРОГО без прав на изменение данных и без обхода RBAC

#### Admin Ops Dashboard
- Управление организациями: верификация, блокировка, изменение тарифа
- Управление пользователями: роли, MFA-статус, сессии, принудительный logout
- Системное состояние: статусы интеграций, outbox backlog, failed events
- Ручное вмешательство в saga: пауза, перезапуск, override статуса (с audit-записью)
- Конфигурация тарифов и комиссий платформы

#### Support Ops Queue
- Очередь обращений пользователей
- Просмотр сделки от имени пользователя (read-only, с записью в audit)
- История изменений: кто что делал и когда
- Быстрые действия: сброс пароля, разблокировка аккаунта, эскалация в admin

---

## 6. ПОЛНЫЙ ЦИКЛ СДЕЛКИ

### 6.1 Статусная машина

```
DRAFT → PUBLISHED → NEGOTIATING → CONTRACT_PENDING → 
CONTRACT_SIGNED → PAYMENT_AWAITING → PAYMENT_RESERVED → 
LOGISTICS_ASSIGNED → IN_TRANSIT → DELIVERED → 
QUALITY_CHECK → QUALITY_ACCEPTED → QUALITY_DISPUTED →
DOCUMENTS_PENDING → DOCUMENTS_SIGNED → 
SETTLEMENT_PENDING → SETTLED → CLOSED
                                        ↕
                              DISPUTED → ARBITRATION → 
                              ARBITRATION_RESOLVED → SETTLED / CANCELLED
                                        ↕
                              CANCELLED (с фиксацией причины и штрафов)
```

**Правила переходов:**
- Каждый переход фиксируется в `DealEvent` с `hash` и `prevHash` (blockchain-like chain)
- Откат после `PAYMENT_RESERVED` невозможен без арбитра
- Авто-переход в `CANCELLED` при отсутствии действий > N дней (настраивается)
- Параллельные ветки: логистика и ЭДО идут асинхронно через Kafka, но блокируют финальные статусы

### 6.2 Saga Orchestrator

```typescript
// Пример шага Saga с idempotency
interface SagaStep {
  stepId: string;           // deal_id + step_name
  execute(): Promise<void>;
  compensate(): Promise<void>;
  timeout: number;          // мс
  maxRetries: number;       // 3 попытки
}

// Шаги Saga для сделки
const dealSagaSteps: SagaStep[] = [
  { stepId: 'validate_parties',     ... }, // Верификация обеих сторон
  { stepId: 'reserve_payment',      ... }, // Резервирование денег
  { stepId: 'generate_contract',    ... }, // Генерация контракта
  { stepId: 'sign_contract',        ... }, // УКЭП обеими сторонами
  { stepId: 'assign_logistics',     ... }, // Назначение перевозчика
  { stepId: 'track_delivery',       ... }, // Мониторинг доставки
  { stepId: 'accept_quality',       ... }, // Результаты лаборатории
  { stepId: 'sign_acceptance_act',  ... }, // Акт приёмки с УКЭП
  { stepId: 'release_payment',      ... }, // Освобождение денег
  { stepId: 'send_to_edo',          ... }, // Отправка УПД в ЭДО
  { stepId: 'close_deal',           ... }, // Закрытие и рейтинг
];
```

**Требования к Saga:**
- Idempotency key = `${deal_id}:${step_name}:${attempt}`
- Dead Letter Queue при исчерпании retry
- Human intervention: любой шаг можно приостановить и возобновить через Admin Ops
- Timeout: каждый шаг имеет максимальное время (настраивается в конфиге сделки)

### 6.3 Evidence Chain (иммутабельная)

```typescript
interface DealEvent {
  id: string;
  dealId: string;
  eventType: DealEventType;
  actorId: string;
  actorRole: UserRole;
  tenantId: string;
  payload: Record<string, unknown>;
  timestamp: Date;
  hash: string;     // SHA-256(id + dealId + eventType + payload + prevHash)
  prevHash: string; // hash предыдущего события этой сделки
}
// Нарушение цепочки = индикатор фальсификации данных
```

### 6.4 E2E Deal Simulation (обязательный тест)

Полный сценарий, автоматизированный в Playwright:

```
1.  Регистрация FARMER + BUYER (2 организации)
2.  KYC/AML верификация обеих (compliance flow)
3.  FARMER: создание заявки (пшеница 4 класс, 500 т, Тамбов)
4.  BUYER: поиск → фильтр → найдена заявка
5.  BUYER: отправка предложения (цена, условия)
6.  FARMER: контрпредложение (торг, 2 итерации)
7.  Согласие обеих сторон → CONTRACT_PENDING
8.  Автогенерация договора из шаблона
9.  УКЭП: обе стороны подписывают (КриптоПро DSS sandbox)
10. BUYER: оплата → PAYMENT_RESERVED (escrow)
11. LOGISTICIAN: назначение ТС и водителя
12. DRIVER: подтверждение рейса, GPS-трекинг (mock)
13. DRIVER: фото погрузки, статус IN_TRANSIT
14. ELEVATOR: приёмка, взвешивание, акт
15. LAB: пробоотбор → результаты → сертификат УКЭП
16. Качество = соответствует → QUALITY_ACCEPTED
17. ELEVATOR + BUYER: подпись акта приёмки-передачи (УКЭП)
18. Settlement engine: release → FARMER получает деньги минус комиссия
19. ЭДО: УПД отправлен в Диадок → получен → подписан
20. Сделка CLOSED → обе стороны оставляют рейтинг
21. Проверка: evidence chain целостна, audit log полон, деньги сбалансированы
```

---

## 7. ФИНАНСОВЫЙ КОНТУР

### 7.1 Модель денег

**Инвариант:** все суммы хранятся в **копейках (INTEGER)**. Никакого FLOAT/DECIMAL для денег.

```typescript
type Kopecks = number; // всегда целое
const toKopecks = (rubles: number): Kopecks => Math.round(rubles * 100);
const toRubles = (kopecks: Kopecks): string => (kopecks / 100).toFixed(2);
```

### 7.2 Ledger (двойная запись)

```sql
CREATE TABLE ledger_entry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID REFERENCES "Deal"(id),
  entry_type TEXT NOT NULL, -- 'RESERVE' | 'HOLD' | 'RELEASE' | 'REFUND' | 'COMMISSION' | 'PLATFORM_FEE'
  debit_account_id UUID NOT NULL,
  credit_account_id UUID NOT NULL,
  amount_kopecks BIGINT NOT NULL CHECK (amount_kopecks > 0),
  currency TEXT NOT NULL DEFAULT 'RUB',
  reference TEXT,           -- номер платёжного поручения / ссылка на outbox
  idempotency_key TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Инвариант: сумма всех debit = сумма всех credit для каждой сделки
-- Проверяется через PostgreSQL CONSTRAINT DEFERRABLE INITIALLY DEFERRED
```

### 7.3 Жизненный цикл денег в сделке

```
BUYER оплачивает →
  RESERVE: buyer_account → escrow_account (hold до выполнения условий)
  
Условия выполнены (акт подписан, качество принято) →
  RELEASE: escrow_account → seller_account (сумма - комиссия)
  COMMISSION: escrow_account → platform_account

Спор открыт →
  HOLD: escrow_account → dispute_hold_account (заморозка)
  
Арбитр: виновен продавец →
  REFUND: dispute_hold_account → buyer_account
  PENALTY: dispute_hold_account → platform_account (штраф)
  
Арбитр: виновен покупатель →
  RELEASE: dispute_hold_account → seller_account
```

### 7.4 Транзакционные инварианты (PostgreSQL)

```sql
-- Функция проверки баланса (вызывается триггером)
CREATE OR REPLACE FUNCTION check_money_invariants()
RETURNS TRIGGER AS $$
BEGIN
  -- Нет отрицательного баланса
  IF (SELECT balance_kopecks FROM accounts WHERE id = NEW.debit_account_id) < NEW.amount_kopecks THEN
    RAISE EXCEPTION 'Insufficient balance for account %', NEW.debit_account_id;
  END IF;
  -- Резерв не превышает остаток
  IF NEW.entry_type = 'RESERVE' THEN
    IF (SELECT reserved_kopecks + NEW.amount_kopecks FROM accounts 
        WHERE id = NEW.debit_account_id) > 
       (SELECT balance_kopecks FROM accounts WHERE id = NEW.debit_account_id) THEN
      RAISE EXCEPTION 'Reserve exceeds balance for account %', NEW.debit_account_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### 7.5 Escrow (Номинальный счёт)

- Открытие через банк-партнёр (Тинькофф Бизнес / Точка / Альфа API)
- Условия освобождения: подписание акта приёмки + сертификат качества + отчёт логиста
- Автоматическое освобождение по триггерам из saga
- Многосторонний escrow: продавец / покупатель / логист / платформа

### 7.6 Комиссии платформы

| Модель | Параметры |
|--------|-----------|
| Базовая (% от GMV) | 0.5% продавец + 0.5% покупатель |
| Подписка (SaaS) | Фиксированная плата / месяц для крупных участников |
| Гибридная | % + минимум + потолок |
| Скидки | Объёмные (> 100 сделок/мес), партнёрские, early-adoption |

**Правило прозрачности:** калькулятор комиссии показывается до подтверждения сделки. Пользователь видит: сумма сделки → комиссия платформы → комиссия ЭДО → НДС → итого к получению.

### 7.7 Факторинг

- Заявка на факторинг: выбор фактора (банк/МФО из справочника), загрузка документов
- Автоматический скоринг на данных платформы (история сделок, объёмы, рейтинг)
- Интеграция с факторинговой компанией через API-адаптер
- Уведомления о решении, подписание договора факторинга (УКЭП)
- Контроль погашения: уведомления о просрочках → блокировка новых сделок

### 7.8 Bank Reconciliation

- Ежедневный автоматический импорт выписки с банковского счёта (API банка или MT940)
- Автоматическое сопоставление: каждый платёж → ссылка на сделку
- Несопоставленные платежи → очередь для ручной обработки (Support Ops)
- Отчёт сверки: ожидаемые vs фактические поступления за период

---

## 8. ДОКУМЕНТООБОРОТ И УКЭП

### 8.1 УКЭП (Квалифицированная электронная подпись)

**Юридическое основание:** 63-ФЗ «Об электронной подписи», ГОСТ Р 34.10-2012, 34.11-2012.

**Реализация через КриптоПро DSS (облачная подпись):**
```typescript
interface UkepAdapter {
  // Получить список сертификатов пользователя
  getCertificates(userId: string): Promise<Certificate[]>;
  
  // Подписать документ (возвращает PKCS#7 detached signature)
  signDocument(documentHash: string, certificateId: string): Promise<Signature>;
  
  // Проверить подпись
  verifySignature(documentHash: string, signature: Signature): Promise<VerificationResult>;
  
  // Проверить статус сертификата (OCSP)
  checkCertificateStatus(certificateId: string): Promise<'valid' | 'revoked' | 'expired'>;
}
```

**Провайдеры (через adapter pattern, взаимозаменяемы):**
- КриптоПро DSS (приоритетный для облачной подписи)
- Контур.Крипто
- Такском
- JaCarta / Рутокен (плагин для физических токенов)

**Когда требуется УКЭП:**
- Подписание договора купли-продажи
- Подписание акта приёмки-передачи
- Подписание сертификата качества
- Подписание транспортной накладной (ЭТН)
- Аннулирование документа
- Решение арбитра

**Batch-подписание:** до 50 документов одним действием (для ЭДО-потоков).

**Мониторинг сертификатов:** уведомление за 30/14/7/1 день до истечения.

### 8.2 Шаблоны документов

| Документ | Триггер генерации | Кто подписывает |
|----------|-------------------|-----------------|
| Договор купли-продажи | Согласие обеих сторон | Продавец + Покупатель (УКЭП) |
| Спецификация | Вместе с договором | Продавец + Покупатель (УКЭП) |
| Транспортная накладная (ЭТН) | Назначение ТС | Логист + Водитель (УКЭП/ПЭП) |
| Акт приёмки-передачи | Доставка + приёмка | Продавец + Покупатель + Элеватор (УКЭП) |
| Сертификат качества | Результаты лаборатории | Лаборант (УКЭП) |
| Счёт на оплату / УПД | Подписание акта | Продавец (УКЭП) |
| Акт сверки | По запросу | Обе стороны (УКЭП) |
| Претензия | Инициация спора | Сторона-инициатор (УКЭП) |
| Решение арбитра | Завершение арбитража | Арбитр (УКЭП) |

**Технология:**
- Шаблоны: Handlebars / DOCX с маркерами `{{variable}}`
- Конвертация в PDF/A-3 (архивный стандарт) после подписания
- Версионирование шаблонов: semver, неизменяемость подписанных версий
- Хранение: S3 + хеш SHA-256 в БД

### 8.3 ЭДО (Электронный документооборот)

**Операторы (adapter pattern):**

```typescript
interface EdoAdapter {
  sendDocument(doc: EdoDocument): Promise<EdoSendResult>;
  getDocumentStatus(externalId: string): Promise<EdoStatus>;
  receiveIncoming(): Promise<EdoDocument[]>;
  signIncoming(externalId: string, signature: Signature): Promise<void>;
  rejectDocument(externalId: string, reason: string): Promise<void>;
}

// Реализации
class DiadokAdapter implements EdoAdapter { ... }
class TakskomAdapter implements EdoAdapter { ... }
class SbisAdapter implements EdoAdapter { ... }
class MockEdoAdapter implements EdoAdapter { ... } // для тестов
```

**Поддерживаемые операторы:**
1. Контур.Диадок (приоритет MVP)
2. Такском
3. СБИС
4. 1С-ЭДО
5. ПаперТрей (международный)

**Автоматизация:**
- Входящий УПД → автоматическая привязка к сделке по ИНН + сумме + дате
- Исходящий УПД → отправка при подписании акта
- Статусы ЭДО → уведомления в чат сделки
- Архив: все документы с SHA-256, доступен для скачивания 5 лет

### 8.4 Document Storage Architecture

```
Загрузка файла:
  Client → API (presigned S3 URL) → S3
  API: создать запись Document(hash, size, mimeType, s3Key, uploadedBy)
  
Скачивание:
  Client → API (проверка прав) → presigned S3 URL (TTL 15 мин)
  
Версионирование:
  S3 Versioning включён → каждый upload = новая версия
  БД хранит историю версий с актором
  
Immutability:
  Подписанные документы: S3 Object Lock (COMPLIANCE mode, 7 лет)
  Hash проверяется при каждом скачивании
```

---

## 9. ЛОГИСТИКА И IoT

### 9.1 Управление транспортом

**Справочник ТС:**
- Тип: автомобиль, ж/д вагон, судно, речное судно
- Грузоподъёмность, вместимость (м³), объём кузова
- Водитель / машинист / капитан (привязка через UserOrganization)
- Документы: СТС, страховка ОСАГО, разрешение на негабаритный груз

**Статусная машина ТС:**
```
FREE → ASSIGNED → LOADING → IN_TRANSIT → UNLOADING → MAINTENANCE → FREE
```

### 9.2 GPS и геозоны

```typescript
interface GpsAdapter {
  // Real-time позиция (polling каждые 30 сек)
  getCurrentPosition(vehicleId: string): Promise<GeoPoint>;
  
  // История трека
  getTrack(vehicleId: string, from: Date, to: Date): Promise<GeoPoint[]>;
  
  // Подписка на события геозоны
  onGeofenceEvent(vehicleId: string, zones: Geofence[]): Observable<GeofenceEvent>;
}

// Реализации
class GlonassAdapter implements GpsAdapter { ... }   // ГЛОНАСС
class YandexTelemAdapter implements GpsAdapter { ... } // Яндекс.Телематика
class DriverAppAdapter implements GpsAdapter { ... }   // мобильное приложение водителя
class MockGpsAdapter implements GpsAdapter { ... }     // для тестов
```

**Геозоны:**
- Создаются автоматически из адресов сделки (загрузка, выгрузка, элеватор, порт)
- Автоматический переход статуса ТС при въезде/выезде
- Уведомления: опоздание > 30 мин, отклонение от маршрута > 5 км, простой > 2 часов

### 9.3 Документы логистики

| Документ | Формат | Интеграция |
|----------|--------|-----------|
| Электронная транспортная накладная (ЭТН) | ГИС ЭПД (Минтранс) | API Минтранса |
| Ж/д накладная | РЖД ЭТРАН | РЖД API |
| CMR (международная) | EU standard | Ручной ввод + УКЭП |
| Bill of Lading | Портовые операции | Портовые системы |
| Путевой лист | Электронный (МЭ ПЛ) | ГИС ЭПД |

### 9.4 Элеватор — durable runtime

```typescript
interface ElevatorRuntime {
  // Приёмка груза
  createAcceptanceAct(shipmentId: string, data: AcceptanceData): Promise<Act>;
  
  // Взвешивание (интеграция с весовым оборудованием)
  recordWeighing(actId: string, weighingData: WeighingResult): Promise<void>;
  
  // Расчёт отклонений и штрафов
  calculateDiscrepancy(claimed: Quality, actual: Quality): Promise<Discrepancy>;
  
  // Фото-фиксация
  attachPhoto(actId: string, photoMeta: PhotoMeta): Promise<void>;
  
  // Подписание акта УКЭП
  signAct(actId: string, signature: UkepSignature): Promise<SignedAct>;
}
```

**Интеграция с весовыми:**
- Импорт из файлов (CSV, XML форматы Мера, Тензо-М, Весы ВА)
- API-интеграция (при поддержке оборудования)
- Ручной ввод с фото-подтверждением весового чека

### 9.5 Ж/д логистика

- Учёт вагонного парка: собственные, арендованные, привлечённые
- Заявка ГУ-12 (заявка на перевозку): через РЖД ЭТРАН API или ручной ввод
- Ж/д накладная (форма ГУ-29): генерация из шаблона + интеграция с ЭТРАН
- Отслеживание вагонов: ЭТРАН API / ГВЦ ОАО «РЖД»
- Демередж: автоматический расчёт при простое вагона > нормы

---

## 10. ИНТЕГРАЦИОННЫЙ СЛОЙ И SDK

### 10.1 Принцип Integration SDK

**Ключевая идея:** каждая интеграция реализована как сменный адаптер. Платформа работает на `MockAdapter` в sandbox, на `LiveAdapter` в production. Смена без изменения бизнес-логики.

```typescript
// Контракт адаптера (интерфейс)
interface IntegrationAdapter<TRequest, TResponse> {
  readonly name: string;
  readonly version: string;
  readonly mode: 'mock' | 'sandbox' | 'live';
  
  execute(request: TRequest): Promise<TResponse>;
  healthCheck(): Promise<HealthStatus>;
  
  // Для event-driven интеграций
  subscribe?(handler: (event: IntegrationEvent) => Promise<void>): void;
}

// Реестр адаптеров
class IntegrationRegistry {
  register(name: string, adapter: IntegrationAdapter): void;
  get<T extends IntegrationAdapter>(name: string): T;
  healthCheckAll(): Promise<Record<string, HealthStatus>>;
}
```

### 10.2 Матрица интеграций

| Система | Адаптер | Приоритет | Статус |
|---------|---------|-----------|--------|
| **ФГИС «Зерно»** (Минсельхоз) | `FgisZernoAdapter` | MVP | Mock → Live |
| **ФНС** (проверка ИНН/ОГРН) | `FnsAdapter` | MVP | Mock → Live |
| **Контур.Диадок** (ЭДО) | `DiadokAdapter` | MVP | Sandbox → Live |
| **КриптоПро DSS** (УКЭП) | `KryptoproAdapter` | MVP | Sandbox → Live |
| **Банк** (escrow, выписка) | `BankAdapter` | MVP | Mock → Live |
| **ГЛОНАСС / GPS** | `GpsAdapter` | MVP | DriverApp → ГЛОНАСС |
| **ФТС** (таможня) | `FtsAdapter` | Этап 2 | Mock → Live |
| **Россельхознадзор** | `RshnAdapter` | Этап 2 | Mock → Live |
| **РЖД ЭТРАН** | `RzdAdapter` | Этап 2 | Mock → Live |
| **ГИС ЭПД** (Минтранс, ЭТН) | `GisEpdAdapter` | Этап 2 | Mock → Live |
| **Такском / СБИС** (ЭДО) | `TakskomAdapter` | Этап 2 | Sandbox → Live |
| **НБКИ / Эквифакс** (БКИ) | `BkiAdapter` | Этап 3 | Mock → Live |
| **Росфинмониторинг** (AML) | `AmlAdapter` | Этап 2 | Mock → Live |
| **MarineTraffic** (суда) | `MarineAdapter` | Экспорт | Mock → Live |
| **Яндекс.Карты / 2GIS** | `MapsAdapter` | MVP | Live |
| **СМЭВ** (межведомственный обмен) | `SmevAdapter` | Этап 3 | Mock → Live |

### 10.3 ФГИС «Зерно» — детальная интеграция

```typescript
interface FgisZernoAdapter extends IntegrationAdapter {
  // Проверка сертификата на партию
  checkCertificate(lotId: string): Promise<GrainCertificate>;
  
  // Регистрация партии (для продавца)
  registerLot(lot: GrainLot): Promise<FgisLotId>;
  
  // Подтверждение отгрузки
  confirmShipment(lotId: FgisLotId, shipmentData: ShipmentData): Promise<void>;
  
  // Подтверждение приёмки
  confirmAcceptance(lotId: FgisLotId, acceptanceData: AcceptanceData): Promise<void>;
  
  // Классификатор культур ФГИС
  getCrops(): Promise<FgisCrop[]>;
  
  // Статусы партии
  getLotStatus(fgisLotId: FgisLotId): Promise<FgisLotStatus>;
}
```

### 10.4 Webhook Security (входящие события)

```typescript
interface WebhookSecurityConfig {
  secret: string;           // HMAC-SHA256 ключ (из Vault)
  timestampTolerance: number; // секунды (рекомендуется 300)
  idempotencyStore: Redis;  // хранение обработанных event_id
}

function verifyWebhook(
  payload: Buffer,
  headers: IncomingHttpHeaders,
  config: WebhookSecurityConfig
): WebhookVerificationResult {
  // 1. Проверка подписи: HMAC-SHA256(secret, timestamp + "." + payload)
  const expectedSig = createHmac('sha256', config.secret)
    .update(`${headers['x-timestamp']}.${payload}`)
    .digest('hex');
  
  if (!timingSafeEqual(Buffer.from(headers['x-signature']), Buffer.from(expectedSig))) {
    throw new WebhookSignatureError();
  }
  
  // 2. Проверка timestamp (защита от replay)
  const age = Date.now() / 1000 - Number(headers['x-timestamp']);
  if (Math.abs(age) > config.timestampTolerance) {
    throw new WebhookReplayError();
  }
  
  // 3. Idempotency (защита от дубликатов)
  const eventId = headers['x-event-id'] as string;
  const isProcessed = await config.idempotencyStore.get(`webhook:${eventId}`);
  if (isProcessed) return { alreadyProcessed: true };
  
  await config.idempotencyStore.setex(`webhook:${eventId}`, 86400, '1');
  return { verified: true };
}
```

### 10.5 Integration Event Log

Все входящие и исходящие события интеграций сохраняются:

```sql
CREATE TABLE integration_event (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  adapter_name TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  event_type TEXT NOT NULL,
  external_id TEXT,           -- ID во внешней системе
  deal_id UUID,               -- если применимо
  request_payload JSONB,
  response_payload JSONB,
  status TEXT NOT NULL,       -- 'success' | 'error' | 'pending'
  error_message TEXT,
  http_status INTEGER,
  duration_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 10.6 Outbox Pattern — durable events

```typescript
// Транзакционный Outbox: событие записывается атомарно с изменением БД
async function createDealAndPublishEvent(
  dealData: CreateDealDto,
  tx: PrismaTransaction
): Promise<Deal> {
  const deal = await tx.deal.create({ data: dealData });
  
  // Outbox — в той же транзакции
  await tx.outboxEntry.create({
    data: {
      id: uuid(),
      eventType: 'deal.created',
      payload: JSON.stringify(deal),
      idempotencyKey: `deal.created.${deal.id}`,
      status: 'PENDING',
      maxRetries: 5,
      nextRetryAt: new Date(),
    }
  });
  
  return deal;
}

// Relay worker: OutboxEntry → Kafka (каждые 100мс)
async function outboxRelay(): Promise<void> {
  const pending = await db.outboxEntry.findMany({
    where: { status: 'PENDING', nextRetryAt: { lte: new Date() } },
    take: 100,
    orderBy: { createdAt: 'asc' }
  });
  
  for (const entry of pending) {
    try {
      await kafka.produce(entry.eventType, entry.payload, {
        key: entry.idempotencyKey
      });
      await db.outboxEntry.update({
        where: { id: entry.id },
        data: { status: 'SENT', sentAt: new Date() }
      });
    } catch (err) {
      const nextRetry = exponentialBackoff(entry.retryCount); // 2^n секунд
      await db.outboxEntry.update({
        where: { id: entry.id },
        data: {
          retryCount: { increment: 1 },
          nextRetryAt: nextRetry,
          status: entry.retryCount >= entry.maxRetries ? 'DEAD' : 'PENDING',
          lastError: err.message
        }
      });
    }
  }
}
```

### 10.7 B2B Partner API

Для партнёрских интеграций (CRM, ERP, 1С, агрохолдинги) платформа предоставляет Partner API:

```yaml
# openapi.yaml (дополнение)
/api/v1/partner/deals:
  post:
    summary: Создать сделку от имени организации
    security: [BearerAuth, ApiKey]
    x-rate-limit: 100/min

/api/v1/partner/deals/{id}/status:
  get:
    summary: Статус сделки

/api/v1/partner/webhooks:
  post:
    summary: Подписаться на события (URL для callback)
```

**Управление API-ключами:**
- Генерация через Admin Ops Dashboard
- Ключи хранятся в Vault (hash в БД, значение не хранится)
- Ротация по расписанию (90 дней) или по требованию
- Scope-based: ключ выдаётся только с необходимыми правами

---

## 11. БЕЗОПАСНОСТЬ И COMPLIANCE

### 11.1 Аутентификация

**MFA (обязательна для):**
- Все пользователи при первом входе (настройка при регистрации)
- Финансовые операции > 100 000 ₽
- Подписание документов УКЭП
- Изменение реквизитов организации
- Admin / Compliance / Arbitrator роли — всегда

**Методы MFA:**
- TOTP (Google Authenticator, Яндекс Ключ) — основной
- SMS OTP — резервный (только российские номера)
- WebAuthn / FIDO2 (Touch ID, Face ID, YubiKey) — рекомендуемый для корпоративных

**Сессии:**
- Access token: JWT, TTL 15 мин, httpOnly cookie
- Refresh token: TTL 7 дней, rotatable, привязан к device fingerprint
- CSRF-токен для state-changing операций
- Одновременные сессии: до 5 устройств (настраиваемо)
- Принудительный logout при: смене пароля, смене роли, подозрительной активности

### 11.2 Верификация контрагентов (KYC)

```typescript
interface KycFlow {
  // 1. Юридическое лицо: ФНС API
  verifyLegalEntity(inn: string): Promise<{
    name: string;
    ogrn: string;
    status: 'active' | 'liquidated' | 'restructuring';
    director: string;
    address: string;
  }>;
  
  // 2. Санкционный скрининг
  sanctionCheck(entity: LegalEntity): Promise<SanctionResult>;
  
  // 3. Проверка банковских реквизитов через ЦБ
  verifyBankDetails(bik: string, account: string): Promise<BankVerification>;
  
  // 4. AML: проверка по 115-ФЗ для операций > 600 000 ₽
  amlCheck(transaction: Transaction): Promise<AmlResult>;
}
```

### 11.3 Защита данных (152-ФЗ)

| Требование | Реализация |
|------------|-----------|
| Согласие на обработку ПДн | Чекбокс при регистрации + запись в БД с timestamp и версией политики |
| Локализация ПДн | Серверы только в РФ (Yandex Cloud / Selectel) |
| Column-level encryption | Vault Transit для паспортных данных, банковских реквизитов |
| Data masking в логах | Middleware: `****1234`, `***@mail.ru` |
| Право на забвение | Функция soft-delete с anonymization (не физическое удаление) |
| Data portability | Экспорт всех данных пользователя в JSON/CSV |
| Уведомление РКН | Автоматическая генерация уведомления об инциденте (шаблон + 72 часа) |
| Назначение ДПО | Организационная мера (не техническая) |

### 11.4 Защита от атак

```nginx
# WAF (Coraza / ModSecurity)
SecRuleEngine On
Include /etc/modsecurity/crs/crs-setup.conf
Include /etc/modsecurity/crs/rules/*.conf
SecRequestBodyLimit 10485760  # 10MB
```

| Угроза | Защита |
|--------|--------|
| SQL Injection | Prisma parameterized queries + WAF CRS |
| XSS | CSP header, React escaping, Trusted Types |
| CSRF | SameSite=Strict cookie + CSRF токен |
| Brute Force | Redis rate limit: 5 попыток → 15 мин блок, 10 → 24 ч |
| DDoS | Cloudflare / Yandex DDoS Protection (уровень DNS) |
| Path Traversal | Validation middleware, не принимаем пути от пользователя |
| Supply Chain | Snyk в CI + Dependabot + signed Docker images (cosign) |
| Secret Leak | GitLeaks в pre-commit + GitHub secret scanning |

### 11.5 Аудит (append-only, 5 лет)

```typescript
// Каждое действие автоматически логируется через AOP decorator
@AuditAction('deal:status:transition')
async transitionDealStatus(
  dealId: string,
  newStatus: DealStatus,
  actor: AuthUser
): Promise<Deal> { ... }

// Формат записи
interface AuditEntry {
  id: string;
  timestamp: Date;
  tenantId: string;
  actorId: string;
  actorRole: UserRole;
  sessionId: string;
  ip: string;
  userAgent: string;
  action: string;           // 'deal:status:transition'
  objectType: string;       // 'Deal'
  objectId: string;
  beforeState: object;      // снимок до
  afterState: object;       // снимок после
  hash: string;             // SHA-256(all fields + prevHash)
  prevHash: string;         // hash предыдущей записи (chain)
}
```

**Неизменяемость:** PostgreSQL `NO UPDATE/DELETE` rules + S3 Object Lock на экспортированных снимках.

---

## 12. ML И АНАЛИТИКА

### 12.1 ClickHouse Data Warehouse

```sql
-- Факт: сделки (для аналитики, не transactional)
CREATE TABLE deals_fact (
  deal_id UUID,
  created_date Date,
  seller_region LowCardinality(String),
  buyer_region LowCardinality(String),
  crop_type LowCardinality(String),
  crop_class UInt8,
  volume_tons Float32,
  price_per_ton_kopecks UInt64,
  total_amount_kopecks UInt64,
  deal_status LowCardinality(String),
  time_to_close_hours Float32,
  has_dispute UInt8,
  commission_kopecks UInt64
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(created_date)
ORDER BY (seller_region, crop_type, created_date);

-- Materialized view для real-time GMV
CREATE MATERIALIZED VIEW gmv_by_day
ENGINE = SummingMergeTree()
ORDER BY (date, crop_type)
AS SELECT
  toDate(created_date) AS date,
  crop_type,
  sum(total_amount_kopecks) AS gmv_kopecks,
  count() AS deals_count
FROM deals_fact
GROUP BY date, crop_type;
```

### 12.2 ML-модели

| Модель | Входные данные | Выход | Использование |
|--------|----------------|-------|--------------|
| Price Predictor | Регион, культура, класс, дата, погода, исторические цены | Ожидаемая цена ± интервал | Подсказка при создании заявки |
| Yield Forecast | Регион, площадь, культура, погода (НСХП), тип почвы | Прогноз урожая (т/га) | Планирование производителя |
| Counterparty Scoring | История сделок, объёмы, отзывы, финансы, возраст орг | Скор 0–100 | Отображение надёжности |
| Fraud Detector | Последовательность действий, роль, IP, паттерны | Флаг риска | Compliance очередь |
| Deal Duration Predictor | Тип сделки, регион, участники, объём | Ожидаемое время закрытия | Планирование логистики |

**Инфраструктура ML:**
- Обучение: Python + scikit-learn/LightGBM, данные из ClickHouse
- Serving: FastAPI микросервис, загрузка модели из S3
- Feature Store: Redis для online features (цены в реальном времени)
- Мониторинг: data drift detection, accuracy tracking в Grafana
- Перетренировка: еженедельно (Airflow DAG)

### 12.3 Регуляторные отчёты

| Получатель | Формат | Периодичность | Автоматизация |
|-----------|--------|--------------|--------------|
| Минсельхоз | XML (форматы МСХ) | Ежемесячно | Airflow DAG → sFTP |
| Росстат | Excel (форма 29-сх) | Ежеквартально | Airflow DAG → ЛК Росстата |
| ФГИС «Зерно» | API push | При каждой сделке | Saga step |
| Росфинмониторинг | ФЭС (форматы 407) | При пороговых операциях | Compliance cockpit |
| Налоговая (ФНС) | XML (ОНФ) | Ежеквартально | Auto-generation |

### 12.4 Unit Economics Passport

Дашборд в Executive Cockpit:

| Метрика | Формула |
|---------|---------|
| GMV | Сумма всех закрытых сделок за период |
| Take Rate | Комиссия платформы / GMV |
| Revenue | GMV × Take Rate |
| Cost per Deal | (Инфраструктура + Support + ML) / кол-во сделок |
| Contribution Margin | Revenue - прямые переменные затраты |
| LTV (организация) | Среднее GMV/мес × avg lifetime × take rate |
| CAC | Маркетинг + Sales / новые активные орг |
| Support Cost per Deal | Кол-во тикетов × avg time × hourly rate / сделок |

**Сценарии (base / conservative / stress):**
- Base: органический рост, конверсия заявка→сделка 40%
- Conservative: медленный онбординг, 25% конверсия
- Stress: один крупный конкурент, отток 20% ключевых клиентов

---

## 13. DEVOPS И НАБЛЮДАЕМОСТЬ

### 13.1 CI/CD Pipeline

```yaml
# Полный pipeline (GitHub Actions + ArgoCD)
stages:
  - lint-typecheck         # pnpm lint && tsc --noEmit (< 2 мин)
  - unit-tests             # vitest run (< 3 мин)
  - build                  # docker build multi-stage (< 5 мин)
  - sast                   # SonarQube / Semgrep (блок при Critical)
  - container-scan         # Trivy (блок при High+ CVE)
  - secret-scan            # GitLeaks
  - integration-tests      # against mock adapters (< 5 мин)
  - deploy-staging         # ArgoCD sync (staging)
  - e2e-tests              # Playwright (< 10 мин)
  - performance-gate       # k6: p95 latency < 500мс
  - deploy-production      # Canary 5% → 50% → 100% (30 мин на шаг)
  - post-deploy-smoke      # Critical path check
  - rollback-if-error      # Автоматически при error rate > 1%
```

**Feature Flags (Flagsmith self-hosted):**
- Canary deployment: новый функционал для 5% → 20% → 100% пользователей
- Kill switch: мгновенное отключение без деплоя
- A/B тесты: сравнение конверсий

### 13.2 Observability Stack

```
Метрики:    Prometheus → Grafana (дашборды: сервисы, бизнес, инфраструктура)
Логи:       OpenTelemetry Collector → Loki → Grafana
Трейсы:     OpenTelemetry → Tempo → Grafana
Ошибки:     Sentry (frontend + backend)
Synth:      Grafana Synthetic Monitoring (critical paths каждые 5 мин)
Alerting:   Alertmanager → PagerDuty (P1/P2) + Telegram (P3) + Email (P4)
```

### 13.3 SLI / SLO / SLA

| Сервис | SLI | SLO | SLA (клиент) |
|--------|-----|-----|-------------|
| API (write) | Успешные ответы 2xx / все | 99.9% | 99.5% |
| API (read) | Успешные ответы 2xx / все | 99.95% | 99.9% |
| Latency p95 (deal API) | < 500мс | 95% времени | — |
| Deal state transitions | Без потерь | 99.99% | 99.9% |
| Документы (upload/download) | Доступность | 99.9% | 99.5% |
| УКЭП signing | Успех | 99.5% | — |
| Платёжные операции | Без потерь | 99.999% | 99.99% |

**Error Budget Policy:** при исчерпании > 50% ежемесячного бюджета — freeze на новые фичи, фокус на надёжность.

### 13.4 Health Endpoints

```typescript
// Каждый сервис обязан предоставлять:
GET /health        → { status: 'ok' | 'degraded' | 'down' }
GET /ready         → { status: 'ready' | 'not-ready', checks: {...} }
GET /metrics       → Prometheus format
GET /version       → { version, commit, buildDate }

// Детальный health check
GET /health/detailed → {
  database: 'ok',
  kafka: 'ok',
  redis: 'ok',
  integrations: {
    fgis: 'ok',
    diadok: 'degraded',  // → alert
    cryptopro: 'ok'
  }
}
```

### 13.5 Disaster Recovery

| Сценарий | RPO | RTO | Механизм |
|----------|-----|-----|---------|
| Отказ одного Pod | 0 | < 30 сек | K8s PDB + HPA |
| Отказ одной ноды | 0 | < 2 мин | K8s rescheduling |
| Отказ зоны доступности | < 1 мин | < 10 мин | Multi-AZ deployment |
| Полный отказ ДЦ | < 5 мин | < 30 мин | Active-Passive failover |
| Катастрофическая потеря данных | < 1 час | < 4 часа | S3 backup restoration |

**DR-тренировка:** раз в квартал полное восстановление из бэкапа на изолированном стенде.

---

## 14. UI/UX И МОБИЛЬНАЯ СТРАТЕГИЯ

### 14.1 Дизайн-система

- Дизайн-токены в JSON (цвета, типографика, отступы, радиусы, тени, анимации)
- Компонентная библиотека: Storybook с тестами, документацией, примерами
- Тёмная тема: полная поддержка, переключение без перезагрузки
- Адаптивность: 320px → 768px → 1024px → 1440px → 1920px (mobile-first)
- Accessibility: WCAG 2.1 Level AA (контраст 4.5:1, keyboard nav, ARIA, focus, alt-texts)

### 14.2 Core Web Vitals (целевые)

| Метрика | Цель | Инструмент |
|---------|------|-----------|
| LCP | < 2.5 сек | Grafana Faro |
| FID / INP | < 100 мс | Grafana Faro |
| CLS | < 0.1 | Grafana Faro |
| Bundle size (initial) | < 200 КБ | Webpack Bundle Analyzer |
| TTI | < 3.5 сек | Lighthouse CI |

### 14.3 Мобильная стратегия

| Канал | Аудитория | Приоритет |
|-------|-----------|-----------|
| Progressive Web App (PWA) | Все роли, браузер | MVP |
| React Native (iOS + Android) | Driver, Elevator, Field agent | Этап 2 |
| Telegram Mini App | Быстрые уведомления, простые действия | Этап 3 |

**Offline-режим (Driver App обязателен):**
- Кэш активных рейсов, адресов, документов (IndexedDB / SQLite on-device)
- Очередь действий при отсутствии сети (фото, GPS-отметки, подписи)
- Разрешение конфликтов при синхронизации: last-write-wins с уведомлением

### 14.4 Protected Shell — требования консистентности

- Шапка (header): роль, организация, уведомления, выход — на всех страницах без исчезновений
- Боковое меню: только пункты, доступные роли (RBAC-filtered)
- Footer: версия, ссылки на документацию
- Виджеты (калькулятор, блокнот, AI-ассистент): только при наличии прав роли, без выхода в чужой контур
- Mobile: все primary actions либо route-backed, либо action-backed, либо disabled с причиной

---

## 15. ТЕСТИРОВАНИЕ И КАЧЕСТВО

### 15.1 Пирамида тестирования

| Уровень | Покрытие | Инструмент | Цель |
|---------|----------|-----------|------|
| Unit | 85%+ statements | Vitest | Доменная логика, утилиты, адаптеры |
| Integration | Все API endpoints | Jest + Supertest | Контроллеры, сервисы с реальной БД (test container) |
| Contract | Все интеграции | Pact / OpenAPI | Контракты адаптеров (mock vs live) |
| E2E | Критичные сценарии | Playwright | Полный пользовательский путь |
| Load | Baseline + Stress | k6 | NFR compliance |
| Security | OWASP Top 10 | OWASP ZAP + Burp | Автоматизированный DAST |

### 15.2 Критичные E2E сценарии (обязательны)

1. **Full deal cycle** — создание → переговоры → подписание УКЭП → escrow → логистика → приёмка → качество → ЭДО → оплата → закрытие → рейтинг
2. **Dispute resolution** — открытие спора → заморозка денег → арбитр → решение → исполнение
3. **Offline driver** — создание действий офлайн → синхронизация → конфликт-резолюция
4. **Integration failure** — недоступность ФГИС → graceful degradation → ручной ввод → восстановление → синхронизация
5. **Security: unauthorized access** — попытка доступа к чужой сделке → блокировка + audit log
6. **Money invariants** — попытка double release → отклонение с фиксацией
7. **Scale: 1000 concurrent users** — создание заявок → нет деградации
8. **MFA enforcement** — финансовая операция без MFA → требование подтверждения

### 15.3 Load Testing (k6)

```javascript
// Baseline scenario
export const options = {
  stages: [
    { duration: '5m', target: 100 },   // ramp up
    { duration: '10m', target: 500 },  // normal load
    { duration: '5m', target: 1500 },  // peak (3x)
    { duration: '5m', target: 0 },     // ramp down
  ],
  thresholds: {
    http_req_duration: ['p95<500', 'p99<2000'],
    http_req_failed: ['rate<0.01'],  // < 1% errors
  },
};
```

### 15.4 Quality Gate (CI блокируется при)

- Unit test coverage < 85%
- SonarQube: любой Critical / Blocker issue
- Trivy: любой High+ CVE в продакшн-образе
- Playwright E2E: любой failed critical scenario
- k6: p95 > 500мс или error rate > 1%
- GitLeaks: обнаружение секрета в коде

---

## 16. РОАДМАП РЕАЛИЗАЦИИ

### Этап 0: Инфраструктурный фундамент (6 недель)
**Цель:** Снять все технические долги, заложить production-фундамент

- [ ] Миграция SQLite → PostgreSQL (новая схема + RLS + индексы)
- [ ] Hash chain в AuditEvent и DealEvent (`hash` + `prevHash`)
- [ ] Append-only enforcement (PostgreSQL rules + S3 WORM)
- [ ] HashiCorp Vault: все секреты, dynamic DB credentials
- [ ] Kafka: топики, retention, DLQ, outbox relay worker
- [ ] Redis Cluster: сессии, rate limit, idempotency store
- [ ] Kubernetes: namespaces (dev/staging/prod), HPA, Network Policies
- [ ] Observability: Prometheus + Grafana + Loki + Tempo + Sentry
- [ ] WAF: Coraza + OWASP CRS в Nginx / Kong
- [ ] GitHub Actions: обновить до полного pipeline с SAST/Trivy/k6

**Метрики готовности:** все сервисы стартуют на PostgreSQL, Vault работает, базовые метрики в Grafana

---

### Этап 1: Durable Core (8 недель)
**Цель:** Продуктовый ядро с юридически значимыми операциями

- [ ] MFA (TOTP + SMS) для всех пользователей
- [ ] КриптоПро DSS adapter (sandbox) — УКЭП для всех документов
- [ ] ФНС adapter: верификация ИНН при регистрации ЮЛ
- [ ] Append-only ledger с двойной записью и PostgreSQL инвариантами
- [ ] Reserve / hold / release / refund / commission полный цикл
- [ ] Bank reconciliation (MT940 import + auto-match)
- [ ] Полный Saga Orchestrator с retry, DLQ, human intervention
- [ ] Deal transition audit events (hash chain)
- [ ] УКЭП для: договора, акта приёмки, сертификата качества
- [ ] ЭДО adapter (Контур.Диадок sandbox): отправка УПД
- [ ] Evidence bundle: hash chain + PDF/ZIP export
- [ ] Контур.Диадок: статусы ЭДО → webhook → уведомления
- [ ] E2E deal simulation (пункт 6.4) — автоматизированный тест

**Метрики готовности:** E2E deal тест проходит от создания до закрытия с УКЭП и ЭДО

---

### Этап 2: Role Runtimes + Integrations (8 недель)
**Цель:** Все роли с полноценным backend, первые live-интеграции

- [ ] Arbitrator cockpit: дело, доказательства, решение, исполнение
- [ ] Compliance cockpit: KYC очередь, санкционный скрининг, блокировки
- [ ] Driver app: offline-first, GPS, фото, синхронизация
- [ ] Elevator runtime: приёмка, взвешивание, акты, несоответствия
- [ ] Operator control tower: флот, маршруты, телематика
- [ ] Admin ops: ручное вмешательство в saga, failed outbox view
- [ ] Support ops queue: тикеты, просмотр сделок, быстрые действия
- [ ] ФГИС «Зерно» live adapter (при наличии доступа)
- [ ] ГИС ЭПД adapter (Минтранс, ЭТН)
- [ ] GPS adapter (ГЛОНАСС или DriverApp-based)
- [ ] Webhook security: HMAC + timestamp + replay protection
- [ ] Integration event log: все входящие/исходящие события
- [ ] Anti-fraud: document mismatch, role abuse, pattern detection
- [ ] Anti-bypass signals: off-platform settlement marker
- [ ] Экспорты: audit CSV/JSON, evidence ZIP, deal report PDF

**Метрики готовности:** все 13 ролей имеют working cockpit, > 3 live интеграции подключены

---

### Этап 3: Scale + Export + ML (8 недель)
**Цель:** Федеральный масштаб, экспорт, предсказательная аналитика

- [ ] ClickHouse: ETL из PostgreSQL, GMV дашборды, unit economics
- [ ] ML: Price Predictor, Counterparty Scoring (обучение + serving)
- [ ] ML: Fraud Detector (обучение на данных Этапа 1-2)
- [ ] Экспортный модуль: Incoterms 2020, мультивалюта, курс ЦБ
- [ ] ФТС adapter: статусы таможенных деклараций
- [ ] Россельхознадзор: фитосанитарные сертификаты
- [ ] РЖД ЭТРАН: ж/д накладные, трекинг вагонов
- [ ] Multi-tenancy: кооперативы, суб-аккаунты, общий пул заявок
- [ ] B2B Partner API: ключи, документация, rate limits
- [ ] Factoring adapter (один банк/МФО)
- [ ] БКИ adapter: скоринг заёмщика
- [ ] Регуляторные отчёты: Минсельхоз, Росстат (Airflow DAG)
- [ ] Load testing: 1000 concurrent users, 3x peak
- [ ] Mobile app (React Native): Driver + Elevator + Field
- [ ] Telegram: уведомления + простые действия через бота

**Метрики готовности:** нагрузочные тесты пройдены, ML модели в production, 5+ live интеграций

---

### Этап 4: Compliance + Hardening (6 недель)
**Цель:** Готовность к федеральному масштабированию и регуляторному аудиту

- [ ] 152-ФЗ полный аудит: согласия, реестр операций, уведомление РКН
- [ ] SAST / DAST / pentest (внешний аудит чёрный ящик)
- [ ] WCAG 2.1 Level AA: автоматизированный + ручной аудит
- [ ] DR-тренировка: полное восстановление из бэкапа
- [ ] SOC 2 Type I подготовка (для международных клиентов)
- [ ] Security bug bounty: программа запущена
- [ ] WebAuthn / FIDO2 для корпоративных пользователей
- [ ] SSO (SAML 2.0 / OIDC) для Enterprise клиентов
- [ ] OPA Policy Engine: сложные ABAC правила
- [ ] API документация: публичный Swagger UI / Redoc
- [ ] Runbooks для всех P1/P2 сценариев
- [ ] SLA документирован и подписан с первыми клиентами
- [ ] Onboarding материалы: видео, документация, sandbox-среда
- [ ] Readiness passport: что live, что sandbox, что в планах

**Метрики готовности:** Production Readiness Checklist закрыт на 100%

---

### Итоговые сроки

| Этап | Срок | Ресурс |
|------|------|--------|
| Этап 0: Инфраструктура | 6 нед | 2 DevOps + 1 Backend |
| Этап 1: Durable Core | 8 нед | 4 Backend + 2 Frontend + 1 QA |
| Этап 2: Role Runtimes | 8 нед | 5 Backend + 3 Frontend + 2 QA |
| Этап 3: Scale + ML | 8 нед | 3 Backend + 2 ML + 2 Frontend + 1 QA |
| Этап 4: Compliance | 6 нед | 2 Security + 1 Backend + 1 QA + 1 Legal |
| **Итого** | **~9 мес** | **~12 человек** |

---

## 17. КРИТЕРИИ ПРИЁМКИ

### 17.1 Production Readiness Checklist

**Инфраструктура:**
- [ ] PostgreSQL работает с RLS, read-replicas, daily WAL backup
- [ ] Kafka: все топики, RF=3, DLQ настроен
- [ ] Kubernetes: HPA + VPA + PDB на всех сервисах
- [ ] Vault: все секреты, dynamic credentials, ротация
- [ ] WAF: Coraza + CRS в production

**Безопасность:**
- [ ] MFA работает для всех пользователей (TOTP + SMS)
- [ ] УКЭП: подписание работает через КриптоПро DSS (live)
- [ ] SAST: 0 Critical/Blocker в SonarQube
- [ ] Container scan: 0 High+ CVE в production образах
- [ ] Pentest: внешний аудит пройден, Critical находки закрыты
- [ ] 152-ФЗ: уведомление в РКН подано, ДПО назначен

**Функциональность:**
- [ ] E2E deal simulation проходит автоматически
- [ ] Все 13 ролей имеют working cockpit с backend
- [ ] Append-only audit trail с hash chain работает
- [ ] Debit = Credit баланс для всех завершённых сделок
- [ ] Минимум 3 live интеграции (ФГИС + ЭДО + GPS)

**Качество:**
- [ ] Unit test coverage ≥ 85%
- [ ] E2E критичные сценарии: 100% pass
- [ ] Load test: p95 < 500мс при 1000 concurrent users
- [ ] Core Web Vitals: LCP < 2.5с, CLS < 0.1
- [ ] WCAG 2.1 AA: автоматизированный аудит без Critical

**Наблюдаемость:**
- [ ] Все сервисы: /health, /ready, /metrics работают
- [ ] Grafana: дашборды для бизнес-метрик и инфраструктуры
- [ ] Alerting: P1 алерты идут в PagerDuty < 5 мин
- [ ] Трейсинг: распределённые трейсы видны в Tempo
- [ ] Synthetic monitoring: critical paths каждые 5 мин

**Документация:**
- [ ] OpenAPI spec актуален (auto-generated)
- [ ] Runbooks для P1/P2 сценариев написаны
- [ ] ADR документируют все архитектурные решения
- [ ] Readiness passport: что live, что sandbox, что в планах

**Юридическое:**
- [ ] Пользовательское соглашение + политика конфиденциальности утверждены юристом
- [ ] Договор оферты для участников платформы
- [ ] Юридическое заключение на УКЭП (63-ФЗ compliance)
- [ ] Договоры с банком-партнёром (escrow, номинальный счёт)
- [ ] Договоры с ЭДО-оператором
- [ ] Соглашение с КриптоПро (для УКЭП)

### 17.2 Gap List для команды и партнёров

Следующие позиции требуют внешних договорённостей — не решаются кодом:

| # | Позиция | Ответственный | Срок |
|---|---------|--------------|------|
| 1 | Доступ к API ФГИС «Зерно» (Минсельхоз) | Юрист + BD | До Этапа 2 |
| 2 | Соглашение с банком (номинальный счёт/escrow) | CFO + Юрист | До Этапа 1 |
| 3 | Договор с Контур.Диадок (ЭДО) | BD | До Этапа 1 |
| 4 | Соглашение с КриптоПро DSS (УКЭП) | BD | До Этапа 1 |
| 5 | Доступ к РЖД ЭТРАН API | BD + Юрист | До Этапа 3 |
| 6 | Соглашение с НБКИ / БКИ (кредитный скоринг) | CFO + Юрист | До Этапа 3 |
| 7 | Утверждение оферты, ПКД юристом | Юрист | До Этапа 1 |
| 8 | Пилотные участники (5-10 организаций) | BD | До Этапа 1 |
| 9 | Хостинг в РФ (ФСТЭК, 152-ФЗ) | DevOps + Юрист | До Этапа 0 |
| 10 | Регистрация как оператор ПДн (РКН) | Юрист | До Этапа 1 |

### 17.3 Финальный статус после приёмки

**Статус: Strong Controlled-Pilot / Pre-Federal**

Что означает:
- Все ключевые функции работают end-to-end с реальными данными
- Юридически значимые документы (УКЭП + ЭДО) корректны
- Деньги защищены (escrow + audit trail)
- 3+ live интеграции работают в production
- Платформа готова к пилоту с 10-50 организациями

Что остаётся для перехода в Federal Scale:
- Полная интеграционная матрица (все 15 адаптеров в live)
- ML-модели обучены на реальных данных (нужен датасет)
- Load testing на 10 000+ concurrent users
- Сертификация ФСТЭК (при КИИ-статусе)
- Multi-region deployment

---

*Документ версии 3.0-PRODUCTION. Версионируется в Git. Все изменения согласуются с Product Owner и фиксируются в CHANGELOG.*  
*Следующий пересмотр: по завершении Этапа 0.*
