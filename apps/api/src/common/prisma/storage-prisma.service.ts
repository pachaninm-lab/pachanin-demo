import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  resolveStorageDatabaseUrl,
  shouldEnforceDatabasePrincipalBoundary,
} from './database-principal-boundary';
import { PrismaService } from './prisma.service';

type StoragePrincipalRow = {
  current_user: string;
  superuser: boolean;
  bypass_rls: boolean;
  role_inherit: boolean;
  has_role_memberships: boolean;
  owns_documents: boolean;
  documents_rls_enabled: boolean;
  documents_force_rls: boolean;
  row_security: string;
  can_select_documents: boolean;
  can_insert_documents: boolean;
  can_update_documents: boolean;
  can_delete_documents: boolean;
};

@Injectable()
export class StoragePrismaService extends PrismaService {
  private readonly storageLogger = new Logger(StoragePrismaService.name);

  constructor() {
    const url = resolveStorageDatabaseUrl();
    super(url ? { datasources: { db: { url } } } : undefined);
  }

  override async onModuleInit(): Promise<void> {
    const strict = shouldEnforceDatabasePrincipalBoundary();
    try {
      await this.$connect();
      if (strict) {
        const rows = await this.$queryRaw<StoragePrincipalRow[]>(Prisma.sql`
          SELECT
            current_user,
            roles.rolsuper AS superuser,
            roles.rolbypassrls AS bypass_rls,
            roles.rolinherit AS role_inherit,
            EXISTS (
              SELECT 1 FROM pg_auth_members memberships WHERE memberships.member = roles.oid
            ) AS has_role_memberships,
            documents.relowner = roles.oid AS owns_documents,
            documents.relrowsecurity AS documents_rls_enabled,
            documents.relforcerowsecurity AS documents_force_rls,
            current_setting('row_security') AS row_security,
            has_table_privilege(current_user, 'public.deal_documents', 'SELECT') AS can_select_documents,
            has_table_privilege(current_user, 'public.deal_documents', 'INSERT') AS can_insert_documents,
            has_table_privilege(current_user, 'public.deal_documents', 'UPDATE') AS can_update_documents,
            has_table_privilege(current_user, 'public.deal_documents', 'DELETE') AS can_delete_documents
          FROM pg_roles roles
          JOIN pg_class documents ON documents.oid = 'public.deal_documents'::regclass
          WHERE roles.rolname = current_user
        `);
        const snapshot = rows[0];
        const expected = process.env.NODE_ENV === 'production' ? 'app_storage' : 'one_deal_storage';
        const invalid = !snapshot
          || snapshot.current_user !== expected
          || snapshot.superuser
          || snapshot.bypass_rls
          || snapshot.role_inherit
          || snapshot.has_role_memberships
          || snapshot.owns_documents
          || !snapshot.documents_rls_enabled
          || !snapshot.documents_force_rls
          || snapshot.row_security.toLowerCase() !== 'on'
          || !snapshot.can_select_documents
          || !snapshot.can_update_documents
          || snapshot.can_insert_documents
          || snapshot.can_delete_documents;
        if (invalid) {
          throw new Error(
            `Storage PostgreSQL principal ${snapshot?.current_user ?? 'unknown'} violates the finalization boundary.`,
          );
        }
        this.storageLogger.log(`Storage database principal verified: ${snapshot.current_user}`);
      } else {
        this.storageLogger.log('Storage database connected');
      }
    } catch (error) {
      if (strict) throw error;
      this.storageLogger.warn(`Storage database unavailable in non-production mode: ${(error as Error).message}`);
    }
  }

  override async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
