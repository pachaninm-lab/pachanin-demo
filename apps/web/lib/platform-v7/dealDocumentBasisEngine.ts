export type DealDocumentStatus = 'draft' | 'ready' | 'review' | 'hold';
export type SettlementBasisStatus = 'not_ready' | 'review_required' | 'ready_for_bank_review';

export type DealDocumentItem = Readonly<{
  id: string;
  label: string;
  source: string;
  status: DealDocumentStatus;
  requiredForSettlement: boolean;
}>;

export type SettlementBasisCheck = Readonly<{
  key: string;
  label: string;
  status: 'ok' | 'review' | 'hold';
  owner: string;
}>;

/**
 * Type-only compatibility contract retained for historical imports.
 * Runtime release-document readiness is calculated from the canonical Deal
 * workspace by `buildDocumentBasisProjection`; this module must never export
 * fixtures, money calculations, route decisions, or bank-readiness logic.
 */
export type DealDocumentBasisState = Readonly<{
  dealId: string;
  routeId: string;
  lotNumber: string;
  sdizNumber: string;
  sellerName: string;
  buyerName: string;
  amountRub: number;
  settlementBasisStatus: SettlementBasisStatus;
  documents: readonly DealDocumentItem[];
  checks: readonly SettlementBasisCheck[];
  nextRoutes: ReadonlyArray<Readonly<{
    label: string;
    href: string;
    owner: string;
  }>>;
}>;
