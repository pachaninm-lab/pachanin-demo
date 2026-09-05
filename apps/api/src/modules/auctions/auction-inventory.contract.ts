import { UnprocessableEntityException } from '@nestjs/common';

export type RegisterAuctionLotInput = Readonly<{
  title: string;
  culture: string;
  grade?: string | null;
  volumeTons: string;
  startPriceKopecksPerTon: string;
  stepPriceKopecksPerTon: string;
  region: string;
  address?: string | null;
  auctionEndsAt: string;
  sourceType: 'FGIS' | 'ERP' | 'MANUAL_VERIFIED' | 'OTHER';
  sourceExternalId: string;
  sourceCertificateId?: string | null;
  autoExtendEnabled?: boolean;
  autoExtendWindowMinutes?: number;
  autoExtendMinutes?: number;
  idempotencyKey: string;
  inventoryPositionId: string;
  inventoryExpectedVersion: string;
  profileVersionId: string;
  unitCode: string;
  quantity: string;
  correlationId: string;
  reason: string;
}>;

export type AuctionInventoryBinding = Readonly<{
  id: string;
  positionId: string;
  reservationId: string;
  profileVersionId: string;
  profileContentHash: string;
  canonicalCode: string;
  quantityAtoms: string;
  baseUnitCode: string;
  baseUnitPrecision: number;
  inventoryStateVersion: string;
}>;

const REQUIRED_STRINGS = [
  'title', 'culture', 'volumeTons', 'startPriceKopecksPerTon', 'stepPriceKopecksPerTon',
  'region', 'auctionEndsAt', 'sourceType', 'sourceExternalId', 'idempotencyKey',
  'inventoryPositionId', 'inventoryExpectedVersion', 'profileVersionId', 'unitCode',
  'quantity', 'correlationId', 'reason',
] as const;
const OPTIONAL_STRINGS = ['grade', 'address', 'sourceCertificateId'] as const;
const OPTIONAL_INTEGERS = ['autoExtendWindowMinutes', 'autoExtendMinutes'] as const;
const ALLOWED_FIELDS: readonly string[] = [
  ...REQUIRED_STRINGS, ...OPTIONAL_STRINGS, ...OPTIONAL_INTEGERS, 'autoExtendEnabled',
];

/** Check the original JSON body as well as DTO values: whitelist transformation
 * must never turn a supplied authority field into an accepted request. */
export function validateAuctionInventoryRegistration(input: unknown): asserts input is RegisterAuctionLotInput {
  if (!input || typeof input !== 'object' || Array.isArray(input)) invalid('body');
  const body = input as Record<string, unknown>;
  if (Object.keys(body).some((key) => body[key] !== undefined && !ALLOWED_FIELDS.includes(key))) {
    throw new UnprocessableEntityException({ code: 'AUCTION_UNKNOWN_FIELD' });
  }
  for (const key of REQUIRED_STRINGS) {
    if (typeof body[key] !== 'string' || !body[key].trim() || body[key].length > 500) invalid(key);
  }
  for (const key of OPTIONAL_STRINGS) {
    if (body[key] !== undefined && body[key] !== null && (typeof body[key] !== 'string' || body[key].length > 500)) invalid(key);
  }
  for (const key of OPTIONAL_INTEGERS) {
    if (body[key] !== undefined && (!Number.isInteger(body[key]) || Number(body[key]) < 0 || Number(body[key]) > 120)) invalid(key);
  }
  if (body.autoExtendEnabled !== undefined && typeof body.autoExtendEnabled !== 'boolean') invalid('autoExtendEnabled');
  if (!['FGIS', 'ERP', 'MANUAL_VERIFIED', 'OTHER'].includes(body.sourceType as string)) invalid('sourceType');
  if (!/^[A-Za-z0-9][A-Za-z0-9:_.-]{2,239}$/u.test(body.correlationId as string)) invalid('correlationId');
  if ((body.reason as string).trim().length < 10) invalid('reason');
  if ((body.quantity as string).length > 32 || !/^(0|[1-9][0-9]*)(\.[0-9]{1,6})?$/u.test(body.quantity as string)) invalid('quantity');
}

function invalid(field: string): never {
  throw new UnprocessableEntityException({ code: 'AUCTION_INPUT_INVALID', field });
}
