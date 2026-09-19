from pathlib import Path


def replace_once(path: str, old: str, new: str, label: str) -> None:
    target = Path(path)
    source = target.read_text(encoding='utf-8')
    count = source.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected one marker, found {count}')
    target.write_text(source.replace(old, new), encoding='utf-8')


def insert_before_once(path: str, marker: str, addition: str, label: str) -> None:
    replace_once(path, marker, addition + marker, label)


repository = 'apps/api/src/modules/regulatory-integration/fgis-grain/fgis-grain-sdiz-projection.repository.ts'
repository_source = Path(repository).read_text(encoding='utf-8')

if 'const MUTATION_ROLES = new Set<string>' not in repository_source:
    replace_once(
        repository,
        "const READ_ROLES = new Set<string>([Role.ADMIN, Role.COMPLIANCE_OFFICER, Role.EXECUTIVE]);\n",
        "const MUTATION_ROLES = new Set<string>([Role.ADMIN, Role.COMPLIANCE_OFFICER]);\n"
        "const READ_ROLES = new Set<string>([Role.ADMIN, Role.COMPLIANCE_OFFICER, Role.EXECUTIVE]);\n",
        'projection mutation role authority',
    )

if "| 'MUTATION_FORBIDDEN'" not in Path(repository).read_text(encoding='utf-8'):
    replace_once(
        repository,
        "  | 'REPLAY_EVIDENCE_INVALID'\n  | 'READ_FORBIDDEN';\n",
        "  | 'REPLAY_EVIDENCE_INVALID'\n  | 'MUTATION_FORBIDDEN'\n  | 'READ_FORBIDDEN';\n",
        'projection mutation error code',
    )

if 'assertMutationAuthority(user);' not in Path(repository).read_text(encoding='utf-8'):
    replace_once(
        repository,
        "  ): Promise<FgisGrainSdizProjectionMutation> {\n    const command = normalizeFgisGrainSdizProjectionCommand(input);\n",
        "  ): Promise<FgisGrainSdizProjectionMutation> {\n    assertMutationAuthority(user);\n"
        "    const command = normalizeFgisGrainSdizProjectionCommand(input);\n",
        'projection mutation authority call',
    )

if 'function assertMutationAuthority(' not in Path(repository).read_text(encoding='utf-8'):
    replace_once(
        repository,
        "function assertReadAuthority(user: RequestUser | undefined): void {\n",
        "function assertMutationAuthority(user: RequestUser | undefined): void {\n"
        "  if (!user || !MUTATION_ROLES.has(user.role)) {\n"
        "    throw new FgisGrainSdizProjectionRepositoryError(\n"
        "      'MUTATION_FORBIDDEN',\n"
        "      'SDIZ projection mutation requires operator or compliance authority',\n"
        "    );\n"
        "  }\n"
        "}\n\n"
        "function assertReadAuthority(user: RequestUser | undefined): void {\n",
        'projection mutation authority implementation',
    )

if 'projectionIdentityLockKeys(' not in Path(repository).read_text(encoding='utf-8'):
    replace_once(
        repository,
        '''        await tx.$queryRaw<Array<{ locked: boolean }>>(Prisma.sql`
          WITH acquired AS MATERIALIZED (
            SELECT pg_advisory_xact_lock(hashtextextended(${canonicalKey}, 0))
          )
          SELECT true AS "locked" FROM acquired
        `);

        const replay = await tx.$queryRaw<ReplayOutboxRow[]>(Prisma.sql`
''',
        '''        await tx.$queryRaw<Array<{ locked: boolean }>>(Prisma.sql`
          WITH acquired AS MATERIALIZED (
            SELECT pg_advisory_xact_lock(hashtextextended(${canonicalKey}, 0))
          )
          SELECT true AS "locked" FROM acquired
        `);
        const identityLockKeys = projectionIdentityLockKeys(
          context.tenantId,
          context.orgId,
          command,
        );
        await tx.$queryRaw<Array<{ lock: null }>>(Prisma.sql`
          SELECT public.lock_fgis_grain_sdiz_projection_keys(
            ARRAY[${Prisma.join(identityLockKeys)}]::text[]
          ) AS "lock"
        `);

        const replay = await tx.$queryRaw<ReplayOutboxRow[]>(Prisma.sql`
''',
        'projection identity advisory lock call',
    )

