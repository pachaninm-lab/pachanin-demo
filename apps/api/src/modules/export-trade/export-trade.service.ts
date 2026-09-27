import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { integrationRegistry } from '../../../../../packages/integration-sdk/src/registry';
import type { MockFtsAdapter } from '../../../../../packages/integration-sdk/src/adapters/fts.adapter';
import type { MockRshnAdapter } from '../../../../../packages/integration-sdk/src/adapters/rshn.adapter';
import type { MockMarineAdapter } from '../../../../../packages/integration-sdk/src/adapters/marine.adapter';

// Списки, курсы и правила живут в export-trade.contract.ts по одному разу;
// имена типов ре-экспортированы, чтобы существующие импорты не сломались.
export type { Currency, IncotermsCode } from './export-trade.contract';
import type { Currency, IncotermsCode } from './export-trade.contract';
import {
  DEFAULT_DISTANCE_KM,
  DEFAULT_INSURANCE_PCT,
  DEFAULT_VOLUME_TONS,
  CBR_RATES,
  CURRENCIES,
  FREIGHT_RATE_RUB_PER_TON_KM,
  INCOTERMS_RULES,
  exchangeRateFor,
  incotermsRuleFor,
} from './export-trade.contract';


@Injectable()
export class ExportTradeService {
  private readonly logger = new Logger(ExportTradeService.name);

  listIncoterms(): Array<{ code: IncotermsCode; rule: typeof INCOTERMS_RULES[IncotermsCode] }> {
    return Object.entries(INCOTERMS_RULES).map(([code, rule]) => ({
      code: code as IncotermsCode,
      rule,
    }));
  }

  calculateIncotermsPrice(params: {
    priceRub: number;
    incoterms: IncotermsCode;
    currency: Currency;
    distanceKm?: number;
    volumeTons?: number;
    includeInsurancePct?: number;
  }): {
    basePriceRub: number;
    freightRub: number;
    insuranceRub: number;
    totalRub: number;
    totalCurrency: number;
    currency: Currency;
    exchangeRate: number;
    incoterms: IncotermsCode;
    breakdown: Record<string, number>;
  } {
    // Неизвестный базис давал undefined и падал на rule.costIncludes —
    // TypeError, то есть 500 на вводе пользователя. Замерено.
    const rule = incotermsRuleFor(params.incoterms);
    if (!rule) throw new BadRequestException('EXPORT_INCOTERMS_UNKNOWN');

    // Неизвестная валюта давала undefined, деление на него — NaN, а в JSON
    // сумма уезжала как null: цена без цифры. Замерено.
    const rate = exchangeRateFor(params.currency);
    if (rate === undefined) throw new BadRequestException('EXPORT_CURRENCY_UNKNOWN');

    const dist = params.distanceKm ?? DEFAULT_DISTANCE_KM;
    const weight = params.volumeTons ?? DEFAULT_VOLUME_TONS;
    const insurancePct = params.includeInsurancePct ?? DEFAULT_INSURANCE_PCT;

    // Цена строкой не складывалась, а КОНКАТЕНИРОВАЛАСЬ: «500» + фрахт +
    // страховка давали «5001750001» вместо 175 501 — завышение в 28 500 раз,
    // и итог уходил в ответ строкой. Number.isFinite строку не пропускает.
    for (const [name, value] of [
      ['priceRub', params.priceRub], ['distanceKm', dist],
      ['volumeTons', weight], ['includeInsurancePct', insurancePct],
    ] as const) {
      if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
        throw new BadRequestException(`EXPORT_MEASURE_INVALID:${name}`);
      }
    }

    let freightRub = 0;
    if (rule.costIncludes.some(c => c.includes('freight') || c === 'ocean_freight' || c === 'inland_freight' || c === 'loading')) {
      freightRub = Math.round(dist * weight * FREIGHT_RATE_RUB_PER_TON_KM);
    }

