# PC-CROP Federal Accounting — organization-member RLS context v1

Date: 2026-08-24
Authority: #4321 (`PC-CROP-FEDERAL-ACCOUNTING`)
Tracking: #4607
Status: **AUTHORIZATION PRIMITIVE / NOT A GLOBAL GUEST WIDENING**.

The accounting model uses organization job profiles such as `ACCOUNTANT` and `EXTERNAL_ACCOUNTANT`; compatibility memberships may carry `role=GUEST`. Generic platform RLS remains unchanged in policy: `withTrustedContext` still rejects GUEST.

This slice adds a separate `withOrganizationMemberContext` path. It may derive the identity coordinates for a GUEST session, but business work starts only after PostgreSQL resolves `public.app_pc_crop_membership_id()` to an ACTIVE durable membership for the exact user, organization and tenant context. No membership => callback is never executed.

Invariants:
- no global GUEST authorization widening;
- missing user/session/org/tenant still fails before a transaction opens;
- the database membership row, not the role label or job-profile claim, is authority;
- staff role labels remain non-authoritative metadata at this layer;
- the membership-only failure uses its own error type and does not widen generic RLS error vocabularies;
- no Prisma schema/migration, production, hosting, 1С traffic or new mandatory spend.

This primitive is required before the human 1С pairing/status/revoke routes can correctly support organization accountants without borrowing a broader platform role.