repository_source = Path(repository).read_text(encoding='utf-8')
replay_query = '''          FROM public."outbox_entries"
          WHERE "idempotencyKey" = ${canonicalKey}
          FOR UPDATE
        `);
'''
if replay_query in repository_source:
    replace_once(
        repository,
        replay_query,
        '''          FROM public."outbox_entries"
          WHERE "idempotencyKey" = ${canonicalKey}
        `);
''',
        'outbox replay read without update authority',
    )

if 'isProjectionIdentityUniquenessRace(error)' not in Path(repository).read_text(encoding='utf-8'):
    replace_once(
        repository,
        '''        for (const record of command.records) {
          await upsertProjection(
            tx,
            context.tenantId,
            context.orgId,
            projectionBatchId,
            inbox.id,
            command,
            record,
          );
        }
        const applied = await tx.$queryRaw<IdRow[]>(Prisma.sql`
''',
        '''        try {
          for (const record of command.records) {
            await upsertProjection(
              tx,
              context.tenantId,
              context.orgId,
              projectionBatchId,
              inbox.id,
              command,
              record,
            );
          }
        } catch (error) {
          if (isProjectionIdentityUniquenessRace(error)) {
            const retryable = new Error(
              'SDIZ identity ownership changed while applying the serializable batch',
            ) as Error & { code: string };
            retryable.code = '40001';
            throw retryable;
          }
          throw error;
        }
        const applied = await tx.$queryRaw<IdRow[]>(Prisma.sql`
''',
        'projection uniqueness race retry',
    )

old_audit_lock = '''async function lockPreviousAuditHash(tx: Prisma.TransactionClient): Promise<string> {
  const rows = await tx.$queryRaw<AuditHashRow[]>(Prisma.sql`
    SELECT "hash" FROM public."audit_events"
    ORDER BY "createdAt" DESC, "id" DESC
    LIMIT 1
    FOR UPDATE
  `);
  return rows[0]?.hash ?? '';
}
'''
if old_audit_lock in Path(repository).read_text(encoding='utf-8'):
    replace_once(
        repository,
        old_audit_lock,
        '''async function lockPreviousAuditHash(tx: Prisma.TransactionClient): Promise<string> {
  await tx.$queryRaw<Array<{ locked: boolean }>>(Prisma.sql`
    WITH acquired AS MATERIALIZED (
      SELECT pg_advisory_xact_lock(
        hashtextextended('pc-crop-08f:global-audit-chain', 0)
      )
    )
    SELECT true AS "locked" FROM acquired
  `);
  const rows = await tx.$queryRaw<AuditHashRow[]>(Prisma.sql`
    SELECT "hash" FROM public."audit_events"
    ORDER BY "createdAt" DESC, "id" DESC
    LIMIT 1
  `);
  return rows[0]?.hash ?? '';
}
''',
        'runtime-safe immutable audit chain lock',
    )

if 'function projectionIdentityLockKeys(' not in Path(repository).read_text(encoding='utf-8'):
    insert_before_once(
        repository,
        'function canonicalIdempotencyKey(\n',
        '''function compareCodeUnits(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function projectionIdentityLockKeys(
  tenantId: string,
  organizationId: string,
  command: CanonicalFgisGrainSdizProjectionCommand,
): string[] {
  return [...new Set(command.records.flatMap((record) => [
    `pc-crop-08f:${tenantId}:${organizationId}:sdiz-id:${record.sdizId}`,
    `pc-crop-08f:${tenantId}:${organizationId}:sdiz-number:${record.sdizNumber}`,
  ]))].sort(compareCodeUnits);
}

''',
        'projection identity lock key helper',
    )

