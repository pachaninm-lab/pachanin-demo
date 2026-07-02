'use client';

import { useState } from 'react';

type FactorStatus = 'idle' | 'scoring' | 'ready' | 'submitted';

interface Factor {
  id: string;
  name: string;
  rate: string;
  limit: string;
  days: string;
  score: number;
}

const FACTORS: Factor[] = [
  { id: 'sber', name: 'СберФакторинг', rate: '14.5% годовых', limit: '50 млн ₽', days: '120 дней', score: 91 },
  { id: 'tink', name: 'Тинькофф Бизнес', rate: '15.9% годовых', limit: '30 млн ₽', days: '90 дней', score: 86 },
  { id: 'otkr', name: 'Открытие Факторинг', rate: '13.8% годовых', limit: '100 млн ₽', days: '180 дней', score: 88 },
];

const rub = (n: number) =>
  new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(n);

const label: React.CSSProperties = {
  fontSize: 10, fontWeight: 900, color: '#64748B',
  textTransform: 'uppercase', letterSpacing: '0.06em',
};

const scoreMeter = (score: number) => {
  const color = score >= 90 ? '#0A7A5F' : score >= 80 ? '#2563EB' : '#D97706';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 4, borderRadius: 2, background: '#E4E6EA', overflow: 'hidden' }}>
        <div style={{ width: `${score}%`, height: '100%', background: color, borderRadius: 2 }} />
      </div>
      <span style={{ fontSize: 12, fontWeight: 800, color }}>{score}</span>
    </div>
  );
};

export function FactoringPanel({ dealId = 'DL-9102' }: { dealId?: string }) {
  const [status, setStatus] = useState<FactorStatus>('idle');
  const [selected, setSelected] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const dealAmount = 1_650_000;
  const factoringAmount = Math.round(dealAmount * 0.9);

  function runScoring() {
    setStatus('scoring');
    setTimeout(() => setStatus('ready'), 2200);
  }

  function submit() {
    setSubmitted(true);
    setStatus('submitted');
  }

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      {/* Deal summary */}
      <div style={{ padding: '12px 16px', borderRadius: 14, background: '#F0FDF4', border: '1px solid #BBF7D0' }}>
        <div style={label}>По сделке {dealId}</div>
        <div style={{ display: 'flex', gap: 24, marginTop: 8, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 11, color: '#64748B' }}>Сумма сделки</div>
            <div style={{ fontSize: 16, fontWeight: 900, color: '#0F1419' }}>{rub(dealAmount)}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: '#64748B' }}>Доступно к факторингу (90%)</div>
            <div style={{ fontSize: 16, fontWeight: 900, color: '#0A7A5F' }}>{rub(factoringAmount)}</div>
          </div>
        </div>
      </div>

      {/* Scoring block */}
      {status === 'idle' && (
        <div style={{ textAlign: 'center', padding: '24px 16px' }}>
          <div style={{ fontSize: 13, color: '#64748B', marginBottom: 16, lineHeight: 1.5 }}>
            Платформа рассчитает скоринг на основе истории сделок,<br/>
            объёмов, рейтинга и финансовых данных организации.
          </div>
          <button
            onClick={runScoring}
            style={{
              padding: '10px 24px', borderRadius: 12, border: 'none', cursor: 'pointer',
              background: '#2563EB', color: '#fff', fontSize: 13, fontWeight: 800,
            }}
          >
            Запросить скоринг для факторинга
          </button>
        </div>
      )}

      {status === 'scoring' && (
        <div style={{ textAlign: 'center', padding: '24px 16px' }}>
          <div style={{ fontSize: 13, color: '#2563EB', fontWeight: 700 }}>
            Рассчитываем скоринг…
          </div>
          <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 8 }}>
            История сделок · объёмы · рейтинг · НБКИ
          </div>
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          <div style={{ width: 32, height: 32, border: '3px solid #E4E6EA', borderTopColor: '#2563EB', borderRadius: '50%', margin: '16px auto 0', animation: 'spin 0.8s linear infinite' }} />
        </div>
      )}

      {(status === 'ready' || status === 'submitted') && (
        <div style={{ display: 'grid', gap: 10 }}>
          <div style={{ ...label, marginBottom: 2 }}>Предложения факторов</div>
          {FACTORS.map((f) => (
            <div
              key={f.id}
              onClick={() => !submitted && setSelected(f.id)}
              style={{
                padding: '12px 16px', borderRadius: 14, border: `2px solid ${selected === f.id ? '#2563EB' : '#E4E6EA'}`,
                background: selected === f.id ? '#EFF6FF' : '#fff',
                cursor: submitted ? 'default' : 'pointer', display: 'grid', gap: 8,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: '#0F1419' }}>{f.name}</div>
                  <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>{f.rate} · до {f.days}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: '#0F1419' }}>{f.limit}</div>
                  <div style={{ fontSize: 10, color: '#94A3B8' }}>лимит финансирования</div>
                </div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: '#94A3B8', marginBottom: 4 }}>Скоринг платформы</div>
                {scoreMeter(f.score)}
              </div>
            </div>
          ))}

          {!submitted ? (
            <button
              onClick={submit}
              disabled={!selected}
              style={{
                padding: '10px 18px', borderRadius: 12, border: 'none', cursor: selected ? 'pointer' : 'not-allowed',
                background: selected ? '#0A7A5F' : '#E4E6EA', color: selected ? '#fff' : '#94A3B8',
                fontSize: 13, fontWeight: 800, marginTop: 4,
              }}
            >
              Подать заявку на факторинг
            </button>
          ) : (
            <div style={{ padding: '12px 16px', borderRadius: 14, background: '#F0FDF4', border: '1px solid #BBF7D0', textAlign: 'center' }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#0A7A5F' }}>✓ Заявка отправлена</div>
              <div style={{ fontSize: 11, color: '#64748B', marginTop: 4 }}>
                Решение в течение 1 рабочего дня · Подпись договора факторинга УКЭП
              </div>
            </div>
          )}
        </div>
      )}

      <div style={{ fontSize: 9, color: '#94A3B8', padding: '4px 8px', borderRadius: 6, background: '#F8FAFB', border: '1px solid #E4E6EA' }}>
        Демо-превью. В боевом контуре — интеграция с факторинговой компанией через API-адаптер, автоскоринг на данных платформы.
      </div>
    </div>
  );
}
