'use client';

import { useState } from 'react';

const STEPS = [
  'Создание сделки',
  'Резерв денег',
  'Логистика',
  'Приёмка',
  'Лаборатория',
  'Release денег',
];

type CallbackState = 'pending' | 'ok';

interface CallbackView {
  id: string;
  amountRub: number;
  state: CallbackState;
  acceptedAt: string;
  confirmedAt?: string;
  latencyMs: number;
}

export function DemoDealAutoplay({ dealId, amount }: { dealId: string; amount: number }) {
  const [step, setStep] = useState<number | null>(null);
  const [callback, setCallback] = useState<CallbackView | null>(null);
  const [running, setRunning] = useState(false);

  async function run() {
    if (running) return;
    setRunning(true);
    setCallback(null);

    for (let i = 0; i < STEPS.length; i++) {
      setStep(i);
      await delay(800);
    }

    const callbackId = `CB-${Math.floor(Math.random() * 9000) + 1000}`;
    const latencyMs = 1400 + Math.floor(Math.random() * 1400);
    const acceptedAt = new Date().toISOString();

    setCallback({
      id: callbackId,
      amountRub: amount,
      state: 'pending',
      acceptedAt,
      latencyMs,
    });

    await delay(latencyMs);

    setCallback({
      id: callbackId,
      amountRub: amount,
      state: 'ok',
      acceptedAt,
      confirmedAt: new Date().toISOString(),
      latencyMs,
    });

    setRunning(false);
  }

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <button onClick={run} style={{ padding: 12, borderRadius: 10, background: '#0A7A5F', color: '#fff', fontWeight: 700 }}>
        {running ? 'Идёт автопрогон…' : 'Запустить автопрогон'}
      </button>

      <div style={{ display: 'grid', gap: 6 }}>
        {STEPS.map((s, i) => (
          <div key={s} style={{ fontSize: 13, opacity: step === null ? 0.5 : i <= step ? 1 : 0.3 }}>
            {i + 1}. {s}
          </div>
        ))}
      </div>

      {callback && (
        <div style={{ padding: 12, border: '1px solid #E4E6EA', borderRadius: 12, background: '#fff', display: 'grid', gap: 6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ fontWeight: 700 }}>Webhook: {callback.id}</div>
            <span style={{ display: 'inline-flex', alignItems: 'center', padding: '4px 8px', borderRadius: 999, background: callback.state === 'pending' ? 'rgba(217,119,6,0.08)' : 'rgba(37,99,235,0.08)', border: callback.state === 'pending' ? '1px solid rgba(217,119,6,0.18)' : '1px solid rgba(37,99,235,0.18)', color: callback.state === 'pending' ? '#B45309' : '#1D4ED8', fontSize: 11, fontWeight: 800 }}>
              {callback.state === 'pending' ? 'Webhook pending' : 'Webhook ok'}
            </span>
          </div>
          <div style={{ fontSize: 12, color: '#334155' }}>Принят банком: {new Date(callback.acceptedAt).toLocaleTimeString('ru-RU')}</div>
          <div style={{ fontSize: 12, color: '#334155' }}>Сумма release: {callback.amountRub} ₽</div>
          <div style={{ fontSize: 12, color: '#6B778C' }}>Задержка шлюза: {callback.latencyMs} мс</div>
          {callback.confirmedAt ? <div style={{ fontSize: 12, color: '#334155' }}>Подтверждён: {new Date(callback.confirmedAt).toLocaleTimeString('ru-RU')}</div> : null}
        </div>
      )}
    </div>
  );
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
