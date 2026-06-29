'use client';

import { useState } from 'react';

interface EvidenceFile {
  id: string;
  name: string;
  type: 'contract' | 'act' | 'sdiz' | 'etrn' | 'bank' | 'quality' | 'audit' | 'photo';
  sizeKb: number;
  hash: string;
  signedAt: string | null;
  signer: string | null;
}

interface EvidenceBundle {
  dealId: string;
  dealStatus: string;
  createdAt: string;
  hashChain: string;
  files: EvidenceFile[];
}

const TYPE_CONFIG: Record<EvidenceFile['type'], { label: string; icon: string; color: string }> = {
  contract: { label: 'Договор',         icon: '📄', color: '#2563EB' },
  act:      { label: 'Акт приёмки',     icon: '✅', color: '#0A7A5F' },
  sdiz:     { label: 'СДИЗ',            icon: '🌾', color: '#059669' },
  etrn:     { label: 'ЭТрН',            icon: '🚛', color: '#7C3AED' },
  bank:     { label: 'Банк · выплата',  icon: '🏦', color: '#0891B2' },
  quality:  { label: 'Протокол качества', icon: '🔬', color: '#D97706' },
  audit:    { label: 'Аудит-лог',       icon: '📋', color: '#64748B' },
  photo:    { label: 'Фото/видео',      icon: '📷', color: '#EC4899' },
};

const DEMO_BUNDLE: EvidenceBundle = {
  dealId: 'DL-9095',
  dealStatus: 'Закрыт',
  createdAt: '2024-01-25T14:30:00Z',
  hashChain: 'sha256:a3f8b2c1d7e4f0a9b8c7d6e5f4a3b2c1d0e9f8a7b6c5d4e3f2a1b0c9d8e7f6',
  files: [
    { id: 'f-001', name: 'Договор купли-продажи зерна № КП-2024-0195.pdf', type: 'contract', sizeKb: 284, hash: 'sha256:e3b0c44298fc1c149afb', signedAt: '2024-01-10T10:15:00Z', signer: 'ООО АгроТрейд Юг + ЗернэкспортТрейд' },
    { id: 'f-002', name: 'СДИЗ-2024-LOT2401.xml', type: 'sdiz', sizeKb: 42, hash: 'sha256:d9146bf6bf5c4c5fb1e8', signedAt: '2024-01-10T11:00:00Z', signer: 'ФГИС Зерно · авто' },
    { id: 'f-003', name: 'ЭТрН-ТМБ-2024-039.xml', type: 'etrn', sizeKb: 38, hash: 'sha256:7f83b1657ff1fc53b92d', signedAt: '2024-01-15T08:30:00Z', signer: 'ИП Кравцов В.Е.' },
    { id: 'f-004', name: 'Акт-приёмки-ELV-TMB-2024.pdf', type: 'act', sizeKb: 156, hash: 'sha256:2c624232cdd221771294', signedAt: '2024-01-18T16:00:00Z', signer: 'Элеватор ТМБ-03' },
    { id: 'f-005', name: 'Протокол-качества-LAB-2024-0089.pdf', type: 'quality', sizeKb: 98, hash: 'sha256:b14a7b8059d9c055954c', signedAt: '2024-01-18T12:00:00Z', signer: 'ФГБУ ЦОКАПК' },
    { id: 'f-006', name: 'Банк-выписка-CB-443-release.pdf', type: 'bank', sizeKb: 64, hash: 'sha256:f1d2d2f924e986ac86fd', signedAt: '2024-01-20T09:00:00Z', signer: 'Сбер Безопасные Сделки' },
    { id: 'f-007', name: 'audit-log-DL-9095-full.json', type: 'audit', sizeKb: 312, hash: 'sha256:acbd18db4cc2f85cedef', signedAt: null, signer: null },
    { id: 'f-008', name: 'photos-elevator-acceptance.zip', type: 'photo', sizeKb: 8240, hash: 'sha256:37b51d194a7513e45b56', signedAt: null, signer: null },
  ],
};

