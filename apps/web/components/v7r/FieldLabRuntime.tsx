'use client';

import * as React from 'react';
import { useToast } from '@/components/v7r/Toast';
import { useFieldRuntimeStore } from '@/stores/useFieldRuntimeStore';

export function FieldLabRuntime() {
  const toast = useToast();
  const labCases = useFieldRuntimeStore((s) => s.labCases);
  const startLabCase = useFieldRuntimeStore((s) => s.startLabCase);
  const updateLabCase = useFieldRuntimeStore((s) => s.updateLabCase);
  const completeLabCase = useFieldRuntimeStore((s) => s.completeLabCase);

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18 }}>
        <div style={{ fontSize: 28, fontWeight: 800, color: '#0F1419' }}>Лаборатория</div>
        <div style={{ fontSize: 13, color: '#6B778C', marginTop: 8 }}>Формируется протокол качества. Любая дельта влияет на деньги сделки.</div>
      </section>

      {labCases.map((c) => (
        <section key={c.id} style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18, display: 'grid', gap: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
            <div style={{ fontWeight: 800 }}>{c.id} · {c.dealId}</div>
            <div style={{ fontSize: 12, fontWeight: 800, color: c.status === 'completed' ? '#15803D' : c.status === 'in_progress' ? '#B45309' : '#6B7280' }}>{c.status.toUpperCase()}</div>
          </div>
          {c.status === 'new' ? <button onClick={() => { startLabCase(c.id); toast(`Проба ${c.id} взята в работу.`, 'success'); }} style={{ padding: '10px 14px', borderRadius: 10, border: 'none', background: '#0A7A5F', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>Начать анализ</button> : null}
          <input value={c.protein} onChange={(e) => updateLabCase(c.id, { protein: e.target.value })} placeholder='Белок %' style={{ padding: 10, borderRadius: 10, border: '1px solid #E4E6EA' }} />
          <input value={c.moisture} onChange={(e) => updateLabCase(c.id, { moisture: e.target.value })} placeholder='Влажность %' style={{ padding: 10, borderRadius: 10, border: '1px solid #E4E6EA' }} />
          <input value={c.gluten} onChange={(e) => updateLabCase(c.id, { gluten: e.target.value })} placeholder='Клейковина %' style={{ padding: 10, borderRadius: 10, border: '1px solid #E4E6EA' }} />
          {c.status !== 'completed' ? <button onClick={() => { completeLabCase(c.id); toast(`Проба ${c.id} подтверждена.`, 'success'); }} style={{ padding: '10px 14px', borderRadius: 10, border: 'none', background: '#0A7A5F', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>Подтвердить протокол</button> : null}
          <div style={{ fontSize: 12, color: '#6B778C' }}>Результат: {c.result} · Протокол: {c.protocolSigned ? 'подписан' : 'не подписан'}</div>
        </section>
      ))}
    </div>
  );
}
