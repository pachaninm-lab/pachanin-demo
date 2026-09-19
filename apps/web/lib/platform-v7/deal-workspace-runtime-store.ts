import type { P7DealWorkspaceRuntimeIntentId } from './deal-workspace-runtime-intents';
import type { P7DealWorkspaceRuntimeRefreshSnapshot } from './deal-workspace-runtime-snapshot';

export type P7DealWorkspaceRuntimeStoreMaturity = 'manual-process-runtime-store';

export interface P7DealWorkspaceRuntimeStoreReceipt {
  readonly recordId: string;
  readonly dealId: string;
  readonly intentId: P7DealWorkspaceRuntimeIntentId;
  readonly version: string;
  readonly savedAt: string;
  readonly maturity: P7DealWorkspaceRuntimeStoreMaturity;
  readonly historyCount: number;
}

export interface P7DealWorkspaceRuntimeStoreRecord extends P7DealWorkspaceRuntimeStoreReceipt {
  readonly snapshot: P7DealWorkspaceRuntimeRefreshSnapshot;
}

export interface P7DealWorkspaceRuntimeStoreSaveInput {
  readonly snapshot: P7DealWorkspaceRuntimeRefreshSnapshot;
  readonly savedAt?: string;
}

type RuntimeStoreState = {
  versionCounter: number;
  records: P7DealWorkspaceRuntimeStoreRecord[];
};

const globalRuntimeStore = globalThis as typeof globalThis & {
  __p7DealWorkspaceRuntimeStore?: RuntimeStoreState;
};

function storeState(): RuntimeStoreState {
  if (!globalRuntimeStore.__p7DealWorkspaceRuntimeStore) {
    globalRuntimeStore.__p7DealWorkspaceRuntimeStore = { versionCounter: 0, records: [] };
  }
  return globalRuntimeStore.__p7DealWorkspaceRuntimeStore;
}

function currentTime(): string {
  return new Date().toISOString();
}

function historyForDeal(state: RuntimeStoreState, dealId: string): P7DealWorkspaceRuntimeStoreRecord[] {
  return state.records.filter((record) => record.dealId === dealId);
}

export function saveP7DealWorkspaceRuntimeSnapshot(input: P7DealWorkspaceRuntimeStoreSaveInput): P7DealWorkspaceRuntimeStoreReceipt {
  const state = storeState();
  state.versionCounter += 1;
  const savedAt = input.savedAt ?? currentTime();
  const version = `p7-runtime-store-v${state.versionCounter}`;
  const record: P7DealWorkspaceRuntimeStoreRecord = {
    recordId: `${input.snapshot.dealId}:${input.snapshot.intentId}:${version}`,
    dealId: input.snapshot.dealId,
    intentId: input.snapshot.intentId,
    version,
    savedAt,
    maturity: 'manual-process-runtime-store',
    historyCount: historyForDeal(state, input.snapshot.dealId).length + 1,
    snapshot: input.snapshot,
  };
  state.records.push(record);

  const { snapshot: _snapshot, ...receipt } = record;
  return receipt;
}

export function listP7DealWorkspaceRuntimeSnapshots(dealId: string): readonly P7DealWorkspaceRuntimeStoreRecord[] {
  return historyForDeal(storeState(), dealId).map((record) => ({ ...record, snapshot: { ...record.snapshot } }));
}

export function latestP7DealWorkspaceRuntimeSnapshot(dealId: string): P7DealWorkspaceRuntimeStoreRecord | null {
  const records = historyForDeal(storeState(), dealId);
  const latest = records.at(-1);
  return latest ? { ...latest, snapshot: { ...latest.snapshot } } : null;
}

export function resetP7DealWorkspaceRuntimeStoreForTests(): void {
  globalRuntimeStore.__p7DealWorkspaceRuntimeStore = { versionCounter: 0, records: [] };
}
