import { IsObject, IsOptional, IsString, Length } from 'class-validator';

/**
 * Deal creation consumes a server-persisted auction basis. Commercial facts,
 * tenant, participants and roles are resolved from PostgreSQL; the client only
 * identifies the locked lot/bid pair and supplies an idempotency boundary.
 */
export class CreateDealDto {
  @IsString()
  @Length(8, 128)
  commandId!: string;

  @IsString()
  @Length(8, 200)
  idempotencyKey!: string;

  @IsString()
  @Length(1, 160)
  lotId!: string;

  @IsString()
  @Length(1, 160)
  winnerBidId!: string;

  /** Compatibility assertion only. PostgreSQL basis remains authoritative. */
  @IsOptional()
  @IsString()
  buyerOrgId?: string;

  /** Compatibility assertion only. PostgreSQL basis remains authoritative. */
  @IsOptional()
  @IsString()
  culture?: string;

  @IsOptional()
  @IsObject()
  paymentTerms?: Record<string, unknown>;
}
