'use client';

import * as React from 'react';
import Link from 'next/link';
import { Button, EmptyState, StatusChip, Surface } from '@pc/design-system-v8';

type MarketOpenLot = Readonly<{
  lotId: string;
  culture: string;
  grade: string | null;
  volumeTons: string;
  region: string;
  startPriceKopecksPerTon: string;
  bestPriceKopecksPerTon: string | null;
  bidCount: number;
  auctionEndsAt: string;
  sourceType: string;
}>;

type LoadState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; items: MarketOpenLot[]; disclosure: string };

const CULTURE_LABELS: Record<string, string> = {
  wheat: 'Пшеница',
  barley: 'Ячмень',
  corn: 'Кукуруза',
  sunflower: 'Подсолнечник',
  rye: 'Рожь',
};

const rub = new Intl.NumberFormat('ru-RU');

function priceLabel(kopecksPerTon: string | null): string {
  if (!kopecksPerTon) return '—';
  return `${rub.format(Math.round(Number(kopecksPerTon) / 100))} ₽/т`;
}

function cultureLabel(lot: MarketOpenLot): string {
  const base = CULTURE_LABELS[lot.culture] ?? lot.culture;
  return lot.grade ? `${base}, ${lot.grade} класс` : base;
}

function endsLabel(endsAt: string): string {
  const ms = new Date(endsAt).getTime() - Date.now();
  if (ms <= 0) return 'окно закрывается';
  const minutes = Math.floor(ms / 60000);
  if (minutes < 60) return `до конца ${minutes} мин`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `до конца ${hours} ч ${minutes % 60} мин`;
  return `до конца ${Math.floor(hours / 24)} дн`;
}

const cellStyle: React.CSSProperties = {
  padding: 'var(--ds-space-3) var(--ds-space-4)',
  borderTop: '1px solid var(--ds-color-border)',
  verticalAlign: 'middle',
  whiteSpace: 'nowrap',
};
const headStyle: React.CSSProperties = {
  ...cellStyle,
  borderTop: 'none',
  color: 'var(--ds-color-text-muted)',
  fontSize: 'var(--ds-font-caption)',
  fontWeight: 600,
  textAlign: 'left',
};
const numStyle: React.CSSProperties = { textAlign: 'right', fontVariantNumeric: 'tabular-nums' };

/**
 * Обезличенная витрина открытых торгов (CANONICAL_SCENARIO.md §1, §3).
 * Данные — строго живой GET /api/proxy/market/lots; продавец, адрес и
 * контакты не приходят с сервера и не отображаются.
 */
export function MarketOpenLotsPanel() {
  const [state, setState] = React.useState<LoadState>({ kind: 'loading' });

  const load = React.useCallback(async () => {
    setState({ kind: 'loading' });
    try {
      const response = await fetch('/api/proxy/market/lots?limit=25', {
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload || !Array.isArray(payload.items)) {
        setState({ kind: 'error', message: `Сервер не подтвердил список торгов (HTTP ${response.status}).` });
        return;
      }
      setState({ kind: 'ready', items: payload.items, disclosure: String(payload.disclosure ?? '') });
    } catch {
      setState({ kind: 'error', message: 'Сервер торгов недоступен. Список не обновился.' });
    }
  }, []);

  React.useEffect(() => { void load(); }, [load]);

  return (
    <Surface aria-labelledby='market-open-lots-title' data-testid='market-open-lots-panel'>
      <header style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--ds-space-3)', flexWrap: 'wrap' }}>
        <h2 id='market-open-lots-title' style={{ margin: 0, fontSize: 'var(--ds-font-body)' }}>Открытые торги платформы</h2>
        <span style={{ color: 'var(--ds-color-text-muted)', fontSize: 'var(--ds-font-caption)' }}>
          Лоты всех продавцов, обезличенно. Продавец раскрывается после создания сделки.
        </span>
      </header>

      {state.kind === 'loading' ? (
        <p role='status' style={{ color: 'var(--ds-color-text-muted)', margin: 'var(--ds-space-4) 0 0' }}>
          Загружаем открытые торги…
        </p>
      ) : null}

      {state.kind === 'error' ? (
        <div role='status' style={{ display: 'flex', alignItems: 'center', gap: 'var(--ds-space-3)', marginTop: 'var(--ds-space-4)' }}>
          <span style={{ color: 'var(--ds-color-warning)' }}>{state.message}</span>
          <Button variant='secondary' onClick={() => void load()}>Повторить</Button>
        </div>
      ) : null}

      {state.kind === 'ready' && state.items.length === 0 ? (
        <EmptyState
          title='Открытых торгов сейчас нет'
          description='Как только продавец опубликует лот, он появится здесь — с ценой, объёмом и окном торгов.'
        />
      ) : null}

      {state.kind === 'ready' && state.items.length > 0 ? (
        <div style={{ overflowX: 'auto', marginTop: 'var(--ds-space-3)' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 'var(--ds-font-body)' }}>
            <thead>
              <tr>
                <th style={headStyle}>Лот</th>
                <th style={{ ...headStyle, ...numStyle }}>Объём</th>
                <th style={headStyle}>Регион</th>
                <th style={{ ...headStyle, ...numStyle }}>Старт</th>
                <th style={{ ...headStyle, ...numStyle }}>Лучшая цена</th>
                <th style={{ ...headStyle, ...numStyle }}>Ставок</th>
                <th style={headStyle}>Окно</th>
                <th style={headStyle}>Источник</th>
                <th style={headStyle} aria-label='Действие'></th>
              </tr>
            </thead>
            <tbody>
              {state.items.map((lot) => (
                <tr key={lot.lotId}>
                  <td style={cellStyle}>
                    <strong>{cultureLabel(lot)}</strong>
                  </td>
                  <td style={{ ...cellStyle, ...numStyle }}>{rub.format(Number(lot.volumeTons))} т</td>
                  <td style={cellStyle}>{lot.region}</td>
                  <td style={{ ...cellStyle, ...numStyle }}>{priceLabel(lot.startPriceKopecksPerTon)}</td>
                  <td style={{ ...cellStyle, ...numStyle }}>
                    {lot.bestPriceKopecksPerTon ? <strong>{priceLabel(lot.bestPriceKopecksPerTon)}</strong> : '—'}
                  </td>
                  <td style={{ ...cellStyle, ...numStyle }}>{lot.bidCount}</td>
                  <td style={cellStyle}>
                    <StatusChip tone={new Date(lot.auctionEndsAt).getTime() - Date.now() < 3_600_000 ? 'warning' : 'information'}>
                      {endsLabel(lot.auctionEndsAt)}
                    </StatusChip>
                  </td>
                  <td style={cellStyle}>
                    {lot.sourceType === 'FGIS'
                      ? <StatusChip tone='success'>ФГИС «Зерно»</StatusChip>
                      : <StatusChip tone='neutral'>проверен вручную</StatusChip>}
                  </td>
                  <td style={cellStyle}>
                    <Link href={`/platform-v7/auction?lotId=${encodeURIComponent(lot.lotId)}`} style={{ color: 'var(--ds-color-information)' }}>
                      Открыть торги →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </Surface>
  );
}
