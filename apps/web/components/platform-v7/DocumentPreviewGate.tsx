import type { DocumentAccessContext } from '../../lib/platform-v7/document-access-control';
import { canDownloadDocument, documentAccessLabel } from '../../lib/platform-v7/document-access-control';

export function DocumentPreviewGate({ context }: { context: DocumentAccessContext }) {
  const download = canDownloadDocument(context);
  const color = download.allowed ? '#0A7A5F' : '#B45309';
  return (
    <div style={{ border: '1px solid #E4E6EA', borderRadius: 16, padding: 12, display: 'grid', gap: 6, background: '#fff' }}>
      <strong style={{ color: '#0F1419', fontSize: 14 }}>Документы</strong>
      <span style={{ color, fontSize: 13, fontWeight: 900 }}>{documentAccessLabel(context)}</span>
      <span style={{ color: '#64748B', fontSize: 12 }}>{download.allowed ? 'Скачивание будет записано в журнал.' : `Причина: ${download.reason ?? 'этап сделки не наступил'}`}</span>
    </div>
  );
}
