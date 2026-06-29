'use client';

import { useState, useRef, useCallback } from 'react';

type ScanCategory = 'sample_act' | 'lab_result' | 'accompanying_doc' | 'photo_grain' | 'other';

interface UploadedFile {
  id: string;
  file: File;
  category: ScanCategory;
  previewUrl?: string;
  uploadedAt: string;
}

const CATEGORY_LABEL: Record<ScanCategory, string> = {
  sample_act:       'Акт пробы',
  lab_result:       'Результат анализа',
  accompanying_doc: 'Сопроводительный документ',
  photo_grain:      'Фото зерна',
  other:            'Прочее',
};

const ACCEPTED = '.jpg,.jpeg,.png,.pdf,.tiff,.bmp';
const MAX_SIZE_MB = 20;

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

function fileIcon(file: File) {
  if (file.type.startsWith('image/')) return '🖼';
  if (file.type === 'application/pdf') return '📄';
  return '📎';
}

interface Props {
  sampleId?: string;
  onFilesChange?: (files: UploadedFile[]) => void;
}

export function LabPhotoUpload({ sampleId = 'SMPL-DEMO', onFilesChange }: Props) {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState<ScanCategory>('lab_result');
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback((incoming: FileList | null) => {
    if (!incoming || incoming.length === 0) return;
    const newFiles: UploadedFile[] = [];
    const errs: string[] = [];

    Array.from(incoming).forEach((f) => {
      if (f.size > MAX_SIZE_MB * 1024 * 1024) {
        errs.push(`${f.name}: превышает ${MAX_SIZE_MB} МБ`);
        return;
      }
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const previewUrl = f.type.startsWith('image/') ? URL.createObjectURL(f) : undefined;
      newFiles.push({ id, file: f, category, previewUrl, uploadedAt: new Date().toISOString() });
    });

    if (errs.length > 0) setError(errs.join('; '));
    else setError(null);

    setFiles((prev) => {
      const next = [...prev, ...newFiles];
      onFilesChange?.(next);
      return next;
    });
  }, [category, onFilesChange]);

  const removeFile = (id: string) => {
    setFiles((prev) => {
      const f = prev.find((x) => x.id === id);
      if (f?.previewUrl) URL.revokeObjectURL(f.previewUrl);
      const next = prev.filter((x) => x.id !== id);
      onFilesChange?.(next);
      return next;
    });
  };

  const changeCategory = (id: string, cat: ScanCategory) => {
    setFiles((prev) => prev.map((f) => f.id === id ? { ...f, category: cat } : f));
  };

  return (
    <div data-demo="true" style={{ display: 'grid', gap: '0.875rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--pc-text-primary)' }}>Фото и сканы · проба {sampleId}</div>
          <div style={{ fontSize: 10, color: 'var(--pc-text-muted)' }}>JPG, PNG, PDF, TIFF до {MAX_SIZE_MB} МБ</div>
        </div>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as ScanCategory)}
          style={{ fontSize: 11, fontWeight: 700, padding: '4px 8px', borderRadius: 7, border: '1px solid var(--p7-color-border, #E4E6EA)', background: 'var(--p7-color-surface-muted)', color: 'var(--pc-text-secondary)', cursor: 'pointer' }}
          aria-label="Категория файла"
        >
          {(Object.entries(CATEGORY_LABEL) as [ScanCategory, string][]).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>

      {/* Drop zone */}
      <div
        role="button"
        tabIndex={0}
        aria-label="Область перетаскивания файлов"
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click(); }}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files); }}
        style={{
          border: `2px dashed ${dragOver ? 'var(--p7-color-brand, #0A7A5F)' : 'var(--p7-color-border, #E4E6EA)'}`,
          borderRadius: 12,
          padding: '1.25rem',
          textAlign: 'center',
          cursor: 'pointer',
          background: dragOver ? 'rgba(10,122,95,0.04)' : 'var(--p7-color-surface-muted)',
          transition: 'border-color 150ms ease, background 150ms ease',
        }}
      >
        <div style={{ fontSize: 24, marginBottom: 6 }}>📂</div>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--pc-text-primary)' }}>Перетащите файл или нажмите для выбора</div>
        <div style={{ fontSize: 10, color: 'var(--pc-text-muted)', marginTop: 4 }}>{CATEGORY_LABEL[category]}</div>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPTED}
          style={{ display: 'none' }}
          onChange={(e) => addFiles(e.target.files)}
          aria-hidden="true"
        />
      </div>

      {/* Error */}
      {error && (
        <div style={{ fontSize: 11, color: '#B91C1C', background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.18)', borderRadius: 8, padding: '6px 10px' }}>
          {error}
        </div>
      )}

      {/* File list */}
      {files.length > 0 && (
        <div style={{ display: 'grid', gap: '0.5rem' }}>
          {files.map((f) => (
            <div
              key={f.id}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.625rem',
                padding: '0.5rem 0.625rem', borderRadius: 10,
                background: 'var(--p7-color-surface-muted)', border: '1px solid var(--p7-color-border)',
              }}
            >
              {/* Image preview thumbnail */}
              {f.previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={f.previewUrl} alt={f.file.name} style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: 6, flexShrink: 0 }} />
              ) : (
                <span style={{ fontSize: 24, flexShrink: 0 }}>{fileIcon(f.file)}</span>
              )}

              {/* File info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--pc-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.file.name}</div>
                <div style={{ fontSize: 10, color: 'var(--pc-text-muted)' }}>{formatSize(f.file.size)} · {new Date(f.uploadedAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</div>
              </div>

              {/* Category selector per file */}
              <select
                value={f.category}
                onChange={(e) => changeCategory(f.id, e.target.value as ScanCategory)}
                style={{ fontSize: 9, padding: '2px 4px', borderRadius: 5, border: '1px solid var(--p7-color-border)', background: 'transparent', color: 'var(--pc-text-muted)', cursor: 'pointer' }}
                aria-label={`Категория для ${f.file.name}`}
              >
                {(Object.entries(CATEGORY_LABEL) as [ScanCategory, string][]).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>

              {/* Remove */}
              <button
                onClick={() => removeFile(f.id)}
                aria-label={`Удалить ${f.file.name}`}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: 'var(--pc-text-muted)', flexShrink: 0, lineHeight: 1, padding: 2 }}
              >
                ✕
              </button>
            </div>
          ))}

          <div style={{ fontSize: 9, color: 'var(--pc-text-muted)', textAlign: 'right' }}>
            {files.length} файл{files.length > 1 ? 'а' : ''} · итого {formatSize(files.reduce((sum, f) => sum + f.file.size, 0))}
          </div>
        </div>
      )}

      <div style={{ fontSize: 9, color: 'var(--pc-text-muted)', padding: '5px 9px', borderRadius: 7, background: 'var(--p7-color-surface-muted)', border: '1px solid var(--p7-color-border)' }}>
        Демо-контур: файлы хранятся локально. В боевом контуре — S3/Minio с шифрованием и привязкой к пробе в базе данных.
      </div>
    </div>
  );
}
