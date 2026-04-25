export type PlatformV7BankPartnerStage = 'sandbox' | 'test_stand' | 'pre_live' | 'live';
export type PlatformV7BankPartnerConnector = 'safe_deals' | 'credit_widget' | 'sberbusiness_id' | 'webhooks' | 'nominal_account';
export type PlatformV7BankPartnerTone = 'success' | 'warning' | 'danger';

export interface PlatformV7BankPartnerReadinessInput {
  partner: string;
  stage: PlatformV7BankPartnerStage;
  connectors: Partial<Record<PlatformV7BankPartnerConnector, boolean>>;
  contractSigned: boolean;
  credentialsReady: boolean;
  nominalAccountReady: boolean;
  webhookUrlReady: boolean;
  testPaymentPassed: boolean;
  productionAccessReady: boolean;
}

export interface PlatformV7BankPartnerReadinessModel {
  partner: string;
  stage: PlatformV7BankPartnerStage;
  readinessPercent: number;
  canRunMoneyPilot: boolean;
  canGoLive: boolean;
  blockerCount: number;
  blockers: string[];
  nextAction: string;
  tone: PlatformV7BankPartnerTone;
  connected: PlatformV7BankPartnerConnector[];
  missingConnectors: PlatformV7BankPartnerConnector[];
}

const requiredConnectors: PlatformV7BankPartnerConnector[] = [
  'safe_deals',
  'sberbusiness_id',
  'webhooks',
  'nominal_account',
];

export function platformV7BankPartnerReadinessModel(
  input: PlatformV7BankPartnerReadinessInput,
): PlatformV7BankPartnerReadinessModel {
  const connected = requiredConnectors.filter((connector) => input.connectors[connector]);
  const missingConnectors = requiredConnectors.filter((connector) => !input.connectors[connector]);
  const blockers = platformV7BankPartnerReadinessBlockers(input, missingConnectors);
  const readinessPercent = platformV7BankPartnerReadinessPercent(input, connected.length);
  const canRunMoneyPilot = blockers.every((blocker) => !blocker.includes('контракт') && !blocker.includes('nominal'))
    && input.stage !== 'sandbox'
    && input.credentialsReady
    && input.webhookUrlReady;
  const canGoLive = blockers.length === 0
    && input.stage === 'live'
    && input.productionAccessReady
    && input.testPaymentPassed;

  return {
    partner: input.partner,
    stage: input.stage,
    readinessPercent,
    canRunMoneyPilot,
    canGoLive,
    blockerCount: blockers.length,
    blockers,
    nextAction: platformV7BankPartnerReadinessNextAction(blockers, input.stage),
    tone: platformV7BankPartnerReadinessTone(blockers.length, canGoLive),
    connected,
    missingConnectors,
  };
}

export function platformV7BankPartnerReadinessBlockers(
  input: PlatformV7BankPartnerReadinessInput,
  missingConnectors: PlatformV7BankPartnerConnector[] = requiredConnectors.filter((connector) => !input.connectors[connector]),
): string[] {
  const blockers: string[] = [];

  if (!input.contractSigned) blockers.push('Не подписан банковый контракт.');
  if (!input.credentialsReady) blockers.push('Нет готовых банковых credentials.');
  if (!input.nominalAccountReady) blockers.push('Не подтверждён nominal account.');
  if (!input.webhookUrlReady) blockers.push('Не подтверждён webhook URL.');
  if (!input.testPaymentPassed) blockers.push('Не пройден тестовый платёж.');
  if (input.stage === 'live' && !input.productionAccessReady) blockers.push('Нет production access.');
  if (missingConnectors.length > 0) blockers.push(`Не подключены обязательные контуры: ${missingConnectors.join(', ')}.`);

  return [...new Set(blockers)];
}

export function platformV7BankPartnerReadinessPercent(
  input: PlatformV7BankPartnerReadinessInput,
  connectedCount: number,
): number {
  const checks = [
    input.contractSigned,
    input.credentialsReady,
    input.nominalAccountReady,
    input.webhookUrlReady,
    input.testPaymentPassed,
    input.productionAccessReady,
    connectedCount >= requiredConnectors.length,
  ];
  const done = checks.filter(Boolean).length;
  return Math.round((done / checks.length) * 100);
}

export function platformV7BankPartnerReadinessTone(
  blockerCount: number,
  canGoLive: boolean,
): PlatformV7BankPartnerTone {
  if (canGoLive) return 'success';
  if (blockerCount <= 2) return 'warning';
  return 'danger';
}

export function platformV7BankPartnerReadinessNextAction(
  blockers: string[],
  stage: PlatformV7BankPartnerStage,
): string {
  if (blockers.length > 0) return blockers[0];
  if (stage !== 'live') return 'Перевести банк из тестового контура в live.';
  return 'Банковый live-контур готов.';
}
