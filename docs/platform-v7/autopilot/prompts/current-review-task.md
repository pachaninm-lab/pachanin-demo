# Review current task — Master-ТЗ 3+ доводка

Maturity: controlled-pilot / pre-integration.

Проверять каждый M3-PR на:
- соответствие gap-аудиту и SOT (`master-tz-3-plus-...closure.md`);
- честность копии (нет demo/pilot/mock/sandbox в UI, нет fake-live claims);
- один узкий reviewable слой; apps/landing не тронут; lockfiles без изменений;
- полная web vitest зелёная + tsc; Netlify route QA §40 зелёный;
- документы соответствуют коду (§41).

Текущий ожидаемый слой ревью: M3-3 UX-gate (no long scroll, единый порядок и дизайн до конца страницы).
