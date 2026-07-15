import {
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

const SAFE_ID = /^[A-Za-z0-9:_.-]{1,240}$/;
const POSITIVE_MINOR_UNITS = /^(?:[1-9]\d{0,18})$/;
const CURRENCY = /^[A-Z]{3}$/;

export class CreateDisputeDto {
  @IsString()
  @Matches(SAFE_ID)
  dealId!: string;

  @IsOptional()
  @IsString()
  @Matches(SAFE_ID)
  shipmentId?: string;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  reason!: string;

  @IsString()
  @MinLength(5)
  @MaxLength(4000)
  detail!: string;

  @IsOptional()
  @IsString()
  @Matches(POSITIVE_MINOR_UNITS)
  claimAmountKopecks?: string;

  @IsOptional()
  @IsString()
  @Length(3, 3)
  @Matches(CURRENCY)
  currency: string = 'RUB';

  @IsString()
  @MaxLength(240)
  @Matches(SAFE_ID)
  idempotencyKey!: string;
}
