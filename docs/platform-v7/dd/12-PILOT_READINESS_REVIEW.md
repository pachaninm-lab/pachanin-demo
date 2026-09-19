# Pilot Readiness Review — platform-v7 / «Прозрачная Цена»

Дата: 2026-06-15. Решение: **GO для controlled pilot по коду** при выполнении
owner-side предусловий ниже. Это НЕ go-live/боевой запуск.

## Go / No-Go по областям

| Область | Готовность | Комментарий |
|---------|------------|-------------|
| Архитектура/код | ✅ GO | чистое ядро, порты под БД/интеграции, CI зелёный |
| Тесты/CI | ✅ GO | 585 файлов/3702 теста; required-гейты зелёные |
| Runtime сделки/деньги/споры | ✅ GO (симуляция) | honesty-копии, no fake-release |
| RBAC/роли/изоляция | ✅ GO (pilot) | enforced-флаг включить для пилота |
| Audit trail | 🟡 COND | есть append-only+экспорт; durable БД — owner-side |
| Интеграции | 🟡 COND | shells за ENV+credentials; договоры — owner-side |
| Observability/health | ✅ GO | health/pilot-metrics/incident journal |
| UX/dark-light/mobile | ✅ GO | UX-001/UX-002 закрыты; UX-003 follow-up |
| Identity/сессия | 🔴 BLOCK go-live | SEC-001 binding — обязателен до боевого режима |
| 152-ФЗ/consent | 🔴 BLOCK go-live | consent/локализация — owner-side |
| 115-ФЗ/AML | 🔴 BLOCK go-live | только с банком |
| Hosting | 🟡 COND | Netlify активен; Vercel заблокирован (HTTP 402) |

## Предусловия controlled pilot (owner-side)
1. Включить `NEXT_PUBLIC_PLATFORM_V7_RBAC=enforced` (+ серверный cabinet-guard).
2. Ограниченный круг доверенных участников, без реальных платежей/ПД боевых лиц
   (или с явным согласием и минимизацией).
3. Разблокировать Vercel (или зафиксировать Netlify как основной хост на пилот).
4. План отката и мониторинг (health-cockpit) на время пилота.

## Блокеры go-live (после пилота, owner-side)
- SEC-001: server-side binding актора к сессии + IdP/MFA + enforced RBAC.
- Реальная БД + миграции + durable WORM-аудит.
- Договоры/credentials: банк (номинальный счёт), ФГИС, ЭДО, ЭПД, лаб/GPS.
- 152-ФЗ (consent/локализация/права субъекта) + 115-ФЗ (с банком) +
  security/legal review.
- CSP nonce, HMAC bank-callback, SCA-скан/SBOM, license-scan.

## Вердикт
**Code-ready для controlled pilot и pre-integration partner onboarding.**
Остаётся только owner-side: договоры, credentials, live API, server-side
identity/сессия+MFA, реальная БД/миграции, security/legal review, номинальный
счёт и первая controlled-pilot сделка.
