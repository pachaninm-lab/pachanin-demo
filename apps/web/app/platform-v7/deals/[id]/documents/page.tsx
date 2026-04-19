'use client';

import * as React from 'react';
import Link from 'next/link';

interface UploadedDoc {
  id: string;
  name: string;
  size: number;
  type: string;
  uploadedAt: string;
}

const REQUIRED_DOCS = [
  { id: 'contract', label: 'Контракт купли-продажи', blocker: true },
  { id: 'lab', label: 'Лабораторный протокол', blocker: true },
  { id: 'surveyor', label: 'Акт сюрвейера / приёмки', blocker: true },
  { id: 'bank', label: 'Подтверждение резерва банка', blocker: true },
  { id: 'transport', label: 'Транспортный документ', blocker: false },
];

function storageKey(dealId: string) {
  return `pc-docs-${dealId}`;
}

function checklistKey(dealId: string) {
  return `pc-doc-checklist-${dealId}`;
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function DealDocumentsPage({ params }: { params: { id: string } }) {
  const [docs, setDocs] = React.useState<UploadedDoc[]>([]);
  const [checklist, setChecklist] = React.useState<Record<string, boolean>>({});

  React.useEffect(() => {
    try {
      const rawDocs = window.localStorage.getItem(storageKey(params.id));
      const rawChecklist = window.localStorage.getItem(checklistKey(params.id));
      if (rawDocs) setDocs(JSON.parse(rawDocs));
      if (rawChecklist) setChecklist(JSON.parse(rawChecklist));
    } catch {}
  }, [params.id]);

  const blockerDone = REQUIRED_DOCS.filter((doc) => doc.blocker && checklist[doc.id]).length;
  const blockerTotal = REQUIRED_DOCS.filter((doc) => doc.blocker).length;
  const releaseReady = blockerDone === blockerTotal;

  return (
    <div style={{ display: 'grid', gap: 16, maxWidth: 980, margin: '0 auto' }}>
      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 800, color: '#0A7A5F', fontSize: 14 }}>{params.id}</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#0F1419', marginTop: 6 }}>Документы сделки</div>
            <div style={{ fontSize: 13, color: '#6B778C', marginTop: 6 }}>Отдельный документный контур: файлы, чек-лист и готовность к выпуску денег.</div>
          </div>
          <span style={{ display: 'inline-flex', alignItems: 'center', padding: '6px 10px', borderRadius: 999, background: releaseReady ? 'rgba(10,122,95,0.08)' : 'rgba(217,119,6,0.08)', border: `1px solid ${releaseReady ? 'rgba(10,122,95,0.18)' : 'rgba(217,119,6,0.18)'}`, color: releaseReady ? '#0A7A5F' : '#B45309', fontSize: 11, fontWeight: 800 }}>
            {releaseReady ? 'Документы готовы к выпуску' : `До выпуска: ${blockerDone}/${blockerTotal}`}
          </span>
        </div>
      </section>

      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18, display: 'grid', gap: 10 }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: '#0F1419' }}>Обязательные документы</div>
        {REQUIRED_DOCS.map((doc) => (
          <div key={doc.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 12, border: '1px solid #E4E6EA', background: checklist[doc.id] ? 'rgba(10,122,95,0.06)' : '#F8FAFB' }}>
            <span style={{ width: 18, textAlign: 'center', fontWeight: 900, color: checklist[doc.id] ? '#0A7A5F' : '#9AA4B2' }}>{checklist[doc.id] ? '✓' : '•'}</span>
            <div style={{ display: 'grid', gap: 2 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#0F1419' }}>{doc.label}</div>
              <div style={{ fontSize: 11, color: '#6B778C' }}>{doc.blocker ? 'Блокирует выпуск денег' : 'Не блокирует выпуск, но нужен для полного досье'}</div>
            </div>
          </div>
        ))}
      </section>

      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18, display: 'grid', gap: 10 }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: '#0F1419' }}>Файлы</div>
        {docs.length ? docs.map((doc) => (
          <div key={doc.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', padding: '10px 12px', borderRadius: 12, border: '1px solid #E4E6EA', background: '#fff' }}>
            <div style={{ display: 'grid', gap: 2, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#0F1419', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.name}</div>
              <div style={{ fontSize: 11, color: '#6B778C' }}>{formatSize(doc.size)} · {new Date(doc.uploadedAt).toLocaleString('ru-RU')}</div>
            </div>
            <span style={{ fontSize: 11, color: '#6B778C', fontWeight: 700 }}>{doc.type || 'file'}</span>
          </div>
        )) : <div style={{ fontSize: 13, color: '#6B778C' }}>Файлы по сделке ещё не загружены.</div>}
      </section>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Link href={`/platform-v7/deals/${params.id}`} style={{ textDecoration: 'none', padding: '10px 14px', borderRadius: 12, background: '#0A7A5F', border: '1px solid #0A7A5F', color: '#fff', fontSize: 13, fontWeight: 800 }}>← Вернуться в сделку</Link>
        <Link href='/platform-v7/deals' style={{ textDecoration: 'none', padding: '10px 14px', borderRadius: 12, border: '1px solid #E4E6EA', background: '#fff', color: '#0F1419', fontSize: 13, fontWeight: 700 }}>Все сделки</Link>
      </div>
    </div>
  );
}
