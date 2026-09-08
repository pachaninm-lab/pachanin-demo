import { IsIn, IsNumber, IsOptional, IsPositive, IsString, Matches, Max, MaxLength, Min } from 'class-validator';

import type { Currency, IncotermsCode } from '../export-trade.service';

/**
 * Export trade request bodies, as classes the pipe can see.
 *
 * Four handlers declared their body inline, so IncotermsCode and Currency - both
 * written as TypeScript unions - constrained nothing at runtime. convertCurrency
 * reads its rate as `CBR_RATES[toCurrency]`, so a currency outside the table
 * gives `amountRub / undefined`, and the conversion answers NaN, which serialises
 * as null. The same shape sits inside calculateIncotermsPrice, which divides the
 * total by the same rate.
 *
 * producerInn reuses the INN pattern the KYC contour already enforces rather than
 * introducing a second spelling of the same rule.
 */

const INCOTERMS: readonly IncotermsCode[] = ['EXW', 'FCA', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP', 'FAS', 'FOB', 'CFR', 'CIF'];
const CURRENCIES: readonly Currency[] = ['RUB', 'USD', 'EUR', 'CNY'];

/** The same rule as kyc.dto.ts: ten or twelve digits, nothing else. */
const INN_PATTERN = /^(\d{10}|\d{12})$/u;


export class CalculateIncotermsDto {
  @IsNumber() @Min(0) priceRub!: number;
  @IsIn(INCOTERMS) incoterms!: IncotermsCode;
  @IsIn(CURRENCIES) currency!: Currency;
  @IsOptional() @IsNumber() @Min(0) distanceKm?: number;
  @IsOptional() @IsNumber() @Min(0) volumeTons?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(100) includeInsurancePct?: number;
}

export class ConvertCurrencyDto {
  @IsNumber() @Min(0) amountRub!: number;
  @IsIn(CURRENCIES) toCurrency!: Currency;
}

export class SubmitCustomsDeclarationDto {
  @IsString() @MaxLength(2000) goodsDescription!: string;
  @IsString() @MaxLength(32) tnvedCode!: string;
  @IsNumber() @Min(0) totalValueRub!: number;
}

export class ApplyPhytoCertificateDto {
  @IsString() @MaxLength(500) culture!: string;
  @IsNumber() @IsPositive() volumeTons!: number;
  @Matches(INN_PATTERN, { message: 'producerInn должен содержать 10 или 12 цифр' }) producerInn!: string;
  @IsString() @MaxLength(240) destinationCountry!: string;
}
