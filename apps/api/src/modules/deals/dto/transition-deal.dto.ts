import { IsIn, IsOptional, IsString } from 'class-validator';

export type DealStatus = 'DRAFT' | 'AWAITING_SIGN' | 'SIGNED' | 'PREPAYMENT_RESERVED' | 'LOADING' | 'IN_TRANSIT' | 'ARRIVED' | 'QUALITY_CHECK' | 'ACCEPTED' | 'FINAL_PAYMENT' | 'SETTLED' | 'CLOSED' | 'DISPUTE_OPEN' | 'PARTIAL_SETTLEMENT' | 'ARBITRATION_DECISION' | 'CANCELLED';

export const DEAL_STATUSES: readonly DealStatus[] = [
  'DRAFT', 'AWAITING_SIGN', 'SIGNED', 'PREPAYMENT_RESERVED', 'LOADING', 'IN_TRANSIT',
  'ARRIVED', 'QUALITY_CHECK', 'ACCEPTED', 'FINAL_PAYMENT', 'SETTLED', 'CLOSED',
  'DISPUTE_OPEN', 'PARTIAL_SETTLEMENT', 'ARBITRATION_DECISION', 'CANCELLED',
];

export class TransitionDealDto {
  // DealStatus erases at runtime, so this field carried no constraint while the
  // ratchet counted the class as validation. This DTO has no consumer anywhere
  // in apps/api/src today, so nothing is closed here either - what is closed is
  // the shape of the hole.
  @IsIn(DEAL_STATUSES) nextState!: DealStatus;

  @IsOptional()
  @IsString()
  comment?: string;
}
