import { DocumentsService } from './documents.service';

function makeRepo(doc: any, all: any[] = [doc]) {
  return {
    list: jest.fn().mockResolvedValue(all),
    getById: jest.fn().mockResolvedValue(doc),
    upload: jest.fn(),
    sign: jest.fn(),
    generateDealPackage: jest.fn(),
  } as any;
}

function makeRuntime(deal: any) {
  return { getDeal: jest.fn().mockReturnValue(deal) } as any;
}

const DOC = { id: 'DOC-1', dealId: 'DEAL-1', uploadedByUserId: 'user-lab-1', url: '/x', name: 'n', mimeType: 'application/pdf' };
const DEAL = { id: 'DEAL-1', sellerOrgId: 'org-seller', buyerOrgId: 'org-buyer' };

describe('DocumentsService object scope (H2 — IDOR/BOLA)', () => {
  it('denies a FARMER whose org is not a party to the document deal', async () => {
    const svc = new DocumentsService(makeRepo(DOC), {} as any, makeRuntime(DEAL));
    const outsider = { id: 'u1', role: 'FARMER', orgId: 'org-other' };
    await expect(svc.getOne('DOC-1', outsider)).rejects.toThrow(/Cross-organization access denied/);
    await expect(svc.streamContent('DOC-1', outsider)).rejects.toThrow(/Cross-organization access denied/);
    await expect(svc.getSignedAccess('DOC-1', outsider)).rejects.toThrow(/Cross-organization access denied/);
    await expect(svc.download('DOC-1', outsider)).rejects.toThrow(/Cross-organization access denied/);
  });

  it('allows a FARMER whose org is the seller party', async () => {
    const svc = new DocumentsService(makeRepo(DOC), {} as any, makeRuntime(DEAL));
    const seller = { id: 'u2', role: 'FARMER', orgId: 'org-seller' };
    await expect(svc.getOne('DOC-1', seller)).resolves.toMatchObject({ id: 'DOC-1' });
  });

  it('allows operational roles (LAB) across deals', async () => {
    const svc = new DocumentsService(makeRepo(DOC), {} as any, makeRuntime(DEAL));
    const lab = { id: 'u3', role: 'LAB', orgId: 'org-lab' };
    await expect(svc.getOne('DOC-1', lab)).resolves.toMatchObject({ id: 'DOC-1' });
  });

  it('list() hides other orgs documents from a party-scoped user', async () => {
    const own = { ...DOC, id: 'DOC-own', dealId: 'DEAL-own' };
    const foreign = { ...DOC, id: 'DOC-foreign', dealId: 'DEAL-foreign', uploadedByUserId: 'x' };
    const runtime = {
      getDeal: jest.fn((id: string) =>
        id === 'DEAL-own'
          ? { sellerOrgId: 'org-seller', buyerOrgId: 'org-buyer' }
          : { sellerOrgId: 'org-alien', buyerOrgId: 'org-alien2' },
      ),
    } as any;
    const svc = new DocumentsService(makeRepo(own, [own, foreign]), {} as any, runtime);
    const seller = { id: 'u2', role: 'FARMER', orgId: 'org-seller' };
    const visible = await svc.list(seller);
    expect(visible.map((d: any) => d.id)).toEqual(['DOC-own']);
  });
});
