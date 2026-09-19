BEGIN;

CREATE OR REPLACE FUNCTION tai_activate_retrieval_generation(target_generation BIGINT)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
    PERFORM pg_advisory_xact_lock(
        hashtextextended('tai.retrieval.activation.v2', 0)
    );

    IF NOT EXISTS (
        SELECT 1
        FROM tai_retrieval_generations
        WHERE generation = target_generation
          AND status = 'BUILDING'
        FOR UPDATE
    ) THEN
        RAISE EXCEPTION 'retrieval generation is not BUILDING';
    END IF;

    UPDATE tai_retrieval_generations
    SET status = 'RETIRED',
        retired_at = clock_timestamp(),
        version = version + 1
    WHERE status = 'ACTIVE';

    UPDATE tai_retrieval_generations
    SET status = 'ACTIVE',
        activated_at = clock_timestamp(),
        version = version + 1
    WHERE generation = target_generation
      AND status = 'BUILDING';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'retrieval generation activation lost compare-and-swap';
    END IF;
END;
$$;

COMMENT ON FUNCTION tai_activate_retrieval_generation(BIGINT) IS
    'Serialized retrieval generation activation authority for AP-14F1D and production loaders';

COMMIT;
