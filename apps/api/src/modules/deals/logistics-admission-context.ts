import { AsyncLocalStorage } from 'node:async_hooks';

export type NormalizedLogisticsBasis = {
  carriers: Array<{ id: string; status: 'VERIFIED'; tenantId: string }>;
  drivers: Array<{ id: string; carrierOrgId: string; status: 'ACTIVE'; vehicleIds: string[] }>;
  vehicles: Array<{ id: string; carrierOrgId: string; status: 'ACTIVE' }>;
  facilities: Array<{ id: string; organizationId: string; status: 'ACTIVE' }>;
};

export type LogisticsCommandContext = Readonly<{
  commandId: string;
  admissionId: string;
  basis: NormalizedLogisticsBasis;
}>;

const storage = new AsyncLocalStorage<LogisticsCommandContext>();

export function runWithLogisticsCommandContext<T>(
  context: LogisticsCommandContext,
  work: () => T,
): T {
  return storage.run(Object.freeze(context), work);
}

export function currentLogisticsCommandContext(): LogisticsCommandContext | undefined {
  return storage.getStore();
}

export function currentLogisticsCommandId(): string | undefined {
  return storage.getStore()?.commandId;
}
