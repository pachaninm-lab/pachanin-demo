import { IntegrationAdapter, HealthStatus } from '../adapter.interface';

export type EtnStatus = 'DRAFT' | 'SIGNED' | 'SENT' | 'RECEIVED' | 'COMPLETED' | 'REJECTED';

export interface EtnCreateRequest {
  dealId: string;
  shipper: { name: string; inn: string; address: string };
  consignee: { name: string; inn: string; address: string };
  carrier: { name: string; inn: string };
  vehicleNumber: string;
  driverName: string;
  driverLicenseNumber: string;
  loadingAddress: string;
  unloadingAddress: string;
  cargoDescription: string;
  weightTons: number;
  volumeM3?: number;
  loadingDate: string;
  deliveryDatePlan: string;
}

export interface EtnDocument {
  id: string;
  etnNumber: string;
  status: EtnStatus;
  dealId: string;
  vehicleNumber: string;
  weightTons: number;
  createdAt: string;
  signedAt?: string;
  completedAt?: string;
}

export interface EtnSignRequest {
  etnId: string;
  signerRole: 'SHIPPER' | 'CARRIER' | 'CONSIGNEE';
  signatureBase64: string;
  certificateId: string;
}

export class MockGisEpdAdapter implements IntegrationAdapter {
  readonly name = 'GIS_EPD';
  readonly version = '1.2.0';
  readonly mode = 'mock' as const;

  private counter = 100;
  private readonly documents = new Map<string, EtnDocument>();

  async execute(request: {
    action: 'createEtn' | 'signEtn' | 'getEtnStatus' | 'listByDeal';
    [key: string]: unknown;
  }): Promise<unknown> {
    switch (request.action) {
      case 'createEtn':
        return this.createEtn(request as unknown as EtnCreateRequest);
      case 'signEtn':
        return this.signEtn(request as unknown as EtnSignRequest);
      case 'getEtnStatus':
        return this.getStatus(request.etnId as string);
      case 'listByDeal':
        return this.listByDeal(request.dealId as string);
      default:
        throw new Error(`Unknown ГИС ЭПД action: ${(request as { action: string }).action}`);
    }
  }

  async createEtn(req: EtnCreateRequest): Promise<EtnDocument> {
    const id = `etn-${Date.now()}-${++this.counter}`;
    const doc: EtnDocument = {
      id,
      etnNumber: `ЭТН-${new Date().getFullYear()}-${String(this.counter).padStart(8, '0')}`,
      status: 'DRAFT',
      dealId: req.dealId,
      vehicleNumber: req.vehicleNumber,
      weightTons: req.weightTons,
      createdAt: new Date().toISOString(),
    };
    this.documents.set(id, doc);
    return doc;
  }

  async signEtn(req: EtnSignRequest): Promise<EtnDocument> {
    const doc = this.documents.get(req.etnId);
    if (!doc) throw new Error(`ЭТН ${req.etnId} не найдена в ГИС ЭПД`);

    const signerOrder: EtnStatus[] = ['DRAFT', 'SIGNED', 'SENT', 'RECEIVED', 'COMPLETED'];
    const currentIdx = signerOrder.indexOf(doc.status);
    doc.status = signerOrder[Math.min(currentIdx + 1, signerOrder.length - 1)];

    if (doc.status === 'SIGNED') doc.signedAt = new Date().toISOString();
    if (doc.status === 'COMPLETED') doc.completedAt = new Date().toISOString();

    this.documents.set(req.etnId, doc);
    return doc;
  }

  async getStatus(etnId: string): Promise<EtnDocument> {
    const doc = this.documents.get(etnId);
    if (!doc) throw new Error(`ЭТН ${etnId} не найдена`);
    return doc;
  }

  async listByDeal(dealId: string): Promise<EtnDocument[]> {
    return Array.from(this.documents.values()).filter(d => d.dealId === dealId);
  }

  async healthCheck(): Promise<HealthStatus> {
    return { status: 'ok', lastCheckedAt: new Date().toISOString(), detail: 'ГИС ЭПД (Минтранс) mock — sandbox mode' };
  }
}
