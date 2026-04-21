'use client';

import Link from 'next/link';
import { lots as baseLots } from '@/lib/v7r/esia-fgis-data';
import { useCommercialRuntimeStore } from '@/stores/useCommercialRuntimeStore';

const FIELDS: Array<{ label: string; getter: (lot: (typeof baseLots)[number]) => string }> = [
  { label: 'Название', getter: (lot) => lot.title },
  { label: 'Культура', getter: (lot) => lot.grain },
  { label: 'Объём, т', getter: (lot) => String(lot.volumeTons) },
  { label: 'Источник', getter: (lot) => lot.sourceType },
  { label: 'Состояние gate', getter: (lot) => lot.readiness.state },
  { label: 'Следующий шаг', getter: (lot) => lot.readiness.nextStep ?? '—' },
  { label: 'Следующий владелец', getter: (lot) => lot.readiness.nextOwner ?? '—' },
  { label: 'Source reference', getter: (lot) => lot.sourceReference ?? '—' },
];

function metricTone(count: number) {
  return count > 0
    ? { bg: 'rgba(37,99,235,0.08)', border: 'rgba(37,99,235,0.18)', color: '#2563EB' }
    : { bg: '#F8FAFB', border: '#E4E6EA', color: '#6B778C' };
}

export function LotsCompareRuntime() {
  const { compareLotIds, clearCompareLots, toggleCompareLot, manualLots } = useCommercialRuntimeStore();
  const mergedLots = [...manualLots, ...baseLots];
  const comparedLots = compareLotIds
    .map((id) => mergedLots.find((lot) => lot.id === id))
    .filter((lot): lot is (typeof mergedLots)[number] => Boolean(lot));
  const tone = metricTone(comparedLots.length);

  return (
    <div style={{ display: 'grid', gap: 18, maxWidth: 1120, margin: '0 auto' }}>
      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 28, lineHeight: 1.15, fontWeight: 800, color: '#0F1419' }}>Сравнение лотов</div>
            <div style={{ fontSize: 13, color: '#6B778C', lineHeight: 1.7, marginTop: 8, maxWidth: 860 }}>
              Отдельная рабочая поверхность для быстрого сравнения лотов по gate, источнику, следующему шагу и объёму. Это продолжение реестра лотов, а не отдельная витрина.
            </div>
          </div>
          <div style={{ display: 'inline-flex', alignItems: 'center', padding: '8px 12px', borderRadius: 999, background: tone.bg, border: `1px solid ${tone.border}`, color: tone.color, fontSize: 12, fontWeight: 800 }}>
            В сравнении: {comparedLots.length} / 3
          </div>
        </div>
      </section>

      {comparedLots.length ? (
        <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18, display: 'grid', gap: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#0F1419' }}>Матрица сравнения</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button onClick={clearCompareLots} style={{ borderRadius: 10, padding: '8px 12px', background: '#fff', border: '1px solid #E4E6EA', color: '#6B778C', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Очистить всё</button>
              <Link href='/platform-v7/lots' style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 10, padding: '8px 12px', background: 'rgba(10,122,95,0.08)', border: '1px solid rgba(10,122,95,0.16)', color: '#0A7A5F', fontSize: 12, fontWeight: 700 }}>Назад к лотам</Link>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
              <thead>
                <tr style={{ textAlign: 'left', background: '#F8FAFB' }}>
                  <th style={{ padding: '12px 14px', borderBottom: '1px solid #E4E6EA', fontSize: 11, color: '#6B778C', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 800 }}>Параметр</th>
                  {comparedLots.map((lot) => (
                    <th key={lot.id} style={{ padding: '12px 14px', borderBottom: '1px solid #E4E6EA', verticalAlign: 'top' }}>
                      <div style={{ display: 'grid', gap: 6 }}>
                        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, fontWeight: 800, color: '#0A7A5F' }}>{lot.id}</div>
                        <div style={{ fontSize: 14, fontWeight: 800, color: '#0F1419' }}>{lot.title}</div>
                        <button onClick={() => toggleCompareLot(lot.id)} style={{ justifySelf: 'start', borderRadius: 10, padding: '6px 10px', background: '#fff', border: '1px solid #E4E6EA', color: '#6B778C', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Убрать</button>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {FIELDS.map((field) => (
                  <tr key={field.label} style={{ borderTop: '1px solid #E4E6EA' }}>
                    <td style={{ padding: '12px 14px', fontSize: 12, color: '#6B778C', fontWeight: 700 }}>{field.label}</td>
                    {comparedLots.map((lot) => (
                      <td key={`${field.label}-${lot.id}`} style={{ padding: '12px 14px', fontSize: 13, color: '#0F1419', fontWeight: 700 }}>{field.getter(lot)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 24, display: 'grid', gap: 12 }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#0F1419' }}>Пока нечего сравнивать</div>
          <div style={{ fontSize: 13, color: '#6B778C', lineHeight: 1.7 }}>Добавь 2–3 лота из реестра через кнопку «Сравнить», и здесь появится матрица сравнения по основным параметрам.</div>
          <div>
            <Link href='/platform-v7/lots' style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 12, padding: '10px 14px', background: '#0A7A5F', border: '1px solid #0A7A5F', color: '#fff', fontSize: 13, fontWeight: 800 }}>Открыть реестр лотов</Link>
          </div>
        </section>
      )}
    </div>
  );
}
