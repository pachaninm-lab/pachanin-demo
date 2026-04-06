import { readCommercialWorkspace, type CommercialWorkspaceState, type QueueSlotStatus } from './commercial-workspace-store';
import { getRuntimeSnapshot, type RuntimeSnapshot } from './runtime-server';

type DeskStepStatus = 'DONE' | 'ACTIVE' | 'PENDING' | 'BLOCKED';
export type DeskStep = {
  code: string;
  title: string;
  owner: string;
  status: DeskStepStatus;
  detail: string;
  href: string;
};

export type IntegrationContract = {
  id: string;
  title: string;
  status: 'READY' | 'SANDBOX' | 'PLANNED';
  detail: string;
  owner: string;
  adapter: string;
};

export type DealDeskWorkspace = {
  deal: RuntimeSnapshot['deals'][number];
  shipment: RuntimeSnapshot['shipments'][number] | null;
  receiving: RuntimeSnapshot['receivingTickets'][number] | null;
  lab: RuntimeSnapshot['labSamples'][number] | null;
  payment: RuntimeSnapshot['payments'][number] | null;
  dispute: RuntimeSnapshot['disputes'][number] | null;
  docs: RuntimeSnapshot['documents'];
  queueSlot: CommercialWorkspaceState['queueSlots'][number] | null;
  transportRun: CommercialWorkspaceState['transportRuns'][number] | null;
  financeApplications: CommercialWorkspaceState['financeApplications'];
  waterfalls: CommercialWorkspaceState['paymentWaterfalls'];
  marketRows: CommercialWorkspaceState['marketRows'];
  knowledgeRecommendations: any[];
  procurementSignals: { title: string; detail: string; href: string }[];
  stateMachine: DeskStep[];
  blockers: string[];
  nextAction: { title: string; role: string; href: string; detail: string };
  integrationContracts: IntegrationContract[];
  moneyReadiness: {
    docsReady: boolean;
    labReady: boolean;
    queueReady: boolean;
    finalReady: boolean;
    disputeOpen: boolean;
    releasableSteps: string[];
  };
};

function sortBySeverity(steps: DeskStep[]) {
  const order: Record<DeskStepStatus, number> = { BLOCKED: 0, ACTIVE: 1, PENDING: 2, DONE: 3 };
  return [...steps].sort((a, b) => order[a.status] - order[b.status]);
}

function queueGreen(status?: QueueSlotStatus | null) {
  return !!status && ['AT_GATE', 'ON_SCALE', 'UNLOADING', 'COMPLETED', 'CHECKED_OUT'].includes(status);
}

function queueFinal(status?: QueueSlotStatus | null) {
  return !!status && ['COMPLETED', 'CHECKED_OUT'].includes(status);
}

function docsReadyForDeal(docs: RuntimeSnapshot['documents']) {
  if (!docs.length) return false;
  return docs.every((doc: any) => !doc.overdue && ['VERIFIED', 'SIGNED', 'ACTIVE', 'READY'].includes(String(doc.status || '').toUpperCase()));
}

function labReadyForDeal(lab: RuntimeSnapshot['labSamples'][number] | null) {
  if (!lab) return false;
  const status = String((lab as any).status || '').toUpperCase();
  return !(lab as any).reTest && ['DONE', 'VERIFIED', 'GREEN', 'APPROVED'].some((token) => status.includes(token));
}

function buildIntegrationContracts(
  deal: RuntimeSnapshot['deals'][number],
  financeApplications: CommercialWorkspaceState['financeApplications'],
  transportRun: CommercialWorkspaceState['transportRuns'][number] | null,
): IntegrationContract[] {
  return [
    {
      id: 'INT-EDO',
      title: 'ЭДО / Диадок / СБИС',
      status: 'SANDBOX',
      detail: `${(deal as any).documentsStatus || 'DOCS'} — контур документов уже собран, нужен боевой адаптер и mapping статусов.`,
      owner: 'документы / оператор',
      adapter: 'edo-callback + signature mapping',
    },
    {
      id: 'INT-FGIS',
      title: 'ФГИС «Зерно» / СДИЗ',
      status: 'PLANNED',
      detail: 'Пакет сделки и передача по качеству готовы для интеграции, но боевой обмен не включён.',
      owner: 'комплаенс / оператор',
      adapter: 'fgis-sync sandbox fixture',
    },
    {
      id: 'INT-ETTN',
      title: 'ЭТрН / ЭПД',
      status: (transportRun as any)?.ettnReady ? 'SANDBOX' : 'PLANNED',
      detail: (transportRun as any)?.ettnReady ? 'Контур рейса уже помечен как ettn-ready, нужен боевой провайдер.' : 'Статусный слой есть, но внешнее подключение не поднято.',
      owner: 'диспетчер / оператор',
      adapter: 'transport event bridge',
    },
    {
      id: 'INT-BANK',
      title: 'Банк / release rail',
      status: financeApplications.length ? 'SANDBOX' : 'PLANNED',
      detail: financeApplications.length ? 'Есть связанный финконтур и waterfall, нужен боевой callback и release policy.' : 'Финконтур ещё не привязан к сделке.',
      owner: 'финансы / оператор',
      adapter: 'bank callback + reconciliation',
    },
  ];
}

