'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PLATFORM_V7_SELLER_BATCHES_ROUTE } from '@/lib/platform-v7/routes';

const CROPS = [
  'Пшеница 1 кл.', 'Пшеница 2 кл.', 'Пшеница 3 кл.', 'Пшеница 4 кл.', 'Пшеница 5 кл.',
  'Ячмень 1 кл.', 'Ячмень 2 кл.', 'Ячмень 3 кл.',
  'Кукуруза 1 кл.', 'Кукуруза 2 кл.', 'Кукуруза 3 кл.',
  'Подсолнечник', 'Рапс', 'Соя', 'Овёс', 'Гречиха', 'Рожь', 'Просо', 'Лён', 'Сорго',
];

const REGIONS = [
  'Тамбовская', 'Воронежская', 'Курская', 'Липецкая', 'Орловская',
  'Белгородская', 'Брянская', 'Ставропольский', 'Ростовская',
  'Краснодарский', 'Саратовская', 'Волгоградская', 'Алтайский',
];

const STORAGE_TYPES = [
  'Элеватор', 'Склад напольного хранения', 'Зернохранилище КВП', 'Собственный склад', 'Арендованный склад',
];

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

type QualityData = {
  moisture: string;
  impurity: string;
  gluten: string;
  natweight: string;
  falling: string;
  protein: string;
};

