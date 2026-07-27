import { readFileSync, rmSync, writeFileSync } from 'node:fs';

function read(file) {
  return readFileSync(file, 'utf8');
}

function write(file, content) {
  writeFileSync(file, content, 'utf8');
}

function replaceExact(content, needle, replacement, expected, label) {
  const count = content.split(needle).length - 1;
  if (count !== expected) {
    throw new Error(`${label}: expected ${expected} occurrences, found ${count}`);
  }
  return content.replaceAll(needle, replacement);
}

const migrationPath =
  'apps/api/prisma/migrations/20260727195000_fgis_grain_exchange_correlation_replay/migration.sql';
let migration = read(migrationPath);
migration = replaceExact(
  migration,
  `  v_replay_outbox_id text;\n  v_replay_audit_id text;\nBEGIN\n`,
  `  v_replay_outbox_id text;\n  v_replay_audit_id text;\n  v_replay_correlation_id text;\n  v_replay_idempotency_key text;\n  v_replay_reason text;\nBEGIN\n`,
  1,
  'declare immutable replay evidence fields',
);
migration = replaceExact(
  migration,
  `      SELECT o."id", o."auditId"\n      INTO v_replay_outbox_id, v_replay_audit_id\n      FROM public."outbox_entries" o\n      WHERE o."id" = v_inbox."outboxEntryId";\n      IF v_replay_outbox_id IS NULL OR v_replay_audit_id IS NULL THEN\n`,
  `      SELECT o."id", o."auditId", o."correlationId", o."idempotencyKey", a."reason"\n      INTO v_replay_outbox_id, v_replay_audit_id, v_replay_correlation_id,\n           v_replay_idempotency_key, v_replay_reason\n      FROM public."outbox_entries" o\n      JOIN public."audit_events" a ON a."id" = o."auditId"\n      WHERE o."id" = v_inbox."outboxEntryId";\n      IF v_replay_outbox_id IS NULL\n         OR v_replay_audit_id IS NULL\n         OR v_replay_correlation_id IS DISTINCT FROM p_correlation_id\n         OR v_replay_idempotency_key IS DISTINCT FROM p_idempotency_key\n         OR v_replay_reason IS DISTINCT FROM p_reason\n      THEN\n`,
  1,
  'bind replay to stored audit and outbox provenance',
);
migration = replaceExact(
  migration,
  `        'correlationId', p_correlation_id,\n        'reasonCode', NULL,\n`,
  `        'correlationId', v_replay_correlation_id,\n        'reasonCode', NULL,\n`,
  1,
  'return stored replay correlation identity',
);
write(migrationPath, migration);

const repositoryPath =
  'apps/api/src/modules/regulatory-integration/fgis-grain/fgis-grain-exchange-correlation.repository.ts';
let repository = read(repositoryPath);
repository = replaceExact(
  repository,
  `  if (message.includes('NOT_FOUND')) {\n    return new FgisGrainExchangeAuthorityError(\n      'EXCHANGE_AUTHORITY_MISSING',\n      'verified inbox authority is not accessible',\n      false,\n    );\n  }\n  return new FgisGrainExchangeAuthorityError(\n`,
  `  if (message.includes('NOT_FOUND')) {\n    return new FgisGrainExchangeAuthorityError(\n      'EXCHANGE_AUTHORITY_MISSING',\n      'verified inbox authority is not accessible',\n      false,\n    );\n  }\n  if (\n    message.includes('FGIS_EXCHANGE_REPLAY_MISMATCH')\n    || message.includes('FGIS_EXCHANGE_REPLAY_EVIDENCE_INVALID')\n  ) {\n    return new FgisGrainExchangeAuthorityError(\n      'EXCHANGE_AUTHORITY_MISMATCH',\n      'processed response replay does not match immutable audit and outbox evidence',\n      false,\n    );\n  }\n  return new FgisGrainExchangeAuthorityError(\n`,
  1,
  'map replay provenance mismatch fail-closed',
);
write(repositoryPath, repository);

const e2ePath = 'apps/api/test/industrial/fgis-grain-exchange.e2e-spec.ts';
let e2e = read(e2ePath);
e2e = replaceExact(
  e2e,
  `    const replay = await correlations.correlateVerifiedResponse(USER_A, command);\n    expect(replay).toEqual({ ...correlated, kind: 'REPLAY' });\n\n    const evidence = await prisma.$queryRaw<Array<{\n`,
  `    const replay = await correlations.correlateVerifiedResponse(USER_A, command);\n    expect(replay).toEqual({ ...correlated, kind: 'REPLAY' });\n\n    const divergentReplayCommands: FgisGrainResponseCorrelationCommand[] = [\n      {\n        ...command,\n        correlationId: \\`${RUN_ID}.response-correlation.divergent\\`,\n      },\n      {\n        ...command,\n        idempotencyKey: \\`${RUN_ID}.response.divergent\\`,\n      },\n      {\n        ...command,\n        reason: 'Изменённое основание не может переиспользовать ранее принятое доказательство',\n      },\n    ];\n    for (const divergent of divergentReplayCommands) {\n      await expect(correlations.correlateVerifiedResponse(USER_A, divergent))\n        .rejects.toMatchObject({\n          name: 'FgisGrainExchangeAuthorityError',\n          code: 'EXCHANGE_AUTHORITY_MISMATCH',\n          retryable: false,\n        });\n    }\n\n    const evidence = await prisma.$queryRaw<Array<{\n`,
  1,
  'add negative replay-provenance acceptance',
);
write(e2ePath, e2e);

rmSync('scripts/pc-crop-08h-replay-fix', { recursive: true, force: true });
rmSync('.github/workflows/pc-crop-08h-replay-fix-materialize.yml', { force: true });
