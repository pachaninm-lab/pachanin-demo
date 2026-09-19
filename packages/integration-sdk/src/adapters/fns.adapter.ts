import { BaseMockAdapter } from '../adapter.interface';

export interface FnsOrganizationInfo {
  inn: string;
  kpp?: string;
  ogrn: string;
  name: string;
  shortName?: string;
  status: 'ACTIVE' | 'LIQUIDATED' | 'RESTRUCTURING' | 'REORGANIZING';
  director: string;
  address: string;
  registeredAt: string;
  okved: string;
  okvedName: string;
}

export interface FnsTaxDebt {
  inn: string;
  hasDebt: boolean;
  debtAmountRub?: number;
  asOf: string;
}

export interface FnsAdapter {
  getOrganizationByInn(inn: string): Promise<FnsOrganizationInfo | null>;
  checkTaxDebt(inn: string): Promise<FnsTaxDebt>;
  validateBankAccount(bik: string, account: string): Promise<{ valid: boolean; bankName?: string }>;
}

export class MockFnsAdapter extends BaseMockAdapter<unknown, unknown> implements FnsAdapter {
  readonly name = 'FNS';
  readonly version = '1.0.0';

  async execute(request: unknown): Promise<unknown> {
    return { mock: true, request };
  }

  async getOrganizationByInn(inn: string): Promise<FnsOrganizationInfo | null> {
    if (inn.length !== 10 && inn.length !== 12) return null;
    return {
      inn,
      kpp: inn.length === 10 ? '770101001' : undefined,
      ogrn: '1027700132195',
      name: `ООО "Тестовая организация ${inn}"`,
      shortName: `ООО ТО-${inn.slice(-4)}`,
      status: 'ACTIVE',
      director: 'Иванов Иван Иванович',
      address: '115162, г. Москва, ул. Шаболовка, д. 31',
      registeredAt: '2010-01-15',
      okved: '01.11',
      okvedName: 'Выращивание пшеницы',
    };
  }

  async checkTaxDebt(inn: string): Promise<FnsTaxDebt> {
    return { inn, hasDebt: false, asOf: new Date().toISOString() };
  }

  async validateBankAccount(_bik: string, _account: string): Promise<{ valid: boolean; bankName?: string }> {
    return { valid: true, bankName: 'АО "Тестовый Банк"' };
  }
}
