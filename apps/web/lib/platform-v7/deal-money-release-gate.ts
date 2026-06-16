import { PLATFORM_V7_EXECUTION_SOURCE } from './deal-execution-source-of-truth';

export function canRequestStrictMoneyRelease(): boolean {
  const { readiness, money } = PLATFORM_V7_EXECUTION_SOURCE;

  return (
    readiness.fgis.status === 'готово' &&
    readiness.quality.status === 'готово' &&
    readiness.bank.status === 'готово' &&
    readiness.documents.status === 'готово' &&
    readiness.logistics.status === 'готово' &&
    readiness.dispute.status === 'готово' &&
    money.holdRub === 0 &&
    money.releaseCandidateRub > 0
  );
}

export function strictMoneyReleaseBlockers(): string[] {
  const { readiness, money } = PLATFORM_V7_EXECUTION_SOURCE;
  const blockers: string[] = [];

  for (const [key, gate] of Object.entries(readiness)) {
    if (key === 'antiBypass') continue;
    if (gate.status !== 'готово' && gate.blocker) blockers.push(gate.blocker);
  }

  if (money.holdRub > 0) blockers.push('есть удержание денег');
  if (money.releaseCandidateRub <= 0) blockers.push('нет суммы, готовой к подтверждению выплаты');

  return blockers;
}
