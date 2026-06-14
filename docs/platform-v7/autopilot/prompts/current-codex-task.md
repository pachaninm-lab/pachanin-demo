# Codex current task — Master-ТЗ 3+ доводка

Maturity: controlled-pilot / pre-integration.

Контекст: внутренний execution-runtime в основном закрыт (см. gap-аудит
`master-tz-3-plus-pre-integration-execution-platform-closure.md`). Доводка маленькими PR;
не переписывать с нуля, не трогать apps/landing, без fake-live claims.

Следующий слой: **M3-3 — UX-gate сквозной аудит ролей** (§14).
- Пройти каждый ролевой кабинет до конца страницы.
- Длинный текст → Smart Collapse / details / tabs.
- Единый порядок блоков и единая дизайн-система до конца.
- Mobile 390×844 без длинной простыни.
- Тест на отсутствие визуального мусора / запрещённой копии.

После: M3-4 observability health-экраны, M3-5 BI binding, M3-6 единый e2e (§38), M3-7 final review.
SOT обновлять после каждого PR; Netlify route QA (§40) на актуальном host vermillion-kitsune.
