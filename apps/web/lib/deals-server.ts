import { serverApiUrl, serverAuthHeaders } from './server-api';

export type DealsSnapshot = Readonly<{ deals: any[]; isApiAvailable: boolean; isComplete: boolean }>;

export async function getDealsSnapshot(): Promise<DealsSnapshot> {
  try {
    const response = await fetch(serverApiUrl('/deals'), {
      cache: 'no-store',
      headers: await serverAuthHeaders()
    });
    if (!response.ok) return { deals: [], isApiAvailable: false, isComplete: false };
    const raw: unknown = await response.json();
    if (!Array.isArray(raw)) return { deals: [], isApiAvailable: false, isComplete: false };
    return { deals: raw, isApiAvailable: true, isComplete: raw.length < 100 };
  } catch {
    return { deals: [], isApiAvailable: false, isComplete: false };
  }
}

export async function getDealsCanonical() {
  return (await getDealsSnapshot()).deals;
}

export async function getDealWorkspaceCanonical(dealId: string) {
  try {
    const response = await fetch(serverApiUrl(`/deals/${dealId}/workspace`), {
      cache: 'no-store',
      headers: await serverAuthHeaders()
    });
    if (!response.ok) throw new Error(`deal workspace ${response.status}`);
    return response.json();
  } catch {
    return null;
  }
}
