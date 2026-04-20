import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

export type DealStatus =
  | 'DRAFT'
  | 'AWAITING_SIGN'
  | 'SIGNED'
  | 'PREPAYMENT_RESERVED'
  | 'LOADING'
  | 'IN_TRANSIT'
  | 'ARRIVED'
  | 'QUALITY_CHECK'
  | 'ACCEPTED'
  | 'FINAL_PAYMENT'
  | 'SETTLED'
  | 'CLOSED'
  | 'DISPUTE_OPEN'
  | 'EXPERTISE'
  | 'ARBITRATION_DECISION'
  | 'PARTIAL_SETTLEMENT'
  | 'CANCELLATION';

type PaymentStatus =
  | 'PENDING'
  | 'REQUIRES_BANK'
  | 'RESERVE_PENDING'
  | 'RESERVED'
  | 'HOLD_ACTIVE'
  | 'PARTIAL_RELEASE_ALLOWED'
  | 'PARTIAL_RELEASED'
  | 'READY_FOR_RELEASE'
  | 'CALLBACK_PENDING'
  | 'MISMATCH'
  | 'MANUAL_REVIEW'
  | 'RELEASED'
  | 'REFUND_PENDING'
  | 'REFUNDED';

type ShipmentStatus = 'PENDING' | 'IN_TRANSIT' | 'AT_UNLOADING' | 'DELIVERED' | 'COMPLETED' | 'CANCELLED' | 'ROUTE_DEVIATION_ALERT';
type SampleStatus = 'PENDING' | 'COLLECTED' | 'ANALYSIS_IN_PROGRESS' | 'FINALIZED' | 'ANALYZED';

@Injectable()
export class RuntimeCoreService {
  private dealCounter = 100;
  private docCounter = 100;
  private shipmentCounter = 100;
  private checkpointCounter = 100;
  private sampleCounter = 100;
  private testCounter = 100;
  private paymentCounter = 100;
  private eventCounter = 100;
  private callbackCounter = 100;
  private evidenceCounter = 100;

  private readonly deals: any[] = [
    {
      id: 'DEAL-001',
      lotId: 'LOT-001',
      winnerBidId: 'BID-001',
      status: 'IN_TRANSIT' as DealStatus,
      sellerOrgId: 'org-farmer-1',
      buyerOrgId: 'org-buyer-1',
      volumeTons: 500,
      pricePerTon: 12750,
      totalRub: 6375000,
      currency: 'RUB',
      region: 'Тамбовская область',
      culture: 'wheat',
      createdAt: '2026-03-22T10:00:00Z',
      signedAt: '2026-03-25T12:00:00Z',
      updatedAt: '2026-03-28T12:00:00Z',
      fundingChoice: 'BANK',
      owner: 'Логист',
      slaAt: '2026-03-28T19:00:00Z',
      nextAction: 'Подтвердить прибытие и открыть приёмку',
      paymentTerms: { mode: 'safe-deals', releaseModel: 'event-based' },
    },
    {
      id: 'DEAL-002',
      lotId: 'LOT-003',
      winnerBidId: 'BID-003',
      status: 'QUALITY_CHECK' as DealStatus,
      sellerOrgId: 'org-farmer-1',
      buyerOrgId: 'org-buyer-2',
      volumeTons: 750,
      pricePerTon: 11500,
      totalRub: 8625000,
      currency: 'RUB',
      region: 'Краснодарский край',
      culture: 'corn',
      createdAt: '2026-03-18T10:00:00Z',
      signedAt: '2026-03-20T09:00:00Z',
      updatedAt: '2026-04-02T10:00:00Z',
      fundingChoice: 'OWN_FUNDS',
      owner: 'Лаборатория',
      slaAt: '2026-04-02T18:00:00Z',
      nextAction: 'Финализировать протокол качества',
      paymentTerms: { mode: 'safe-deals', releaseModel: 'final-after-quality' },
    },
    {
      id: 'DEAL-003',
      lotId: 'LOT-002',
      winnerBidId: 'BID-002',
      status: 'SIGNED' as DealStatus,
      sellerOrgId: 'org-farmer-2',
      buyerOrgId: 'org-buyer-1',
      volumeTons: 300,
      pricePerTon: 11000,
      totalRub: 3300000,
      currency: 'RUB',
      region: 'Воронежская область',
      culture: 'barley',
      createdAt: '2026-04-01T10:00:00Z',
      updatedAt: '2026-04-01T10:00:00Z',
      fundingChoice: 'MIXED',
      owner: 'Банк',
      slaAt: '2026-04-01T16:00:00Z',
      nextAction: 'Подтвердить резерв',
      paymentTerms: { mode: 'safe-deals', releaseModel: 'partial-then-final' },
    },
  ];

  private readonly documents: any[] = [
    { id: 'DOC-001', dealId: 'DEAL-001', type: 'contract', status: 'SIGNED', name: 'Договор купли-продажи №DEAL-001', signedAt: '2026-03-25T12:00:00Z', uploadedAt: '2026-03-24T10:00:00Z', uploadedByUserId: 'user-farmer-1', mimeType: 'application/pdf', url: '/documents/DOC-001/content', version: 1, bankRequired: true, releaseRequired: true, bankAcceptance: 'ACCEPTED' },
    { id: 'DOC-002', dealId: 'DEAL-001', type: 'transport_waybill', status: 'SIGNED', name: 'ТТН №001', signedAt: '2026-03-28T08:00:00Z', uploadedAt: '2026-03-28T07:30:00Z', uploadedByUserId: 'user-logistician-1', mimeType: 'application/pdf', url: '/documents/DOC-002/content', version: 1, bankRequired: true, releaseRequired: true, bankAcceptance: 'ACCEPTED' },
    { id: 'DOC-003', dealId: 'DEAL-002', type: 'quality_certificate', status: 'GENERATED', name: 'Сертификат качества DEAL-002', uploadedAt: '2026-04-02T09:00:00Z', uploadedByUserId: 'user-lab-1', mimeType: 'application/pdf', url: '/documents/DOC-003/content', version: 1, bankRequired: true, releaseRequired: true, bankAcceptance: 'PENDING' },
    { id: 'DOC-004', dealId: 'DEAL-003', type: 'contract', status: 'DRAFT', name: 'Договор купли-продажи №DEAL-003', uploadedAt: '2026-04-01T10:30:00Z', uploadedByUserId: 'user-farmer-2', mimeType: 'application/pdf', url: '/documents/DOC-004/content', version: 1, bankRequired: true, releaseRequired: true, bankAcceptance: 'PENDING' },
  ];

