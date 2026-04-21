'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCommercialRuntimeStore } from '@/stores/useCommercialRuntimeStore';
import { useToast } from '@/components/v7r/Toast';
import { trackLotCreated } from '@/lib/analytics/track';

const CROPS = [
  'Пшеница 1 кл.', 'Пшеница 2 кл.', 'Пшеница 3 кл.', 'Пшеница 4 кл.', 'Пшеница 5 кл.',
  'Ячмень 1 кл.', 'Ячмень 2 кл.', 'Ячмень 3 кл.',
  'Кукуруза 1 кл.', 'Кукуруза 2 кл.', 'Кукуруза 3 кл.',
  'Подсолнечник', 'Рапс', 'Соя', 'Овёс', 'Гречиха', 'Рожь', 'Просо', 'Лён', 'Сорго',
  'Подсолнечный жмых',
];

const REGIONS = [
  'Тамбовская', 'Воронежская', 'Курская', 'Липецкая', 'Орловская',
  'Белгородская', 'Брянская', 'Ставропольский', 'Ростовская',
  'Краснодарский', 'Саратовская', 'Волгоградская', 'Алтайский',
];

const BASES = ['EXW', 'FCA', 'CPT', 'DAP', 'DAT'];

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  color: '#6B778C',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  display: 'block',
  marginBottom: 6,
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  minWidth: 0,
  boxSizing: 'border-box',
  padding: '12px 14px',
  borderRadius: 12,
  border: '1px solid #E4E6EA',
  fontSize: 14,
  background: 'var(--pc-bg-card)',
  color: 'var(--pc-text-primary)',
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ minWidth: 0 }}>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  );
}

function formatPrice(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  return Number(digits).toLocaleString('ru-RU');
}

