import { serverApiUrl, serverAuthHeaders } from './server-api';

export async function getDealsCanonical() {
  try {
    const response = await fetch(serverApiUrl('/deals'), {
      cache: 'no-store',
      headers: serverAuthHeaders()
    });
    if (!response.ok) throw new Error(`deals list ${response.status}`);
    return response.json();
  } catch {
    return [];
  }
}

export async function getDealWorkspaceCanonical(dealId: string) {
  try {
    const response = await fetch(serverApiUrl(`/deals/${dealId}/workspace`), {
      cache: 'no-store',
      headers: serverAuthHeaders()
    });
    if (!response.ok) throw new Error(`deal workspace ${response.status}`);
    return response.json();
  } catch {
    return null;
  }
}
