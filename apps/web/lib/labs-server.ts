import { serverApiUrl, serverAuthHeaders } from './server-api';

export type LabSampleServerItem = {
  id: string;
  dealId: string;
  shipmentId?: string;
  status: 'PENDING' | 'COLLECTED' | 'ANALYSIS_IN_PROGRESS' | 'FINALIZED' | 'ANALYZED';
  culture?: string;
  protocol?: string;
  collectedAt?: string;
  finalizedAt?: string;
  labId?: string;
  moneyDeltaRub?: number;
  tests?: Array<{
    id: string;
    parameter: string;
    value: number;
    unit?: string;
    norm?: string;
    passed: boolean;
    recordedAt: string;
  }>;
  chainOfCustody?: Array<{ id: string; type: string; at: string; by: string }>;
};

export type LabProtocolSummary = {
  sampleId: string;
  dealId: string;
  protocol: string;
  status: string;
  failedTests: number;
  moneyImpactRub: number;
  isComplete: boolean;
};

export async function getLabSamples(): Promise<LabSampleServerItem[]> {
  try {
    const res = await fetch(serverApiUrl('/labs/samples'), {
      cache: 'no-store',
      headers: await serverAuthHeaders(),
    });
    if (!res.ok) throw new Error(`lab samples ${res.status}`);
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export async function getLabSample(id: string): Promise<LabSampleServerItem | null> {
  try {
    const res = await fetch(serverApiUrl(`/labs/samples/${id}`), {
      cache: 'no-store',
      headers: await serverAuthHeaders(),
    });
    if (!res.ok) throw new Error(`lab sample ${id} ${res.status}`);
    return res.json();
  } catch {
    return null;
  }
}

export function toProtocolSummary(sample: LabSampleServerItem): LabProtocolSummary {
  const failedTests = (sample.tests ?? []).filter((t) => !t.passed).length;
  return {
    sampleId: sample.id,
    dealId: sample.dealId,
    protocol: sample.protocol ?? `PROT-${sample.id}`,
    status: sample.status,
    failedTests,
    moneyImpactRub: sample.moneyDeltaRub ?? 0,
    isComplete: sample.status === 'FINALIZED' || sample.status === 'ANALYZED',
  };
}

export function labMoneyImpactRub(samples: LabSampleServerItem[]): number {
  return samples.reduce((sum, s) => sum + (s.moneyDeltaRub ?? 0), 0);
}

export function pendingProtocols(samples: LabSampleServerItem[]): LabSampleServerItem[] {
  return samples.filter((s) => s.status !== 'FINALIZED' && s.status !== 'ANALYZED');
}
