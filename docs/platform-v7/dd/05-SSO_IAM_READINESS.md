# SSO / IAM Readiness — platform-v7 (DD view)

Дата: 2026-06-15. Зрелость: controlled-pilot. Подробный разбор —
`../audit/SSO_IAM_READINESS.md`; здесь — DD-резюме.

## Состояние

| Пункт | Статус |
|-------|--------|
| Role mapping | EXISTS — `role-canonical.ts` (`toPlatformV7CanonicalRole`, 27 canonical-ролей) |
| Tenant isolation (модель) | EXISTS — `tenant-model.ts` (`platformV7IsCrossTenant`, org-scope) |
| Session boundary | EXISTS — httpOnly cookies + `middleware.ts` (`parseSession`, срок/роль) |
| Access status screen | EXISTS — `app/platform-v7/access/page.tsx` |
| RBAC engine | EXISTS — `access-control.ts` (deny-by-default, explicit-deny, denied-audit) |
| SAML/OIDC | GAP — placeholder (`tenant-model.ts`, `access-request.ts`) |
| MFA | GAP |
| Corporate IdP (ЕСИА/СберБизнес ID) | PLACEHOLDER |
| Actor↔session binding | GAP — IAM-001/SEC-001 |

## Ключевые находки

- **IAM-001 (HIGH→CRITICAL@go-live):** tenant/RBAC корректно сравнивают
  `actor.organizationId` со scope объекта, но актор приходит из тела запроса
  (см. SEC-001). Привязать к подписанной сессии/JWT обязательно до go-live.
- **IAM-002 (HIGH):** MFA отсутствует — owner-side (IdP).
- **IAM-003 (MEDIUM):** нет SAML/OIDC и corporate IdP — owner-side.

## Чеклист подключения IdP (owner-side)
1. Договор/доступы ЕСИА/СберБизнес ID (или корпоративный OIDC/SAML).
2. Серверный обмен code→token, валидация подписи/issuer/audience.
3. Маппинг IdP-claims → `PLATFORM_V7_CANONICAL_ROLES`.
4. Привязка `actorId/actorRole/organizationId` к серверной сессии (закрывает
   SEC-001/IAM-001).
5. MFA-политика (TOTP/WebAuthn).
6. `NEXT_PUBLIC_PLATFORM_V7_RBAC=enforced` + серверный cabinet-guard.

## Вердикт
IAM-модель (роли, tenant, RBAC, сессия, экран доступа) готова как каркас под
федеративную identity. SSO/MFA/binding — owner-side, подключаются без
переписывания (точка маппинга — `role-canonical.ts`).
