import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import { PrismaClient } from '@prisma/client';

const databaseUrl = String(process.env.DATABASE_URL || '').trim();
if (!databaseUrl) throw new Error('DATABASE_URL_REQUIRED');

const REQUEST_COUNT = 1_000;
const LOOKUP_P95_LIMIT_MS = 300;
const LOOKUP_DISTRACTOR_ROWS = 20_000;
const IMPORT_RECORDS = 50_001;
const IMPORT_BATCH_SIZE = 1_000;
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const artifactDir = resolve(repoRoot, 'artifacts/role-eligibility');
mkdirSync(artifactDir, { recursive: true });

const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
const reader = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
const syntheticInn = '7712345678';

function percentile(values, ratio) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(sorted.length * ratio) - 1)] ?? 0;
}

async function runtime(client, task) {
  return client.$transaction(async (tx) => {
    await tx.$executeRawUnsafe('SET LOCAL ROLE pc_role_eligibility_runtime');
    return task(tx);
  }, { maxWait: 10_000, timeout: 20_000 });
}

async function seedWarmRegistry() {
  await prisma.$executeRawUnsafe(`
    INSERT INTO eligibility.registry_generations(
      id,source,generation,published_at,downloaded_at,content_sha256,record_count,
      parser_version,schema_version,status,fresh_until,created_at,validated_at,activated_at
    ) VALUES (
      'load_fns_active','FNS','load-fns-active',clock_timestamp(),clock_timestamp(),repeat('a',64),
      ${LOOKUP_DISTRACTOR_ROWS + 1},'load-fns-v1','load-schema-v1','ACTIVE',clock_timestamp()+interval '30 days',
      clock_timestamp(),clock_timestamp(),clock_timestamp()
    )
  `);
  await prisma.$executeRawUnsafe(`
    INSERT INTO eligibility.registry_records(
      id,generation_id,source,source_record_id,subject_inn,record_type,normalized_payload,
      source_published_at,payload_sha256,created_at
    ) VALUES (
      'load_fns_target','load_fns_active','FNS','load-target',$1,'LEGAL_ENTITY_IDENTITY_AND_ACTIVITY',
      '{"active":true,"primaryOkved":"01.11"}'::jsonb,clock_timestamp(),repeat('b',64),clock_timestamp()
    )
  `, syntheticInn);
  await prisma.$executeRawUnsafe(`
    INSERT INTO eligibility.registry_records(
      id,generation_id,source,source_record_id,subject_inn,record_type,normalized_payload,
      source_published_at,payload_sha256,created_at
    )
    SELECT
      'load_fns_'||g,'load_fns_active','FNS','load-'||g,'88'||lpad(g::text,8,'0'),
      'LEGAL_ENTITY_IDENTITY_AND_ACTIVITY','{"active":true}'::jsonb,clock_timestamp(),md5(g::text)||md5((g+1)::text),clock_timestamp()
    FROM generate_series(1,${LOOKUP_DISTRACTOR_ROWS}) AS g
  `);
}

async function localLookup(client = prisma) {
  return runtime(client, async (tx) => {
    const rows = await tx.$queryRawUnsafe(`
      SELECT r.source_record_id,r.payload_sha256,g.generation
      FROM eligibility.registry_records r
      JOIN eligibility.registry_generations g ON g.id=r.generation_id
      WHERE g.source='FNS' AND g.status='ACTIVE' AND r.subject_inn=$1
      ORDER BY r.source_record_id
    `, syntheticInn);
    if (rows.length !== 1 || rows[0].generation !== 'load-fns-active') {
      throw new Error('WARM_LOCAL_LOOKUP_AUTHORITY_INVALID');
    }
    return rows[0];
  });
}

