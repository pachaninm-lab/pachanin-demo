import { createActionLogEntry, type PlatformActionLogEntry } from './action-log';

export interface OperatorGateActionInput {
  dealId: string;
  amount: number;
  actor?: string;
  at?: string;
}

export interface OperatorGateActionResult {
  gateState: 'PASS';
  nextStep: string;
  nextOwner: string;
  log: PlatformActionLogEntry[];
}

export function buildGatePassResult(input: OperatorGateActionInput): OperatorGateActionResult {
  const actor = input.actor ?? 'Оператор платформы';
  const at = input.at ?? new Date().toISOString();

  return {
    gateState: 'PASS',
    nextStep: 'Gate PASS. Можно двигать контур дальше.',
    nextOwner: 'Банк',
    log: [
      createActionLogEntry({
        scope: 'deal',
        status: 'success',
        objectId: input.dealId,
        action: 'gate-pass',
        message: `${input.dealId}: gate переведён в PASS.`,
        actor,
        at,
      }),
      createActionLogEntry({
        scope: 'bank',
        status: input.amount > 0 ? 'started' : 'success',
        objectId: input.dealId,
        action: 'bank-check',
        message: input.amount > 0 ? `${input.dealId}: требуется банковая проверка.` : `${input.dealId}: банковая проверка не требуется.`,
        actor,
        at,
      }),
    ],
  };
}
