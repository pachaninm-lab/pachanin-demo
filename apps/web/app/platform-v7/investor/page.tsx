import Link from 'next/link';
import { CALLBACKS, DEALS, DISPUTES } from '@/lib/v7r/data';
import { formatCompactMoney } from '@/lib/v7r/helpers';

export default function InvestorPage() {
  const gmv = DEALS.reduce((sum, item) => sum + item.reservedAmount, 0);
  const hold = DEALS.reduce((sum, item) => sum + item.holdAmount, 0);
  const active = DEALS.filter((item) => item.status !== 'closed').length;
  const requestedRelease = DEALS.filter((item) => item.status === 'release_requested').length;
  const avgRisk = Math.round(DEALS.reduce((sum, item) => sum + item.riskScore, 0) / DEALS.length);

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 12, color: '#6B778C', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Investor mode</div>
            <div style={{ fontSize: 30, lineHeight: 1.1, fontWeight: 900, color: '#0F1419', marginTop: 8 }}>Платформенный контур в цифрах</div>
            <div style={{ marginTop: 8, fontSize: 14, color: '#6B778C', maxWidth: 840 }}>Здесь инвестор должен видеть не красивые слова, а движение сделок, денег, спорности и логики lot → deal → bank.</div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Link href="/platform-v7/control-tower" style={btn()}>Control Tower</Link>
            <Link href="/platform-v7/bank" style={btn('primary')}>Bank rail</Link>
          </div>
        </div>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 14 }}>
        <Metric title="GMV в контуре" value={formatCompactMoney(gmv)} subtitle="Сумма резервов по сделкам" />
        <Metric title="В холде" value={formatCompactMoney(hold)} subtitle="Деньги под спором или ручной верификацией" />
        <Metric title="Активные сделки" value={String(active)} subtitle="Без закрытых архивных кейсов" />
        <Metric title="Средний риск" value={String(avgRisk)} subtitle="Средняя спорность контура" />
      </div>

      <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18 }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#0F1419' }}>Воронка</div>
          <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
            <FunnelRow label="Лоты" value="12" note="Каталог пилотного контура" />
            <FunnelRow label="Сделки" value={String(DEALS.length)} note="Из них часть уже на деньгах" />
            <FunnelRow label="Активные сделки" value={String(active)} note="Исполняются прямо сейчас" />
            <FunnelRow label="Release requested" value={String(requestedRelease)} note="Готовы к выпуску денег" />
          </div>
        </div>

        <div style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18 }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#0F1419' }}>Что нужно показать инвестору</div>
          <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
            <Insight title="DL-9109" detail="Запрошен release на 10.5 млн ₽ — хороший демонстрационный кейс money rail." href="/platform-v7/deals/DL-9109" tone="green" />
            <Insight title="DL-9102" detail="Открытый спор с hold — показывает доказательный и арбитражный контур." href="/platform-v7/deals/DL-9102" tone="red" />
            <Insight title="Callbacks" detail={`${CALLBACKS.length} банковых события уже видны в отдельном rail.`} href="/platform-v7/bank" tone="blue" />
            <Insight title="Споры" detail={`${DISPUTES.length} активных кейса под удержанием.`} href="/platform-v7/disputes" tone="amber" />
          </div>
        </div>
      </section>
    </div>
  );
}

function Metric({ title, value, subtitle }: { title: string; value: string; subtitle: string }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18 }}>
      <div style={{ fontSize: 11, color: '#6B778C', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{title}</div>
      <div style={{ marginTop: 8, fontSize: 28, lineHeight: 1.1, fontWeight: 900, color: '#0F1419' }}>{value}</div>
      <div style={{ marginTop: 8, fontSize: 12, color: '#6B778C' }}>{subtitle}</div>
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

function Insight({ title, detail, href, tone }: { title: string; detail: string; href: string; tone: 'green' | 'red' | 'blue' | 'amber' }) {
  const bg = tone === 'green' ? '#F0FDF4' : tone === 'red' ? '#FEF2F2' : tone === 'blue' ? '#EFF6FF' : '#FFFBEB';
  const border = tone === 'green' ? '#BBF7D0' : tone === 'red' ? '#FECACA' : tone === 'blue' ? '#BFDBFE' : '#FDE68A';
  const color = tone === 'green' ? '#166534' : tone === 'red' ? '#991B1B' : tone === 'blue' ? '#1D4ED8' : '#B45309';
  return (
    <Link href={href} style={{ textDecoration: 'none', borderRadius: 14, padding: 14, background: bg, border: `1px solid ${border}`, display: 'grid', gap: 6 }}>
      <div style={{ fontSize: 14, fontWeight: 900, color }}>{title}</div>
      <div style={{ fontSize: 12, color }}>{detail}</div>
    </Link>
  );
}

function btn(kind: 'default' | 'primary' = 'default'): React.CSSProperties {
  return kind === 'primary'
    ? { textDecoration: 'none', borderRadius: 12, padding: '10px 12px', border: '1px solid #0A7A5F', background: '#0A7A5F', color: '#fff', fontWeight: 700 }
    : { textDecoration: 'none', borderRadius: 12, padding: '10px 12px', border: '1px solid #E4E6EA', background: '#fff', color: '#0F1419', fontWeight: 700 };
}
