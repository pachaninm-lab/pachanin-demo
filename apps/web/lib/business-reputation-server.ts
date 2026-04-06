import { serverApiUrl, serverAuthHeaders } from './server-api';

export async function getBusinessReputationOrganizations() {
  try {
    const response = await fetch(serverApiUrl('/business-reputation/organizations'), {
      cache: 'no-store',
      headers: serverAuthHeaders()
    });
    if (!response.ok) throw new Error(`business reputation organizations ${response.status}`);
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export async function getBusinessReputationProfile(orgId: string) {
  try {
    const response = await fetch(serverApiUrl(`/business-reputation/organizations/${orgId}`), {
      cache: 'no-store',
      headers: serverAuthHeaders()
    });
    if (!response.ok) throw new Error(`business reputation profile ${response.status}`);
    return response.json();
  } catch {
    return null;
  }
}
