import { serverApiUrl, serverAuthHeaders } from './server-api';

export async function getNotifications() {
  try {
    const response = await fetch(serverApiUrl('/notifications'), {
      cache: 'no-store',
      headers: serverAuthHeaders()
    });
    if (!response.ok) throw new Error(`notifications ${response.status}`);
    return response.json();
  } catch {
    return [];
  }
}