export default function SellerNewBatchPage() {
  const router = useRouter();

  const [crop, setCrop] = React.useState('Пшеница 4 кл.');
  const [volumeTons, setVolumeTons] = React.useState('');
  const [region, setRegion] = React.useState('Тамбовская');
  const [storageType, setStorageType] = React.useState('Элеватор');
  const [storageName, setStorageName] = React.useState('');
  const [hasSdiz, setHasSdiz] = React.useState(false);
  const [docsReady, setDocsReady] = React.useState(false);
  const [qualityOpen, setQualityOpen] = React.useState(false);
  const [quality, setQuality] = React.useState<QualityData>({
    moisture: '', impurity: '', gluten: '', natweight: '', falling: '', protein: '',
  });
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);

  const canSubmit = crop.length > 0 && region.length > 0 && Number(volumeTons) > 0;

  const statusLabel = docsReady && hasSdiz ? 'PASS' : hasSdiz ? 'REVIEW' : 'INCOMPLETE';
  const statusColor = statusLabel === 'PASS' ? '#0A7A5F' : statusLabel === 'REVIEW' ? '#B45309' : '#B91C1C';
  const statusBg = statusLabel === 'PASS' ? 'rgba(10,122,95,0.08)' : statusLabel === 'REVIEW' ? 'rgba(217,119,6,0.08)' : 'rgba(185,28,28,0.08)';
  const statusBorder = statusLabel === 'PASS' ? 'rgba(10,122,95,0.18)' : statusLabel === 'REVIEW' ? 'rgba(217,119,6,0.18)' : 'rgba(185,28,28,0.18)';

  const nextStep = statusLabel === 'PASS'
    ? 'Партия готова. Можно создавать лот и переходить к переговорам.'
    : statusLabel === 'REVIEW'
    ? 'СДИЗ есть — нужно дозагрузить обязательные документы продавца.'
    : 'СДИЗ отсутствует. Без него партию нельзя пустить в сделку.';

  function handleQuality(key: keyof QualityData, value: string) {
    setQuality((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit() {
    if (!canSubmit) return;
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      setSaved(true);
    }, 700);
  }

  if (saved) {
    return (
      <div style={{ display: 'grid', gap: 18 }}>
        <section style={{ background: 'var(--pc-bg-card)', border: '1px solid #E4E6EA', borderRadius: 24, padding: 24, display: 'grid', gap: 12, textAlign: 'center' }}>
          <div style={{ fontSize: 32, lineHeight: 1.1 }}>✓</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--pc-text-primary)' }}>Партия зафиксирована</div>
          <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.7 }}>
            {crop} · {volumeTons} т · {region} — партия добавлена в контур. Следующий шаг: создать лот или назначить на сделку.
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap', marginTop: 8 }}>
            <Link href='/platform-v7/seller/lots/new' style={{ textDecoration: 'none', padding: '11px 18px', borderRadius: 12, background: '#0A7A5F', color: '#fff', fontSize: 14, fontWeight: 800 }}>
              Создать лот
            </Link>
            <Link href={PLATFORM_V7_SELLER_BATCHES_ROUTE} style={{ textDecoration: 'none', padding: '11px 18px', borderRadius: 12, background: 'var(--pc-bg-card)', border: '1px solid #E4E6EA', color: 'var(--pc-text-primary)', fontSize: 14, fontWeight: 700 }}>
              Все партии
            </Link>
            <button onClick={() => { setSaved(false); setCrop('Пшеница 4 кл.'); setVolumeTons(''); setStorageName(''); setHasSdiz(false); setDocsReady(false); setQuality({ moisture: '', impurity: '', gluten: '', natweight: '', falling: '', protein: '' }); }} style={{ padding: '11px 18px', borderRadius: 12, border: '1px solid #E4E6EA', background: 'var(--pc-bg-card)', color: 'var(--pc-text-primary)', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
              Добавить ещё
            </button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className='batch-new-shell'>
      <style>{`
        .batch-new-shell{display:grid;gap:18px;padding:8px 0;max-width:100%;overflow-x:hidden}
        .batch-new-surface{background:var(--pc-bg-card);border:1px solid #E4E6EA;border-radius:18px;padding:18px;min-width:0;overflow:hidden}
        .batch-new-grid{display:grid;grid-template-columns:minmax(0,1.3fr) minmax(280px,.7fr);gap:16px;align-items:start}
        .batch-new-fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
        .batch-new-quality{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
        .batch-new-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:4px}
        .batch-new-actions>*{min-height:48px}
        @media(max-width:1024px){.batch-new-grid{grid-template-columns:1fr}}
        @media(max-width:680px){
          .batch-new-surface{padding:16px;border-radius:16px}
          .batch-new-fields,.batch-new-quality{grid-template-columns:1fr}
          .batch-new-actions{display:grid;grid-template-columns:1fr}
        }
      `}</style>

      <section className='batch-new-surface'>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 28, lineHeight: 1.15, fontWeight: 800, color: 'var(--pc-text-primary)' }}>Новая партия</div>
            <div style={{ fontSize: 13, color: '#6B778C', lineHeight: 1.7, marginTop: 8 }}>Фиксация физической партии зерна в контуре. Черновик создаётся даже если часть данных ещё неизвестна.</div>
          </div>
          <Link href={PLATFORM_V7_SELLER_BATCHES_ROUTE} style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', borderRadius: 12, padding: '10px 14px', background: 'var(--pc-bg-card)', border: '1px solid #E4E6EA', color: 'var(--pc-text-primary)', fontSize: 13, fontWeight: 700 }}>Все партии</Link>
        </div>
      </section>

      <div className='batch-new-grid'>
        <section className='batch-new-surface' style={{ display: 'grid', gap: 14 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--pc-text-primary)' }}>Параметры партии</div>

          <div className='batch-new-fields'>
            <Field label='Культура и класс'>
              <select value={crop} onChange={(e) => setCrop(e.target.value)} style={inputStyle}>
                {CROPS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            <Field label='Объём, тонн'>
              <input value={volumeTons} onChange={(e) => setVolumeTons(e.target.value)} inputMode='decimal' placeholder='500' style={inputStyle} />
            </Field>
          </div>

          <div className='batch-new-fields'>
            <Field label='Регион хранения'>
              <select value={region} onChange={(e) => setRegion(e.target.value)} style={inputStyle}>
                {REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </Field>
            <Field label='Тип хранения'>
              <select value={storageType} onChange={(e) => setStorageType(e.target.value)} style={inputStyle}>
                {STORAGE_TYPES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
          </div>

          <Field label='Название объекта хранения'>
            <input value={storageName} onChange={(e) => setStorageName(e.target.value)} placeholder='Элеватор Тамбов-1 / склад ООО «Агро»' style={inputStyle} />
          </Field>

          <div style={{ display: 'grid', gap: 10 }}>
            <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: 14, borderRadius: 14, background: 'var(--pc-bg-subtle, #F8FAFB)', border: '1px solid #E4E6EA', cursor: 'pointer' }}>
              <input type='checkbox' checked={hasSdiz} onChange={(e) => setHasSdiz(e.target.checked)} style={{ marginTop: 2, width: 18, height: 18, flexShrink: 0 }} />
              <span style={{ minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 14, fontWeight: 700, color: 'var(--pc-text-primary)' }}>СДИЗ оформлен</span>
                <span style={{ display: 'block', fontSize: 12, color: '#6B778C', lineHeight: 1.6, marginTop: 4 }}>Сопроводительный документ на зерно есть. Без него партия не может попасть в сделку.</span>
              </span>
            </label>

            <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: 14, borderRadius: 14, background: 'var(--pc-bg-subtle, #F8FAFB)', border: '1px solid #E4E6EA', cursor: 'pointer' }}>
              <input type='checkbox' checked={docsReady} onChange={(e) => setDocsReady(e.target.checked)} style={{ marginTop: 2, width: 18, height: 18, flexShrink: 0 }} />
              <span style={{ minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 14, fontWeight: 700, color: 'var(--pc-text-primary)' }}>Пакет документов продавца готов</span>
                <span style={{ display: 'block', fontSize: 12, color: '#6B778C', lineHeight: 1.6, marginTop: 4 }}>Право собственности, сертификат качества и правоустанавливающие документы загружены.</span>
              </span>
            </label>
          </div>

          <div>
            <button type='button' onClick={() => setQualityOpen((v) => !v)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: 'var(--pc-accent, #0A7A5F)', padding: 0 }}>
              <span style={{ fontSize: 16 }}>{qualityOpen ? '▾' : '▸'}</span>
              Показатели качества (по лаборатории)
            </button>
            {qualityOpen && (
              <div className='batch-new-quality' style={{ marginTop: 12 }}>
                {([
                  { key: 'moisture', label: 'Влажность, %' },
                  { key: 'impurity', label: 'Сорная прим., %' },
                  { key: 'gluten', label: 'Клейковина, %' },
                  { key: 'natweight', label: 'Натура, г/л' },
                  { key: 'falling', label: 'Число падения, с' },
                  { key: 'protein', label: 'Белок, %' },
                ] as const).map(({ key, label }) => (
                  <div key={key} style={{ minWidth: 0 }}>
                    <label style={labelStyle}>{label}</label>
                    <input
                      value={quality[key]}
                      onChange={(e) => handleQuality(key, e.target.value)}
                      inputMode='decimal'
                      placeholder='—'
                      style={{ ...inputStyle, padding: '10px 12px', fontSize: 13 }}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className='batch-new-actions'>
            <button
              onClick={handleSubmit}
              disabled={saving || !canSubmit}
              style={{ borderRadius: 12, padding: '12px 20px', background: canSubmit ? '#0A7A5F' : '#94A3B8', border: `1px solid ${canSubmit ? '#0A7A5F' : '#94A3B8'}`, color: '#fff', fontSize: 14, fontWeight: 800, cursor: saving || !canSubmit ? 'default' : 'pointer' }}
            >
              {saving ? 'Сохраняем…' : 'Зафиксировать партию'}
            </button>
            <Link
              href={PLATFORM_V7_SELLER_BATCHES_ROUTE}
              style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 12, padding: '12px 16px', background: 'var(--pc-bg-card)', border: '1px solid #E4E6EA', color: 'var(--pc-text-primary)', fontSize: 14, fontWeight: 700 }}
            >
              Отмена
            </Link>
          </div>
        </section>

        <section style={{ display: 'grid', gap: 16, alignContent: 'start' }}>
          <div className='batch-new-surface' style={{ display: 'grid', gap: 14 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--pc-text-primary)' }}>Предпросмотр</div>
            <div style={{ padding: 16, borderRadius: 16, background: 'var(--pc-bg-subtle, #F8FAFB)', border: '1px solid #E4E6EA' }}>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 800, color: '#0A7A5F', fontSize: 12 }}>BATCH · MANUAL</div>
              <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--pc-text-primary)', marginTop: 8, lineHeight: 1.3, wordBreak: 'break-word' }}>{crop}</div>
              <div style={{ fontSize: 12, color: '#6B778C', marginTop: 6, lineHeight: 1.6, wordBreak: 'break-word' }}>
                {volumeTons || '—'} т · {region}{storageName ? ` · ${storageName}` : ''}
              </div>
              <div style={{ fontSize: 12, color: '#6B778C', marginTop: 4, lineHeight: 1.6 }}>{storageType}</div>
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', padding: '4px 10px', borderRadius: 999, background: statusBg, border: `1px solid ${statusBorder}`, color: statusColor, fontSize: 11, fontWeight: 800 }}>{statusLabel}</span>
              {hasSdiz && <span style={{ display: 'inline-flex', alignItems: 'center', padding: '4px 10px', borderRadius: 999, background: 'rgba(10,122,95,0.08)', border: '1px solid rgba(10,122,95,0.18)', color: '#0A7A5F', fontSize: 11, fontWeight: 800 }}>СДИЗ</span>}
            </div>

            <div style={{ padding: 12, borderRadius: 12, background: statusLabel === 'PASS' ? 'rgba(10,122,95,0.06)' : 'rgba(217,119,6,0.08)', border: `1px solid ${statusLabel === 'PASS' ? 'rgba(10,122,95,0.14)' : 'rgba(217,119,6,0.16)'}` }}>
              <div style={{ fontSize: 11, color: '#6B778C', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 800 }}>Следующий шаг</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--pc-text-primary)', marginTop: 8, lineHeight: 1.6 }}>{nextStep}</div>
            </div>

            {!hasSdiz && (
              <div style={{ padding: 12, borderRadius: 12, background: 'rgba(185,28,28,0.06)', border: '1px solid rgba(185,28,28,0.14)', fontSize: 12, color: '#991B1B', lineHeight: 1.6 }}>
                <strong>Блокер:</strong> СДИЗ отсутствует. Оформите в ФГИС «Зерно» перед созданием лота.
              </div>
            )}
          </div>

          <div className='batch-new-surface' style={{ display: 'grid', gap: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--pc-text-primary)' }}>После фиксации партии</div>
            {[
              { label: 'Создать лот', href: '/platform-v7/seller/lots/new', note: 'Вывести партию на продажу' },
              { label: 'Документы', href: '/platform-v7/documents/grain', note: 'Загрузить сертификаты и СДИЗ' },
              { label: 'Быстрая продажа', href: '/platform-v7/seller/quick-sale', note: 'Сделка напрямую без торгов' },
            ].map((item) => (
              <Link key={item.href} href={item.href} style={{ textDecoration: 'none', display: 'grid', gap: 2, padding: '10px 12px', borderRadius: 12, background: 'var(--pc-bg-subtle, #F8FAFB)', border: '1px solid #E4E6EA' }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#0A7A5F' }}>{item.label} →</span>
                <span style={{ fontSize: 11, color: '#6B778C' }}>{item.note}</span>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