const lbl: React.CSSProperties = { fontSize: 10, fontWeight: 900, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em' };

function maskHash(h: string) {
  return h.slice(0, 14) + '·····' + h.slice(-6);
}

function fmtSize(kb: number) {
  if (kb >= 1024) return `${(kb / 1024).toFixed(1)} МБ`;
  return `${kb} КБ`;
}

export function EvidenceBundlePanel() {
  const [dealId, setDealId] = useState('DL-9095');
  const [exporting, setExporting] = useState(false);
  const [exported, setExported] = useState(false);

  function handleExport() {
    setExporting(true);
    setTimeout(() => { setExporting(false); setExported(true); }, 1800);
  }

  const bundle = DEMO_BUNDLE;
  const signedCount = bundle.files.filter((f) => f.signedAt).length;
  const totalSizeKb = bundle.files.reduce((s, f) => s + f.sizeKb, 0);

  const inp: React.CSSProperties = { padding: '7px 10px', borderRadius: 8, border: '1px solid #E4E6EA', fontSize: 13, fontWeight: 700, color: '#0F1419', background: '#F8FAFB', outline: 'none' };

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      {/* Deal selector */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ ...lbl }}>Сделка</div>
        <input
          value={dealId}
          onChange={(e) => setDealId(e.target.value)}
          style={{ ...inp, width: 120 }}
          placeholder="DL-XXXX"
        />
        <span style={{ fontSize: 10, padding: '4px 10px', borderRadius: 999, background: '#D1FAE5', color: '#065F46', fontWeight: 700 }}>{bundle.dealStatus}</span>
        <span style={{ fontSize: 10, color: '#94A3B8' }}>{new Date(bundle.createdAt).toLocaleDateString('ru-RU')}</span>
      </div>

      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(110px,1fr))', gap: 8 }}>
        {[
          { label: 'Файлов', value: bundle.files.length },
          { label: 'С подписью УКЭП', value: signedCount },
          { label: 'Общий размер', value: fmtSize(totalSizeKb) },
          { label: 'Хэш-цепочка', value: '✓ Верна' },
        ].map((s) => (
          <div key={s.label} style={{ padding: '10px 12px', borderRadius: 10, background: '#F8FAFB', border: '1px solid #E4E6EA' }}>
            <div style={lbl}>{s.label}</div>
            <div style={{ fontSize: typeof s.value === 'number' ? 20 : 13, fontWeight: 900, color: s.label === 'Хэш-цепочка' ? '#0A7A5F' : '#0F1419', marginTop: 4 }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Hash chain */}
      <div style={{ padding: '10px 14px', borderRadius: 10, background: '#F0FDF4', border: '1px solid #BBF7D0', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 10, fontWeight: 900, color: '#0A7A5F' }}>HASH CHAIN ROOT</span>
        <code style={{ fontSize: 10, fontFamily: 'monospace', color: '#0F1419', flex: 1 }}>{maskHash(bundle.hashChain)}</code>
        <span style={{ fontSize: 9, color: '#059669', fontWeight: 700 }}>✓ SHA-256 · append-only</span>
      </div>

      {/* File list */}
      <div style={{ display: 'grid', gap: 6 }}>
        {bundle.files.map((file) => {
          const cfg = TYPE_CONFIG[file.type];
          return (
            <div key={file.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 12px', borderRadius: 10, border: '1px solid #E4E6EA', background: '#fff' }}>
              <span style={{ fontSize: 18, flexShrink: 0 }}>{cfg.icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 9, fontWeight: 800, padding: '2px 6px', borderRadius: 4, background: cfg.color + '18', color: cfg.color }}>{cfg.label}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#0F1419', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 260 }}>{file.name}</span>
                </div>
                <div style={{ marginTop: 4, display: 'flex', gap: 8, flexWrap: 'wrap', fontSize: 9, color: '#94A3B8' }}>
                  <span>{fmtSize(file.sizeKb)}</span>
                  <code style={{ fontFamily: 'monospace' }}>{maskHash(file.hash)}</code>
                  {file.signedAt && <span style={{ color: '#0A7A5F', fontWeight: 700 }}>✓ УКЭП · {new Date(file.signedAt).toLocaleDateString('ru-RU')}</span>}
                  {file.signer && <span>{file.signer}</span>}
                </div>
              </div>
              <button style={{ fontSize: 9, padding: '3px 8px', borderRadius: 6, border: '1px solid #E4E6EA', background: '#F8FAFB', cursor: 'pointer', color: '#64748B', fontWeight: 700, flexShrink: 0 }}>
                PDF
              </button>
            </div>
          );
        })}
      </div>

      {/* Export buttons */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {!exported ? (
          <button
            onClick={handleExport}
            disabled={exporting}
            style={{ padding: '8px 18px', borderRadius: 10, border: 'none', background: '#0A7A5F', color: '#fff', cursor: exporting ? 'wait' : 'pointer', fontSize: 12, fontWeight: 800, opacity: exporting ? 0.7 : 1 }}
          >
            {exporting ? '⏳ Формируется Evidence ZIP...' : '⬇ Скачать Evidence Bundle (ZIP)'}
          </button>
        ) : (
          <div style={{ padding: '8px 16px', borderRadius: 10, background: '#F0FDF4', border: '1px solid #BBF7D0', fontSize: 12, fontWeight: 700, color: '#065F46' }}>
            ✓ evidence-DL-9095-{new Date().toISOString().slice(0, 10)}.zip — {fmtSize(totalSizeKb)} · SHA-256 подтверждён
          </div>
        )}
        <button style={{ padding: '8px 14px', borderRadius: 10, border: '1px solid #E4E6EA', background: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: '#374151' }}>
          PDF-отчёт по сделке
        </button>
        <button style={{ padding: '8px 14px', borderRadius: 10, border: '1px solid #E4E6EA', background: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: '#374151' }}>
          Audit CSV
        </button>
      </div>

      <div style={{ fontSize: 9, color: '#94A3B8', padding: '4px 8px', borderRadius: 6, background: '#F8FAFB', border: '1px solid #E4E6EA' }}>
        Evidence Bundle: хэш-цепочка SHA-256 + УКЭП документы + аудит-лог append-only · PDF/ZIP экспорт · Подтверждается при арбитраже · Хранение 5 лет (S3 WORM) · Демо-данные.
      </div>
    </div>
  );
}
