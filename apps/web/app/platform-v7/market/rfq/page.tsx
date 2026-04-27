'use client';

import * as React from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { SANDBOX_MARKET_LOTS } from '@/lib/platform-v7/fgis-lot-passport';
import { P7ActionButton, type P7ActionButtonState } from '@/components/platform-v7/P7ActionButton';

const S = 'var(--pc-bg-card)';
const SS = 'var(--pc-bg-elevated)';
const B = 'var(--pc-border)';
const T = 'var(--pc-text-primary)';
const M = 'var(--pc-text-secondary)';
const BRAND = '#0A7A5F';
const BRAND_BG = 'rgba(10,122,95,0.08)';
const BRAND_BORDER = 'rgba(10,122,95,0.18)';
const WARN = '#B45309';
const INFO_BG = 'rgba(37,99,235,0.06)';
const INFO_BORDER = 'rgba(37,99,235,0.18)';
const INFO = '#2563EB';

type Step = 'details' | 'quality' | 'confirm';

function selectStyle(): React.CSSProperties {
  return {
    borderRadius: 10,
    padding: '9px 12px',
    border: `1px solid ${B}`,
    background: S,
    color: T,
    fontSize: 13,
    fontWeight: 700,
    minHeight: 40,
    width: '100%',
  };
}

function inputStyle(): React.CSSProperties {
  return { ...selectStyle() };
}

