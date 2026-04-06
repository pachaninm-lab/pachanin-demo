import { IsOptional, IsString } from 'class-validator';

export class CreateDealDto {
  @IsString()
  lotId!: string;

  @IsString()
  winnerBidId!: string;

  @IsOptional()
  @IsString()
  buyerOrgId?: string;

  @IsOptional()
  paymentTerms?: Record<string, unknown>;
}
