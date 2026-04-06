'use client';

import { DriverLiveMap } from '../../../components/driver-live-map';
import { DriverMap } from '../../../components/driver-map';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { applyCsrfHeader } from '../../../lib/csrf';
import { NextStepBar } from '../../../components/next-step-bar';
import { OfflineConflictPanel } from '../../../components/offline-conflict-panel';
import { describeOfflineConflict } from '../../../lib/offline';
import { PageAccessGuard } from '../../../components/page-access-guard';
import { DRIVER_RUNTIME_ROLES } from '../../../lib/route-roles';

const NEXT_ACTIONS: Record<string, Array<{ code: string; label: string; nextState?: string; checkpointType?: string }>> = {
  ASSIGNED: [{ code: 'accept', label: 'Принять рейс', nextState: 'DRIVER_CONFIRMED' }],
  DRIVER_CONFIRMED: [{ code: 'loading', label: 'Прибыл на погрузку', nextState: 'AT_LOADING' }],
  AT_LOADING: [{ code: 'loaded', label: 'Погрузка завершена', nextState: 'LOADED' }],
  LOADED: [{ code: 'departure', label: 'Отметить выезд', nextState: 'IN_TRANSIT' }],
  IN_TRANSIT: [{ code: 'arrival', label: 'Прибыл на выгрузку', nextState: 'AT_UNLOADING' }],
  AT_UNLOADING: [{ code: 'unloaded', label: 'Выгрузка завершена', nextState: 'UNLOADED' }],
  UNLOADED: [{ code: 'confirm', label: 'Подтвердить рейс', nextState: 'CONFIRMED' }]
};

