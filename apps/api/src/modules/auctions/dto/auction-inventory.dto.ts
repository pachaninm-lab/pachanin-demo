import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class RegisterAuctionInventoryLotDto {
  @IsString() @MaxLength(500) title!: string;
  @IsString() @MaxLength(500) culture!: string;
  @IsOptional() @IsString() @MaxLength(500) grade?: string | null;
  @IsString() @MaxLength(32) volumeTons!: string;
  @IsString() @MaxLength(19) startPriceKopecksPerTon!: string;
  @IsString() @MaxLength(19) stepPriceKopecksPerTon!: string;
  @IsString() @MaxLength(500) region!: string;
  @IsOptional() @IsString() @MaxLength(500) address?: string | null;
  @IsString() @MaxLength(64) auctionEndsAt!: string;
  @IsIn(['FGIS', 'ERP', 'MANUAL_VERIFIED', 'OTHER']) sourceType!: string;
  @IsString() @MaxLength(240) sourceExternalId!: string;
  @IsOptional() @IsString() @MaxLength(240) sourceCertificateId?: string | null;
  @IsOptional() @IsBoolean() autoExtendEnabled?: boolean;
  @IsOptional() @IsInt() @Min(0) @Max(120) autoExtendWindowMinutes?: number;
  @IsOptional() @IsInt() @Min(0) @Max(120) autoExtendMinutes?: number;
  @IsString() @MaxLength(240) idempotencyKey!: string;
  @IsString() @MaxLength(240) inventoryPositionId!: string;
  @IsString() @MaxLength(19) inventoryExpectedVersion!: string;
  @IsString() @MaxLength(240) profileVersionId!: string;
  @IsString() @MaxLength(96) unitCode!: string;
  @IsString() @MaxLength(32) quantity!: string;
  @IsString() @MaxLength(240) correlationId!: string;
  @IsString() @MaxLength(500) reason!: string;
}
