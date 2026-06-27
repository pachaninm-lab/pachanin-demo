import type { PlatformV7Role } from '../rbac';
import { platformV7CanonicalReadDecision } from '../canonical-data';
import { platformV7AssertSameCurrency, platformV7MoneyAdd, platformV7MoneyCompare, platformV7MoneyInteger, type PlatformV7MoneyInteger } from '../money-integer';

export type PlatformV7LedgerEntryKind = 'reserve' | 'hold' | 'release' | 'refund' | 'commission';

export type PlatformV7LedgerEntryDirection = 'debit' | 'credit';

export type PlatformV7LedgerEntryStatus = 'posted' | 'pending-review' | 'blocked';

export type PlatformV7LedgerEntry = Readonly<{
  entryId: string;
  dealId: string;
  tenantId: string;
  kind: PlatformV7LedgerEntryKind;
  direction: PlatformV7LedgerEntryDirection;
  amount: PlatformV7MoneyInteger;
  status: PlatformV7LedgerEntryStatus;
  source: 'controlled-pilot-ledger-read-model';
  notes: string;
}>;

export type PlatformV7LedgerSourceView = Readonly<{
  dealId: string;
  tenantId: string;
  entries: readonly PlatformV7LedgerEntry[];
  reserved: PlatformV7MoneyInteger;
  held: PlatformV7MoneyInteger;
  released: PlatformV7MoneyInteger;
  refunded: PlatformV7MoneyInteger;
  commission: PlatformV7MoneyInteger;
}>;

export type PlatformV7LedgerDecisionReason =
  | 'ledger-source-selected'
  | 'canonical-money-basis-rejected'
  | 'tenant-mismatch'
  | 'deal-mismatch'
  | 'currency-mismatch';

export type PlatformV7LedgerDecision = Readonly<{
  allowed: boolean;
  reason: PlatformV7LedgerDecisionReason;
  view: PlatformV7LedgerSourceView | null;
}>;

const ZERO_RUB = platformV7MoneyInteger(0);

export const PLATFORM_V7_LEDGER_SOURCE_ENTRIES: readonly PlatformV7LedgerEntry[] = Object.freeze([
  Object.freeze({
    entryId: 'LEDGER-DL-9102-RESERVE-001',
    dealId: 'DL-9102',
    tenantId: 'TENANT-GRAIN-001',
    kind: 'reserve',
    direction: 'debit',
    amount: platformV7MoneyInteger(296400000),
    status: 'posted',
    source: 'controlled-pilot-ledger-read-model',
    notes: 'Controlled-pilot reserve basis only; no bank movement or live payment execution.',
  }),
  Object.freeze({
    entryId: 'LEDGER-DL-9102-HOLD-001',
    dealId: 'DL-9102',
    tenantId: 'TENANT-GRAIN-001',
    kind: 'hold',
    direction: 'debit',
    amount: platformV7MoneyInteger(62400000),
    status: 'pending-review',
    source: 'controlled-pilot-ledger-read-model',
    notes: 'Dispute hold is a read-model boundary value; release authority is not implemented here.',
  }),
  Object.freeze({
    entryId: 'LEDGER-DL-9102-COMMISSION-001',
    dealId: 'DL-9102',
    tenantId: 'TENANT-GRAIN-001',
    kind: 'commission',
    direction: 'credit',
    amount: platformV7MoneyInteger(1482000),
    status: 'posted',
    source: 'controlled-pilot-ledger-read-model',
    notes: 'Commission basis is deterministic integer money only; no invoice, acquiring or settlement integration.',
  }),
]) as readonly PlatformV7LedgerEntry[];

function addIfKind(
  entries: readonly PlatformV7LedgerEntry[],
  kind: PlatformV7LedgerEntryKind,
): PlatformV7MoneyInteger {
  return entries
    .filter((entry) => entry.kind === kind)
    .reduce((total, entry) => {
      platformV7AssertSameCurrency(total, entry.amount);
      return platformV7MoneyAdd(total, entry.amount);
    }, ZERO_RUB);
}

export function platformV7LedgerEntriesForDeal(dealId: string): readonly PlatformV7LedgerEntry[] {
  return PLATFORM_V7_LEDGER_SOURCE_ENTRIES.filter((entry) => entry.dealId === dealId);
}

export function platformV7LedgerSourceViewFor(dealId: string, tenantId: string): PlatformV7LedgerSourceView | null {
  const entries = platformV7LedgerEntriesForDeal(dealId).filter((entry) => entry.tenantId === tenantId);

  if (entries.length === 0) {
    return null;
  }

  return Object.freeze({
    dealId,
    tenantId,
    entries: Object.freeze([...entries]),
    reserved: addIfKind(entries, 'reserve'),
    held: addIfKind(entries, 'hold'),
    released: addIfKind(entries, 'release'),
    refunded: addIfKind(entries, 'refund'),
    commission: addIfKind(entries, 'commission'),
  });
}

export function platformV7LedgerSourceDecision(
  role: PlatformV7Role,
  dealId: string,
  tenantId: string,
): PlatformV7LedgerDecision {
  const canonicalDecision = platformV7CanonicalReadDecision(role, 'moneyBasis');

  if (!canonicalDecision.allowed) {
    return { allowed: false, reason: 'canonical-money-basis-rejected', view: null };
  }

  const entriesForDeal = platformV7LedgerEntriesForDeal(dealId);

  if (entriesForDeal.length === 0) {
    return { allowed: false, reason: 'deal-mismatch', view: null };
  }

  if (entriesForDeal.every((entry) => entry.tenantId !== tenantId)) {
    return { allowed: false, reason: 'tenant-mismatch', view: null };
  }

  const view = platformV7LedgerSourceViewFor(dealId, tenantId);

  if (view === null) {
    return { allowed: false, reason: 'tenant-mismatch', view: null };
  }

  const allAmounts = [view.reserved, view.held, view.released, view.refunded, view.commission];
  const currency = allAmounts[0];

  if (allAmounts.some((amount) => amount.currency !== currency.currency)) {
    return { allowed: false, reason: 'currency-mismatch', view: null };
  }

  return { allowed: true, reason: 'ledger-source-selected', view };
}

export function platformV7AssertLedgerSourceDecision(role: PlatformV7Role, dealId: string, tenantId: string): void {
  const decision = platformV7LedgerSourceDecision(role, dealId, tenantId);

  if (!decision.allowed) {
    throw new Error(`platform-v7 ledger source rejected: ${decision.reason}`);
  }
}

export function platformV7LedgerHasHeldMoney(view: PlatformV7LedgerSourceView): boolean {
  return platformV7MoneyCompare(view.held, ZERO_RUB) === 1;
}
