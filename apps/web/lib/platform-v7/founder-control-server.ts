import 'server-only';
import { serverApiUrl, serverAuthHeaders } from '@/lib/server-api';
import type {
  FounderControlBundle,
  FounderControlEvent,
  FounderControlOverview,
  FounderControlRecord,
  FounderControlSpec,
} from './founder-control-types';

async function get<T>(path: string): Promise<T> {
  const response = await fetch(serverApiUrl(path), {
    cache: 'no-store',
    headers: await serverAuthHeaders({ Accept: 'application/json' }),
    redirect: 'manual',
    signal: AbortSignal.timeout(6_000),
  });
  if (!response.ok) throw new Error(`founder_control_${response.status}`);
  return response.json() as Promise<T>;
}

export async function loadFounderControlBundle(): Promise<FounderControlBundle> {
  try {
    const [overview, spec, records, events] = await Promise.all([
      get<FounderControlOverview>('/founder-control/overview'),
      get<FounderControlSpec>('/founder-control/spec'),
      get<FounderControlRecord[]>('/founder-control/records'),
      get<FounderControlEvent[]>('/founder-control/events?limit=30'),
    ]);
    return Object.freeze({ available: true, overview, spec, records, events });
  } catch (error) {
    return Object.freeze({
      available: false,
      overview: null,
      spec: null,
      records: [],
      events: [],
      error: error instanceof Error ? error.message : 'founder_control_unavailable',
    });
  }
}