    let insuranceRub = 0;
    if (rule.costIncludes.includes('insurance')) {
      insuranceRub = Math.round(params.priceRub * (insurancePct / 100));
    }

    const totalRub = params.priceRub + freightRub + insuranceRub;
    const totalCurrency = Math.round((totalRub / rate) * 100) / 100;

    return {
      basePriceRub: params.priceRub,
      freightRub,
      insuranceRub,
      totalRub,
      totalCurrency,
      currency: params.currency,
      exchangeRate: rate,
      incoterms: params.incoterms,
      breakdown: {
        base: params.priceRub,
        freight: freightRub,
        insurance: insuranceRub,
        total: totalRub,
      },
    };
  }

  getExchangeRates(): { rates: Record<Currency, number>; base: 'RUB'; updatedAt: string; source: 'cbr.ru (mock)' } {
    // Ответ собирается обычным объектом: внутренняя таблица без прототипа
    // остаётся внутренней и наружу не отдаётся.
    const rates = Object.fromEntries(
      CURRENCIES.map((currency) => [currency, CBR_RATES[currency] as number]),
    ) as Record<Currency, number>;
    return {
      rates,
      base: 'RUB',
      updatedAt: new Date().toISOString(),
      source: 'cbr.ru (mock)',
    };
  }

  convertCurrency(amountRub: number, toCurrency: Currency): { amount: number; currency: Currency; rate: number } {
    const rate = exchangeRateFor(toCurrency);
    if (rate === undefined) throw new BadRequestException('EXPORT_CURRENCY_UNKNOWN');
    if (typeof amountRub !== 'number' || !Number.isFinite(amountRub) || amountRub < 0) {
      throw new BadRequestException('EXPORT_MEASURE_INVALID:amountRub');
    }
    return { amount: Math.round((amountRub / rate) * 100) / 100, currency: toCurrency, rate };
  }

  async getCustomsDeclarationStatus(dtNumber: string) {
    const adapter = integrationRegistry.get<MockFtsAdapter>('FTS');
    return adapter.getDeclarationStatus(dtNumber);
  }

  async submitCustomsDeclaration(data: {
    goodsDescription: string;
    tnvedCode: string;
    totalValueRub: number;
  }) {
    const adapter = integrationRegistry.get<MockFtsAdapter>('FTS');
    return adapter.submitDeclaration(data);
  }

  async applyForPhytoCertificate(data: {
    culture: string;
    volumeTons: number;
    producerInn: string;
    destinationCountry: string;
  }) {
    const adapter = integrationRegistry.get<MockRshnAdapter>('RSHN');
    return adapter.applyForCertificate(data);
  }

  async getPhytoCertificateStatus(certId: string) {
    const adapter = integrationRegistry.get<MockRshnAdapter>('RSHN');
    return adapter.getCertificateStatus(certId);
  }

  async listPhytoCertificates(producerInn: string) {
    const adapter = integrationRegistry.get<MockRshnAdapter>('RSHN');
    return adapter.listActiveCertificates(producerInn);
  }

  async checkSanctionedCountry(country: string) {
    const adapter = integrationRegistry.get<MockFtsAdapter>('FTS');
    return adapter.getSanctionList(country);
  }

  async getVesselPosition(mmsi: string) {
    const marine = integrationRegistry.get<MockMarineAdapter>('MARINE_TRAFFIC');
    return marine.getVesselPosition(mmsi);
  }

  async searchVessels(query: string, type?: string) {
    const marine = integrationRegistry.get<MockMarineAdapter>('MARINE_TRAFFIC');
    return marine.searchVessels(query, type as any);
  }

  async getVesselRoute(mmsi: string) {
    const marine = integrationRegistry.get<MockMarineAdapter>('MARINE_TRAFFIC');
    return marine.getVesselRoute(mmsi);
  }

  async getVesselPortCalls(mmsi: string) {
    const marine = integrationRegistry.get<MockMarineAdapter>('MARINE_TRAFFIC');
    return marine.getPortCalls(mmsi);
  }
}
