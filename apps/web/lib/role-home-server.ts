import { serverApiUrl, serverAuthHeaders } from './server-api';

export async function getRoleHomeCanonical(roleId: string) {
  try {
    const response = await fetch(serverApiUrl(`/role-homes/${roleId}`), { cache: 'no-store', headers: serverAuthHeaders() });
    if (!response.ok) throw new Error(`role home ${response.status}`);
    const data = await response.json();
    return { available: true, source: data?.source || `canonical.role-home.${roleId}`, data, error: null as string | null };
  } catch (error) {
    return { available: false, source: `unavailable.role-home.${roleId}`, data: null as any, error: error instanceof Error ? error.message : 'role home unavailable' };
  }
}
