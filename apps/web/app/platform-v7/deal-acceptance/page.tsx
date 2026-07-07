import Link from 'next/link';
import { DEAL_ACCEPTANCE_STATE, acceptanceStageLabel, acceptanceStatusLabel, kgToTonsString } from '@/lib/platform-v7/dealAcceptanceEngine';

const state = DEAL_ACCEPTANCE_STATE;

export default function DealAcceptancePage() {
  return (
    <main style={{ display: 'grid', gap: 16 }}>
      <section style={{ border: '1px solid var(--pc-border)', background: 'var(--pc-shell-surface)', borderRadius: 22, padding: 18, boxShadow: 'var(--pc-shadow-sm)', display: 'grid', gap: 10 }}>
        <span style={{ fontSize: 11, fontWeight: 900, color: 'var(--pc-accent)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Рейс → приёмка</span>
        <h1 style={{ margin: 0, fontSize: 'clamp(24px, 5vw, 38px)', color: 'var(--pc-text-primary)', lineHeight: 1.08 }}>{acceptanceStageLabel(state.stage)}</h1>
        <p style={{ margin: 0, maxWidth: 840, fontSize: 14, lineHeight: 1.55, color: 'var(--pc-text-secondary)' }}>Приёмка фиксирует не только факт прибытия, а доказательства: время, место, машина, СДИЗ, вес, качество, источник данных и отклонения. Эти факты становятся основанием для документов, банковского шага или спора.</p>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 12 }}>
        {[
          ['Сделка', state.dealId],
          ['Рейс', state.routeId],
          ['ФГИС-лот', state.lotNumber],
          ['СДИЗ', state.sdizNumber],
          ['Машина', state.vehiclePlate],
          ['Элеватор', state.elevatorName],
        ].map(([label, value]) => (
          <div key={label} style={{ border: '1px solid var(--pc-border)', background: 'var(--pc-shell-surface)', borderRadius: 18, padding: 14, display: 'grid', gap: 5 }}>
            <span style={{ fontSize: 10, fontWeight: 900, color: 'var(--pc-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
            <strong style={{ fontSize: 15, color: 'var(--pc-text-primary)' }}>{value}</strong>
          </div>
        ))}
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 12 }}>
        <div style={{ border: '1px solid var(--pc-border)', background: 'var(--pc-shell-surface)', borderRadius: 20, padding: 16, display: 'grid', gap: 10 }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>Прибытие и вес</h2>
          {[
            ['Окно прибытия', state.arrival.expectedWindow],
            ['Факт прибытия', state.arrival.fixedAt],
            ['Геоточка', state.arrival.geoPoint],
            ['Брутто', kgToTonsString(state.weight.grossKg)],
            ['Тара', kgToTonsString(state.weight.tareKg)],
            ['Нетто', kgToTonsString(state.weight.netKg)],
            ['Отклонение', kgToTonsString(state.weight.deltaKg)],
          ].map(([label, value]) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '9px 10px', borderRadius: 12, background: 'var(--pc-shell-surface-soft)', border: '1px solid var(--pc-border)' }}>
              <span style={{ fontSize: 12, color: 'var(--pc-text-secondary)' }}>{label}</span>
              <strong style={{ fontSize: 12, color: 'var(--pc-text-primary)' }}>{value}</strong>
            </div>
          ))}
        </div>

        <div style={{ border: '1px solid var(--pc-border)', background: 'var(--pc-shell-surface)', borderRadius: 20, padding: 16, display: 'grid', gap: 10 }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>Качество</h2>
          {state.quality.map((item) => (
            <div key={item.label} style={{ display: 'grid', gap: 4, padding: '9px 10px', borderRadius: 12, background: 'var(--pc-shell-surface-soft)', border: '1px solid var(--pc-border)' }}>
              <strong style={{ fontSize: 12, color: 'var(--pc-text-primary)' }}>{item.label}</strong>
              <span style={{ fontSize: 11, color: 'var(--pc-text-secondary)' }}>договор: {item.contractValue} · факт: {item.actualValue}</span>
              <span style={{ fontSize: 11, color: 'var(--pc-text-muted)' }}>{acceptanceStatusLabel(item.status)}</span>
            </div>
          ))}
        </div>
      </section>

      <section style={{ border: '1px solid var(--pc-border)', background: 'var(--pc-shell-surface)', borderRadius: 20, padding: 16, display: 'grid', gap: 10 }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>Доказательства</h2>
        {state.evidence.map((item) => (
          <div key={item.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 10, alignItems: 'center', padding: 12, borderRadius: 14, border: '1px solid var(--pc-border)', background: 'var(--pc-shell-surface-soft)' }}>
            <div style={{ display: 'grid', gap: 3 }}>
              <strong style={{ fontSize: 13, color: 'var(--pc-text-primary)' }}>{item.label}</strong>
              <span style={{ fontSize: 11, color: 'var(--pc-text-muted)' }}>{item.source} · {item.fixedAt}</span>
            </div>
            <strong style={{ fontSize: 12, color: 'var(--pc-text-primary)' }}>{acceptanceStatusLabel(item.status)}</strong>
          </div>
        ))}
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
