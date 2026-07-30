from pathlib import Path


def replace_once(source: str, old: str, new: str, label: str) -> str:
    count = source.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected one anchor, found {count}')
    return source.replace(old, new)


path = Path('apps/api/test/industrial/fgis-grain-tenant-read.e2e-spec.ts')
source = path.read_text()
if "import { Prisma, PrismaClient }" not in source:
    source = replace_once(source, "import { Prisma } from '@prisma/client';", "import { Prisma, PrismaClient } from '@prisma/client';", 'PrismaClient import')
if 'const ORG_A_OUTSIDER' not in source:
    source = replace_once(source, "const ORG_A = `${RUN_ID}.org-a`;\nconst ORG_B = `${RUN_ID}.org-b`;", "const ORG_A = `${RUN_ID}.org-a`;\nconst ORG_A_OUTSIDER = `${RUN_ID}.org-a-outsider`;\nconst ORG_B = `${RUN_ID}.org-b`;", 'same-tenant outsider org')
if 'let runtimePrisma' not in source:
    source = replace_once(source, 'let prisma: PrismaService;\nlet providerRepository:', 'let prisma: PrismaService;\nlet runtimePrisma: PrismaClient;\nlet providerRepository:', 'runtime Prisma declaration')
if 'BUYER_A_OUTSIDER' not in source:
    source = replace_once(source, "const BUYER_A = actor(TENANT_A, ORG_A, `${RUN_ID}.buyer-a`, Role.BUYER);\nconst EXEC_B", "const BUYER_A = actor(TENANT_A, ORG_A, `${RUN_ID}.buyer-a`, Role.BUYER);\nconst BUYER_A_OUTSIDER = actor(TENANT_A, ORG_A_OUTSIDER, `${RUN_ID}.buyer-a-outsider`, Role.BUYER);\nconst EXEC_B", 'same-tenant outsider actor')
if 'innAOutsider' not in source:
    source = replace_once(source, "  const innA = `77${Math.floor(Math.random() * 1e8).toString().padStart(8, '0')}`;\n  const innB = `78${Math.floor(Math.random() * 1e8).toString().padStart(8, '0')}`;", "  const innA = `77${Math.floor(Math.random() * 1e8).toString().padStart(8, '0')}`;\n  const innAOutsider = `79${Math.floor(Math.random() * 1e8).toString().padStart(8, '0')}`;\n  const innB = `78${Math.floor(Math.random() * 1e8).toString().padStart(8, '0')}`;", 'same-tenant outsider INN')
if 'Org A Outsider' not in source:
    source = replace_once(source, """      (${ORG_A}, ${innA}, ${`${RUN_ID} Org A`}, ${TENANT_A}, ${now}),
      (${ORG_B}, ${innB}, ${`${RUN_ID} Org B`}, ${TENANT_B}, ${now})""", """      (${ORG_A}, ${innA}, ${`${RUN_ID} Org A`}, ${TENANT_A}, ${now}),
      (${ORG_A_OUTSIDER}, ${innAOutsider}, ${`${RUN_ID} Org A Outsider`}, ${TENANT_A}, ${now}),
      (${ORG_B}, ${innB}, ${`${RUN_ID} Org B`}, ${TENANT_B}, ${now})""", 'same-tenant outsider seed')
if 'BUYER_A_OUTSIDER, EXEC_B' not in source:
    source = replace_once(source, 'for (const user of [EXEC_A, SECURITY_A, LEGAL_A, OPS_A, BUYER_A, EXEC_B, BUYER_B, GUEST_A])', 'for (const user of [EXEC_A, SECURITY_A, LEGAL_A, OPS_A, BUYER_A, BUYER_A_OUTSIDER, EXEC_B, BUYER_B, GUEST_A])', 'same-tenant outsider user seed')
