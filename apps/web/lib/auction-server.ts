import { serverApiUrl, serverAuthHeaders } from './server-api';

export async function getAuctionWorkspaceCanonical(lotId: string) {
  try {
    const response = await fetch(serverApiUrl(`/auctions/lots/${lotId}/workspace`), { cache: 'no-store', headers: serverAuthHeaders() });
    if (!response.ok) throw new Error(`auction workspace ${response.status}`);
    const data = await response.json();
    return { source: 'canonical.auctions.workspace', available: true, data, error: null as string | null };
  } catch (error) {
    return { source: 'unavailable.auctions.workspace', available: false, data: null as any, error: error instanceof Error ? error.message : 'auction workspace unavailable' };
  }
}

export async function getTradingOriginModesCanonical() {
  try {
    const response = await fetch(serverApiUrl('/auctions/origin-modes'), { cache: 'no-store', headers: serverAuthHeaders() });
    if (!response.ok) throw new Error(`origin modes ${response.status}`);
    const data = await response.json();
    return { source: 'canonical.auctions.origin-modes', available: true, items: Array.isArray(data) ? data : [], error: null as string | null };
  } catch (error) {
    return { source: 'unavailable.auctions.origin-modes', available: false, items: [] as any[], error: error instanceof Error ? error.message : 'origin modes unavailable' };
  }
}
