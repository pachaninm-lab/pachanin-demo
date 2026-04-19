'use client';

import * as React from 'react';
import Link from 'next/link';
import { useToast } from '@/components/v7r/Toast';
import { trackEvent } from '@/lib/analytics/track';

const GOST_FIELDS = [
  { key: 'moisture',  label: 'Влажность, %',        placeholder: '13.5' },
  { key: 'natweight', label: 'Натура, г/л',          placeholder: '760' },
  { key: 'protein',   label: 'Клейковина, %',        placeholder: '24.0' },
  { key: 'impurity',  label: 'Сорная примесь, %',    placeholder: '0.8' },
  { key: 'grain_imp', label: 'Зерновая примесь, %',  placeholder: '1.2' },
  { key: 'falling',   label: 'Число падения, с',     placeholder: '280' },
];

export default function SurveyorActPage({ params }: { params: { id: string } }) {
  const toast = useToast();
  const [values, setValues] = React.useState<Record<string, string>>({});
  const [geo, setGeo] = React.useState<string>('');
  const [signed, setSigned] = React.useState(false);
  const [photoCount, setPhotoCount] = React.useState(0);

  function handleGeo() {
    if (typeof window !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => setGeo(`${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`),
        () => setGeo('52.73201, 41.44299'),
      );
    } else {
      setGeo('52.73201, 41.44299');
    }
  }

  function handleSign() {
    setSigned(true);
    trackEvent('surveyor_act_signed', { actId: params.id });
    toast(`Акт ${params.id} подписан`, { type: 'success', duration: 6000, actions: [{ label: 'Открыть споры', onClick: () => {} }] });
  }

  return (
    <div style={{ display: 'grid', gap: 16, maxWidth: 720, margin: '0 auto' }}>
      <section style={{ background: 'var(--pc-bg-card)', border: '1px solid var(--pc-border)', borderRadius: 18, padding: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 800, color: 'var(--pc-accent)', fontSize: 14 }}>АКТ {params.id}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--pc-text-primary)', marginTop: 6 }}>Акт сюрвейера</div>
            <div style={{ fontSize: 13, color: 'var(--pc-text-muted)', marginTop: 4 }}>Инспекция качества зерна на месте</div>
          </div>
          {signed && <span style={{ padding: '6px 12px', borderRadius: 999, background: 'rgba(10,122,95,0.08)', border: '1px solid rgba(10,122,95,0.18)', color: '#0A7A5F', fontSize: 12, fontWeight: 800 }}>Подписан ✓</span>}
        </div>
      </section>

      <section style={{ background: 'var(--pc-bg-card)', border: '1px solid var(--pc-border)', borderRadius: 18, padding: 18, display: 'grid', gap: 14 }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--pc-text-primary)' }}>ГОСТ-показатели</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
          {GOST_FIELDS.map(({ key, label, placeholder }) => (
            <div key={key}>
              <label style={{ fontSize: 11, color: 'var(--pc-text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>{label}</label>
              <input
                value={values[key] ?? ''}
                onChange={e => setValues(v => ({ ...v, [key]: e.target.value }))}
                placeholder={placeholder}
                inputMode='decimal'
                disabled={signed}
                style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--pc-border)', fontSize: 14, background: 'var(--pc-bg-card)', color: 'var(--pc-text-primary)' }}
              />
            </div>
          ))}
        </div>
      </section>

      <section style={{ background: 'var(--pc-bg-card)', border: '1px solid var(--pc-border)', borderRadius: 18, padding: 18, display: 'grid', gap: 12 }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--pc-text-primary)' }}>Геолокация и фото</div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button onClick={handleGeo} disabled={signed} style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid var(--pc-border)', background: 'var(--pc-bg-subtle)', color: 'var(--pc-text-primary)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            {geo ? `📍 ${geo}` : 'Определить геолокацию'}
          </button>
          <button onClick={() => setPhotoCount(n => n + 1)} disabled={signed} style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid var(--pc-border)', background: 'var(--pc-bg-subtle)', color: 'var(--pc-text-primary)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            📷 Добавить фото {photoCount > 0 ? `(${photoCount})` : ''}
          </button>
        </div>
      </section>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button
          onClick={handleSign}
          disabled={signed}
          style={{ padding: '12px 20px', borderRadius: 12, border: 'none', background: signed ? '#E4E6EA' : 'var(--pc-accent)', color: signed ? '#9CA3AF' : '#fff', fontSize: 14, fontWeight: 800, cursor: signed ? 'default' : 'pointer' }}
        >
          {signed ? 'Акт подписан' : 'Подписать акт'}
        </button>
        <Link href='/platform-v7/surveyor' style={{ textDecoration: 'none', padding: '12px 14px', borderRadius: 12, border: '1px solid var(--pc-border)', background: 'var(--pc-bg-card)', color: 'var(--pc-text-primary)', fontSize: 14, fontWeight: 700 }}>← Назначения</Link>
      </div>
    </div>
  );
}
