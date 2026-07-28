\set ON_ERROR_STOP on

DO $assert_postgresql_major$
BEGIN
  IF current_setting('server_version_num')::integer < 160000
    OR current_setting('server_version_num')::integer >= 170000
  THEN
    RAISE EXCEPTION 'PostgreSQL 16 is required, got %', current_setting('server_version');
  END IF;
END
$assert_postgresql_major$;

DO $assert_authority_shape$
DECLARE
  v_table_count integer;
  v_security_barrier text;
BEGIN
  SELECT count(*)::integer INTO v_table_count
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind = 'r'
    AND c.relname IN (
      'tai_public_source_admissions',
      'tai_public_source_versions',
      'tai_public_source_artifacts',
      'tai_public_corpus_quarantine_events',
      'tai_public_source_withdrawals',
      'tai_public_corpus_snapshots',
      'tai_public_corpus_snapshot_members'
    );

  IF v_table_count <> 7 THEN
    RAISE EXCEPTION 'expected 7 authority tables, got %', v_table_count;
  END IF;

  SELECT array_to_string(c.reloptions, ',') INTO v_security_barrier
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname = 'tai_public_corpus_retrieval_entries';

  IF coalesce(v_security_barrier, '') NOT LIKE '%security_barrier=true%' THEN
    RAISE EXCEPTION 'retrieval view must be a security barrier';
  END IF;

  IF has_table_privilege('tai_knowledge_reader', 'public.tai_public_source_admissions', 'INSERT')
    OR has_table_privilege('tai_knowledge_reader', 'public.tai_public_source_versions', 'UPDATE')
    OR has_table_privilege('tai_knowledge_reader', 'public.tai_public_source_artifacts', 'DELETE')
    OR has_table_privilege('tai_knowledge_ingestor', 'public.tai_public_source_artifacts', 'INSERT')
  THEN
    RAISE EXCEPTION 'direct authority DML must remain revoked';
  END IF;

  IF NOT has_table_privilege('tai_knowledge_reader', 'public.tai_public_corpus_retrieval_entries', 'SELECT') THEN
    RAISE EXCEPTION 'reader must have retrieval view access';
  END IF;

  IF has_function_privilege(
    'tai_knowledge_reader',
    'tai_knowledge.register_source(text,text,text,text,text,text,text,date,date,text)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'reader must not execute authority mutations';
  END IF;

  IF NOT has_function_privilege(
    'tai_knowledge_ingestor',
    'tai_knowledge.register_source(text,text,text,text,text,text,text,date,date,text)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'ingestor must execute controlled authority functions';
  END IF;
END
$assert_authority_shape$;

SET ROLE tai_knowledge_ingestor;

SELECT tai_knowledge.register_source(
  'src_aaaaaaaaaaaa',
  'synthetic.official.manual',
  'OFFICIAL_MANUAL',
  'https://official.example.test/manual',
  'official.example.test',
  'AP14F0-SYNTHETIC_MANUAL',
  'ALLOWED_SHARED_RAG',
  DATE '2026-07-28',
  DATE '2099-12-31',
  'audit_source000001'
);

SELECT tai_knowledge.register_source(
  'src_aaaaaaaaaaaa',
  'synthetic.official.manual',
  'OFFICIAL_MANUAL',
  'https://official.example.test/manual',
  'official.example.test',
  'AP14F0-SYNTHETIC_MANUAL',
  'ALLOWED_SHARED_RAG',
  DATE '2026-07-28',
  DATE '2099-12-31',
  'audit_source000001'
);

SELECT tai_knowledge.register_source_version(
  'srcver_bbbbbbbbbbbb',
  'src_aaaaaaaaaaaa',
  '2026.07',
  DATE '2026-07-01',
  DATE '2026-07-01',
  TIMESTAMPTZ '2026-07-28T18:30:00Z',
  'SECTION',
  'synthetic-section-1',
  'audit_version00001'
);

SELECT tai_knowledge.register_source_version(
  'srcver_bbbbbbbbbbbb',
  'src_aaaaaaaaaaaa',
  '2026.07',
  DATE '2026-07-01',
  DATE '2026-07-01',
  TIMESTAMPTZ '2026-07-28T18:30:00Z',
  'SECTION',
  'synthetic-section-1',
  'audit_version00001'
);

SELECT tai_knowledge.record_artifact(
  'artifact_cccccccccccc',
  'srcver_bbbbbbbbbbbb',
  repeat('a', 64),
  'application/json',
  1024,
  'artifact-ref:synthetic/ap14f1a/a',
  'https://official.example.test/manual',
  'official.example.test',
  DATE '2026-07-01',
  DATE '2026-07-01',
  TIMESTAMPTZ '2026-07-28T18:31:00Z',
  'JSON_POINTER',
  '/synthetic/records/0',
  'audit_artifact0001'
);

SELECT tai_knowledge.record_artifact(
  'artifact_cccccccccccc',
  'srcver_bbbbbbbbbbbb',
  repeat('a', 64),
  'application/json',
  1024,
  'artifact-ref:synthetic/ap14f1a/a',
  'https://official.example.test/manual',
  'official.example.test',
  DATE '2026-07-01',
  DATE '2026-07-01',
  TIMESTAMPTZ '2026-07-28T18:31:00Z',
  'JSON_POINTER',
  '/synthetic/records/0',
  'audit_artifact0001'
);

RESET ROLE;

DO $negative_database_constraints$
BEGIN
  BEGIN
    UPDATE tai_public_source_admissions
    SET data_plane = 'TENANT_LIVE'
    WHERE id = 'src_aaaaaaaaaaaa';
    RAISE EXCEPTION 'forbidden data plane mutation was accepted';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;

  BEGIN
    UPDATE tai_public_source_artifacts
    SET shared_index_eligible = true
    WHERE id = 'artifact_cccccccccccc';
    RAISE EXCEPTION 'raw shared-index enablement was accepted';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;

  BEGIN
    PERFORM tai_knowledge.register_source(
      'src_zzzzzzzzzzzz',
      'synthetic.official.manual',
      'OFFICIAL_MANUAL',
      'https://official.example.test/manual',
      'official.example.test',
      'AP14F0-SYNTHETIC_MANUAL',
      'ALLOWED_SHARED_RAG',
      DATE '2026-07-28',
      DATE '2099-12-31',
      'audit_conflict0001'
    );
    RAISE EXCEPTION 'conflicting source registration was accepted';
  EXCEPTION WHEN unique_violation THEN
    NULL;
  END;

  BEGIN
    PERFORM tai_knowledge.record_artifact(
      'artifact_zzzzzzzzzzzz',
      'srcver_bbbbbbbbbbbb',
      repeat('A', 64),
      'application/json',
      1024,
      'artifact-ref:synthetic/ap14f1a/invalid-digest',
      'https://official.example.test/manual',
      'official.example.test',
      DATE '2026-07-01',
      DATE '2026-07-01',
      TIMESTAMPTZ '2026-07-28T18:32:00Z',
      'JSON_POINTER',
      '/synthetic/invalid',
      'audit_invalid00001'
    );
    RAISE EXCEPTION 'uppercase digest was accepted';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;
END
$negative_database_constraints$;

SET ROLE tai_knowledge_ingestor;

SELECT tai_knowledge.decide_artifact(
  'quarantine_dddddddddddd',
  'artifact_cccccccccccc',
  'ADMIT',
  'PROVENANCE_INCOMPLETE',
  'Human review confirmed the replacement provenance and all safety checks.',
  false,
  true,
  true,
  true,
  true,
  true,
  repeat('d', 64),
  'evidence-ref:synthetic/ap14f1a/release-1',
  'prov_1111111111111111',
  'audit_release000001'
);

SELECT tai_knowledge.create_snapshot(
  'snapshot_eeeeeeeeeeee',
  'synthetic.snapshot.v1',
  'audit_snapshot00001'
);

SELECT tai_knowledge.add_snapshot_member(
  'snapshot_eeeeeeeeeeee',
  'artifact_cccccccccccc',
  'audit_member000001'
);

SELECT tai_knowledge.add_snapshot_member(
  'snapshot_eeeeeeeeeeee',
  'artifact_cccccccccccc',
  'audit_member000001'
);

SELECT tai_knowledge.seal_snapshot(
  'snapshot_eeeeeeeeeeee',
  repeat('b', 64),
  'audit_seal00000001'
);

RESET ROLE;

DO $assert_initial_retrieval$
DECLARE
  v_count integer;
BEGIN
  SELECT count(*)::integer INTO v_count
  FROM tai_public_corpus_retrieval_entries
  WHERE snapshot_id = 'snapshot_eeeeeeeeeeee'
    AND artifact_id = 'artifact_cccccccccccc';
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'expected one retrieval entry after seal, got %', v_count;
  END IF;
END
$assert_initial_retrieval$;

SET ROLE tai_knowledge_ingestor;

SELECT tai_knowledge.decide_artifact(
  'quarantine_hhhhhhhhhhhh',
  'artifact_cccccccccccc',
  'QUARANTINE',
  'PROMPT_INJECTION_OR_UNTRUSTED_INSTRUCTIONS',
  'Synthetic prompt-injection probe requires fail-closed quarantine.',
  true,
  true,
  true,
  true,
  false,
  true,
  repeat('e', 64),
  'evidence-ref:synthetic/ap14f1a/quarantine-1',
  NULL,
  'audit_quarantine001'
);

RESET ROLE;

DO $assert_quarantine_revokes$
BEGIN
  IF EXISTS (
    SELECT 1 FROM tai_public_corpus_retrieval_entries
    WHERE artifact_id = 'artifact_cccccccccccc'
  ) THEN
    RAISE EXCEPTION 'quarantined artifact remained retrievable';
  END IF;
END
$assert_quarantine_revokes$;

SET ROLE tai_knowledge_ingestor;

SELECT tai_knowledge.decide_artifact(
  'quarantine_iiiiiiiiiiii',
  'artifact_cccccccccccc',
  'ADMIT',
  'PROMPT_INJECTION_OR_UNTRUSTED_INSTRUCTIONS',
  'Human review removed untrusted instructions and confirmed all checks.',
  false,
  true,
  true,
  true,
  true,
  true,
  repeat('f', 64),
  'evidence-ref:synthetic/ap14f1a/release-2',
  'prov_2222222222222222',
  'audit_release000002'
);

SELECT tai_knowledge.record_withdrawal(
  'withdrawal_ffffffffffff',
  'srcver_bbbbbbbbbbbb',
  'WITHDRAW',
  'Synthetic rights withdrawal proves atomic retrieval revocation without deletion.',
  true,
  repeat('1', 64),
  'audit_withdraw0001'
);

RESET ROLE;

DO $assert_withdrawal_revokes$
BEGIN
  IF EXISTS (
    SELECT 1 FROM tai_public_corpus_retrieval_entries
    WHERE source_version_id = 'srcver_bbbbbbbbbbbb'
  ) THEN
    RAISE EXCEPTION 'withdrawn source version remained retrievable';
  END IF;
END
$assert_withdrawal_revokes$;

SET ROLE tai_knowledge_ingestor;

SELECT tai_knowledge.record_withdrawal(
  'withdrawal_gggggggggggg',
  'srcver_bbbbbbbbbbbb',
  'RESTORE',
  'Synthetic restoration proves reversible withdrawal with current rights evidence.',
  true,
  repeat('2', 64),
  'audit_restore000001'
);

RESET ROLE;

DO $assert_restore_returns$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM tai_public_corpus_retrieval_entries
    WHERE source_version_id = 'srcver_bbbbbbbbbbbb'
      AND artifact_id = 'artifact_cccccccccccc'
  ) THEN
    RAISE EXCEPTION 'restored source version did not return to retrieval';
  END IF;
END
$assert_restore_returns$;

DO $negative_evidence_mutation$
BEGIN
  BEGIN
    DELETE FROM tai_public_source_artifacts WHERE id = 'artifact_cccccccccccc';
    RAISE EXCEPTION 'hard delete was accepted';
  EXCEPTION WHEN object_not_in_prerequisite_state THEN
    NULL;
  END;

  BEGIN
    UPDATE tai_public_corpus_quarantine_events
    SET details = 'tampered append-only evidence'
    WHERE id = 'quarantine_dddddddddddd';
    RAISE EXCEPTION 'append-only quarantine mutation was accepted';
  EXCEPTION WHEN object_not_in_prerequisite_state THEN
    NULL;
  END;

  BEGIN
    UPDATE tai_public_source_withdrawals
    SET reason = 'tampered append-only withdrawal evidence'
    WHERE id = 'withdrawal_ffffffffffff';
    RAISE EXCEPTION 'append-only withdrawal mutation was accepted';
  EXCEPTION WHEN object_not_in_prerequisite_state THEN
    NULL;
  END;
END
$negative_evidence_mutation$;

SET ROLE tai_knowledge_ingestor;
SELECT tai_knowledge.withdraw_snapshot(
  'snapshot_eeeeeeeeeeee',
  'Synthetic snapshot withdrawal proves the sealed corpus can be revoked atomically.',
  true,
  'audit_snapshotwd001'
);
RESET ROLE;

DO $assert_snapshot_withdrawal$
BEGIN
  IF EXISTS (
    SELECT 1 FROM tai_public_corpus_retrieval_entries
    WHERE snapshot_id = 'snapshot_eeeeeeeeeeee'
  ) THEN
    RAISE EXCEPTION 'withdrawn snapshot remained retrievable';
  END IF;
END
$assert_snapshot_withdrawal$;

SELECT json_build_object(
  'status', 'PASS',
  'slice', 'TAI-AP-14F1A',
  'postgresqlMajor', current_setting('server_version_num')::integer / 10000,
  'authorityTables', 7,
  'sources', (SELECT count(*) FROM tai_public_source_admissions),
  'sourceVersions', (SELECT count(*) FROM tai_public_source_versions),
  'artifacts', (SELECT count(*) FROM tai_public_source_artifacts),
  'quarantineEvents', (SELECT count(*) FROM tai_public_corpus_quarantine_events),
  'withdrawalEvents', (SELECT count(*) FROM tai_public_source_withdrawals),
  'snapshots', (SELECT count(*) FROM tai_public_corpus_snapshots),
  'snapshotMembers', (SELECT count(*) FROM tai_public_corpus_snapshot_members),
  'retrievalEntriesAfterWithdrawal', (SELECT count(*) FROM tai_public_corpus_retrieval_entries),
  'operationalStatus', 'NOT_ATTESTED',
  'productionHosting', 'REG_RU_VPS_ONLY'
) AS acceptance;
