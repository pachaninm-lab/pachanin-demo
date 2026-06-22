import Link from 'next/link';
import { selectDealById, selectDisputesByDealId } from '@/lib/domain/selectors';
import { getDeal360Scenario } from '@/lib/platform-v7/deal360-source-of-truth';
import { DealClosureReceipt } from '@/components/platform-v7/DealClosureReceipt';

const border = 'var(--pc-border, #E4E6EA)';
const text = 'var(--pc-text-primary, #0F1419)';
const muted = 'var(--pc-text-secondary, #475569)';
const green = '#0A7A5F';
const greenBg = 'rgba(10,122,95,0.08)';

function rub(value: number) {
  return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(value);
}

// Согласовано с банковским экраном: технический вендор ЭДО показывается ролевым названием.
function providerLabel(source: string) {
  if (source.includes('Saby') || source.includes('СБИС')) return 'ЭДО-провайдер ЭТрН';
  return source;
}

// Презентационная happy-path цепочка закрытия. Не доменный статус — это итоговый
// рассказ «что произошло» для уже закрытой сделки.
const CLOSURE_TIMELINE: ReadonlyArray<{ title: string; value: string }> = [
  { title: 'Лот', value: 'опубликован и принят' },
  { title: 'Сделка', value: 'стороны и допуски зафиксированы' },
  { title: 'Резерв', value: 'подтверждён банком' },
  { title: 'Рейс', value: 'выполнен, груз доставлен' },
  { title: 'Приёмка', value: 'вес принят, акт подписан' },
  { title: 'Качество', value: 'протокол закрыт без расхождений' },
  { title: 'Документы', value: 'полный пакет закрыт' },
  { title: 'Выплата', value: 'основание подтверждено, расчёт проведён' },
  { title: 'Сделка', value: 'закрыта и переведена в архив' },
];