if 'function isProjectionIdentityUniquenessRace(' not in Path(repository).read_text(encoding='utf-8'):
    insert_before_once(
        repository,
        'function computeAuditHash(value: Record<string, unknown>): string {\n',
        '''function isProjectionIdentityUniquenessRace(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as { code?: unknown; message?: unknown; meta?: unknown };
  const meta = candidate.meta && typeof candidate.meta === 'object'
    ? Object.values(candidate.meta as Record<string, unknown>).join(' ')
    : String(candidate.meta ?? '');
  const text = `${String(candidate.code ?? '')} ${String(candidate.message ?? '')} ${meta}`;
  const isUniqueViolation = candidate.code === 'P2002'
    || candidate.code === 'P2010'
    || text.includes('23505');
  return isUniqueViolation
    && (
      text.includes('fgis_grain_sdiz_projection_number_key')
      || text.includes('sdizNumber')
    );
}

''',
        'projection uniqueness race classifier',
    )

contract = 'apps/api/src/modules/regulatory-integration/fgis-grain/fgis-grain-sdiz-projection.contract.ts'
if 'function compareCodeUnits(' not in Path(contract).read_text(encoding='utf-8'):
    insert_before_once(
        contract,
        'function stableJson(value: unknown): string {\n',
        '''function compareCodeUnits(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

''',
        'locale-independent canonical comparator',
    )

contract_source = Path(contract).read_text(encoding='utf-8')
if '.sort(([left], [right]) => left.localeCompare(right))' in contract_source:
    replace_once(
        contract,
        '.sort(([left], [right]) => left.localeCompare(right))',
        '.sort(([left], [right]) => compareCodeUnits(left, right))',
        'stable JSON key ordering',
    )

contract_source = Path(contract).read_text(encoding='utf-8')
locale_record_sort = '.sort((left, right) => left.sdizId.localeCompare(right.sdizId) || left.sdizNumber.localeCompare(right.sdizNumber));'
if locale_record_sort in contract_source:
    replace_once(
        contract,
        locale_record_sort,
        '.sort((left, right) => compareCodeUnits(left.sdizId, right.sdizId) || compareCodeUnits(left.sdizNumber, right.sdizNumber));',
        'locale-independent record ordering',
    )

contract_spec = 'apps/api/src/modules/regulatory-integration/fgis-grain/fgis-grain-sdiz-projection.contract.spec.ts'
if 'function compareCodeUnits(' not in Path(contract_spec).read_text(encoding='utf-8'):
    insert_before_once(
        contract_spec,
        'function record(overrides: Record<string, unknown> = {}) {\n',
        '''function compareCodeUnits(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

''',
        'contract test canonical comparator',
    )

contract_spec_source = Path(contract_spec).read_text(encoding='utf-8')
if '.sort((left, right) => left.sdizId.localeCompare(right.sdizId));' in contract_spec_source:
    replace_once(
        contract_spec,
        '.sort((left, right) => left.sdizId.localeCompare(right.sdizId));',
        '.sort((left, right) => compareCodeUnits(left.sdizId, right.sdizId));',
        'contract fixture ordering',
    )

