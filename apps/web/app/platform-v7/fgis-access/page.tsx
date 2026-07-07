import Link from 'next/link';
import { FARMER_FGIS_ACCESS_STATE, fgisAccessStatusLabel, fgisPullStatusLabel } from '@/lib/platform-v7/farmerFgisAccessEngine';

const state = FARMER_FGIS_ACCESS_STATE;

function stepText(value: string) {
  if (value === 'ok') return 'готово';
  if (value === 'action') return 'действие';
  if (value === 'review') return 'проверка';
  return 'закрыто';
}

export default function FarmerFgisAccessPage() {
  return (
    <main style={{ display: 'grid', gap: 16 }}>
      <section style={{ border: '1px solid var(--pc-border)', background: 'var(--pc-shell-surface)', borderRadius: 22, padding: 18, boxShadow: 'var(--pc-shadow-sm)', display: 'grid', gap: 10 }}>
        <span style={{ fontSize: 11, fontWeight: 900, color: 'var(--pc-accent)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>ФГИС Зерно</span>
        <h1 style={{ margin: 0, fontSize: 'clamp(24px, 5vw, 38px)', color: 'var(--pc-text-primary)', lineHeight: 1.08 }}>{fgisAccessStatusLabel(state.status)}</h1>
        <p style={{ margin: 0, maxWidth: 840, fontSize: 14, lineHeight: 1.55, color: 'var(--pc-text-secondary)' }}>Фермер подключает не пароль от ФГИС, а право на импорт партии: организация, полномочие, номер лота или СДИЗ и сверка владельца. После этого платформа создаёт основание сделки из данных ФГИС.</p>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 12 }}>
        {[
          ['Организация', state.farmerName],
          ['ИНН', state.farmerInn],
          ['Импорт', fgisPullStatusLabel(state.pullStatus)],
          ['Лот', state.importKeys.lotNumber ?? 'указать'],
          ['СДИЗ', state.importKeys.sdizNumber ?? 'указать'],
          ['API', state.dealSeed.apiVersion],
        ].map(([label, value]) => (
          <div key={label} style={{ border: '1px solid var(--pc-border)', background: 'var(--pc-shell-surface)', borderRadius: 18, padding: 14, display: 'grid', gap: 5 }}>
            <span style={{ fontSize: 10, fontWeight: 900, color: 'var(--pc-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
            <strong style={{ fontSize: 15, color: 'var(--pc-text-primary)' }}>{value}</strong>
          </div>
        ))}
      </section>

      <section style={{ border: '1px solid var(--pc-border)', background: 'var(--pc-shell-surface)', borderRadius: 20, padding: 16, display: 'grid', gap: 10 }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>Что должен сделать фермер</h2>
        {state.steps.map((step) => (
          <div key={step.key} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 10, alignItems: 'center', padding: 12, borderRadius: 14, border: '1px solid var(--pc-border)', background: 'var(--pc-shell-surface-soft)' }}>
            <div style={{ display: 'grid', gap: 3 }}>
              <strong style={{ fontSize: 13, color: 'var(--pc-text-primary)' }}>{step.label}</strong>
              <span style={{ fontSize: 11, color: 'var(--pc-text-muted)' }}>{step.owner}</span>
            </div>
            <strong style={{ fontSize: 12, color: 'var(--pc-text-primary)' }}>{stepText(step.status)}</strong>
          </div>
        ))}
      </section>

      <section style={{ border: '1px solid var(--pc-border)', background: 'var(--pc-shell-surface)', borderRadius: 20, padding: 16, display: 'grid', gap: 10 }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>Что импортируем</h2>
        {[
          ['Источник', state.dealSeed.source],
          ['Партия', `${state.dealSeed.culture} · ${state.dealSeed.className}`],
          ['Масса', `${state.dealSeed.massKg / 1000} т`],
          ['Доступно', `${state.dealSeed.availableKg / 1000} т`],
          ['Хранение', state.dealSeed.storagePlace],
        ].map(([label, value]) => (
          <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '9px 10px', borderRadius: 12, background: 'var(--pc-shell-surface-soft)', border: '1px solid var(--pc-border)' }}>
            <span style={{ fontSize: 12, color: 'var(--pc-text-secondary)' }}>{label}</span>
            <strong style={{ fontSize: 12, color: 'var(--pc-text-primary)' }}>{value}</strong>
          </div>
        ))}
      </section>

      <section style={{ border: '1px solid var(--pc-border)', background: 'var(--pc-shell-surface)', borderRadius: 20, padding: 16, display: 'grid', gap: 10 }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>Дальше</h2>
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
