# SSO_IAM_READINESS — platform-v7

Дата: 2026-06-15. Зрелость: controlled-pilot. SSO/IAM подключаются owner-side; ниже
— что готово в коде и что является GAP.

## Состояние по пунктам

| Пункт | Статус | Где |
|-------|--------|-----|
| SAML/OIDC | GAP (owner-side) | нет кода; placeholder-комментарии |
| SSO placeholder architecture | PARTIAL | `lib/platform-v7/tenant-model.ts:7-8`, `access-request.ts:96` |
| MFA | GAP (owner-side) | нет кода |
| Corporate IdP (ЕСИА/СберБизнес ID) | PLACEHOLDER | упомянуто в pilotNote, реализации нет |
| Role mapping | EXISTS | `lib/platform-v7/role-canonical.ts` (`toPlatformV7CanonicalRole`) |
| Tenant isolation | EXISTS (модель) | `lib/platform-v7/tenant-model.ts` |
| Session boundary | EXISTS (cookie) | `apps/web/lib/auth-session.ts`, `auth-cookies.ts`, `middleware.ts` |
| Access status screen | EXISTS | `app/platform-v7/access/page.tsx`, `lib/platform-v7/access-request.ts` |

## EXISTS — что уже есть

- **Role mapping** — `role-canonical.ts`: алиасы → canonical-роли
  (`PLATFORM_V7_CANONICAL_ROLES`). Это точка, куда ляжет маппинг IdP-claims.
- **Tenant isolation (модель)** — `tenant-model.ts`:
  `platformV7ResolveObjectOrganizations`, `platformV7IsCrossTenant`,
  `platformV7TenantAccessDecision`. Объект скоупится по orgId участников;
  platform-scoped роли (operator/admin/compliance/arbitrator/...) обходят
  tenant-проверку осознанно.
- **Session boundary** — httpOnly cookies (`pc_access_token`, `pc_refresh_token`,
  `pc_session_present`), SameSite=lax, `parseSession` валидирует роль и срок в
  `middleware.ts`.
- **Access status screen** — `app/platform-v7/access/page.tsx`:
  организация → роль → подтверждение → ручная проверка → доступ, одно понятное
  следующее действие; статусы из `platformV7BuildAccessStatusView`.

## GAP / находки

### IAM-001 — Tenant/RBAC опираются на актора из тела запроса
- **Severity:** HIGH (→CRITICAL at go-live). Дубль SEC-001.
- **Risk:** `tenant-model` корректно сравнивает `actor.organizationId` со
  скоупом объекта, но `actor.*` приходит неверифицированным из body.
- **Fix:** актор обязан строиться из подписанной сессии/JWT (IdP), не из body.
- **Test:** cross-tenant запрос с подменённым orgId → deny.
- **Status:** owner-side / api-PR.

### IAM-002 — Нет MFA
- **Severity:** HIGH. **Fix:** TOTP/WebAuthn через IdP. **Status:** owner-side.

### IAM-003 — Нет SAML/OIDC и corporate IdP
- **Severity:** MEDIUM. **Fix:** OIDC (ЕСИА/СберБизнес ID) с серверной
  валидацией claims (ФИО, ИНН, роль) и маппингом в canonical-роли через
  `role-canonical.ts`; сессия должна нести подписанные claims. **Status:**
  owner-side.

## Чеклист подключения IdP (owner-side)
1. Договор и доступы к ЕСИА/СберБизнес ID (или корпоративному OIDC/SAML).
2. Серверный обмен кода на токен; валидация подписи/issuer/audience.
3. Маппинг IdP-claims → `PLATFORM_V7_CANONICAL_ROLES`.
4. Привязка `actorId/actorRole/organizationId` к серверной сессии (закрывает
   SEC-001/IAM-001).
5. MFA-политика (TOTP/WebAuthn).
6. Включить `NEXT_PUBLIC_PLATFORM_V7_RBAC=enforced` + серверный cabinet-guard.
