import { IsIn, IsOptional, IsString } from 'class-validator';

export type DealStatus = 'DRAFT' | 'AWAITING_SIGN' | 'SIGNED' | 'PREPAYMENT_RESERVED' | 'LOADING' | 'IN_TRANSIT' | 'ARRIVED' | 'QUALITY_CHECK' | 'ACCEPTED' | 'FINAL_PAYMENT' | 'SETTLED' | 'CLOSED' | 'DISPUTE_OPEN' | 'PARTIAL_SETTLEMENT' | 'ARBITRATION_DECISION' | 'CANCELLED';

export const DEAL_STATUSES: DealStatus[] = ['DRAFT', 'AWAITING_SIGN', 'SIGNED', 'PREPAYMENT_RESERVED', 'LOADING', 'IN_TRANSIT', 'ARRIVED', 'QUALITY_CHECK', 'ACCEPTED', 'FINAL_PAYMENT', 'SETTLED', 'CLOSED', 'DISPUTE_OPEN', 'PARTIAL_SETTLEMENT', 'ARBITRATION_DECISION', 'CANCELLED'];

export class TransitionDealDto {
  // Must carry a validation decorator: under the global whitelisting ValidationPipe
  // an undecorated property is stripped from the payload before it reaches the service.
  @IsString()
  @IsIn(DEAL_STATUSES)
  nextState!: DealStatus;

  @IsOptional()
  @IsString()
  comment?: string;
}
