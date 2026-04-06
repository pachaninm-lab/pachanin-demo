import { serverApiUrl, serverAuthHeaders } from './server-api';

async function fetchSber(path: string) {
  try {
    const response = await fetch(serverApiUrl(path), { cache: 'no-store', headers: serverAuthHeaders() });
    if (!response.ok) throw new Error(`sber ${response.status}`);
    const data = await response.json();
    return { available: true, data, error: null as string | null, source: `canonical${path}` };
  } catch (error) {
    return { available: false, data: null as any, error: error instanceof Error ? error.message : 'sber unavailable', source: `unavailable${path}` };
  }
}

export async function getSberReadModel(dealId: string) {
  return fetchSber(`/integrations/deals/${dealId}/sber/read-model`);
}

export async function getSberBeneficiaries(dealId: string) {
  return fetchSber(`/integrations/deals/${dealId}/sber/beneficiaries`);
}

export async function getSberStatement(dealId: string) {
  return fetchSber(`/integrations/deals/${dealId}/sber/statement`);
}

export async function getSberEvents(dealId: string) {
  return fetchSber(`/integrations/deals/${dealId}/sber/events`);
}

export async function getSberRefunds(dealId: string) {
  return fetchSber(`/integrations/deals/${dealId}/sber/refunds`);
}

export async function getSberSafeDeal(dealId: string) {
  return fetchSber(`/integrations/deals/${dealId}/sber/safe-deal`);
}
