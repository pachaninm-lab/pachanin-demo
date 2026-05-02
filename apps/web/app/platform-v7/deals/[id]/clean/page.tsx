import Link from 'next/link';
import { notFound } from 'next/navigation';
import { DISPUTES, getDealById, getDealIntegrationState } from '@/lib/v7r/data';
import { formatCompactMoney, statusLabel } from '@/lib/v7r/helpers';

function cell(label: string, value: string, tone: 'base' | 'good' | 'warn' | 'danger' = 'base') {
  const color = tone === 'good' ? '#0A7A5F' : tone === 'warn' ? '#B45309' : tone === 'danger' ? '#B91C1C' : '#0F1419';
  const border = tone === 'good' ? 'rgba(10,122,95,0.18)' : tone === 'warn' ? 'rgba(217,119,6,0.18)' : tone === 'danger' ? 'rgba(220,38,38,0.18)' : '#E4E6EA';
  const bg = tone === 'base' ? '#fff' : tone === 'good' ? 'rgba(10,122,95,0.06)' : tone === 'warn' ? 'rgba(217,119,6,0.06)' : 'rgba(220,38,38,0.06)';
  return { label, value, color, border, bg };
}

export default function PlatformV7CleanDealPage({ params }: { params: { id: string } }) {
  const deal = getDealById(params.id);
  if (!deal) return notFound();

  const state = getDealIntegrationState(deal.id, deal.lotId);
  const dispute = deal.dispute ? DISPUTES.find((item) => item.id === deal.dispute?.id) : null;
  const payable = state.gateState === 'FAIL' ? 0 : (deal.releaseAmount ?? Math.max(deal.reservedAmount - deal.holdAmount, 0));
  const hasStop = state.gateState === 'FAIL' || deal.holdAmount > 0 || Boolean(dispute);

  const money = [
    cell('Резерв', formatCompactMoney(deal.reservedAmount), deal.reservedAmount > 0 ? 'good' : 'warn'),
    cell('Удержано', formatCompactMoney(deal.holdAmount), deal.holdAmount > 0 ? 'danger' : 'good'),
    cell('К выплате', formatCompactMoney(payable), payable > 0 && !hasStop ? 'good' : 'warn'),
    cell('Статус', statusLabel(deal.status), hasStop ? 'warn' : 'good'),
  ];

  const checks = [
    cell('Документы', deal.blockers.includes('docs') ? 'Пакет неполный' : 'Критичных пробелов нет', deal.blockers.includes('docs') ? 'danger' : 'good'),
    cell('Логистика', deal.routeId ? deal.routeId : 'Маршрут не назначен', deal.routeId ? 'good' : 'warn'),
    cell('Интеграционная проверка', state.gateState === 'PASS' ? 'Пройдена' : state.gateState === 'REVIEW' ? 'Нужна сверка' : 'Остановлено', state.gateState === 'PASS' ? 'good' : state.gateState === 'REVIEW' ? 'warn' : 'danger'),
    cell('Спор', dispute ? dispute.id : 'Нет открытого спора', dispute ? 'danger' : 'good'),
  ];

  return (
    <main style={{ display: 'grid', gap: 18 }}>
      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 20, padding: 22, display: 'grid', gap: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 12, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 900 }}>Чистая карточка сделки</div>
            <h1 style={{ margin: '8px 0 0', fontSize: 32, lineHeight: 1.08, color: '#0F1419' }}>{deal.id}</h1>
            <p style={{ margin: '8px 0 0', color: '#475569', fontSize: 14, lineHeight: 1.6 }}>{deal.grain} · {deal.quantity} {deal.unit} · {deal.seller.name} → {deal.buyer.name}</p>
          </div>
          <span style={{ display: 'inline-flex', padding: '7px 11px', borderRadius: 999, background: hasStop ? 'rgba(217,119,6,0.08)' : 'rgba(10,122,95,0.08)', border: hasStop ? '1px solid rgba(217,119,6,0.18)' : '1px solid rgba(10,122,95,0.18)', color: hasStop ? '#B45309' : '#0A7A5F', fontSize: 12, fontWeight: 900 }}>{hasStop ? 'Требует внимания' : 'Можно вести дальше'}</span>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Link href="/platform-v7/deals" style={secondary}>Все сделки</Link>
          <Link href={`/platform-v7/deals/${deal.id}/documents`} style={secondary}>Документы</Link>
          <Link href="/platform-v7/bank/clean" style={primary}>Деньги</Link>
        </div>
      </section>

      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18, display: 'grid', gap: 14 }}>
        <h2 style={{ margin: 0, fontSize: 20, color: '#0F1419' }}>Деньги</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 }}>
          {money.map((item) => <Box key={item.label} {...item} />)}
        </div>
      </section>

      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18, display: 'grid', gap: 14 }}>
        <h2 style={{ margin: 0, fontSize: 20, color: '#0F1419' }}>Контроль исполнения</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12 }}>
          {checks.map((item) => <Box key={item.label} {...item} />)}
        </div>
        <div style={{ padding: 14, borderRadius: 14, background: hasStop ? 'rgba(217,119,6,0.08)' : 'rgba(10,122,95,0.08)', border: hasStop ? '1px solid rgba(217,119,6,0.18)' : '1px solid rgba(10,122,95,0.18)', color: hasStop ? '#92400E' : '#065F46', fontSize: 13, lineHeight: 1.6, fontWeight: 700 }}>
          {hasStop ? (state.nextStep ?? 'Нужна ручная сверка перед продолжением сделки.') : 'Критичных остановок не видно. Следующий шаг можно выполнять в основном контуре сделки.'}
        </div>
      </section>

      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18, display: 'grid', gap: 12 }}>
        <h2 style={{ margin: 0, fontSize: 20, color: '#0F1419' }}>Быстрые переходы</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
          <LinkCard href="/platform-v7/logistics" title="Логистика" note="Рейс, инциденты, отклонения." />
          <LinkCard href="/platform-v7/bank/release-safety" title="Проверка выплаты" note="Условия выпуска денег." />
          <LinkCard href={dispute ? `/platform-v7/disputes/${dispute.id}` : '/platform-v7/disputes'} title="Спор" note="Основание и доказательства." />
          <LinkCard href="/platform-v7/control-tower" title="Центр управления" note="Очередь проблем и ответственные." />
        </div>
      </section>
    </main>
  );
}

function Box({ label, value, color, border, bg }: { label: string; value: string; color: string; border: string; bg: string }) {
  return <div style={{ border: `1px solid ${border}`, background: bg, borderRadius: 14, padding: 14 }}><div style={{ fontSize: 11, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 900 }}>{label}</div><div style={{ marginTop: 7, color, fontSize: 17, fontWeight: 900, overflowWrap: 'anywhere' }}>{value}</div></div>;
}

function LinkCard({ href, title, note }: { href: string; title: string; note: string }) {
  return <Link href={href} style={{ textDecoration: 'none', display: 'grid', gap: 6, border: '1px solid #E4E6EA', borderRadius: 14, padding: 14, background: '#F8FAFB' }}><strong style={{ color: '#0F1419', fontSize: 14 }}>{title}</strong><span style={{ color: '#64748B', fontSize: 12, lineHeight: 1.45 }}>{note}</span></Link>;
}

const primary = { display: 'inline-flex', alignItems: 'center', minHeight: 42, padding: '10px 14px', borderRadius: 12, background: '#0A7A5F', color: '#fff', textDecoration: 'none', fontSize: 13, fontWeight: 900 } as const;
const secondary = { ...primary, background: '#fff', color: '#0F1419', border: '1px solid #CBD5E1' } as const;