export function SellerLotCreateRuntimeV2() {
  const router = useRouter();
  const toast = useToast();
  const { addManualLot } = useCommercialRuntimeStore();

  const [grain, setGrain] = React.useState('Пшеница 4 кл.');
  const [volumeTons, setVolumeTons] = React.useState('240');
  const [region, setRegion] = React.useState('Тамбовская');
  const [priceRaw, setPriceRaw] = React.useState('');
  const [basis, setBasis] = React.useState('EXW');
  const [shipDate, setShipDate] = React.useState('');
  const [docsReady, setDocsReady] = React.useState(false);
  const [gostOpen, setGostOpen] = React.useState(false);
  const [gost, setGost] = React.useState({ moisture: '', natweight: '', protein: '', weed: '', grain: '', falling: '' });
  const [saving, setSaving] = React.useState(false);

  const priceDisplay = priceRaw ? `${formatPrice(priceRaw)} ₽/т` : '';
  const previewState = docsReady ? 'PASS' : 'REVIEW';
  const previewTone = docsReady ? '#0A7A5F' : '#B45309';
  const nextStep = docsReady ? 'Можно публиковать лот и переходить к переговорам.' : 'Нужно дозагрузить обязательные документы продавца.';

  function resetForm() {
    setGrain('Пшеница 4 кл.');
    setVolumeTons('240');
    setRegion('Тамбовская');
    setPriceRaw('');
    setBasis('EXW');
    setShipDate('');
    setDocsReady(false);
    setGost({ moisture: '', natweight: '', protein: '', weed: '', grain: '', falling: '' });
    setSaving(false);
  }

  function handleSubmit() {
    const numericVolume = Number(volumeTons);
    if (!grain.trim()) return toast('Укажи культуру.', 'error');
    if (!region.trim()) return toast('Укажи регион.', 'error');
    if (!Number.isFinite(numericVolume) || numericVolume <= 0) return toast('Укажи корректный объём в тоннах.', 'error');

    setSaving(true);
    const created = addManualLot({ grain: grain.trim(), volumeTons: numericVolume, region: region.trim(), docsReady });
    trackLotCreated(created.id);
    toast(`Лот ${created.id} создан`, {
      type: 'success',
      duration: 6000,
      actions: [
        { label: 'Открыть', onClick: () => router.push(`/platform-v7/lots/${created.id}`) },
        { label: 'Создать ещё', onClick: resetForm },
      ],
    });
    router.push('/platform-v7/lots');
  }

  return (
    <div className='lot-create-shell'>
      <style>{`
        .lot-create-shell{display:grid;gap:18px;padding:8px 0;max-width:100%;overflow-x:hidden}
        .lot-create-surface{background:var(--pc-bg-card);border:1px solid var(--pc-border);border-radius:18px;padding:18px;min-width:0;overflow:hidden}
        .lot-create-top{display:flex;justify-content:space-between;gap:14px;flex-wrap:wrap;align-items:flex-start}
        .lot-create-grid{display:grid;grid-template-columns:minmax(0,1.3fr) minmax(280px,.7fr);gap:16px;align-items:start}
        .lot-create-main,.lot-create-side{min-width:0}
        .lot-create-fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
        .lot-create-gost{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
        .lot-create-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:4px}
        .lot-create-actions > *{min-height:48px}
        .lot-create-preview-card{padding:16px;border-radius:16px;background:var(--pc-bg-subtle);border:1px solid var(--pc-border);min-width:0}
        .lot-create-badges{display:flex;gap:8px;flex-wrap:wrap}
        .lot-create-summary{padding:14px;border-radius:14px;min-width:0}
        @media (max-width: 1024px){
          .lot-create-grid{grid-template-columns:1fr}
        }
        @media (max-width: 680px){
          .lot-create-surface{padding:16px;border-radius:16px}
          .lot-create-top{display:grid}
          .lot-create-fields,.lot-create-gost{grid-template-columns:1fr}
          .lot-create-actions{display:grid;grid-template-columns:1fr}
          .lot-create-actions a,.lot-create-actions button{width:100%}
        }
      `}</style>

      <section className='lot-create-surface'>
        <div className='lot-create-top'>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 28, lineHeight: 1.15, fontWeight: 800, color: 'var(--pc-text-primary)' }}>Создать лот</div>
            <div style={{ fontSize: 13, color: 'var(--pc-text-muted)', lineHeight: 1.7, marginTop: 8 }}>Заполните параметры. На мобильном экран автоматически собирается в одну колонку без бокового переполнения.</div>
          </div>
          <Link href='/platform-v7/lots' style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 12, padding: '10px 14px', background: 'var(--pc-bg-card)', border: '1px solid var(--pc-border)', color: 'var(--pc-text-primary)', fontSize: 13, fontWeight: 700 }}>Все лоты</Link>
        </div>
      </section>

      <div className='lot-create-grid'>
        <section className='lot-create-surface lot-create-main' style={{ display: 'grid', gap: 14 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--pc-text-primary)' }}>Параметры лота</div>

          <div className='lot-create-fields'>
            <Field label='Культура'>
              <select value={grain} onChange={(e) => setGrain(e.target.value)} style={inputStyle}>
                {CROPS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            <Field label='Регион'>
              <select value={region} onChange={(e) => setRegion(e.target.value)} style={inputStyle}>
                {REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </Field>
          </div>

          <div className='lot-create-fields'>
            <Field label='Объём, тонн'>
              <input value={volumeTons} onChange={(e) => setVolumeTons(e.target.value)} inputMode='decimal' placeholder='240' style={inputStyle} />
            </Field>
            <Field label='Цена, ₽/т'>
              <input value={priceDisplay} onChange={(e) => setPriceRaw(e.target.value.replace(/\D/g, ''))} inputMode='numeric' placeholder='14 500 ₽/т' style={inputStyle} />
            </Field>
          </div>

          <div className='lot-create-fields'>
            <Field label='Базис поставки'>
              <select value={basis} onChange={(e) => setBasis(e.target.value)} style={inputStyle}>
                {BASES.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </Field>
            <Field label='Срок готовности к отгрузке'>
              <input type='date' value={shipDate} onChange={(e) => setShipDate(e.target.value)} style={inputStyle} />
            </Field>
          </div>

          <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: 14, borderRadius: 14, background: 'var(--pc-bg-subtle)', border: '1px solid var(--pc-border)', cursor: 'pointer' }}>
            <input type='checkbox' checked={docsReady} onChange={(e) => setDocsReady(e.target.checked)} style={{ marginTop: 2, width: 18, height: 18, flexShrink: 0 }} />
            <span style={{ minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 14, fontWeight: 700, color: 'var(--pc-text-primary)' }}>Обязательный пакет документов готов</span>
              <span style={{ display: 'block', fontSize: 12, color: 'var(--pc-text-muted)', lineHeight: 1.6, marginTop: 4 }}>Если не отмечено — лот сохранится со статусом REVIEW и документным блокером.</span>
            </span>
          </label>

          <div>
            <button type='button' onClick={() => setGostOpen((v) => !v)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: 'var(--pc-accent)', padding: 0, textAlign: 'left' }}>
              <span style={{ fontSize: 16 }}>{gostOpen ? '▾' : '▸'}</span>
              ГОСТ-параметры (опционально)
            </button>
            {gostOpen ? (
              <div className='lot-create-gost' style={{ marginTop: 12 }}>
                {[
                  { key: 'moisture', label: 'Влажность, %' },
                  { key: 'natweight', label: 'Натура, г/л' },
                  { key: 'protein', label: 'Клейковина, %' },
                  { key: 'weed', label: 'Сорная прим., %' },
                  { key: 'grain', label: 'Зерновая прим., %' },
                  { key: 'falling', label: 'Число падения, с' },
                ].map(({ key, label }) => (
                  <div key={key} style={{ minWidth: 0 }}>
                    <label style={labelStyle}>{label}</label>
                    <input value={gost[key as keyof typeof gost]} onChange={(e) => setGost((g) => ({ ...g, [key]: e.target.value }))} inputMode='decimal' placeholder='—' style={{ ...inputStyle, padding: '10px 12px', fontSize: 13 }} />
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          <div className='lot-create-actions'>
            <button onClick={handleSubmit} disabled={saving} style={{ borderRadius: 12, padding: '12px 20px', background: '#0A7A5F', border: '1px solid #0A7A5F', color: '#fff', fontSize: 14, fontWeight: 800, cursor: saving ? 'wait' : 'pointer' }}>
              {saving ? 'Сохраняем…' : 'Сохранить лот'}
            </button>
            <Link href='/platform-v7/lots' style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 12, padding: '12px 16px', background: 'var(--pc-bg-card)', border: '1px solid var(--pc-border)', color: 'var(--pc-text-primary)', fontSize: 14, fontWeight: 700 }}>Отмена</Link>
          </div>
        </section>

        <section className='lot-create-side' style={{ display: 'grid', gap: 16, alignContent: 'start' }}>
          <div className='lot-create-surface' style={{ display: 'grid', gap: 14 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--pc-text-primary)' }}>Предпросмотр</div>
            <div className='lot-create-preview-card'>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 800, color: 'var(--pc-accent)', fontSize: 12 }}>NEW MANUAL LOT</div>
              <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--pc-text-primary)', marginTop: 8, lineHeight: 1.3, wordBreak: 'break-word' }}>{grain || '—'}</div>
              <div style={{ fontSize: 12, color: 'var(--pc-text-muted)', marginTop: 6, lineHeight: 1.6, wordBreak: 'break-word' }}>
                {volumeTons || '0'} т · {region || '—'}{priceRaw ? ` · ${formatPrice(priceRaw)} ₽/т` : ''}
              </div>
              {(basis || shipDate) ? (
                <div style={{ fontSize: 12, color: 'var(--pc-text-muted)', marginTop: 4, lineHeight: 1.6, wordBreak: 'break-word' }}>
                  {basis}{shipDate ? ` · отгрузка ${new Date(shipDate).toLocaleDateString('ru-RU')}` : ''}
                </div>
              ) : null}
            </div>

            <div className='lot-create-badges'>
              <span style={{ display: 'inline-flex', alignItems: 'center', padding: '4px 10px', borderRadius: 999, background: 'rgba(107,114,128,0.08)', border: '1px solid rgba(107,114,128,0.18)', color: '#4B5563', fontSize: 11, fontWeight: 800 }}>MANUAL</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', padding: '4px 10px', borderRadius: 999, background: docsReady ? 'rgba(10,122,95,0.08)' : 'rgba(217,119,6,0.08)', border: `1px solid ${docsReady ? 'rgba(10,122,95,0.18)' : 'rgba(217,119,6,0.18)'}`, color: previewTone, fontSize: 11, fontWeight: 800 }}>{previewState}</span>
            </div>

            <div className='lot-create-summary' style={{ background: docsReady ? 'rgba(10,122,95,0.06)' : 'rgba(217,119,6,0.08)', border: docsReady ? '1px solid rgba(10,122,95,0.14)' : '1px solid rgba(217,119,6,0.16)' }}>
              <div style={{ fontSize: 11, color: 'var(--pc-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 800 }}>Следующий шаг</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--pc-text-primary)', marginTop: 8, lineHeight: 1.6, wordBreak: 'break-word' }}>{nextStep}</div>
            </div>

            {!docsReady ? (
              <div style={{ padding: 12, borderRadius: 12, background: 'rgba(217,119,6,0.08)', border: '1px solid rgba(217,119,6,0.16)', fontSize: 12, color: '#92400E', lineHeight: 1.6 }}>
                <strong>Блокер:</strong> Документы не загружены. Лот получит статус REVIEW.
              </div>
            ) : (
              <div style={{ padding: 12, borderRadius: 12, background: 'rgba(10,122,95,0.06)', border: '1px solid rgba(10,122,95,0.14)', fontSize: 12, fontWeight: 700, color: '#0A7A5F', lineHeight: 1.6 }}>
                Блокеров нет. Лот готов к публикации.
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
