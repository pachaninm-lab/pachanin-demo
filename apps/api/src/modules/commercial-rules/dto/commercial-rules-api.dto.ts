import {
  IsArray,
  IsEmpty,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9:_.-]{2,239}$/u;

export class CommercialRuleCommandDto {
  @IsString() @Matches(SAFE_ID)
  commandId!: string;

  @IsString() @Matches(SAFE_ID)
  idempotencyKey!: string;

  @IsString() @Matches(SAFE_ID)
  correlationId!: string;

  @IsString() @MinLength(10) @MaxLength(2000)
  reason!: string;

  @IsOptional() @IsString() @Matches(SAFE_ID)
  aggregateId?: string;

  @IsOptional() @IsString() @MinLength(3) @MaxLength(160)
  name?: string;

  @IsOptional() @IsString() @IsIn(['RUB', 'USD', 'EUR', 'CNY'])
  currency?: string;

  @IsOptional() @IsString()
  effectiveFrom?: string | null;

  @IsOptional() @IsString()
  effectiveTo?: string | null;

  @IsOptional() @IsArray()
  rules?: unknown[];

  @IsOptional() @IsArray()
  entries?: unknown[];

  @IsOptional() @IsEmpty({ message: 'tenantId is server-derived' })
  tenantId?: never;

  @IsOptional() @IsEmpty({ message: 'organizationId is server-derived' })
  organizationId?: never;

  @IsOptional() @IsEmpty({ message: 'status is server-derived' })
  status?: never;

  @IsOptional() @IsEmpty({ message: 'version is server-derived' })
  version?: never;

  @IsOptional() @IsEmpty({ message: 'expectedStateVersion is supplied only through If-Match' })
  expectedStateVersion?: never;
}

export class CommercialDecisionDto {
  @IsString() @Matches(SAFE_ID)
  decisionKey!: string;

  @IsString() @Matches(SAFE_ID)
  correlationId!: string;

  @IsString() @Matches(SAFE_ID)
  ruleSetId!: string;

  @IsString()
  ruleKey!: string;

  @IsOptional() @IsString() @Matches(SAFE_ID)
  rulePackId?: string;

  @IsObject()
  context!: Record<string, string | boolean>;

  @IsObject()
  facts!: Record<string, unknown>;

  @IsOptional() @IsEmpty({ message: 'tenantId is server-derived' })
  tenantId?: never;

  @IsOptional() @IsEmpty({ message: 'organizationId is server-derived' })
  organizationId?: never;

  @IsOptional() @IsEmpty({ message: 'amount and outcome are server-derived' })
  outcome?: never;
}