  private readonly shipments: any[] = [
    {
      id: 'SHIP-001',
      dealId: 'DEAL-001',
      status: 'IN_TRANSIT' as ShipmentStatus,
      driverUserId: 'user-driver-1',
      driverName: 'Иванов Петр',
      vehicleNumber: 'А123ВС68',
      carrierOrgId: 'prov-log-1',
      carrierName: 'ТамбовЛогистик',
      routeFrom: 'Тамбов',
      routeTo: 'Воронеж',
      etaHours: 4,
      loadedTons: 500,
      createdAt: '2026-03-28T06:00:00Z',
      checkpoints: [
        { id: 'CP-001', type: 'LOADING', completedAt: '2026-03-28T08:00:00Z', lat: 52.72, lng: 41.45 },
        { id: 'CP-002', type: 'CHECKPOINT_1', completedAt: '2026-03-28T12:00:00Z', lat: 52.1, lng: 42.0 },
      ],
      handoff: { receiving: false, lab: false },
      pinVerified: false,
    },
    {
      id: 'SHIP-002',
      dealId: 'DEAL-002',
      status: 'AT_UNLOADING' as ShipmentStatus,
      driverUserId: 'user-driver-2',
      driverName: 'Петров Сергей',
      vehicleNumber: 'В456КМ23',
      carrierOrgId: 'prov-log-2',
      carrierName: 'ЦЧР АгроТранс',
      routeFrom: 'Краснодар',
      routeTo: 'Ростов-на-Дону',
      etaHours: 0,
      loadedTons: 750,
      createdAt: '2026-04-01T06:00:00Z',
      checkpoints: [],
      handoff: { receiving: true, lab: true },
      pinVerified: true,
    },
  ];

  private readonly samples: any[] = [
    {
      id: 'SAMPLE-001',
      dealId: 'DEAL-001',
      shipmentId: 'SHIP-001',
      status: 'ANALYZED' as SampleStatus,
      collectedAt: '2026-03-30T08:00:00Z',
      culture: 'wheat',
      tests: [
        { id: 'T-001', parameter: 'moisture', value: 15.2, unit: '%', norm: '<=13', passed: false, recordedAt: '2026-03-30T10:00:00Z' },
        { id: 'T-002', parameter: 'protein', value: 12.1, unit: '%', norm: '>=11', passed: true, recordedAt: '2026-03-30T10:30:00Z' },
      ],
      protocol: 'PROT-001',
      finalizedAt: '2026-03-30T12:00:00Z',
      labId: 'prov-lab-1',
      custodyEvents: [
        { id: 'CUST-001', type: 'COLLECTED', at: '2026-03-30T08:00:00Z', by: 'user-lab-1' },
        { id: 'CUST-002', type: 'SEALED', at: '2026-03-30T08:10:00Z', by: 'user-lab-1' },
      ],
      moneyDeltaRub: -250000,
    },
    {
      id: 'SAMPLE-002',
      dealId: 'DEAL-002',
      status: 'COLLECTED' as SampleStatus,
      collectedAt: '2026-04-02T09:00:00Z',
      culture: 'corn',
      tests: [],
      labId: 'prov-lab-1',
      custodyEvents: [{ id: 'CUST-003', type: 'COLLECTED', at: '2026-04-02T09:00:00Z', by: 'user-lab-1' }],
      moneyDeltaRub: 0,
    },
  ];

  private readonly payments: any[] = [
    {
      id: 'PAY-001',
      dealId: 'DEAL-001',
      status: 'HOLD_ACTIVE' as PaymentStatus,
      amountRub: 6375000,
      reservedRub: 6375000,
      releasedRub: 0,
      disputedAmountRub: 250000,
      undisputedAmountRub: 6125000,
      holdReason: 'Ожидание приёмки и callback банка',
      reasonCode: 'QUALITY_HOLD',
      callbackState: 'PENDING',
      createdAt: '2026-03-25T12:00:00Z',
      beneficiaries: ['BEN-001', 'BEN-002'],
      bankEventId: 'BANK-EVT-001',
      manualReviewRequired: false,
      releaseJournal: [],
      callbacks: [],
    },
    {
      id: 'PAY-002',
      dealId: 'DEAL-002',
      status: 'READY_FOR_RELEASE' as PaymentStatus,
      amountRub: 8625000,
      reservedRub: 8625000,
      releasedRub: 0,
      disputedAmountRub: 0,
      undisputedAmountRub: 8625000,
      reasonCode: 'DOCS_COMPLETE',
      callbackState: 'CONFIRMED',
      createdAt: '2026-03-20T09:00:00Z',
      beneficiaries: ['BEN-003'],
      bankEventId: 'BANK-EVT-002',
      manualReviewRequired: false,
      releaseJournal: [],
      callbacks: [],
    },
    {
      id: 'PAY-003',
      dealId: 'DEAL-003',
      status: 'RESERVE_PENDING' as PaymentStatus,
      amountRub: 3300000,
      reservedRub: 0,
      releasedRub: 0,
      disputedAmountRub: 0,
      undisputedAmountRub: 3300000,
      callbackState: 'NOT_SENT',
      createdAt: '2026-04-01T10:00:00Z',
      beneficiaries: ['BEN-004'],
      bankEventId: 'BANK-EVT-003',
      manualReviewRequired: false,
      releaseJournal: [],
      callbacks: [],
    },
  ];

