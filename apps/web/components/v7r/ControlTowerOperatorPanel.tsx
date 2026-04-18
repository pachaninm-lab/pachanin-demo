'use client';

import { useMemo, useState } from 'react';
import { formatCompactMoney, formatMoney } from '@/lib/v7r/helpers';

type GateState = 'PASS' | 'REVIEW' | 'FAIL';

export interface OperatorDealItem {
  id: string;
  title: string;
  gateState: GateState;
  nextStep: string | null;
  nextOwner: string | null;
  releasableAmount: number;
  releaseEligible: boolean;
  reasonCodes: string[];
}

interface AuditRow {
  id: string;
  ts: string;
  actor: string;
  action: string;
  detail: string;
}

function gateTone(state: GateState) {
  if (state === 'PASS') return { bg: 'rgba(10,122,95,0.08)', border: 'rgba(10,122,95,0.18)', color: '#0A7A5F' };
  if (state === 'REVIEW') return { bg: 'rgba(217,119,6,0.08)', border: 'rgba(217,119,6,0.18)', color: '#B45309' };
  return { bg: 'rgba(220,38,38,0.08)', border: 'rgba(220,38,38,0.18)', color: '#B91C1C' };
}

export function ControlTowerOperatorPanel({ deals }: { deals: OperatorDealItem[] }) {
  const [items, setItems] = useState(deals);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [callbacks, setCallbacks] = useState<Record<string, { id: string; amountRub: number; ts: string }>>({});

  const blockedAmount = useMemo(
    () => items.filter((item) => item.gateState !== 'PASS').reduce((sum, item) => sum + item.releasableAmount, 0),
    [items],
  );

  function pushAudit(action: string, detail: string) {
    const row: AuditRow = {
      id: `AUD-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
      ts: new Date().toISOString(),
      actor: 'Оператор платформы',
      action,
      detail,
    };
    setAudit((prev) => [row, ...prev].slice(0, 8));
  }

  async function unblock(item: OperatorDealItem) {
    if (busyId) return;
    setBusyId(item.id);

    setItems((prev) => prev.map((row) => row.id === item.id ? { ...row, gateState: 'PASS', nextStep: 'Gate снят. Можно двигать контур дальше.', nextOwner: 'Банк', reasonCodes: [] } : row));
    pushAudit('Снят blocker', `${item.id}: оператор снял интеграционный blocker и перевёл gate в PASS.`);

    if (item.releaseEligible && item.releasableAmount > 0) {
      try {
        const res = await fetch('/api/sim/bank-callback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dealId: item.id, amount: item.releasableAmount }),
        });
        const data = await res.json();
        setCallbacks((prev) => ({ ...prev, [item.id]: { id: data.id, amountRub: data.amountRub, ts: data.ts } }));
        pushAudit('Деньги пошли', `${item.id}: fake-live callback ${data.id} подтвердил выпуск ${formatMoney(data.amountRub)}.`);
      } catch {
        pushAudit('Ошибка callback', `${item.id}: не удалось получить fake-live callback.`);
      }
    }

    setBusyId(null);
  }

  return (
    <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18, display: 'grid', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#0F1419' }}>Операторские действия</div>
          <div style={{ marginTop: 4, fontSize: 13, color: '#6B778C' }}>Прямо из Control Tower: снять blocker, увидеть audit и получить fake-live callback по release.</div>
        </div>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 999, background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.18)', color: '#B91C1C', fontSize: 12, fontWeight: 800 }}>
          Под gate: {formatCompactMoney(blockedAmount)}
        </div>
      </div>

      <div style={{ display: 'grid', gap: 10 }}>
        {items.map((item) => {
          const tone = gateTone(item.gateState);
          const callback = callbacks[item.id];
          return (
            <div key={item.id} style={{ border: '1px solid #E4E6EA', borderRadius: 14, padding: 14, display: 'grid', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                <div>
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, fontWeight: 800, color: '#0A7A5F' }}>{item.id}</div>
                  <div style={{ marginTop: 4, fontSize: 14, fontWeight: 800, color: '#0F1419' }}>{item.title}</div>
                </div>
                <span style={{ display: 'inline-flex', alignItems: 'center', padding: '5px 9px', borderRadius: 999, background: tone.bg, border: `1px solid ${tone.border}`, color: tone.color, fontSize: 11, fontWeight: 800 }}>
                  Gate {item.gateState}
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
                <InfoCell label='Причины' value={item.reasonCodes.length ? item.reasonCodes.join(' · ') : '—'} />
                <InfoCell label='Следующий шаг' value={item.nextStep ?? '—'} />
                <InfoCell label='Следующий владелец' value={item.nextOwner ?? '—'} />
                <InfoCell label='Потенциальный release' value={formatCompactMoney(item.releasableAmount)} />
              </div>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {item.gateState !== 'PASS' ? (
                  <button
                    onClick={() => unblock(item)}
                    disabled={busyId === item.id}
                    style={{ borderRadius: 10, padding: '10px 12px', border: '1px solid #0A7A5F', background: '#0A7A5F', color: '#fff', fontWeight: 700, cursor: busyId === item.id ? 'wait' : 'pointer' }}
                  >
                    {busyId === item.id ? 'Снимаю blocker…' : 'Снять blocker'}
                  </button>
                ) : (
                  <span style={{ display: 'inline-flex', alignItems: 'center', padding: '10px 12px', borderRadius: 10, background: 'rgba(10,122,95,0.08)', border: '1px solid rgba(10,122,95,0.18)', color: '#0A7A5F', fontWeight: 700 }}>
                    Gate уже PASS
                  </span>
                )}
                {callback ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', padding: '10px 12px', borderRadius: 10, background: 'rgba(37,99,235,0.08)', border: '1px solid rgba(37,99,235,0.18)', color: '#1D4ED8', fontWeight: 700 }}>
                    {callback.id} · {formatMoney(callback.amountRub)}
                  </span>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ display: 'grid', gap: 10 }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: '#0F1419' }}>Журнал действий оператора</div>
        {audit.length ? audit.map((row) => (
          <div key={row.id} style={{ border: '1px solid #E4E6EA', borderRadius: 14, padding: 12, background: '#F8FAFB' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#0F1419' }}>{row.action}</div>
              <div style={{ fontSize: 11, color: '#6B778C' }}>{new Date(row.ts).toLocaleString('ru-RU')}</div>
            </div>
            <div style={{ marginTop: 4, fontSize: 12, color: '#475569' }}>{row.actor}</div>
            <div style={{ marginTop: 6, fontSize: 13, color: '#334155' }}>{row.detail}</div>
          </div>
        )) : <div style={{ fontSize: 13, color: '#6B778C' }}>Действий пока нет. Сними blocker по одному из кейсов выше.</div>}
      </div>
    </section>
  );
}

function InfoCell({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ border: '1px solid #E4E6EA', borderRadius: 12, padding: 12, background: '#fff' }}>
      <div style={{ fontSize: 11, color: '#6B778C', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 800 }}>{label}</div>
      <div style={{ marginTop: 6, fontSize: 13, color: '#0F1419', lineHeight: 1.5 }}>{value}</div>
    </div>
  );
}
