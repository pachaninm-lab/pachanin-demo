import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsEmpty,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  FGIS_GRAIN_READ_OPERATION_CODES,
  FGIS_GRAIN_TENANT_READ_ATTESTATION_SCHEMA_VERSION,
  FGIS_GRAIN_TENANT_READ_SCHEMA_VERSION,
  type FgisGrainReadOperationCode,
} from '../fgis-grain/fgis-grain-tenant-read.contract';

const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9:_.-]{2,239}$/u;
const SAFE_REFERENCE =
  /^(?:authorization|evidence|object-store|provider-response|config|policy|vault):\/\/[A-Za-z0-9][A-Za-z0-9:_.\/-]{2,500}$/u;
const VERSION = /^(?:0|[1-9][0-9]{0,18})$/u;
const SHA256 = /^[a-f0-9]{64}$/u;

export class FgisGrainTenantReadForbiddenAuthorityDto {
  @IsOptional()
  @IsEmpty({ message: 'tenantId is server-derived' })
  tenantId?: never;

  @IsOptional()
  @IsEmpty({ message: 'orgId is server-derived' })
  orgId?: never;

  @IsOptional()
  @IsEmpty({ message: 'organizationId is server-derived' })
  organizationId?: never;

  @IsOptional()
  @IsEmpty({ message: 'role is server-derived' })
  role?: never;

  @IsOptional()
  @IsEmpty({ message: 'userId is server-derived' })
  userId?: never;

  @IsOptional()
  @IsEmpty({ message: 'mfaVerified is server-derived' })
  mfaVerified?: never;
}

export class AuthorizeFgisGrainTenantReadDto extends FgisGrainTenantReadForbiddenAuthorityDto {
  @IsIn([FGIS_GRAIN_TENANT_READ_SCHEMA_VERSION])
  schemaVersion!: typeof FGIS_GRAIN_TENANT_READ_SCHEMA_VERSION;

  @IsString()
  @Matches(SAFE_ID)
  configurationId!: string;

  @IsString()
  @Matches(VERSION)
  configurationVersion!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(FGIS_GRAIN_READ_OPERATION_CODES.length)
  @ArrayUnique()
  @IsIn(FGIS_GRAIN_READ_OPERATION_CODES, { each: true })
  allowedOperations!: FgisGrainReadOperationCode[];

  @IsString()
  @Matches(SAFE_REFERENCE)
  authorizationReference!: string;

  @IsString()
  @MaxLength(64)
  validUntil!: string;

  @IsString()
  @MinLength(20)
  @MaxLength(2000)
  reason!: string;
}

export class AttestFgisGrainTenantReadDto extends FgisGrainTenantReadForbiddenAuthorityDto {
  @IsIn([FGIS_GRAIN_TENANT_READ_ATTESTATION_SCHEMA_VERSION])
  schemaVersion!: typeof FGIS_GRAIN_TENANT_READ_ATTESTATION_SCHEMA_VERSION;

  @IsString()
  @Matches(SAFE_ID)
  authorizationId!: string;

  @IsString()
  @Matches(VERSION)
  authorizationVersion!: string;

  @IsString()
  @Matches(SAFE_REFERENCE)
  evidenceReference!: string;

  @IsString()
  @MaxLength(64)
  validUntil!: string;

  @IsString()
  @MinLength(20)
  @MaxLength(2000)
  justification!: string;
}

export class ExecuteFgisGrainTenantReadDto extends FgisGrainTenantReadForbiddenAuthorityDto {
  @IsIn([FGIS_GRAIN_TENANT_READ_SCHEMA_VERSION])
  schemaVersion!: typeof FGIS_GRAIN_TENANT_READ_SCHEMA_VERSION;

  @IsString()
  @Matches(SAFE_ID)
  authorizationId!: string;

  @IsString()
  @Matches(VERSION)
  authorizationVersion!: string;

  @IsIn(FGIS_GRAIN_READ_OPERATION_CODES)
  operationCode!: FgisGrainReadOperationCode;

  @IsString()
  @Matches(SAFE_REFERENCE)
  requestReference!: string;

  @IsString()
  @Matches(SHA256)
  requestSha256!: string;

  @IsString()
  @Matches(SAFE_ID)
  correlationId!: string;

  @IsString()
  @Matches(SAFE_ID)
  idempotencyKey!: string;
}
