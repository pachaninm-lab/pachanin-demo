import {
  IsEmpty,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9:_.-]{2,239}$/u;
const SAFE_REFERENCE = /^[A-Za-z0-9][A-Za-z0-9:_.\/-]{2,239}$/u;
const UPPER_KEY = /^[A-Z][A-Z0-9_]{2,79}$/u;
const REGION = /^[A-Za-z0-9][A-Za-z0-9 _.-]{1,119}$/u;
const HASH = /^[0-9a-f]{64}$/u;
const INTEGER = /^(?:0|[1-9][0-9]{0,18})$/u;

export class ServiceMarketplaceCommandDto {
  @IsString() @Matches(SAFE_ID)
  commandId!: string;

  @IsString() @Matches(SAFE_ID)
  idempotencyKey!: string;

  @IsString() @Matches(SAFE_ID)
  correlationId!: string;

  @IsString() @MinLength(10) @MaxLength(2000)
  reason!: string;

  @IsOptional() @IsString() @Matches(UPPER_KEY)
  category?: string;

  @IsOptional() @IsString() @Matches(UPPER_KEY)
  serviceStage?: string;

  @IsOptional() @IsString() @Matches(UPPER_KEY)
  subjectType?: string;

  @IsOptional() @IsString() @Matches(SAFE_ID)
  subjectId?: string;

  @IsOptional() @IsString() @MinLength(10) @MaxLength(2000)
  description?: string;

  @IsOptional() @IsString() @Matches(REGION)
  targetRegion?: string | null;

  @IsOptional() @IsString() @Matches(SAFE_ID)
  quoteId?: string;

  @IsOptional() @IsString() @Matches(SAFE_ID)
  serviceOfferingId?: string;

  @IsOptional() @IsString() @Matches(INTEGER)
  serviceOfferingVersion?: string;

  @IsOptional() @IsString() @IsIn(['RULE_DECISION', 'MANUAL_QUOTE'])
  quoteType?: string;

  @IsOptional() @IsString() @Matches(SAFE_ID)
  commercialDecisionId?: string | null;

  @IsOptional() @IsString() @Matches(INTEGER)
  amountKopecks?: string;

  @IsOptional() @IsString() @IsIn(['RUB', 'USD', 'EUR', 'CNY'])
  currency?: string;

  @IsOptional() @IsString() @IsIn([
    'SELLER', 'BUYER', 'INITIATOR', 'DELIVERY_RESPONSIBLE', 'SPLIT', 'CONTRACT_RULE', 'REQUIRES_CONFIRMATION',
  ])
  payerMode?: string;

  @IsOptional() @IsString() @Matches(HASH)
  termsHash?: string;

  @IsOptional() @IsString()
  expiresAt?: string;

  @IsOptional() @IsString() @Matches(SAFE_ID)
  payerAssignmentId?: string;

  @IsOptional() @IsString() @Matches(SAFE_ID)
  payerOrganizationId?: string;

  @IsOptional() @IsString() @Matches(SAFE_ID)
  payerMembershipId?: string;

  @IsOptional() @IsString() @Matches(SAFE_REFERENCE)
  executionReference?: string;

  @IsOptional() @IsString() @Matches(SAFE_REFERENCE)
  evidenceReference?: string;

  @IsOptional() @IsString() @Matches(HASH)
  evidenceHash?: string;

  @IsOptional() @IsString() @MinLength(10) @MaxLength(2000)
  acceptanceNote?: string;

  @IsOptional() @IsString() @IsIn(['EXTERNAL', 'SETTLEMENT_PLAN_PENDING', 'LEDGER_PENDING'])
  settlementReferenceType?: string;

  @IsOptional() @IsString() @Matches(SAFE_REFERENCE)
  settlementReference?: string;

  @IsOptional() @IsEmpty({ message: 'requestId is path-derived' })
  requestId?: never;

  @IsOptional() @IsEmpty({ message: 'action is path-derived' })
  action?: never;

  @IsOptional() @IsEmpty({ message: 'expectedStateVersion is supplied only through If-Match' })
  expectedStateVersion?: never;

  @IsOptional() @IsEmpty({ message: 'tenantId is server-derived' })
  tenantId?: never;

  @IsOptional() @IsEmpty({ message: 'organizationId is server-derived' })
  organizationId?: never;

  @IsOptional() @IsEmpty({ message: 'status is server-derived' })
  status?: never;

  @IsOptional() @IsEmpty({ message: 'financial authority is forbidden' })
  createsFinancialObligation?: never;
}