if "it('does not depend on host locale collation for canonical fingerprints'" not in Path(contract_spec).read_text(encoding='utf-8'):
    insert_before_once(
        contract_spec,
        "  it('rejects SDIZ number alias disagreement', () => {\n",
        r'''  it('does not depend on host locale collation for canonical fingerprints', () => {
    const localeCompare = jest.spyOn(String.prototype, 'localeCompare')
      .mockImplementation(() => {
        throw new Error('host collation must not participate in canonical hashing');
      });
    let first: ReturnType<typeof normalizeFgisGrainSdizProjectionCommand>;
    let second: ReturnType<typeof normalizeFgisGrainSdizProjectionCommand>;
    try {
      first = normalizeFgisGrainSdizProjectionCommand(command([
        record({ sdizID: 'sdiz_a', sdizNumber: 'SDIZ_a' }),
        record({ sdizID: 'sdiz-A', sdizNumber: 'SDIZ-A' }),
      ]));
      second = normalizeFgisGrainSdizProjectionCommand(command([
        record({ sdizID: 'sdiz-A', sdizNumber: 'SDIZ-A' }),
        record({ sdizID: 'sdiz_a', sdizNumber: 'SDIZ_a' }),
      ]));
    } finally {
      localeCompare.mockRestore();
    }
    expect(first.records.map((item) => item.sdizId)).toEqual(['sdiz-A', 'sdiz_a']);
    expect(second.batchFingerprint).toBe(first.batchFingerprint);
  });

''',
        'locale-independent fingerprint test',
    )

migration = 'apps/api/prisma/migrations/20260724190000_fgis_grain_sdiz_projection/migration.sql'
if 'lock_fgis_grain_sdiz_projection_keys' not in Path(migration).read_text(encoding='utf-8'):
    insert_before_once(
        migration,
        'CREATE TABLE public."fgis_grain_sdiz_projection_batches" (\n',
        '''-- Serialize both existing and first-time SDIZ identifier/number claims.
-- The ordered PL/pgSQL loop avoids deadlocks across overlapping bounded batches.
CREATE OR REPLACE FUNCTION public.lock_fgis_grain_sdiz_projection_keys(p_keys text[])
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $function$
DECLARE
  lock_key text;
  key_count integer;
BEGIN
  key_count := COALESCE(cardinality(p_keys), 0);
  IF key_count < 1 OR key_count > 400 THEN
    RAISE EXCEPTION 'FGIS SDIZ lock key count must be between 1 and 400'
      USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM unnest(p_keys) AS incoming(value)
    WHERE value IS NULL OR char_length(value) < 1 OR char_length(value) > 1024
  ) THEN
    RAISE EXCEPTION 'FGIS SDIZ lock key is invalid'
      USING ERRCODE = '22023';
  END IF;
  FOR lock_key IN
    SELECT DISTINCT value
    FROM unnest(p_keys) AS incoming(value)
    ORDER BY value COLLATE "C"
  LOOP
    PERFORM pg_advisory_xact_lock(hashtextextended(lock_key, 0));
  END LOOP;
END;
$function$;

REVOKE ALL ON FUNCTION public.lock_fgis_grain_sdiz_projection_keys(text[]) FROM PUBLIC;

''',
        'deterministic SDIZ identity lock function',
    )

