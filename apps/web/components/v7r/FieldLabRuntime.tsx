'use client';

import * as React from 'react';
import { useToast } from '@/components/v7r/Toast';
import { useFieldRuntimeStore } from '@/stores/useFieldRuntimeStore';

export function FieldLabRuntime() {
  const toast = useToast();
  const samples = useFieldRuntimeStore((s) => s.samples);
  const registerSample = useFieldRuntimeStore((s) => s.registerSample);
  const updateSample = useFieldRuntimeStore((s) => s.updateSample);
  const confirmSample = useFieldRuntimeStore((s) => s.confirmSample);

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18 }}>
        <div style={{ fontSize: 28, fontWeight: 800, color: '#0F1419' }}>Лаборатория</div>
        <div style={{ fontSize: 13, color: '#6B778C', marginTop: 8 }}>Формируется протокол качества. Любая дельта → влияет на деньги сделки.</div>
      </section>

      <button onClick={() => { registerSample(); toast('Проба зарегистрирована.', 'success'); }} style={{ padding: '12px 16px', borderRadius: 12, border: 'none', background: '#0A7A5F', color: '#fff', fontWeight: 800 }}>Зарегистрировать пробу</button>

      {samples.map((s) => (
        <section key={s.id} style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18, display: 'grid', gap: 10 }}>
          <div style={{ fontWeight: 800 }}>Проба {s.id}</div>
          <input value={s.protein} onChange={(e) => updateSample(s.id, { protein: e.target.value })} placeholder='Белок %' style={{ padding: 10, borderRadius: 10, border: '1px solid #E4E6EA' }} />
          <input value={s.moisture} onChange={(e) => updateSample(s.id, { moisture: e.target.value })} placeholder='Влажность %' style={{ padding: 10, borderRadius: 10, border: '1px solid #E4E6EA' }} />
          <input value={s.gluten} onChange={(e) => updateSample(s.id, { gluten: e.target.value })} placeholder='Клейковина %' style={{ padding: 10, borderRadius: 10, border: '1px solid #E4E6EA' }} />
          <button onClick={() => { confirmSample(s.id); toast(`Проба ${s.id} подтверждена.`, 'success'); }} style={{ padding: '10px 14px', borderRadius: 10, border: 'none', background: '#0A7A5F', color: '#fff', fontWeight: 700 }}>Подтвердить</button>
        </section>
      ))}
    </div>
  );
}
