import type { PaymentRepository } from './payment.repository';
import { RuntimePaymentRepository } from './runtime-payment.repository';
import { PrismaPaymentRepository } from './prisma-payment.repository';
import type { RuntimeCoreService } from '../runtime-core/runtime-core.service';
import type { PrismaService } from '../../common/prisma/prisma.service';

/**
 * Selects the active payment read adapter.
 *
 * Default (controlled-pilot / pre-integration): the in-memory RuntimeCore
 * adapter. The DB-backed Prisma read adapter is selected ONLY when the mode
 * value equals 'prisma' (PLATFORM_V7_PAYMENT_REPOSITORY=prisma). Any other
 * value keeps the runtime adapter. There is no silent Prisma activation, and
 * money mutations are never routed through this selection.
 */
export function selectPaymentRepository(
  runtime: RuntimeCoreService,
  prisma?: PrismaService,
  mode: string | undefined = process.env.PLATFORM_V7_PAYMENT_REPOSITORY,
): PaymentRepository {
  if (mode === 'prisma') {
    return new PrismaPaymentRepository(prisma);
  }
  return new RuntimePaymentRepository(runtime);
}