function dealDocs(snapshot: RuntimeSnapshot, dealId: string) {
  return (snapshot.documents || []).filter((doc: any) => doc.dealId === dealId || doc.linkedTo === dealId || doc.linkedDealId === dealId);
}

function buildStateMachine(
  deal: RuntimeSnapshot['deals'][number],
  shipment: RuntimeSnapshot['shipments'][number] | null,
  receiving: RuntimeSnapshot['receivingTickets'][number] | null,
  lab: RuntimeSnapshot['labSamples'][number] | null,
  docs: RuntimeSnapshot['documents'],
  payment: RuntimeSnapshot['payments'][number] | null,
  dispute: RuntimeSnapshot['disputes'][number] | null,
  queueSlot: CommercialWorkspaceState['queueSlots'][number] | null,
) {
  const docsReady = docsReadyForDeal(docs);
  const labReady = labReadyForDeal(lab);
  const queueReady = queueGreen((queueSlot as any)?.status || null);
  const paymentDone = ['COMPLETED', 'PAID', 'RELEASED', 'VERIFIED'].includes(String((payment as any)?.status || '').toUpperCase());
  const disputeOpen = Boolean(dispute) && !['CLOSED', 'RESOLVED', 'SETTLED'].includes(String((dispute as any)?.status || '').toUpperCase());

  return sortBySeverity([
    {
      code: 'F1',
      title: 'Сделка активна',
      owner: 'buyer / seller / operator',
      status: String((deal as any).stage || (deal as any).status || '').toUpperCase().includes('DRAFT') ? 'ACTIVE' : 'DONE',
      detail: `${(deal as any).seller || 'seller'} → ${(deal as any).buyer || 'buyer'} · ${(deal as any).culture || 'lot'} · ${(deal as any).stage || (deal as any).status}`,
      href: `/deals/${(deal as any).id}`,
    },
    {
      code: 'F2',
      title: 'Рейс и dispatch',
      owner: 'логист',
      status: shipment ? (String((shipment as any).status || '').toUpperCase().includes('INCIDENT') ? 'BLOCKED' : String((shipment as any).status || '').toUpperCase().includes('CLOSED') ? 'DONE' : 'ACTIVE') : 'PENDING',
      detail: shipment ? `Рейс ${(shipment as any).id} · ${(shipment as any).status}` : 'Рейс ещё не назначен.',
      href: shipment ? `/dispatch/${(shipment as any).id}` : '/dispatch',
    },
    {
      code: 'F3',
      title: 'Очередь и приёмка',
      owner: 'приёмка / элеватор',
      status: receiving ? (queueReady ? (queueFinal((queueSlot as any)?.status || null) ? 'DONE' : 'ACTIVE') : 'BLOCKED') : 'PENDING',
      detail: receiving ? `Receiving ${(receiving as any).id} · slot ${(queueSlot as any)?.status || 'not-linked'}` : 'Нет handoff в receiving.',
      href: `/receiving/${(deal as any).id}`,
    },
    {
      code: 'F4',
      title: 'Лаборатория и качество',
      owner: 'лаборатория',
      status: lab ? (labReady ? 'DONE' : 'ACTIVE') : 'PENDING',
      detail: lab ? `Проба ${(lab as any).id} · ${(lab as any).status}` : 'Протокол качества ещё не привязан.',
      href: lab ? `/lab/${(lab as any).id}` : '/lab',
    },
    {
      code: 'F5',
      title: 'Документы',
      owner: 'docs / operator',
      status: docs.length ? (docsReady ? 'DONE' : 'BLOCKED') : 'PENDING',
      detail: docs.length ? `${docs.length} документов в пакете.` : 'Пакет документов ещё не собран.',
      href: '/documents',
    },
    {
      code: 'F6',
      title: 'Деньги и release',
      owner: 'финансы',
      status: payment ? (disputeOpen ? 'BLOCKED' : paymentDone ? 'DONE' : docsReady && labReady ? 'ACTIVE' : 'PENDING') : 'PENDING',
      detail: payment ? `Платёж ${(payment as any).id} · ${(payment as any).status}` : 'Платёжный объект ещё не готов.',
      href: payment ? `/payments/${(payment as any).id}` : '/payments',
    },
    {
      code: 'F7',
      title: 'Спор / resolution',
      owner: 'support / risk',
      status: dispute ? (disputeOpen ? 'BLOCKED' : 'DONE') : 'PENDING',
      detail: dispute ? `Спор ${(dispute as any).id} · ${(dispute as any).status}` : 'Спора по сделке нет.',
      href: '/support',
    },
  ]);
}

