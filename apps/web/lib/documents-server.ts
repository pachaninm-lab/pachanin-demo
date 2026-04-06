import { serverApiUrl, serverAuthHeaders } from './server-api';
import type { RuntimeSnapshot } from './runtime-server';

type RuntimeDocument = RuntimeSnapshot['documents'][number];

export type DocumentCenterItem = {
  id: string;
  title: string;
  type: string;
  status: string;
  format: string;
  sizeKb: number;
  issuedAt: string;
  uploadedBy: string;
  verifiedBy: string;
  linkedTo: string;
  blocker: string;
  hash: string;
  version: string;
  mimeType?: string;
  dealId?: string;
  lotId?: string;
  shipmentId?: string;
  originalName?: string;
  isRuntimeFallback?: boolean;
};

function formatType(originalName?: string, mimeType?: string) {
  if (originalName?.includes('.')) return originalName.split('.').pop()?.toUpperCase() || 'FILE';
  if (mimeType?.includes('pdf')) return 'PDF';
  if (mimeType?.includes('image')) return 'IMG';
  return 'FILE';
}

function mapApi(item: any): DocumentCenterItem {
  return {
    id: item.id,
    title: item.originalName || item.type,
    type: item.type,
    status: item.metadata?.status || 'активен',
    format: formatType(item.originalName, item.mimeType),
    sizeKb: Math.max(1, Math.round(Number(item.sizeBytes || 0) / 1024)),
    issuedAt: item.uploadedAt || item.createdAt || '',
    uploadedBy: item.uploadedByUserId || 'system',
    verifiedBy: item.metadata?.verifiedBy || '—',
    linkedTo: item.dealId || item.lotId || item.shipmentId || '—',
    blocker: item.metadata?.blocker || '—',
    hash: item.sha256 || '—',
    version: item.metadata?.version || 'v1',
    mimeType: item.mimeType,
    dealId: item.dealId,
    lotId: item.lotId,
    shipmentId: item.shipmentId,
    originalName: item.originalName,
    isRuntimeFallback: false
  };
}

function mapRuntime(item: RuntimeDocument): DocumentCenterItem {
  return {
    id: item.id,
    title: item.title || item.type,
    type: item.type,
    status: item.status,
    format: item.format || 'PDF',
    sizeKb: item.sizeKb || 0,
    issuedAt: item.issuedAt || '',
    uploadedBy: item.uploadedBy,
    verifiedBy: item.verifiedBy,
    linkedTo: item.linkedTo,
    blocker: item.blocker,
    hash: item.hash,
    version: item.version,
    dealId: item.dealId,
    isRuntimeFallback: true
  };
}

export async function getDocuments(fallbackDocuments: RuntimeDocument[]): Promise<DocumentCenterItem[]> {
  try {
    const response = await fetch(serverApiUrl('/documents'), { cache: 'no-store', headers: serverAuthHeaders() });
    if (!response.ok) throw new Error(`documents ${response.status}`);
    const payload = await response.json();
    if (!Array.isArray(payload)) throw new Error('documents shape');
    return payload.map(mapApi);
  } catch {
    return fallbackDocuments.map(mapRuntime);
  }
}
