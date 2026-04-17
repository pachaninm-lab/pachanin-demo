'use client';

import * as React from 'react';

interface UploadedDoc {
  id: string;
  name: string;
  size: number;
  type: string;
  uploadedAt: string;
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function DocumentsDropzone({ dealId }: { dealId: string }) {
  const [docs, setDocs] = React.useState<UploadedDoc[]>([]);
  const [dragging, setDragging] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement | null>(null);

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

  return (
    <section
      aria-label={`Документы по сделке ${dealId}`}
      data-demo="true"
      style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18 }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#0F1419' }}>Документы сделки</div>
          <div style={{ marginTop: 4, fontSize: 12, color: '#6B778C' }}>Перетащите файлы или выберите вручную. В демо-режиме сохраняется в памяти сессии.</div>
        </div>
        <div style={{ fontSize: 11, color: '#6B778C', fontWeight: 700 }}>{docs.length ? `${docs.length} файлов` : 'Пусто'}</div>
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