if 'outbox_entries_fgis_sdiz_insert' not in Path(migration).read_text(encoding='utf-8'):
    Path(migration).write_text(
        Path(migration).read_text(encoding='utf-8')
        + '''

-- Permit only the two canonical SDIZ event types through the restricted
-- runtime principal when their payload is bound to the trusted tenant/org/user
-- context. The generic Deal outbox policy remains unchanged.
DROP POLICY IF EXISTS outbox_entries_fgis_sdiz_select ON public."outbox_entries";
CREATE POLICY outbox_entries_fgis_sdiz_select
ON public."outbox_entries"
FOR SELECT
TO PUBLIC
USING (
  current_user IN ('app_runtime', 'app_service')
  AND public.app_rls_context_ready()
  AND current_setting('app.current_role', true) IN ('ADMIN', 'COMPLIANCE_OFFICER')
  AND "dealId" IS NULL
  AND "auditId" IS NOT NULL
  AND jsonb_typeof("payload") = 'object'
  AND "payload"->>'schemaVersion' = 'pc-crop.fgis-grain-sdiz-projection-batch.v1'
  AND "payload"->>'tenantId' = current_setting('app.current_tenant_id', true)
  AND "payload"->>'organizationId' = current_setting('app.current_org_id', true)
  AND (
    ("type" = 'FGIS_GRAIN_SDIZ_PROJECTION_APPLIED' AND "payload"->>'kind' = 'APPLIED')
    OR
    ("type" = 'FGIS_GRAIN_SDIZ_PROJECTION_CONFLICT' AND "payload"->>'kind' = 'QUARANTINED')
  )
);

DROP POLICY IF EXISTS outbox_entries_fgis_sdiz_insert ON public."outbox_entries";
CREATE POLICY outbox_entries_fgis_sdiz_insert
ON public."outbox_entries"
FOR INSERT
TO PUBLIC
WITH CHECK (
  current_user IN ('app_runtime', 'app_service')
  AND public.app_rls_context_ready()
  AND current_setting('app.current_role', true) IN ('ADMIN', 'COMPLIANCE_OFFICER')
  AND "dealId" IS NULL
  AND "triggeredByUserId" = current_setting('app.current_user_id', true)
  AND "auditId" IS NOT NULL
  AND "correlationId" IS NOT NULL
  AND "idempotencyKey" LIKE 'fgis-sdiz-projection:%'
  AND jsonb_typeof("payload") = 'object'
  AND "payload"->>'schemaVersion' = 'pc-crop.fgis-grain-sdiz-projection-batch.v1'
  AND "payload"->>'tenantId' = current_setting('app.current_tenant_id', true)
  AND "payload"->>'organizationId' = current_setting('app.current_org_id', true)
  AND (
    ("type" = 'FGIS_GRAIN_SDIZ_PROJECTION_APPLIED' AND "payload"->>'kind' = 'APPLIED')
    OR
    ("type" = 'FGIS_GRAIN_SDIZ_PROJECTION_CONFLICT' AND "payload"->>'kind' = 'QUARANTINED')
  )
);
''',
        encoding='utf-8',
    )

e2e = 'apps/api/test/industrial/fgis-grain-sdiz-projection.e2e-spec.ts'
e2e_source = Path(e2e).read_text(encoding='utf-8')
if 'let runtimePrisma: PrismaService | null' not in e2e_source:
    replace_once(
        e2e,
        'let prisma: PrismaService;\nlet repository: FgisGrainSdizProjectionRepository;\n',
        'let prisma: PrismaService;\nlet repository: FgisGrainSdizProjectionRepository;\n'
        'let runtimePrisma: PrismaService | null = null;\n'
        'let runtimeRepository: FgisGrainSdizProjectionRepository | null = null;\n',
        'restricted runtime repository declarations',
    )

if 'function compareCodeUnits(' not in Path(e2e).read_text(encoding='utf-8'):
    insert_before_once(
        e2e,
        'function record(overrides: Record<string, unknown> = {}) {\n',
        '''function compareCodeUnits(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

''',
        'E2E canonical comparator',
    )

e2e_source = Path(e2e).read_text(encoding='utf-8')
if '.sort((left, right) => left.sdizId.localeCompare(right.sdizId));' in e2e_source:
    replace_once(
        e2e,
        '.sort((left, right) => left.sdizId.localeCompare(right.sdizId));',
        '.sort((left, right) => compareCodeUnits(left.sdizId, right.sdizId));',
        'E2E fixture ordering',
    )

if 'PC_CROP_08F_RUNTIME_DATABASE_URL is required' not in Path(e2e).read_text(encoding='utf-8'):
    replace_once(
        e2e,
        '''    await seedOrganization(ORG_A, TENANT_A, '801');
    await seedOrganization(ORG_B, TENANT_B, '802');
    repository = new FgisGrainSdizProjectionRepository(new RlsTransactionService(prisma));
''',
        '''    await seedOrganization(ORG_A, TENANT_A, '801');
    await seedOrganization(ORG_B, TENANT_B, '802');
    repository = new FgisGrainSdizProjectionRepository(new RlsTransactionService(prisma));
    const runtimeUrl = process.env.PC_CROP_08F_RUNTIME_DATABASE_URL;
    if (!runtimeUrl) {
      throw new Error('PC_CROP_08F_RUNTIME_DATABASE_URL is required for restricted-principal acceptance');
    }
    runtimePrisma = new PrismaService({ datasources: { db: { url: runtimeUrl } } });
    await runtimePrisma.$connect();
    runtimeRepository = new FgisGrainSdizProjectionRepository(
      new RlsTransactionService(runtimePrisma),
    );
''',
        'restricted runtime repository setup',
    )

