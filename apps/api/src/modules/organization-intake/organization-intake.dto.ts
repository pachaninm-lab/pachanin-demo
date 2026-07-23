import {
  Equals,
  IsEmail,
  IsIn,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export const ORGANIZATION_INTAKE_ROLES = [
  'PRODUCER_SELLER',
  'BUYER_PROCESSOR',
  'LOGISTICS',
  'STORAGE_ELEVATOR',
  'LAB_SURVEYOR',
  'BANK_FINANCE',
  'PUBLIC_INDUSTRY_PARTNER',
] as const;

export const ORGANIZATION_INTAKE_SCENARIOS = [
  'DEAL_EXECUTION',
  'LOGISTICS_ACCEPTANCE',
  'QUALITY_LAB',
  'DOCUMENTS_EVIDENCE',
  'FINANCE_SETTLEMENT',
  'EXTERNAL_INTEGRATION',
] as const;

export const ORGANIZATION_INTAKE_LOCALES = ['ru', 'en', 'zh'] as const;
export const ORGANIZATION_INTAKE_CONSENT_VERSION = 'public-organization-connect-v1';

export type OrganizationIntakeRole = (typeof ORGANIZATION_INTAKE_ROLES)[number];
export type OrganizationIntakeScenario = (typeof ORGANIZATION_INTAKE_SCENARIOS)[number];
export type OrganizationIntakeLocale = (typeof ORGANIZATION_INTAKE_LOCALES)[number];

export class CreateOrganizationIntakeDto {
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  organizationName!: string;

  @IsString()
  @Matches(/^[0-9]{10}(?:[0-9]{2})?$/)
  inn!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(160)
  contactName!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(160)
  position!: string;

  @IsString()
  @MaxLength(32)
  @Matches(/^\+?[0-9()\-\s]{7,32}$/)
  phone!: string;

  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsIn(ORGANIZATION_INTAKE_ROLES)
  organizationRole!: OrganizationIntakeRole;

  @IsIn(ORGANIZATION_INTAKE_SCENARIOS)
  scenario!: OrganizationIntakeScenario;

  @IsIn(ORGANIZATION_INTAKE_LOCALES)
  locale!: OrganizationIntakeLocale;

  @Equals(true)
  consent!: true;
}

export type OrganizationIntakeResponse = Readonly<{
  requestNumber: string;
  status: string;
  replay: boolean;
  correlationId: string;
}>;
