import type { RuntimeSnapshot } from './runtime-server';
import { documentsByDeal, disputesByDeal, inventoryByDeal, labByDeal, lotById, paymentsByDeal, receivingByDeal, shipmentById, shipmentsByDeal } from '../../../shared/runtime-snapshot';
import type { ModuleHubItem } from '../components/module-hub';

function unique(items: ModuleHubItem[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.href}::${item.label}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function lotFromSnapshot(snapshot: RuntimeSnapshot, lotId: string) {
  const lots = (snapshot as any).lots as Array<Record<string, any>> | undefined;
  return lots?.find((item) => item.id === lotId) || lotById(lotId);
}

function dealFromSnapshot(snapshot: RuntimeSnapshot, dealId: string) {
  return snapshot.deals.find((item) => item.id === dealId) || null;
}

export function lotJourneyLinks(snapshot: RuntimeSnapshot, lotId: string): ModuleHubItem[] {
  const lot = lotFromSnapshot(snapshot, lotId);
  const deal = snapshot.deals.find((item) => item.lotId === lotId) || null;
  const shipments = deal ? shipmentsByDeal(deal.id) : [];
  const labs = deal ? labByDeal(deal.id) : [];
  const payments = deal ? paymentsByDeal(deal.id) : [];
  const disputes = deal ? disputesByDeal(deal.id) : [];

  return unique([
    { href: '/lots', label: 'Реестр лотов', detail: 'Вернуться в витрину и сравнить соседние партии.', icon: '◌', meta: lot?.status || 'рынок', tone: 'blue' },
    deal ? { href: `/deals/${deal.id}`, label: 'Карточка сделки', detail: `Лот уже перешёл в исполнение: ${(deal as any).stage || deal.status}.`, icon: '≣', meta: deal.status, tone: 'green' as const } : { href: '/auctions', label: 'Торги и ставки', detail: 'Проверить таймер, лучшие предложения и выбор победителя.', icon: '↕', meta: `${(lot as any)?.bids?.length || 0} ставок`, tone: 'amber' as const },
    { href: '/documents', label: 'Документы', detail: deal ? 'Договор, УПД, акты и пакет закрытия по будущей сделке.' : 'Шаблоны договора и будущий обязательный пакет.', icon: '⌁', meta: deal ? `${documentsByDeal(deal.id).length} шт.` : 'подготовить', tone: 'gray' },
    { href: deal && shipments[0] ? `/logistics/${shipments[0].id}` : '/dispatch', label: 'Исполнение и рейсы', detail: deal ? 'Назначения, ETA, контроль погрузки и путь до приёмки.' : 'Появится после фиксации победителя и запуска исполнения.', icon: '→', meta: deal ? `${shipments.length} рейсов` : 'ещё нет', tone: shipments.length ? 'green' : 'gray' },
    { href: deal ? `/receiving/${deal.id}` : '/receiving', label: 'Приёмка', detail: 'Весовая, актирование и решение по поставке.', icon: '◫', meta: deal ? `${receivingByDeal(deal.id).length} тикетов` : 'после сделки', tone: 'blue' },
    { href: deal && labs[0] ? `/lab/${labs[0].id}` : '/lab', label: 'Лаборатория', detail: 'Отбор проб, протокол, влияние на цену и возможный ретест.', icon: '∴', meta: deal ? `${labs.length} проб` : 'по запросу', tone: labs.length ? 'amber' : 'gray' },
    { href: deal && payments[0] ? `/payments/${payments[0].id}` : '/payments', label: 'Оплата', detail: 'Обеспечение, финальный расчёт и money truth по сделке.', icon: '₽', meta: deal ? `${payments.length} платежей` : 'после приёмки', tone: payments.length ? 'green' : 'gray' },
    { href: deal && disputes[0] ? `/disputes/${disputes[0].id}` : '/disputes', label: 'Споры', detail: 'Претензии, доказательства и арбитраж по поставке.', icon: '!', meta: disputes.length ? `${disputes.length} открыто` : 'нет', tone: disputes.length ? 'red' : 'gray' }
  ]);
}

export function dealJourneyLinks(snapshot: RuntimeSnapshot, dealId: string): ModuleHubItem[] {
  const deal = dealFromSnapshot(snapshot, dealId);
  if (!deal) return [];
  const lot = lotFromSnapshot(snapshot, deal.lotId);
  const shipments = shipmentsByDeal(dealId);
  const labs = labByDeal(dealId);
  const payments = paymentsByDeal(dealId);
  const disputes = disputesByDeal(dealId);
  const docs = documentsByDeal(dealId);
  const inventory = inventoryByDeal(dealId);

  return unique([
    { href: lot ? `/lots/${lot.id}` : '/lots', label: 'Исходный лот', detail: lot ? `${(lot as any).culture} · ${(lot as any).region || ''} · ${(lot as any).volume || (lot as any).volumeTons || ''} т` : 'Открыть исходный источник сделки.', icon: '◌', meta: lot?.status || 'лот', tone: 'blue' },
    { href: shipments[0] ? `/logistics/${shipments[0].id}` : '/dispatch', label: 'Логистика', detail: 'Рейсы, статусы, ETA и evidence по исполнению.', icon: '→', meta: `${shipments.length} рейсов`, tone: shipments.length ? 'green' : 'gray' },
    { href: `/receiving/${dealId}`, label: 'Приёмка', detail: 'Весовая, тикеты, решение принять/отклонить.', icon: '◫', meta: `${receivingByDeal(dealId).length} тикетов`, tone: 'blue' },
    { href: labs[0] ? `/lab/${labs[0].id}` : '/lab', label: 'Качество', detail: 'Пробы, протоколы и пересчёт цены.', icon: '∴', meta: `${labs.length} проб`, tone: labs.length ? 'amber' : 'gray' },
    { href: '/documents', label: 'Документы', detail: 'Договор, УПД, ЭПД/ТТН, акты и след подписания.', icon: '⌁', meta: `${docs.length} шт.`, tone: docs.length ? 'green' : 'gray' },
    { href: payments[0] ? `/payments/${payments[0].id}` : '/payments', label: 'Финансы', detail: 'Worksheet, callback journal, release и finality.', icon: '₽', meta: `${payments.length} платежей`, tone: payments.length ? 'green' : 'gray' },
    { href: disputes[0] ? `/disputes/${disputes[0].id}` : '/disputes', label: 'Арбитраж', detail: 'Причина, доказательства, решение и санкции.', icon: '!', meta: disputes.length ? `${disputes.length} споров` : 'чисто', tone: disputes.length ? 'red' : 'gray' },
    { href: '/inventory', label: 'Склад / остатки', detail: 'Партии, титул, резерв и свободный остаток.', icon: '□', meta: `${inventory.length} партий`, tone: inventory.length ? 'blue' : 'gray' }
  ]);
}

export function shipmentJourneyLinks(snapshot: RuntimeSnapshot, shipmentId: string): ModuleHubItem[] {
  const snapshotShipments = (snapshot as any).shipments as Array<Record<string, any>> | undefined;
  const shipment = snapshotShipments?.find((item) => item.id === shipmentId) || shipmentById(shipmentId);
  if (!shipment) return [];
  const dealId = shipment.dealId;
  const labs = labByDeal(dealId);
  const payments = paymentsByDeal(dealId);
  const disputes = disputesByDeal(dealId);
  return unique([
    { href: `/deals/${dealId}`, label: 'Сделка', detail: 'Главная карточка обязательств, таймеров и блокеров.', icon: '≣', meta: dealId, tone: 'blue' },
    { href: `/driver-mobile/${shipmentId}`, label: 'Режим водителя', detail: 'Чек-лист рейса, доказательства и статусы в поле.', icon: '📱', meta: shipment.status, tone: 'green' },
    { href: `/receiving/${dealId}`, label: 'Приёмка', detail: 'Весовая, тикет и решение по факту поставки.', icon: '◫', meta: (shipment as any).appointment?.unloadSlot || (shipment as any).eta || (shipment as any).etaLabel || 'ETA', tone: 'amber' },
    { href: labs[0] ? `/lab/${labs[0].id}` : '/lab', label: 'Лаборатория', detail: 'Привязка протокола и quality impact.', icon: '∴', meta: `${labs.length} проб`, tone: labs.length ? 'amber' : 'gray' },
    { href: '/documents', label: 'Документы', detail: 'ЭПД/ТТН, акты и транспортный след.', icon: '⌁', meta: `${documentsByDeal(dealId).length} шт.`, tone: 'gray' },
    { href: payments[0] ? `/payments/${payments[0].id}` : '/payments', label: 'Оплата', detail: 'Выплата идёт только после подтверждённых событий исполнения.', icon: '₽', meta: `${payments.length}`, tone: payments.length ? 'green' : 'gray' },
    { href: disputes[0] ? `/disputes/${disputes[0].id}` : '/disputes', label: 'Спор', detail: 'Если есть отклонение, открыть и вести претензию без потери доказательств.', icon: '!', meta: disputes.length ? `${disputes.length}` : 'нет', tone: disputes.length ? 'red' : 'gray' }
  ]);
}

export function paymentJourneyLinks(snapshot: RuntimeSnapshot, dealId: string): ModuleHubItem[] {
  const docs = documentsByDeal(dealId);
  const shipments = shipmentsByDeal(dealId);
  const labs = labByDeal(dealId);
  const disputes = disputesByDeal(dealId);
  return unique([
    { href: `/deals/${dealId}`, label: 'Сделка', detail: 'Проверить checklist, blockers и владельца следующего шага.', icon: '≣', meta: dealId, tone: 'blue' },
    { href: '/documents', label: 'Документы', detail: 'Финконтур зависит от полного и подписанного пакета.', icon: '⌁', meta: `${docs.length} шт.`, tone: docs.length ? 'green' : 'gray' },
    { href: shipments[0] ? `/logistics/${shipments[0].id}` : '/dispatch', label: 'Исполнение', detail: 'Оплата должна опираться на подтверждённую отгрузку и приёмку.', icon: '→', meta: `${shipments.length} рейсов`, tone: shipments.length ? 'green' : 'gray' },
    { href: labs[0] ? `/lab/${labs[0].id}` : '/lab', label: 'Качество', detail: 'Quality delta должен быть отражён в worksheet и release logic.', icon: '∴', meta: `${labs.length} проб`, tone: labs.length ? 'amber' : 'gray' },
    { href: disputes[0] ? `/disputes/${disputes[0].id}` : '/disputes', label: 'Спор', detail: 'Открытый спор блокирует release или меняет сумму.', icon: '!', meta: disputes.length ? `${disputes.length}` : 'нет', tone: disputes.length ? 'red' : 'gray' }
  ]);
}
