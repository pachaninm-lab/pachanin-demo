'use client';

import { useState } from 'react';

type SignState = 'idle' | 'plugin_check' | 'cert_select' | 'signing' | 'done' | 'error';

interface CertStub {
  id: string;
  subject: string;
  issuer: string;
  validTo: string;
  thumbprint: string;
}

const DEMO_CERTS: CertStub[] = [
  {
    id: 'cert-001',
    subject: 'ООО «АгроТамбов» · Петров А.Н.',
    issuer: 'ФНС России УЦ',
    validTo: '2025-03-01',
    thumbprint: 'A4:F2:88:12:CC:BE:90:3D:44:2A:11:EF:72:BA:99:01',
  },
  {
    id: 'cert-002',
    subject: 'ООО «АгроТамбов» · ЭЦП организации',
    issuer: 'Тинькофф Банк УЦ',
    validTo: '2025-12-15',
    thumbprint: 'B9:01:44:AA:F3:CE:21:6D:88:5C:22:EF:80:BA:CC:02',
  },
];

interface Props {
  documentId: string;
  documentName: string;
  onSigned?: (thumbprint: string, signedAt: string) => void;
}

export function CryptoProSignStub({ documentId, documentName, onSigned }: Props) {
  const [state, setState] = useState<SignState>('idle');
  const [selectedCert, setSelectedCert] = useState<CertStub | null>(null);
  const [signedAt, setSignedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function startSigning() {
    setState('plugin_check');
    await delay(600);
    setState('cert_select');
  }

  async function signWithCert(cert: CertStub) {
    setSelectedCert(cert);
    setState('signing');
    await delay(1200);
    const at = new Date().toISOString();
    setSignedAt(at);
    setState('done');
    onSigned?.(cert.thumbprint, at);
  }

  function reset() {
    setState('idle');
    setSelectedCert(null);
    setSignedAt(null);
    setError(null);
  }

  return (
    <div style={{ display: 'grid', gap: '0.75rem', padding: '0.875rem', borderRadius: 12, border: '1px solid rgba(124,58,237,0.2)', background: 'rgba(124,58,237,0.04)' }}>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
        <span style={{ fontSize: 18 }}>🔐</span>
        <div>
          <div style={{ fontSize: 12, fontWeight: 800, color: '#7C3AED' }}>Квалифицированная электронная подпись (КЭП)</div>
          <div style={{ fontSize: 10, color: '#64748B' }}>Через Крипто-Про · {documentName}</div>
        </div>
      </div>

      {state === 'idle' && (
        <button
          onClick={startSigning}
          style={{ fontSize: 12, fontWeight: 800, padding: '10px 18px', borderRadius: 10, cursor: 'pointer', border: 'none', background: '#7C3AED', color: '#fff', width: 'fit-content' }}
        >
          Подписать документ
        </button>
      )}

      {state === 'plugin_check' && (
        <div style={infoRow()}>
          <Spinner />
          <span style={{ fontSize: 12, color: '#64748B' }}>Проверка плагина Крипто-Про CSP…</span>
        </div>
      )}

      {state === 'cert_select' && (
        <div style={{ display: 'grid', gap: '0.5rem' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#0F1419' }}>Выберите сертификат:</div>
          {DEMO_CERTS.map((cert) => (
            <button
              key={cert.id}
              onClick={() => signWithCert(cert)}
              style={{ textAlign: 'left', padding: '0.625rem 0.75rem', borderRadius: 10, cursor: 'pointer', border: '1px solid rgba(124,58,237,0.25)', background: '#fff', display: 'grid', gap: 3 }}
            >
              <div style={{ fontSize: 12, fontWeight: 800, color: '#0F1419' }}>{cert.subject}</div>
              <div style={{ fontSize: 10, color: '#64748B' }}>Издатель: {cert.issuer}</div>
              <div style={{ fontSize: 10, color: '#64748B' }}>Действителен до: {cert.validTo}</div>
              <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: '#94A3B8' }}>{cert.thumbprint}</div>
            </button>
          ))}
        </div>
      )}

      {state === 'signing' && (
        <div style={infoRow()}>
          <Spinner />
          <span style={{ fontSize: 12, color: '#64748B' }}>Формирование подписи… не закрывайте вкладку</span>
        </div>
      )}

      {state === 'done' && selectedCert && signedAt && (
        <div style={{ display: 'grid', gap: '0.5rem', padding: '0.75rem', borderRadius: 10, background: 'rgba(10,122,95,0.08)', border: '1px solid rgba(10,122,95,0.2)' }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: '#0A7A5F' }}>✓ Документ подписан</div>
          <div style={{ fontSize: 11, color: '#374151' }}>Подписант: <strong>{selectedCert.subject}</strong></div>
          <div style={{ fontSize: 11, color: '#374151' }}>Время: {new Date(signedAt).toLocaleString('ru-RU')}</div>
          <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: '#64748B' }}>
            Отпечаток: {selectedCert.thumbprint}
          </div>
          <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: '#64748B' }}>
            Документ: {documentId}
          </div>
          <button onClick={reset} style={{ fontSize: 10, fontWeight: 700, padding: '4px 10px', borderRadius: 8, cursor: 'pointer', border: '1px solid rgba(10,122,95,0.3)', background: 'transparent', color: '#0A7A5F', width: 'fit-content', marginTop: 4 }}>
            Подписать другим сертификатом
          </button>
        </div>
      )}

      {error && (
        <div style={{ fontSize: 12, color: '#B91C1C', padding: '0.5rem', borderRadius: 8, background: 'rgba(220,38,38,0.06)' }}>
          Ошибка: {error}
        </div>
      )}

      <div style={{ fontSize: 9, color: 'var(--pc-text-muted)' }}>
        Демо-заглушка. В боевом контуре — Крипто-Про CSP 5.0 + плагин для браузера, ГОСТ Р 34.10-2012, ФНС УЦ.
      </div>
    </div>
  );
}

function infoRow() {
  return { display: 'flex', gap: '0.5rem', alignItems: 'center' } as const;
}

function delay(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}

function Spinner() {
  return (
    <div style={{
      width: 14, height: 14, borderRadius: '50%', flexShrink: 0,
      border: '2px solid rgba(124,58,237,0.2)',
      borderTopColor: '#7C3AED',
      animation: 'spin 0.8s linear infinite',
    }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