if 'await runtimePrisma?.$disconnect();' not in Path(e2e).read_text(encoding='utf-8'):
    replace_once(
        e2e,
        '''  afterAll(async () => {
    await prisma.$disconnect();
  });
''',
        '''  afterAll(async () => {
    await runtimePrisma?.$disconnect();
    await prisma.$disconnect();
  });
''',
        'restricted runtime repository teardown',
    )

if "it('persists canonical SDIZ evidence through the restricted app_runtime principal'" not in Path(e2e).read_text(encoding='utf-8'):
    insert_before_once(
        e2e,
        "  it('applies only newer provider state and quarantines stale or same-time conflicts', async () => {\n",
        r'''  it('persists canonical SDIZ evidence through the restricted app_runtime principal', async () => {
    if (!runtimePrisma || !runtimeRepository) throw new Error('restricted runtime repository is not initialized');
    const principal = await runtimePrisma.$queryRaw<Array<{ currentUser: string }>>(Prisma.sql`
      SELECT current_user::text AS "currentUser"
    `);
    expect(principal).toEqual([{ currentUser: 'app_runtime' }]);

    const inboxId = `${RUN_ID}.inbox.runtime-principal`;
    const workerId = `${RUN_ID}.worker.runtime-principal`;
    const providerMessageId = `${RUN_ID}.message.runtime-principal`;
    const occurredAt = new Date('2026-07-24T12:30:00.000Z');
    await seedInbox({
      id: inboxId, tenantId: TENANT_A, organizationId: ORG_A,
      providerMessageId, providerReferenceMessageId: null,
      rawBodySha256: '8'.repeat(64), occurredAt, workerId,
    });

    const applied = await runtimeRepository.applyVerifiedInbox(USER_A, command({
      inboxEntryId: inboxId, workerId, providerMessageId,
      rawBodySha256: '8'.repeat(64), providerOccurredAt: occurredAt,
      records: [record({
        sdizID: `${RUN_ID}.sdiz.runtime-principal`,
        sdizNumber: `${RUN_ID}.number.runtime-principal`,
      })],
      idempotencySuffix: 'runtime-principal',
    }));
    expect(applied.kind).toBe('APPLIED');

    const evidence = await prisma.$queryRaw<Array<{
      type: string; dealId: string | null; tenantId: string; organizationId: string;
    }>>(Prisma.sql`
      SELECT o."type", o."dealId", o."payload"->>'tenantId' AS "tenantId",
             o."payload"->>'organizationId' AS "organizationId"
      FROM public."outbox_entries" o
      WHERE o."id" = ${applied.outboxEntryId}
    `);
    expect(evidence).toEqual([{
      type: 'FGIS_GRAIN_SDIZ_PROJECTION_APPLIED',
      dealId: null,
      tenantId: TENANT_A,
      organizationId: ORG_A,
    }]);
  });

''',
        'restricted app_runtime outbox acceptance',
    )

