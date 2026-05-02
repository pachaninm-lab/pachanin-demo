import Link from 'next/link';
import { DomainDealsSummary } from '@/components/v7r/DomainDealsSummary';
import { DealsOverviewRuntime } from '@/components/v7r/DealsOverviewRuntime';

const executionStops = [
  { label: 'Деньги', value: 'резерв и удержание', href: '/platform-v7/bank/clean' },
  { label: 'Документы', value: 'пакет и основания', href: '/platform-v7/documents' },
  { label: 'Логистика', value: 'рейс и отклонения', href: '/platform-v7/logistics' },
  { label: 'Спор', value: 'доказательства', href: '/platform-v7/disputes/DK-2024-89' },
] as const;

export default function PlatformV7DealsPage() {
  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <section style={{ background: 'linear-gradient(135deg, #FFFFFF 0%, #F8FAFB 60%, #EEF6F3 100%)', border: '1px solid #E4E6EA', borderRadius: 26, padding: 22, display: 'grid', gap: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div style={{ display: 'grid', gap: 9, maxWidth: 860 }}>
            <div style={{ display: 'inline-flex', width: 'fit-content', padding: '7px 11px', borderRadius: 999, background: 'rgba(10,122,95,0.08)', border: '1px solid rgba(10,122,95,0.18)', color: '#0A7A5F', fontSize: 12, fontWeight: 900 }}>
              Реестр исполнения сделки
            </div>
            <h1 style={{ margin: 0, fontSize: 'clamp(30px, 4.8vw, 52px)', lineHeight: 1.04, letterSpacing: '-0.045em', color: '#0F1419', fontWeight: 950 }}>
              Сделки: деньги, документы, рейс и спор в одном контуре
            </h1>
            <p style={{ margin: 0, color: '#475569', fontSize: 15, lineHeight: 1.7 }}>
              Этот экран нужен не для просмотра списка. Он должен сразу показать, какая сделка остановлена, где деньги, чего не хватает по документам, где груз и кто отвечает за следующий шаг.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Link href='/platform-v7/deals/DL-9102/clean' style={primary}>Открыть DL-9102</Link>
            <Link href='/platform-v7/control-tower' style={secondary}>Центр управления</Link>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10 }}>
          {executionStops.map((item) => (
            <Link key={item.label} href={item.href} style={{ textDecoration: 'none', background: '#fff', border: '1px solid #E4E6EA', borderRadius: 16, padding: 14, display: 'grid', gap: 7 }}>
              <span style={{ color: '#64748B', fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{item.label}</span>
              <strong style={{ color: '#0F1419', fontSize: 15 }}>{item.value}</strong>
            </Link>
          ))}
        </div>
      </section>

      <DomainDealsSummary />
      <DealsOverviewRuntime />
    </div>
  );
}

const primary = { textDecoration: 'none', display: 'inline-flex', alignItems: 'center', minHeight: 44, padding: '11px 14px', borderRadius: 14, background: '#0F172A', color: '#fff', fontSize: 14, fontWeight: 850 } as const;
const secondary = { ...primary, background: '#fff', color: '#0F1419', border: '1px solid #CBD5E1' } as const;
