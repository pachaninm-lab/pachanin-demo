import {
  IsEmpty,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { INTEGRATION_BINDING_TYPES } from '../../../../../../packages/domain-core/src';

const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9:_.-]{2,239}$/;
const SAFE_CAPABILITY_CODE = /^[A-Z][A-Z0-9_.-]{2,79}$/;
const SAFE_ENVIRONMENT = /^[A-Z][A-Z0-9_]{1,31}$/;
const SAFE_ENDPOINT_REFERENCE = /^(?:endpoint|config|binding):[A-Za-z0-9][A-Za-z0-9:_.\/-]{1,220}$/;
const SAFE_CREDENTIAL_REFERENCE = /^(?:secret|vault|kms|credential):[A-Za-z0-9][A-Za-z0-9:_.\/-]{1,220}$/;

export class IntegrationBindingCommandDto {
  @IsString()
  @Matches(SAFE_ID)
  commandId!: string;

  @IsString()
  @Matches(SAFE_ID)
  idempotencyKey!: string;

  @IsString()
  @Matches(SAFE_ID)
  correlationId!: string;

  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  reason!: string;

  @IsOptional()
  @IsString()
  @Matches(SAFE_ID)
  providerCapabilityId?: string;

  @IsOptional()
  @IsString()
  @Matches(SAFE_CAPABILITY_CODE)
  capabilityCode?: string;

  @IsOptional()
  @IsString()
  @IsIn(INTEGRATION_BINDING_TYPES)
  transportType?: (typeof INTEGRATION_BINDING_TYPES)[number];

  @IsOptional()
  @IsString()
  @Matches(SAFE_ENVIRONMENT)
  environment?: string;

  @IsOptional()
  @IsString()
  @Matches(SAFE_ENDPOINT_REFERENCE)
  endpointReference?: string;

  @IsOptional()
  @IsString()
  @Matches(SAFE_CREDENTIAL_REFERENCE)
  credentialReference?: string;

  @IsOptional()
  @IsEmpty({ message: 'tenantId is server-derived' })
  tenantId?: never;

  @IsOptional()
  @IsEmpty({ message: 'organizationId is server-derived' })
  organizationId?: never;

  @IsOptional()
  @IsEmpty({ message: 'providerId is server-derived' })
  providerId?: never;

  @IsOptional()
  @IsEmpty({ message: 'status is server-derived' })
  status?: never;

  @IsOptional()
  @IsEmpty({ message: 'maturity is derived from server-held evidence' })
  maturity?: never;

  @IsOptional()
  @IsEmpty({ message: 'evidence is server-held' })
  evidence?: never;

  @IsOptional()
  @IsEmpty({ message: 'expectedVersion must be supplied only through If-Match' })
  expectedVersion?: never;
}