export default function RFQPage() {
  const searchParams = useSearchParams();
  const lotId = searchParams.get('lot');
  const prefillGrain = searchParams.get('grain') ?? '';

  const prefillLot = lotId ? SANDBOX_MARKET_LOTS.find((l) => l.id === lotId) : undefined;

  const [step, setStep] = React.useState<Step>('details');
  const [grain, setGrain] = React.useState(prefillLot?.grain ?? prefillGrain ?? 'Пшеница 4 кл.');
  const [volume, setVolume] = React.useState(prefillLot ? String(prefillLot.volumeTons) : '');
  const [targetPrice, setTargetPrice] = React.useState(prefillLot ? String(prefillLot.pricePerTon) : '');
  const [region, setRegion] = React.useState(prefillLot?.region ?? '');
  const [moisture, setMoisture] = React.useState('');
  const [protein, setProtein] = React.useState('');
  const [gostClass, setGostClass] = React.useState('');
  const [submitState, setSubmitState] = React.useState<P7ActionButtonState>('idle');

  const canProceedStep1 = grain.trim() && volume && region.trim();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitState('loading');
    setTimeout(() => setSubmitState('success'), 1800);
  }

  const stepLabels: Record<Step, string> = {
    details: '1. Параметры',
    quality: '2. Качество',
    confirm: '3. Подтверждение',
  };

  return (
    <div style={{ display: 'grid', gap: 18, padding: '8px 0', maxWidth: 720 }}>
      {/* Header */}
      <section style={{ background: S, border: `1px solid ${B}`, borderRadius: 18, padding: 18 }}>
        <div style={{ fontSize: 11, color: M, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Рынок · RFQ · <span style={{ color: WARN }}>sandbox</span>
        </div>
        <div style={{ fontSize: 24, fontWeight: 900, color: T, marginTop: 8 }}>Запрос на покупку (RFQ)</div>
        {prefillLot && (
          <div style={{ marginTop: 8, padding: '8px 12px', background: BRAND_BG, border: `1px solid ${BRAND_BORDER}`, borderRadius: 10, fontSize: 13, color: BRAND, fontWeight: 700 }}>
            Создаётся по лоту {prefillLot.id} · {prefillLot.seller.name}
          </div>
        )}
        <div style={{ marginTop: 8 }}>
          <Link href='/platform-v7/market' style={{ fontSize: 13, color: BRAND, fontWeight: 700, textDecoration: 'none' }}>
            ← Назад на площадку
          </Link>
        </div>
      </section>

      {/* Step indicator */}
      <div style={{ display: 'flex', gap: 0, background: S, border: `1px solid ${B}`, borderRadius: 14, overflow: 'hidden' }}>
        {(['details', 'quality', 'confirm'] as Step[]).map((s, i) => {
          const isActive = step === s;
          const isDone = (step === 'quality' && s === 'details') || (step === 'confirm' && s !== 'confirm');
          return (
            <div
              key={s}
              style={{
                flex: 1,
                padding: '12px 10px',
                fontSize: 12,
                fontWeight: 800,
                textAlign: 'center',
                color: isActive ? BRAND : isDone ? BRAND : M,
                background: isActive ? BRAND_BG : 'transparent',
                borderRight: i < 2 ? `1px solid ${B}` : 'none',
                cursor: isDone ? 'pointer' : 'default',
              }}
              onClick={() => {
                if (s === 'details') setStep('details');
                if (s === 'quality' && step === 'confirm') setStep('quality');
              }}
            >
              {isDone ? '✓ ' : ''}{stepLabels[s]}
            </div>
          );
        })}
      </div>

      {/* Step 1: Details */}
      {step === 'details' && (
        <section style={{ background: S, border: `1px solid ${B}`, borderRadius: 18, padding: 18 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: T, marginBottom: 16 }}>Параметры закупки</div>
          <div style={{ display: 'grid', gap: 14 }}>
            <div style={{ display: 'grid', gap: 4 }}>
              <label style={{ fontSize: 11, fontWeight: 800, color: M, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Культура *</label>
              <select value={grain} onChange={(e) => setGrain(e.target.value)} style={selectStyle()}>
                {['Пшеница 3 кл.', 'Пшеница 4 кл.', 'Кукуруза 1 кл.', 'Ячмень 2 кл.'].map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ display: 'grid', gap: 4 }}>
                <label style={{ fontSize: 11, fontWeight: 800, color: M, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Объём, тонн *</label>
                <input
                  type='number'
                  placeholder='300'
                  value={volume}
                  onChange={(e) => setVolume(e.target.value)}
                  style={inputStyle()}
                />
              </div>
              <div style={{ display: 'grid', gap: 4 }}>
                <label style={{ fontSize: 11, fontWeight: 800, color: M, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Целевая цена, ₽/т</label>
                <input
                  type='number'
                  placeholder='13000'
                  value={targetPrice}
                  onChange={(e) => setTargetPrice(e.target.value)}
                  style={inputStyle()}
                />
              </div>
            </div>
            <div style={{ display: 'grid', gap: 4 }}>
              <label style={{ fontSize: 11, fontWeight: 800, color: M, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Регион доставки *</label>
              <input
                type='text'
                placeholder='Тамбовская'
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                style={inputStyle()}
              />
            </div>
            <P7ActionButton
              variant='primary'
              disabled={!canProceedStep1}
              disabledReason='Заполните культуру, объём и регион'
              onClick={() => setStep('quality')}
            >
              Далее: требования к качеству
            </P7ActionButton>
          </div>
        </section>
      )}

      {/* Step 2: Quality */}
      {step === 'quality' && (
        <section style={{ background: S, border: `1px solid ${B}`, borderRadius: 18, padding: 18 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: T, marginBottom: 16 }}>Требования к качеству (опционально)</div>
          <div style={{ display: 'grid', gap: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 12 }}>
              <div style={{ display: 'grid', gap: 4 }}>
                <label style={{ fontSize: 11, fontWeight: 800, color: M, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Влажность, % макс.</label>
                <input type='number' placeholder='14' value={moisture} onChange={(e) => setMoisture(e.target.value)} style={inputStyle()} />
              </div>
              <div style={{ display: 'grid', gap: 4 }}>
                <label style={{ fontSize: 11, fontWeight: 800, color: M, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Белок, % мин.</label>
                <input type='number' placeholder='11' value={protein} onChange={(e) => setProtein(e.target.value)} style={inputStyle()} />
              </div>
              <div style={{ display: 'grid', gap: 4 }}>
                <label style={{ fontSize: 11, fontWeight: 800, color: M, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Класс ГОСТ</label>
                <select value={gostClass} onChange={(e) => setGostClass(e.target.value)} style={selectStyle()}>
                  <option value=''>Не важно</option>
                  <option value='3'>3 класс</option>
                  <option value='4'>4 класс</option>
                  <option value='5'>5 класс</option>
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <P7ActionButton variant='secondary' onClick={() => setStep('details')}>Назад</P7ActionButton>
              <P7ActionButton variant='primary' onClick={() => setStep('confirm')}>Далее: подтвердить RFQ</P7ActionButton>
            </div>
          </div>
        </section>
      )}

      {/* Step 3: Confirm */}
      {step === 'confirm' && (
        <form onSubmit={handleSubmit}>
          <section style={{ background: S, border: `1px solid ${B}`, borderRadius: 18, padding: 18 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: T, marginBottom: 16 }}>Подтверждение запроса</div>

            {submitState === 'success' ? (
              <div style={{ background: BRAND_BG, border: `1px solid ${BRAND_BORDER}`, borderRadius: 14, padding: 20, textAlign: 'center' }}>
                <div style={{ fontSize: 22, fontWeight: 900, color: BRAND, marginBottom: 8 }}>RFQ отправлен ✓</div>
                <div style={{ fontSize: 14, color: M, marginBottom: 16 }}>
                  Sandbox-симуляция: продавцы получат уведомление и смогут прислать предложения.
                </div>
                <Link href='/platform-v7/market' style={{ display: 'inline-flex', alignItems: 'center', padding: '10px 18px', borderRadius: 12, background: BRAND_BG, border: `1px solid ${BRAND_BORDER}`, color: BRAND, fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>
                  Вернуться на площадку
                </Link>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 14 }}>
                <div style={{ background: INFO_BG, border: `1px solid ${INFO_BORDER}`, borderRadius: 12, padding: 14, display: 'grid', gap: 8 }}>
                  <Row label='Культура' value={grain} />
                  <Row label='Объём' value={`${volume} т`} />
                  {targetPrice && <Row label='Целевая цена' value={`${Number(targetPrice).toLocaleString('ru-RU')} ₽/т`} />}
                  <Row label='Регион доставки' value={region} />
                  {moisture && <Row label='Влажность макс.' value={`${moisture}%`} />}
                  {protein && <Row label='Белок мин.' value={`${protein}%`} />}
                  {gostClass && <Row label='Класс ГОСТ' value={gostClass} />}
                  {prefillLot && <Row label='По лоту' value={`${prefillLot.id} · ${prefillLot.seller.name}`} highlight />}
                </div>
                <div style={{ fontSize: 12, color: M }}>
                  sandbox — реальный запрос не отправляется. Используется для демонстрации потока создания сделки.
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <P7ActionButton variant='secondary' type='button' onClick={() => setStep('quality')}>Назад</P7ActionButton>
                  <P7ActionButton
                    variant='primary'
                    type='submit'
                    state={submitState}
                    loadingLabel='Отправляем RFQ…'
                    successLabel='RFQ создан ✓'
                    errorLabel='Ошибка'
                  >
                    Отправить RFQ
                  </P7ActionButton>
                </div>
              </div>
            )}
          </section>
        </form>
      )}
    </div>
  );
}

function Row({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 13 }}>
      <span style={{ color: M, fontWeight: 700 }}>{label}</span>
      <span style={{ fontWeight: 800, color: highlight ? BRAND : T }}>{value}</span>
    </div>
  );
}
