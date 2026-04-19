'use client';

import * as React from 'react';
import Link from 'next/link';
import { useToast } from '@/components/v7r/Toast';
import { trackEvent } from '@/lib/analytics/track';

const DEFAULT_FORM = {
  moisture: '12.4',
  nature: '768',
  gluten: '24.1',
  protein: '12.8',
  weed: '1.2',
  grain: '2.4',
  falling: '285',
  geo: '52.7210, 41.4521',
  photos: 3,
  signed: false,
};

export default function SurveyorActPage({ params }: { params: { id: string } }) {
  const toast = useToast();
  const [form, setForm] = React.useState(DEFAULT_FORM);

  function patch<K extends keyof typeof DEFAULT_FORM>(key: K, value: (typeof DEFAULT_FORM)[K]) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  function signAct() {
    patch('signed', true);
    trackEvent('surveyor_act_signed', { actId: params.id });
    toast('Акт сюрвейера подписан', 'success');
  }

  return (
    <div style={{ display: 'grid', gap: 16, maxWidth: 820, margin: '0 auto' }}>
      <section style={{ background: 'var(--pc-bg-card)', border: '1px solid var(--pc-border)', borderRadius: 18, padding: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 800, color: 'var(--pc-accent)', fontSize: 14 }}>ACT-{params.id}</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--pc-text-primary)', marginTop: 6 }}>Акт сюрвейера</div>
            <div style={{ fontSize: 13, color: 'var(--pc-text-muted)', marginTop: 6 }}>Фотофиксация, чек-лист ГОСТ, геолокация и подпись.</div>
          </div>
          <span style={{ display: 'inline-flex', alignItems: 'center', padding: '6px 12px', borderRadius: 999, background: form.signed ? 'rgba(10,122,95,0.08)' : 'rgba(217,119,6,0.08)', border: `1px solid ${form.signed ? 'rgba(10,122,95,0.18)' : 'rgba(217,119,6,0.18)'}`, color: form.signed ? '#0A7A5F' : '#B45309', fontSize: 12, fontWeight: 800 }}>
            {form.signed ? 'Подписан' : 'Черновик'}
          </span>
        </div>
      </section>

      <section style={{ background: 'var(--pc-bg-card)', border: '1px solid var(--pc-border)', borderRadius: 18, padding: 18, display: 'grid', gap: 14 }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--pc-text-primary)' }}>Параметры ГОСТ</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          {[
            ['moisture', 'Влажность, %'],
            ['nature', 'Натура, г/л'],
            ['gluten', 'Клейковина, %'],
            ['protein', 'Протеин, %'],
            ['weed', 'Сорная примесь, %'],
            ['grain', 'Зерновая примесь, %'],
            ['falling', 'Число падения, сек'],
          ].map(([key, label]) => (
            <label key={key} style={{ display: 'grid', gap: 6 }}>
              <span style={{ fontSize: 12, color: 'var(--pc-text-muted)', fontWeight: 700 }}>{label}</span>
              <input value={String(form[key as keyof typeof form])} onChange={(e) => patch(key as keyof typeof DEFAULT_FORM, e.target.value as never)} style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--pc-border)', background: 'var(--pc-bg-subtle)', color: 'var(--pc-text-primary)', fontSize: 13 }} />
            </label>
          ))}
        </div>
      </section>

      <section style={{ background: 'var(--pc-bg-card)', border: '1px solid var(--pc-border)', borderRadius: 18, padding: 18, display: 'grid', gap: 12 }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--pc-text-primary)' }}>Фото и геолокация</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <label style={{ display: 'grid', gap: 6 }}>
            <span style={{ fontSize: 12, color: 'var(--pc-text-muted)', fontWeight: 700 }}>Фото</span>
            <input value={String(form.photos)} onChange={(e) => patch('photos', Number(e.target.value) || 0)} style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--pc-border)', background: 'var(--pc-bg-subtle)', color: 'var(--pc-text-primary)', fontSize: 13 }} />
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            <span style={{ fontSize: 12, color: 'var(--pc-text-muted)', fontWeight: 700 }}>Геолокация</span>
            <input value={form.geo} onChange={(e) => patch('geo', e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--pc-border)', background: 'var(--pc-bg-subtle)', color: 'var(--pc-text-primary)', fontSize: 13 }} />
          </label>
        </div>
      </section>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button onClick={signAct} disabled={form.signed} style={{ padding: '10px 16px', borderRadius: 12, border: 'none', background: form.signed ? '#E4E6EA' : 'var(--pc-accent)', color: form.signed ? '#9CA3AF' : '#fff', fontSize: 13, fontWeight: 800, cursor: form.signed ? 'default' : 'pointer' }}>
          {form.signed ? 'Акт подписан' : 'Подписать акт'}
        </button>
        <Link href='/platform-v7/surveyor' style={{ textDecoration: 'none', padding: '10px 14px', borderRadius: 12, border: '1px solid var(--pc-border)', background: 'var(--pc-bg-card)', color: 'var(--pc-text-primary)', fontSize: 13, fontWeight: 700 }}>← Кабинет сюрвейера</Link>
      </div>
    </div>
  );
}
