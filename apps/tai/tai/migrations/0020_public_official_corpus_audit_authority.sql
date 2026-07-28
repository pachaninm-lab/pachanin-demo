BEGIN;

ALTER TABLE tai_public_corpus_audit
    DROP CONSTRAINT IF EXISTS tai_public_corpus_audit_event_type_check;

ALTER TABLE tai_public_corpus_audit
    ADD CONSTRAINT tai_public_corpus_audit_event_type_check
    CHECK (
        event_type IN (
            'SOURCE_ADMITTED',
            'ARTIFACT_ADMITTED',
            'SNAPSHOT_CREATED',
            'SNAPSHOT_ACTIVATED',
            'ARTIFACT_QUARANTINED',
            'SOURCE_WITHDRAWN',
            'QUARANTINE_RELEASED'
        )
    );

CREATE OR REPLACE FUNCTION tai_public_corpus_audit_immutable_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'tai_public_corpus_audit is immutable';
END;
$$;

DROP TRIGGER IF EXISTS tai_public_corpus_audit_immutable
    ON tai_public_corpus_audit;

CREATE TRIGGER tai_public_corpus_audit_immutable
BEFORE UPDATE OR DELETE ON tai_public_corpus_audit
FOR EACH ROW
EXECUTE FUNCTION tai_public_corpus_audit_immutable_guard();

COMMIT;