export default function DriverMobileDetailPage({ params }: { params: { id: string } }) {
  const [shipment, setShipment] = useState<any>(null);
  const [pin, setPin] = useState('');
  const [pinResult, setPinResult] = useState('');
  const [msg, setMsg] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [loading, setLoading] = useState('');

  const shipmentId = params.id;

  const load = async () => {
    try {
      const res = await fetch(`/api/proxy/logistics/shipments/${shipmentId}`, { cache: 'no-store', headers: applyCsrfHeader() });
      if (!res.ok) throw new Error();
      setShipment(await res.json());
    } catch {
      setShipment(null);
    }
  };

  useEffect(() => { void load(); }, [shipmentId]);

  const doTransition = async (nextState: string) => {
    setLoading(nextState); setMsg('');
    try {
      const pos = await getGPS();
      const res = await fetch(`/api/proxy/logistics/shipments/${shipmentId}/transition`, {
        method: 'PATCH', headers: { ...Object.fromEntries(applyCsrfHeader()), 'Content-Type': 'application/json' },
        body: JSON.stringify({ nextState, lat: pos.lat, lng: pos.lng, comment: nextState }),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); setMsg(e.message || `Ошибка ${res.status}`); return false; }
      await load();
      return true;
    } catch { setMsg('Нет соединения. Попробуйте ещё раз.'); return false; }
    finally { setLoading(''); }
  };

  const handleAction = async (nextState: string, successMessage: string) => {
    const ok = await doTransition(nextState);
    if (ok) setMsg(`✓ ${successMessage}`);
  };

  const handlePin = async () => {
    if (pin.length !== 4) { setMsg('PIN: 4 цифры'); return; }
    const res = await fetch(`/api/proxy/logistics/shipments/${shipmentId}/verify-pin`, {
      method: 'POST', headers: { ...Object.fromEntries(applyCsrfHeader()), 'Content-Type': 'application/json' }, body: JSON.stringify({ pin }),
    }).then(r => r.json()).catch(() => ({ valid: false }));
    setPinResult(res.valid ? '✓ PIN верный' : '✕ Неверный PIN');
  };

  const handlePhoto = async () => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/*'; input.capture = 'environment';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      setLoading('photo');
      const fd = new FormData();
      fd.append('file', file);
      fd.append('shipmentId', shipmentId);
      if (shipment?.dealId) fd.append('dealId', shipment.dealId);
      fd.append('type', 'ROUTE_PHOTO');
      try {
        const response = await fetch('/api/proxy/evidence/upload', { method: 'POST', headers: applyCsrfHeader(), body: fd });
        if (!response.ok) throw new Error();
        setPhotos(prev => [...prev, URL.createObjectURL(file)]);
        setMsg('✓ Фото загружено');
      } catch { setMsg('Ошибка загрузки фото'); }
      finally { setLoading(''); }
    };
    input.click();
  };

  const handleSupport = async () => {
    setLoading('support');
    try {
      const res = await fetch('/api/proxy/support/tickets', {
        method: 'POST', headers: { ...Object.fromEntries(applyCsrfHeader()), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `Помощь на рейсе ${shipmentId}`,
          description: 'Водитель запросил поддержку по рейсу. Нужен быстрый разбор.',
          priority: 'HIGH',
          linkedDealId: shipment?.dealId
        }),
      });
      if (!res.ok) throw new Error();
      setMsg('✓ Тикет создан. Оператор свяжется с вами.');
    } catch { setMsg('Не удалось связаться с поддержкой'); }
    finally { setLoading(''); }
  };

  const actions = NEXT_ACTIONS[String(shipment?.status || '')] || [];
  const primaryAction = actions[0];
  const nextCheckpoint = useMemo(() => shipment?.checkpoints?.find((item: any) => item.status !== 'DONE'), [shipment]);
  const conflictCases = [describeOfflineConflict('late_sync'), describeOfflineConflict('terminal_state')];

  return (
    <PageAccessGuard allowedRoles={[...DRIVER_RUNTIME_ROLES]} title="Карточка рейса скрыта от нерелевантных ролей" subtitle="Полевой мобильный контур должен быть доступен только тем ролям, которые реально работают с рейсом.">
    <main className="space-y-4 max-w-md mx-auto p-4">
      <div className="breadcrumbs"><Link href="/driver-mobile">Рейсы</Link> / <span>{shipmentId}</span></div>
      <section className="mobile-surface space-y-4">
        <div className="text-center space-y-2">
          <div className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Полевой режим</div>
          <h1 className="text-xl font-semibold">Рейс {shipmentId}</h1>
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <span className="mini-chip">{shipment?.status || 'Загрузка'}</span>
            {shipment?.dealId ? <span className="mini-chip">Сделка {shipment.dealId}</span> : null}
            {shipment?.pinCode ? <span className="mini-chip">PIN {shipment.pinCode}</span> : null}
          </div>
          <div className="text-sm text-slate-300">Главное правило: один рейс — одно текущее действие. Не надо думать, что делать дальше.</div>
        </div>

        <div className="info-card card-accent">
          <div className="label">Следующий шаг</div>
          <div className="value">{primaryAction?.label || 'Ожидать назначения следующего этапа'}</div>
          <div className="muted small" style={{ marginTop: 8 }}>{nextCheckpoint ? `Следующий checkpoint: ${nextCheckpoint.title}` : 'Все checkpoint закрыты или ещё не назначены.'}</div>
        </div>

        {msg ? <p className={`text-center text-sm font-medium ${msg.startsWith('✓') ? 'text-green-300' : 'text-red-300'}`}>{msg}</p> : null}

        {primaryAction ? (
          <button onClick={() => handleAction(String(primaryAction.nextState), primaryAction.label)} disabled={loading === String(primaryAction.nextState)} id="driver-primary-action" className="field-cta">
            {loading === String(primaryAction.nextState) ? 'Обновляем статус...' : primaryAction.label}
          </button>
        ) : null}

        <div className="field-secondary-grid">
          <button onClick={handlePhoto} disabled={loading === 'photo'} className="field-secondary-btn disabled:opacity-40">
            <span className="emoji">📸</span>
            <span>{loading === 'photo' ? 'Загрузка...' : 'Фото / evidence'}</span>
          </button>
          <button onClick={handleSupport} disabled={loading === 'support'} className="field-secondary-btn disabled:opacity-40">
            <span className="emoji">🆘</span>
            <span>{loading === 'support' ? 'Создаём тикет...' : 'Связь с поддержкой'}</span>
          </button>
        </div>

        <div className="info-card">
          <div className="label">PIN-верификация</div>
          <div className="flex gap-2 mt-3">
            <input value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))} maxLength={4}
              className="flex-1 border rounded-lg p-3 text-center text-lg font-mono tracking-widest bg-white/5 border-white/10 text-white" placeholder="0000" />
            <button onClick={handlePin} className="button primary compact">Проверить</button>
          </div>
          {pinResult ? <p className={`text-sm mt-2 ${pinResult.startsWith('✓') ? 'text-green-300' : 'text-red-300'}`}>{pinResult}</p> : null}
        </div>

        <OfflineConflictPanel title="Конфликты поздней синхронизации" cases={conflictCases as any} />

        <div className="info-card">
          <div className="label">Сводка рейса</div>
          <div className="text-sm text-slate-300 mt-3 space-y-2">
            <div><b>Статус:</b> {shipment?.status || '—'}</div>
            <div><b>Сделка:</b> {shipment?.dealId || '—'}</div>
            <div><b>Checkpoint:</b> {nextCheckpoint?.title || '—'}</div>
            <div><b>Evidence-first:</b> статус, PIN, checkpoint и фото должны подтверждаться системой.</div>
          </div>
        </div>

        {photos.length > 0 ? <div className="flex gap-2 overflow-x-auto">{photos.map((src, i) => <img key={i} src={src} className="w-20 h-20 rounded-lg object-cover" alt={`upload-${i}`} />)}</div> : null}
      </section>
      <NextStepBar
        title={primaryAction?.label || 'Ожидать назначения следующего этапа'}
        detail={nextCheckpoint ? `Следующий checkpoint: ${nextCheckpoint.title}` : 'Следующих checkpoint пока нет'}
        primary={primaryAction ? { href: '#driver-primary-action', label: 'Перейти к действию' } : undefined}
        secondary={[{ href: '/support', label: 'Поддержка' }, { href: '/dispatch', label: 'Рейсы' }]}
      />
    </main>
    </PageAccessGuard>
  );
}

function getGPS(): Promise<{ lat: number; lng: number }> {
  return new Promise(res => {
    if (!navigator.geolocation) { res({ lat: 52.73, lng: 41.44 }); return; }
    navigator.geolocation.getCurrentPosition(p => res({ lat: p.coords.latitude, lng: p.coords.longitude }), () => res({ lat: 52.73, lng: 41.44 }), { enableHighAccuracy: true, timeout: 5000 });
  });
}
