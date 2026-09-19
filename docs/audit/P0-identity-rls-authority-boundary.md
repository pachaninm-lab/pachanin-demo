# P0 Identity RLS authority boundary

This document records the runtime contract enforced by PR #3684.

- Authentication, deal and staff runtime principals are `NOSUPERUSER NOBYPASSRLS`.
- `public.users`, `public.user_orgs` and `public.organizations` use `ENABLE ROW LEVEL SECURITY` and `FORCE ROW LEVEL SECURITY`.
- Pre-authentication reads are available only through named `SECURITY DEFINER` functions owned by `pc_identity_bootstrap`.
- Staff target validation uses `auth.resolve_staff_target_scope(...)`; runtime principals receive only `EXECUTE`, not cross-tenant table reads.
- Deal actor and logistics identity checks use separate bounded projections and do not grant the auth principal generic deal authority.
- DR restore must re-establish function ownership, exact grants, `PUBLIC` revocations and the same `NOBYPASSRLS` boundary before acceptance.
- No custom GUC, role label, user id, session id or tenant id is sufficient proof of staff or tenant authority.

## Main synchronization boundary

The branch was synchronized with current `main` through a clean two-parent merge after verifying that the four incoming commits changed only TAI preflight files and no PR-owned path.

- synchronized `main`: `cd1763e5e6f11309c2cde89c17faec4b5cc61c3c`;
- pre-synchronization branch head: `1348744def007f41f15eb85afdf2341f02a7dd31`;
- two-parent synchronization merge: `103bf37cd2aee7c2b0aea5094d9d14cd8ca87474`.

These identifiers prove only which trees were combined. They are not acceptance evidence: only the exact-head CI matrix can attest the resulting tree. A queued, pending, cancelled or superseded run is never treated as PASS.

The pull request remains draft until exact-head CI, one-deal, staff-access, persistent-auth, recovery, Kubernetes and DR gates all pass.
