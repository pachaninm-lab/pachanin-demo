import { serverApiUrl, serverAuthHeaders } from './server-api';

export type DealsSnapshot = Readonly<{ deals: any[]; isApiAvailable: boolean }>;

export async function getDealsSnapshot(): Promise<DealsSnapshot> {
  try {
    const response = await fetch(serverApiUrl('/deals'), {
      cache: 'no-store',
      headers: await serverAuthHeaders()
    });
    if (!response.ok) return { deals: [], isApiAvailable: false };
    const raw: unknown = await response.json();
    if (!Array.isArray(raw)) return { deals: [], isApiAvailable: false };
    return { deals: raw, isApiAvailable: true };
  } catch {
    return { deals: [], isApiAvailable: false };
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