if "it('serializes concurrent first-time SDIZ number ownership claims'" not in Path(e2e).read_text(encoding='utf-8'):
    insert_before_once(
        e2e,
        "  it('locks and quarantines SDIZ number ownership collisions', async () => {\n",
        r'''  it('serializes concurrent first-time SDIZ number ownership claims', async () => {
    const sdizNumber = `${RUN_ID}.number.concurrent-owner`;
    const occurredAt = new Date('2026-07-24T14:25:00.000Z');
    const inputs = ['left', 'right'].map((suffix, index) => ({
      suffix,
      inboxId: `${RUN_ID}.inbox.concurrent-${suffix}`,
      workerId: `${RUN_ID}.worker.concurrent-${suffix}`,
      providerMessageId: `${RUN_ID}.message.concurrent-${suffix}`,
      rawBodySha256: String(index + 1).repeat(64),
      sdizId: `${RUN_ID}.sdiz.concurrent-${suffix}`,
    }));
    for (const input of inputs) {
      await seedInbox({
        id: input.inboxId, tenantId: TENANT_A, organizationId: ORG_A,
        providerMessageId: input.providerMessageId, providerReferenceMessageId: null,
        rawBodySha256: input.rawBodySha256, occurredAt, workerId: input.workerId,
      });
    }

    const results = await Promise.all(inputs.map((input) => repository.applyVerifiedInbox(
      USER_A,
      command({
        inboxEntryId: input.inboxId,
        workerId: input.workerId,
        providerMessageId: input.providerMessageId,
        rawBodySha256: input.rawBodySha256,
        providerOccurredAt: occurredAt,
        records: [record({ sdizID: input.sdizId, sdizNumber })],
        idempotencySuffix: `concurrent-${input.suffix}`,
      }),
    )));
    expect(results.map((result) => result.kind).sort()).toEqual(['APPLIED', 'QUARANTINED']);
    expect(results.find((result) => result.kind === 'QUARANTINED')).toMatchObject({
      conflictCode: 'FGIS_SDIZ_NUMBER_OWNERSHIP_CONFLICT',
    });

    const states = await prisma.$queryRaw<Array<{ state: string; lastErrorCode: string | null }>>(Prisma.sql`
      SELECT "state", "lastErrorCode"
      FROM public."regulatory_integration_inbox_entries"
      WHERE "id" IN (${Prisma.join(inputs.map((input) => input.inboxId))})
      ORDER BY "state"
    `);
    expect(states).toEqual([
      { state: 'PROCESSED', lastErrorCode: null },
      { state: 'QUARANTINED', lastErrorCode: 'FGIS_SDIZ_NUMBER_OWNERSHIP_CONFLICT' },
    ]);
    expect(await repository.list(USER_A, { sdizNumber })).toHaveLength(1);
  });

''',
        'concurrent first-time number ownership acceptance',
    )

# Retain the previously added role-denial acceptance.
e2e_source = Path(e2e).read_text(encoding='utf-8')
if "it('denies projection mutation to unauthorized business roles without side effects'" not in e2e_source:
    anchor = "  it('rejects missing live lease and unverified input', async () => {"
    test = r'''  it('denies projection mutation to unauthorized business roles without side effects', async () => {
    const inboxId = `${RUN_ID}.inbox.forbidden-role`;
    const workerId = `${RUN_ID}.worker.forbidden-role`;
    const occurredAt = new Date('2026-07-24T14:50:00.000Z');
    const providerMessageId = `${RUN_ID}.message.forbidden-role`;
    const sdizId = `${RUN_ID}.sdiz.forbidden-role`;

    await seedInbox({
      id: inboxId, tenantId: TENANT_A, organizationId: ORG_A,
      providerMessageId, providerReferenceMessageId: null,
      rawBodySha256: '7'.repeat(64), occurredAt, workerId,
    });

    await expect(repository.applyVerifiedInbox(
      { ...USER_A, role: Role.BUYER },
      command({
        inboxEntryId: inboxId, workerId, providerMessageId,
        rawBodySha256: '7'.repeat(64), providerOccurredAt: occurredAt,
        records: [record({ sdizID: sdizId, sdizNumber: `${RUN_ID}.number.forbidden-role` })],
        idempotencySuffix: 'forbidden-role',
      }),
    )).rejects.toMatchObject({ code: 'MUTATION_FORBIDDEN' });

    const inboxState = await prisma.$queryRaw<Array<{
      state: string; linkedDomainOperationId: string | null; outboxEntryId: string | null;
    }>>(Prisma.sql`
      SELECT "state", "linkedDomainOperationId", "outboxEntryId"
      FROM public."regulatory_integration_inbox_entries"
      WHERE "id" = ${inboxId}
    `);
    expect(inboxState).toEqual([{
      state: 'PROCESSING',
      linkedDomainOperationId: null,
      outboxEntryId: null,
    }]);
    expect(await repository.list(USER_A, { sourceInboxEntryId: inboxId })).toEqual([]);
  });

'''
    replace_once(e2e, anchor, test + anchor, 'projection mutation RBAC PostgreSQL acceptance')

