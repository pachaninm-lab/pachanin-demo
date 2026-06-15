# SECURITY_READINESS — platform-v7

Дата: 2026-06-15. Зрелость: controlled-pilot / pre-integration. Покрывает SAST,
DAST-readiness, secrets, auth-boundaries, CSP/headers. Severity дана по состоянию
«перед go-live».

## Сильные стороны (подтверждено в коде)

- **Серверный auth-контур middleware** — `apps/web/middleware.ts`:
  constant-time сравнение пароля/ключа (`safeEqual`), валидация роли по whitelist
  `VALID_ROLES`, session-cookie с проверкой роли и срока (`parseSession`),
  security-headers (HSTS/CSP/X-Frame-Options), private-mode Basic Auth.
- **Нет hardcoded-секретов**: `.env.example` содержит только публичные
  `NEXT_PUBLIC_*`; в `vercel.json`/`netlify.toml` секретов нет; `.env*` не
  закоммичены.
- **Нет `eval`/`new Function`**. `process.env` используется корректно
  (серверно в middleware/route или `NEXT_PUBLIC_*` на клиенте).
- **`dangerouslySetInnerHTML`** (43 файла) — только статический CSS для
  `<style>`, без пользовательских данных (см. MOB/UX отчёты).
- **Honesty-gate против fake-live** — `lib/platform-v7/integrations/providerRegistry.ts`
  `canClaimProviderLive()` требует 8 условий (контракт, credentials, callbacks,
  подтверждённые операции) и `assertProviderLiveClaimIsAllowed()` бросает ошибку
  иначе. Все внешние результаты несут `doesNotConfirmExternally: true`.

## Находки

### SEC-001 — Актор не верифицируется против серверной сессии
- **Severity:** HIGH (→ CRITICAL при включении реальной БД/денег/IdP).
- **Affected:** `apps/web/app/api/platform-v7/actions/route.ts`,
  `lib/platform-v7/server-action-route-body-reader.ts:197-226`.
- **Risk:** `actorId`/`actorRole` берутся из тела POST и идут в RBAC-решение и
  audit-event без сверки с session-cookie. На проде это impersonation
  (клиент пришлёт `actorRole: "bank_officer"`).
- **Смягчение сейчас:** endpoint — контракт-эвалюатор; на каждый запрос
  создаётся свежий in-memory repository (`server-action-route-handler.ts:88`),
  durable-БД/денег/банка нет → не эксплуатируем как «выпуск денег» в пилоте.
- **Fix:** на API-границе извлекать актора из подписанной session-cookie
  (или JWT от IdP) и отвергать запрос, если body-актор ≠ session-актор. Обернуть
  обязательной проверкой до `handlePlatformV7ServerActionRouteBody`.
- **Test:** route-тест: запрос с body-ролью ≠ session-ролью → 403; совпадение →
  обрабатывается.
- **Status:** open. `app/api` — forbidden zone autopilot-guard ⇒ owner-side либо
  отдельный явно-расширенный api-PR. **Блокер go-live.**

### SEC-002 — Cabinet-RBAC по умолчанию не enforced (pilot)
- **Severity:** HIGH (by-design на пилоте).
- **Affected:** `lib/platform-v7/cabinet-access-policy.ts`,
  `components/platform-v7/RbacCabinetGuard.tsx` (клиентский guard).
- **Risk:** при `NEXT_PUBLIC_PLATFORM_V7_RBAC≠enforced` и не-production любой
  аутентифицированный пользователь может зайти в любой кабинет; редирект только
  клиентский.
- **Fix:** включить `NEXT_PUBLIC_PLATFORM_V7_RBAC=enforced` для пилота и
  продублировать проверку в middleware (серверно) для cabinet-маршрутов.
- **Test:** есть юнит на `cabinetAccessDecision`; добавить middleware-тест на
  серверный редирект.
- **Status:** документировано; включение флага — owner-side, серверный guard —
  будущий PR (middleware вне scope autopilot).

