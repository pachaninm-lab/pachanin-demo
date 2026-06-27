import type { PlatformV7MoneyInteger } from '../money-integer';
import { platformV7AssertSameCurrency, platformV7MoneyAdd, platformV7MoneyInteger, platformV7MoneySubtract } from '../money-integer';
import type { PlatformV7LedgerEntry, PlatformV7LedgerSourceView } from '../ledger-source';

export type PlatformV7LedgerInvariantViolation =
  | 'empty-ledger'
  | 'invalid-entry-id'
  | 'invalid-deal-id'
  | 'invalid-tenant-id'
  | 'invalid-source'
  | 'invalid-notes'
  | 'unsafe-money'
  | 'cross-currency'
  | 'unbalanced-ledger'
  | 'negative-net-balance'
  | 'view-summary-mismatch';

export type PlatformV7LedgerInvariantResult = Readonly<{
  valid: boolean;
  violations: readonly PlatformV7LedgerInvariantViolation[];
  currency: PlatformV7MoneyInteger['currency'] | null;
  debitTotal: PlatformV7MoneyInteger | null;
  creditTotal: PlatformV7MoneyInteger | null;
  netDebit: PlatformV7MoneyInteger | null;
}>;

const ZERO_RUB = platformV7MoneyInteger(0);

function uniqueViolations(violations: readonly PlatformV7LedgerInvariantViolation[]): readonly PlatformV7LedgerInvariantViolation[] {
  return Object.freeze([...new Set(violations)]);
}

function isSafeMoney(amount: PlatformV7MoneyInteger): boolean {
  return amount.currency === 'RUB' && Number.isSafeInteger(amount.minorUnits) && amount.minorUnits >= 0;
}

function addViolation(
  violations: PlatformV7LedgerInvariantViolation[],
  violation: PlatformV7LedgerInvariantViolation,
): void {
  if (!violations.includes(violation)) {
    violations.push(violation);
  }
}

export function platformV7LedgerInvariantCheck(entries: readonly PlatformV7LedgerEntry[]): PlatformV7LedgerInvariantResult {
  const violations: PlatformV7LedgerInvariantViolation[] = [];

  if (entries.length === 0) {
    addViolation(violations, 'empty-ledger');
  }

  let debitTotal = ZERO_RUB;
  let creditTotal = ZERO_RUB;
  let currency: PlatformV7MoneyInteger['currency'] | null = null;

  for (const entry of entries) {
    if (!entry.entryId.startsWith('LEDGER-')) {
      addViolation(violations, 'invalid-entry-id');
    }

    if (!entry.dealId.startsWith('DL-')) {
      addViolation(violations, 'invalid-deal-id');
    }

    if (!entry.tenantId.startsWith('TENANT-')) {
      addViolation(violations, 'invalid-tenant-id');
    }

    if (entry.source !== 'controlled-pilot-ledger-read-model') {
      addViolation(violations, 'invalid-source');
    }

    if (/production-ready|fully live|bank connected|fully integrated|payment guarantee/i.test(entry.notes)) {
      addViolation(violations, 'invalid-notes');
    }

    if (!isSafeMoney(entry.amount)) {
      addViolation(violations, 'unsafe-money');
      continue;
    }

    if (currency === null) {
      currency = entry.amount.currency;
    }

    if (currency !== entry.amount.currency) {
      addViolation(violations, 'cross-currency');
      continue;
    }

    try {
      platformV7AssertSameCurrency(debitTotal, entry.amount);
      if (entry.direction === 'debit') {
        debitTotal = platformV7MoneyAdd(debitTotal, entry.amount);
      } else {
        creditTotal = platformV7MoneyAdd(creditTotal, entry.amount);
      }
    } catch {
      addViolation(violations, 'cross-currency');
    }
  }

  let netDebit: PlatformV7MoneyInteger | null = null;

  try {
    netDebit = platformV7MoneySubtract(debitTotal, creditTotal);
  } catch {
    addViolation(violations, 'negative-net-balance');
  }

  if (netDebit !== null && debitTotal.minorUnits !== creditTotal.minorUnits) {
    addViolation(violations, 'unbalanced-ledger');
  }

  const frozenViolations = uniqueViolations(violations);

  return Object.freeze({
    valid: frozenViolations.length === 0,
    violations: frozenViolations,
    currency,
    debitTotal,
    creditTotal,
    netDebit,
  });
}

export function platformV7LedgerViewInvariantCheck(view: PlatformV7LedgerSourceView): PlatformV7LedgerInvariantResult {
  const result = platformV7LedgerInvariantCheck(view.entries);
  const violations = [...result.violations];

  const expectedReserved = sumKind(view.entries, 'reserve');
  const expectedHeld = sumKind(view.entries, 'hold');
  const expectedReleased = sumKind(view.entries, 'release');
  const expectedRefunded = sumKind(view.entries, 'refund');
  const expectedCommission = sumKind(view.entries, 'commission');

  if (
    !sameMoney(expectedReserved, view.reserved) ||
    !sameMoney(expectedHeld, view.held) ||
    !sameMoney(expectedReleased, view.released) ||
    !sameMoney(expectedRefunded, view.refunded) ||
    !sameMoney(expectedCommission, view.commission)
  ) {
    addViolation(violations, 'view-summary-mismatch');
  }

  const frozenViolations = uniqueViolations(violations);

  return Object.freeze({
    ...result,
    valid: frozenViolations.length === 0,
    violations: frozenViolations,
  });
}

export function platformV7AssertLedgerInvariants(entries: readonly PlatformV7LedgerEntry[]): void {
  const result = platformV7LedgerInvariantCheck(entries);

  if (!result.valid) {
    throw new Error(`platform-v7 ledger invariants rejected: ${result.violations.join(',')}`);
  }
}

function sumKind(
  entries: readonly PlatformV7LedgerEntry[],
  kind: PlatformV7LedgerEntry['kind'],
): PlatformV7MoneyInteger {
  return entries
    .filter((entry) => entry.kind === kind && isSafeMoney(entry.amount))
    .reduce((total, entry) => platformV7MoneyAdd(total, entry.amount), ZERO_RUB);
}

function sameMoney(left: PlatformV7MoneyInteger, right: PlatformV7MoneyInteger): boolean {
  return left.currency === right.currency && left.minorUnits === right.minorUnits;
}
