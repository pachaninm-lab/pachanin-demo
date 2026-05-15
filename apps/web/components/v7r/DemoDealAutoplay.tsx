'use client';

import { useState } from 'react';

const STEPS = [
  'Создание сделки',
  'Резерв денег',
  'Логистика',
  'Приёмка',
  'Лаборатория',
  'Основание для банка',
];

type BankEventState = 'pending' | 'ok';

interface BankEventView {
  id: string;
  amountRub: number;
  state: BankEventState;
  acceptedAt: string;
  confirmedAt?: string;
  latencyMs: number;
}

export function DemoDealAutoplay({ dealId, amount }: { dealId: string; amount: number }) {
  const [step, setStep] = useState<number | null>(null);
  const [bankEvent, setBankEvent] = useState<BankEventView | null>(null);
  const [running, setRunning] = useState(false);

  async function run() {
    if (running) return;
    setRunning(true);
    setBankEvent(null);

    for (let i = 0; i < STEPS.length; i++) {
      setStep(i);
      await delay(800);
    }

    const bankEventId = `BE-${Math.floor(Math.random() * 9000) + 1000}`;
    const latencyMs = 1400 + Math.floor(Math.random() * 1400);
    const acceptedAt = new Date().toISOString();

    setBankEvent({
      id: bankEventId,
      amountRub: amount,
      state: 'pending',
      acceptedAt,
      latencyMs,
    });

    await delay(latencyMs);

    setBankEvent({
      id: bankEventId,
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

      {bankEvent && (
        <div style={{ padding: 12, border: '1px solid #E4E6EA', borderRadius: 12, background: '#fff', display: 'grid', gap: 6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ fontWeight: 700 }}>Событие банка: {bankEvent.id}</div>
            <span style={{ display: 'inline-flex', alignItems: 'center', padding: '4px 8px', borderRadius: 999, background: bankEvent.state === 'pending' ? 'rgba(217,119,6,0.08)' : 'rgba(37,99,235,0.08)', border: bankEvent.state === 'pending' ? '1px solid rgba(217,119,6,0.18)' : '1px solid rgba(37,99,235,0.18)', color: bankEvent.state === 'pending' ? '#B45309' : '#1D4ED8', fontSize: 11, fontWeight: 800 }}>
              {bankEvent.state === 'pending' ? 'Ожидает проверки' : 'Подтверждено банком'}
            </span>
          </div>
          <div style={{ fontSize: 12, color: '#334155' }}>Принят банком: {new Date(bankEvent.acceptedAt).toLocaleTimeString('ru-RU')}</div>
          <div style={{ fontSize: 12, color: '#334155' }}>Сумма основания: {bankEvent.amountRub} ₽</div>
          <div style={{ fontSize: 12, color: '#6B778C' }}>Время проверки: {bankEvent.latencyMs} мс</div>
          {bankEvent.confirmedAt ? <div style={{ fontSize: 12, color: '#334155' }}>Подтверждено: {new Date(bankEvent.confirmedAt).toLocaleTimeString('ru-RU')}</div> : null}
        </div>
      )}
    </div>
  );
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
