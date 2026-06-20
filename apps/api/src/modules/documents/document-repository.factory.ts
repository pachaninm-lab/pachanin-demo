import type { DocumentRepository } from './document.repository';
import { RuntimeDocumentRepository } from './runtime-document.repository';
import { PrismaDocumentRepository } from './prisma-document.repository';
import type { RuntimeCoreService } from '../runtime-core/runtime-core.service';
import type { PrismaService } from '../../common/prisma/prisma.service';

/**
 * Selects the active document repository adapter. Default: runtime adapter.
 * The Prisma adapter is selected only when mode === 'prisma'
 * (PLATFORM_V7_DOCUMENT_REPOSITORY=prisma). No silent Prisma activation.
 */
export function selectDocumentRepository(
  runtime: RuntimeCoreService,
  prisma?: PrismaService,
  mode: string | undefined = process.env.PLATFORM_V7_DOCUMENT_REPOSITORY,
): DocumentRepository {
  if (mode === 'prisma') {
    return new PrismaDocumentRepository(prisma);
  }
  return new RuntimeDocumentRepository(runtime);
}
