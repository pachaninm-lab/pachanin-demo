import { serverApiUrl, serverAuthHeaders } from './server-api';

export type EvidenceFileItem = {
  id: string;
  dealId: string;
  shipmentId?: string;
  disputeId?: string;
  type: 'photo' | 'gps_track' | 'weight_ticket' | 'lab_protocol' | 'signature' | 'document';
  filename: string;
  mimeType: string;
  sizeBytes: number;
  hash: string;
  prevHash?: string;
  uploadedBy: string;
  uploadedAt: string;
};

export type EvidencePackResult = {
  files: EvidenceFileItem[];
  chainVerified: boolean;
};

const STATIC_FALLBACK: EvidencePackResult = {
  files: [],
  chainVerified: false,
};

export async function getEvidencePack(dealId: string): Promise<EvidencePackResult> {
  try {
    const res = await fetch(serverApiUrl(`/evidence-pack/deal/${encodeURIComponent(dealId)}`), {
      cache: 'no-store',
      headers: serverAuthHeaders(),
    });
    if (!res.ok) throw new Error(`evidence-pack ${res.status}`);
    return res.json();
  } catch {
    return STATIC_FALLBACK;
  }
}

export async function verifyEvidenceChain(dealId: string): Promise<{ valid: boolean; brokenAt?: string; totalFiles: number }> {
  try {
    const res = await fetch(serverApiUrl(`/evidence-pack/deal/${encodeURIComponent(dealId)}/verify-chain`), {
      cache: 'no-store',
      headers: serverAuthHeaders(),
    });
    if (!res.ok) throw new Error(`evidence-chain ${res.status}`);
    return res.json();
  } catch {
    return { valid: false, totalFiles: 0 };
  }
}

export function evidenceByType(files: EvidenceFileItem[], type: EvidenceFileItem['type']): EvidenceFileItem[] {
  return files.filter((f) => f.type === type);
}
