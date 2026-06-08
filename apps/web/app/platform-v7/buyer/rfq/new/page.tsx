'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PLATFORM_V7_BUYER_RFQ_ROUTE } from '@/lib/platform-v7/routes';

const CROPS = [
  'Пшеница 1 кл.', 'Пшеница 2 кл.', 'Пшеница 3 кл.', 'Пшеница 4 кл.', 'Пшеница 5 кл.',
  'Ячмень 1 кл.', 'Ячмень 2 кл.', 'Ячмень 3 кл.',
  'Кукуруза 1 кл.', 'Кукуруза 2 кл.', 'Кукуруза 3 кл.',
  'Подсолнечник', 'Рапс', 'Соя', 'Овёс', 'Гречиха', 'Рожь', 'Просо', 'Лён',
];

const REGIONS = [
  'Тамбовская', 'Воронежская', 'Курская', 'Липецкая', 'Орловская',
  'Белгородская', 'Брянская', 'Ставропольский', 'Ростовская',
  'Краснодарский', 'Саратовская', 'Волгоградская', 'Алтайский',
];

const BASES = ['EXW', 'FCA', 'CPT', 'DAP', 'DAT'];

const URGENCY_OPTIONS = [
  { value: 'asap', label: 'Срочно (до 5 дней)' },
  { value: '2weeks', label: 'До 2 недель' },
  { value: 'month', label: 'До месяца' },
  { value: 'flex', label: 'Гибко' },
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

function formatPrice(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  return Number(digits).toLocaleString('ru-RU');
}

type QualityReqs = {
  moistureMax: string;
  impurityMax: string;
  glutenMin: string;
  natweightMin: string;
};

export default function BuyerNewRfqPage() {
  const router = useRouter();

  const [crop, setCrop] = React.useState('Пшеница 4 кл.');
  const [volumeTons, setVolumeTons] = React.useState('');
  const [region, setRegion] = React.useState('Тамбовская');
  const [basis, setBasis] = React.useState('CPT');
  const [priceRaw, setPriceRaw] = React.useState('');
  const [priceMaxRaw, setPriceMaxRaw] = React.useState('');
  const [deliveryFrom, setDeliveryFrom] = React.useState('');
  const [deliveryTo, setDeliveryTo] = React.useState('');
  const [urgency, setUrgency] = React.useState('2weeks');
  const [comment, setComment] = React.useState('');
  const [qualityOpen, setQualityOpen] = React.useState(false);
  const [quality, setQuality] = React.useState<QualityReqs>({
    moistureMax: '', impurityMax: '', glutenMin: '', natweightMin: '',
  });
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);

  const priceDisplay = priceRaw ? `${formatPrice(priceRaw)} ₽/т` : '';
  const priceMaxDisplay = priceMaxRaw ? `${formatPrice(priceMaxRaw)} ₽/т` : '';

  const canSubmit = crop.length > 0 && region.length > 0 && Number(volumeTons) > 0;

  const urgencyLabel = URGENCY_OPTIONS.find((u) => u.value === urgency)?.label ?? '';

  function handleQuality(key: keyof QualityReqs, value: string) {
    setQuality((prev) => ({ ...prev, [key]: value }));
  }

  function resetForm() {
    setCrop('Пшеница 4 кл.');
    setVolumeTons('');
    setRegion('Тамбовская');
    setBasis('CPT');
    setPriceRaw('');
    setPriceMaxRaw('');
    setDeliveryFrom('');
    setDeliveryTo('');
    setUrgency('2weeks');
    setComment('');
    setQuality({ moistureMax: '', impurityMax: '', glutenMin: '', natweightMin: '' });
    setSaved(false);
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
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--pc-text-primary)' }}>Запрос отправлен</div>
          <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.7 }}>
            {crop} · {volumeTons} т · {region} · {basis} — запрос зафиксирован. Совпадения появятся в подборе предложений.
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap', marginTop: 8 }}>
            <Link href='/platform-v7/buyer/matches' style={{ textDecoration: 'none', padding: '11px 18px', borderRadius: 12, background: '#2563EB', color: '#fff', fontSize: 14, fontWeight: 800 }}>
              Подбор предложений
            </Link>
            <Link href={PLATFORM_V7_BUYER_RFQ_ROUTE} style={{ textDecoration: 'none', padding: '11px 18px', borderRadius: 12, background: 'var(--pc-bg-card)', border: '1px solid #E4E6EA', color: 'var(--pc-text-primary)', fontSize: 14, fontWeight: 700 }}>
              Все запросы
            </Link>
            <button onClick={resetForm} style={{ padding: '11px 18px', borderRadius: 12, border: '1px solid #E4E6EA', background: 'var(--pc-bg-card)', color: 'var(--pc-text-primary)', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
              Новый запрос
            </button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className='rfq-new-shell'>
      <style>{`
        .rfq-new-shell{display:grid;gap:18px;padding:8px 0;max-width:100%;overflow-x:hidden}
        .rfq-new-surface{background:var(--pc-bg-card);border:1px solid #E4E6EA;border-radius:18px;padding:18px;min-width:0;overflow:hidden}
        .rfq-new-grid{display:grid;grid-template-columns:minmax(0,1.3fr) minmax(280px,.7fr);gap:16px;align-items:start}
        .rfq-new-fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
        .rfq-new-quality{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
        .rfq-new-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:4px}
        .rfq-new-actions>*{min-height:48px}
        @media(max-width:1024px){.rfq-new-grid{grid-template-columns:1fr}}
        @media(max-width:680px){
          .rfq-new-surface{padding:16px;border-radius:16px}
          .rfq-new-fields,.rfq-new-quality{grid-template-columns:1fr}
          .rfq-new-actions{display:grid;grid-template-columns:1fr}
        }
      `}</style>

      <section className='rfq-new-surface'>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 11, color: '#2563EB', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Покупатель</div>
            <div style={{ fontSize: 28, lineHeight: 1.15, fontWeight: 800, color: 'var(--pc-text-primary)' }}>Новый запрос</div>
            <div style={{ fontSize: 13, color: '#6B778C', lineHeight: 1.7, marginTop: 8 }}>Краткая форма потребности. После отправки запрос попадает в подбор — система ищет совпадения по доступным лотам.</div>
          </div>
          <Link href={PLATFORM_V7_BUYER_RFQ_ROUTE} style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', borderRadius: 12, padding: '10px 14px', background: 'var(--pc-bg-card)', border: '1px solid #E4E6EA', color: 'var(--pc-text-primary)', fontSize: 13, fontWeight: 700 }}>Все запросы</Link>
        </div>
      </section>

      <div className='rfq-new-grid'>
        <section className='rfq-new-surface' style={{ display: 'grid', gap: 14 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--pc-text-primary)' }}>Параметры закупки</div>

          <div className='rfq-new-fields'>
            <Field label='Культура'>
              <select value={crop} onChange={(e) => setCrop(e.target.value)} style={inputStyle}>
                {CROPS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            <Field label='Объём, тонн'>
              <input value={volumeTons} onChange={(e) => setVolumeTons(e.target.value)} inputMode='decimal' placeholder='500' style={inputStyle} />
            </Field>
          </div>

          <div className='rfq-new-fields'>
            <Field label='Регион поставки'>
              <select value={region} onChange={(e) => setRegion(e.target.value)} style={inputStyle}>
                {REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </Field>
            <Field label='Базис поставки'>
              <select value={basis} onChange={(e) => setBasis(e.target.value)} style={inputStyle}>
                {BASES.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </Field>
          </div>

          <div className='rfq-new-fields'>
            <Field label='Целевая цена от, ₽/т'>
              <input value={priceDisplay} onChange={(e) => setPriceRaw(e.target.value.replace(/\D/g, ''))} inputMode='numeric' placeholder='13 000 ₽/т' style={inputStyle} />
            </Field>
            <Field label='Целевая цена до, ₽/т'>
              <input value={priceMaxDisplay} onChange={(e) => setPriceMaxRaw(e.target.value.replace(/\D/g, ''))} inputMode='numeric' placeholder='15 000 ₽/т' style={inputStyle} />
            </Field>
          </div>

          <div className='rfq-new-fields'>
            <Field label='Поставка с'>
              <input type='date' value={deliveryFrom} onChange={(e) => setDeliveryFrom(e.target.value)} style={inputStyle} />
            </Field>
            <Field label='Поставка до'>
              <input type='date' value={deliveryTo} onChange={(e) => setDeliveryTo(e.target.value)} style={inputStyle} />
            </Field>
          </div>

          <Field label='Срочность'>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {URGENCY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type='button'
                  onClick={() => setUrgency(opt.value)}
                  style={{ padding: '8px 12px', borderRadius: 10, border: `1px solid ${urgency === opt.value ? '#2563EB' : '#E4E6EA'}`, background: urgency === opt.value ? 'rgba(37,99,235,0.08)' : 'var(--pc-bg-card)', color: urgency === opt.value ? '#2563EB' : 'var(--pc-text-primary)', fontSize: 13, fontWeight: urgency === opt.value ? 800 : 600, cursor: 'pointer' }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </Field>

          <Field label='Комментарий (необязательно)'>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder='Дополнительные требования, условия, контакт...'
              rows={3}
              style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }}
            />
          </Field>

          <div>
            <button type='button' onClick={() => setQualityOpen((v) => !v)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: '#2563EB', padding: 0 }}>
              <span style={{ fontSize: 16 }}>{qualityOpen ? '▾' : '▸'}</span>
              Требования к качеству (по ГОСТ)
            </button>
            {qualityOpen && (
              <div className='rfq-new-quality' style={{ marginTop: 12 }}>
                {([
                  { key: 'moistureMax', label: 'Влажность макс., %' },
                  { key: 'impurityMax', label: 'Сорная прим. макс., %' },
                  { key: 'glutenMin', label: 'Клейковина мин., %' },
                  { key: 'natweightMin', label: 'Натура мин., г/л' },
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

          <div className='rfq-new-actions'>
            <button
              onClick={handleSubmit}
              disabled={saving || !canSubmit}
              style={{ borderRadius: 12, padding: '12px 20px', background: canSubmit ? '#2563EB' : '#94A3B8', border: `1px solid ${canSubmit ? '#2563EB' : '#94A3B8'}`, color: '#fff', fontSize: 14, fontWeight: 800, cursor: saving || !canSubmit ? 'default' : 'pointer' }}
            >
              {saving ? 'Отправляем…' : 'Отправить запрос'}
            </button>
            <Link
              href={PLATFORM_V7_BUYER_RFQ_ROUTE}
              style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 12, padding: '12px 16px', background: 'var(--pc-bg-card)', border: '1px solid #E4E6EA', color: 'var(--pc-text-primary)', fontSize: 14, fontWeight: 700 }}
            >
              Отмена
            </Link>
          </div>
        </section>

        <section style={{ display: 'grid', gap: 16, alignContent: 'start' }}>
          <div className='rfq-new-surface' style={{ display: 'grid', gap: 14 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--pc-text-primary)' }}>Предпросмотр запроса</div>
            <div style={{ padding: 16, borderRadius: 16, background: 'var(--pc-bg-subtle, #F8FAFB)', border: '1px solid #E4E6EA' }}>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 800, color: '#2563EB', fontSize: 12 }}>RFQ · NEW</div>
              <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--pc-text-primary)', marginTop: 8, lineHeight: 1.3, wordBreak: 'break-word' }}>{crop}</div>
              <div style={{ fontSize: 12, color: '#6B778C', marginTop: 6, lineHeight: 1.6, wordBreak: 'break-word' }}>
                {volumeTons || '—'} т · {region} · {basis}
              </div>
              {(priceRaw || priceMaxRaw) && (
                <div style={{ fontSize: 12, color: '#6B778C', marginTop: 4, lineHeight: 1.6 }}>
                  {priceRaw ? formatPrice(priceRaw) : '?'} — {priceMaxRaw ? formatPrice(priceMaxRaw) : '?'} ₽/т
                </div>
              )}
              {(deliveryFrom || deliveryTo) && (
                <div style={{ fontSize: 12, color: '#6B778C', marginTop: 4, lineHeight: 1.6 }}>
                  {deliveryFrom ? new Date(deliveryFrom).toLocaleDateString('ru-RU') : '?'} — {deliveryTo ? new Date(deliveryTo).toLocaleDateString('ru-RU') : '?'}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', padding: '4px 10px', borderRadius: 999, background: 'rgba(37,99,235,0.08)', border: '1px solid rgba(37,99,235,0.18)', color: '#2563EB', fontSize: 11, fontWeight: 800 }}>BUYER RFQ</span>
              {urgency && <span style={{ display: 'inline-flex', alignItems: 'center', padding: '4px 10px', borderRadius: 999, background: 'rgba(107,114,128,0.08)', border: '1px solid rgba(107,114,128,0.18)', color: '#4B5563', fontSize: 11, fontWeight: 800 }}>{urgencyLabel}</span>}
            </div>

            {!canSubmit && (
              <div style={{ padding: 12, borderRadius: 12, background: 'rgba(217,119,6,0.08)', border: '1px solid rgba(217,119,6,0.16)', fontSize: 12, color: '#92400E', lineHeight: 1.6 }}>
                Укажите объём для отправки запроса.
              </div>
            )}
          </div>

          <div className='rfq-new-surface' style={{ display: 'grid', gap: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--pc-text-primary)' }}>Смежные действия</div>
            {[
              { label: 'Подбор предложений', href: '/platform-v7/buyer/matches', note: 'Найти подходящие лоты прямо сейчас' },
              { label: 'Активные запросы', href: PLATFORM_V7_BUYER_RFQ_ROUTE, note: 'Список всех ваших RFQ' },
              { label: 'Помощник', href: '/platform-v7/ai?from=/platform-v7/buyer/rfq/new&role=buyer', note: 'Задать вопрос по закупке зерна' },
            ].map((item) => (
              <Link key={item.href} href={item.href} style={{ textDecoration: 'none', display: 'grid', gap: 2, padding: '10px 12px', borderRadius: 12, background: 'var(--pc-bg-subtle, #F8FAFB)', border: '1px solid #E4E6EA' }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#2563EB' }}>{item.label} →</span>
                <span style={{ fontSize: 11, color: '#6B778C' }}>{item.note}</span>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
