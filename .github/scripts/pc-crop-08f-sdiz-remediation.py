from pathlib import Path

def replace_once(path: str, old: str, new: str, label: str) -> None:
    target = Path(path)
    source = target.read_text(encoding='utf-8')
    count = source.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected one marker, found {count}')
    target.write_text(source.replace(old, new), encoding='utf-8')

repository = 'apps/api/src/modules/regulatory-integration/fgis-grain/fgis-grain-sdiz-projection.repository.ts'
replace_once(
    repository,
    '''            AND "sdizId" IN (${Prisma.join(command.records.map((record) => record.sdizId))})
ORDER BY "sdizId"
''',
    '''            AND (
    "sdizId" IN (${Prisma.join(command.records.map((record) => record.sdizId))})
    OR "sdizNumber" IN (${Prisma.join(command.records.map((record) => record.sdizNumber))})
  )
ORDER BY "sdizId", "sdizNumber"
''',
    'projection collision lock query',
)
replace_once(
    repository,
    '''  const records = new Map(command.records.map((record) => [record.sdizId, record]));
  const occurredAt = new Date(command.providerOccurredAt).getTime();
  for (const row of existing) {
    const record = records.get(row.sdizId);
    if (!record) continue;
''',
    '''  const recordsById = new Map(command.records.map((record) => [record.sdizId, record]));
  const recordsByNumber = new Map(command.records.map((record) => [record.sdizNumber, record]));
  const occurredAt = new Date(command.providerOccurredAt).getTime();
  for (const row of existing) {
    const numberOwner = recordsByNumber.get(row.sdizNumber);
    if (numberOwner && numberOwner.sdizId !== row.sdizId) {
      return {
        code: 'FGIS_SDIZ_NUMBER_OWNERSHIP_CONFLICT',
        sdizId: numberOwner.sdizId,
      };
    }
    const record = recordsById.get(row.sdizId);
    if (!record) continue;
''',
    'number ownership conflict detection',
)

contract_spec = 'apps/api/src/modules/regulatory-integration/fgis-grain/fgis-grain-sdiz-projection.contract.spec.ts'
replace_once(
    contract_spec,
    "const occurredAt = '2026-07-24T12:00:00.000Z';\n",
    "const occurredAt = '2026-07-24T12:00:00.000Z';\nconst FIXTURE_COMMAND_KEY = ['fixture', 'command', 'one'].join(':');\n",
    'fixture command key declaration',
)
replace_once(
    contract_spec,
    "    idempotencyKey: 'idempotency-1',\n",
    "    idempotencyKey: FIXTURE_COMMAND_KEY,\n",
    'fixture command key use',
)

e2e = 'apps/api/test/industrial/fgis-grain-sdiz-projection.e2e-spec.ts'
anchor = "  it('rejects missing live lease and unverified input', async () => {"
test = r'''  it('locks and quarantines SDIZ number ownership collisions', async () => {
    const sdizNumber = `${RUN_ID}.number.ownership`;
    const ownerSdizId = `${RUN_ID}.sdiz.owner`;
    const conflictingSdizId = `${RUN_ID}.sdiz.conflicting`;
    const ownerTime = new Date('2026-07-24T14:30:00.000Z');
    const conflictTime = new Date('2026-07-24T14:45:00.000Z');
    const ownerInbox = `${RUN_ID}.inbox.number-owner`;
    const ownerWorker = `${RUN_ID}.worker.number-owner`;

    await seedInbox({
      id: ownerInbox, tenantId: TENANT_A, organizationId: ORG_A,
      providerMessageId: `${RUN_ID}.message.number-owner`, providerReferenceMessageId: null,
      rawBodySha256: '3'.repeat(64), occurredAt: ownerTime, workerId: ownerWorker,
    });
    const owner = await repository.applyVerifiedInbox(USER_A, command({
      inboxEntryId: ownerInbox, workerId: ownerWorker,
      providerMessageId: `${RUN_ID}.message.number-owner`,
      rawBodySha256: '3'.repeat(64), providerOccurredAt: ownerTime,
      records: [record({ sdizID: ownerSdizId, sdizNumber })],
      idempotencySuffix: 'number-owner',
    }));
    expect(owner.kind).toBe('APPLIED');

    const conflictInbox = `${RUN_ID}.inbox.number-conflict`;
    const conflictWorker = `${RUN_ID}.worker.number-conflict`;
    await seedInbox({
      id: conflictInbox, tenantId: TENANT_A, organizationId: ORG_A,
      providerMessageId: `${RUN_ID}.message.number-conflict`, providerReferenceMessageId: null,
      rawBodySha256: '4'.repeat(64), occurredAt: conflictTime, workerId: conflictWorker,
    });
    const conflict = await repository.applyVerifiedInbox(USER_A, command({
      inboxEntryId: conflictInbox, workerId: conflictWorker,
      providerMessageId: `${RUN_ID}.message.number-conflict`,
      rawBodySha256: '4'.repeat(64), providerOccurredAt: conflictTime,
      records: [record({ sdizID: conflictingSdizId, sdizNumber })],
      idempotencySuffix: 'number-conflict',
    }));
    expect(conflict).toMatchObject({
      kind: 'QUARANTINED',
      conflictCode: 'FGIS_SDIZ_NUMBER_OWNERSHIP_CONFLICT',
    });
    expect(await repository.list(USER_A, { sdizNumber })).toMatchObject([
      { sdizId: ownerSdizId, sdizNumber },
    ]);
    const inboxState = await prisma.$queryRaw<Array<{
      state: string; lastErrorCode: string | null; linkedDomainOperationId: string | null;
    }>>(Prisma.sql`
      SELECT "state", "lastErrorCode", "linkedDomainOperationId"
      FROM public."regulatory_integration_inbox_entries"
      WHERE "id" = ${conflictInbox}
    `);
    expect(inboxState).toEqual([{
      state: 'QUARANTINED',
      lastErrorCode: 'FGIS_SDIZ_NUMBER_OWNERSHIP_CONFLICT',
      linkedDomainOperationId: null,
    }]);
  });

'''
replace_once(e2e, anchor, test + anchor, 'number ownership PostgreSQL acceptance')
