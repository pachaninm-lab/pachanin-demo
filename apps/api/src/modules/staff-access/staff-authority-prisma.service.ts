import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  shouldEnforceDatabasePrincipalBoundary,
} from '../../common/prisma/database-principal-boundary';
import { PrismaService } from '../../common/prisma/prisma.service';

function principalFromUrl(value: string, label: string): string {
  try {
    const principal = decodeURIComponent(new URL(value).username).trim();
    if (!principal) throw new Error('missing principal');
    return principal;
  } catch {
    throw new Error(`${label} must be a valid PostgreSQL URL with an explicit principal.`);
  }
}

function resolveStaffDatabaseUrl(environment: NodeJS.ProcessEnv = process.env): string | undefined {
  const staffUrl = String(environment.STAFF_DATABASE_URL ?? '').trim();
  const authUrl = String(environment.AUTH_DATABASE_URL ?? '').trim();
  const dealUrl = String(environment.DATABASE_URL ?? '').trim();
  const storageUrl = String(environment.STORAGE_DATABASE_URL ?? '').trim();
  const strict = shouldEnforceDatabasePrincipalBoundary(environment);

  if (strict && !staffUrl) {
    throw new Error('STAFF_DATABASE_URL is required when the database principal boundary is enforced.');
  }

  if (staffUrl) {
    const staffPrincipal = principalFromUrl(staffUrl, 'STAFF_DATABASE_URL');
    for (const [label, candidate] of [
      ['DATABASE_URL', dealUrl],
      ['AUTH_DATABASE_URL', authUrl],
      ['STORAGE_DATABASE_URL', storageUrl],
    ] as const) {
      if (candidate && principalFromUrl(candidate, label) === staffPrincipal) {
        throw new Error(`STAFF_DATABASE_URL must use a different PostgreSQL principal than ${label}.`);
      }
    }
  }

  // Local/unit-test environments may keep using the existing auth datasource.
  // Strict acceptance and production never reach this fallback.
  return staffUrl || authUrl || dealUrl || undefined;
}

type StaffPrincipalInspectionRow = {
  current_user: string;
  superuser: boolean;
  bypass_rls: boolean;
  role_inherit: boolean;
  create_db: boolean;
  create_role: boolean;
  has_role_memberships: boolean;
  has_role_members: boolean;
  owns_runtime_tables: boolean;
  direct_runtime_table_privileges: boolean;
  row_security: string;
  auth_schema_usage: boolean;
  target_scope_execute: boolean;
  deal_target_scope_execute: boolean;
  admission_queue_execute: boolean;
  admission_application_execute: boolean;
  admission_decision_execute: boolean;
  organization_directory_execute: boolean;
  organization_users_execute: boolean;
  cabinet_deals_execute: boolean;
  admission_capability_execute: boolean;
  projection_capability_execute: boolean;
  identity_bootstrap_execute: boolean;
};

@Injectable()
export class StaffAuthorityPrismaService extends PrismaService {
  private readonly staffLogger = new Logger(StaffAuthorityPrismaService.name);

  constructor() {
    const url = resolveStaffDatabaseUrl();
    super(url ? { datasources: { db: { url } } } : undefined);
  }

  override async onModuleInit(): Promise<void> {
    const strict = shouldEnforceDatabasePrincipalBoundary();
    try {
      await this.$connect();
      if (strict) {
        await this.assertProductionPrincipal();
      } else {
        this.staffLogger.log('Staff authority database connected');
      }
    } catch (error) {
      if (strict) throw error;
      this.staffLogger.warn(`Staff authority database unavailable in non-production mode: ${(error as Error).message}`);
    }
  }

