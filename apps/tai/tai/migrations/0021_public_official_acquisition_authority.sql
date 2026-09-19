BEGIN;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tai_public_acquisition_writer') THEN
        CREATE ROLE tai_public_acquisition_writer NOLOGIN;
    END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS tai_public_acquisition_runs (
    run_id TEXT PRIMARY KEY CHECK (run_id ~ '^acq_[a-z0-9]{16,64}$'),
    source_id TEXT NOT NULL CHECK (source_id ~ '^[a-z0-9][a-z0-9._-]{4,160}$'),
    owner_id TEXT NOT NULL CHECK (length(btrim(owner_id)) BETWEEN 1 AND 160),
    lease_token_sha256 TEXT NOT NULL CHECK (lease_token_sha256 ~ '^[0-9a-f]{64}$'),
    lease_version BIGINT NOT NULL CHECK (lease_version > 0),
    acquired_at TIMESTAMPTZ NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL CHECK (expires_at > acquired_at),
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    UNIQUE (run_id, source_id)
);

CREATE TABLE IF NOT EXISTS tai_public_acquisition_raw_evidence (
    run_id TEXT PRIMARY KEY,
    source_id TEXT NOT NULL CHECK (source_id ~ '^[a-z0-9][a-z0-9._-]{4,160}$'),
    requested_uri TEXT NOT NULL CHECK (requested_uri ~ '^https://'),
    final_uri TEXT NOT NULL CHECK (final_uri ~ '^https://'),
    wire_sha256 TEXT NOT NULL CHECK (wire_sha256 ~ '^[0-9a-f]{64}$'),
    decoded_sha256 TEXT NOT NULL CHECK (decoded_sha256 ~ '^[0-9a-f]{64}$'),
    wire_size_bytes BIGINT NOT NULL CHECK (wire_size_bytes >= 0),
    decoded_size_bytes BIGINT NOT NULL CHECK (decoded_size_bytes >= 0),
    media_type TEXT NOT NULL CHECK (
        media_type IN ('text/plain', 'text/html', 'application/json', 'application/xml', 'text/xml')
    ),
    charset TEXT NOT NULL CHECK (charset IN ('utf-8', 'utf8', 'windows-1251', 'cp1251')),
    response_headers_sha256 TEXT NOT NULL CHECK (response_headers_sha256 ~ '^[0-9a-f]{64}$'),
    resolved_ip INET NOT NULL CHECK (
        (
            family(resolved_ip) = 4
            AND NOT (
                resolved_ip <<= inet '0.0.0.0/8'
                OR resolved_ip <<= inet '10.0.0.0/8'
                OR resolved_ip <<= inet '100.64.0.0/10'
                OR resolved_ip <<= inet '127.0.0.0/8'
                OR resolved_ip <<= inet '169.254.0.0/16'
                OR resolved_ip <<= inet '172.16.0.0/12'
                OR resolved_ip <<= inet '192.0.0.0/24'
                OR resolved_ip <<= inet '192.0.2.0/24'
                OR resolved_ip <<= inet '192.168.0.0/16'
                OR resolved_ip <<= inet '198.18.0.0/15'
                OR resolved_ip <<= inet '198.51.100.0/24'
                OR resolved_ip <<= inet '203.0.113.0/24'
                OR resolved_ip <<= inet '224.0.0.0/4'
                OR resolved_ip <<= inet '240.0.0.0/4'
            )
        )
        OR
        (
            family(resolved_ip) = 6
            AND NOT (
                resolved_ip <<= inet '::1/128'
                OR resolved_ip <<= inet 'fc00::/7'
                OR resolved_ip <<= inet 'fe80::/10'
                OR resolved_ip <<= inet 'ff00::/8'
                OR resolved_ip <<= inet '2001:db8::/32'
            )
        )
    ),
    tls_server_name TEXT NOT NULL CHECK (length(btrim(tls_server_name)) BETWEEN 1 AND 253),
    requested_at TIMESTAMPTZ NOT NULL,
    received_at TIMESTAMPTZ NOT NULL CHECK (received_at >= requested_at),
    transport_result TEXT NOT NULL CHECK (length(btrim(transport_result)) BETWEEN 1 AND 96),
    evidence_sha256 TEXT NOT NULL UNIQUE CHECK (evidence_sha256 ~ '^[0-9a-f]{64}$'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    FOREIGN KEY (run_id, source_id)
        REFERENCES tai_public_acquisition_runs (run_id, source_id)
        ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS tai_public_acquisition_fragments (
    run_id TEXT NOT NULL REFERENCES tai_public_acquisition_runs (run_id) ON DELETE RESTRICT,
    ordinal INTEGER NOT NULL CHECK (ordinal >= 0),
    locator_kind TEXT NOT NULL CHECK (locator_kind IN ('SECTION', 'JSON_POINTER', 'XML_XPATH')),
    locator_value TEXT NOT NULL CHECK (length(btrim(locator_value)) BETWEEN 1 AND 2048),
    fragment_sha256 TEXT NOT NULL CHECK (fragment_sha256 ~ '^[0-9a-f]{64}$'),
    text_size_bytes BIGINT NOT NULL CHECK (text_size_bytes BETWEEN 1 AND 5000000),
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    PRIMARY KEY (run_id, ordinal),
    UNIQUE (run_id, fragment_sha256)
);

CREATE TABLE IF NOT EXISTS tai_public_acquisition_terminals (
    run_id TEXT PRIMARY KEY REFERENCES tai_public_acquisition_runs (run_id) ON DELETE RESTRICT,
    outcome TEXT NOT NULL CHECK (
        outcome IN ('NOT_MODIFIED', 'MATERIALIZED', 'QUARANTINED', 'RETRYABLE_FAILURE', 'PERMANENT_FAILURE')
    ),
    manifest_sha256 TEXT CHECK (manifest_sha256 IS NULL OR manifest_sha256 ~ '^[0-9a-f]{64}$'),
    fragments_manifest_sha256 TEXT CHECK (
        fragments_manifest_sha256 IS NULL OR fragments_manifest_sha256 ~ '^[0-9a-f]{64}$'
    ),
    reason_code TEXT CHECK (reason_code IS NULL OR reason_code ~ '^[A-Z0-9_]{3,96}$'),
    completed_at TIMESTAMPTZ NOT NULL,
    terminal_sha256 TEXT NOT NULL UNIQUE CHECK (terminal_sha256 ~ '^[0-9a-f]{64}$'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CHECK (
        outcome <> 'MATERIALIZED'
        OR (
            manifest_sha256 IS NOT NULL
            AND fragments_manifest_sha256 IS NOT NULL
            AND reason_code IS NULL
        )
    )
);

CREATE TABLE IF NOT EXISTS tai_public_acquisition_audit (
    audit_id BIGSERIAL PRIMARY KEY,
    run_id TEXT NOT NULL REFERENCES tai_public_acquisition_runs (run_id) ON DELETE RESTRICT,
    event_type TEXT NOT NULL CHECK (
        event_type IN ('RUN_STARTED', 'FETCH_EVIDENCE', 'NOT_MODIFIED', 'MATERIALIZED', 'QUARANTINED', 'FAILED')
    ),
    actor_id TEXT NOT NULL CHECK (length(btrim(actor_id)) BETWEEN 1 AND 160),
    reason_code TEXT NOT NULL CHECK (reason_code ~ '^[A-Z0-9_]{3,96}$'),
    event_sha256 TEXT NOT NULL UNIQUE CHECK (event_sha256 ~ '^[0-9a-f]{64}$'),
    created_at TIMESTAMPTZ NOT NULL,
    UNIQUE (run_id, event_type)
);

CREATE OR REPLACE FUNCTION tai_public_acquisition_immutable_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'TAI_PUBLIC_ACQUISITION_IMMUTABLE' USING ERRCODE = '55000';
END;
$$;

DO $$
DECLARE
    table_name TEXT;
    trigger_name TEXT;
BEGIN
    FOREACH table_name IN ARRAY ARRAY[
        'tai_public_acquisition_runs',
        'tai_public_acquisition_raw_evidence',
        'tai_public_acquisition_fragments',
        'tai_public_acquisition_terminals',
        'tai_public_acquisition_audit'
    ]
    LOOP
        trigger_name := table_name || '_immutable';
        EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I', trigger_name, table_name);
        EXECUTE format(
            'CREATE TRIGGER %I BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION tai_public_acquisition_immutable_guard()',
            trigger_name,
            table_name
        );
    END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION tai_public_acquisition_assert_fence(
    p_run_id TEXT,
    p_owner_id TEXT,
    p_lease_token_sha256 TEXT,
    p_lease_version BIGINT,
    p_at TIMESTAMPTZ
) RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    source_identity TEXT;
BEGIN
    SELECT source_id
    INTO source_identity
    FROM tai_public_acquisition_runs
    WHERE run_id = p_run_id
      AND owner_id = p_owner_id
      AND lease_token_sha256 = p_lease_token_sha256
      AND lease_version = p_lease_version
      AND p_at >= acquired_at
      AND p_at < expires_at
    FOR SHARE;

    IF source_identity IS NULL THEN
        RAISE EXCEPTION 'TAI_PUBLIC_ACQUISITION_FENCE_DENIED' USING ERRCODE = '42501';
    END IF;
    RETURN source_identity;
END;
$$;

CREATE OR REPLACE FUNCTION tai_record_public_acquisition_start(
    p_run_id TEXT,
    p_source_id TEXT,
    p_owner_id TEXT,
    p_lease_token_sha256 TEXT,
    p_lease_version BIGINT,
    p_acquired_at TIMESTAMPTZ,
    p_expires_at TIMESTAMPTZ,
    p_actor_id TEXT,
    p_reason_code TEXT,
    p_event_sha256 TEXT,
    p_event_at TIMESTAMPTZ
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    INSERT INTO tai_public_acquisition_runs(
        run_id,
        source_id,
        owner_id,
        lease_token_sha256,
        lease_version,
        acquired_at,
        expires_at
    ) VALUES (
        p_run_id,
        p_source_id,
        p_owner_id,
        p_lease_token_sha256,
        p_lease_version,
        p_acquired_at,
        p_expires_at
    ) ON CONFLICT (run_id) DO NOTHING;

    IF NOT EXISTS (
        SELECT 1
        FROM tai_public_acquisition_runs
        WHERE run_id = p_run_id
          AND source_id = p_source_id
          AND owner_id = p_owner_id
          AND lease_token_sha256 = p_lease_token_sha256
          AND lease_version = p_lease_version
          AND acquired_at = p_acquired_at
          AND expires_at = p_expires_at
    ) THEN
        RAISE EXCEPTION 'TAI_PUBLIC_ACQUISITION_START_CONFLICT' USING ERRCODE = '23505';
    END IF;

    INSERT INTO tai_public_acquisition_audit(
        run_id, event_type, actor_id, reason_code, event_sha256, created_at
    ) VALUES (
        p_run_id, 'RUN_STARTED', p_actor_id, p_reason_code, p_event_sha256, p_event_at
    ) ON CONFLICT (run_id, event_type) DO NOTHING;

    IF NOT EXISTS (
        SELECT 1
        FROM tai_public_acquisition_audit
        WHERE run_id = p_run_id
          AND event_type = 'RUN_STARTED'
          AND actor_id = p_actor_id
          AND reason_code = p_reason_code
          AND event_sha256 = p_event_sha256
          AND created_at = p_event_at
    ) THEN
        RAISE EXCEPTION 'TAI_PUBLIC_ACQUISITION_START_AUDIT_CONFLICT' USING ERRCODE = '23505';
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION tai_record_public_acquisition_raw_evidence(
    p_run_id TEXT,
    p_owner_id TEXT,
    p_lease_token_sha256 TEXT,
    p_lease_version BIGINT,
    p_requested_uri TEXT,
    p_final_uri TEXT,
    p_wire_sha256 TEXT,
    p_decoded_sha256 TEXT,
    p_wire_size_bytes BIGINT,
    p_decoded_size_bytes BIGINT,
    p_media_type TEXT,
    p_charset TEXT,
    p_response_headers_sha256 TEXT,
    p_resolved_ip INET,
    p_tls_server_name TEXT,
    p_requested_at TIMESTAMPTZ,
    p_received_at TIMESTAMPTZ,
    p_transport_result TEXT,
    p_evidence_sha256 TEXT,
    p_actor_id TEXT,
    p_reason_code TEXT,
    p_event_sha256 TEXT
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    source_identity TEXT;
BEGIN
    source_identity := tai_public_acquisition_assert_fence(
        p_run_id,
        p_owner_id,
        p_lease_token_sha256,
        p_lease_version,
        p_received_at
    );

    INSERT INTO tai_public_acquisition_raw_evidence(
        run_id,
        source_id,
        requested_uri,
        final_uri,
        wire_sha256,
        decoded_sha256,
        wire_size_bytes,
        decoded_size_bytes,
        media_type,
        charset,
        response_headers_sha256,
        resolved_ip,
        tls_server_name,
        requested_at,
        received_at,
        transport_result,
        evidence_sha256
    ) VALUES (
        p_run_id,
        source_identity,
        p_requested_uri,
        p_final_uri,
        p_wire_sha256,
        p_decoded_sha256,
        p_wire_size_bytes,
        p_decoded_size_bytes,
        p_media_type,
        p_charset,
        p_response_headers_sha256,
        p_resolved_ip,
        p_tls_server_name,
        p_requested_at,
        p_received_at,
        p_transport_result,
        p_evidence_sha256
    ) ON CONFLICT (run_id) DO NOTHING;

    IF NOT EXISTS (
        SELECT 1
        FROM tai_public_acquisition_raw_evidence
        WHERE run_id = p_run_id
          AND source_id = source_identity
          AND requested_uri = p_requested_uri
          AND final_uri = p_final_uri
          AND wire_sha256 = p_wire_sha256
          AND decoded_sha256 = p_decoded_sha256
          AND wire_size_bytes = p_wire_size_bytes
          AND decoded_size_bytes = p_decoded_size_bytes
          AND media_type = p_media_type
          AND charset = p_charset
          AND response_headers_sha256 = p_response_headers_sha256
          AND resolved_ip = p_resolved_ip
          AND tls_server_name = p_tls_server_name
          AND requested_at = p_requested_at
          AND received_at = p_received_at
          AND transport_result = p_transport_result
          AND evidence_sha256 = p_evidence_sha256
    ) THEN
        RAISE EXCEPTION 'TAI_PUBLIC_ACQUISITION_EVIDENCE_CONFLICT' USING ERRCODE = '23505';
    END IF;

    INSERT INTO tai_public_acquisition_audit(
        run_id, event_type, actor_id, reason_code, event_sha256, created_at
    ) VALUES (
        p_run_id, 'FETCH_EVIDENCE', p_actor_id, p_reason_code, p_event_sha256, p_received_at
    ) ON CONFLICT (run_id, event_type) DO NOTHING;

    IF NOT EXISTS (
        SELECT 1
        FROM tai_public_acquisition_audit
        WHERE run_id = p_run_id
          AND event_type = 'FETCH_EVIDENCE'
          AND actor_id = p_actor_id
          AND reason_code = p_reason_code
          AND event_sha256 = p_event_sha256
          AND created_at = p_received_at
    ) THEN
        RAISE EXCEPTION 'TAI_PUBLIC_ACQUISITION_EVIDENCE_AUDIT_CONFLICT' USING ERRCODE = '23505';
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION tai_record_public_acquisition_fragment(
    p_run_id TEXT,
    p_owner_id TEXT,
    p_lease_token_sha256 TEXT,
    p_lease_version BIGINT,
    p_ordinal INTEGER,
    p_locator_kind TEXT,
    p_locator_value TEXT,
    p_fragment_sha256 TEXT,
    p_text_size_bytes BIGINT,
    p_recorded_at TIMESTAMPTZ
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    PERFORM tai_public_acquisition_assert_fence(
        p_run_id,
        p_owner_id,
        p_lease_token_sha256,
        p_lease_version,
        p_recorded_at
    );

    INSERT INTO tai_public_acquisition_fragments(
        run_id, ordinal, locator_kind, locator_value, fragment_sha256, text_size_bytes, created_at
    ) VALUES (
        p_run_id,
        p_ordinal,
        p_locator_kind,
        p_locator_value,
        p_fragment_sha256,
        p_text_size_bytes,
        p_recorded_at
    ) ON CONFLICT (run_id, ordinal) DO NOTHING;

    IF NOT EXISTS (
        SELECT 1
        FROM tai_public_acquisition_fragments
        WHERE run_id = p_run_id
          AND ordinal = p_ordinal
          AND locator_kind = p_locator_kind
          AND locator_value = p_locator_value
          AND fragment_sha256 = p_fragment_sha256
          AND text_size_bytes = p_text_size_bytes
          AND created_at = p_recorded_at
    ) THEN
        RAISE EXCEPTION 'TAI_PUBLIC_ACQUISITION_FRAGMENT_CONFLICT' USING ERRCODE = '23505';
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION tai_record_public_acquisition_terminal(
    p_run_id TEXT,
    p_owner_id TEXT,
    p_lease_token_sha256 TEXT,
    p_lease_version BIGINT,
    p_outcome TEXT,
    p_manifest_sha256 TEXT,
    p_fragments_manifest_sha256 TEXT,
    p_reason_code TEXT,
    p_completed_at TIMESTAMPTZ,
    p_terminal_sha256 TEXT,
    p_actor_id TEXT,
    p_audit_reason_code TEXT,
    p_event_sha256 TEXT
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    source_identity TEXT;
    event_identity TEXT;
BEGIN
    source_identity := tai_public_acquisition_assert_fence(
        p_run_id,
        p_owner_id,
        p_lease_token_sha256,
        p_lease_version,
        p_completed_at
    );

    IF p_outcome = 'MATERIALIZED' THEN
        IF NOT EXISTS (
            SELECT 1
            FROM tai_public_acquisition_raw_evidence
            WHERE run_id = p_run_id
              AND evidence_sha256 = p_manifest_sha256
        ) THEN
            RAISE EXCEPTION 'TAI_PUBLIC_ACQUISITION_MANIFEST_REQUIRED' USING ERRCODE = '23514';
        END IF;
        IF NOT EXISTS (
            SELECT 1 FROM tai_public_acquisition_fragments WHERE run_id = p_run_id
        ) THEN
            RAISE EXCEPTION 'TAI_PUBLIC_ACQUISITION_FRAGMENTS_REQUIRED' USING ERRCODE = '23514';
        END IF;
        IF NOT EXISTS (
            SELECT 1
            FROM tai_public_corpus_source_admissions
            WHERE source_id = source_identity
              AND status = 'ADMITTED'
              AND rights_review_due_at > p_completed_at
        ) THEN
            RAISE EXCEPTION 'TAI_PUBLIC_ACQUISITION_SOURCE_INELIGIBLE' USING ERRCODE = '23514';
        END IF;
        IF EXISTS (
            SELECT 1
            FROM tai_public_corpus_quarantine
            WHERE source_id = source_identity
              AND released_at IS NULL
        ) THEN
            RAISE EXCEPTION 'TAI_PUBLIC_ACQUISITION_OPEN_QUARANTINE' USING ERRCODE = '23514';
        END IF;
    END IF;

    INSERT INTO tai_public_acquisition_terminals(
        run_id,
        outcome,
        manifest_sha256,
        fragments_manifest_sha256,
        reason_code,
        completed_at,
        terminal_sha256
    ) VALUES (
        p_run_id,
        p_outcome,
        p_manifest_sha256,
        p_fragments_manifest_sha256,
        p_reason_code,
        p_completed_at,
        p_terminal_sha256
    ) ON CONFLICT (run_id) DO NOTHING;

    IF NOT EXISTS (
        SELECT 1
        FROM tai_public_acquisition_terminals
        WHERE run_id = p_run_id
          AND outcome = p_outcome
          AND manifest_sha256 IS NOT DISTINCT FROM p_manifest_sha256
          AND fragments_manifest_sha256 IS NOT DISTINCT FROM p_fragments_manifest_sha256
          AND reason_code IS NOT DISTINCT FROM p_reason_code
          AND completed_at = p_completed_at
          AND terminal_sha256 = p_terminal_sha256
    ) THEN
        RAISE EXCEPTION 'TAI_PUBLIC_ACQUISITION_TERMINAL_CONFLICT' USING ERRCODE = '23505';
    END IF;

    event_identity := CASE p_outcome
        WHEN 'NOT_MODIFIED' THEN 'NOT_MODIFIED'
        WHEN 'MATERIALIZED' THEN 'MATERIALIZED'
        WHEN 'QUARANTINED' THEN 'QUARANTINED'
        ELSE 'FAILED'
    END;

    INSERT INTO tai_public_acquisition_audit(
        run_id, event_type, actor_id, reason_code, event_sha256, created_at
    ) VALUES (
        p_run_id,
        event_identity,
        p_actor_id,
        p_audit_reason_code,
        p_event_sha256,
        p_completed_at
    ) ON CONFLICT (run_id, event_type) DO NOTHING;

    IF NOT EXISTS (
        SELECT 1
        FROM tai_public_acquisition_audit
        WHERE run_id = p_run_id
          AND event_type = event_identity
          AND actor_id = p_actor_id
          AND reason_code = p_audit_reason_code
          AND event_sha256 = p_event_sha256
          AND created_at = p_completed_at
    ) THEN
        RAISE EXCEPTION 'TAI_PUBLIC_ACQUISITION_TERMINAL_AUDIT_CONFLICT' USING ERRCODE = '23505';
    END IF;
END;
$$;

REVOKE ALL ON tai_public_acquisition_runs FROM PUBLIC, tai_public_acquisition_writer;
REVOKE ALL ON tai_public_acquisition_raw_evidence FROM PUBLIC, tai_public_acquisition_writer;
REVOKE ALL ON tai_public_acquisition_fragments FROM PUBLIC, tai_public_acquisition_writer;
REVOKE ALL ON tai_public_acquisition_terminals FROM PUBLIC, tai_public_acquisition_writer;
REVOKE ALL ON tai_public_acquisition_audit FROM PUBLIC, tai_public_acquisition_writer;
REVOKE ALL ON SEQUENCE tai_public_acquisition_audit_audit_id_seq FROM PUBLIC, tai_public_acquisition_writer;

REVOKE ALL ON FUNCTION tai_public_acquisition_assert_fence(TEXT, TEXT, TEXT, BIGINT, TIMESTAMPTZ) FROM PUBLIC;
REVOKE ALL ON FUNCTION tai_record_public_acquisition_start(
    TEXT, TEXT, TEXT, TEXT, BIGINT, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TEXT, TEXT, TIMESTAMPTZ
) FROM PUBLIC;
REVOKE ALL ON FUNCTION tai_record_public_acquisition_raw_evidence(
    TEXT, TEXT, TEXT, BIGINT, TEXT, TEXT, TEXT, TEXT, BIGINT, BIGINT, TEXT, TEXT, TEXT,
    INET, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TEXT, TEXT, TEXT, TEXT
) FROM PUBLIC;
REVOKE ALL ON FUNCTION tai_record_public_acquisition_fragment(
    TEXT, TEXT, TEXT, BIGINT, INTEGER, TEXT, TEXT, TEXT, BIGINT, TIMESTAMPTZ
) FROM PUBLIC;
REVOKE ALL ON FUNCTION tai_record_public_acquisition_terminal(
    TEXT, TEXT, TEXT, BIGINT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, TEXT, TEXT, TEXT, TEXT
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION tai_record_public_acquisition_start(
    TEXT, TEXT, TEXT, TEXT, BIGINT, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TEXT, TEXT, TIMESTAMPTZ
) TO tai_public_acquisition_writer;
GRANT EXECUTE ON FUNCTION tai_record_public_acquisition_raw_evidence(
    TEXT, TEXT, TEXT, BIGINT, TEXT, TEXT, TEXT, TEXT, BIGINT, BIGINT, TEXT, TEXT, TEXT,
    INET, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TEXT, TEXT, TEXT, TEXT
) TO tai_public_acquisition_writer;
GRANT EXECUTE ON FUNCTION tai_record_public_acquisition_fragment(
    TEXT, TEXT, TEXT, BIGINT, INTEGER, TEXT, TEXT, TEXT, BIGINT, TIMESTAMPTZ
) TO tai_public_acquisition_writer;
GRANT EXECUTE ON FUNCTION tai_record_public_acquisition_terminal(
    TEXT, TEXT, TEXT, BIGINT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, TEXT, TEXT, TEXT, TEXT
) TO tai_public_acquisition_writer;

COMMIT;
