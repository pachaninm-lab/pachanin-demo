-- Owner decision of 26.07.2026: TAI is INFORMATIONAL_ONLY, and confirm_action refuses
-- every confirmation instead of executing it. The refusal is audited.
--
-- `reason` already existed as free text. These columns exist so the refusal is queryable
-- rather than greppable: an operator asking "how often was a retained confirmation route
-- probed after the boundary changed" should not have to pattern-match a message that may
-- be reworded.
--
-- Every column is nullable and every existing row keeps NULL, because they describe a
-- denial and an answer trace is not one.

ALTER TABLE tai_orchestration_traces
    ADD COLUMN IF NOT EXISTS outcome TEXT CHECK (
        outcome IS NULL OR outcome IN ('DENIED')
    ),
    ADD COLUMN IF NOT EXISTS denial_reason_code TEXT CHECK (
        denial_reason_code IS NULL
        OR denial_reason_code ~ '^[A-Z][A-Z0-9_]{2,79}$'
    ),
    ADD COLUMN IF NOT EXISTS boundary TEXT CHECK (
        boundary IS NULL OR boundary IN ('INFORMATIONAL_ONLY')
    ),
    ADD COLUMN IF NOT EXISTS route_category TEXT CHECK (
        route_category IS NULL
        OR route_category ~ '^[A-Z][A-Z0-9_]{2,79}$'
    ),
    ADD COLUMN IF NOT EXISTS organization_id UUID,
    ADD COLUMN IF NOT EXISTS release_version TEXT CHECK (
        release_version IS NULL OR length(release_version) BETWEEN 1 AND 160
    );

-- A denial must carry the whole typed set or none of it. A row with an outcome but no
-- reason code is the shape a partially-updated writer produces, and it is worse than no
-- row at all because it looks complete.
ALTER TABLE tai_orchestration_traces
    DROP CONSTRAINT IF EXISTS tai_orchestration_traces_denial_complete;
ALTER TABLE tai_orchestration_traces
    ADD CONSTRAINT tai_orchestration_traces_denial_complete CHECK (
        (outcome IS NULL AND denial_reason_code IS NULL AND boundary IS NULL
            AND route_category IS NULL)
        OR (outcome IS NOT NULL AND denial_reason_code IS NOT NULL AND boundary IS NOT NULL
            AND route_category IS NOT NULL)
    );

-- Denials are read by reason code over a time range; answer traces are the overwhelming
-- majority of the table, so the index covers only the rows that carry a code.
CREATE INDEX IF NOT EXISTS tai_orchestration_traces_denial_idx
    ON tai_orchestration_traces (denial_reason_code, completed_at DESC)
    WHERE denial_reason_code IS NOT NULL;
