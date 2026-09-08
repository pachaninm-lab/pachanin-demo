import { INVENTORY_SOURCES, InventoryError, type InventorySource } from '../../../../../packages/domain-core/src/inventory';

type CommandBase = {
  commandId: string; idempotencyKey: string; correlationId: string; expectedVersion: string; reason: string;
};
export type InventoryCommand = CommandBase & (
  | { action: 'DECLARE'; stockKey: string; profileVersionId: string; sourceType: InventorySource; sourceReference: string; unitCode: string; quantity: string }
  | { action: 'RESERVE'; positionId: string; lotId: string; unitCode: string; quantity: string }
  | { action: 'RELEASE'; positionId: string; reservationId: string }
);
export type InventoryPositionView = {
  positionId: string; batchId: string; organizationId: string; stateVersion: string;
  policyId: 'DECLARED_CAPACITY_V1'; policyVersion: '1'; verificationStatus: 'DECLARED';
  declaredQuantity: string; confirmedQuantity: string; availableQuantity: string; reservedQuantity: string;
  committedQuantity: string; shippedQuantity: string; acceptedQuantity: string; blockedQuantity: string;
  disputedQuantity: string; soldQuantity: string; depletedQuantity: string;
  profileVersionId: string; profileContentHash: string; baseUnitCode: string; baseUnitPrecision: number; dimension: string;
};
export type InventoryReceipt = {
  commandId: string; idempotencyKey: string; correlationId: string; action: InventoryCommand['action'];
  position: InventoryPositionView; snapshotId: string; snapshotHash: string; replayed: boolean;
  reservation: { id: string; lotId: string; quantity: string; status: 'RESERVED' | 'RELEASED' } | null;
  committedAt: string; createsFinancialObligation: false;
};
const ID = /^[A-Za-z0-9][A-Za-z0-9:_.-]{2,239}$/u;
const ACTION_FIELDS = {
  DECLARE: ['stockKey', 'profileVersionId', 'sourceType', 'sourceReference', 'unitCode', 'quantity'],
  RESERVE: ['positionId', 'lotId', 'unitCode', 'quantity'],
  RELEASE: ['positionId', 'reservationId'],
} as const;

export function validateInventoryCommand(input: unknown): asserts input is InventoryCommand {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new InventoryError('INVENTORY_COMMAND_INVALID');
  const command = input as Record<string, unknown>;
  if (typeof command.action !== 'string' || !Object.hasOwn(ACTION_FIELDS, command.action)) throw new InventoryError('INVENTORY_ACTION_INVALID');
  const allowed: readonly string[] = ['action', 'commandId', 'idempotencyKey', 'correlationId', 'expectedVersion', 'reason', ...ACTION_FIELDS[command.action as keyof typeof ACTION_FIELDS]];
  // class-transformer materializes absent optional DTO fields as undefined.
  // JSON cannot carry undefined; every supplied value still uses the closed action shape.
  if (Object.keys(command).some((key) => command[key] !== undefined && !allowed.includes(key))) throw new InventoryError('INVENTORY_UNKNOWN_FIELD');
  for (const key of allowed) {
    if (typeof command[key] !== 'string' || !command[key].trim() || command[key].length > 500) throw new InventoryError('INVENTORY_REQUIRED_FIELD');
  }
  for (const key of ['commandId', 'idempotencyKey', 'correlationId']) {
    if (!ID.test(command[key] as string)) throw new InventoryError('INVENTORY_COMMAND_ID_INVALID');
  }
  const version = command.expectedVersion as string;
  if (!/^(0|[1-9][0-9]{0,18})$/u.test(version) || BigInt(version) > 9_223_372_036_854_775_807n
    || (command.reason as string).trim().length < 10) throw new InventoryError('INVENTORY_COMMAND_INVALID');
  if (command.action === 'DECLARE') {
    if (version !== '0' || !/^[A-Za-z0-9][A-Za-z0-9:_.-]{2,79}$/u.test(command.stockKey as string)
      || !(INVENTORY_SOURCES as readonly string[]).includes(command.sourceType as string)
      || (command.sourceReference as string).length > 256) throw new InventoryError('INVENTORY_DECLARATION_INVALID');
  }
  if (command.action !== 'RELEASE' && (typeof command.quantity !== 'string' || command.quantity.length > 32
    || !/^(0|[1-9][0-9]*)(\.[0-9]{1,6})?$/u.test(command.quantity))) throw new InventoryError('INVENTORY_EXACT_QUANTITY_REQUIRED');
}