function buildKnowledgeRecommendations(commercial: CommercialWorkspaceState, deal: RuntimeSnapshot['deals'][number]) {
  const articles = (commercial.knowledgeArticles || []) as any[];
  const culture = String((deal as any).culture || '').toLowerCase();
  const region = String((deal as any).region || '').toLowerCase();
  return articles
    .filter((item) => {
      const text = `${item.title || ''} ${item.summary || ''} ${item.category || ''}`.toLowerCase();
      return !culture || text.includes(culture) || !region || text.includes(region) || item.role === 'operator';
    })
    .slice(0, 4);
}

function buildProcurementSignals(commercial: CommercialWorkspaceState, deal: RuntimeSnapshot['deals'][number]) {
  const rows = (commercial.marketRows || []) as any[];
  return rows
    .filter((row) => String(row.culture || '').toLowerCase() === String((deal as any).culture || '').toLowerCase())
    .slice(0, 4)
    .map((row) => ({
      title: `${row.buyerName || row.buyerId} · ${row.netbackRubPerTon || row.grossPrice || 0} ₽/т`,
      detail: `${row.region || 'region'} · ${row.paymentSpeed || row.paymentMode || 'payment TBD'} · trust ${row.trust || '—'}`,
      href: row.linkedDealId ? `/deals/${row.linkedDealId}` : row.linkedLotId ? `/lots/${row.linkedLotId}` : '/market-center',
    }));
}

function buildBlockers(
  deal: RuntimeSnapshot['deals'][number],
  docs: RuntimeSnapshot['documents'],
  queueSlot: CommercialWorkspaceState['queueSlots'][number] | null,
  lab: RuntimeSnapshot['labSamples'][number] | null,
  dispute: RuntimeSnapshot['disputes'][number] | null,
) {
  const blockers = [
    ...(((deal as any).blockers || []) as string[]),
  ];
  if (!docsReadyForDeal(docs)) blockers.push('Документный пакет не green.');
  if (queueSlot && ['ETA_RISK', 'NO_SHOW_RISK'].includes(String((queueSlot as any).status))) blockers.push(`Queue risk: ${(queueSlot as any).status}`);
  if (!labReadyForDeal(lab)) blockers.push('Лаборатория не дала финальный green protocol.');
  if (dispute && !['CLOSED', 'RESOLVED', 'SETTLED'].includes(String((dispute as any).status || '').toUpperCase())) blockers.push(`Открытый спор: ${(dispute as any).status}`);
  return Array.from(new Set(blockers.filter(Boolean))).slice(0, 8);
}

function buildNextAction(workspace: Omit<DealDeskWorkspace, 'nextAction'>) {
  if (!workspace.moneyReadiness.docsReady) {
    return { title: 'Закрыть пакет документов', role: 'docs / operator', href: '/documents', detail: 'Без зелёного документационного пакета money rail не должен идти дальше.' };
  }
  if (!workspace.moneyReadiness.queueReady) {
    return { title: 'Закрыть receiving handoff', role: 'receiving / logistics', href: `/receiving/${(workspace.deal as any).id}`, detail: 'Нужно убрать риск очереди и зафиксировать приёмку.' };
  }
  if (!workspace.moneyReadiness.labReady) {
    return { title: 'Довести лабораторию до final protocol', role: 'lab', href: workspace.lab ? `/lab/${(workspace.lab as any).id}` : '/lab', detail: 'Качество ещё не перешло в финальный статус.' };
  }
  if (workspace.moneyReadiness.disputeOpen) {
    return { title: 'Разрешить спор', role: 'support / risk', href: '/support', detail: 'Открытый dispute блокирует final release или требует partial logic.' };
  }
  return { title: 'Готовить release', role: 'финансы', href: workspace.payment ? `/payments/${(workspace.payment as any).id}` : '/payments', detail: 'Все основные контуры зелёные, можно идти в release waterfall.' };
}

