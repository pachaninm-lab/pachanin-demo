import { Prisma } from '@prisma/client';
import { PrismaService } from '../../src/common/prisma/prisma.service';

jest.setTimeout(120_000);

const TABLES = [
  'carriers',
  'drivers',
  'vehicles',
  'driver_vehicle_links',
  'facilities',
  'deal_admissions',
  'shipment_bindings',
] as const;

const FUNCTIONS = [
  'resolve_deal_admission',
  'resolve_deal_admission_for_command',
  'consume_deal_admission',
  'bind_shipment_to_admission',
  'validate_deal_admission_row',
] as const;

describe('normalized logistics PostgreSQL security boundary', () => {
  let prisma: PrismaService;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('keeps all seven logistics tables under ENABLE + FORCE RLS', async () => {
    const rows = await prisma.$queryRaw<Array<{
      relname: string;
      enabled: boolean;
      forced: boolean;
    }>>(Prisma.sql`
      SELECT c.relname, c.relrowsecurity AS enabled, c.relforcerowsecurity AS forced
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'logistics'
        AND c.relname IN (${Prisma.join(TABLES)})
      ORDER BY c.relname
    `);

    expect(rows).toHaveLength(TABLES.length);
    expect(rows.every((row) => row.enabled && row.forced)).toBe(true);
  });

  it('has tenant policies for reads and controlled writes', async () => {
    const rows = await prisma.$queryRaw<Array<{
      tablename: string;
      policyname: string;
      command: string;
    }>>(Prisma.sql`
      SELECT tablename, policyname, cmd AS command
      FROM pg_policies
      WHERE schemaname = 'logistics'
      ORDER BY tablename, policyname
    `);

    const byTable = new Map<string, Set<string>>();
    for (const row of rows) {
      const commands = byTable.get(row.tablename) ?? new Set<string>();
      commands.add(row.command);
      byTable.set(row.tablename, commands);
    }
    for (const table of TABLES) {
      expect(byTable.get(table)?.has('SELECT')).toBe(true);
    }
    expect(byTable.get('deal_admissions')).toEqual(expect.objectContaining(new Set(['SELECT', 'INSERT', 'UPDATE'])));
    expect(byTable.get('shipment_bindings')?.has('DELETE')).not.toBe(true);
  });

  it('revokes PUBLIC execution from privileged logistics functions', async () => {
    const rows = await prisma.$queryRaw<Array<{
      function_name: string;
      security_definer: boolean;
      public_execute: boolean;
      search_path: string | null;
    }>>(Prisma.sql`
      SELECT
        p.proname AS function_name,
        p.prosecdef AS security_definer,
        EXISTS (
          SELECT 1
          FROM aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) acl
          WHERE acl.grantee = 0 AND acl.privilege_type = 'EXECUTE'
        ) AS public_execute,
        array_to_string(p.proconfig, ',') AS search_path
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'logistics'
        AND p.proname IN (${Prisma.join(FUNCTIONS)})
      ORDER BY p.proname
    `);

    expect(rows).toHaveLength(FUNCTIONS.length);
    for (const row of rows) {
      expect(row.public_execute).toBe(false);
      expect(row.search_path).toMatch(/search_path=/);
    }
    for (const required of [
      'resolve_deal_admission',
      'resolve_deal_admission_for_command',
      'consume_deal_admission',
      'bind_shipment_to_admission',
      'validate_deal_admission_row',
    ]) {
      expect(rows.find((row) => row.function_name === required)?.security_definer).toBe(true);
    }
  });

  it('uses a deferred constraint trigger for atomic Shipment binding', async () => {
    const rows = await prisma.$queryRaw<Array<{
      trigger_name: string;
      deferrable: boolean;
      initially_deferred: boolean;
      enabled: string;
    }>>(Prisma.sql`
      SELECT
        t.tgname AS trigger_name,
        t.tgdeferrable AS deferrable,
        t.tginitdeferred AS initially_deferred,
        t.tgenabled::text AS enabled
      FROM pg_trigger t
      JOIN pg_class c ON c.oid = t.tgrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname = 'shipments'
        AND t.tgname = 'shipment_logistics_admission_binding'
        AND NOT t.tgisinternal
    `);

    expect(rows).toEqual([{
      trigger_name: 'shipment_logistics_admission_binding',
      deferrable: true,
      initially_deferred: true,
      enabled: 'O',
    }]);
  });

  it('gives the restricted Deal runtime read/function access but no direct logistics writes', async () => {
    const rows = await prisma.$queryRaw<Array<{
      current_user: string;
      schema_usage: boolean;
      admission_select: boolean;
      admission_insert: boolean;
      admission_update: boolean;
      admission_delete: boolean;
      resolver_execute: boolean;
      consume_execute: boolean;
    }>>(Prisma.sql`
      SELECT
        current_user,
        has_schema_privilege(current_user, 'logistics', 'USAGE') AS schema_usage,
        has_table_privilege(current_user, 'logistics.deal_admissions', 'SELECT') AS admission_select,
        has_table_privilege(current_user, 'logistics.deal_admissions', 'INSERT') AS admission_insert,
        has_table_privilege(current_user, 'logistics.deal_admissions', 'UPDATE') AS admission_update,
        has_table_privilege(current_user, 'logistics.deal_admissions', 'DELETE') AS admission_delete,
        has_function_privilege(
          current_user,
          'logistics.resolve_deal_admission_for_command(text,text,text,text,text,text,text)',
          'EXECUTE'
        ) AS resolver_execute,
        has_function_privilege(
          current_user,
          'logistics.consume_deal_admission(text,text,text)',
          'EXECUTE'
        ) AS consume_execute
    `);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      schema_usage: true,
      admission_select: true,
      admission_insert: false,
      admission_update: false,
      admission_delete: false,
      resolver_execute: true,
      consume_execute: true,
    });
  });
});
