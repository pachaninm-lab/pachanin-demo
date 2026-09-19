import { BaseMockAdapter } from '../adapter.interface';

export interface CustomsDeclaration {
  dtNumber: string;
  status: 'SUBMITTED' | 'UNDER_REVIEW' | 'ACCEPTED' | 'REJECTED' | 'RELEASED';
  goodsDescription: string;
  tnvedCode: string;
  totalValueRub: number;
  customsDutyRub?: number;
  submittedAt: string;
  updatedAt: string;
  errorCode?: string;
  errorMessage?: string;
}

export interface PhytoCertificate {
  certificateNumber: string;
  issueDate: string;
  expiryDate: string;
  culture: string;
  volume: number;
  destinationCountry: string;
  status: 'VALID' | 'EXPIRED' | 'REVOKED';
}

export interface FtsAdapter {
  getDeclarationStatus(dtNumber: string): Promise<CustomsDeclaration>;
  submitDeclaration(data: Omit<CustomsDeclaration, 'dtNumber' | 'status' | 'submittedAt' | 'updatedAt'>): Promise<{ dtNumber: string }>;
  getPhytoCertificate(certificateNumber: string): Promise<PhytoCertificate | null>;
  getSanctionList(country: string): Promise<{ sanctioned: boolean; listName?: string }>;
}

export class MockFtsAdapter extends BaseMockAdapter<unknown, unknown> implements FtsAdapter {
  readonly name = 'FTS';
  readonly version = '1.0.0';

  async execute(request: unknown): Promise<unknown> {
    return { mock: true, request };
  }

  async getDeclarationStatus(dtNumber: string): Promise<CustomsDeclaration> {
    return {
      dtNumber,
      status: 'ACCEPTED',
      goodsDescription: 'Пшеница мягкая 4 класса',
      tnvedCode: '1001990000',
      totalValueRub: 5000000,
      customsDutyRub: 0,
      submittedAt: new Date(Date.now() - 86400000).toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  async submitDeclaration(data: Omit<CustomsDeclaration, 'dtNumber' | 'status' | 'submittedAt' | 'updatedAt'>): Promise<{ dtNumber: string }> {
    return { dtNumber: `10130010/${new Date().toLocaleDateString('ru-RU').replace(/\./g, '')}/0${Math.floor(Math.random() * 900000 + 100000)}` };
  }

  async getPhytoCertificate(certificateNumber: string): Promise<PhytoCertificate | null> {
    return {
      certificateNumber,
      issueDate: new Date(Date.now() - 7 * 86400000).toISOString(),
      expiryDate: new Date(Date.now() + 23 * 86400000).toISOString(),
      culture: 'Пшеница',
      volume: 500,
      destinationCountry: 'EG',
      status: 'VALID',
    };
  }

  async getSanctionList(_country: string): Promise<{ sanctioned: boolean; listName?: string }> {
    return { sanctioned: false };
  }
}