export default function PlatformV7DealClosePage({ params }: { params: { id: string } }) {
  const deal = selectDealById(params.id);

  if (!deal) {
    return (
      <main style={{ display: 'grid', gap: 16 }}>
        <section style={card()}>
          <p style={{ margin: 0, color: '#B91C1C', fontWeight: 900 }}>Сделка не найдена</p>
          <h1 style={{ margin: '6px 0 0', fontSize: 28, color: text }}>{params.id}</h1>
          <p style={{ color: muted }}>В доменном контуре нет такой сделки.</p>
          <Link href='/platform-v7/deals' style={linkStyle()}>Все сделки</Link>
        </section>
      </main>
    );
  }

  const scenario = getDeal360Scenario(deal.id);
  const disputes = selectDisputesByDealId(deal.id);
  const isClosed = deal.status === 'closed';

  if (!isClosed) {
    return (
      <main style={{ display: 'grid', gap: 16 }}>
        <section style={card()}>
          <p style={{ margin: 0, color: '#B45309', fontSize: 12, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Сделка ещё в работе</p>
          <h1 style={{ margin: '6px 0 0', fontSize: 26, color: text }}>{deal.id} · {scenario.lotId}</h1>
          <p style={{ color: muted, lineHeight: 1.55 }}>Экран закрытия станет доступен, когда расчёт по сделке будет завершён. Сейчас сделка ещё проходит контур исполнения.</p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Link href={`/platform-v7/deals/${deal.id}/clean`} style={linkStyle('accent')}>Открыть карточку сделки</Link>
            <Link href='/platform-v7/deals' style={linkStyle()}>Все сделки</Link>
          </div>
        </section>
      </main>
    );
  }

  const journalHref = `/platform-v7/deals/${deal.id}/audit`;

  return (
    <main data-testid='platform-v7-deal-close' style={{ display: 'grid', gap: 16 }}>
      {/* Терминальный экран закрытия — успех */}
      <section style={{ position: 'relative', overflow: 'hidden', border: '1px solid rgba(10,122,95,0.22)', borderRadius: 24, padding: 24, background: 'linear-gradient(135deg, #ECFDF3 0%, #F8FAFB 60%, #FFFFFF 100%)', boxShadow: '0 18px 44px rgba(10,122,95,0.08)' }}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div aria-hidden style={{ flexShrink: 0, width: 56, height: 56, borderRadius: 18, display: 'grid', placeItems: 'center', background: green, color: '#fff', fontSize: 30, fontWeight: 900, boxShadow: '0 12px 26px rgba(10,122,95,0.28)' }}>✓</div>
          <div style={{ display: 'grid', gap: 8, minWidth: 0 }}>
            <span style={{ width: 'fit-content', padding: '6px 11px', borderRadius: 999, background: greenBg, color: green, fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Сделка закрыта · расчёт завершён</span>
            <h1 style={{ margin: 0, fontSize: 'clamp(28px,5vw,42px)', lineHeight: 1.05, letterSpacing: '-0.04em', color: text, fontWeight: 950 }}>{deal.id} · расчёт завершён</h1>
            <p style={{ margin: 0, color: muted, fontSize: 15, lineHeight: 1.55, maxWidth: 720 }}>
              Деньги рассчитаны, документы закрыты, доказательства собраны. Сделка переведена в архив исполнения и больше не держит резервы и удержания.
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 2 }}>
              <Party label='Продавец' value={deal.seller?.name ?? '—'} />
              <Party label='Покупатель' value={deal.buyer?.name ?? '—'} />
              <Party label='Партия' value={`${deal.grain} · ${deal.quantity} ${deal.unit}`} />
            </div>
          </div>
        </div>
      </section>

      {/* Денежный и контрольный итог */}
      <section style={grid()}>
        <Stat label='Удержание' value={rub(deal.holdAmount)} ok={deal.holdAmount === 0} />
        <Stat label='Открытых споров' value={String(disputes.length)} ok={disputes.length === 0} />
        <Stat label='Документы' value='пакет закрыт' ok />
        <Stat label='Рейс и приёмка' value='завершены' ok />
      </section>

      {/* Что произошло — таймлайн закрытия */}
      <section style={card()}>
        <p style={micro}>Что произошло</p>
        <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
          {CLOSURE_TIMELINE.map((step, index) => (
            <div key={`${step.title}-${index}`} style={{ display: 'grid', gridTemplateColumns: '26px auto 1fr', gap: 12, alignItems: 'center', padding: '10px 12px', borderRadius: 14, border: `1px solid ${border}`, background: '#fff' }}>
              <span aria-hidden style={{ width: 26, height: 26, borderRadius: 999, display: 'grid', placeItems: 'center', background: greenBg, color: green, fontSize: 13, fontWeight: 900 }}>✓</span>
              <strong style={{ color: text, fontSize: 13, fontWeight: 900 }}>{step.title}</strong>
              <span style={{ color: muted, fontSize: 13, lineHeight: 1.35 }}>{step.value}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Документы — закрыты */}
      <section style={card()}>
        <p style={micro}>Документы сделки · закрыты</p>
        <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
          {scenario.documents.map((doc) => (
            <div key={`${doc.title}-${doc.source}`} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center', border: `1px solid ${border}`, borderRadius: 14, padding: '10px 12px', background: '#fff' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ color: text, fontSize: 13, fontWeight: 900 }}>{doc.title}</div>
                <div style={{ color: muted, fontSize: 12 }}>{providerLabel(doc.source)} · {doc.responsible}</div>
              </div>
              <span style={{ flexShrink: 0, padding: '5px 10px', borderRadius: 999, background: greenBg, border: '1px solid rgba(10,122,95,0.18)', color: green, fontSize: 12, fontWeight: 900 }}>закрыт</span>
            </div>
          ))}
        </div>
      </section>

      {/* Досье и доказательства */}
      <section style={{ ...card(), display: 'grid', gap: 12 }}>
        <p style={micro}>Досье, доказательства и журнал</p>
        <p style={{ margin: 0, color: muted, fontSize: 13, lineHeight: 1.55 }}>
          Полное досье закрытой сделки доступно для скачивания, доказательный пакет и журнал событий сохранены без изменений.
        </p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Link href={`/platform-v7/deals/${deal.id}/documents`} style={linkStyle('accent')}>Скачать досье</Link>
          <Link href={`/platform-v7/deals/${deal.id}/evidence-pack`} style={linkStyle()}>Доказательный пакет</Link>
          <Link href={journalHref} style={linkStyle()}>Журнал сделки</Link>
          <Link href='/platform-v7/deals' style={linkStyle()}>Все сделки</Link>
        </div>
      </section>

      <DealClosureReceipt dealId={deal.id} journalHref={journalHref} />
    </main>
  );
}

function Party({ label, value }: { label: string; value: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 6, padding: '6px 10px', borderRadius: 999, background: 'rgba(255,255,255,0.7)', border: `1px solid ${border}` }}>
      <span style={{ color: muted, fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
      <span style={{ color: text, fontSize: 13, fontWeight: 850 }}>{value}</span>
    </span>
  );
}

function Stat({ label, value, ok = false }: { label: string; value: string; ok?: boolean }) {
  return (
    <div style={card()}>
      <p style={{ margin: 0, color: muted, fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</p>
      <p style={{ margin: '6px 0 0', color: ok ? green : text, fontSize: 18, fontWeight: 950 }}>{value}</p>
    </div>
  );
}

function card(): React.CSSProperties {
  return { background: '#fff', border: `1px solid ${border}`, borderRadius: 18, padding: 20 };
}

function grid(): React.CSSProperties {
  return { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12 };
}

function linkStyle(tone: 'default' | 'accent' = 'default'): React.CSSProperties {
  if (tone === 'accent') {
    return { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', color: '#fff', background: green, border: `1px solid ${green}`, borderRadius: 12, padding: '10px 14px', fontWeight: 900, boxShadow: '0 12px 26px rgba(10,122,95,0.18)' };
  }
  return { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', color: green, border: `1px solid ${border}`, borderRadius: 12, padding: '10px 14px', fontWeight: 900, background: '#fff' };
}