  private readonly beneficiaries: any[] = [
    { id: 'BEN-001', dealId: 'DEAL-001', role: 'SELLER', name: 'КФХ Тамбов', payoutRoute: 'bank-account', bankStatus: 'VERIFIED' },
    { id: 'BEN-002', dealId: 'DEAL-001', role: 'CARRIER', name: 'ТамбовЛогистик', payoutRoute: 'sbp-b2c', bankStatus: 'VERIFIED' },
    { id: 'BEN-003', dealId: 'DEAL-002', role: 'SELLER', name: 'АгроЮг', payoutRoute: 'bank-account', bankStatus: 'VERIFIED' },
    { id: 'BEN-004', dealId: 'DEAL-003', role: 'SELLER', name: 'Зерно Центр', payoutRoute: 'bank-account', bankStatus: 'PENDING' },
  ];

  private readonly bankCallbacks: any[] = [
    { id: 'CB-001', dealId: 'DEAL-002', paymentId: 'PAY-002', eventType: 'reserve_confirmed', status: 'SUCCESS', receivedAt: '2026-03-20T10:00:00Z' },
  ];

  private readonly moneyEvents: any[] = [
    { id: 'ME-001', dealId: 'DEAL-001', paymentId: 'PAY-001', type: 'RESERVE_REQUESTED', amountRub: 6375000, createdAt: '2026-03-25T12:10:00Z' },
    { id: 'ME-002', dealId: 'DEAL-002', paymentId: 'PAY-002', type: 'RESERVE_CONFIRMED', amountRub: 8625000, createdAt: '2026-03-20T10:00:00Z' },
  ];

  private readonly evidence: any[] = [
    { id: 'EV-001', dealId: 'DEAL-001', shipmentId: 'SHIP-001', source: 'gps', class: 'checkpoint', createdAt: '2026-03-28T12:00:00Z', note: 'Checkpoint 1' },
    { id: 'EV-002', dealId: 'DEAL-001', documentId: 'DOC-002', source: 'document', class: 'transport_waybill', createdAt: '2026-03-28T07:30:00Z', note: 'ТТН загружена' },
    { id: 'EV-003', dealId: 'DEAL-001', sampleId: 'SAMPLE-001', source: 'lab', class: 'quality_protocol', createdAt: '2026-03-30T12:00:00Z', note: 'Протокол PROT-001' },
  ];

  listDeals(user: any) {
    const role = user?.role;
    const orgId = user?.orgId;
    if (role === 'FARMER') return this.deals.filter((d) => d.sellerOrgId === orgId).map((deal) => this.decorateDealCard(deal));
    if (role === 'BUYER') return this.deals.filter((d) => d.buyerOrgId === orgId).map((deal) => this.decorateDealCard(deal));
    return this.deals.map((deal) => this.decorateDealCard(deal));
  }

  getDeal(id: string) {
    return this.decorateDealCard(this.findDeal(id));
  }

