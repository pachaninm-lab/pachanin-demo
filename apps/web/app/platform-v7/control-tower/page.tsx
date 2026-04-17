import Link from 'next/link';
import { CALLBACKS, DEALS, DISPUTES } from '@/lib/v7r/data';
import { formatCompactMoney, statusLabel } from '@/lib/v7r/helpers';

export default function PlatformV7ControlTowerPage() {
  const activeDeals = DEALS.filter((d) => d.status !== 'closed');
  const totalReserved = activeDeals.reduce((sum, d) => sum + d.reservedAmount, 0);
  const totalHold = activeDeals.reduce((sum, d) => sum + d.holdAmount, 0);
  const totalRelease = activeDeals.reduce((sum, d) => sum + (d.releaseAmount ?? Math.max(d.reservedAmount - d.holdAmount, 0)), 0);
  const criticalDeals = activeDeals
    .slice()
    .sort((a, b) => b.riskScore - a.riskScore || b.holdAmount - a.holdAmount)
    .slice(0, 4);
  const overdue = activeDeals.filter((d) => d.slaDeadline && new Date(d.slaDeadline) < new Date('2026-04-17')).length;
  const releaseRequested = activeDeals.filter((d) => d.status === 'release_requested').length;

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 12, color: '#6B778C', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Control Tower</div>
            <div style={{ fontSize: 30, lineHeight: 1.1, fontWeight: 900, color: '#0F1419', marginTop: 8 }}>Центр управления исполнением сделки</div>
            <div style={{ marginTop: 8, fontSize: 14, color: '#6B778C', maxWidth: 860 }}>Здесь должно быть видно, что горит, где деньги, где hold и что именно оператору делать следующим шагом.</div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Link href="/platform-v7/deals" style={btn()}>Сделки</Link>
            <Link href="/platform-v7/bank" style={btn('primary')}>Банк</Link>
          </div>
        </div>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 14 }}>
        <Metric title="Активные сделки" value={String(activeDeals.length)} subtitle="Все кейсы без архива" href="/platform-v7/deals" />
        <Metric title="В резерве" value={formatCompactMoney(totalReserved)} subtitle="Сумма денег в контуре" href="/platform-v7/bank" />
        <Metric title="Под hold" value={formatCompactMoney(totalHold)} subtitle="Заморожено из-за споров и проверок" href="/platform-v7/disputes" tone="red" />
        <Metric title="К выпуску" value={formatCompactMoney(totalRelease)} subtitle="Деньги, которые можно двигать дальше" href="/platform-v7/bank" tone="green" />
      </div>

      <section style={{ display: 'grid', gridTemplateColumns: '1.15fr 0.85fr', gap: 16 }}>
        <div style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#0F1419' }}>Приоритеты оператора</div>
              <div style={{ marginTop: 4, fontSize: 13, color: '#6B778C' }}>Сначала споры и hold, потом release, потом всё остальное.</div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Badge tone="red">Просрочка SLA: {overdue}</Badge>
              <Badge tone="amber">Release requested: {releaseRequested}</Badge>
            </div>
          </div>

          <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
            {criticalDeals.map((deal) => (
              <div key={deal.id} style={{ border: '1px solid #E4E6EA', borderRadius: 14, padding: 14, display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 12, alignItems: 'center' }}>
                <div style={{ display: 'grid', gap: 6 }}>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 800, color: '#0A7A5F', fontSize: 13 }}>{deal.id}</span>
                    <Badge tone={deal.riskScore >= 70 ? 'red' : deal.status === 'release_requested' ? 'amber' : 'blue'}>{statusLabel(deal.status)}</Badge>
                    <Badge tone={deal.riskScore >= 70 ? 'red' : deal.riskScore >= 30 ? 'amber' : 'green'}>Риск {deal.riskScore}</Badge>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: '#0F1419' }}>{deal.grain} · {deal.quantity} {deal.unit} · {formatCompactMoney(deal.reservedAmount)}</div>
                  <div style={{ fontSize: 12, color: '#6B778C' }}>Лот: {deal.lotId ?? '—'} · Маршрут: {deal.routeId ?? '—'} · SLA: {deal.slaDeadline ?? '—'}</div>
                  <div style={{ fontSize: 13, color: '#334155' }}>
                    {deal.status === 'quality_disputed' ? 'Следующий шаг: закрыть спор и снять hold.' : deal.status === 'release_requested' ? 'Следующий шаг: подтвердить выпуск денег.' : deal.status === 'docs_complete' ? 'Следующий шаг: запросить выпуск денег.' : 'Следующий шаг: довести сделку до следующего этапа.'}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  <Link href={`/platform-v7/deals/${deal.id}`} style={btn()}>Открыть</Link>
                  {deal.status === 'release_requested' ? <Link href="/platform-v7/bank" style={btn('primary')}>Release</Link> : null}
                  {deal.status === 'quality_disputed' ? <Link href="/platform-v7/disputes" style={btn('danger')}>Спор</Link> : null}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gap: 16 }}>
          <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18 }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#0F1419' }}>Деньги по этапам</div>
            <div style={{ display: 'grid', gap: 12, marginTop: 14 }}>
              <MoneyBar label="Резерв" value={totalReserved} max={totalReserved + totalHold + totalRelease} tone="blue" />
              <MoneyBar label="Hold" value={totalHold} max={totalReserved + totalHold + totalRelease} tone="red" />
              <MoneyBar label="К выпуску" value={totalRelease} max={totalReserved + totalHold + totalRelease} tone="green" />
            </div>
            <div style={{ marginTop: 12, fontSize: 12, color: '#6B778C' }}>График простой, но уже показывает, где деньги застряли и где их можно двигать.</div>
          </section>

          <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18 }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#0F1419' }}>Воронка</div>
            <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
              <FunnelRow label="Лоты" value="12" note="Каталог пилотного контура" />
              <FunnelRow label="Сделки" value={String(DEALS.length)} note="Все доменные кейсы" />
              <FunnelRow label="Активные" value={String(activeDeals.length)} note="Не закрытые сделки" />
              <FunnelRow label="Release requested" value={String(releaseRequested)} note="Готовы к движению денег" />
            </div>
          </section>

          <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18 }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#0F1419' }}>Сигналы системы</div>
            <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
              <Signal title="Банк" detail={`${CALLBACKS.length} callback-события уже в контуре.`} href="/platform-v7/bank" />
              <Signal title="Споры" detail={`${DISPUTES.length} активных кейса под удержанием.`} href="/platform-v7/disputes" />
              <Signal title="Логистика" detail={`${activeDeals.filter((d) => d.routeId).length} маршрутов связаны со сделками.`} href="/platform-v7/logistics" />
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}