async function runOnlineLoad() {
  await seedWarmRegistry();
  for (let i = 0; i < 25; i += 1) await localLookup();

  const latencies = await Promise.all(Array.from({ length: REQUEST_COUNT }, async () => {
    const started = performance.now();
    await localLookup();
    return performance.now() - started;
  }));

  const p50Ms = percentile(latencies, 0.50);
  const p95Ms = percentile(latencies, 0.95);
  const p99Ms = percentile(latencies, 0.99);

  await prisma.$executeRawUnsafe(`
    INSERT INTO eligibility.organization_checks(
      id,application_id,application_version,application_status_at_start,organization_id,tenant_id,inn,
      requested_workspace,requested_role,status,policy_version,policy_hash,request_key,correlation_id
    ) VALUES (
      'load_concurrent_check','load_concurrent_app',1,'ORGANIZATION_VERIFICATION_PENDING','load_org','load_tenant',$1,
      'buyer','BUYER','CHECKING','load-policy',repeat('c',64),repeat('d',64),'load-correlation'
    )
  `, syntheticInn);

  const sharedIdempotency = 'e'.repeat(64);
  const manifestHash = 'f'.repeat(64);
  const publishErrors = [];
  await Promise.all(Array.from({ length: 100 }, async (_, index) => {
    try {
      await runtime(prisma, (tx) => tx.$queryRawUnsafe(`
        SELECT eligibility.publish_verdict(
          $1,$2,$3,$4,'load_concurrent_check','REVIEW_REQUIRED','["LOAD_CONCURRENT_REPLAY"]'::jsonb,
          $5,$6,'[]'::jsonb,'load-correlation'
        ) AS verdict_id
      `,
      `load_verdict_${index}`,
      `load_history_${index}`,
      `load_audit_${index}`,
      `load_outbox_${index}`,
      manifestHash,
      sharedIdempotency));
    } catch (error) {
      publishErrors.push(error instanceof Error ? error.message : String(error));
    }
  }));

  const cardinality = await prisma.$queryRawUnsafe(`
    SELECT
      (SELECT count(*)::int FROM eligibility.verdicts WHERE check_id='load_concurrent_check') AS verdicts,
      (SELECT count(*)::int FROM eligibility.verdict_history WHERE check_id='load_concurrent_check') AS history,
      (SELECT count(*)::int FROM eligibility.audit_events WHERE check_id='load_concurrent_check' AND verdict_id IS NOT NULL) AS audit,
      (SELECT count(*)::int FROM eligibility.outbox WHERE idempotency_key='eligibility:verdict:'||$1) AS outbox
  `, sharedIdempotency);
  const counts = cardinality[0];
  const noDuplicates = counts?.verdicts === 1 && counts?.history === 1 && counts?.audit === 1 && counts?.outbox === 1;
  const passed = p95Ms < LOOKUP_P95_LIMIT_MS && publishErrors.length === 0 && noDuplicates;
  const artifact = {
    passed,
    requestCount: REQUEST_COUNT,
    concurrencyModel: '1000 simultaneous warm PostgreSQL local-registry lookups',
    p50Ms: Number(p50Ms.toFixed(3)),
    p95Ms: Number(p95Ms.toFixed(3)),
    p99Ms: Number(p99Ms.toFixed(3)),
    p95LimitMs: LOOKUP_P95_LIMIT_MS,
    externalHttpCalls: 0,
    concurrentIdempotentPublishAttempts: 100,
    duplicateVerdicts: Number(counts?.verdicts ?? -1) - 1,
    duplicateHistory: Number(counts?.history ?? -1) - 1,
    duplicateAudit: Number(counts?.audit ?? -1) - 1,
    duplicateOutbox: Number(counts?.outbox ?? -1) - 1,
    publishErrors: publishErrors.length,
  };
  writeFileSync(resolve(artifactDir, 'load.json'), `${JSON.stringify(artifact, null, 2)}\n`);
  if (!passed) throw new Error(`ROLE_ELIGIBILITY_LOAD_ACCEPTANCE_FAILED:${JSON.stringify(artifact)}`);
  return artifact;
}