  createDeal(dto: any, user: any) {
    const id = `DEAL-${String(++this.dealCounter).padStart(3, '0')}`;
    const deal = {
      id,
      lotId: dto.lotId,
      winnerBidId: dto.winnerBidId,
      status: 'DRAFT' as DealStatus,
      sellerOrgId: user?.orgId || 'demo-org',
      buyerOrgId: dto.buyerOrgId || 'demo-buyer-org',
      volumeTons: 0,
      pricePerTon: 0,
      totalRub: 0,
      currency: 'RUB',
      region: '',
      culture: '',
      paymentTerms: dto.paymentTerms ?? {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      fundingChoice: dto?.paymentTerms?.fundingChoice ?? 'OWN_FUNDS',
      owner: 'Коммерция',
      slaAt: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
      nextAction: 'Заполнить параметры сделки',
    };
    this.deals.push(deal);
    this.ensurePayment(id);
    return this.decorateDealCard(deal);
  }

  transitionDeal(id: string, nextState: string, user: any, comment?: string) {
    const deal = this.findDeal(id);
    this.assertAllowedTransition(deal.status, nextState);
    deal.status = nextState as DealStatus;
    deal.updatedAt = new Date().toISOString();
    if (nextState === 'SIGNED' && !deal.signedAt) deal.signedAt = deal.updatedAt;
    if (comment) deal.lastComment = comment;
    deal.lastChangedBy = user?.sub ?? user?.id ?? null;
    this.refreshDealRuntime(id);
    return this.decorateDealCard(deal);
  }

  dealWorkspace(id: string) {
    const deal = this.findDeal(id);
    this.refreshDealRuntime(id);
    const payment = this.ensurePayment(id);
    const completeness = this.documentCompleteness(id);
    const shipments = this.shipments.filter((s) => s.dealId === id);
    const samples = this.samples.filter((s) => s.dealId === id);
    const evidence = this.evidence.filter((e) => e.dealId === id);
    return {
      ...this.decorateDealCard(deal),
      timeline: this.dealTimeline(id),
      documents: this.documents.filter((d) => d.dealId === id),
      shipments,
      samples,
      payment,
      moneyImpact: this.moneyImpact(id),
      blockers: this.resolveBlockers(id),
      nextAction: this.resolveNextAction(id),
      owner: deal.owner,
      slaAt: deal.slaAt,
      completeness,
      evidence,
      bankWorkspace: this.bankWorkspace(id),
    };
  }

  dealPassport(id: string) {
    const deal = this.findDeal(id);
    const payment = this.ensurePayment(id);
    return {
      id: deal.id,
      status: deal.status,
      parties: {
        seller: { orgId: deal.sellerOrgId },
        buyer: { orgId: deal.buyerOrgId },
      },
      metrics: {
        volumeTons: deal.volumeTons,
        pricePerTon: deal.pricePerTon,
        totalRub: deal.totalRub,
        currency: deal.currency,
      },
      lot: { id: deal.lotId, culture: deal.culture, region: deal.region },
      money: {
        status: payment.status,
        amountRub: payment.amountRub,
        disputedAmountRub: payment.disputedAmountRub,
        undisputedAmountRub: payment.undisputedAmountRub,
        bankEventId: payment.bankEventId,
      },
      dates: { createdAt: deal.createdAt, signedAt: deal.signedAt ?? null, updatedAt: deal.updatedAt ?? null },
    };
  }

  dealTimeline(id: string) {
    const deal = this.findDeal(id);
    const statuses = ['DRAFT','AWAITING_SIGN','SIGNED','PREPAYMENT_RESERVED','LOADING','IN_TRANSIT','ARRIVED','QUALITY_CHECK','ACCEPTED','FINAL_PAYMENT','SETTLED','CLOSED'];
    const currentIdx = Math.max(statuses.indexOf(deal.status), 0);
    return statuses.slice(0, currentIdx + 1).map((status, idx) => ({
      status,
      label: status,
      timestamp: new Date(new Date(deal.createdAt).getTime() + idx * 2 * 60 * 60 * 1000).toISOString(),
      actor: idx === currentIdx ? deal.owner : 'system',
    }));
  }

  listDocuments() {
    return this.documents.map((doc) => ({
      ...doc,
      completeness: this.documentCompleteness(doc.dealId),
    }));
  }

  getDocument(id: string) {
    const doc = this.findDocument(id);
    return {
      ...doc,
      correctionRequired: doc.status === 'DRAFT' || doc.status === 'REJECTED',
      completeness: this.documentCompleteness(doc.dealId),
    };
  }

  uploadDocument(file: any, dto: any, user: any) {
    const id = `DOC-${String(++this.docCounter).padStart(3, '0')}`;
    const doc = {
      id,
      dealId: dto?.dealId ?? null,
      type: dto?.type ?? 'other',
      status: 'UPLOADED',
      name: dto?.name ?? file?.originalname ?? `Document ${id}`,
      uploadedAt: new Date().toISOString(),
      uploadedByUserId: user?.sub ?? user?.id ?? null,
      mimeType: file?.mimetype ?? dto?.mimeType ?? 'application/octet-stream',
      url: `/documents/${id}/content`,
      size: file?.size ?? null,
      version: 1,
      bankRequired: this.requiredDocTypes().includes(dto?.type ?? 'other'),
      releaseRequired: this.requiredDocTypes().includes(dto?.type ?? 'other'),
      bankAcceptance: 'PENDING',
      rejectionReason: null,
    };
    this.documents.push(doc);
    this.appendEvidence({ dealId: doc.dealId, documentId: doc.id, source: 'document', class: doc.type, note: `${doc.name} загружен` });
    if (doc.dealId) this.refreshDealRuntime(doc.dealId);
    return this.getDocument(id);
  }

  signDocument(id: string, user: any) {
    const doc = this.findDocument(id);
    doc.status = 'SIGNED';
    doc.signedAt = new Date().toISOString();
    doc.signedByUserId = user?.sub ?? user?.id ?? null;
    doc.bankAcceptance = 'ACCEPTED';
    this.appendEvidence({ dealId: doc.dealId, documentId: doc.id, source: 'document', class: 'signed_document', note: `${doc.name} подписан` });
    this.refreshDealRuntime(doc.dealId);
    return this.getDocument(id);
  }

  generateDealPackage(dealId: string, user: any) {
    const generated = ['contract', 'quality_certificate', 'transport_waybill', 'acceptance_act'].map((type) => {
      const id = `DOC-${String(++this.docCounter).padStart(3, '0')}`;
      const doc = {
        id,
        dealId,
        type,
        status: 'GENERATED',
        name: `${type} для ${dealId}`,
        uploadedAt: new Date().toISOString(),
        uploadedByUserId: user?.sub ?? user?.id ?? null,
        mimeType: 'application/pdf',
        url: `/documents/${id}/content`,
        version: 1,
        bankRequired: true,
        releaseRequired: true,
        bankAcceptance: 'PENDING',
      };
      this.documents.push(doc);
      return doc;
    });
    this.refreshDealRuntime(dealId);
    return { dealId, generated, completeness: this.documentCompleteness(dealId) };
  }

  listShipments() {
    return this.shipments.map((shipment) => ({
      ...shipment,
      blockers: this.resolveShipmentBlockers(shipment.id),
    }));
  }

  getShipment(id: string) {
    const shipment = this.findShipment(id);
    return {
      ...shipment,
      blockers: this.resolveShipmentBlockers(id),
      evidence: this.evidence.filter((e) => e.shipmentId === id),
    };
  }

  shipmentWorkspace(id: string) {
    const shipment = this.findShipment(id);
    return {
      shipment: this.getShipment(id),
      availableTransitions: this.getAvailableShipmentTransitions(shipment.status),
      checkpoints: shipment.checkpoints,
      handoff: shipment.handoff,
      evidence: this.evidence.filter((e) => e.shipmentId === id),
      nextAction: shipment.status === 'AT_UNLOADING' ? 'Открыть приёмку' : 'Продолжить исполнение рейса',
    };
  }

  createShipment(dto: any, user: any) {
    const id = `SHIP-${String(++this.shipmentCounter).padStart(3, '0')}`;
    const shipment = {
      id,
      dealId: dto.dealId,
      status: 'PENDING' as ShipmentStatus,
      carrierOrgId: dto.carrierOrgId ?? null,
      driverUserId: dto.driverUserId ?? null,
      driverName: dto.driverName ?? null,
      vehicleNumber: dto.vehicleNumber,
      trailerNumber: dto.trailerNumber ?? null,
      routeFrom: dto.fromAddress ?? null,
      routeTo: dto.toAddress ?? null,
      plannedLoadAt: dto.plannedLoadAt,
      plannedUnloadAt: dto.plannedUnloadAt ?? null,
      etaHours: null,
      loadedTons: null,
      createdAt: new Date().toISOString(),
      createdByUserId: user?.sub ?? user?.id ?? null,
      checkpoints: [],
      handoff: { receiving: false, lab: false },
      pinVerified: false,
    };
    this.shipments.push(shipment);
    this.refreshDealRuntime(dto.dealId);
    return this.getShipment(id);
  }

  transitionShipment(id: string, dto: any, user: any) {
    const shipment = this.findShipment(id);
    const allowed = this.getAvailableShipmentTransitions(shipment.status);
    if (!allowed.includes(dto.nextState)) {
      throw new BadRequestException(`Переход рейса ${shipment.status} → ${dto.nextState} не разрешён`);
    }
    shipment.status = dto.nextState as ShipmentStatus;
    shipment.lastTransitionAt = new Date().toISOString();
    shipment.lastChangedByUserId = user?.sub ?? user?.id ?? null;
    if (dto.lat !== undefined) shipment.lastLat = dto.lat;
    if (dto.lng !== undefined) shipment.lastLng = dto.lng;
    if (dto.comment) shipment.lastComment = dto.comment;
    if (dto.nextState === 'AT_UNLOADING') shipment.handoff.receiving = true;
    if (dto.nextState === 'DELIVERED' || dto.nextState === 'COMPLETED') shipment.handoff.lab = true;
    this.appendEvidence({ dealId: shipment.dealId, shipmentId: shipment.id, source: 'logistics', class: 'transition', note: `Рейс переведён в ${dto.nextState}` });
    this.refreshDealRuntime(shipment.dealId);
    return this.getShipment(id);
  }

  recordCheckpoint(id: string, body: any, user: any) {
    const shipment = this.findShipment(id);
    const checkpoint = {
      id: `CP-${String(++this.checkpointCounter).padStart(3, '0')}`,
      type: body.type ?? 'CHECKPOINT',
      completedAt: body.timestamp ?? new Date().toISOString(),
      lat: body.lat ?? null,
      lng: body.lng ?? null,
      comment: body.comment ?? null,
      recordedByUserId: user?.sub ?? user?.id ?? null,
    };
    shipment.checkpoints.push(checkpoint);
    this.appendEvidence({ dealId: shipment.dealId, shipmentId: shipment.id, source: 'gps', class: checkpoint.type, note: checkpoint.comment ?? checkpoint.type });
    return { shipment: this.getShipment(id), checkpoint };
  }

  verifyPin(id: string, pin: string) {
    const shipment = this.findShipment(id);
    const valid = pin === '1234';
    shipment.pinVerified = valid;
    return { shipmentId: shipment.id, pinValid: valid };
  }

  listSamples() {
    return this.samples.map((sample) => ({
      ...sample,
      moneyImpact: sample.moneyDeltaRub ?? 0,
    }));
  }

  getSample(id: string) {
    const sample = this.findSample(id);
    return {
      ...sample,
      chainOfCustody: sample.custodyEvents ?? [],
      evidence: this.evidence.filter((e) => e.sampleId === id),
    };
  }

  createSample(dto: any, user: any) {
    const id = `SAMPLE-${String(++this.sampleCounter).padStart(3, '0')}`;
    const sample: any = {
      id,
      dealId: dto.dealId,
      shipmentId: dto.shipmentId ?? null,
      status: 'PENDING' as SampleStatus,
      culture: null,
      tests: [],
      createdAt: new Date().toISOString(),
      createdByUserId: user?.sub ?? user?.id ?? null,
      custodyEvents: [],
      moneyDeltaRub: 0,
    };
    if (dto.note) sample.note = dto.note;
    this.samples.push(sample);
    return this.getSample(id);
  }

  collectSample(id: string, user: any) {
    const sample = this.findSample(id);
    sample.status = 'COLLECTED';
    sample.collectedAt = new Date().toISOString();
    sample.custodyEvents.push({ id: `CUST-${Date.now()}`, type: 'COLLECTED', at: sample.collectedAt, by: user?.sub ?? user?.id ?? null });
    this.appendEvidence({ dealId: sample.dealId, sampleId: sample.id, source: 'lab', class: 'sample_collected', note: 'Проба отобрана' });
    this.refreshDealRuntime(sample.dealId);
    return this.getSample(id);
  }

  recordTest(id: string, dto: any, user: any) {
    const sample = this.findSample(id);
    const test = {
      id: `T-${String(++this.testCounter).padStart(3, '0')}`,
      parameter: dto.metric,
      value: dto.value,
      unit: dto.unit ?? null,
      norm: dto.norm ?? null,
      passed: dto.passed ?? true,
      recordedAt: new Date().toISOString(),
      recordedByUserId: user?.sub ?? user?.id ?? null,
      note: dto.note ?? null,
    };
    sample.tests.push(test);
    if (sample.status === 'COLLECTED') sample.status = 'ANALYSIS_IN_PROGRESS';
    sample.moneyDeltaRub = this.calculateSampleMoneyDelta(sample);
    this.refreshDealRuntime(sample.dealId);
    return { sample: this.getSample(id), test };
  }

  finalizeSample(id: string, user: any) {
    const sample = this.findSample(id);
    sample.status = 'FINALIZED';
    sample.finalizedAt = new Date().toISOString();
    sample.protocol = `PROT-${id}`;
    sample.finalizedByUserId = user?.sub ?? user?.id ?? null;
    sample.custodyEvents.push({ id: `CUST-${Date.now()}`, type: 'FINALIZED', at: sample.finalizedAt, by: user?.sub ?? user?.id ?? null });
    this.appendEvidence({ dealId: sample.dealId, sampleId: sample.id, source: 'lab', class: 'quality_protocol', note: `Протокол ${sample.protocol}` });
    this.refreshDealRuntime(sample.dealId);
    return this.getSample(id);
  }

  worksheet(dealId: string) {
    const deal = this.findDeal(dealId);
    const payment = this.ensurePayment(dealId);
    return {
      deal: this.decorateDealCard(deal),
      payment,
      completeness: this.documentCompleteness(dealId),
      bankWorkspace: this.bankWorkspace(dealId),
      moneyImpact: this.moneyImpact(dealId),
    };
  }

  listPayments() {
    return this.payments.map((payment) => ({
      ...payment,
      blockers: this.resolveBlockers(payment.dealId),
    }));
  }

  paymentDetail(id: string) {
    const payment = this.findPayment(id);
    return {
      ...payment,
      bankWorkspace: this.bankWorkspace(payment.dealId),
    };
  }

  confirmWorksheet(dealId: string, user: any) {
    const payment = this.ensurePayment(dealId);
    payment.status = 'RESERVED';
    payment.reserveConfirmedAt = new Date().toISOString();
    payment.callbackState = 'CONFIRMED';
    payment.confirmedByUserId = user?.sub ?? user?.id ?? null;
    this.pushMoneyEvent(dealId, payment.id, 'RESERVE_CONFIRMED', payment.amountRub);
    this.refreshDealRuntime(dealId);
    return { dealId, confirmed: true, payment };
  }

  releasePayment(dealId: string, user: any) {
    const payment = this.ensurePayment(dealId);
    const blockers = this.resolveBlockers(dealId);
    if (blockers.length > 0) {
      payment.status = 'MANUAL_REVIEW';
      payment.manualReviewRequired = true;
      payment.holdReason = blockers.join('; ');
      return { dealId, released: false, payment, blockers };
    }
    payment.status = 'RELEASED';
    payment.releasedAt = new Date().toISOString();
    payment.releasedRub = payment.amountRub;
    payment.releasedByUserId = user?.sub ?? user?.id ?? null;
    payment.callbackState = 'PENDING';
    payment.releaseJournal.push({ at: payment.releasedAt, action: 'FINAL_RELEASE', by: user?.sub ?? user?.id ?? null, amountRub: payment.releasedRub });
    this.pushMoneyEvent(dealId, payment.id, 'RELEASE_REQUESTED', payment.amountRub);
    return { dealId, released: true, payment };
  }

  adjustWorksheet(dealId: string, adjustments: any[], user: any) {
    const payment = this.ensurePayment(dealId);
    const delta = adjustments.reduce((sum: number, item: any) => sum + Number(item?.deltaRub ?? 0), 0);
    payment.amountRub += delta;
    payment.undisputedAmountRub += delta;
    payment.adjustments = adjustments;
    payment.adjustedAt = new Date().toISOString();
    payment.adjustedByUserId = user?.sub ?? user?.id ?? null;
    this.pushMoneyEvent(dealId, payment.id, 'ADJUSTMENT_APPLIED', delta);
    this.refreshDealRuntime(dealId);
    return { dealId, adjustments, payment };
  }

  importBankStatement(content: string, format: string, user: any) {
    const rows = (content || '').split('\n').filter(Boolean);
    return {
      format: format ?? 'CSV',
      parsedRows: rows.length,
      importedAt: new Date().toISOString(),
      importedByUserId: user?.sub ?? user?.id ?? null,
      status: 'IMPORTED',
    };
  }

  registerSafeDealsCallback(payload: any) {
    const dealId = payload?.dealId ?? payload?.meta?.dealId;
    if (!dealId) throw new BadRequestException('dealId обязателен для callback');
    const payment = this.ensurePayment(dealId);
    const callback = {
      id: `CB-${String(++this.callbackCounter).padStart(3, '0')}`,
      dealId,
      paymentId: payment.id,
      eventType: payload?.eventType ?? 'unknown',
      status: payload?.status ?? 'UNKNOWN',
      receivedAt: new Date().toISOString(),
      payload,
    };
    this.bankCallbacks.push(callback);
    payment.callbacks.push(callback.id);
    payment.callbackState = callback.status;
    if (callback.eventType === 'reserve_confirmed' && callback.status === 'SUCCESS') {
      payment.status = 'RESERVED';
      payment.reserveConfirmedAt = callback.receivedAt;
    } else if (callback.eventType === 'release_confirmed' && callback.status === 'SUCCESS') {
      payment.status = 'RELEASED';
      payment.releasedAt = callback.receivedAt;
      payment.releasedRub = payment.amountRub;
    } else if (callback.eventType === 'mismatch' || callback.status === 'MISMATCH') {
      payment.status = 'MISMATCH';
      payment.manualReviewRequired = true;
    } else if (callback.eventType === 'refund_confirmed' && callback.status === 'SUCCESS') {
      payment.status = 'REFUNDED';
    }
    this.refreshDealRuntime(dealId);
    return { accepted: true, callbackId: callback.id, payment };
  }

  bankWorkspace(dealId: string) {
    const payment = this.ensurePayment(dealId);
    return {
      dealId,
      payment,
      beneficiaries: this.beneficiaries.filter((b) => b.dealId === dealId),
      callbacks: this.bankCallbacks.filter((cb) => cb.dealId === dealId),
      moneyEvents: this.moneyEvents.filter((event) => event.dealId === dealId),
      releaseJournal: payment.releaseJournal ?? [],
      completeness: this.documentCompleteness(dealId),
      blockers: this.resolveBlockers(dealId),
    };
  }

  reservePrepayment(dealId: string, user: any) {
    const payment = this.ensurePayment(dealId);
    payment.status = 'RESERVE_PENDING';
    payment.reserveRequestedAt = new Date().toISOString();
    payment.requestedByUserId = user?.sub ?? user?.id ?? null;
    payment.callbackState = 'PENDING';
    this.pushMoneyEvent(dealId, payment.id, 'RESERVE_REQUESTED', payment.amountRub);
    return { dealId, status: payment.status, bankEventId: payment.bankEventId, requestedAt: payment.reserveRequestedAt };
  }

  appendGpsHeartbeat(shipmentId: string, user: any) {
    const event = this.recordCheckpoint(shipmentId, { type: 'GPS_HEARTBEAT', timestamp: new Date().toISOString() }, user);
    return { shipmentId, status: 'LIVE_OK', checkpointId: event.checkpoint.id };
  }

  integrationHealth() {
    return {
      status: 'PARTIAL',
      connectors: [
        { name: 'EDO', status: 'SANDBOX_ONLY' },
        { name: 'FGIS_ZERNO', status: 'SANDBOX_ONLY' },
        { name: 'Bank', status: 'SANDBOX_ONLY', callbacks: this.bankCallbacks.length },
        { name: 'GPS', status: 'LIVE_SIMULATED' },
        { name: '1C', status: 'MANUAL' },
      ],
    };
  }

  private decorateDealCard(deal: any) {
    const payment = this.ensurePayment(deal.id);
    return {
      ...deal,
      owner: this.resolveOwner(deal.id),
      slaAt: deal.slaAt,
      nextAction: this.resolveNextAction(deal.id),
      blockers: this.resolveBlockers(deal.id),
      moneyImpact: this.moneyImpact(deal.id),
      paymentStatus: payment.status,
    };
  }

  private resolveOwner(dealId: string) {
    const deal = this.findDeal(dealId);
    if (deal.status === 'DISPUTE_OPEN') return 'Контроль';
    if (deal.status === 'QUALITY_CHECK') return 'Лаборатория';
    const shipment = this.shipments.find((item) => item.dealId === dealId);
    if (shipment && ['IN_TRANSIT', 'AT_UNLOADING'].includes(shipment.status)) return 'Логистика';
    const completeness = this.documentCompleteness(dealId);
    if (!completeness.isComplete) return 'Документы';
    const payment = this.ensurePayment(dealId);
    if (['RESERVE_PENDING', 'CALLBACK_PENDING', 'MISMATCH', 'MANUAL_REVIEW'].includes(payment.status)) return 'Банк';
    return deal.owner ?? 'Сделка';
  }

  private resolveNextAction(dealId: string) {
    const payment = this.ensurePayment(dealId);
    const completeness = this.documentCompleteness(dealId);
    const sample = this.samples.find((item) => item.dealId === dealId);
    const shipment = this.shipments.find((item) => item.dealId === dealId);
    if (payment.status === 'RESERVE_PENDING') return 'Дождаться callback по резерву';
    if (!completeness.isComplete) return `Закрыть документы: ${completeness.missing.join(', ')}`;
    if (shipment && shipment.status === 'AT_UNLOADING' && !shipment.handoff.lab) return 'Передать партию в лабораторию';
    if (!sample || !['FINALIZED', 'ANALYZED'].includes(sample.status)) return 'Финализировать лабораторный протокол';
    if (payment.status === 'READY_FOR_RELEASE') return 'Выпустить деньги или подтвердить release';
    if (payment.status === 'MISMATCH') return 'Открыть ручную сверку';
    return this.findDeal(dealId).nextAction ?? 'Продолжить исполнение сделки';
  }

  private resolveBlockers(dealId: string) {
    const blockers: string[] = [];
    const payment = this.ensurePayment(dealId);
    const completeness = this.documentCompleteness(dealId);
    const deal = this.findDeal(dealId);
    const shipment = this.shipments.find((item) => item.dealId === dealId);
    const sample = this.samples.find((item) => item.dealId === dealId);
    if (payment.callbackState === 'PENDING') blockers.push('Нет callback банка');
    if (!completeness.isComplete) blockers.push(`Нет документов: ${completeness.missing.join(', ')}`);
    if (shipment && !['AT_UNLOADING', 'DELIVERED', 'COMPLETED'].includes(shipment.status)) blockers.push('Рейс не передан в приёмку');
    if (!sample || !['FINALIZED', 'ANALYZED'].includes(sample.status)) blockers.push('Нет финального протокола качества');
    if (deal.status === 'DISPUTE_OPEN') blockers.push('Есть открытый спор');
    if (payment.status === 'MISMATCH') blockers.push('Есть банковое расхождение');
    return blockers;
  }

  private moneyImpact(dealId: string) {
    const payment = this.ensurePayment(dealId);
    const sample = this.samples.find((item) => item.dealId === dealId);
    return {
      amountRub: payment.amountRub,
      disputedAmountRub: payment.disputedAmountRub ?? 0,
      undisputedAmountRub: payment.undisputedAmountRub ?? payment.amountRub,
      qualityDeltaRub: sample?.moneyDeltaRub ?? 0,
      bankEventId: payment.bankEventId,
    };
  }

  private documentCompleteness(dealId: string) {
    const docs = this.documents.filter((item) => item.dealId === dealId);
    const required = this.requiredDocTypes();
    const present = new Set(docs.filter((doc) => ['SIGNED', 'GENERATED', 'UPLOADED'].includes(doc.status)).map((doc) => doc.type));
    const missing = required.filter((type) => !present.has(type));
    return {
      dealId,
      required,
      missing,
      isComplete: missing.length === 0,
      bankRequiredMissing: missing,
      releaseRequiredMissing: missing,
      completionRate: Math.round(((required.length - missing.length) / required.length) * 100),
    };
  }

  private requiredDocTypes() {
    return ['contract', 'transport_waybill', 'quality_certificate', 'acceptance_act'];
  }

  private calculateSampleMoneyDelta(sample: any) {
    const failed = sample.tests.filter((test: any) => test.passed === false).length;
    return failed * -125000;
  }

  private pushMoneyEvent(dealId: string, paymentId: string, type: string, amountRub: number) {
    this.moneyEvents.push({
      id: `ME-${String(++this.eventCounter).padStart(3, '0')}`,
      dealId,
      paymentId,
      type,
      amountRub,
      createdAt: new Date().toISOString(),
    });
  }

  private appendEvidence(event: any) {
    this.evidence.push({
      id: `EV-${String(++this.evidenceCounter).padStart(3, '0')}`,
      createdAt: new Date().toISOString(),
      ...event,
    });
  }

  private ensurePayment(dealId: string) {
    let payment = this.payments.find((item) => item.dealId === dealId);
    if (!payment) {
      const deal = this.findDeal(dealId);
      payment = {
        id: `PAY-${String(++this.paymentCounter).padStart(3, '0')}`,
        dealId,
        status: 'PENDING' as PaymentStatus,
        amountRub: deal.totalRub,
        reservedRub: 0,
        releasedRub: 0,
        disputedAmountRub: 0,
        undisputedAmountRub: deal.totalRub,
        callbackState: 'NOT_SENT',
        createdAt: new Date().toISOString(),
        beneficiaries: [],
        bankEventId: `BANK-EVT-${String(this.eventCounter + 1).padStart(3, '0')}`,
        manualReviewRequired: false,
        releaseJournal: [],
        callbacks: [],
      };
      this.payments.push(payment);
    }
    return payment;
  }

  private refreshDealRuntime(dealId: string) {
    const deal = this.findDeal(dealId);
    const payment = this.ensurePayment(dealId);
    const blockers = this.resolveBlockers(dealId).filter((item) => item !== 'Нет callback банка' || payment.status !== 'RELEASED');
    const sample = this.samples.find((item) => item.dealId === dealId);
    if (sample) {
      payment.disputedAmountRub = Math.max(0, -(sample.moneyDeltaRub ?? 0));
      payment.undisputedAmountRub = Math.max(0, payment.amountRub - payment.disputedAmountRub);
    }
    if (payment.status === 'MISMATCH') {
      payment.manualReviewRequired = true;
      deal.owner = 'Банк';
      deal.nextAction = 'Открыть ручную сверку';
      return;
    }
    if (deal.status === 'DISPUTE_OPEN') {
      payment.status = 'HOLD_ACTIVE';
      payment.holdReason = 'Открыт спор';
      deal.owner = 'Контроль';
      deal.nextAction = 'Собрать evidence pack';
      return;
    }
    if (payment.releasedRub > 0 && payment.callbackState === 'CONFIRMED') {
      payment.status = 'RELEASED';
      deal.owner = 'Сделка';
      deal.nextAction = 'Закрыть сделку';
      return;
    }
    if (payment.reserveConfirmedAt && blockers.filter((item) => item !== 'Нет callback банка').length === 0) {
      payment.status = 'READY_FOR_RELEASE';
      payment.holdReason = null;
      deal.owner = 'Бухгалтерия';
      deal.nextAction = 'Выпустить деньги';
      return;
    }
    if (payment.reserveRequestedAt && !payment.reserveConfirmedAt) {
      payment.status = 'RESERVE_PENDING';
      deal.owner = 'Банк';
      deal.nextAction = 'Дождаться подтверждения резерва';
      return;
    }
    if (blockers.length > 0) {
      payment.status = 'HOLD_ACTIVE';
      payment.holdReason = blockers.join('; ');
      deal.owner = this.resolveOwner(dealId);
      deal.nextAction = this.resolveNextAction(dealId);
      return;
    }
    payment.status = 'REQUIRES_BANK';
    deal.owner = 'Банк';
    deal.nextAction = 'Создать банковый event';
  }

  private assertAllowedTransition(from: string, to: string) {
    const map: Record<string, string[]> = {
      DRAFT: ['AWAITING_SIGN', 'CANCELLATION'],
      AWAITING_SIGN: ['SIGNED', 'CANCELLATION'],
      SIGNED: ['PREPAYMENT_RESERVED', 'DISPUTE_OPEN', 'CANCELLATION'],
      PREPAYMENT_RESERVED: ['LOADING', 'DISPUTE_OPEN'],
      LOADING: ['IN_TRANSIT', 'DISPUTE_OPEN'],
      IN_TRANSIT: ['ARRIVED', 'DISPUTE_OPEN'],
      ARRIVED: ['QUALITY_CHECK', 'DISPUTE_OPEN'],
      QUALITY_CHECK: ['ACCEPTED', 'DISPUTЕ_OPEN', 'EXPERTISE'],
      ACCEPTED: ['FINAL_PAYMENT', 'PARTIAL_SETTLEMENT', 'DISPUTE_OPEN'],
      PARTIAL_SETTLEMENT: ['FINAL_PAYMENT', 'DISPUTE_OPEN'],
      FINAL_PAYMENT: ['SETTLED', 'DISPUTE_OPEN'],
      SETTLED: ['CLOSED'],
      DISPUTE_OPEN: ['EXPERTISE', 'ARBITRATION_DECISION', 'PARTIAL_SETTLEMENT'],
      EXPERTISE: ['ARBITRATION_DECISION', 'PARTIAL_SETTLEMENT'],
      ARBITRATION_DECISION: ['FINAL_PAYMENT', 'CANCELLATION', 'PARTIAL_SETTLEMENT'],
    };
    if (!(map[from] ?? []).includes(to)) {
      throw new BadRequestException(`Переход ${from} → ${to} не разрешён`);
    }
  }

  private getAvailableShipmentTransitions(status: string) {
    const transitions: Record<string, string[]> = {
      PENDING: ['IN_TRANSIT', 'CANCELLED'],
      IN_TRANSIT: ['AT_UNLOADING', 'ROUTE_DEVIATION_ALERT', 'CANCELLED'],
      AT_UNLOADING: ['DELIVERED', 'COMPLETED', 'CANCELLED'],
      ROUTE_DEVIATION_ALERT: ['IN_TRANSIT', 'CANCELLED'],
      DELIVERED: ['COMPLETED'],
      COMPLETED: [],
      CANCELLED: [],
    };
    return transitions[status] ?? [];
  }

  private resolveShipmentBlockers(id: string) {
    const shipment = this.findShipment(id);
    const blockers: string[] = [];
    if (!shipment.pinVerified) blockers.push('ПИН водителя не подтверждён');
    if (!shipment.checkpoints.length) blockers.push('Нет контрольных точек');
    if (!shipment.handoff.receiving && shipment.status === 'AT_UNLOADING') blockers.push('Нет передачи в приёмку');
    return blockers;
  }

  private findDeal(id: string) {
    const deal = this.deals.find((item) => item.id === id);
    if (!deal) throw new NotFoundException(`Сделка ${id} не найдена`);
    return deal;
  }

  private findDocument(id: string) {
    const doc = this.documents.find((item) => item.id === id);
    if (!doc) throw new NotFoundException(`Document ${id} not found`);
    return doc;
  }

  private findShipment(id: string) {
    const shipment = this.shipments.find((item) => item.id === id);
    if (!shipment) throw new NotFoundException(`Shipment ${id} not found`);
    return shipment;
  }

  private findSample(id: string) {
    const sample = this.samples.find((item) => item.id === id);
    if (!sample) throw new NotFoundException(`Sample ${id} not found`);
    return sample;
  }

  private findPayment(id: string) {
    const payment = this.payments.find((item) => item.id === id);
    if (!payment) throw new NotFoundException(`Payment ${id} not found`);
    return payment;
  }
}
