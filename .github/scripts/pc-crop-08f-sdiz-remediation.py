from pathlib import Path


def replace_once(path: str, old: str, new: str, label: str) -> None:
    target = Path(path)
    source = target.read_text(encoding='utf-8')
    count = source.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected one marker, found {count}')
    target.write_text(source.replace(old, new), encoding='utf-8')


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

e2e = 'apps/api/test/industrial/fgis-grain-sdiz-projection.e2e-spec.ts'
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
