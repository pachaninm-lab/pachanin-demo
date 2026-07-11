from pathlib import Path


def replace(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text(encoding='utf-8')
    if old not in text:
        raise SystemExit(f'missing block in {path}')
    file.write_text(text.replace(old, new, 1), encoding='utf-8')

service = 'apps/api/src/modules/staff-access/staff-workspace.service.ts'
replace(service,
"""    if (!scoped) return null;
    if (staffAccess.targetDealId) return [staffAccess.targetDealId];
    const deals = await this.repository.prisma.deal.findMany({
""",
"""    if (!scoped) return null;
    const deals = await this.repository.prisma.deal.findMany({
""")

test = 'apps/api/test/staff-access/staff-workspace.service.spec.ts'
replace(test,
"""    await service.operationsQueue(actor, scopedAccess);
    await service.financeQueue(actor, scopedAccess);
    await service.diagnostics(actor, scopedAccess);

    const operationsWhere = prisma.deal.findMany.mock.calls[0][0].where;
""",
"""    prisma.deal.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 'deal-1' }]);
    await service.operationsQueue(actor, scopedAccess);
    await service.financeQueue(actor, scopedAccess);
    await service.diagnostics(actor, scopedAccess);

    const operationsWhere = prisma.deal.findMany.mock.calls[0][0].where;
""")
replace(test,
"""    expect(prisma.integrationEvent.findMany.mock.calls[0][0].where).toEqual({ dealId: { in: ['deal-1'] } });
""",
"""    expect(prisma.deal.findMany.mock.calls[1][0]).toEqual({
      where: operationsWhere.AND[0],
      select: { id: true },
    });
    expect(prisma.integrationEvent.findMany.mock.calls[0][0].where).toEqual({ dealId: { in: ['deal-1'] } });
""")

Path('.github/workflows/finish-staff-scope-fix.yml').unlink(missing_ok=True)
Path('.github/scripts/finish-staff-scope-fix.py').unlink(missing_ok=True)
