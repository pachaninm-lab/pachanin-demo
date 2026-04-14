'use client';

import * as React from 'react';
import { useToast } from '@/components/v7r/Toast';
import { ConfirmDialog } from '@/components/v7r/ConfirmDialog';

interface EvidenceItem { label: string; done: boolean }
interface TimelineItem { time: string; actor: string; text: string }

interface Dispute {
  id: string;
  deal: string;
  typeLabel: string;
  amount: number;
  nextStep: string;
  packageTotal: number;
  packageDone: number;
  deadline: string;
  evidence: EvidenceItem[];
  timeline: TimelineItem[];
}

const DISPUTES: Dispute[] = [
  {
    id: 'DK-2024-89', deal: 'DL-9102', typeLabel: 'Отклонение влажности', amount: 624000,
    nextStep: 'Продавец', packageTotal: 5, packageDone: 4, deadline: '17:00',
    evidence: [
      { label: 'Контракт', done: true },
      { label: 'Лаб. протокол ЛАБ-2847 (ФГИС)', done: true },
      { label: 'Акт сюрвейера ВЗФ-2024-044', done: true },
      { label: 'Банковая выписка резерва', done: true },
      { label: 'Ответ продавца', done: false },
    ],
    timeline: [
      { time: '09:15', actor: 'Покупатель', text: 'Открыт спор по влажности. Факт: 15.2%, допуск: ≤14%' },
      { time: '10:05', actor: 'Система', text: 'Сумма 624 тыс. ₽ заморожена банком' },
      { time: '11:30', actor: 'Лаборатория', text: 'Протокол ЛАБ-2847 подтверждает расхождение' },
      { time: '14:00', actor: 'Система', text: 'SLA: ожидание ответа продавца до 17:00' },
    ],
  },
  {
    id: 'DK-2024-91', deal: 'DL-9110', typeLabel: 'Отклонение веса', amount: 512000,
    nextStep: 'Лаборатория', packageTotal: 4, packageDone: 2, deadline: '19:00',
    evidence: [
      { label: 'Контракт', done: true },
      { label: 'Акт взвешивания (погрузка)', done: true },
      { label: 'Акт взвешивания (разгрузка)', done: false },
      { label: 'Повторный лаб. анализ', done: false },
    ],
    timeline: [
      { time: '10:00', actor: 'Логист', text: 'Открыт спор: вес при разгрузке −1.8 т' },
      { time: '12:00', actor: 'Система', text: '512 тыс. ₽ заморожено' },
    ],
  },
];

function fmtMoney(v: number) { return v.toLocaleString('ru-RU') + ' ₽'; }
function fmtCompact(v: number) { return v >= 1000000 ? `${(v / 1000000).toFixed(1)} млн ₽` : `${Math.round(v / 1000)} тыс. ₽`; }

const ACTOR_COLORS: Record<string, string> = {
  'Покупатель': '#0B6B9A', 'Система': '#374151', 'Лаборатория': '#BE123C',
  'Логист': '#374151', 'Продавец': '#A16207', 'Арбитр': '#9333EA',
};

