'use client';

import * as React from 'react';

export interface RuntimeSnapshot {
  role?: string;
  userId?: string;
  orgId?: string;
  dealId?: string;
  deals?: Array<{ id: string; status: string; culture?: string; volumeTons?: number; totalRub?: number; sellerOrgId?: string; buyerOrgId?: string }>;
  disputes?: Array<{ id: string; dealId: string; status: string; amountHeld?: number; type?: string }>;
  logistics?: Array<{ id: string; plate?: string; dealId?: string; status?: string; eta?: string }>;
  queue?: Array<{ plate?: string; dealId?: string; weight?: number; arrived?: string; status?: string }>;
  samples?: Array<{ id: string; dealId: string; cargo?: string; received?: string; status?: string }>;
  kpis?: Record<string, number | string>;
  ok?: boolean;
}

interface UseRuntimeSnapshotResult {
  snapshot: RuntimeSnapshot | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useRuntimeSnapshot(pollingMs = 30_000): UseRuntimeSnapshotResult {
  const [snapshot, setSnapshot] = React.useState<RuntimeSnapshot | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [tick, setTick] = React.useState(0);

  const refresh = React.useCallback(() => setTick(t => t + 1), []);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);

    fetch('/api/runtime-me-snapshot', { cache: 'no-store' })
      .then(r => r.json())
      .then((data: RuntimeSnapshot) => {
        if (!cancelled) {
          setSnapshot(data.ok === false ? null : data);
          setError(null);
          setLoading(false);
        }
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setError(err.message);
          setLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, [tick]);

  React.useEffect(() => {
    if (pollingMs <= 0) return;
    const id = setInterval(refresh, pollingMs);
    return () => clearInterval(id);
  }, [pollingMs, refresh]);

  return { snapshot, loading, error, refresh };
}

export function useRuntimeStream(onEvent: (event: Record<string, unknown>) => void) {
  React.useEffect(() => {
    let es: EventSource | null = null;
    try {
      es = new EventSource('/api/runtime-me-stream');
      es.onmessage = (e) => {
        try { onEvent(JSON.parse(e.data)); } catch { /* ignore parse errors */ }
      };
    } catch { /* SSE not supported or connection failed */ }
    return () => { es?.close(); };
  }, [onEvent]);
}
