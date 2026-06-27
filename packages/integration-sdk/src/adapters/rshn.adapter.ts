import { BaseMockAdapter } from '../adapter.interface';

export interface PhytosanitaryCertificate {
  id: string;
  culture: string;
  volumeTons: number;
  producerInn: string;
  destinationCountry: string;
  status: 'PENDING' | 'ISSUED' | 'REJECTED' | 'EXPIRED';
  certificateNumber?: string;
  issuedAt?: string;
  validUntil?: string;
  inspectorName?: string;
  rejectReason?: string;
}

export interface RshnAdapter {
  applyForCertificate(data: Omit<PhytosanitaryCertificate, 'id' | 'status'>): Promise<{ id: string }>;
  getCertificateStatus(id: string): Promise<PhytosanitaryCertificate>;
  listActiveCertificates(producerInn: string): Promise<PhytosanitaryCertificate[]>;
}

export class MockRshnAdapter extends BaseMockAdapter<unknown, unknown> implements RshnAdapter {
  readonly name = 'RSHN';
  readonly version = '1.0.0';

  private readonly certs = new Map<string, PhytosanitaryCertificate>();

  async execute(request: unknown): Promise<unknown> {
    return { mock: true, request };
  }

  async applyForCertificate(data: Omit<PhytosanitaryCertificate, 'id' | 'status'>): Promise<{ id: string }> {
    const id = `RSHN-${Date.now()}`;
    this.certs.set(id, { id, status: 'PENDING', ...data });
    setTimeout(() => {
      const cert = this.certs.get(id);
      if (cert) {
        cert.status = 'ISSUED';
        cert.certificateNumber = `RU-${id}`;
        cert.issuedAt = new Date().toISOString();
        cert.validUntil = new Date(Date.now() + 30 * 86400000).toISOString();
        cert.inspectorName = 'Петров П.П.';
      }
    }, 5000);
    return { id };
  }

  async getCertificateStatus(id: string): Promise<PhytosanitaryCertificate> {
    const cert = this.certs.get(id);
    if (!cert) throw new Error(`Certificate ${id} not found`);
    return cert;
  }

  async listActiveCertificates(producerInn: string): Promise<PhytosanitaryCertificate[]> {
    return Array.from(this.certs.values()).filter(
      c => c.producerInn === producerInn && c.status === 'ISSUED'
    );
  }
}
