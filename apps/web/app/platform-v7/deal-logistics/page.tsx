import Link from 'next/link';
import { DEAL_LOGISTICS_STATE, logisticsAdmissionLabel, logisticsStageLabel } from '@/lib/platform-v7/dealLogisticsEngine';

const state = DEAL_LOGISTICS_STATE;

function statusText(value: string) {
  if (value === 'ok') return 'готово';
  if (value === 'review') return 'проверка';
  return 'закрыто';
}

export default function DealLogisticsPage() {
  return (
    <main style={{ display: 'grid', gap: 16 }}>
      <section style={{ border: '1px solid var(--pc-border)', background: 'var(--pc-shell-surface)', borderRadius: 22, padding: 18, boxShadow: 'var(--pc-shadow-sm)', display: 'grid', gap: 10 }}>
        <span style={{ fontSize: 11, fontWeight: 900, color: 'var(--pc-accent)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Сделка → рейс</span>
        <h1 style={{ margin: 0, fontSize: 'clamp(24px, 5vw, 38px)', color: 'var(--pc-text-primary)', lineHeight: 1.08 }}>{logisticsStageLabel(state.stage)}</h1>
        <p style={{ margin: 0, maxWidth: 820, fontSize: 14, lineHeight: 1.55, color: 'var(--pc-text-secondary)' }}>Рейс создаётся из основания сделки: лот ФГИС, СДИЗ, покупатель, продавец, объём и базис остаются связаны с маршрутом, водителем, приёмкой, документами и банковским шагом.</p>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 12 }}>
        {[
          ['Сделка', state.dealId],
          ['ФГИС-лот', state.lotNumber],
          ['СДИЗ', state.sdizNumber],
          ['Продавец', state.sellerName],
          ['Покупатель', state.buyerName],
          ['Объём', `${state.volumeTons} т`],
        ].map(([label, value]) => (
          <div key={label} style={{ border: '1px solid var(--pc-border)', background: 'var(--pc-shell-surface)', borderRadius: 18, padding: 14, display: 'grid', gap: 5 }}>
            <span style={{ fontSize: 10, fontWeight: 900, color: 'var(--pc-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
            <strong style={{ fontSize: 15, color: 'var(--pc-text-primary)' }}>{value}</strong>
          </div>
        ))}
      </section>

      <section style={{ border: '1px solid var(--pc-border)', background: 'var(--pc-shell-surface)', borderRadius: 20, padding: 16, display: 'grid', gap: 10 }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>Маршрут</h2>
        {state.route.map((point, index) => (
          <div key={point.label} style={{ display: 'grid', gridTemplateColumns: '32px minmax(0,1fr)', gap: 10, alignItems: 'start', padding: 12, borderRadius: 14, border: '1px solid var(--pc-border)', background: 'var(--pc-shell-surface-soft)' }}>
            <span style={{ width: 28, height: 28, borderRadius: 999, background: 'var(--pc-accent-bg)', color: 'var(--pc-accent-strong)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 950 }}>{index + 1}</span>
            <div style={{ display: 'grid', gap: 3 }}>
              <strong style={{ fontSize: 13, color: 'var(--pc-text-primary)' }}>{point.label}</strong>
              <span style={{ fontSize: 11, color: 'var(--pc-text-secondary)' }}>{point.address}</span>
              <span style={{ fontSize: 11, color: 'var(--pc-text-muted)' }}>{point.window} · {point.owner}</span>
            </div>
          </div>
        ))}
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 12 }}>
        <div style={{ border: '1px solid var(--pc-border)', background: 'var(--pc-shell-surface)', borderRadius: 20, padding: 16, display: 'grid', gap: 10 }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>Машина и водитель</h2>
          {[
            ['Перевозчик', state.vehicle.carrierName],
            ['Машина', state.vehicle.plate],
            ['Водитель', state.vehicle.driverName],
            ['Контакт', state.vehicle.driverPhoneMasked],
            ['Грузоподъёмность', `${state.vehicle.capacityTons} т`],
            ['Допуск', logisticsAdmissionLabel(state.vehicle.admission)],
          ].map(([label, value]) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '9px 10px', borderRadius: 12, background: 'var(--pc-shell-surface-soft)', border: '1px solid var(--pc-border)' }}>
              <span style={{ fontSize: 12, color: 'var(--pc-text-secondary)' }}>{label}</span>
              <strong style={{ fontSize: 12, color: 'var(--pc-text-primary)' }}>{value}</strong>
            </div>
          ))}
        </div>

        <div style={{ border: '1px solid var(--pc-border)', background: 'var(--pc-shell-surface)', borderRadius: 20, padding: 16, display: 'grid', gap: 10 }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>Контроль</h2>
          {state.controls.map((item) => (
            <div key={item.label} style={{ display: 'grid', gap: 3, padding: '9px 10px', borderRadius: 12, background: 'var(--pc-shell-surface-soft)', border: '1px solid var(--pc-border)' }}>
              <strong style={{ fontSize: 12, color: 'var(--pc-text-primary)' }}>{item.label}</strong>
              <span style={{ fontSize: 11, color: 'var(--pc-text-muted)' }}>{item.owner} · {statusText(item.status)}</span>
            </div>
          ))}
        </div>
      </section>

      <section style={{ border: '1px solid var(--pc-border)', background: 'var(--pc-shell-surface)', borderRadius: 20, padding: 16, display: 'grid', gap: 10 }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>Следующие действия</h2>
        {state.nextRoutes.map((route) => (
          <Link key={route.href} href={route.href} style={{ textDecoration: 'none', display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', padding: '10px 12px', borderRadius: 13, border: '1px solid var(--pc-border)', color: 'var(--pc-text-primary)', background: 'var(--pc-shell-surface-soft)' }}>
            <strong style={{ fontSize: 13 }}>{route.label}</strong>
            <span style={{ fontSize: 10, color: 'var(--pc-text-muted)' }}>{route.owner}</span>
          </Link>
        ))}
      </section>
    </main>
  );
}
