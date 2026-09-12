import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * The off-platform bypass report, as a class the pipe can see.
 *
 * `indicator` was written as a TypeScript union in an inline body type, so at
 * runtime it was any string - and checkOffPlatformSettlement scores it with a
 * `switch (params.indicator)` that has no default case. An indicator outside the
 * four falls straight through: score stays 0, reasons stays empty, flagged is
 * false because 0 is below the threshold of 50, and persistFlag is never
 * reached. The reporter is answered 200 with `{"flagged": false, "score": 0,
 * "reasons": []}` - a report of suspected platform bypass, silently recorded as
 * nothing suspicious.
 *
 * A misspelling was enough. The four names below are the switch's own cases, so
 * the refusal happens at the door instead of the report disappearing.
 */

export const OFF_PLATFORM_INDICATORS = [
  'external_payment_mentioned',
  'deal_cancelled_after_delivery',
  'reputation_drop_post_cancel',
  'counterparty_comment_flag',
] as const;

export class ReportOffPlatformSettlementDto {
  @IsString() @MaxLength(240) dealId!: string;
  @IsString() @MaxLength(240) buyerOrgId!: string;
  @IsString() @MaxLength(240) sellerOrgId!: string;
  @IsIn(OFF_PLATFORM_INDICATORS) indicator!: (typeof OFF_PLATFORM_INDICATORS)[number];
  @IsOptional() @IsString() @MaxLength(2000) evidence?: string;
}