workflow = '.github/workflows/pc-crop-08f.yml'
if 'Provision restricted app_runtime acceptance principal' not in Path(workflow).read_text(encoding='utf-8'):
    insert_before_once(
        workflow,
        '      - name: Typecheck API authority\n',
        r'''      - name: Provision restricted app_runtime acceptance principal
        shell: bash
        run: |
          set -euo pipefail
          sudo apt-get update -qq
          sudo apt-get install -y --no-install-recommends postgresql-client
          admin_url='postgresql://postgres:postgres@localhost:5432/grainflow'
          runtime_password="$(openssl rand -hex 24)"
          psql "$admin_url" -v ON_ERROR_STOP=1 <<'SQL'
          DO $roles$
          BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_runtime') THEN
              EXECUTE 'CREATE ROLE app_runtime LOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION';
            END IF;
            IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_outbox') THEN
              EXECUTE 'CREATE ROLE app_outbox NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION';
            END IF;
          END
          $roles$;
          SQL
          psql "$admin_url" -v ON_ERROR_STOP=1 \
            -c "ALTER ROLE app_runtime PASSWORD '${runtime_password}'"
          psql "$admin_url" -v ON_ERROR_STOP=1 -f infra/sql/production-rls-policies.sql
          psql "$admin_url" -v ON_ERROR_STOP=1 -f infra/sql/postgresql-outbox-worker-policies.sql
          psql "$admin_url" -v ON_ERROR_STOP=1 -f infra/sql/postgresql-regulatory-integration-inbox-policies.sql
          psql "$admin_url" -v ON_ERROR_STOP=1 <<'SQL'
          GRANT USAGE ON SCHEMA public TO app_runtime;
          GRANT SELECT ON TABLE
            public."organizations",
            public."audit_events",
            public."outbox_entries",
            public."regulatory_integration_inbox_entries",
            public."fgis_grain_sdiz_projection_batches",
            public."fgis_grain_sdiz_projections"
          TO app_runtime;
          GRANT INSERT ON TABLE
            public."audit_events",
            public."outbox_entries",
            public."fgis_grain_sdiz_projection_batches",
            public."fgis_grain_sdiz_projections"
          TO app_runtime;
          GRANT UPDATE ON TABLE
            public."regulatory_integration_inbox_entries",
            public."fgis_grain_sdiz_projections"
          TO app_runtime;
          GRANT EXECUTE ON FUNCTION public.app_rls_context_ready() TO app_runtime;
          GRANT EXECUTE ON FUNCTION public.app_rls_privileged() TO app_runtime;
          GRANT EXECUTE ON FUNCTION public.app_rls_deal_visible(text) TO app_runtime;
          GRANT EXECUTE ON FUNCTION public.lock_fgis_grain_sdiz_projection_keys(text[]) TO app_runtime;
          REVOKE DELETE ON TABLE
            public."audit_events",
            public."outbox_entries",
            public."regulatory_integration_inbox_entries",
            public."fgis_grain_sdiz_projection_batches",
            public."fgis_grain_sdiz_projections"
          FROM app_runtime;
          SQL
          printf 'PC_CROP_08F_RUNTIME_DATABASE_URL=postgresql://app_runtime:%s@localhost:5432/grainflow?schema=public\n' \
            "$runtime_password" >> "$GITHUB_ENV"

''',
        'restricted runtime principal workflow step',
    )
