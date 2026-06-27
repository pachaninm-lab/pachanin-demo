import { Injectable, Logger } from '@nestjs/common';
import { integrationRegistry } from '../../../../../packages/integration-sdk/src/registry';
import type { MockFtsAdapter } from '../../../../../packages/integration-sdk/src/adapters/fts.adapter';
import type { MockRshnAdapter } from '../../../../../packages/integration-sdk/src/adapters/rshn.adapter';

export type IncotermsCode = 'EXW' | 'FCA' | 'CPT' | 'CIP' | 'DAP' | 'DPU' | 'DDP' | 'FAS' | 'FOB' | 'CFR' | 'CIF';
export type Currency = 'RUB' | 'USD' | 'EUR' | 'CNY';

// ЦБ РФ rates (mock — in production fetched daily from cbr.ru)
const CBR_RATES: Record<Currency, number> = {
  RUB: 1,
  USD: 89.5,
  EUR: 96.2,
  CNY: 12.3,
};

const INCOTERMS_RULES: Record<IncotermsCode, { risk: string; costIncludes: string[]; modes: string[] }> = {
  EXW: { risk: 'Переходит у продавца на складе', costIncludes: ['none'], modes: ['all'] },
  FCA: { risk: 'Переходит при передаче перевозчику', costIncludes: ['origin_charges'], modes: ['all'] },
  CPT: { risk: 'Переходит при передаче первому перевозчику', costIncludes: ['freight_to_dest'], modes: ['all'] },
  CIP: { risk: 'Переходит при передаче первому перевозчику', costIncludes: ['freight_to_dest', 'insurance'], modes: ['all'] },
  DAP: { risk: 'Переходит в месте назначения (без выгрузки)', costIncludes: ['freight_to_dest', 'destination_customs'], modes: ['all'] },
  DPU: { risk: 'Переходит после выгрузки в месте назначения', costIncludes: ['freight_to_dest', 'unloading', 'destination_customs'], modes: ['all'] },
  DDP: { risk: 'Переходит в месте назначения (с растаможкой)', costIncludes: ['freight_to_dest', 'destination_customs', 'import_duties'], modes: ['all'] },
  FAS: { risk: 'Переходит вдоль борта судна', costIncludes: ['inland_freight'], modes: ['sea', 'inland_waterway'] },
  FOB: { risk: 'Переходит на борту судна', costIncludes: ['inland_freight', 'loading'], modes: ['sea', 'inland_waterway'] },
  CFR: { risk: 'Переходит на борту в порту отгрузки', costIncludes: ['inland_freight', 'loading', 'ocean_freight'], modes: ['sea', 'inland_waterway'] },
  CIF: { risk: 'Переходит на борту в порту отгрузки', costIncludes: ['inland_freight', 'loading', 'ocean_freight', 'insurance'], modes: ['sea', 'inland_waterway'] },
};

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
    const rule = INCOTERMS_RULES[params.incoterms];
    const dist = params.distanceKm ?? 500;
    const weight = params.volumeTons ?? 1;

    let freightRub = 0;
    if (rule.costIncludes.some(c => c.includes('freight') || c === 'ocean_freight' || c === 'inland_freight' || c === 'loading')) {
      freightRub = Math.round(dist * weight * 350);
    }

    let insuranceRub = 0;
    if (rule.costIncludes.includes('insurance')) {
      const rate = (params.includeInsurancePct ?? 0.1) / 100;
      insuranceRub = Math.round(params.priceRub * rate);
    }

    const totalRub = params.priceRub + freightRub + insuranceRub;
    const rate = CBR_RATES[params.currency];
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
    return {
      rates: CBR_RATES,
      base: 'RUB',
      updatedAt: new Date().toISOString(),
      source: 'cbr.ru (mock)',
    };
  }

  convertCurrency(amountRub: number, toCurrency: Currency): { amount: number; currency: Currency; rate: number } {
    const rate = CBR_RATES[toCurrency];
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
}
