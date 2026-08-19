-- PC-CROP Federal Accounting / Wave 6 hardening.
--
-- `create_one_c_pairing_challenge` already revokes an earlier pending challenge
-- before issuing a new one and callers use SERIALIZABLE transactions. This
-- index makes the invariant independent of caller isolation: at most one
-- PENDING one-time pairing challenge may exist for an organization.
--
-- The index contains no secret material and requires no new runtime privilege.

CREATE UNIQUE INDEX one_c_pairing_one_pending_org_idx
  ON connector.one_c_pairing_challenges (tenant_id, organization_id)
  WHERE status = 'PENDING';
