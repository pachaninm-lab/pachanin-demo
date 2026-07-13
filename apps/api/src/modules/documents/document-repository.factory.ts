import { parseCriticalRepositoryMode } from '../../common/config/industrial-mode';
import type { RlsTransactionService } from '../../common/prisma/rls-transaction.service';
import type { RuntimeCoreService } from '../runtime-core/runtime-core.service';
import type { DocumentRepository } from './document.repository';
import { PrismaDocumentRepository } from './prisma-document.repository';
import { RuntimeDocumentRepository } from './runtime-document.repository';

/** Explicit development/test composition helper. Production binds Prisma directly. */
export function selectDocumentRepository(
  runtime: RuntimeCoreService,
  rls: RlsTransactionService,
  mode: string | undefined,
): DocumentRepository {
  const selected = parseCriticalRepositoryMode('PLATFORM_V7_DOCUMENT_REPOSITORY', mode);
  if (selected === 'prisma') return new PrismaDocumentRepository(rls);
  return new RuntimeDocumentRepository(runtime);
}
