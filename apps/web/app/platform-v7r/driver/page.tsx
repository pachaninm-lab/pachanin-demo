'use client';

import * as React from 'react';
import { useToast } from '@/components/v7r/Toast';

const trip = {
  id: 'ТМБ-14',
  deal: 'DL-9103',
  cargo: 'Кукуруза 3 кл. · 150 т',
  from: 'КФХ Петров, Тамбов',
  destination: 'ЗАО МелькомбинатЮг, Воронеж',
  plate: 'А777ВВ136',
  driver: 'Иванов И.И.',
  seal: '4481-В',
  sealOk: true,
  eta: '14:30',
  status: 'В пути',
  kmLeft: 87,
  km: 340,
};

export default function DriverPage() {
  const toast = useToast();
  const [arrived, setArrived] = React.useState(false);
  const [showDeviation, setShowDeviation] = React.useState(false);
  const [deviationText, setDeviationText] = React.useState('');
  const [isOnline, setIsOnline] = React.useState(true);

  React.useEffect(() => {
    const update = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    update();
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); };
  }, []);

  return (
    <div style={{ display: 'grid', gap: 16, maxWidth: 680, margin: '0 auto' }}>
      {!isOnline && (
        <div style={{ padding: '12px 16px', borderRadius: 14, background: '#FFFBEB', border: '1px solid #FDE68A', color: '#B45309', fontSize: 13, fontWeight: 700 }}>
          ⚠️ Нет связи — данные сохранены, синхронизация при подключении
        </div>
      )}

      {/* Статус-баннер */}
      <div style={{ padding: '16px 20px', borderRadius: 18, background: arrived ? '#F0FDF4' : 'linear-gradient(135deg, #0A7A5F 0%, #0B6B9A 100%)', border: arrived ? '1px solid #BBF7D0' : 'none' }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: arrived ? '#15803D' : '#fff' }}>
          {arrived ? '✅ Прибытие зафиксировано в 14:28' : `${trip.status} · ETA ${trip.eta} · Осталось ${trip.kmLeft} км`}
        </div>
        <div style={{ fontSize: 13, color: arrived ? '#16A34A' : 'rgba(255,255,255,0.8)', marginTop: 6 }}>
          Рейс {trip.id} · Сделка {trip.deal}
        </div>
      </div>

      {/* Карточка рейса */}
      <div style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 20 }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: '#0F1419', marginBottom: 14 }}>Информация о рейсе</div>
        {[
          ['Груз', trip.cargo],
          ['Откуда', trip.from],
          ['Назначение', trip.destination],
          ['Госномер', trip.plate],
          ['Водитель', trip.driver],
          ['Пломба', `${trip.seal} ${trip.sealOk ? '✅' : '❌'}`],
          ['Расстояние', `${trip.km} км`],
        ].map(([label, value]) => (
          <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '10px 0', borderBottom: '1px solid #F1F3F5' }}>
            <span style={{ fontSize: 12, color: '#6B778C', fontWeight: 600 }}>{label}</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#0F1419', textAlign: 'right' }}>{value}</span>
          </div>
        ))}
      </div>

      {/* Прогресс маршрута */}
      <div style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: '#0F1419', marginBottom: 14 }}>Маршрут</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
          {[
            { label: 'Погрузка', done: true },
            { label: 'В пути', done: !arrived, active: !arrived },
            { label: 'Прибытие', done: arrived, active: arrived },
            { label: 'Разгрузка', done: false },
          ].map((step, i) => (
            <React.Fragment key={step.label}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%',
                  background: step.done ? '#0A7A5F' : step.active ? '#0B6B9A' : '#E4E6EA',
                  border: `2px solid ${step.done ? '#0A7A5F' : step.active ? '#0B6B9A' : '#D1D5DB'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: step.done || step.active ? '#fff' : '#9CA3AF', fontSize: 12, fontWeight: 800
                }}>
                  {step.done && !step.active ? '✓' : i + 1}
                </div>
                <div style={{ fontSize: 10, fontWeight: 700, color: step.done ? '#0A7A5F' : step.active ? '#0B6B9A' : '#9CA3AF', marginTop: 6, textAlign: 'center' }}>{step.label}</div>
              </div>
              {i < 3 && <div style={{ flex: 0, width: 24, height: 2, background: step.done ? '#0A7A5F' : '#E4E6EA', marginBottom: 20 }} />}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Кнопки действий */}
      <div style={{ display: 'grid', gap: 10 }}>
        <button
          disabled={arrived}
          onClick={() => { setArrived(true); toast('Прибытие зафиксировано в 14:28', 'success'); }}
          style={{
            padding: '14px 20px', borderRadius: 14, border: 'none',
            background: arrived ? '#E4E6EA' : '#0A7A5F',
            color: arrived ? '#9CA3AF' : '#fff',
            fontSize: 14, fontWeight: 800, cursor: arrived ? 'default' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}>
          {arrived ? '✅ Прибытие подтверждено' : '📍 Подтвердить прибытие'}
        </button>

        {!showDeviation ? (
          <button
            onClick={() => setShowDeviation(true)}
            style={{ padding: '14px 20px', borderRadius: 14, border: '1px solid rgba(220,38,38,0.2)', background: 'rgba(220,38,38,0.06)', color: '#DC2626', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
            ⚠️ Сообщить об отклонении
          </button>
        ) : (
          <div style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 14, padding: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Опишите отклонение</div>
            <textarea
              value={deviationText}
              onChange={e => setDeviationText(e.target.value)}
              placeholder="Описание ситуации..."
              style={{ width: '100%', minHeight: 80, padding: '10px 12px', borderRadius: 10, border: '1px solid #E4E6EA', fontSize: 13, resize: 'vertical', boxSizing: 'border-box' }}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button onClick={() => { setShowDeviation(false); setDeviationText(''); toast('Отклонение зарегистрировано. Диспетчер оповещён', 'warning'); }} style={{ flex: 1, padding: '10px 14px', borderRadius: 10, border: 'none', background: '#DC2626', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Отправить</button>
              <button onClick={() => { setShowDeviation(false); setDeviationText(''); }} style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid #E4E6EA', background: '#F5F7F8', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Отмена</button>
            </div>
          </div>
        )}

        <button
          onClick={() => toast('Диспетчер оповещён', 'info')}
          style={{ padding: '14px 20px', borderRadius: 14, border: '1px solid #E4E6EA', background: '#fff', color: '#0F1419', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
          📞 Связаться с диспетчером
        </button>
      </div>
    </div>
  );
}
