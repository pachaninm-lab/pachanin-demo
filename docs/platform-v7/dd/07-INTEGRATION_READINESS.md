# Integration Readiness — platform-v7

Дата: 2026-06-15. Зрелость: pre-integration / adapter-ready. **Нет живых вызовов
без credentials. Никаких claim'ов live/connected.**

## Архитектура интеграций (EXISTS)

- **Seam mock↔real:** `external-adapters.ts` (`PlatformV7ExternalAdapter`,
  mock-registry), `adapter-factory.ts` (`platformV7ResolveAdapterMode` — `real`
  только при `NEXT_PUBLIC_PLATFORM_V7_ENVIRONMENT=production`),
  `real-adapter-shell.ts` / `real-adapter-template.ts`.
- **Credentials-gate:** `resolveRealAdapterConfig` возвращает `null` без
  `*_API_BASE_URL`+`*_API_KEY` ⇒ адаптер падает в mock. Боевой банк-адаптер
  (`bank-adapter-real.ts`) регистрируется только при наличии конфигурации.
- **Shells:** ФГИС, ЭДО, ЭПД/ЭТрН, логистика/GPS, лаборатория, 1С, уведомления —
  единые shells (ENV, healthCheck, статусы pending/manual_review/failed).
- **Bank callback + reconciliation** (`bank-callback.ts`): нормализация,
  идемпотентность по `bankEventId` (no double release), отклонение
  deal/currency/amount mismatch и не-терминальных статусов в `manual_review`,
  retry-политика (5 попыток, 15-мин timeout).
- **Honesty-gate:** `doesNotConfirmExternally:true` на всех внешних результатах;
  `canClaimProviderLive` (8 условий: live-статус, контракт, credentials,
  callbacks, подтверждённые операции) — иначе боевой статус показать нельзя.
- **Integration readiness tracker** (`integration-readiness.ts`): статусы
  систем (`requires_connection`/`manual_review`).

## Находки

- **INT-001 (MEDIUM):** входящий bank-callback (`app/api/sim/bank-callback`) без
  HMAC/подписи. Смягчение: reconciliation отвергает невалидные события. **Fix:**
  HMAC + rate-limit при live. **Status:** owner-side.
- **INT-002 (EXPECTED):** ФГИС/ЭДО/ЭПД shells — `createUnimplementedRealAdapter`
  бросает при вызове до реализации партнёрского API. Это намеренно (нет
  fake-success). **Status:** owner-side (реализация по договору).
- **INT-003 (MEDIUM):** rewrites корневого `vercel.json` не зеркалированы в
  Netlify — hosting-parity (см. `dual-hosting-operating-rules.md`). **Status:**
  owner-side/hosting-PR.

## Чеклист подключения (owner-side, по каждой системе)
Договор → доступы/credentials (ENV) → sandbox-стенд → callback/HMAC →
end-to-end сверка → переключение `ENVIRONMENT=production` только после
подтверждения партнёром.

## Вердикт
Интеграционный слой — образцовый pre-integration: реальные включаются только за
ENV+credentials, никаких fake-confirmations, банковский контур с anti-double-
release. Остаток — договоры/доступы/реализация партнёрских API (owner-side).
