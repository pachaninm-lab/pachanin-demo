'use client';

import { useRef, useState, useCallback } from 'react';

type PhotoType = 'arrival' | 'weight_ticket' | 'cargo' | 'document' | 'damage' | 'other';

interface CapturedPhoto {
  id: string;
  type: PhotoType;
  dataUrl: string;
  takenAt: string;
  geoNote?: string;
}

const TYPE_LABEL: Record<PhotoType, string> = {
  arrival:       'Прибытие',
  weight_ticket: 'Весовой талон',
  cargo:         'Груз',
  document:      'Документ',
  damage:        'Повреждение',
  other:         'Прочее',
};

const TYPE_ICON: Record<PhotoType, string> = {
  arrival:       '🚛',
  weight_ticket: '⚖️',
  cargo:         '🌾',
  document:      '📄',
  damage:        '⚠️',
  other:         '📷',
};

interface Props {
  tripId?: string;
  onPhotosChange?: (photos: CapturedPhoto[]) => void;
}

export function DriverCameraCapture({ tripId = 'ТМБ-14', onPhotosChange }: Props) {
  const [photos, setPhotos] = useState<CapturedPhoto[]>([]);
  const [selectedType, setSelectedType] = useState<PhotoType>('arrival');
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamInputRef = useRef<HTMLInputElement>(null);

  const handleCapture = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const photo: CapturedPhoto = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type: selectedType,
        dataUrl,
        takenAt: new Date().toISOString(),
      };
      setPhotos((prev) => {
        const next = [photo, ...prev];
        onPhotosChange?.(next);
        return next;
      });
      setCameraError(null);
    };
    reader.onerror = () => setCameraError('Не удалось прочитать файл');
    reader.readAsDataURL(file);
    e.target.value = '';
  }, [selectedType, onPhotosChange]);

  const removePhoto = (id: string) => {
    setPhotos((prev) => {
      const next = prev.filter((p) => p.id !== id);
      onPhotosChange?.(next);
      return next;
    });
  };

  return (
    <div data-demo="true" style={{ display: 'grid', gap: '0.875rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--pc-text-primary)' }}>Фото рейса · {tripId}</div>
          <div style={{ fontSize: 10, color: 'var(--pc-text-muted)' }}>{photos.length} снимков · данные только на устройстве</div>
        </div>
        <select
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value as PhotoType)}
          style={{ fontSize: 11, fontWeight: 700, padding: '5px 9px', borderRadius: 8, border: '1px solid var(--p7-color-border)', background: 'var(--p7-color-surface-muted)', color: 'var(--pc-text-secondary)', cursor: 'pointer', minHeight: 44 }}
          aria-label="Тип фото"
        >
          {(Object.entries(TYPE_LABEL) as [PhotoType, string][]).map(([k, v]) => (
            <option key={k} value={k}>{TYPE_ICON[k]} {v}</option>
          ))}
        </select>
      </div>

      {/* Camera / file buttons */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
        {/* Primary: camera capture (mobile) */}
        <button
          onClick={() => streamInputRef.current?.click()}
          aria-label="Сфотографировать камерой"
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 80, borderRadius: 14, background: 'var(--p7-color-brand, #0A7A5F)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 800 }}
        >
          <span style={{ fontSize: 24 }}>📷</span>
          Камера
        </button>
        <input
          ref={streamInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          style={{ display: 'none' }}
          onChange={handleCapture}
          aria-hidden="true"
        />

        {/* Secondary: choose from gallery */}
        <button
          onClick={() => fileInputRef.current?.click()}
          aria-label="Выбрать из галереи"
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 80, borderRadius: 14, background: 'var(--p7-color-surface-muted)', color: 'var(--pc-text-secondary)', border: '1px solid var(--p7-color-border)', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}
        >
          <span style={{ fontSize: 24 }}>🖼</span>
          Галерея
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleCapture}
          aria-hidden="true"
        />
      </div>

      {/* Error */}
      {cameraError && (
        <div style={{ fontSize: 11, color: '#B91C1C', background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.18)', borderRadius: 8, padding: '6px 10px' }}>
          {cameraError}
        </div>
      )}

      {/* Photo grid */}
      {photos.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '0.5rem' }}>
          {photos.map((p) => (
            <div key={p.id} style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', border: '1px solid var(--p7-color-border)' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.dataUrl}
                alt={TYPE_LABEL[p.type]}
                style={{ width: '100%', aspectRatio: '4/3', objectFit: 'cover', display: 'block', cursor: 'pointer' }}
                onClick={() => setLightboxSrc(p.dataUrl)}
              />
              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '4px 6px', background: 'rgba(0,0,0,0.55)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 9, color: '#fff', fontWeight: 700 }}>{TYPE_ICON[p.type]} {TYPE_LABEL[p.type]}</span>
                <button
                  onClick={() => removePhoto(p.id)}
                  aria-label="Удалить фото"
                  style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 12, lineHeight: 1, padding: 0 }}
                >✕</button>
              </div>
              <div style={{ position: 'absolute', top: 4, right: 4, fontSize: 8, color: '#fff', background: 'rgba(0,0,0,0.4)', borderRadius: 4, padding: '1px 4px' }}>
                {new Date(p.takenAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {lightboxSrc && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Просмотр фото"
          onClick={() => setLightboxSrc(null)}
          style={{ position: 'fixed', inset: 0, zIndex: 9000, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', cursor: 'zoom-out' }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lightboxSrc} alt="Просмотр" style={{ maxWidth: '100%', maxHeight: '90vh', borderRadius: 12, boxShadow: '0 24px 64px rgba(0,0,0,0.5)' }} />
        </div>
      )}

      <div style={{ fontSize: 9, color: 'var(--pc-text-muted)', padding: '5px 9px', borderRadius: 7, background: 'var(--p7-color-surface-muted)', border: '1px solid var(--p7-color-border)' }}>
        Фото сохраняются на устройстве. В боевом контуре — S3 с привязкой к рейсу через IndexedDB очередь при плохой связи.
      </div>
    </div>
  );
}
