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

AP-00–AP-09 объединены в `main`. Реализованы:

- FastAPI foundation и versioned contracts;
- server-authoritative identity contract и deny-by-default policy;
- governed knowledge ingestion, recovery и PostgreSQL loader authority;
- generation-fenced lexical retrieval;
- grounded RAG с обязательными citations и abstention;
- локальный model registry/router и защищённый private-network transport;
- bounded agent/tool runtime с durable confirmation authority;
- deterministic evaluation/red-team authority без LLM-as-judge.

AP-09 exact-main: `297149187c552ba8a19057bb80f8bdbd002d9e7b`.
Machine-readable evidence: `evidence/ap-09-exact-main.json`.

## Следующий этап

Первый обязательный срез AP-10 — единый orchestration runtime:

1. серверно подтверждённая identity;
2. retrieval → context → local model → citation validation;
3. безопасное планирование и исполнение tools;
4. confirmation для write;
5. единая трасса audit/evaluation;
6. deadlines, idempotency, limits, concurrency и backpressure;
7. новый API contract вместо старого словарного `answer_platform_question`.

Полный порядок работ и границы зрелости зафиксированы в `ROADMAP.md`.

TAI не является завершённой промышленной AI-платформой до подключения фактических
локальных model artifacts и знаний, UI-интеграции, а также прохождения evaluation,
load, fault, restore, soak, security и legal acceptance.
