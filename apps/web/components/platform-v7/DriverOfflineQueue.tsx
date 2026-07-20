'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

export interface OfflineEvent {
  id: string;
  type: 'arrival' | 'photo' | 'seal' | 'departure' | 'incident' | 'weight';
  label: string;
  payload: Record<string, unknown>;
  createdAt: string;
  synced: boolean;
  photoDataUrl?: string;
}

const DB_NAME = 'grainflow_driver';
const DB_VERSION = 1;
const STORE_NAME = 'offline_events';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME, { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function saveEvent(event: OfflineEvent): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(event);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function loadEvents(): Promise<OfflineEvent[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => resolve(req.result as OfflineEvent[]);
    req.onerror = () => reject(req.error);
  });
}

async function markSynced(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(id);
    req.onsuccess = () => {
      const ev = req.result as OfflineEvent;
      if (ev) { ev.synced = true; store.put(ev); }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function generateId() {
  return `ev-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

const QUICK_ACTIONS: { type: OfflineEvent['type']; label: string; icon: string }[] = [
  { type: 'arrival',   label: 'Прибытие',  icon: '📍' },
  { type: 'departure', label: 'Выезд',     icon: '🚛' },
  { type: 'weight',    label: 'Взвешивание', icon: '⚖️' },
  { type: 'seal',      label: 'Пломба',    icon: '🔒' },
  { type: 'incident',  label: 'Инцидент',  icon: '⚠️' },
];

interface Props {
  tripId?: string;
}

export function DriverOfflineQueue({ tripId = 'TRIP-001' }: Props) {
  const [events, setEvents] = useState<OfflineEvent[]>([]);
  // Start from a deterministic value so server and client render the same HTML;
  // the real connectivity is read on the client in the effect below. Reading
  // navigator.onLine during useState init causes a hydration mismatch.
  const [isOnline, setIsOnline] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [idbAvailable, setIdbAvailable] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingPhotoType = useRef<OfflineEvent['type']>('photo');

  useEffect(() => {
    setIdbAvailable(typeof indexedDB !== 'undefined');
    if (typeof navigator !== 'undefined') setIsOnline(navigator.onLine);

    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    if (typeof indexedDB !== 'undefined') {
      loadEvents().then((evs) => setEvents(evs.sort((a, b) => b.createdAt.localeCompare(a.createdAt)))).catch(() => {});
    }

    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  const addEvent = useCallback(async (type: OfflineEvent['type'], photoDataUrl?: string) => {
    const ev: OfflineEvent = {
      id: generateId(),
      type,
      label: QUICK_ACTIONS.find((a) => a.type === type)?.label ?? type,
      payload: { tripId, timestamp: new Date().toISOString() },
      createdAt: new Date().toISOString(),
      synced: false,
      photoDataUrl,
    };

    setEvents((prev) => [ev, ...prev]);

    if (idbAvailable) {
      try { await saveEvent(ev); } catch {}
    }

    if (isOnline) {
      setSyncing(true);
      await new Promise((r) => setTimeout(r, 800));
      setEvents((prev) => prev.map((e) => e.id === ev.id ? { ...e, synced: true } : e));
      if (idbAvailable) { try { await markSynced(ev.id); } catch {} }
      setSyncing(false);
    }
  }, [tripId, idbAvailable, isOnline]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setPhotoPreview(dataUrl);
      addEvent(pendingPhotoType.current, dataUrl);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  async function syncAll() {
    if (!isOnline || syncing) return;
    setSyncing(true);
    const unsynced = events.filter((e) => !e.synced);
    for (const ev of unsynced) {
      await new Promise((r) => setTimeout(r, 300));
      setEvents((prev) => prev.map((e) => e.id === ev.id ? { ...e, synced: true } : e));
      if (idbAvailable) { try { await markSynced(ev.id); } catch {} }
    }
    setSyncing(false);
  }

  const unsynced = events.filter((e) => !e.synced).length;

  return (
    <div style={{ display: 'grid', gap: '0.75rem' }}>
      {/* Status bar */}
      <div style={{
        display: 'flex', alignItems: 'center',
        padding: '0.625rem 0.875rem', borderRadius: '10px',
        background: isOnline ? 'rgba(5,150,105,0.08)' : 'rgba(220,38,38,0.08)',
        border: `1px solid ${isOnline ? 'rgba(5,150,105,0.25)' : 'rgba(220,38,38,0.25)'}`,
        flexWrap: 'wrap', gap: '0.5rem',
      }}>
        <span style={{ fontSize: '1rem' }}>{isOnline ? '🟢' : '🔴'}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--pc-text-primary)' }}>
            {isOnline ? 'Связь есть' : 'Офлайн-режим'}
          </div>
          <div style={{ fontSize: '10px', color: 'var(--pc-text-muted)' }}>
            {idbAvailable ? 'IndexedDB активна' : 'localStorage fallback'} · {unsynced} в очереди · рейс {tripId}
          </div>
        </div>
        {unsynced > 0 && isOnline && (
          <button
            onClick={syncAll}
            disabled={syncing}
            style={{
              padding: '0.375rem 0.75rem', borderRadius: '6px',
              border: 'none', background: 'var(--status-active-text, #059669)',
              color: '#fff', fontSize: 'var(--text-xs)', fontWeight: 700,
              cursor: syncing ? 'not-allowed' : 'pointer', minHeight: '36px',
            }}
          >
            {syncing ? '⏳ Синхронизация...' : `↑ Отправить ${unsynced}`}
          </button>
        )}
      </div>

      {/* Quick actions */}
      <div>
        <div style={{ fontSize: '10px', color: 'var(--pc-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.5rem' }}>
          Быстрые действия
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: '0.5rem' }}>
          {QUICK_ACTIONS.map((action) => (
            <button
              key={action.type}
              onClick={() => addEvent(action.type)}
              style={{
                minHeight: '56px', borderRadius: '12px',
                border: '1px solid var(--p7-color-border)',
                background: 'var(--p7-color-surface-muted)',
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                gap: '0.25rem', cursor: 'pointer', padding: '0.5rem',
              }}
            >
              <span style={{ fontSize: '1.25rem' }}>{action.icon}</span>
              <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--pc-text-primary)', textAlign: 'center' }}>{action.label}</span>
            </button>
          ))}

          {/* Camera button */}
          <button
            onClick={() => {
              pendingPhotoType.current = 'photo';
              fileInputRef.current?.click();
            }}
            style={{
              minHeight: '56px', borderRadius: '12px',
              border: '1px solid var(--p7-color-brand, #0A7A5F)',
              background: 'rgba(10,122,95,0.08)',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              gap: '0.25rem', cursor: 'pointer', padding: '0.5rem',
            }}
          >
            <span style={{ fontSize: '1.25rem' }}>📷</span>
            <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--p7-color-brand)', textAlign: 'center' }}>Фото</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />
        </div>
      </div>

      {/* Photo preview */}
      {photoPreview && (
        <div style={{ position: 'relative', borderRadius: '10px', overflow: 'hidden', maxHeight: '200px' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photoPreview} alt="Фото рейса" style={{ width: '100%', height: '200px', objectFit: 'cover' }} />
          <button
            onClick={() => setPhotoPreview(null)}
            style={{
              position: 'absolute', top: '0.5rem', right: '0.5rem',
              width: '32px', height: '32px', borderRadius: '50%',
              border: 'none', background: 'rgba(0,0,0,0.6)',
              color: '#fff', fontSize: '1rem', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >✕</button>
        </div>
      )}

      {/* Events queue */}
      {events.length > 0 && (
        <div>
          <div style={{ fontSize: '10px', color: 'var(--pc-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.5rem' }}>
            Очередь событий ({events.length})
          </div>
          <div style={{ display: 'grid', gap: '0.375rem', maxHeight: '280px', overflowY: 'auto' }}>
            {events.map((ev) => (
              <div key={ev.id} style={{
                display: 'flex', gap: '0.5rem', alignItems: 'center',
                padding: '0.5rem 0.75rem', borderRadius: '8px',
                background: ev.synced ? 'rgba(5,150,105,0.05)' : 'var(--p7-color-surface-muted)',
                border: `1px solid ${ev.synced ? 'rgba(5,150,105,0.2)' : 'var(--p7-color-border)'}`,
              }}>
                <span style={{ fontSize: '0.875rem' }}>
                  {QUICK_ACTIONS.find((a) => a.type === ev.type)?.icon ?? '📌'}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--pc-text-primary)' }}>{ev.label}</div>
                  <div style={{ fontSize: '10px', color: 'var(--pc-text-muted)' }}>
                    {new Date(ev.createdAt).toLocaleTimeString('ru-RU')}
                  </div>
                </div>
                {ev.photoDataUrl && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={ev.photoDataUrl} alt="" style={{ width: '32px', height: '32px', objectFit: 'cover', borderRadius: '4px' }} />
                )}
                <span style={{
                  fontSize: '10px', fontWeight: 700,
                  color: ev.synced ? 'var(--status-active-text)' : syncing ? 'var(--status-warning-text)' : 'var(--pc-text-muted)',
                }}>
                  {ev.synced ? '✓ Отправлено' : syncing ? '⏳' : '● Локально'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {events.length === 0 && (
        <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--pc-text-muted)', fontSize: 'var(--text-sm)' }}>
          Нет событий. Используйте быстрые действия выше.
        </div>
      )}
    </div>
  );
}
