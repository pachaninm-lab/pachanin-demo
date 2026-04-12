'use client';
import * as React from 'react';
import Link from 'next/link';
import { useOfflineQueueStore } from '@/stores/useOfflineQueueStore';
import { Badge } from '@/components/v9/ui/badge';
import { Button } from '@/components/v9/ui/button';

// UUID v4 — inline polyfill for simplicity
function genUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

export default function FieldPage() {
  const { events, isOnline, enqueue, pendingCount } = useOfflineQueueStore();
  const pending = pendingCount();

  const confirm = () => {
    enqueue({
      id: genUUID(),
      dealId: 'DL-9102',
      type: 'arrival',
      timestamp: new Date().toISOString(),
      payload: { location: 'Элеватор Черноземный', eta: '14:30' },
    });
  };

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Offline indicator */}
      {!isOnline && (
        <div role="status" aria-live="assertive" style={{ padding: '10px 16px', background: 'rgba(217,119,6,0.1)', border: '1px solid rgba(217,119,6,0.3)', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#D97706' }}>OFFLINE</span>
          <span style={{ fontSize: 12, color: '#D97706' }}>В очереди: {pending} событий — отправятся при подключении</span>
        </div>
      )}

      {/* Hero */}
      <div style={{ borderLeft: '4px solid #D97706', paddingLeft: 16 }}>
        <div>
          <Badge variant="warning">ВОДИТЕЛЬ · РЕЙС ДОС-2847</Badge>
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: '#0F1419', margin: '8px 0 4px' }}>Один экран — один шаг</h1>
        <p style={{ fontSize: 13, color: '#6B778C', margin: 0 }}>Полевая логика. Текущее действие, GPS и офлайн-очередь.</p>
      </div>

      {/* Main action */}
      <div style={{ padding: 20, background: 'rgba(249,115,22,0.06)', borderRadius: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#D97706', letterSpacing: '0.06em' }}>Следующий шаг</div>
        <div style={{ fontSize: 22, fontWeight: 800, marginTop: 8, lineHeight: 1.2 }}>Подтвердить прибытие на площадку</div>
        <div style={{ fontSize: 13, color: '#6B778C', marginTop: 6 }}>Элеватор Черноземный · ETA 14:30</div>
        <button
          onClick={confirm}
          style={{
            marginTop: 16, width: '100%', minHeight: 64,
            background: '#D97706', color: '#fff', border: 'none',
            borderRadius: 10, fontSize: 16, fontWeight: 800, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
          aria-label="Подтвердить прибытие на площадку"
        >
          ✓ Подтвердить прибытие
        </button>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
          <Badge variant="success">GPS активен</Badge>
          {pending > 0 && <Badge variant="warning">{pending} событий offline</Badge>}
          <Badge variant="neutral">Кукуруза · 20 т</Badge>
        </div>
      </div>

      {/* Trip info */}
      <section className="v9-card">
        <h2 style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Рейс</h2>
        {[
          ['Номер рейса', 'ДОС-2847'],
          ['Маршрут', 'Тамбов → Черноземный'],
          ['ETA', '14:30 (~45 мин)'],
          ['Водитель', 'Ковалёв А.С.'],
          ['ТС', 'В 445 АА 68'],
          ['Груз', 'Кукуруза · 20 т'],
          ['Сделка', 'DL-9102'],
        ].map(([k, v]) => (
          <div key={k} style={{ display: 'flex', gap: 12, padding: '6px 0', borderBottom: '1px solid #E4E6EA', fontSize: 13 }}>
            <div style={{ width: 110, flexShrink: 0, color: '#6B778C', fontSize: 12 }}>{k}</div>
            <div style={{ fontWeight: 500 }}>{v}</div>
          </div>
        ))}
      </section>

      {/* Offline queue */}
      {events.length > 0 && (
        <section className="v9-card">
          <h2 style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Офлайн-очередь</h2>
          {events.map(e => (
            <div key={e.id} style={{ display: 'flex', gap: 12, padding: '8px 0', borderBottom: '1px solid #E4E6EA' }}>
              <div style={{ fontSize: 11, color: '#6B778C', minWidth: 50 }}>
                {new Date(e.timestamp).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 500 }}>{e.type}</div>
                <Badge variant={e.synced ? 'success' : 'warning'}>{e.synced ? 'Отправлено' : 'Ожидает связи'}</Badge>
              </div>
            </div>
          ))}
        </section>
      )}

      {/* Emergency */}
      <section className="v9-card" style={{ background: 'rgba(220,38,38,0.03)', border: '1px solid rgba(220,38,38,0.18)' }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#DC2626', letterSpacing: '0.06em', marginBottom: 8 }}>Аварийный блок</div>
        <p style={{ fontSize: 13, color: '#495057', margin: '0 0 12px' }}>Проблема с грузом, ДТП, отказ в приёмке? Зафиксируй — создаст кейс в контроле.</p>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="danger" asChild>
            <Link href="/platform-v9/disputes">⚠ Сообщить о проблеме</Link>
          </Button>
          <Button variant="ghost" asChild>
            <Link href="/platform-v9/deals/DL-9102">Открыть сделку</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
