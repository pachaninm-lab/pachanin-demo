'use client';

import * as React from 'react';

interface PhotoUploadProps {
  onChange?: (files: File[]) => void;
  required?: boolean;
  label?: string;
  maxSizeMb?: number; // default 1
}

async function compressImage(file: File, maxSizeMb: number): Promise<File> {
  const maxBytes = maxSizeMb * 1024 * 1024;

  const tryCompress = (quality: number): Promise<Blob | null> =>
    new Promise((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) { resolve(null); return; }
        ctx.drawImage(img, 0, 0);
        canvas.toBlob((blob) => resolve(blob), 'image/jpeg', quality);
      };
      img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
      img.src = url;
    });

  // Skip compression for non-image or already-small files
  if (!file.type.startsWith('image/') || file.size <= maxBytes) return file;

  let blob = await tryCompress(0.82);
  if (blob && blob.size > maxBytes) {
    blob = await tryCompress(0.65);
  }

  if (!blob) return file;
  return new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' });
}

export function PhotoUpload({ onChange, required, label, maxSizeMb = 1 }: PhotoUploadProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [photos, setPhotos] = React.useState<File[]>([]);
  const [previews, setPreviews] = React.useState<string[]>([]);
  const [showError, setShowError] = React.useState(false);
  const [isDragging, setIsDragging] = React.useState(false);

  // Revoke object URLs on unmount or when previews change
  React.useEffect(() => {
    return () => {
      previews.forEach((url) => URL.revokeObjectURL(url));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addFiles = React.useCallback(
    async (rawFiles: FileList | File[]) => {
      const fileArr = Array.from(rawFiles).filter((f) => f.type.startsWith('image/'));
      if (fileArr.length === 0) return;

      const compressed = await Promise.all(fileArr.map((f) => compressImage(f, maxSizeMb)));

      setPhotos((prev) => {
        const next = [...prev, ...compressed];
        onChange?.(next);
        return next;
      });
      setPreviews((prev) => [...prev, ...compressed.map((f) => URL.createObjectURL(f))]);
      setShowError(false);
    },
    [maxSizeMb, onChange]
  );

  // Clipboard paste
  React.useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const files = e.clipboardData?.files;
      if (files && files.length > 0) {
        addFiles(files);
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [addFiles]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(e.target.files);
      // Reset input so the same file can be re-added if removed
      e.target.value = '';
    }
  };

  const handleRemove = (index: number) => {
    URL.revokeObjectURL(previews[index]);
    setPhotos((prev) => {
      const next = prev.filter((_, i) => i !== index);
      onChange?.(next);
      if (required && next.length === 0) setShowError(true);
      return next;
    });
    setPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files);
    }
  };

  const handleZoneClick = () => inputRef.current?.click();

  const hasError = required && photos.length === 0 && showError;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {label && (
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--pc-text)' }}>
          {label}
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        style={{ display: 'none' }}
        onChange={handleInputChange}
      />

      {/* Drop zone */}
      <div
        onClick={handleZoneClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        style={{
          border: `1px dashed ${hasError ? 'var(--pc-error, #dc2626)' : isDragging ? 'var(--pc-accent)' : 'var(--pc-border)'}`,
          borderRadius: 16,
          background: isDragging ? 'var(--pc-bg-hover, rgba(0,0,0,0.04))' : 'var(--pc-bg-card)',
          padding: '24px 16px',
          cursor: 'pointer',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 8,
          transition: 'border-color 0.15s, background 0.15s',
          userSelect: 'none',
        }}
      >
        <svg
          width={32}
          height={32}
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--pc-text-muted, #9ca3af)"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
        <span style={{ fontSize: 13, color: 'var(--pc-text-muted)', textAlign: 'center' }}>
          Нажмите или перетащите фото
          <br />
          <span style={{ fontSize: 11 }}>или вставьте из буфера обмена (Ctrl+V)</span>
        </span>
      </div>

      {/* Preview grid */}
      {previews.length > 0 && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 8,
          }}
        >
          {previews.map((src, i) => (
            <div
              key={src}
              style={{
                position: 'relative',
                width: 80,
                height: 80,
                borderRadius: 10,
                overflow: 'hidden',
                border: '1px solid var(--pc-border)',
                flexShrink: 0,
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt={`Фото ${i + 1}`}
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); handleRemove(i); }}
                style={{
                  position: 'absolute',
                  top: 4,
                  right: 4,
                  width: 20,
                  height: 20,
                  borderRadius: '50%',
                  background: 'rgba(0,0,0,0.6)',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 0,
                  color: '#fff',
                  fontSize: 11,
                  lineHeight: 1,
                  fontWeight: 700,
                }}
                aria-label="Удалить фото"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Error message */}
      {hasError && (
        <div style={{ fontSize: 12, color: 'var(--pc-error, #dc2626)', marginTop: -4 }}>
          Добавьте минимум 1 фото пломбы
        </div>
      )}
    </div>
  );
}
