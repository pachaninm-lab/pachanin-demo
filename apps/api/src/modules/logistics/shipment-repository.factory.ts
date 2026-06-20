import type { ShipmentRepository } from './shipment.repository';
import { RuntimeShipmentRepository } from './runtime-shipment.repository';
import { PrismaShipmentRepository } from './prisma-shipment.repository';
import type { RuntimeCoreService } from '../runtime-core/runtime-core.service';
import type { PrismaService } from '../../common/prisma/prisma.service';

/**
 * Selects the active shipment repository adapter. Default: runtime adapter.
 * The Prisma adapter is selected only when mode === 'prisma'
 * (PLATFORM_V7_SHIPMENT_REPOSITORY=prisma). No silent Prisma activation.
 */
export function selectShipmentRepository(
  runtime: RuntimeCoreService,
  prisma?: PrismaService,
  mode: string | undefined = process.env.PLATFORM_V7_SHIPMENT_REPOSITORY,
): ShipmentRepository {
  if (mode === 'prisma') {
    return new PrismaShipmentRepository(prisma);
  }
  return new RuntimeShipmentRepository(runtime);
}
