'use client';

import * as React from 'react';
import { useToast } from '@/components/v7r/Toast';

interface Threshold {
  moisture: number;
  protein: number;
  gluten: number | null;
  impurity: number;
}

interface Sample {
  id: string;
  deal: string;
  cargo: string;
  received: string;
  status: string;
  thresholds: Threshold;
}

const SAMPLES: Sample[] = [
  { id: 'ЛАБ-2847', deal: 'DL-9102', cargo: 'Пшеница 4 кл.', received: '12:00', status: 'Ожидает анализа', thresholds: { moisture: 14, protein: 10, gluten: 23, impurity: 2 } },
  { id: 'ЛАБ-2851', deal: 'DL-9108', cargo: 'Ячмень 3 кл.', received: '13:30', status: 'Ожидает анализа', thresholds: { moisture: 14, protein: 8, gluten: null, impurity: 2 } },
];

interface Protocol {
  moisture: string;
  protein: string;
  gluten: string;
  impurity: string;
}

function checkIndicator(value: string, threshold: number, isMax: boolean): 'ok' | 'fail' | 'empty' {
  if (!value) return 'empty';
  const num = parseFloat(value);
  if (isNaN(num)) return 'empty';
  return isMax ? (num <= threshold ? 'ok' : 'fail') : (num >= threshold ? 'ok' : 'fail');
}

