-- #5064: harden DAILY_EFFECTIVE authority so persisted physical composition lineage is mandatory.
-- Forward-only. This migration only strengthens the existing authority invariant; no grant is relaxed.

DO $existing_daily_authority_lineage_preflight$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM eligibility.registry_generation_authority AS a
    LEFT JOIN eligibility.registry_generation_lineage AS l
      ON l.generation_id = a.generation_id
    WHERE a.generation_mode = 'DAILY_EFFECTIVE'
      AND (
        l.generation_id IS NULL
        OR l.source IS DISTINCT FROM a.source
        OR l.registry_domain IS DISTINCT FROM a.registry_domain
        OR l.predecessor_generation_id IS DISTINCT FROM a.predecessor_generation_id
        OR l.update_package_id IS DISTINCT FROM a.update_package_id
        OR l.update_package_sha256 IS DISTINCT FROM a.update_package_sha256
        OR l.effective_cutoff IS DISTINCT FROM a.effective_cutoff
      )
  ) THEN
    RAISE EXCEPTION 'existing DAILY_EFFECTIVE authority is not bound to persisted composition lineage';
  END IF;
END
$existing_daily_authority_lineage_preflight$;

CREATE OR REPLACE FUNCTION eligibility.validate_registry_authority_lineage()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, eligibility
AS $function$
DECLARE
  ref_source TEXT;
  ref_domain TEXT;
  physical RECORD;
BEGIN
  IF NEW.predecessor_generation_id = NEW.generation_id THEN
    RAISE EXCEPTION 'predecessor generation cannot self-reference';
  END IF;

  IF NEW.baseline_generation_id IS NOT NULL THEN
    SELECT source, registry_domain INTO ref_source, ref_domain
    FROM eligibility.registry_generations
    WHERE id = NEW.baseline_generation_id;
    IF ref_source IS DISTINCT FROM NEW.source OR ref_domain IS DISTINCT FROM NEW.registry_domain THEN
      RAISE EXCEPTION 'baseline generation crosses registry authority domain';
    END IF;
  END IF;

  IF NEW.predecessor_generation_id IS NOT NULL THEN
    SELECT source, registry_domain INTO ref_source, ref_domain
    FROM eligibility.registry_generations
    WHERE id = NEW.predecessor_generation_id;
    IF ref_source IS DISTINCT FROM NEW.source OR ref_domain IS DISTINCT FROM NEW.registry_domain THEN
      RAISE EXCEPTION 'predecessor generation crosses registry authority domain';
    END IF;
  END IF;

  IF NEW.generation_mode = 'DAILY_EFFECTIVE' THEN
    SELECT * INTO physical
    FROM eligibility.registry_generation_lineage
    WHERE generation_id = NEW.generation_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'DAILY_EFFECTIVE authority requires persisted composition lineage';
    END IF;

    IF physical.source IS DISTINCT FROM NEW.source
       OR physical.registry_domain IS DISTINCT FROM NEW.registry_domain
       OR physical.predecessor_generation_id IS DISTINCT FROM NEW.predecessor_generation_id
       OR physical.update_package_id IS DISTINCT FROM NEW.update_package_id
       OR physical.update_package_sha256 IS DISTINCT FROM NEW.update_package_sha256
       OR physical.effective_cutoff IS DISTINCT FROM NEW.effective_cutoff THEN
      RAISE EXCEPTION 'authority lineage contradicts persisted composition lineage';
    END IF;
  END IF;

  RETURN NEW;
END
$function$;
