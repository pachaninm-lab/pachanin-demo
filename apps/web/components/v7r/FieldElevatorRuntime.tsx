'use client';

import * as React from 'react';
import Link from 'next/link';
import { useToast } from '@/components/v7r/Toast';
import { useFieldRuntimeStore } from '@/stores/useFieldRuntimeStore';

export function FieldElevatorRuntime() {
  const toast = useToast();
  const receptions = useFieldRuntimeStore((s) => s.receptions);
  const admitReception = useFieldRuntimeStore((s) => s.admitReception);
  const updateReception = useFieldRuntimeStore((s) => s.updateReception);
  const confirmReception = useFieldRuntimeStore((s) => s.confirmReception);

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18 }}>
        <div style={{ fontSize: 28, fontWeight: 800, color: '#0F1419' }}>Приёмка и весовая</div>
        <div style={{ fontSize: 13, color: '#6B778C', marginTop: 8, lineHeight: 1.7 }}>Экран больше не витрина. Здесь реально двигается состояние по машинам: допуск, вес, СДИЗ и фиксация ФГИС-шага.</div>
      </section>

      {receptions.map((item) => (
        <section key={item.plate} style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18, display: 'grid', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', color: '#0A7A5F', fontSize: 13, fontWeight: 800 }}>{item.plate}</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#0F1419', marginTop: 4 }}>Сделка {item.dealId}</div>
            </div>
            <div style={{ fontSize: 12, fontWeight: 800, color: item.status === 'completed' ? '#15803D' : item.status === 'admitted' ? '#B45309' : '#6B7280' }}>{item.status.toUpperCase()}</div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
            <input value={item.weight} onChange={(e) => updateReception(item.plate, { weight: e.target.value })} placeholder='Вес' style={{ padding: '12px 14px', borderRadius: 12, border: '1px solid #E4E6EA', fontSize: 14 }} />
            <input value={item.sdiz} onChange={(e) => updateReception(item.plate, { sdiz: e.target.value })} placeholder='Номер СДИЗ' style={{ padding: '12px 14px', borderRadius: 12, border: '1px solid #E4E6EA', fontSize: 14 }} />
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {item.status === 'waiting' ? <button onClick={() => { admitReception(item.plate); toast(`Машина ${item.plate} допущена на приёмку.`, 'success'); }} style={{ padding: '12px 16px', borderRadius: 12, border: 'none', background: '#0A7A5F', color: '#fff', fontWeight: 800, cursor: 'pointer' }}>Допустить</button> : null}
            {item.status !== 'completed' ? <button onClick={() => { confirmReception(item.plate); toast(`Приёмка ${item.plate} завершена и отмечена в ФГИС.`, 'success'); }} style={{ padding: '12px 16px', borderRadius: 12, border: '1px solid #E4E6EA', background: '#fff', color: '#0F1419', fontWeight: 700, cursor: 'pointer' }}>Подтвердить приёмку</button> : null}
            <Link href={`/platform-v7/deals/${item.dealId}`} style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '12px 16px', borderRadius: 12, border: '1px solid #E4E6EA', background: '#fff', color: '#0F1419', fontWeight: 700 }}>Открыть сделку</Link>
          </div>

          <div style={{ fontSize: 12, color: '#6B778C' }}>FGIS: {item.fgis ? 'подтверждено' : 'не отправлено'} · Вес: {item.weight || '—'} т · СДИЗ: {item.sdiz || '—'}</div>
        </section>
      ))}
    </div>
  );
}
