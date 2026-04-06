import { serverApiUrl, serverAuthHeaders } from './server-api';

export async function getMarketAnalyticsOverview() {
  try {
    const response = await fetch(serverApiUrl('/market-analytics/overview'), {
      cache: 'no-store',
      headers: serverAuthHeaders()
    });
    if (!response.ok) throw new Error(`market analytics ${response.status}`);
    return response.json();
  } catch {
    return { cards: [], series: [], source: 'fallback.analytics' };
  }
}
