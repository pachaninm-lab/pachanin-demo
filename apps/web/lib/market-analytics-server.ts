import { serverApiUrl, serverAuthHeaders } from './server-api';

export async function getMarketAnalyticsOverview() {
  try {
    const response = await fetch(serverApiUrl('/market-analytics/overview'), {
      cache: 'no-store',
      headers: await serverAuthHeaders(),
      redirect: 'error'
    });
    if (!response.ok) throw new Error(`market analytics ${response.status}`);
    return response.json();
  } catch {
    return { cards: [], series: [], source: 'fallback.analytics' };
  }
}
