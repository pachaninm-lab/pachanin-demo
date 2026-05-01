export type RuntimePersistencePassport = {
  readonly mode: 'server_memory';
  readonly durable: false;
  readonly productionReady: false;
  readonly resetRisk: 'restart_or_deploy';
  readonly label: 'controlled_pilot_memory_store';
};

export const runtimePersistencePassport: RuntimePersistencePassport = {
  mode: 'server_memory',
  durable: false,
  productionReady: false,
  resetRisk: 'restart_or_deploy',
  label: 'controlled_pilot_memory_store',
};
