import {
  Equals,
  IsBoolean,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { IsStrongPassword } from '../../../common/validators/strong-password.validator';

export const PUBLIC_WORKSPACE_CLASSES = [
  'seller',
  'buyer',
  'logistics',
  'driver',
  'elevator',
  'lab',
  'surveyor',
  'bank',
  'employee',
] as const;

export type PublicWorkspaceClass = typeof PUBLIC_WORKSPACE_CLASSES[number];

const ORG_TYPES = ['LEGAL', 'INDIVIDUAL', 'SELF_EMPLOYED'] as const;
type OrgType = typeof ORG_TYPES[number];

export class RegisterDto {
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsString()
  @Matches(/^\+?[0-9()\-\s]{7,24}$/)
  phone!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(200)
  fullName!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(200)
  position!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(300)
  orgLegalName!: string;

  @IsString()
  @Matches(/^(?:\d{10}|\d{12})$/)
  orgInn!: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{9}$/)
  orgKpp?: string;

  @IsOptional()
  @IsString()
  @Matches(/^(?:\d{13}|\d{15})$/)
  orgOgrn?: string;

  @IsIn(ORG_TYPES)
  orgType!: OrgType;

  @IsString()
  @MinLength(2)
  @MaxLength(160)
  region!: string;

  @IsIn(PUBLIC_WORKSPACE_CLASSES)
  workspace!: PublicWorkspaceClass;

  @IsString()
  @IsStrongPassword()
  password!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(64)
  termsVersion!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(64)
  privacyVersion!: string;

  @IsBoolean()
  @Equals(true)
  acceptTerms!: true;

  @IsBoolean()
  @Equals(true)
  acceptPrivacy!: true;
}
