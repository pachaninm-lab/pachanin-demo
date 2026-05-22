import { EvidencePackService } from './evidence-pack.service';

function makeService() {
  // PrismaService mock — always throws so service falls back to in-memory
  const prismaMock: any = {
    evidenceFile: {
      findFirst: jest.fn().mockRejectedValue(new Error('DB unavailable')),
      create: jest.fn().mockRejectedValue(new Error('DB unavailable')),
      findMany: jest.fn().mockRejectedValue(new Error('DB unavailable')),
    },
  };
  return new EvidencePackService(prismaMock);
}

describe('EvidencePackService', () => {
  let svc: EvidencePackService;

  beforeEach(() => { svc = makeService(); });

  it('uploads a file and returns a SHA-256 hash', async () => {
    const result = await svc.upload({
      dealId: 'DEAL-001',
      type: 'photo',
      filename: 'photo.jpg',
      mimeType: 'image/jpeg',
      content: Buffer.from('fake image bytes'),
    }, 'user-driver-1');

    expect(result.hash).toMatch(/^[a-f0-9]{64}$/);
    expect(result.id).toBeDefined();
  });

  it('stores fallback in-memory when DB is down', async () => {
    await svc.upload({ dealId: 'DEAL-001', type: 'weight_ticket', filename: 'w.pdf', mimeType: 'application/pdf', content: 'data' }, 'user-1');
    const { files } = await svc.listByDeal('DEAL-001');
    expect(files.length).toBeGreaterThan(0);
  });

  it('different content produces different hashes', async () => {
    const r1 = await svc.upload({ dealId: 'DEAL-002', type: 'photo', filename: 'a.jpg', mimeType: 'image/jpeg', content: 'aaa' }, 'u1');
    const r2 = await svc.upload({ dealId: 'DEAL-002', type: 'photo', filename: 'b.jpg', mimeType: 'image/jpeg', content: 'bbb' }, 'u1');
    expect(r1.hash).not.toBe(r2.hash);
  });

  it('lists evidence by deal', async () => {
    await svc.upload({ dealId: 'DEAL-003', type: 'lab_protocol', filename: 'p.pdf', mimeType: 'application/pdf', content: 'protocol' }, 'u1');
    await svc.upload({ dealId: 'DEAL-003', type: 'signature', filename: 's.png', mimeType: 'image/png', content: 'sig' }, 'u2');
    const { files } = await svc.listByDeal('DEAL-003');
    expect(files).toHaveLength(2);
  });

  it('filters evidence by disputeId', async () => {
    await svc.upload({ dealId: 'DEAL-004', disputeId: 'DSP-001', type: 'photo', filename: 'x.jpg', mimeType: 'image/jpeg', content: 'x' }, 'u1');
    await svc.upload({ dealId: 'DEAL-004', type: 'photo', filename: 'y.jpg', mimeType: 'image/jpeg', content: 'y' }, 'u1');
    const files = await svc.listByDispute('DSP-001');
    expect(files).toHaveLength(1);
    expect((files[0] as any).disputeId).toBe('DSP-001');
  });

  it('verifyDealChain returns false and 0 files when DB is unavailable', async () => {
    const result = await svc.verifyDealChain('DEAL-999');
    expect(result.valid).toBe(false);
    expect(result.totalFiles).toBe(0);
  });

  it('sha-256 of same content is deterministic', async () => {
    const content = 'deterministic-content-123';
    const r1 = await svc.upload({ dealId: 'DEAL-D1', type: 'document', filename: 'f.txt', mimeType: 'text/plain', content }, 'u');
    const r2 = await svc.upload({ dealId: 'DEAL-D2', type: 'document', filename: 'f.txt', mimeType: 'text/plain', content }, 'u');
    expect(r1.hash).toBe(r2.hash);
  });
});
