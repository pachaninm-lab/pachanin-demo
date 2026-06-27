import { IntegrationAdapter, HealthStatus } from '../adapter.interface';

export type SmevServiceType =
  | 'FNS_INN_VERIFY'           // ФНС: проверка ИНН / ОГРН
  | 'FNS_EGRUL'                // ФНС: выписка из ЕГРЮЛ / ЕГРИП
  | 'ROSREESTR_LAND'           // Росреестр: кадастровые данные (земля)
  | 'MFC_DOCUMENT_STATUS'      // МФЦ: статус заявления
  | 'FSIS_LICENSING'           // ФСИС: лицензии и допуски
  | 'GOSUSLUGI_IDENTITY';      // Госуслуги: идентификация физлица

export type SmevRequestStatus = 'ACCEPTED' | 'PROCESSING' | 'COMPLETED' | 'REJECTED' | 'ERROR';

export interface SmevRequest {
  id: string;
  service: SmevServiceType;
  requestedAt: string;
  status: SmevRequestStatus;
  payload: Record<string, unknown>;
}

export interface SmevResponse {
  requestId: string;
  service: SmevServiceType;
  status: SmevRequestStatus;
  completedAt?: string;
  data?: Record<string, unknown>;
  errorCode?: string;
  errorMessage?: string;
}

export interface EgrulRecord {
  inn: string;
  ogrn: string;
  kpp?: string;
  fullName: string;
  shortName?: string;
  status: 'ACTIVE' | 'LIQUIDATED' | 'REORGANIZING';
  registrationDate: string;
  address: string;
  directorName?: string;
  authorizedCapitalKopecks?: number;
  okved: string;
  okvedDescription: string;
}

export class MockSmevAdapter implements IntegrationAdapter {
  readonly name = 'SMEV';
  readonly version = '3.0.0';
  readonly mode = 'mock' as const;
  private readonly requests = new Map<string, SmevRequest>();
  private counter = 0;

  async execute(request: {
    action: 'sendRequest' | 'getResponse' | 'verifyInn' | 'getEgrul' | 'checkLicense';
    [key: string]: unknown;
  }): Promise<unknown> {
    switch (request.action) {
      case 'sendRequest':
        return this.sendRequest(request.service as SmevServiceType, request.payload as Record<string, unknown>);
      case 'getResponse':
        return this.getResponse(request.requestId as string);
      case 'verifyInn':
        return this.verifyInn(request.inn as string, request.ogrn as string | undefined);
      case 'getEgrul':
        return this.getEgrul(request.inn as string);
      case 'checkLicense':
        return this.checkLicense(request.inn as string, request.licenseType as string);
      default:
        throw new Error(`Unknown SMEV action: ${(request as { action: string }).action}`);
    }
  }

  async sendRequest(service: SmevServiceType, payload: Record<string, unknown>): Promise<SmevRequest> {
    const id = `smev-${String(++this.counter).padStart(8, '0')}`;
    const req: SmevRequest = {
      id,
      service,
      requestedAt: new Date().toISOString(),
      status: 'ACCEPTED',
      payload,
    };
    this.requests.set(id, req);
    // Simulate async processing
    setTimeout(() => {
      const r = this.requests.get(id);
      if (r) r.status = 'COMPLETED';
    }, 150);
    return { ...req };
  }

  async getResponse(requestId: string): Promise<SmevResponse> {
    const req = this.requests.get(requestId);
    if (!req) {
      return { requestId, service: 'FNS_INN_VERIFY', status: 'ERROR', errorCode: 'NOT_FOUND', errorMessage: 'Request not found' };
    }
    if (req.status !== 'COMPLETED') {
      return { requestId, service: req.service, status: req.status };
    }
    const data = await this.buildResponseData(req.service, req.payload);
    return { requestId, service: req.service, status: 'COMPLETED', completedAt: new Date().toISOString(), data };
  }

  private async buildResponseData(service: SmevServiceType, payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    switch (service) {
      case 'FNS_INN_VERIFY':
        return { valid: true, inn: payload.inn, registeredAt: '2015-03-14', status: 'ACTIVE' };
      case 'FNS_EGRUL':
        return (await this.getEgrul(payload.inn as string)) as unknown as Record<string, unknown>;
      case 'ROSREESTR_LAND':
        return { cadastralNumber: payload.cadastralNumber ?? 'unknown', area: 1500.0, category: 'AGRICULTURAL', permitted: 'CROP_PRODUCTION', owner: 'ООО Агро' };
      case 'MFC_DOCUMENT_STATUS':
        return { applicationId: payload.applicationId, status: 'ISSUED', issuedAt: new Date().toISOString() };
      case 'FSIS_LICENSING':
        return { inn: payload.inn, licenses: [{ type: payload.licenseType, number: 'ЛЦ-0012345', validUntil: '2027-12-31', status: 'ACTIVE' }] };
      case 'GOSUSLUGI_IDENTITY':
        return { snils: payload.snils, verified: true, fullName: 'Иванов Иван Иванович' };
      default:
        return {};
    }
  }

  async verifyInn(inn: string, ogrn?: string): Promise<{ valid: boolean; inn: string; ogrn?: string; status: string; errorCode?: string }> {
    // INN validation: 10 digits for org, 12 for individual
    const innValid = /^\d{10}$/.test(inn) || /^\d{12}$/.test(inn);
    if (!innValid) {
      return { valid: false, inn, status: 'INVALID_FORMAT', errorCode: 'INN_FORMAT_ERROR' };
    }
    return { valid: true, inn, ogrn, status: 'ACTIVE' };
  }

  async getEgrul(inn: string): Promise<EgrulRecord | null> {
    if (!/^\d{10}$/.test(inn) && !/^\d{12}$/.test(inn)) return null;
    const seed = inn.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    const crops = ['пшеница', 'ячмень', 'кукуруза', 'подсолнечник', 'соя'];
    const regions = ['Краснодарский край', 'Ростовская область', 'Ставропольский край', 'Воронежская область'];
    return {
      inn,
      ogrn: `1${inn}01`,
      kpp: `${inn.slice(0, 4)}01001`,
      fullName: `Общество с ограниченной ответственностью "АгроТрейд-${seed % 9000 + 1000}"`,
      shortName: `ООО "АгроТрейд-${seed % 9000 + 1000}"`,
      status: 'ACTIVE',
      registrationDate: '2014-07-15',
      address: `${regions[seed % regions.length]}, г. ${seed % 100 + 1}, ул. Зерновая, д. ${seed % 50 + 1}`,
      directorName: 'Петров Пётр Петрович',
      authorizedCapitalKopecks: (seed % 10 + 1) * 1_000_000_00,
      okved: '01.11',
      okvedDescription: `Выращивание ${crops[seed % crops.length]} и прочих зерновых культур`,
    };
  }

  async checkLicense(inn: string, licenseType: string): Promise<{ inn: string; licenseType: string; hasLicense: boolean; licenseNumber?: string; validUntil?: string }> {
    const seed = inn.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    const hasLicense = seed % 3 !== 0; // 2/3 of orgs have the license
    return {
      inn,
      licenseType,
      hasLicense,
      licenseNumber: hasLicense ? `ЛЦ-${String(seed % 900000 + 100000)}` : undefined,
      validUntil: hasLicense ? '2027-12-31' : undefined,
    };
  }

  async healthCheck(): Promise<HealthStatus> {
    return { status: 'ok', lastCheckedAt: new Date().toISOString(), detail: 'СМЭВ 3.0 mock adapter — sandbox mode' };
  }
}
