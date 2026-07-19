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

AP-00–AP-09 и AP-11 объединены в `main`. AP-10 выполняется отдельными промышленными срезами.

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
- production composition root на PostgreSQL и локальных model endpoints.

Application release authority не равен эксплуатационной приёмке. До отдельного AP-10 evidence статус обязан оставаться `NOT_ATTESTED`.

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

Секреты должны быть разными и декодироваться минимум в 32 байта. Model endpoints принимаются только для локальных, private-network или явно разрешённых адресов. При неполной конфигурации, недоступной PostgreSQL-схеме, отсутствии активной knowledge generation либо routable local model сервис остаётся `not_ready` и не принимает рабочие запросы.

## Оставшийся AP-10

1. Реальные platform Safe Tool adapters вместо отключённого planning по умолчанию.
2. Распределённые admission, rate limits, очереди и model draining.
3. Нагрузка, fault injection, restore, backlog recovery и soak.
4. Machine-readable operational evidence на одном exact-main.
5. Отдельная production operational attestation без завышения зрелости.

Полный порядок работ и границы зрелости зафиксированы в `ROADMAP.md`.
