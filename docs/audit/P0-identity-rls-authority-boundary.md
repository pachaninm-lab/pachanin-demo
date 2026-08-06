# P0 Identity RLS authority boundary

This document records the runtime contract enforced by PR #3684.

- Authentication, deal and staff runtime principals are `NOSUPERUSER NOBYPASSRLS`.
- `public.users`, `public.user_orgs` and `public.organizations` use `ENABLE ROW LEVEL SECURITY` and `FORCE ROW LEVEL SECURITY`.
- Pre-authentication reads are available only through named `SECURITY DEFINER` functions owned by `pc_identity_bootstrap`.
- Staff target validation uses `auth.resolve_staff_target_scope(...)`; runtime principals receive only `EXECUTE`, not cross-tenant table reads.
- Deal actor and logistics identity checks use separate bounded projections and do not grant the auth principal generic deal authority.
- DR restore must re-establish function ownership, exact grants, `PUBLIC` revocations and the same `NOBYPASSRLS` boundary before acceptance.
- No custom GUC, role label, user id, session id or tenant id is sufficient proof of staff or tenant authority.

The branch was synchronized with current `main` through a clean two-parent merge after verifying that the 33 incoming commits changed no PR-owned file. This synchronization is not acceptance: only the new exact-head matrix can attest the merged tree.

The pull request remains draft until exact-head CI, one-deal, staff-access, persistent-auth, recovery, Kubernetes and DR gates all pass.
