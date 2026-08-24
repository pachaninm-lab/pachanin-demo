-- PC-CROP Federal Accounting / Wave 6 prerequisite.
--
-- The 1C runtime authority deliberately uses composite foreign keys from
-- connector pairing/binding rows to (membership id, organization id). The
-- existing membership primary key makes `id` globally unique, but PostgreSQL
-- still requires an explicit unique key matching every referenced column of a
-- composite foreign key.
--
-- This constraint adds no new authority and no new data. It only lets the
-- database prove that the membership referenced by the connector row belongs to
-- the same organization carried by that row, instead of relying on application
-- code to compare the organization separately.

ALTER TABLE public."user_orgs"
  ADD CONSTRAINT user_orgs_one_c_membership_scope_key
  UNIQUE ("id", "organizationId");