helper = r'''
async function runtimeVisibleAuthorizationCount(
  user: RequestUser,
  authorizationId: string,
): Promise<bigint> {
  return runtimePrisma.$transaction(async (tx) => {
    await tx.$queryRaw(Prisma.sql`
      SELECT
        set_config('app.current_user_id', ${user.id}, true),
        set_config('app.current_org_id', ${user.orgId}, true),
        set_config('app.current_tenant_id', ${user.tenantId}, true),
        set_config('app.current_role', ${user.role}, true),
        set_config('app.current_session_id', ${user.sessionId}, true)
    `);
    const rows = await tx.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
      SELECT count(*)::bigint AS "count"
      FROM public."fgis_grain_tenant_read_authorizations"
      WHERE "id" = ${authorizationId}
    `);
    return rows[0]?.count ?? 0n;
  });
}
'''
marker = "\ndescribePostgres('PC-CROP-10C PostgreSQL tenant-authorized FGIS Grain read', () => {"
if 'runtimeVisibleAuthorizationCount' not in source:
    source = replace_once(source, marker, helper + marker, 'runtime RLS helper')
if 'PC_CROP_10C_RUNTIME_DATABASE_URL is required' not in source:
    source = replace_once(source, """    prisma = new PrismaService();
    await prisma.$connect();
    await seedIdentity();""", """    prisma = new PrismaService();
    await prisma.$connect();
    const runtimeDatabaseUrl = process.env.PC_CROP_10C_RUNTIME_DATABASE_URL;
    if (!runtimeDatabaseUrl) throw new Error('PC_CROP_10C_RUNTIME_DATABASE_URL is required');
    runtimePrisma = new PrismaClient({ datasources: { db: { url: runtimeDatabaseUrl } } });
    await runtimePrisma.$connect();
    await seedIdentity();""", 'runtime Prisma bootstrap')
if 'await runtimePrisma.$disconnect();' not in source:
    source = replace_once(source, """  afterAll(async () => {
    await prisma.$disconnect();
  });""", """  afterAll(async () => {
    await runtimePrisma.$disconnect();
    await prisma.$disconnect();
  });""", 'runtime Prisma cleanup')
if "AND \"reasonCode\" = 'AUTHORIZATION_NOT_ATTESTED'" not in source:
    source = replace_once(source, """    expect(transport.calls).toHaveLength(0);
  });

  it('executes an attested read exactly once""", """    expect(transport.calls).toHaveLength(0);
    const denied = await prisma.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
      SELECT count(*)::bigint AS "count"
      FROM public."fgis_grain_tenant_read_audits"
      WHERE "authorizationId" = ${authorized.authorizationId}
        AND "decision" = 'DENIED'
        AND "reasonCode" = 'AUTHORIZATION_NOT_ATTESTED'
    `);
    expect(denied[0]?.count).toBe(1n);
  });

  it('executes an attested read exactly once""", 'committed denial evidence assertion')
old = """    await expect(readRepository.getView(GUEST_A, authorized.authorizationId))
      .rejects.toBeInstanceOf(ForbiddenException);
    expect(transport.calls).toHaveLength(0);"""
new = """    await expect(readRepository.getView(GUEST_A, authorized.authorizationId))
      .rejects.toBeInstanceOf(ForbiddenException);
    expect(await runtimeVisibleAuthorizationCount(BUYER_A, authorized.authorizationId)).toBe(1n);
    expect(await runtimeVisibleAuthorizationCount(BUYER_A_OUTSIDER, authorized.authorizationId)).toBe(0n);
    expect(await runtimeVisibleAuthorizationCount(BUYER_B, authorized.authorizationId)).toBe(0n);
    expect(transport.calls).toHaveLength(0);"""
if old in source:
    source = replace_once(source, old, new, 'restricted principal RLS assertions')
elif 'runtimeVisibleAuthorizationCount(BUYER_A_OUTSIDER' not in source:
    raise SystemExit('restricted principal RLS assertions missing')
path.write_text(source)
