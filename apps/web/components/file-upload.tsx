'use client';

import { useState } from 'react';

export function FileUpload({ onSelect }: { onSelect?: (file: File | null) => void }) {
  const [name, setName] = useState('');
  return (
    <label className="field">
      <span>Файл</span>
      <input type="file" onChange={(e) => { const file = e.target.files?.[0] || null; setName(file?.name || ''); onSelect?.(file); }} />
      {name ? <div className="muted tiny" style={{ marginTop: 6 }}>{name}</div> : null}
    </label>
  );
}
