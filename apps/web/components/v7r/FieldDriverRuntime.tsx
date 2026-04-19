'use client';

import * as React from 'react';
import Link from 'next/link';
import { useToast } from '@/components/v7r/Toast';
import { useFieldRuntimeStore } from '@/stores/useFieldRuntimeStore';
import { trackEvent } from '@/lib/analytics/track';

export function FieldDriverRuntime() {
  const toast = useToast();
  const trip = useFieldRuntimeStore((s) => s.trip);
  const confirmArrival = useFieldRuntimeStore((s) => s.confirmArrival);
  const reportDeviation = useFieldRuntimeStore((s) => s.reportDeviation);
  const [showDeviation, setShowDeviation] = React.useState(false);
  const [deviationText, setDeviationText] = React.useState('');
  const [isOnline, setIsOnline] = React.useState(true);

  React.useEffect(() => {
    const update = () => setIsOnline(window.navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    update();
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  const arrived = trip.status === 'arrived';

  return (
    <div style={{ display: 'grid', gap: 16, maxWidth: 720, margin: '0 auto' }}>
      {!isOnline && (
        <div style={{ padding: '12px 16px', borderRadius: 14, background: '#FFFBEB', border: '1px solid #FDE68A', color: '#B45309', fontSize: 13, fontWeight: 700 }}>
          Нет связи — действия сохраняются локально и уйдут при восстановлении сети.
        </div>
      )}

      <section style={{ padding: '18px 20px', borderRadius: 18, background: arrived ? '#F0FDF4' : 'linear-gradient(135deg, #0A7A5F 0%, #0B6B9A 100%)', border: arrived ? '1px solid #BBF7D0' : 'none' }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: arrived ? '#15803D' : '#fff' }}>
          {arrived ? `Прибытие зафиксировано в ${trip.arrivedAt}` : `В пути · ETA ${trip.eta} · Осталось ${trip.kmLeft} км`}
        </div>
        <div style={{ fontSize: 13, color: arrived ? '#16A34A' : 'rgba(255,255,255,0.82)', marginTop: 6 }}>
          Рейс {trip.id} · Сделка {trip.dealId}
        </div>
      </section>

      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 20, display: 'grid', gap: 12 }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: '#0F1419' }}>Полевые действия</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            disabled={arrived}
            onClick={() => {
              confirmArrival();
              trackEvent('driver_arrived', { tripId: trip.id, dealId: trip.dealId });
              toast('Прибытие по рейсу подтверждено.', 'success');
            }}
            style={{ padding: '12px 16px', borderRadius: 12, border: 'none', background: arrived ? '#E4E6EA' : '#0A7A5F', color: arrived ? '#9CA3AF' : '#fff', fontSize: 14, fontWeight: 800, cursor: arrived ? 'default' : 'pointer' }}
          >
            {arrived ? 'Прибытие подтверждено' : 'Подтвердить прибытие'}
          </button>
          <Link href={`/platform-v7/deals/${trip.dealId}`} style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '12px 16px', borderRadius: 12, border: '1px solid #E4E6EA', background: '#fff', color: '#0F1419', fontSize: 14, fontWeight: 700 }}>
            Открыть сделку
          </Link>
          <Link href='/platform-v7/elevator' style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '12px 16px', borderRadius: 12, border: '1px solid #E4E6EA', background: '#fff', color: '#0F1419', fontSize: 14, fontWeight: 700 }}>
            Приёмка
          </Link>
        </div>
      </section>

      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 20, display: 'grid', gap: 12 }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: '#0F1419' }}>Отклонение</div>
        {!showDeviation ? (
          <button onClick={() => setShowDeviation(true)} style={{ padding: '12px 16px', borderRadius: 12, border: '1px solid rgba(220,38,38,0.2)', background: 'rgba(220,38,38,0.06)', color: '#DC2626', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
            Сообщить об отклонении
          </button>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            <textarea value={deviationText} onChange={(e) => setDeviationText(e.target.value)} placeholder='Описание ситуации...' style={{ width: '100%', minHeight: 90, padding: '10px 12px', borderRadius: 10, border: '1px solid #E4E6EA', fontSize: 13, resize: 'vertical', boxSizing: 'border-box' }} />
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button onClick={() => { reportDeviation(deviationText || 'Отклонение без описания'); toast('Отклонение зарегистрировано и сохранено локально.', 'warning'); setShowDeviation(false); setDeviationText(''); }} style={{ padding: '10px 14px', borderRadius: 10, border: 'none', background: '#DC2626', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Отправить</button>
              <button onClick={() => { setShowDeviation(false); setDeviationText(''); }} style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid #E4E6EA', background: '#F5F7F8', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Отмена</button>
            </div>
          </div>
        )}
        {trip.deviationText ? <div style={{ padding: 12, borderRadius: 12, background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.16)', fontSize: 13, color: '#B91C1C' }}>Последнее отклонение: {trip.deviationText}</div> : null}
      </section>
    </div>
  );
}
