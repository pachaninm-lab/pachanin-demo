import Link from 'next/link';
import { TimelineWithImpact } from '@/components/platform-v7/visual/TimelineWithImpact';
import { TimelineChapters } from '@/components/platform-v7/visual/TimelineChapters';
import { selectDealById } from '@/lib/domain/selectors';
import { getDeal360Scenario } from '@/lib/platform-v7/deal360-source-of-truth';

const border = '#E4E6EA';
const text = '#0F1419';
const muted = '#6B778C';
const green = '#0A7A5F';
const red = '#B91C1C';

export default function DealAuditPage({ params }: { params: { id: string } }) {
  const dealId = params.id;
  const deal = selectDealById(dealId);
  const scenario = deal ? getDeal360Scenario(dealId) : null;

  const tripLabel = dealId === 'DL-9106' ? 'TRIP-2403-001' : dealId === 'DL-9102' ? 'TRIP-2402-002' : `TRIP-${dealId}`;

  return (
    <div style={{ display: 'grid', gap: 16, padding: '4px 0 24px' }}>
      <section style={{ border: `1px solid ${border}`, borderRadius: 18, padding: 18, background: '#fff' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div>
            <p style={{ margin: 0, fontSize: 11, color: muted, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {dealId} · Журнал
            </p>
            <h1 style={{ margin: '6px 0 0', fontSize: 24, color: text, fontWeight: 800 }}>Журнал сделки</h1>
            <p style={{ margin: '8px 0 0', fontSize: 13, color: muted, lineHeight: 1.7 }}>
              Действия, роли, объекты, причины, изменения статуса и материалы сделки.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Link href={`/platform-v7/deals/${dealId}/clean`} style={{ textDecoration: 'none', padding: '8px 12px', borderRadius: 10, background: '#fff', border: `1px solid ${border}`, color: text, fontSize: 13, fontWeight: 700 }}>← Сделка</Link>
            <Link href='/platform-v7/data-room' style={{ textDecoration: 'none', padding: '8px 12px', borderRadius: 10, background: '#fff', border: `1px solid ${border}`, color: text, fontSize: 13, fontWeight: 700 }}>Data-room</Link>
          </div>
        </div>
        {scenario && (
          <div style={{ marginTop: 12, padding: 12, borderRadius: 12, background: '#F8FAFB', border: `1px solid ${border}`, fontSize: 13, color: text }}>
            <strong>Текущий этап:</strong> {scenario.cockpit.currentStage} · <span style={{ color: muted }}>Следующий: {scenario.cockpit.nextActor}</span>
          </div>
        )}
      </section>

      <TimelineWithImpact
        events={[
          { id: 'ev-1', text: 'Партия создана продавцом', impact: 'открыт путь к сделке', actor: 'Продавец', ts: '09:14', tone: 'ok' },
          { id: 'ev-2', text: 'Оффер сохранён, условия зафиксированы', impact: 'условия переданы покупателю', actor: 'Оператор', ts: '09:21', tone: 'ok' },
          { id: 'ev-3', text: 'Резерв средств подтверждён', impact: 'деньги зарезервированы', actor: 'Банк', ts: '10:05', tone: 'money' },
          { id: 'ev-4', text: `Рейс ${tripLabel} отправлен`, impact: 'груз в пути', actor: 'Водитель', ts: '11:30', tone: 'neutral' },
          { id: 'ev-5', text: 'СДИЗ не закрыт — основание не сформировано', impact: 'банковская проверка остановлена', actor: 'Оператор', ts: '13:00', tone: 'blocked' },
          { id: 'ev-6', text: 'Документ открыт на просмотр', impact: 'просмотр зафиксирован в журнале', actor: 'Оператор', ts: '13:15', tone: 'neutral' },
          { id: 'ev-7', text: 'Сигнал риска проверен', impact: 'проверка завершена без изменений', actor: 'Оператор', ts: '14:00', tone: 'warn' },
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
              { id: 'c1', timestamp: '09:14', actor: 'Продавец', text: 'Партия создана', impact: 'открыт путь к сделке', tone: 'ok' },
              { id: 'c2', timestamp: '09:21', actor: 'Оператор', text: 'Оффер сохранён', impact: 'условия зафиксированы', tone: 'ok' },
            ],
          },
          {
            id: 'reserve',
            label: 'Резерв',
            status: 'done',
            events: [
              { id: 'r1', timestamp: '10:05', actor: 'Банк', text: 'Резерв средств подтверждён', impact: 'деньги зарезервированы', tone: 'money' },
            ],
          },
          {
            id: 'trip',
            label: 'Рейс',
            status: 'active',
            events: [
              { id: 't1', timestamp: '11:30', actor: 'Водитель', text: `Рейс ${tripLabel} отправлен`, impact: 'груз в пути', tone: 'neutral' },
            ],
          },
          {
            id: 'documents',
            label: 'Документы',
            status: 'active',
            events: [
              { id: 'd1', timestamp: '13:00', actor: 'Оператор', text: 'СДИЗ не закрыт', impact: 'банковская проверка остановлена', tone: 'blocked' },
              { id: 'd2', timestamp: '13:15', actor: 'Оператор', text: 'Документ открыт на просмотр', impact: 'просмотр зафиксирован', tone: 'neutral' },
            ],
          },
        ]}
        defaultExpanded={['documents', 'trip']}
        compact
      />

      {scenario && (
        <section style={{ border: `1px solid ${border}`, borderRadius: 18, padding: 18, background: '#fff', display: 'grid', gap: 10 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: text }}>Документы в сделке</div>
          <div style={{ display: 'grid', gap: 8 }}>
            {scenario.documents.map((doc) => (
              <div key={doc.title} style={{ display: 'grid', gridTemplateColumns: '130px minmax(0,1fr) minmax(0,1fr) minmax(0,1fr)', gap: 12, border: `1px solid ${doc.blocksMoney ? 'rgba(220,38,38,0.14)' : border}`, borderRadius: 12, padding: 12, background: doc.blocksMoney ? 'rgba(220,38,38,0.04)' : '#F8FAFB', alignItems: 'start' }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: text }}>{doc.title}</div>
                <div style={{ fontSize: 12, color: muted }}>{doc.source}</div>
                <div style={{ fontSize: 12, color: muted }}>Отв: {doc.responsible}</div>
                <div>
                  <span style={{ fontSize: 12, color: doc.blocksMoney ? red : green, fontWeight: 700 }}>{doc.status}</span>
                  {doc.blocksMoney && <div style={{ fontSize: 10, color: red, marginTop: 3 }}>блокирует выплату</div>}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Link href={`/platform-v7/deals/${dealId}/clean`} style={{ textDecoration: 'none', padding: '10px 14px', borderRadius: 12, background: green, color: '#fff', fontSize: 13, fontWeight: 800 }}>
          Открыть карточку сделки
        </Link>
        <Link href='/platform-v7/offer-log' style={{ textDecoration: 'none', padding: '10px 14px', borderRadius: 12, border: `1px solid ${border}`, background: '#fff', color: text, fontSize: 13, fontWeight: 700 }}>
          Журнал предложений
        </Link>
        <Link href='/platform-v7/data-room' style={{ textDecoration: 'none', padding: '10px 14px', borderRadius: 12, border: `1px solid ${border}`, background: '#fff', color: text, fontSize: 13, fontWeight: 700 }}>
          Data-room
        </Link>
      </div>
    </div>
  );
}
