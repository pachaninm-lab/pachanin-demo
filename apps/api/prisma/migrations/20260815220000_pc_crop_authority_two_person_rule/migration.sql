-- PC-CROP federal accounting, Wave 2 third slice: the two-person rule, in the
-- database rather than only in the policy that calls it.
--
-- Minting the right to sign on behalf of an organization is the privileged
-- grant section 41 wants two people behind. The command policy already refuses
-- a self-approved grant and a second approver who is really the same human. A
-- policy is code, though, and code can be bypassed by a repair script, a
-- migration, an ops console or a future call site that forgets. The constraint
-- below cannot be.
--
-- Expand-only. One nullable column and three constraints; no existing column,
-- grant or policy is altered.
--
-- Nullable rather than NOT NULL on purpose: an authority that has been revoked
-- or expired is history, and history must stay writable to the archive even if
-- it predates this rule. The constraint therefore binds the state that matters
-- — an ACTIVE authority must name its second approver — instead of rewriting
-- what is already inert.

ALTER TABLE public."signing_authorities"
  ADD COLUMN IF NOT EXISTS "secondApprovalMembershipId" TEXT;

DO $two_person_rule$
BEGIN
  -- An authority that can actually be used must carry its second approver.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'signing_authority_second_approval_present_check'
  ) THEN
    ALTER TABLE public."signing_authorities"
      ADD CONSTRAINT signing_authority_second_approval_present_check
      CHECK (
        "status" <> 'ACTIVE'
        OR ("secondApprovalMembershipId" IS NOT NULL
            AND btrim("secondApprovalMembershipId") <> '')
      );
  END IF;

  -- The approver may not be the person who benefits from the grant.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'signing_authority_second_approval_not_holder_check'
  ) THEN
    ALTER TABLE public."signing_authorities"
      ADD CONSTRAINT signing_authority_second_approval_not_holder_check
      CHECK (
        "secondApprovalMembershipId" IS NULL
        OR "secondApprovalMembershipId" <> "membershipId"
      );
  END IF;

  -- Nor the person who issued it. Two signatures from one hand are one
  -- signature.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'signing_authority_second_approval_not_granter_check'
  ) THEN
    ALTER TABLE public."signing_authorities"
      ADD CONSTRAINT signing_authority_second_approval_not_granter_check
      CHECK (
        "secondApprovalMembershipId" IS NULL
        OR "secondApprovalMembershipId" <> "grantedByMembershipId"
      );
  END IF;
END
$two_person_rule$;

-- The approver must be a real membership of the same organization, so the
-- column cannot be filled with a plausible-looking string.
--
-- ON DELETE RESTRICT rather than SET NULL. Nulling the column would quietly
-- erase who approved a signing right the moment their membership row was
-- deleted, which is the audit trail destroying itself. Memberships in this
-- schema are revoked by status and revokedAt rather than deleted, so the
-- restriction blocks nothing that normal operation does.
DO $two_person_reference$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'signing_authorities_secondApprovalMembershipId_organizatio_fkey'
  ) THEN
    ALTER TABLE public."signing_authorities"
      ADD CONSTRAINT "signing_authorities_secondApprovalMembershipId_organizatio_fkey"
      FOREIGN KEY ("secondApprovalMembershipId", "organizationId")
      REFERENCES public."user_orgs" ("id", "organizationId")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END
$two_person_reference$;

-- The read principal gains the new column, because a reviewer asking who
-- approved a signing right is exactly the question this column exists for.
DO $accounting_read_grant$
DECLARE
  role_name text := 'pc_accounting_authority';
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = role_name) THEN
    EXECUTE format(
      'GRANT SELECT ("secondApprovalMembershipId") ON public."signing_authorities" TO %I',
      role_name
    );
  END IF;
END
$accounting_read_grant$;
