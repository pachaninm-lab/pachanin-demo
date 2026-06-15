# Final readiness audit — platform-v7 / Прозрачная Цена

Статус: **code-ready for controlled pilot / pre-integration partner onboarding.**
Дата: 2026-06-15.

> platform-v7 is code-ready for controlled pilot / pre-integration partner
> onboarding. Remaining blockers are owner-side contracts, credentials, live API
> access, security/legal review and real pilot transactions.

## 10-PR план — выполнено

| PR | Слой | Эффект |
|----|------|--------|
| PR-1 (#1798) | Tenant/RBAC hardening | multi-tenant модель + изоляция «только свои объекты» поверх action-level RBAC |
| PR-2 (#1799) | DB persistence adapter | `P7PersistenceDriver` + `createP7DbRuntimeStore` поверх портов; реальная БД = реализация драйвера |
| PR-3 (#1800) | Bank callback/reconciliation | нормализация callback, сверка, no double release, mismatch/timeout → manual review |
| PR-4 (#1801) | Real-adapter shells | единые shells ФГИС/ЭДО/ЭПД/GPS/lab/1С: ENV, healthCheck, pending/manual_review/failed |
| PR-5 (#1802) | UX-gate | единый герой + мобильный фокус + защита от overflow зафиксированы тестом |
| PR-6 (#1803) | Observability health | System/Deal/Money/Integration/Adapter/Queue Health, Manual Review Queue, Stuck Deal Monitor |
| PR-7 (#1804) | BI runtime binding | метрики из runtime + pilot report export; scenario-метрики помечены |
| PR-8 (#1805) | Unified deal lifecycle | сквозной runtime-тест + offline/duplicate/conflict/retry |
| PR-9 (#1806) | Product entry | статус доступа организации/роли + ясное следующее действие |
| PR-10 | Readiness audit + SOT | этот документ + обновление progress.json |

Ранее в этой же сессии: фабрика адаптеров mock↔real (#1783, #1796), боевой
банковский адаптер за фиче-флагом (#1796), cabinet-level RBAC (#1797),
доступность WCAG AA, фокусные мобильные кабинеты, устранение гидратации,
премиум-герой и микро-анимации.

## Definition of Done — сверка

- ✅ Внутренний runtime сделки работает без внешних договоров (mock/симуляция; application-service над портами).
- ✅ Доступы и роли изолированы (action-level RBAC + tenant-model + cabinet-level RBAC за флагом).
- ✅ Данные готовы к реальной БД (`P7PersistenceDriver` + `createP7DbRuntimeStore`).
- ✅ Банк готов к sandbox/live через ENV и callback (`bank-adapter-real` + `bank-callback` reconcile).
- ✅ Внешние adapters имеют production-shaped shells (`real-adapter-shell`).
- ✅ UX по ролям не «простыня»: единый герой, фокусный мобильный вид (UX-gate).
- ✅ Health screens (`/platform-v7/health`).
- ✅ BI считает от runtime (`pilot-metrics`).
- ✅ Единый e2e сценарий сделки на runtime (`platformV7UnifiedDealLifecycle`).
- ✅ CI зелёный (ci/tsc, web-unit, build, autopilot-guard, CodeQL).
- ✅ В UI нет fake-live claims (honesty-гварды + UX-gate).

## Required gates — покрытие

- **web-unit / ci (tsc) / build / autopilot-guard / CodeQL** — активны и required на каждом PR.
- **no fake-live / no forbidden copy** — e2e forbidden-copy + honesty-гварды (external-copy-guardrails, providerRegistry `canClaimProviderLive`).
- **no apps/landing** — autopilot-guard forbiddenZones (`apps/landing`).
- **no horizontal overflow** — UX-gate (`min-width:0`/`max-width:100%`) + проверено браузером (390/768/1440).
- **no role leakage** — cabinet-RBAC + tenant-isolation тесты; в кабинете нет переключателя всех ролей.
- **Playwright smoke** — сквозной контур покрыт на runtime-уровне в web-unit (браузерные стенды — owner-side CI-инфраструктура).

## Что остаётся owner-side (вне кода)

Договоры (банк/ФГИС/оператор ЭДО/ИС ЭПД), API-доступы и credentials, номинальный
счёт, провайдер идентификации (ЕСИА/СберБизнес ID), реальная БД + миграции,
внешние стенды, security/legal review (152-ФЗ/115-ФЗ), первая controlled pilot
сделка. Код под всё это подготовлен и включается флагами/ENV без изменения
application-service и контрактов экранов.
