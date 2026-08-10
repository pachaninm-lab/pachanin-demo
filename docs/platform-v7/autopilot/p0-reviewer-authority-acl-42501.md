# P0 reviewer preflight — production 42501 authority ACL evidence

Production exact-main `be061e59915bec02eef0574d0065a647a8fb065b` reached full REG.RU release PASS before the owner-only reviewer preflight was executed.

The read-only preflight run `31374247705` reached the exact API/Web revisions and the `pc_staff_runtime` boundary, then PostgreSQL rejected `SELECT active_owner_count, usable_reviewer_count FROM auth.staff_reviewer_preflight()` with SQLSTATE `42501`, `permission denied for table staff_assignments`.

Repository authority history proves the intended split:

- `pc_staff_authority` is NOLOGIN / membership-isolated and was originally granted SELECT on `auth.staff_access_sessions`, `auth.staff_access_grants`, and `auth.staff_assignments` for fixed SECURITY DEFINER bodies;
- `pc_staff_runtime` is login-capable but function-only and must never receive table privileges;
- the P0 reviewer helper is SECURITY DEFINER owned by `pc_staff_authority` and returns only two aggregate integer counts.

Therefore the remediation is a forward-only reassertion of the pre-existing authority ACL to `pc_staff_authority`, paired with an explicit runtime revoke and same-transaction privilege proof. It does not create/elevate staff identities and performs no product-data mutation.
