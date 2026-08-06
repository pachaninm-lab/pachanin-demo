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

The branch was synchronized with current `main` through a clean two-parent merge after verifying that the 33 incoming commits changed no PR-owned file.

- synchronized `main`: `bc9bbc79c1bda6aeaeb6464d3f055f6f5fb54529`;
- branch synchronization merge: `0bffbc1a11f54e44ff947aef927526a34b2dcdcb`;
- first post-synchronization evidence commit: `6f69bc37d8e5a613c3c5fe68af605759e38a7aae`;
- generated PR merge-ref at that boundary: `bf05480f4c2bde66e8f819fe064a4fdfe8af6af3`.

These identifiers prove only which trees were combined. They are not acceptance evidence: only the exact-head CI matrix can attest the resulting tree.

The pull request remains draft until exact-head CI, one-deal, staff-access, persistent-auth, recovery, Kubernetes and DR gates all pass.
