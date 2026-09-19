"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RuntimeSnapshot } from './runtime-server';
import { getLiveSocket } from './realtime';
import { getSession } from './auth-store';
import { applyCsrfHeader } from './csrf';

type RuntimeStreamPayload = {
  snapshot?: RuntimeSnapshot;
  feed?: { meta?: RuntimeSnapshot['meta'] };
  revision?: number;
};

type StreamState = 'idle' | 'connecting' | 'live' | 'retrying' | 'stale';

const DEFAULT_POLL_MS = 5000;
const STALE_AFTER_MS = 20_000;
const MAX_BACKOFF_MS = 30_000;

function revisionOf(snapshot: RuntimeSnapshot | null | undefined) {
  return Number((snapshot as any)?.meta?.revision || 0);
}

export function useRuntimeSnapshot(initialData?: RuntimeSnapshot | null, options?: { pollMs?: number }) {
  const [snapshot, setSnapshot] = useState<RuntimeSnapshot | null>(initialData || null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [streamState, setStreamState] = useState<StreamState>('idle');
  const [lastUpdateAt, setLastUpdateAt] = useState<number>(Date.now());
  const pollMs = options?.pollMs ?? DEFAULT_POLL_MS;
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const backoffRef = useRef<number>(pollMs);
  const latestRevisionRef = useRef<number>(revisionOf(initialData));

  const resolveEndpoints = useCallback(() => {
    const hasSession = !!getSession().accessToken;
    return {
      snapshot: hasSession ? '/api/runtime-me-snapshot' : '/api/runtime-snapshot',
      stream: hasSession ? '/api/runtime-me-stream' : '/api/runtime-stream',
      feed: hasSession ? '/api/runtime-me-feed' : '/api/runtime-feed'
    };
  }, []);

  const applySnapshot = useCallback((incoming: RuntimeSnapshot | null | undefined) => {
    if (!incoming) return;
    const nextRevision = revisionOf(incoming);
    setSnapshot((previous) => {
      const prevRevision = revisionOf(previous);
      if (nextRevision < latestRevisionRef.current && nextRevision < prevRevision) return previous;
      latestRevisionRef.current = Math.max(latestRevisionRef.current, nextRevision);
      setLastUpdateAt(Date.now());
      setStreamState('live');
      return incoming;
    });
  }, []);

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const endpoints = resolveEndpoints();
      const response = await fetch(endpoints.snapshot, { cache: 'no-store' });
      const payload = await response.json().catch(() => null);
      if (payload?.deals || payload?.roleView || payload?.summary) applySnapshot(payload);
    } finally {
      setIsRefreshing(false);
    }
  }, [applySnapshot, resolveEndpoints]);

  const simulate = useCallback(async (action: string, payload?: Record<string, any>) => {
    setIsRefreshing(true);
    try {
      await fetch('/api/runtime-simulate', {
        method: 'POST',
        headers: applyCsrfHeader({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ action, ...(payload || {}) })
      });
      await refresh();
    } finally {
      setIsRefreshing(false);
    }
  }, [refresh]);

  useEffect(() => {
    refresh();
    const timer = window.setInterval(() => { void refresh(); }, pollMs);
    return () => window.clearInterval(timer);
  }, [pollMs, refresh]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const closeStream = () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };

    const scheduleReconnect = () => {
      if (reconnectTimerRef.current) window.clearTimeout(reconnectTimerRef.current);
      setStreamState('retrying');
      reconnectTimerRef.current = window.setTimeout(() => {
        connectStream();
      }, backoffRef.current);
      backoffRef.current = Math.min(MAX_BACKOFF_MS, Math.max(pollMs, backoffRef.current * 2));
    };

    const connectStream = () => {
      closeStream();
      setStreamState('connecting');
      const endpoints = resolveEndpoints();
      const stream = new EventSource(endpoints.stream);
      eventSourceRef.current = stream;
      stream.onopen = () => {
        backoffRef.current = pollMs;
        setStreamState('live');
      };
      const onRuntimeUpdate = (event: MessageEvent) => {
        try {
          const payload = JSON.parse(event.data || '{}') as RuntimeStreamPayload;
          if (payload?.snapshot?.deals || (payload?.snapshot as any)?.roleView || (payload?.snapshot as any)?.summary) {
            applySnapshot(payload.snapshot);
            return;
          }
        } catch {
          // ignore malformed event and fallback to refresh
        }
        void refresh();
      };
      stream.addEventListener('runtime.updated', onRuntimeUpdate as EventListener);
      stream.onerror = () => {
        closeStream();
        void refresh();
        scheduleReconnect();
      };
    };

    connectStream();

    return () => {
      if (reconnectTimerRef.current) window.clearTimeout(reconnectTimerRef.current);
      closeStream();
    };
  }, [applySnapshot, pollMs, refresh, resolveEndpoints]);

  useEffect(() => {
    const socket = getLiveSocket();
    if (!socket) return;
    const handler = () => { void refresh(); };
    const roleHandler = (payload: RuntimeStreamPayload) => {
      if (payload?.snapshot) {
        applySnapshot(payload.snapshot);
        return;
      }
      if ((payload as any)?.rolePayload) void refresh();
    };
    socket.on('runtime.updated', handler);
    socket.on('runtime.role.updated', roleHandler);
    socket.on('runtime.object.updated', roleHandler);
    return () => {
      socket.off('runtime.updated', handler);
      socket.off('runtime.role.updated', roleHandler);
      socket.off('runtime.object.updated', roleHandler);
    };
  }, [applySnapshot, refresh]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (Date.now() - lastUpdateAt > STALE_AFTER_MS) {
        setStreamState('stale');
      }
    }, 3000);
    return () => window.clearInterval(timer);
  }, [lastUpdateAt]);

  const runScenario = useCallback(async (scenarioId: string) => {
    setIsRefreshing(true);
    try {
      await fetch(`/api/runtime-scenario/${scenarioId}/run`, { method: 'POST', headers: applyCsrfHeader() });
      await refresh();
    } finally {
      setIsRefreshing(false);
    }
  }, [refresh]);

  const processOutbox = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await fetch('/api/runtime-outbox/process', { method: 'POST', headers: applyCsrfHeader() });
      await refresh();
    } finally {
      setIsRefreshing(false);
    }
  }, [refresh]);

  const retryDeadLetters = useCallback(async (limit = 50) => {
    setIsRefreshing(true);
    try {
      await fetch('/api/runtime-outbox-retry', {
        method: 'POST',
        headers: applyCsrfHeader({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ limit })
      });
      await refresh();
    } finally {
      setIsRefreshing(false);
    }
  }, [refresh]);

  const command = useCallback(async (action: string, payload?: Record<string, any>, idempotencyKey?: string) => {
    setIsRefreshing(true);
    try {
      const response = await fetch('/api/runtime-command', {
        method: 'POST',
        headers: applyCsrfHeader({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ action, payload: payload || {}, idempotencyKey })
      });
      const result = await response.json().catch(() => null);
      await refresh();
      return result;
    } finally {
      setIsRefreshing(false);
    }
  }, [refresh]);

  const meta = useMemo(() => (snapshot as any)?.meta, [snapshot]);
  const isStale = streamState === 'stale';

  return { snapshot, refresh, simulate, runScenario, processOutbox, retryDeadLetters, command, isRefreshing, meta, streamState, isStale, lastUpdateAt };
}