  override async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  private async assertProductionPrincipal(): Promise<void> {
    const rows = await this.$queryRaw<StaffPrincipalInspectionRow[]>(Prisma.sql`
      SELECT
        current_user,
        roles.rolsuper AS superuser,
        roles.rolbypassrls AS bypass_rls,
        roles.rolinherit AS role_inherit,
        roles.rolcreatedb AS create_db,
        roles.rolcreaterole AS create_role,
        EXISTS (
          SELECT 1 FROM pg_catalog.pg_auth_members memberships
          WHERE memberships.member = roles.oid
        ) AS has_role_memberships,
        EXISTS (
          SELECT 1 FROM pg_catalog.pg_auth_members memberships
          WHERE memberships.roleid = roles.oid
        ) AS has_role_members,
        EXISTS (
          SELECT 1
          FROM pg_catalog.pg_class relation
          JOIN pg_catalog.pg_namespace schema ON schema.oid = relation.relnamespace
          WHERE relation.relowner = roles.oid
            AND schema.nspname IN ('public', 'auth')
            AND relation.relkind IN ('r', 'p', 'v', 'm', 'S')
        ) AS owns_runtime_tables,
        EXISTS (
          SELECT 1
          FROM information_schema.role_table_grants grants
          WHERE grants.grantee = current_user
            AND grants.table_schema IN ('public', 'auth')
        ) AS direct_runtime_table_privileges,
        current_setting('row_security') AS row_security,
        has_schema_privilege(current_user, 'auth', 'USAGE') AS auth_schema_usage,
        coalesce(has_function_privilege(
          current_user,
          to_regprocedure('auth.resolve_staff_target_scope(text,text,text,text,text)'),
          'EXECUTE'
        ), false) AS target_scope_execute,
        coalesce(has_function_privilege(
          current_user,
          to_regprocedure('auth.resolve_staff_deal_target_scope(text,text,text)'),
          'EXECUTE'
        ), false) AS deal_target_scope_execute,
        coalesce(has_function_privilege(
          current_user,
          to_regprocedure('auth.staff_admission_queue(text,text,text,integer)'),
          'EXECUTE'
        ), false) AS admission_queue_execute,
        coalesce(has_function_privilege(
          current_user,
          to_regprocedure('auth.staff_admission_application(text,text,text,text)'),
          'EXECUTE'
        ), false) AS admission_application_execute,
        coalesce(has_function_privilege(
          current_user,
          to_regprocedure('auth.staff_admission_decision(text,text,text,text,text,text)'),
          'EXECUTE'
        ), false) AS admission_decision_execute,
        coalesce(has_function_privilege(
          current_user,
          to_regprocedure('auth.staff_organization_directory(text,text,text)'),
          'EXECUTE'
        ), false) AS organization_directory_execute,
        coalesce(has_function_privilege(
          current_user,
          to_regprocedure('auth.staff_organization_users(text,text,text,text)'),
          'EXECUTE'
        ), false) AS organization_users_execute,
        coalesce(has_function_privilege(
          current_user,
          to_regprocedure('auth.staff_cabinet_deals(text,text,text,text,text)'),
          'EXECUTE'
        ), false) AS cabinet_deals_execute,
        coalesce(has_function_privilege(
          current_user,
          to_regprocedure('auth.staff_admission_capability(text,text,text,text,text)'),
          'EXECUTE'
        ), false) AS admission_capability_execute,
        coalesce(has_function_privilege(
          current_user,
          to_regprocedure('auth.staff_projection_capability(text,text,text,text,text,text,boolean)'),
          'EXECUTE'
        ), false) AS projection_capability_execute,
        (
          coalesce(has_function_privilege(current_user, to_regprocedure('auth.resolve_login_credential(text)'), 'EXECUTE'), false)
          OR coalesce(has_function_privilege(current_user, to_regprocedure('auth.resolve_login_default_membership(text)'), 'EXECUTE'), false)
          OR coalesce(has_function_privilege(current_user, to_regprocedure('auth.resolve_login_identity(text)'), 'EXECUTE'), false)
          OR coalesce(has_function_privilege(current_user, to_regprocedure('auth.resolve_login_identity_by_id(text)'), 'EXECUTE'), false)
          OR coalesce(has_function_privilege(current_user, to_regprocedure('auth.resolve_login_memberships(text)'), 'EXECUTE'), false)
          OR coalesce(has_function_privilege(current_user, to_regprocedure('auth.resolve_login_memberships_ordered(text)'), 'EXECUTE'), false)
          OR coalesce(has_function_privilege(current_user, to_regprocedure('auth.resolve_login_context_by_email(text)'), 'EXECUTE'), false)
          OR coalesce(has_function_privilege(current_user, to_regprocedure('auth.resolve_login_context_by_membership(text,text)'), 'EXECUTE'), false)
          OR coalesce(has_function_privilege(current_user, to_regprocedure('auth.resolve_session_identity(text,text,text,text)'), 'EXECUTE'), false)
        ) AS identity_bootstrap_execute
      FROM pg_catalog.pg_roles roles
      WHERE roles.rolname = current_user
    `);

    const row = rows[0];
    if (!row) throw new Error('Unable to inspect current staff PostgreSQL principal.');

    const errors: string[] = [];
    if (row.superuser) errors.push('must not be SUPERUSER');
    if (row.bypass_rls) errors.push('must not have BYPASSRLS');
    if (row.role_inherit) errors.push('must be NOINHERIT');
    if (row.create_db) errors.push('must not have CREATEDB');
    if (row.create_role) errors.push('must not have CREATEROLE');
    if (row.has_role_memberships) errors.push('must not belong to another PostgreSQL role');
    if (row.has_role_members) errors.push('must not be reachable through SET ROLE by another principal');
    if (row.owns_runtime_tables) errors.push('must not own tables, views or sequences in public/auth');
    if (row.direct_runtime_table_privileges) errors.push('must not have direct table privileges in public/auth');
    if (row.row_security.toLowerCase() !== 'on') errors.push('row_security must be on');
    if (!row.auth_schema_usage) errors.push('requires USAGE on schema auth');
    if (!row.target_scope_execute) errors.push('requires EXECUTE on auth.resolve_staff_target_scope');
    if (!row.deal_target_scope_execute) errors.push('requires EXECUTE on auth.resolve_staff_deal_target_scope');
    if (!row.admission_queue_execute) errors.push('requires EXECUTE on auth.staff_admission_queue');
    if (!row.admission_application_execute) errors.push('requires EXECUTE on auth.staff_admission_application');
    if (!row.admission_decision_execute) errors.push('requires EXECUTE on auth.staff_admission_decision');
    if (!row.organization_directory_execute) errors.push('requires EXECUTE on auth.staff_organization_directory');
    if (!row.organization_users_execute) errors.push('requires EXECUTE on auth.staff_organization_users');
    if (!row.cabinet_deals_execute) errors.push('requires EXECUTE on auth.staff_cabinet_deals');
    if (row.admission_capability_execute) errors.push('must not EXECUTE auth.staff_admission_capability directly');
    if (row.projection_capability_execute) errors.push('must not EXECUTE auth.staff_projection_capability directly');
    if (row.identity_bootstrap_execute) errors.push('must not EXECUTE identity bootstrap functions');

    if (errors.length > 0) {
      throw new Error(
        `Staff PostgreSQL principal ${row.current_user} violates the production boundary: ${errors.join('; ')}`,
      );
    }

    this.staffLogger.log(`Staff database principal verified: ${row.current_user}`);
  }
}
