BEGIN;

-- GitHub repositories currently expose 40-character SHA-1 object IDs, while
-- Git also supports 64-character SHA-256 object IDs. Exact-head columns are
-- Git object identifiers, not content SHA-256 digests.

ALTER TABLE tai_evaluation_runs
    DROP CONSTRAINT IF EXISTS tai_evaluation_runs_exact_head_sha_check;
ALTER TABLE tai_evaluation_runs
    DROP CONSTRAINT IF EXISTS tai_evaluation_runs_exact_head_sha_git_oid_check;
ALTER TABLE tai_evaluation_runs
    ADD CONSTRAINT tai_evaluation_runs_exact_head_sha_git_oid_check
    CHECK (exact_head_sha ~ '^([0-9a-f]{40}|[0-9a-f]{64})$') NOT VALID;
ALTER TABLE tai_evaluation_runs
    VALIDATE CONSTRAINT tai_evaluation_runs_exact_head_sha_git_oid_check;

ALTER TABLE tai_slo_observations
    DROP CONSTRAINT IF EXISTS tai_slo_observations_exact_head_sha_check;
ALTER TABLE tai_slo_observations
    DROP CONSTRAINT IF EXISTS tai_slo_observations_exact_head_sha_git_oid_check;
ALTER TABLE tai_slo_observations
    ADD CONSTRAINT tai_slo_observations_exact_head_sha_git_oid_check
    CHECK (exact_head_sha ~ '^([0-9a-f]{40}|[0-9a-f]{64})$') NOT VALID;
ALTER TABLE tai_slo_observations
    VALIDATE CONSTRAINT tai_slo_observations_exact_head_sha_git_oid_check;

ALTER TABLE tai_operational_evidence
    DROP CONSTRAINT IF EXISTS tai_operational_evidence_exact_head_sha_check;
ALTER TABLE tai_operational_evidence
    DROP CONSTRAINT IF EXISTS tai_operational_evidence_exact_head_sha_git_oid_check;
ALTER TABLE tai_operational_evidence
    ADD CONSTRAINT tai_operational_evidence_exact_head_sha_git_oid_check
    CHECK (exact_head_sha ~ '^([0-9a-f]{40}|[0-9a-f]{64})$') NOT VALID;
ALTER TABLE tai_operational_evidence
    VALIDATE CONSTRAINT tai_operational_evidence_exact_head_sha_git_oid_check;

ALTER TABLE tai_operational_readiness_decisions
    DROP CONSTRAINT IF EXISTS tai_operational_readiness_decisions_exact_head_sha_check;
ALTER TABLE tai_operational_readiness_decisions
    DROP CONSTRAINT IF EXISTS tai_operational_readiness_decisions_exact_head_sha_git_oid_check;
ALTER TABLE tai_operational_readiness_decisions
    ADD CONSTRAINT tai_operational_readiness_decisions_exact_head_sha_git_oid_check
    CHECK (exact_head_sha ~ '^([0-9a-f]{40}|[0-9a-f]{64})$') NOT VALID;
ALTER TABLE tai_operational_readiness_decisions
    VALIDATE CONSTRAINT tai_operational_readiness_decisions_exact_head_sha_git_oid_check;

ALTER TABLE tai_application_release_attestations
    DROP CONSTRAINT IF EXISTS tai_application_release_attestations_exact_main_sha_check;
ALTER TABLE tai_application_release_attestations
    DROP CONSTRAINT IF EXISTS tai_application_release_attestations_exact_main_sha_git_oid_check;
ALTER TABLE tai_application_release_attestations
    ADD CONSTRAINT tai_application_release_attestations_exact_main_sha_git_oid_check
    CHECK (exact_main_sha ~ '^([0-9a-f]{40}|[0-9a-f]{64})$') NOT VALID;
ALTER TABLE tai_application_release_attestations
    VALIDATE CONSTRAINT tai_application_release_attestations_exact_main_sha_git_oid_check;

ALTER TABLE tai_production_release_attestations
    DROP CONSTRAINT IF EXISTS tai_production_release_attestations_exact_main_sha_check;
ALTER TABLE tai_production_release_attestations
    DROP CONSTRAINT IF EXISTS tai_production_release_attestations_exact_main_sha_git_oid_check;
ALTER TABLE tai_production_release_attestations
    ADD CONSTRAINT tai_production_release_attestations_exact_main_sha_git_oid_check
    CHECK (exact_main_sha ~ '^([0-9a-f]{40}|[0-9a-f]{64})$') NOT VALID;
ALTER TABLE tai_production_release_attestations
    VALIDATE CONSTRAINT tai_production_release_attestations_exact_main_sha_git_oid_check;

COMMIT;
