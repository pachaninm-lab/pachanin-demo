import { IndustrialDealCommandGateway } from '../../src/modules/deals/industrial-deal-command.gateway';
import { SettlementAccessService } from '../../src/modules/settlement-engine/settlement-access.service';
import { SettlementAwareDealCommandService } from '../../src/modules/settlement-engine/settlement-aware-deal-command.service';
import { SettlementEngineService } from '../../src/modules/settlement-engine/settlement-engine.service';
import { SettlementPostgresqlRepository } from '../../src/modules/settlement-engine/settlement-postgresql.repository';
import {
  createInstance,
  type ServiceInstance,
} from './harness';

export type SettlementServiceInstance = ServiceInstance & {
  settlementAccess: SettlementAccessService;
  settlementRepository: SettlementPostgresqlRepository;
  settlement: SettlementEngineService;
  commands: SettlementAwareDealCommandService;
};

/**
 * Uses exactly the production Settlement repository/service and the same
 * settlement-aware Deal command binding as DealsModule. The base harness still
 * owns storage/Labs lifecycle and connection teardown.
 */
export async function createSettlementInstance(): Promise<SettlementServiceInstance> {
  const instance = await createInstance();
  const settlementAccess = new SettlementAccessService(instance.rls);
  const settlementRepository = new SettlementPostgresqlRepository(
    instance.prisma,
    instance.rls,
  );
  const settlement = new SettlementEngineService(settlementRepository, settlementAccess);
  const commands = new SettlementAwareDealCommandService(instance.rls, settlement);
  const gateway = new IndustrialDealCommandGateway(
    instance.prisma,
    instance.rls,
    commands,
  );

  return Object.assign(instance, {
    settlementAccess,
    settlementRepository,
    settlement,
    commands,
    gateway,
  });
}