export default function LabPage() {
  const toast = useToast();
  const [openProtocol, setOpenProtocol] = React.useState<string | null>(null);
  const [signed, setSigned] = React.useState<Set<string>>(new Set());
  const [protocols, setProtocols] = React.useState<Record<string, Protocol>>({});
  const [pdfs, setPdfs] = React.useState<Set<string>>(new Set());

  function getProtocol(id: string): Protocol {
    return protocols[id] ?? { moisture: '', protein: '', gluten: '', impurity: '' };
  }

  function updateProtocol(id: string, patch: Partial<Protocol>) {
    setProtocols(prev => ({ ...prev, [id]: { ...getProtocol(id), ...patch } }));
  }

  function handleSign(sample: Sample) {
    const p = getProtocol(sample.id);
    const t = sample.thresholds;
    const checks = [
      checkIndicator(p.moisture, t.moisture, true),
      checkIndicator(p.protein, t.protein, false),
      ...(t.gluten ? [checkIndicator(p.gluten, t.gluten, false)] : []),
      checkIndicator(p.impurity, t.impurity, true),
    ];
    const hasDeviation = checks.includes('fail');

    setSigned(prev => new Set([...prev, sample.id]));
    setPdfs(prev => new Set([...prev, sample.id]));
    setOpenProtocol(null);

    if (hasDeviation) {
      toast(`Протокол ${sample.id} подписан — расхождение! Банковый контур оповещён — выпуск заблокирован`, 'warning');
    } else {
      toast(`Протокол ${sample.id} подписан · все показатели в норме ✅`, 'success');
    }
  }

  const completedCount = signed.size;
  const totalDeviations = [...signed].filter(id => {
    const sample = SAMPLES.find(s => s.id === id);
    const p = getProtocol(id);
    if (!sample) return false;
    const t = sample.thresholds;
    const checks = [
      checkIndicator(p.moisture, t.moisture, true),
      checkIndicator(p.protein, t.protein, false),
      ...(t.gluten ? [checkIndicator(p.gluten, t.gluten, false)] : []),
      checkIndicator(p.impurity, t.impurity, true),
    ];
    return checks.includes('fail');
  }).length;

  return (
    <div style={{ display: 'grid', gap: 16, maxWidth: 760, margin: '0 auto' }}>
      {/* Метрики */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
        {[
          ['Новых проб', String(SAMPLES.length - completedCount)],
          ['Завершено', String(5 + completedCount)],
          ['Расхождений', String(1 + totalDeviations)],
        ].map(([label, value]) => (
          <div key={label} style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 16, padding: 16 }}>
            <div style={{ fontSize: 11, color: '#6B778C', fontWeight: 700, textTransform: 'uppercase', marginBottom: 6 }}>{label}</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: '#0F1419' }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Список проб */}
      {SAMPLES.map(sample => {
        const p = getProtocol(sample.id);
        const t = sample.thresholds;
        const isSigned = signed.has(sample.id);

        const indicators: Array<{ label: string; value: string; threshold: string; field: keyof Protocol; isMax: boolean }> = [
          { label: 'Влажность', value: p.moisture, threshold: `≤${t.moisture}%`, field: 'moisture', isMax: true },
          { label: 'Протеин', value: p.protein, threshold: `≥${t.protein}%`, field: 'protein', isMax: false },
          ...(t.gluten ? [{ label: 'Клейковина', value: p.gluten, threshold: `≥${t.gluten}%`, field: 'gluten' as keyof Protocol, isMax: false }] : []),
          { label: 'Сорная примесь', value: p.impurity, threshold: `≤${t.impurity}%`, field: 'impurity', isMax: true },
        ];

        const checks = indicators.map(ind => checkIndicator(ind.value, parseFloat(ind.threshold.replace(/[^0-9.]/g, '')), ind.isMax));
        const hasDeviation = isSigned && checks.includes('fail');
        const allOk = isSigned && !hasDeviation;

        return (
          <div key={sample.id} style={{ background: '#fff', border: `1px solid ${isSigned ? (hasDeviation ? '#FECACA' : '#BBF7D0') : '#E4E6EA'}`, borderRadius: 18, padding: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
              <div>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 800, color: '#0A7A5F', fontSize: 15 }}>{sample.id}</div>
                <div style={{ fontSize: 13, color: '#0F1419', marginTop: 4 }}>{sample.cargo} · {sample.deal}</div>
                <div style={{ fontSize: 12, color: '#6B778C', marginTop: 2 }}>Получена: {sample.received}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {isSigned && (
                  <span style={{
                    padding: '4px 10px', borderRadius: 999, fontSize: 11, fontWeight: 800,
                    background: allOk ? '#F0FDF4' : '#FEF2F2',
                    color: allOk ? '#16A34A' : '#DC2626',
                    border: `1px solid ${allOk ? '#BBF7D0' : '#FECACA'}`,
                  }}>
                    {allOk ? 'В норме ✅' : 'Расхождение ⚠️'}
                  </span>
                )}
                {!isSigned && (
                  <button
                    onClick={() => setOpenProtocol(openProtocol === sample.id ? null : sample.id)}
                    style={{ padding: '8px 14px', borderRadius: 10, border: '1px solid #E4E6EA', background: '#F5F7F8', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                    {openProtocol === sample.id ? 'Свернуть' : 'Внести протокол'}
                  </button>
                )}
              </div>
            </div>

            {openProtocol === sample.id && !isSigned && (
              <div style={{ borderTop: '1px solid #F1F3F5', paddingTop: 16 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 16 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #E4E6EA' }}>
                      {['Показатель', 'Факт', 'Допуск', 'Статус'].map(h => (
                        <th key={h} style={{ padding: '8px 10px', fontSize: 11, fontWeight: 700, color: '#6B778C', textAlign: 'left', textTransform: 'uppercase' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {indicators.map(ind => {
                      const status = checkIndicator(ind.value, parseFloat(ind.threshold.replace(/[^0-9.]/g, '')), ind.isMax);
                      return (
                        <tr key={ind.field} style={{ borderBottom: '1px solid #F1F3F5' }}>
                          <td style={{ padding: '10px', fontSize: 13 }}>{ind.label}</td>
                          <td style={{ padding: '10px' }}>
                            <input
                              type="text"
                              value={ind.value}
                              onChange={e => updateProtocol(sample.id, { [ind.field]: e.target.value } as Partial<Protocol>)}
                              placeholder="—"
                              style={{ width: 70, padding: '6px 8px', borderRadius: 8, border: '1px solid #E4E6EA', fontSize: 13, textAlign: 'center' }}
                            />
                            <span style={{ fontSize: 12, color: '#6B778C' }}> %</span>
                          </td>
                          <td style={{ padding: '10px', fontSize: 13, color: '#6B778C' }}>{ind.threshold}</td>
                          <td style={{ padding: '10px', fontSize: 16 }}>
                            {status === 'ok' ? '✅' : status === 'fail' ? '❌' : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                <button
                  onClick={() => handleSign(sample)}
                  style={{ padding: '12px 20px', borderRadius: 12, border: 'none', background: '#0A7A5F', color: '#fff', fontSize: 14, fontWeight: 800, cursor: 'pointer' }}>
                  ✅ Подписать протокол {sample.id}
                </button>
              </div>
            )}

            {pdfs.has(sample.id) && (
              <div style={{ marginTop: 12, padding: 14, borderRadius: 12, background: '#F8FAFB', border: '1px solid #E4E6EA', fontFamily: 'monospace', fontSize: 11, color: '#374151', lineHeight: 1.8 }}>
                <div style={{ fontWeight: 800, marginBottom: 8 }}>ПРОТОКОЛ ЛАБОРАТОРНОГО АНАЛИЗА — {sample.id}</div>
                <div>Образец: {sample.cargo} · Сделка: {sample.deal}</div>
                <div>Получен: {sample.received} | Подписан: {new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</div>
                {indicators.map(ind => (
                  <div key={ind.field}>{ind.label}: {getProtocol(sample.id)[ind.field] || 'н/д'}% (допуск {ind.threshold})</div>
                ))}
                <div style={{ marginTop: 8, fontWeight: 800 }}>Заключение: {hasDeviation ? 'Расхождение ⚠️' : allOk ? 'В норме ✅' : '—'}</div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