export default function ArbitratorPage() {
  const toast = useToast();
  const [selected, setSelected] = React.useState<Dispute | null>(null);
  const [confirm, setConfirm] = React.useState<{ open: boolean; title: string; desc: string; onConfirm: () => void }>({ open: false, title: '', desc: '', onConfirm: () => {} });
  const [partialAmount, setPartialAmount] = React.useState('');
  const [showPartial, setShowPartial] = React.useState(false);
  const [newDeadline, setNewDeadline] = React.useState('');
  const [showExtend, setShowExtend] = React.useState(false);
  const [resolved, setResolved] = React.useState<Set<string>>(new Set());

  const totalHold = DISPUTES.reduce((s, d) => s + d.amount, 0);

  function openConfirm(title: string, desc: string, onConfirm: () => void) {
    setConfirm({ open: true, title, desc, onConfirm });
  }

  if (selected) {
    const isResolved = resolved.has(selected.id);
    return (
      <div style={{ display: 'grid', gap: 16, maxWidth: 760, margin: '0 auto' }}>
        <ConfirmDialog {...confirm} onCancel={() => setConfirm(c => ({ ...c, open: false }))} />

        {/* Заголовок */}
        <div style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start', marginBottom: 8 }}>
            <div>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 800, color: '#0A7A5F', fontSize: 16 }}>{selected.id}</div>
              <div style={{ fontSize: 14, fontWeight: 700, marginTop: 4 }}>{selected.typeLabel}</div>
            </div>
            <span style={{ padding: '6px 14px', borderRadius: 999, background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA', fontSize: 13, fontWeight: 800 }}>
              {fmtCompact(selected.amount)} заморожено
            </span>
          </div>
          <div style={{ fontSize: 13, color: '#6B778C' }}>Сделка: {selected.deal} · Дедлайн: {selected.deadline} · Мяч у: {selected.nextStep}</div>
        </div>

        {/* Пакет доказательств */}
        <div style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18 }}>
          <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 14 }}>Пакет доказательств ({selected.packageDone}/{selected.packageTotal})</div>
          {selected.evidence.map(ev => (
            <div key={ev.label} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid #F1F3F5' }}>
              <span style={{ fontSize: 18 }}>{ev.done ? '✅' : '⏳'}</span>
              <span style={{ fontSize: 13, color: ev.done ? '#0F1419' : '#9CA3AF', fontWeight: ev.done ? 600 : 400 }}>{ev.label}</span>
            </div>
          ))}
        </div>

        {/* Таймлайн */}
        <div style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18 }}>
          <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 14 }}>Хроника событий</div>
          <div style={{ display: 'grid', gap: 12 }}>
            {selected.timeline.map((item, i) => (
              <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div style={{
                  width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                  background: ACTOR_COLORS[item.actor] ?? '#374151',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontSize: 11, fontWeight: 800,
                }}>
                  {item.actor[0]}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 2 }}>
                    <span style={{ fontSize: 12, fontWeight: 800, color: ACTOR_COLORS[item.actor] ?? '#374151' }}>{item.actor}</span>
                    <span style={{ fontSize: 11, color: '#9CA3AF' }}>{item.time}</span>
                  </div>
                  <div style={{ fontSize: 13, color: '#374151' }}>{item.text}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Кнопки решения */}
        {!isResolved && (
          <div style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18 }}>
            <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 14 }}>Решение арбитра</div>
            <div style={{ display: 'grid', gap: 10 }}>
              <button
                onClick={() => openConfirm('Выпустить полностью?', `Будет выпущено ${fmtMoney(selected.amount)} продавцу. Это действие необратимо.`, () => {
                  setResolved(prev => new Set([...prev, selected.id]));
                  setConfirm(c => ({ ...c, open: false }));
                  toast(`Выпуск ${fmtCompact(selected.amount)} инициирован`, 'success');
                  setSelected(null);
                })}
                style={{ padding: '12px 20px', borderRadius: 12, border: 'none', background: '#0A7A5F', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', textAlign: 'left' }}>
                ✅ Выпустить полностью — {fmtCompact(selected.amount)}
              </button>

              {!showPartial ? (
                <button
                  onClick={() => setShowPartial(true)}
                  style={{ padding: '12px 20px', borderRadius: 12, border: '1px solid rgba(217,119,6,0.2)', background: 'rgba(217,119,6,0.06)', color: '#B45309', fontSize: 13, fontWeight: 700, cursor: 'pointer', textAlign: 'left' }}>
                  ⚡ Частичный выпуск
                </button>
              ) : (
                <div style={{ padding: 14, borderRadius: 12, border: '1px solid rgba(217,119,6,0.2)', background: 'rgba(217,119,6,0.04)' }}>
                  <label style={{ fontSize: 12, color: '#6B778C', fontWeight: 600, display: 'block', marginBottom: 6 }}>Сумма к выпуску (₽)</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input value={partialAmount} onChange={e => setPartialAmount(e.target.value)} placeholder="300000" style={{ flex: 1, padding: '8px 12px', borderRadius: 10, border: '1px solid #E4E6EA', fontSize: 13 }} />
                    <button onClick={() => {
                      if (partialAmount) { toast(`Частичный выпуск ${parseInt(partialAmount).toLocaleString('ru')} ₽ инициирован`, 'success'); setShowPartial(false); setPartialAmount(''); }
                    }} style={{ padding: '8px 16px', borderRadius: 10, border: 'none', background: '#D97706', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                      Подтвердить
                    </button>
                    <button onClick={() => setShowPartial(false)} style={{ padding: '8px 14px', borderRadius: 10, border: '1px solid #E4E6EA', background: '#F5F7F8', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>✕</button>
                  </div>
                </div>
              )}

              <button
                onClick={() => openConfirm('Вернуть средства?', `${fmtMoney(selected.amount)} будет возвращено покупателю.`, () => {
                  setConfirm(c => ({ ...c, open: false }));
                  toast(`Возврат ${fmtCompact(selected.amount)} инициирован`, 'info');
                  setSelected(null);
                })}
                style={{ padding: '12px 20px', borderRadius: 12, border: '1px solid rgba(220,38,38,0.2)', background: 'rgba(220,38,38,0.06)', color: '#DC2626', fontSize: 13, fontWeight: 700, cursor: 'pointer', textAlign: 'left' }}>
                ↩ Вернуть средства покупателю
              </button>

              {!showExtend ? (
                <button
                  onClick={() => setShowExtend(true)}
                  style={{ padding: '12px 20px', borderRadius: 12, border: '1px solid #E4E6EA', background: '#F5F7F8', color: '#374151', fontSize: 13, fontWeight: 700, cursor: 'pointer', textAlign: 'left' }}>
                  ⏱ Продлить сбор доказательств
                </button>
              ) : (
                <div style={{ padding: 14, borderRadius: 12, border: '1px solid #E4E6EA', background: '#F8FAFB' }}>
                  <label style={{ fontSize: 12, color: '#6B778C', fontWeight: 600, display: 'block', marginBottom: 6 }}>Новый дедлайн</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input type="datetime-local" value={newDeadline} onChange={e => setNewDeadline(e.target.value)} style={{ flex: 1, padding: '8px 12px', borderRadius: 10, border: '1px solid #E4E6EA', fontSize: 13 }} />
                    <button onClick={() => { if (newDeadline) { toast('Дедлайн продлён', 'info'); setShowExtend(false); } }} style={{ padding: '8px 16px', borderRadius: 10, border: 'none', background: '#374151', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                      Сохранить
                    </button>
                    <button onClick={() => setShowExtend(false)} style={{ padding: '8px 14px', borderRadius: 10, border: '1px solid #E4E6EA', background: '#F5F7F8', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>✕</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <button onClick={() => { setSelected(null); setShowPartial(false); setShowExtend(false); }} style={{ padding: '12px 20px', borderRadius: 12, border: '1px solid #E4E6EA', background: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', textAlign: 'left' }}>
          ← Назад к списку
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 16, maxWidth: 760, margin: '0 auto' }}>
      <ConfirmDialog {...confirm} onCancel={() => setConfirm(c => ({ ...c, open: false }))} />

      {/* Метрики */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
        {[
          ['Активных споров', String(DISPUTES.filter(d => !resolved.has(d.id)).length)],
          ['Под удержанием', fmtCompact(totalHold)],
          ['Решений сегодня', String(resolved.size)],
        ].map(([label, value]) => (
          <div key={label} style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 16, padding: 16 }}>
            <div style={{ fontSize: 11, color: '#6B778C', fontWeight: 700, textTransform: 'uppercase', marginBottom: 6 }}>{label}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#0F1419' }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Карточки споров */}
      {DISPUTES.map(d => {
        const isResolved = resolved.has(d.id);
        const pct = Math.round((d.packageDone / d.packageTotal) * 100);
        return (
          <div key={d.id} style={{ background: '#fff', border: `1px solid ${isResolved ? '#BBF7D0' : '#E4E6EA'}`, borderRadius: 18, padding: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start', marginBottom: 12 }}>
              <div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 800, color: '#0A7A5F', fontSize: 14 }}>{d.id}</span>
                  <span style={{ fontSize: 12, color: '#6B778C' }}>· {d.deal}</span>
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#0F1419', marginTop: 4 }}>{d.typeLabel}</div>
                <div style={{ fontSize: 13, color: '#DC2626', fontWeight: 700, marginTop: 2 }}>{fmtCompact(d.amount)}</div>
              </div>
              {isResolved ? (
                <span style={{ padding: '6px 14px', borderRadius: 999, background: '#F0FDF4', color: '#16A34A', border: '1px solid #BBF7D0', fontSize: 12, fontWeight: 800 }}>Решено ✅</span>
              ) : (
                <button onClick={() => setSelected(d)} style={{ padding: '10px 18px', borderRadius: 12, border: 'none', background: '#0A7A5F', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                  Открыть комнату разбора
                </button>
              )}
            </div>

            {!isResolved && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: '#6B778C' }}>Доказательства {d.packageDone}/{d.packageTotal}</span>
                  <span style={{ fontSize: 12, color: '#6B778C' }}>Мяч у: <strong>{d.nextStep}</strong> · Дедлайн: {d.deadline}</span>
                </div>
                <div style={{ height: 6, borderRadius: 999, background: '#E4E6EA', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: pct >= 80 ? '#0A7A5F' : '#D97706', borderRadius: 999, transition: 'width 0.3s' }} />
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
