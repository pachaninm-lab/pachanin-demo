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

export function DemoDealAutoplay({ dealId, amount }: { dealId: string; amount: number }) {
  const [step, setStep] = useState<number | null>(null);
  const [callback, setCallback] = useState<any>(null);
  const [running, setRunning] = useState(false);

  async function run() {
    if (running) return;
    setRunning(true);

    for (let i = 0; i < STEPS.length; i++) {
      setStep(i);
      await delay(800);
    }

    const res = await fetch('/api/sim/bank-callback', {
      method: 'POST',
      body: JSON.stringify({ dealId, amount }),
    });

    const data = await res.json();
    setCallback(data);
    setRunning(false);
  }

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <button onClick={run} style={{ padding: 12, borderRadius: 10, background: '#0A7A5F', color: '#fff', fontWeight: 700 }}>
        Запустить автопрогон
      </button>

      <div style={{ display: 'grid', gap: 6 }}>
        {STEPS.map((s, i) => (
          <div key={s} style={{ fontSize: 13, opacity: step === null ? 0.5 : i <= step ? 1 : 0.3 }}>
            {i + 1}. {s}
          </div>
        ))}
      </div>

      {callback && (
        <div style={{ padding: 10, border: '1px solid #E4E6EA', borderRadius: 10 }}>
          <div style={{ fontWeight: 700 }}>Callback: {callback.id}</div>
          <div style={{ fontSize: 12 }}>Release подтверждён: {callback.amountRub} ₽</div>
        </div>
      )}
    </div>
  );
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