function Metric({ title, value, subtitle, href, tone = 'default' }: { title: string; value: string; subtitle: string; href: string; tone?: 'default' | 'red' | 'green' }) {
  const bg = tone === 'red' ? '#FEF2F2' : tone === 'green' ? '#F0FDF4' : '#fff';
  const border = tone === 'red' ? '#FECACA' : tone === 'green' ? '#BBF7D0' : '#E4E6EA';
  return (
    <Link href={href} style={{ textDecoration: 'none', background: bg, border: `1px solid ${border}`, borderRadius: 18, padding: 18, display: 'block' }}>
      <div style={{ fontSize: 11, color: '#6B778C', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{title}</div>
      <div style={{ marginTop: 8, fontSize: 28, lineHeight: 1.1, fontWeight: 900, color: '#0F1419' }}>{value}</div>
      <div style={{ marginTop: 8, fontSize: 12, color: '#6B778C' }}>{subtitle}</div>
    </Link>
  );
}

function Badge({ tone, children }: { tone: 'green' | 'amber' | 'red' | 'blue'; children: React.ReactNode }) {
  const palette = tone === 'green'
    ? { bg: 'rgba(22,163,74,0.08)', border: 'rgba(22,163,74,0.18)', color: '#15803D' }
    : tone === 'amber'
    ? { bg: 'rgba(217,119,6,0.08)', border: 'rgba(217,119,6,0.18)', color: '#B45309' }
    : tone === 'blue'
    ? { bg: 'rgba(37,99,235,0.08)', border: 'rgba(37,99,235,0.18)', color: '#1D4ED8' }
    : { bg: 'rgba(220,38,38,0.08)', border: 'rgba(220,38,38,0.18)', color: '#B91C1C' };
  return <span style={{ display: 'inline-flex', alignItems: 'center', padding: '4px 8px', borderRadius: 999, background: palette.bg, border: `1px solid ${palette.border}`, color: palette.color, fontSize: 11, fontWeight: 800 }}>{children}</span>;
}

function MoneyBar({ label, value, max, tone }: { label: string; value: number; max: number; tone: 'green' | 'red' | 'blue' }) {
  const width = max ? Math.max(6, Math.round((value / max) * 100)) : 0;
  const color = tone === 'green' ? '#16A34A' : tone === 'red' ? '#DC2626' : '#2563EB';
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 6 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#0F1419' }}>{label}</span>
        <span style={{ fontSize: 12, color: '#6B778C' }}>{formatCompactMoney(value)}</span>
      </div>
      <div style={{ height: 10, borderRadius: 999, background: '#F1F5F9', overflow: 'hidden' }}>
        <div style={{ width: `${width}%`, height: '100%', background: color, borderRadius: 999 }} />
      </div>
    </div>
  );
}

function FunnelRow({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'center', border: '1px solid #E4E6EA', borderRadius: 14, padding: 14 }}>
      <div>
        <div style={{ fontSize: 14, fontWeight: 800, color: '#0F1419' }}>{label}</div>
        <div style={{ marginTop: 4, fontSize: 12, color: '#6B778C' }}>{note}</div>
      </div>
      <div style={{ fontSize: 24, fontWeight: 900, color: '#0F1419' }}>{value}</div>
    </div>
  );
}

function Signal({ title, detail, href }: { title: string; detail: string; href: string }) {
  return (
    <Link href={href} style={{ textDecoration: 'none', borderRadius: 14, padding: 14, background: '#F8FAFB', border: '1px solid #E4E6EA', display: 'grid', gap: 6 }}>
      <div style={{ fontSize: 14, fontWeight: 900, color: '#0F1419' }}>{title}</div>
      <div style={{ fontSize: 12, color: '#6B778C' }}>{detail}</div>
    </Link>
  );
}

function btn(kind: 'default' | 'primary' | 'danger' = 'default'): React.CSSProperties {
  if (kind === 'primary') return { textDecoration: 'none', borderRadius: 10, padding: '8px 12px', background: '#0A7A5F', border: '1px solid #0A7A5F', color: '#fff', fontWeight: 700, fontSize: 12 };
  if (kind === 'danger') return { textDecoration: 'none', borderRadius: 10, padding: '8px 12px', background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.18)', color: '#B91C1C', fontWeight: 700, fontSize: 12 };
  return { textDecoration: 'none', borderRadius: 10, padding: '8px 12px', background: '#fff', border: '1px solid #E4E6EA', color: '#0F1419', fontWeight: 700, fontSize: 12 };
}
