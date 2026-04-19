'use client';

import * as React from 'react';

interface UploadedDoc {
  id: string;
  name: string;
  size: number;
  type: string;
  uploadedAt: string;
}

interface RequiredDoc {
  id: string;
  label: string;
  blocker: boolean;
}

const REQUIRED_DOCS: RequiredDoc[] = [
  { id: 'contract', label: 'Контракт купли-продажи', blocker: true },
  { id: 'lab', label: 'Лабораторный протокол', blocker: true },
  { id: 'surveyor', label: 'Акт сюрвейера / приёмки', blocker: true },
  { id: 'bank', label: 'Подтверждение резерва банка', blocker: true },
  { id: 'transport', label: 'Транспортный документ', blocker: false },
];

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function storageKey(dealId: string) {
  return `pc-docs-${dealId}`;
}

function checklistKey(dealId: string) {
  return `pc-doc-checklist-${dealId}`;
}

export function DocumentsDropzone({ dealId }: { dealId: string }) {
  const [docs, setDocs] = React.useState<UploadedDoc[]>([]);
  const [dragging, setDragging] = React.useState(false);
  const [checklist, setChecklist] = React.useState<Record<string, boolean>>({});
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  React.useEffect(() => {
    try {
      const rawDocs = window.localStorage.getItem(storageKey(dealId));
      const rawChecklist = window.localStorage.getItem(checklistKey(dealId));
      if (rawDocs) setDocs(JSON.parse(rawDocs));
      if (rawChecklist) setChecklist(JSON.parse(rawChecklist));
    } catch {}
  }, [dealId]);

  React.useEffect(() => {
    try { window.localStorage.setItem(storageKey(dealId), JSON.stringify(docs)); } catch {}
  }, [dealId, docs]);

  React.useEffect(() => {
    try { window.localStorage.setItem(checklistKey(dealId), JSON.stringify(checklist)); } catch {}
  }, [dealId, checklist]);

  const absorb = (files: FileList | null) => {
    if (!files) return;
    const next: UploadedDoc[] = Array.from(files).map((file) => ({
      id: `${file.name}-${file.size}-${Date.now()}`,
      name: file.name,
      size: file.size,
      type: file.type || 'application/octet-stream',
      uploadedAt: new Date().toISOString(),
    }));
    setDocs((prev) => [...next, ...prev]);
  };

  const onDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    absorb(event.dataTransfer.files);
  };

  const remove = (id: string) => setDocs((prev) => prev.filter((doc) => doc.id !== id));
  const toggleChecklist = (id: string) => setChecklist((prev) => ({ ...prev, [id]: !prev[id] }));

  const requiredDone = REQUIRED_DOCS.filter((doc) => checklist[doc.id]).length;
  const blockerDone = REQUIRED_DOCS.filter((doc) => doc.blocker && checklist[doc.id]).length;
  const blockerTotal = REQUIRED_DOCS.filter((doc) => doc.blocker).length;
  const releaseReady = blockerDone === blockerTotal;

  return (
    <section
      aria-label={`Документы по сделке ${dealId}`}
      data-demo="true"
      style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18 }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#0F1419' }}>Документы сделки</div>
          <div style={{ marginTop: 4, fontSize: 12, color: '#6B778C' }}>Файлы и чек-лист готовности. В демо-режиме сохраняется в памяти браузера по каждой сделке.</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ fontSize: 11, color: '#6B778C', fontWeight: 700 }}>{docs.length ? `${docs.length} файлов` : 'Пусто'}</div>
          <span style={{ display: 'inline-flex', alignItems: 'center', padding: '6px 10px', borderRadius: 999, background: releaseReady ? 'rgba(10,122,95,0.08)' : 'rgba(217,119,6,0.08)', border: `1px solid ${releaseReady ? 'rgba(10,122,95,0.18)' : 'rgba(217,119,6,0.18)'}`, color: releaseReady ? '#0A7A5F' : '#B45309', fontSize: 11, fontWeight: 800 }}>
            {releaseReady ? 'Документы готовы к выпуску' : `До выпуска: ${blockerDone}/${blockerTotal}`}
          </span>
        </div>
      </div>

      <div style={{ marginTop: 14, display: 'grid', gap: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'baseline' }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#0F1419' }}>Чек-лист обязательных документов</div>
          <div style={{ fontSize: 12, color: '#6B778C' }}>{requiredDone}/{REQUIRED_DOCS.length} отмечено</div>
        </div>
        {REQUIRED_DOCS.map((doc) => (
          <label key={doc.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 12, border: '1px solid #E4E6EA', background: checklist[doc.id] ? 'rgba(10,122,95,0.06)' : '#F8FAFB', cursor: 'pointer' }}>
            <input type="checkbox" checked={!!checklist[doc.id]} onChange={() => toggleChecklist(doc.id)} />
            <div style={{ display: 'grid', gap: 2, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#0F1419' }}>{doc.label}</div>
              <div style={{ fontSize: 11, color: '#6B778C' }}>{doc.blocker ? 'Блокирует выпуск денег' : 'Желательно для полного досье сделки'}</div>
            </div>
            <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 800, color: checklist[doc.id] ? '#0A7A5F' : '#9AA4B2' }}>{checklist[doc.id] ? 'Готово' : 'Нет'}</span>
          </label>
        ))}
      </div>

      <div
        role="button"
        tabIndex={0}
        aria-label="Область загрузки документов"
        onClick={() => inputRef.current?.click()}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        style={{
          marginTop: 14,
          padding: 22,
          borderRadius: 16,
          border: `2px dashed ${dragging ? '#0A7A5F' : '#CBD5E1'}`,
          background: dragging ? 'rgba(10,122,95,0.06)' : '#F8FAFB',
          textAlign: 'center',
          cursor: 'pointer',
          transition: 'background 0.15s ease, border-color 0.15s ease',
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 800, color: '#0F1419' }}>Перетащите PDF / DOCX / XLSX сюда</div>
        <div style={{ marginTop: 6, fontSize: 12, color: '#6B778C' }}>или нажмите для выбора файлов · макс. 20 МБ на файл</div>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".pdf,.docx,.xlsx,.doc,.xls,.jpg,.jpeg,.png"
          onChange={(event) => absorb(event.target.files)}
          style={{ display: 'none' }}
        />
      </div>

      {docs.length ? (
        <ul style={{ listStyle: 'none', padding: 0, margin: '14px 0 0', display: 'grid', gap: 8 }}>
          {docs.map((doc) => (
            <li key={doc.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', padding: '10px 12px', border: '1px solid #E4E6EA', borderRadius: 12, background: '#fff' }}>
              <div style={{ display: 'grid', gap: 2, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#0F1419', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.name}</div>
                <div style={{ fontSize: 11, color: '#6B778C' }}>{formatSize(doc.size)} · {new Date(doc.uploadedAt).toLocaleTimeString('ru-RU')}</div>
              </div>
              <button
                onClick={() => remove(doc.id)}
                aria-label={`Удалить файл ${doc.name}`}
                style={{ padding: '6px 10px', borderRadius: 8, background: '#fff', border: '1px solid #E4E6EA', fontSize: 11, fontWeight: 700, color: '#6B778C', cursor: 'pointer' }}
              >
                Удалить
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
