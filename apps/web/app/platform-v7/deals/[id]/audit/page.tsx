import { GrainWorkflowPage } from '../../../../../components/platform-v7/GrainWorkflowPage';
import { WorkflowActionPanel } from '../../../../../components/platform-v7/WorkflowActionPanel';
import { TimelineWithImpact } from '@/components/platform-v7/visual/TimelineWithImpact';
import { TimelineChapters } from '@/components/platform-v7/visual/TimelineChapters';
import { DealEventHistoryPanel } from '@/components/platform-v7/DealEventHistoryPanel';
import type { DealEvent } from '@/lib/platform-v7/deal-event-chain-client';

const GENESIS_HASH = '0'.repeat(64);

function makeDemoChain(dealId: string): DealEvent[] {
  const h = (n: number) => `demo${n.toString().padStart(62, '0')}`;
  return [
    { id: `${dealId}-e1`, dealId, eventType: 'DEAL_CREATED',       payload: { actorId: 'seller-001', actorRole: 'FARMER',  newStatus: 'DRAFT',                meta: { volumeTons: 120, culture: 'Пшеница 3кл' } },  prevHash: GENESIS_HASH, hash: h(1), occurredAt: '2024-03-01T09:14:00.000Z' },
    { id: `${dealId}-e2`, dealId, eventType: 'DEAL_SIGNED',         payload: { actorId: 'buyer-001',  actorRole: 'BUYER',   newStatus: 'SIGNED',               meta: { certificateId: 'cert-b1-001' } },              prevHash: h(1),         hash: h(2), occurredAt: '2024-03-01T10:02:00.000Z' },
    { id: `${dealId}-e3`, dealId, eventType: 'PAYMENT_RESERVED',    payload: { actorId: 'bank-svc',   actorRole: 'SYSTEM',  newStatus: 'PREPAYMENT_RESERVED',  meta: { amountKopecks: 180_000_00 } },                 prevHash: h(2),         hash: h(3), occurredAt: '2024-03-01T10:08:00.000Z' },
    { id: `${dealId}-e4`, dealId, eventType: 'LOADING_STARTED',     payload: { actorId: 'driver-034', actorRole: 'DRIVER',  newStatus: 'LOADING',              meta: { vehicleNumber: 'А123БВ77' } },                 prevHash: h(3),         hash: h(4), occurredAt: '2024-03-01T11:30:00.000Z' },
    { id: `${dealId}-e5`, dealId, eventType: 'IN_TRANSIT',          payload: { actorId: 'driver-034', actorRole: 'DRIVER',  newStatus: 'IN_TRANSIT',           meta: { geoLat: 55.75, geoLng: 37.62 } },             prevHash: h(4),         hash: h(5), occurredAt: '2024-03-01T14:20:00.000Z' },
    { id: `${dealId}-e6`, dealId, eventType: 'ARRIVED',             payload: { actorId: 'elevator-1', actorRole: 'ELEVATOR', newStatus: 'ARRIVED',             meta: { elevatorId: 'ELV-007' } },                    prevHash: h(5),         hash: h(6), occurredAt: '2024-03-02T09:55:00.000Z' },
    { id: `${dealId}-e7`, dealId, eventType: 'QUALITY_CHECK_STARTED', payload: { actorId: 'lab-003', actorRole: 'LAB',      newStatus: 'QUALITY_CHECK',        meta: { sampleId: 'SMPL-1204' } },                    prevHash: h(6),         hash: h(7), occurredAt: '2024-03-02T10:30:00.000Z' },
  ];
}

