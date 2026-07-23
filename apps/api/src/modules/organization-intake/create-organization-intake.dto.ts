import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';

export const ORGANIZATION_INTAKE_CONSENT_VERSION = 'pc-public-org-connect-v1-2026-07-23';

export const ORGANIZATION_INTAKE_ROLES = [
  'producer-seller',
  'buyer-processor',
  'logistics',
  'storage-elevator',
  'laboratory-surveyor',
  'bank-finance',
  'public-industry-partner',
] as const;

export const ORGANIZATION_INTAKE_SCENARIOS = [
  'deal-execution',
  'logistics-acceptance',
  'quality-laboratory',
  'documents-evidence',
  'financing-settlement',
  'external-integration',
] as const;

const trim = ({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value;
const lower = ({ value }: { value: unknown }) => typeof value === 'string' ? value.trim().toLowerCase() : value;
const digits = ({ value }: { value: unknown }) => typeof value === 'string' ? value.replace(/\D/g, '') : value;

export class CreateOrganizationIntakeDto {
  @Transform(trim)
  @IsString()
  @Length(2, 200)
  organizationName!: string;

  @Transform(digits)
  @Matches(/^\d{10}(?:\d{2})?$/)
  inn!: string;

  @Transform(trim)
  @IsString()
  @Length(2, 160)
  contactName!: string;

  @Transform(trim)
  @IsString()
  @Length(2, 160)
  position!: string;

  @Transform(trim)
  @IsString()
  @Matches(/^\+?[0-9()\-\s]{7,32}$/)
  phone!: string;

  @Transform(lower)
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsIn(ORGANIZATION_INTAKE_ROLES)
  organizationRole!: typeof ORGANIZATION_INTAKE_ROLES[number];

  @IsIn(ORGANIZATION_INTAKE_SCENARIOS)
  scenario!: typeof ORGANIZATION_INTAKE_SCENARIOS[number];

  @IsIn(['ru', 'en', 'zh'])
  locale!: 'ru' | 'en' | 'zh';

  @IsBoolean()
  consent!: boolean;

  @IsIn([ORGANIZATION_INTAKE_CONSENT_VERSION])
  consentVersion!: typeof ORGANIZATION_INTAKE_CONSENT_VERSION;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  website?: string;
}