### SEC-003 — Field-masking только клиентский
- **Severity:** HIGH. **Affected:** `lib/platform-v7/role-access.ts`
  (`PLATFORM_V7_ROLE_FORBIDDEN_FIELDS`, `getPlatformV7VisibleFields`),
  `components/platform-v7/DocumentPreviewGate.tsx`.
- **Risk:** маскирование чувствительных полей (phone/email/bankDetails) считается
  на клиенте; при реальном API без серверной фильтрации полные объекты могут
  утечь.
- **Fix:** серверная функция-редактор полей по роли перед сериализацией ответа.
  Чистую функцию можно добавить in-scope (`lib/platform-v7/**`) с тестом, готовую
  к подключению на API-границе.
- **Test:** для каждой роли запрещённые поля отсутствуют в выводе.
- **Status:** open (частично fixable-in-scope).

### SEC-004 — MFA отсутствует
- **Severity:** HIGH. **Affected:** — (нет кода). **Risk:** компрометация
  одного пароля = полный доступ. **Fix:** TOTP/WebAuthn через IdP. **Test:**
  e2e на MFA-челлендж. **Status:** owner-side (привязано к IdP).

### SEC-005 — SSO (SAML/OIDC) — placeholder
- **Severity:** MEDIUM. **Affected:** `lib/platform-v7/tenant-model.ts:7-8`,
  `lib/platform-v7/access-request.ts:96` (комментарии «ЕСИА/СберБизнес ID
  подключаются позже»). **Risk:** нет федеративной identity; роли локальные.
  **Fix:** OIDC/SAML с маппингом claims → canonical-роли. **Test:** маппинг
  IdP-claim → роль. **Status:** owner-side. См. `SSO_IAM_READINESS.md`.

### SEC-006 — CSP допускает `unsafe-inline`/`unsafe-eval` в script-src
- **Severity:** HIGH. **Affected:** `apps/web/vercel.json:28-30`. **Risk:**
  ослабляет защиту от XSS. **Fix:** перейти на nonce/`strict-dynamic`; убрать
  `unsafe-eval`; задокументировать необходимый минимум для Next/аналитики.
  **Test:** CSP-проверка заголовков на ключевых маршрутах. **Status:** open
  (hosting/headers вне scope autopilot ⇒ owner-side/hosting-PR).

### SEC-007 — Нет проверки подписи входящего bank-callback
- **Severity:** MEDIUM. **Affected:** `apps/web/app/api/sim/bank-callback/route.ts`.
  **Risk:** при live без HMAC/подписи возможна подделка callback. Смягчение:
  reconciliation уже отвергает дубликаты/mismatch в `manual_review`. **Fix:**
  HMAC/подпись + rate-limit + (опц.) cert-pinning при подключении банка. **Test:**
  callback с неверной подписью → reject. **Status:** owner-side (live-интеграция).

### SEC-008 — Отключены build-gates
- **Severity:** MEDIUM. **Affected:** `apps/web/next.config.mjs`
  (`typescript.ignoreBuildErrors`, `eslint.ignoreDuringBuilds`). **Risk:**
  типовые/линт-ошибки не блокируют сборку (введено при срочном апгрейде Next
  14.2.35). Смягчение: отдельный `ci`/`tsc` и `web-unit` gate-ы зелёные на каждом
  PR. **Fix:** сузить/снять подавление, опираясь на зелёный tsc. **Test:** CI tsc.
  **Status:** open (config вне scope autopilot ⇒ hosting-PR).

## DAST-readiness (для будущего live-стенда)
- Маршруты под `/platform-v7/**` — UI controlled-pilot; чувствительные действия
  идут через `/api/platform-v7/actions` (контракт-эвалюатор).
- Перед DAST: закрыть SEC-001/002/003 (auth-границы), SEC-006 (CSP), включить
  enforced-RBAC, добавить error-handling без утечки стектрейсов.
- Текущая error-поверхность: route отвечает структурированным `not_accepted`/
  `400`/`403` без stack leakage (см. route).