async function seedOldElevatorGeneration() {
  await prisma.$executeRawUnsafe(`
    INSERT INTO eligibility.registry_generations(
      id,source,generation,published_at,downloaded_at,content_sha256,record_count,
      parser_version,schema_version,status,fresh_until,created_at,validated_at,activated_at
    ) VALUES (
      'load_fgis_old','FGIS_GRAIN','load-fgis-old',clock_timestamp(),clock_timestamp(),repeat('1',64),1,
      'load-fgis-v1','load-schema-v1','ACTIVE',clock_timestamp()+interval '30 days',clock_timestamp(),clock_timestamp(),clock_timestamp()
    )
  `);
  await prisma.$executeRawUnsafe(`
    INSERT INTO eligibility.registry_records(
      id,generation_id,source,source_record_id,subject_inn,record_type,normalized_payload,
      source_published_at,payload_sha256,created_at
    ) VALUES (
      'load_fgis_old_target','load_fgis_old','FGIS_GRAIN','old-target',$1,'GRAIN_ELEVATOR_REGISTRY_STATUS',
      '{"active":true,"elevatorRecord":true,"registryStatus":"OLD"}'::jsonb,clock_timestamp(),repeat('2',64),clock_timestamp()
    )
  `, syntheticInn);
}

async function readActiveElevator() {
  return runtime(reader, async (tx) => {
    const rows = await tx.$queryRawUnsafe(`
      SELECT g.generation,r.normalized_payload->>'registryStatus' AS marker
      FROM eligibility.registry_records r
      JOIN eligibility.registry_generations g ON g.id=r.generation_id
      WHERE g.source='FGIS_GRAIN' AND g.status='ACTIVE' AND r.subject_inn=$1
    `, syntheticInn);
    if (rows.length !== 1) throw new Error(`REGISTRY_ACTIVE_CARDINALITY_${rows.length}`);
    return { generation: rows[0].generation, marker: rows[0].marker };
  });
}

async function stageAndSwitchLargeGeneration() {
  const started = performance.now();
  await runtime(prisma, (tx) => tx.$executeRawUnsafe(`
    INSERT INTO eligibility.registry_generations(
      id,source,generation,published_at,downloaded_at,content_sha256,record_count,
      parser_version,schema_version,status,fresh_until,created_at
    ) VALUES (
      'load_fgis_new','FGIS_GRAIN','load-fgis-new',clock_timestamp(),clock_timestamp(),repeat('3',64),$1,
      'load-fgis-v2','load-schema-v2','STAGING',clock_timestamp()+interval '30 days',clock_timestamp()
    )
  `, IMPORT_RECORDS));
  await runtime(prisma, (tx) => tx.$executeRawUnsafe(`
    INSERT INTO eligibility.registry_records(
      id,generation_id,source,source_record_id,subject_inn,record_type,normalized_payload,
      source_published_at,payload_sha256,created_at
    ) VALUES (
      'load_fgis_new_target','load_fgis_new','FGIS_GRAIN','new-target',$1,'GRAIN_ELEVATOR_REGISTRY_STATUS',
      '{"active":true,"elevatorRecord":true,"registryStatus":"NEW"}'::jsonb,clock_timestamp(),repeat('4',64),clock_timestamp()
    )
  `, syntheticInn));

  for (let start = 1; start < IMPORT_RECORDS; start += IMPORT_BATCH_SIZE) {
    const end = Math.min(IMPORT_RECORDS - 1, start + IMPORT_BATCH_SIZE - 1);
    await runtime(prisma, (tx) => tx.$executeRawUnsafe(`
      INSERT INTO eligibility.registry_records(
        id,generation_id,source,source_record_id,subject_inn,record_type,normalized_payload,
        source_published_at,payload_sha256,created_at
      )
      SELECT
        'load_fgis_new_'||g,'load_fgis_new','FGIS_GRAIN','new-'||g,'99'||lpad(g::text,8,'0'),
        'GRAIN_ELEVATOR_REGISTRY_STATUS','{"active":true,"elevatorRecord":true,"registryStatus":"NEW"}'::jsonb,
        clock_timestamp(),md5(g::text)||md5((g+7)::text),clock_timestamp()
      FROM generate_series($1::int,$2::int) AS g
    `, start, end));
  }

  const counts = await runtime(prisma, (tx) => tx.$queryRawUnsafe(`
    SELECT count(*)::int AS count FROM eligibility.registry_records WHERE generation_id='load_fgis_new'
  `));
  if (counts[0]?.count !== IMPORT_RECORDS) throw new Error(`REGISTRY_IMPORT_CARDINALITY_${counts[0]?.count}`);

  await runtime(prisma, async (tx) => {
    await tx.$executeRawUnsafe(`
      UPDATE eligibility.registry_generations
      SET status='VALIDATED',validated_at=clock_timestamp()
      WHERE id='load_fgis_new' AND status='STAGING'
    `);
    await tx.$queryRawUnsafe(`SELECT eligibility.activate_registry_generation('FGIS_GRAIN','load-fgis-new')`);
  });
  return performance.now() - started;
}

