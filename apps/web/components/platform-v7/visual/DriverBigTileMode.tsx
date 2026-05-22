'use client';

import * as React from 'react';
import { MapPin, Key, Camera, AlertTriangle, CheckCircle2, WifiOff, Navigation } from 'lucide-react';

/**
 * DriverBigTileMode — экран водителя.
 *
 * Большие плитки, минимум текста, touch-friendly.
 * Запрещено: банк, инвестор, общие деньги, чужие сделки, сложные таблицы.
 *
 * Использование:
 *   <DriverBigTileMode
 *     tripId="RT-7821"
 *     destination="Элеватор «Южный», г. Ростов-на-Дону"
 *     eta="14:30"
 *     pin="4821"
 *     offline={false}
 *     onPhotoUpload={() => handlePhoto()}
 *     onIncident={() => handleIncident()}
 *     onConfirmArrival={() => handleArrival()}
 *   />
 */

export interface DriverBigTileModeProps {
  readonly tripId?: string;
  readonly destination: string;
  readonly eta?: string;
  readonly pin?: string;
  readonly offline?: boolean;
  readonly offlineQueueCount?: number;
  readonly onPhotoUpload?: () => void;
  readonly onIncident?: () => void;
  readonly onConfirmArrival?: () => void;
  readonly arrivalConfirmed?: boolean;
  readonly 'data-testid'?: string;
}

export function DriverBigTileMode({
  tripId,
  destination,
  eta,
  pin,
  offline = false,
  offlineQueueCount = 0,
  onPhotoUpload,
  onIncident,
  onConfirmArrival,
  arrivalConfirmed = false,
  'data-testid': testId,
}: DriverBigTileModeProps) {
  return (
    <div
      data-testid={testId ?? 'p7-vil-driver-big-tile-mode'}
      style={{ display: 'grid', gap: 12 }}
    >
      {/* Offline indicator */}
      {offline && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 12px',
            borderRadius: 10,
            background: 'var(--p7-color-warning-soft, #FFFAEB)',
            border: '1px solid color-mix(in srgb, var(--p7-color-warning, #B54708) 28%, transparent)',
          }}
        >
          <WifiOff size={15} strokeWidth={2} style={{ color: 'var(--p7-color-warning, #B54708)', flexShrink: 0 }} />
          <span style={{ fontSize: 13, fontWeight: 750, color: 'var(--p7-color-warning, #B54708)' }}>
            Нет связи. Данные сохранены и отправятся автоматически.
            {offlineQueueCount > 0 && ` (${offlineQueueCount} в очереди)`}
          </span>
        </div>
      )}

      {/* Destination tile */}
      <div
        style={{
          padding: '18px 16px',
          borderRadius: 16,
          border: '1px solid var(--p7-color-border, #D7DEE3)',
          background: 'var(--p7-color-surface, #FFFFFF)',
          display: 'grid',
          gap: 8,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: 'var(--p7-color-brand-soft, #E5F4EF)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Navigation size={18} strokeWidth={2} style={{ color: 'var(--p7-color-brand, #0A7A5F)' }} />
          </div>
          <div style={{ display: 'grid', gap: 3, minWidth: 0 }}>
            {tripId && (
              <span style={{ fontSize: 11, fontWeight: 900, color: 'var(--p7-color-text-muted, #667085)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Рейс {tripId}
              </span>
            )}
            <span style={{ fontSize: 16, fontWeight: 850, color: 'var(--p7-color-text-primary, #0F1419)', lineHeight: 1.3 }}>
              {destination}
            </span>
            {eta && (
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--p7-color-success, #027A48)' }}>
                Прибытие {eta}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* PIN tile */}
      {pin && (
        <div
          style={{
            padding: '16px',
            borderRadius: 16,
            border: '1px solid var(--p7-color-border, #D7DEE3)',
            background: 'var(--p7-color-surface, #FFFFFF)',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: 'var(--p7-color-money-soft, #EFF4FF)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Key size={20} strokeWidth={2} style={{ color: 'var(--p7-color-money, #155EEF)' }} />
          </div>
          <div style={{ display: 'grid', gap: 2 }}>
            <span style={{ fontSize: 11, fontWeight: 900, color: 'var(--p7-color-text-muted, #667085)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              PIN для элеватора
            </span>
            <span
              style={{
                fontSize: 28,
                fontWeight: 900,
                color: 'var(--p7-color-money, #155EEF)',
                letterSpacing: '0.15em',
                lineHeight: 1,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {pin}
            </span>
          </div>
        </div>
      )}

      {/* Action tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {/* Photo */}
        {onPhotoUpload && (
          <button
            type='button'
            onClick={onPhotoUpload}
            style={bigTileButtonStyle('#E5F4EF', 'var(--p7-color-brand, #0A7A5F)', '1px solid color-mix(in srgb, var(--p7-color-brand, #0A7A5F) 28%, transparent)')}
          >
            <Camera size={24} strokeWidth={1.8} />
            <span>Фото</span>
          </button>
        )}

        {/* Incident */}
        {onIncident && (
          <button
            type='button'
            onClick={onIncident}
            style={bigTileButtonStyle('var(--p7-color-warning-soft, #FFFAEB)', 'var(--p7-color-warning, #B54708)', '1px solid color-mix(in srgb, var(--p7-color-warning, #B54708) 28%, transparent)')}
          >
            <AlertTriangle size={24} strokeWidth={1.8} />
            <span>Инцидент</span>
          </button>
        )}
      </div>

      {/* Confirm arrival */}
      {onConfirmArrival && (
        <button
          type='button'
          onClick={arrivalConfirmed ? undefined : onConfirmArrival}
          disabled={arrivalConfirmed}
          style={{
            width: '100%',
            minHeight: 56,
            padding: '14px 20px',
            borderRadius: 16,
            border: arrivalConfirmed
              ? '1px solid color-mix(in srgb, var(--p7-color-success, #027A48) 28%, transparent)'
              : '1.5px solid var(--p7-color-brand, #0A7A5F)',
            background: arrivalConfirmed
              ? 'var(--p7-color-success-soft, #ECFDF3)'
              : 'var(--p7-color-brand, #0A7A5F)',
            color: arrivalConfirmed ? 'var(--p7-color-success, #027A48)' : '#FFFFFF',
            fontSize: 16,
            fontWeight: 900,
            cursor: arrivalConfirmed ? 'default' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
          }}
        >
          {arrivalConfirmed ? (
            <>
              <CheckCircle2 size={20} strokeWidth={2} />
              Прибытие подтверждено
            </>
          ) : (
            <>
              <MapPin size={20} strokeWidth={2} />
              Подтвердить прибытие
            </>
          )}
        </button>
      )}
    </div>
  );
}

function bigTileButtonStyle(bg: string, color: string, border: string): React.CSSProperties {
  return {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 80,
    padding: '16px 12px',
    borderRadius: 14,
    border,
    background: bg,
    color,
    fontSize: 13,
    fontWeight: 800,
    cursor: 'pointer',
  };
}