export function buildDealDeskWorkspace(snapshot: RuntimeSnapshot, commercial: CommercialWorkspaceState, dealId: string): DealDeskWorkspace {
  const deal = snapshot.deals.find((item: any) => item.id === dealId)!;
  const shipment = snapshot.shipments.find((item: any) => item.dealId === dealId) || null;
  const receiving = snapshot.receivingTickets.find((item: any) => item.dealId === dealId || item.linkedDealId === dealId) || null;
  const lab = snapshot.labSamples.find((item: any) => item.dealId === dealId || item.linkedDealId === dealId) || null;
  const payment = snapshot.payments.find((item: any) => item.dealId === dealId || item.linkedDealId === dealId) || null;
  const dispute = snapshot.disputes.find((item: any) => item.dealId === dealId || item.linkedDealId === dealId) || null;
  const docs = dealDocs(snapshot, dealId);
  const queueSlot = (commercial.queueSlots || []).find((item: any) => item.linkedDealId === dealId || item.linkedShipmentId === (shipment as any)?.id) || null;
  const transportRun = (commercial.transportRuns || []).find((item: any) => item.linkedDealId === dealId || item.requestId === (shipment as any)?.id) || null;
  const financeApplications = (commercial.financeApplications || []).filter((item: any) => item.dealId === dealId || item.linkedDealId === dealId);
  const waterfalls = (commercial.paymentWaterfalls || []).filter((item: any) => financeApplications.some((app: any) => app.id === item.applicationId));
  const marketRows = (commercial.marketRows || []).filter((item: any) => String(item.culture || '').toLowerCase() === String((deal as any).culture || '').toLowerCase()).slice(0, 6);
  const knowledgeRecommendations = buildKnowledgeRecommendations(commercial, deal);
  const procurementSignals = buildProcurementSignals(commercial, deal);
  const stateMachine = buildStateMachine(deal, shipment, receiving, lab, docs, payment, dispute, queueSlot);
  const blockers = buildBlockers(deal, docs, queueSlot, lab, dispute);
  const integrationContracts = buildIntegrationContracts(deal, financeApplications as any, transportRun as any);
  const moneyReadiness = {
    docsReady: docsReadyForDeal(docs),
    labReady: labReadyForDeal(lab),
    queueReady: queueGreen((queueSlot as any)?.status || null),
    finalReady: docsReadyForDeal(docs) && labReadyForDeal(lab) && queueFinal((queueSlot as any)?.status || null) && !dispute,
    disputeOpen: Boolean(dispute) && !['CLOSED', 'RESOLVED', 'SETTLED'].includes(String((dispute as any)?.status || '').toUpperCase()),
    releasableSteps: (waterfalls as any[]).filter((item) => String(item.status || '').toUpperCase() === 'READY').map((item) => item.label || item.id),
  };

  const workspaceBase = {
    deal,
    shipment,
    receiving,
    lab,
    payment,
    dispute,
    docs,
    queueSlot,
    transportRun,
    financeApplications: financeApplications as any,
    waterfalls: waterfalls as any,
    marketRows: marketRows as any,
    knowledgeRecommendations,
    procurementSignals,
    stateMachine,
    blockers,
    integrationContracts,
    moneyReadiness,
  };

  return {
    ...workspaceBase,
    nextAction: buildNextAction(workspaceBase as any),
  };
}

export async function listDealDeskWorkspaces() {
  const [snapshot, commercial] = await Promise.all([getRuntimeSnapshot(), readCommercialWorkspace()]);
  return (snapshot.deals || [])
    .map((deal: any) => buildDealDeskWorkspace(snapshot, commercial as any, deal.id))
    .sort((a, b) => {
      const blockerDelta = b.blockers.length - a.blockers.length;
      if (blockerDelta) return blockerDelta;
      return Number((b.deal as any).updatedAt || 0) - Number((a.deal as any).updatedAt || 0);
    });
}
