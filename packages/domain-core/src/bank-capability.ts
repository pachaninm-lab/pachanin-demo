/**
 * Provider-neutral banking capabilities for PC-CROP.
 *
 * This file deliberately contains no bank/provider names and no settlement
 * finality states. It only describes what a bank adapter can do. Provider
 * selection, IntegrationBinding maturity and canonical money state remain
 * separate authorities.
 */
export const BANK_CAPABILITIES = [
  'SAFE_DEAL_RESERVE_RELEASE',
  'DIRECT_PAYMENT',
  'BILLING',
  'FINANCING_APPLICATION',
  'STATEMENT_READ',
  'STATUS_READ',
  'AUTHENTICATED_CALLBACK',
  'RECONCILIATION',
] as const;

export type BankCapability = (typeof BANK_CAPABILITIES)[number];

export const BANK_COMMANDS = [
  'RESERVE',
  'RELEASE',
  'REFUND',
  'DIRECT_PAYMENT',
  'BILLING',
  'FINANCING_APPLICATION',
] as const;

export type BankCommand = (typeof BANK_COMMANDS)[number];

const COMMAND_CAPABILITY: Readonly<Record<BankCommand, BankCapability>> = Object.freeze({
  RESERVE: 'SAFE_DEAL_RESERVE_RELEASE',
  RELEASE: 'SAFE_DEAL_RESERVE_RELEASE',
  REFUND: 'SAFE_DEAL_RESERVE_RELEASE',
  DIRECT_PAYMENT: 'DIRECT_PAYMENT',
  BILLING: 'BILLING',
  FINANCING_APPLICATION: 'FINANCING_APPLICATION',
});

export function requiredBankCapability(command: BankCommand): BankCapability {
  return COMMAND_CAPABILITY[command];
}

export function isBankCapability(value: string): value is BankCapability {
  return (BANK_CAPABILITIES as readonly string[]).includes(value);
}

export function normalizeBankCapabilitySet(values: readonly string[]): readonly BankCapability[] {
  const normalized = values.map((value) => value.trim());
  const unknown = normalized.filter((value) => !isBankCapability(value));
  if (unknown.length > 0) {
    throw new Error(`UNKNOWN_BANK_CAPABILITY:${unknown.join(',')}`);
  }
  return [...new Set(normalized as BankCapability[])].sort((left, right) => left.localeCompare(right));
}

export function supportsBankCapability(
  supported: readonly BankCapability[],
  required: BankCapability,
): boolean {
  return supported.includes(required);
}