async function runRegistryImportLoad() {
  await seedOldElevatorGeneration();
  const before = await Promise.all(Array.from({ length: 20 }, () => readActiveElevator()));
  if (before.some((row) => row.generation !== 'load-fgis-old' || row.marker !== 'OLD')) {
    throw new Error('PRE_SWITCH_OLD_GENERATION_NOT_AUTHORITATIVE');
  }

  const observations = [];
  let readerError = null;
  let stop = false;
  const readerLoop = (async () => {
    while (!stop) {
      try {
        observations.push(await readActiveElevator());
      } catch (error) {
        readerError = error instanceof Error ? error.message : String(error);
        break;
      }
      await new Promise((resolveNow) => setImmediate(resolveNow));
    }
  })();

  const importDurationMs = await stageAndSwitchLargeGeneration();
  const after = await Promise.all(Array.from({ length: 50 }, () => readActiveElevator()));
  stop = true;
  await readerLoop;

  const state = await runtime(prisma, (tx) => tx.$queryRawUnsafe(`
    SELECT generation,status FROM eligibility.registry_generations
    WHERE source='FGIS_GRAIN' ORDER BY generation
  `));
  const activeCount = state.filter((row) => row.status === 'ACTIVE').length;
  const stagingObserved = observations.some((row) => !['load-fgis-old', 'load-fgis-new'].includes(row.generation));
  const invalidMarker = observations.some((row) => (
    row.generation === 'load-fgis-old' ? row.marker !== 'OLD' :
    row.generation === 'load-fgis-new' ? row.marker !== 'NEW' : true
  ));
  const afterOnlyNew = after.every((row) => row.generation === 'load-fgis-new' && row.marker === 'NEW');
  const oldRetained = state.some((row) => row.generation === 'load-fgis-old' && row.status === 'VALIDATED');
  const newActive = state.some((row) => row.generation === 'load-fgis-new' && row.status === 'ACTIVE');
  const passed = !readerError && !stagingObserved && !invalidMarker && afterOnlyNew && oldRetained && newActive && activeCount === 1;
  const artifact = {
    passed,
    fixtureKind: 'production-shaped large registry import fixture; not production evidence',
    importedRecords: IMPORT_RECORDS,
    batchSize: IMPORT_BATCH_SIZE,
    concurrentReadObservations: observations.length,
    importDurationMs: Number(importDurationMs.toFixed(3)),
    halfImportedGenerationObserved: stagingObserved,
    invalidMarkerObserved: invalidMarker,
    readerErrors: readerError ? 1 : 0,
    previousGenerationReadableUntilSwitch: true,
    previousGenerationRetainedAfterSwitch: oldRetained,
    exactlyOneActiveGeneration: activeCount === 1,
    postSwitchReadsUseOnlyNewGeneration: afterOnlyNew,
  };
  writeFileSync(resolve(artifactDir, 'registry-import-load.json'), `${JSON.stringify(artifact, null, 2)}\n`);
  if (!passed) throw new Error(`ROLE_ELIGIBILITY_REGISTRY_IMPORT_LOAD_FAILED:${JSON.stringify(artifact)}`);
  return artifact;
}

let online;
let registryImport;
try {
  online = await runOnlineLoad();
  registryImport = await runRegistryImportLoad();
  console.log('LOAD_ACCEPTANCE=PASS');
  console.log(`LOAD_ACCEPTANCE_P95_MS=${online.p95Ms}`);
  console.log('REGISTRY_IMPORT_LOAD_ACCEPTANCE=PASS');
  console.log(`REGISTRY_IMPORT_RECORDS=${registryImport.importedRecords}`);
} finally {
  await Promise.allSettled([prisma.$disconnect(), reader.$disconnect()]);
}
