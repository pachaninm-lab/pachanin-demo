import { IsOptional, IsString } from 'class-validator';

export type DealStatus = 'DRAFT' | 'AWAITING_SIGN' | 'SIGNED' | 'PREPAYMENT_RESERVED' | 'LOADING' | 'IN_TRANSIT' | 'ARRIVED' | 'QUALITY_CHECK' | 'ACCEPTED' | 'FINAL_PAYMENT' | 'SETTLED' | 'CLOSED' | 'DISPUTE_OPEN' | 'PARTIAL_SETTLEMENT' | 'ARBITRATION_DECISION' | 'CANCELLED';

export class TransitionDealDto {
  nextState!: DealStatus;

  @IsOptional()
  @IsString()
  comment?: string;
}
