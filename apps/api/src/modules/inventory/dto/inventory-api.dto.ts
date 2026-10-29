import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
export class InventoryCommandDto {
  @IsIn(['DECLARE', 'RESERVE', 'RELEASE']) action!: string;
  @IsString() @MaxLength(240) commandId!: string;
  @IsString() @MaxLength(240) idempotencyKey!: string;
  @IsString() @MaxLength(240) correlationId!: string;
  @IsString() @MaxLength(19) expectedVersion!: string;
  @IsString() @MaxLength(500) reason!: string;
  @IsOptional() @IsString() @MaxLength(80) stockKey?: string;
  @IsOptional() @IsString() @MaxLength(240) profileVersionId?: string;
  @IsOptional() @IsString() @MaxLength(32) sourceType?: string;
  @IsOptional() @IsString() @MaxLength(256) sourceReference?: string;
  @IsOptional() @IsString() @MaxLength(96) unitCode?: string;
  @IsOptional() @IsString() @MaxLength(32) quantity?: string;
  @IsOptional() @IsString() @MaxLength(240) positionId?: string;
  @IsOptional() @IsString() @MaxLength(240) lotId?: string;
  @IsOptional() @IsString() @MaxLength(240) reservationId?: string;
}
