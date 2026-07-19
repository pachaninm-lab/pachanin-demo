# Transparent Agro Intelligence

Собственная полностью бесплатная AI-платформа для участников российского АПК.

## Неподвижные архитектурные правила

1. AI не владеет authoritative state Сделок, денег, ставок, лабораторных результатов, подписей, ролей и споров.
2. Все действия выполняются только через типизированные инструменты и серверную авторизацию.
3. Доступ к штатным AI-функциям полностью бесплатен для всех пользователей. Платные уровни, токены, подписки и приоритет за оплату запрещены.
4. Внешний контент считается недоверенными данными и не может изменять системные инструкции или разрешения инструментов.
5. Любой проверяемый вывод должен иметь provenance, дату актуальности и оценку уверенности.
6. Tenant и роль берутся только из серверно подтверждённого контекста.

## Текущее состояние

AP-00–AP-09, AP-11 и AP-12A объединены в `main`. Governed planner уже детерминированно выбирает только один из трёх разрешённых Safe Tools, блокирует prompt injection и не имеет write-authority.

AP-13A добавляет отдельный fail-closed admission authority для локальных моделей. Наличие записи в model registry и живого endpoint больше не считается достаточным: production readiness требует digest-pinned artifact, юридически утверждённую лицензию, измеренные CPU/GPU profiles, пороги platform/agro quality и отдельную fallback-модель.

Реализованы:

- FastAPI foundation и versioned contracts;
- server-authoritative identity contract и deny-by-default policy;
- governed knowledge ingestion, recovery и PostgreSQL loader authority;
- generation-fenced lexical retrieval;
- grounded RAG с обязательными citations и abstention;
- локальный model registry/router и защищённый private-network transport;
- bounded agent/tool runtime с durable confirmation authority;
- deterministic evaluation/red-team authority без LLM-as-judge;
- cross-process orchestration idempotency и crash-recoverable prepared actions;
- fenced heartbeat для длительных подтверждённых действий;
- exact-main application release attestation;
- production composition root на PostgreSQL и локальных model endpoints;
- request-bound Safe Tool bridge к PostgreSQL-authoritative API платформы;
- governed deterministic Safe Tool planner;
- immutable model artifact, license, benchmark и admission evidence authority.

Application release authority и model admission authority не равны эксплуатационной приёмке. Пока не загружены и не измерены реальные model artifacts и не получен отдельный operational evidence, статус обязан оставаться `NOT_ATTESTED`.

## Production ASGI entrypoint

Запускать только явный production entrypoint:

```bash
uvicorn tai.production_entrypoint:app --host 0.0.0.0 --port 8080
```

Обязательная конфигурация:

- `TAI_RUNTIME_MODE=production`;
- `TAI_DATABASE_URL`;
- `TAI_IDENTITY_HMAC_SECRET_B64`;
- `TAI_CONFIRMATION_HMAC_SECRET_B64`;
- `TAI_MODEL_ENDPOINTS_JSON` в форме `{ "model_id@revision": "http://model.svc/v1/chat/completions" }`.

Секреты должны быть разными и декодироваться минимум в 32 байта. Model endpoints принимаются только для локальных, private-network или явно разрешённых адресов. При неполной конфигурации, недоступной PostgreSQL-схеме, отсутствии активной knowledge generation, routable local model либо принятого model admission сервис остаётся `not_ready` и не принимает рабочие запросы.

## Platform Safe Tool bridge

Мост включается только полной парой:

- `TAI_PLATFORM_TOOL_BASE_URL`, например `http://platform-api.svc`;
- `TAI_PLATFORM_TOOL_HMAC_SECRET_B64` — отдельный секрет минимум 32 байта.

Дополнительно:

- `TAI_ALLOWED_PLATFORM_TOOL_HOSTS_JSON`;
- `TAI_PLATFORM_TOOL_TIMEOUT_SECONDS`.

Разрешены только три инструмента:

- `getDealSummary` — `READ_ONLY`;
- `getRoleNextActions` — `READ_ONLY`;
- `prepareCommandDraft` — `DRAFT`.

Каждый вызов связан HMAC с точным методом, маршрутом, телом, tool name/mode, tenant/user/session, trace/call и idempotency key. API платформы повторно разрешает реальное membership и активного участника Сделки из PostgreSQL. `prepareCommandDraft` не выполняет команду: он возвращает текущий серверный action, optimistic-concurrency версию и контракт для отдельного подтверждения пользователем.

Confirmed-write handlers намеренно отсутствуют. `acknowledgeRisk`, `createSupportCase`, деньги, документы, подписи, лаборатория, спор и изменение состояния Сделки остаются fail-closed. Governed planner не может выбирать отсутствующие или write-инструменты.

## Оставшаяся работа

1. Загрузить реальные локальные model artifacts, провести license review, quantization и воспроизводимые CPU/GPU/fallback benchmarks через AP-13A authority.
2. Довести Platform Knowledge Base и российский АПК до измеримого coverage/freshness registry и отраслевых gold sets.
3. Реализовать embeddings, hybrid retrieval и reranker с benchmark качества поиска.
4. Реализовать document/vision pipeline для PDF, сканов, таблиц и сертификатов с quarantine и page-level provenance.
5. Завершить Platform Expert, Deal Copilot, проактивные подсказки, AI-интерфейс и административную панель.
6. Расширить Safe Tools и отдельный подтверждённый write-контур без автономных privileged writes.
7. Закрыть distributed admission/backpressure, model draining, HA/DR, observability, load/fault/restore/backlog/soak, 12-role E2E и exact-main operational attestation.

Полный порядок работ и границы зрелости зафиксированы в `ROADMAP.md`.
