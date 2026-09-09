import {
  ArrayMaxSize,
  IsArray,
  IsEmpty,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { PROVIDER_LEGAL_ROLES, PROVIDER_STAGES } from '../provider-registry.contract';

const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9:_.-]{2,239}$/;

export class ProviderRegistryForbiddenAuthorityDto {
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
  @IsEmpty({ message: 'evidence is server-held' })
  evidence?: never;

  @IsOptional()
  @IsEmpty({ message: 'expectedVersion must be supplied only through If-Match' })
  expectedVersion?: never;
}

export class ProviderRegistryCommandDto extends ProviderRegistryForbiddenAuthorityDto {
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
}

export class ProviderCapabilityCommandDto extends ProviderRegistryCommandDto {
  @IsString()
  @IsIn(PROVIDER_LEGAL_ROLES)
  legalRole!: (typeof PROVIDER_LEGAL_ROLES)[number];
}

export class ServiceOfferingCommandDto extends ProviderRegistryCommandDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(160)
  title?: string;

  @IsOptional()
  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  regions?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  cultures?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(PROVIDER_STAGES.length)
  @IsIn(PROVIDER_STAGES, { each: true })
  stages?: (typeof PROVIDER_STAGES)[number][];
}