export default async function DealAuditPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const dealId = params.id;

  return (
    <>
      <TimelineWithImpact
        events={[
          { id: 'ev-1', text: 'Партия создана продавцом',                       impact: 'открыт путь к сделке',               actor: 'Продавец',   ts: '09:14',  tone: 'ok'      },
          { id: 'ev-2', text: 'Оффер сохранён, условия зафиксированы',           impact: 'условия переданы покупателю',         actor: 'Оператор',   ts: '09:21',  tone: 'ok'      },
          { id: 'ev-3', text: 'Резерв средств подтверждён',                      impact: 'деньги зарезервированы',             actor: 'Банк',       ts: '10:05',  tone: 'money'   },
          { id: 'ev-4', text: `Рейс ${dealId === 'DL-9106' ? 'ВРЖ-08' : 'ТМБ-14'} отправлен`,                         impact: 'груз в пути',                        actor: 'Водитель',   ts: '11:30',  tone: 'neutral' },
          { id: 'ev-5', text: 'СДИЗ не закрыт — основание не сформировано',      impact: 'банковская проверка остановлена',     actor: 'Оператор',   ts: '13:00',  tone: 'blocked' },
          { id: 'ev-6', text: 'Документ открыт на просмотр',                     impact: 'просмотр зафиксирован в журнале',    actor: 'Оператор',   ts: '13:15',  tone: 'neutral' },
          { id: 'ev-7', text: 'Сигнал риска проверен',                           impact: 'проверка завершена без изменений',   actor: 'Оператор',   ts: '14:00',  tone: 'warn'    },
        ]}
        maxItems={5}
      />
      <TimelineChapters
        chapters={[
          {
            id: 'creation',
            label: 'Создание',
            status: 'done',
            events: [
              { id: 'c1', timestamp: '09:14', actor: 'Продавец',  text: 'Партия создана',                  impact: 'открыт путь к сделке',      tone: 'ok'      },
              { id: 'c2', timestamp: '09:21', actor: 'Оператор',  text: 'Оффер сохранён',                  impact: 'условия зафиксированы',     tone: 'ok'      },
            ],
          },
          {
            id: 'reserve',
            label: 'Резерв',
            status: 'done',
            events: [
              { id: 'r1', timestamp: '10:05', actor: 'Банк',      text: 'Резерв средств подтверждён',      impact: 'деньги зарезервированы',    tone: 'money'   },
            ],
          },
          {
            id: 'trip',
            label: 'Рейс',
            status: 'active',
            events: [
              { id: 't1', timestamp: '11:30', actor: 'Водитель',  text: 'Рейс отправлен',                  impact: 'груз в пути',                tone: 'neutral' },
            ],
          },
          {
            id: 'documents',
            label: 'Документы',
            status: 'active',
            events: [
              { id: 'd1', timestamp: '13:00', actor: 'Оператор',  text: 'СДИЗ не закрыт',                  impact: 'банковская проверка остановлена', tone: 'blocked' },
              { id: 'd2', timestamp: '13:15', actor: 'Оператор',  text: 'Документ открыт на просмотр',     impact: 'просмотр зафиксирован',     tone: 'neutral' },
            ],
          },
        ]}
        defaultExpanded={['documents', 'trip']}
        compact
      />

      {/* История изменений сделки (hash-цепочка событий) */}
      <section style={{ padding: '1.5rem 0' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <h2 className="heading-4" style={{ margin: 0 }}>История изменений</h2>
          <span className="caption">Криптографическая цепочка событий (SHA-256)</span>
        </div>
        <DealEventHistoryPanel events={makeDemoChain(dealId)} showHashes={false} />
      </section>

      <GrainWorkflowPage eyebrow='Сделка · журнал' title={`Журнал сделки ${dealId}`} lead='Журнал показывает действия, роли, объекты, причины, изменения статуса и материалы, на которые опирается сделка.' primaryHref='/platform-v7/data-room/grain' primaryLabel='Data-room' items={[
        { title: 'Партия', value: 'создана', href: '/platform-v7/seller/batches', tone: 'good', note: 'Событие создания партии связано с продавцом.' },
        { title: 'Оффер', value: 'версия сохранена', href: '/platform-v7/offer-log', tone: 'good', note: 'Изменение условий создаёт новую запись.' },
        { title: 'Документ', value: 'открыт', href: '/platform-v7/documents/grain', tone: 'warn', note: 'Просмотр и скачивание фиксируются.' },
        { title: 'Риск', value: 'проверен', href: '/platform-v7/security/grain', tone: 'warn', note: 'Сигналы риска связаны с объектом сделки.' },
      ]} />
      <WorkflowActionPanel context='deal' />
    </>
  );
}
