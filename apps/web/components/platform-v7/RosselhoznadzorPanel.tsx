'use client';

import { useState } from 'react';

type CertStatus = 'issued' | 'pending' | 'rejected' | 'expired';

interface PhytoCertificate {
  id: string;
  certNumber: string;
  dealId: string;
  culture: string;
  volumeTons: number;
  fromRegion: string;
  toCountry: string;
  issuedAt: string | null;
  expiresAt: string | null;
  status: CertStatus;
  inspection: string;
  qualityParams: { name: string; value: string; norm: string; ok: boolean }[];
}

const STATUS_CONFIG: Record<CertStatus, { label: string; bg: string; color: string }> = {
  issued:   { label: 'Выдан',      bg: '#D1FAE5', color: '#065F46' },
  pending:  { label: 'На оформлении', bg: '#FEF3C7', color: '#92400E' },
  rejected: { label: 'Отказ',      bg: '#FEE2E2', color: '#991B1B' },
  expired:  { label: 'Истёк',      bg: '#F1F5F9', color: '#64748B' },
};

const DEMO_CERTS: PhytoCertificate[] = [
  {
    id: 'pc-001',
    certNumber: 'ФС-77-2024-0089',
    dealId: 'DL-9095',
    culture: 'Пшеница 3 кл',
    volumeTons: 4320,
    fromRegion: 'Тамбовская обл.',
    toCountry: 'Турция',
    issuedAt: '2024-01-14T15:00:00Z',
    expiresAt: '2024-07-14T00:00:00Z',
    status: 'issued',
    inspection: 'Управление Россельхознадзора по Тамбовской обл.',
    qualityParams: [
      { name: 'Клейковина', value: '24%', norm: '≥ 23%', ok: true },
      { name: 'Влажность', value: '12.4%', norm: '≤ 14.0%', ok: true },
      { name: 'Натура', value: '772 г/л', norm: '≥ 730 г/л', ok: true },
      { name: 'Сорная примесь', value: '0.8%', norm: '≤ 2.0%', ok: true },
      { name: 'Зерновая примесь', value: '1.2%', norm: '≤ 5.0%', ok: true },
      { name: 'Микотоксины (ДОН)', value: '0.4 мг/кг', norm: '≤ 1.0 мг/кг', ok: true },
    ],
  },
  {
    id: 'pc-002',
    certNumber: 'ФС-23-2024-0341',
    dealId: 'DL-9110',
    culture: 'Кукуруза',
    volumeTons: 1840,
    fromRegion: 'Воронежская обл.',
    toCountry: 'Египет',
    issuedAt: null,
    expiresAt: null,
    status: 'pending',
    inspection: 'Управление Россельхознадзора по Воронежской обл.',
    qualityParams: [
      { name: 'Влажность', value: '13.1%', norm: '≤ 14.0%', ok: true },
      { name: 'Сорная примесь', value: '1.5%', norm: '≤ 2.0%', ok: true },
      { name: 'Зерновая примесь', value: '3.2%', norm: '≤ 5.0%', ok: true },
      { name: 'Афлатоксин B1', value: '3.2 мкг/кг', norm: '≤ 2.0 мкг/кг', ok: false },
    ],
  },
  {
    id: 'pc-003',
    certNumber: 'ФС-08-2024-0012',
    dealId: 'DL-9088',
    culture: 'Ячмень 2 кл',
    volumeTons: 2160,
    fromRegion: 'Ставропольский кр.',
    toCountry: 'Иран',
    issuedAt: '2024-02-08T12:00:00Z',
    expiresAt: '2024-08-08T00:00:00Z',
    status: 'issued',
    inspection: 'Управление Россельхознадзора по Ставропольскому кр.',
    qualityParams: [
      { name: 'Влажность', value: '11.8%', norm: '≤ 14.0%', ok: true },
      { name: 'Натура', value: '618 г/л', norm: '≥ 590 г/л', ok: true },
      { name: 'Сорная примесь', value: '0.6%', norm: '≤ 2.0%', ok: true },
    ],
  },
];

const lbl: React.CSSProperties = { fontSize: 10, fontWeight: 900, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em' };

export function RosselhoznadzorPanel() {
  const [selected, setSelected] = useState<string | null>(null);
  const cert = DEMO_CERTS.find((c) => c.id === selected);

  const issued = DEMO_CERTS.filter((c) => c.status === 'issued').length;
  const issues = DEMO_CERTS.flatMap((c) => c.qualityParams.filter((p) => !p.ok)).length;

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 8 }}>
        {[
          { label: 'Сертификатов', value: DEMO_CERTS.length, color: '#0F1419' },
          { label: 'Выдано', value: issued, color: '#0A7A5F' },
          { label: 'Несоответствий', value: issues, color: issues > 0 ? '#DC2626' : '#0A7A5F' },
          { label: 'На оформлении', value: DEMO_CERTS.filter((c) => c.status === 'pending').length, color: '#D97706' },
        ].map((s) => (
          <div key={s.label} style={{ padding: '10px 12px', borderRadius: 10, background: '#F8FAFB', border: '1px solid #E4E6EA' }}>
            <div style={lbl}>{s.label}</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: s.color, marginTop: 4 }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Cert list */}
      <div style={{ display: 'grid', gap: 8 }}>
        {DEMO_CERTS.map((c) => {
          const cfg = STATUS_CONFIG[c.status];
          const isSelected = selected === c.id;
          const badParams = c.qualityParams.filter((p) => !p.ok);
          return (
            <div key={c.id} style={{ borderRadius: 12, border: `1px solid ${isSelected ? '#0A7A5F' : '#E4E6EA'}`, background: isSelected ? '#F0FDF4' : '#F8FAFB', overflow: 'hidden' }}>
              <button
                onClick={() => setSelected(isSelected ? null : c.id)}
                style={{ width: '100%', padding: '12px 14px', display: 'flex', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <code style={{ fontSize: 11, fontFamily: 'monospace', color: '#0F1419', fontWeight: 700 }}>{c.certNumber}</code>
                    <span style={{ fontSize: 9, fontWeight: 800, padding: '2px 7px', borderRadius: 999, background: cfg.bg, color: cfg.color }}>{cfg.label}</span>
                    {badParams.length > 0 && <span style={{ fontSize: 9, fontWeight: 800, color: '#DC2626', background: '#FEE2E2', padding: '2px 6px', borderRadius: 4 }}>⚠ {badParams.length} несоотв.</span>}
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#0F1419', marginTop: 4 }}>{c.culture} · {c.volumeTons.toLocaleString('ru-RU')} т · {c.fromRegion} → {c.toCountry}</div>
                  <div style={{ fontSize: 10, color: '#64748B', marginTop: 2 }}>{c.inspection}</div>
                </div>
                <div style={{ fontSize: 10, color: '#94A3B8', textAlign: 'right', flexShrink: 0 }}>
                  <a href={`/platform-v7/deals/${c.dealId}/clean`} onClick={(e) => e.stopPropagation()} style={{ color: '#0A7A5F', textDecoration: 'none', fontFamily: 'monospace', fontWeight: 700 }}>{c.dealId}</a>
                  <br />
                  {c.issuedAt ? new Date(c.issuedAt).toLocaleDateString('ru-RU') : '—'}
                </div>
              </button>

              {isSelected && (
                <div style={{ borderTop: '1px solid #E4E6EA', padding: '12px 14px', background: '#fff', display: 'grid', gap: 10 }}>
                  {c.expiresAt && (
                    <div style={{ fontSize: 11, color: '#0A7A5F', fontWeight: 700 }}>
                      Действителен до: {new Date(c.expiresAt).toLocaleDateString('ru-RU')}
                    </div>
                  )}
                  <div>
                    <div style={{ ...lbl, marginBottom: 6 }}>Показатели качества</div>
                    <div style={{ display: 'grid', gap: 4 }}>
                      {c.qualityParams.map((p) => (
                        <div key={p.name} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '5px 8px', borderRadius: 6, background: p.ok ? '#F0FDF4' : '#FEF2F2', border: `1px solid ${p.ok ? '#BBF7D0' : '#FECACA'}` }}>
                          <span style={{ fontSize: 12, flexShrink: 0 }}>{p.ok ? '✓' : '✗'}</span>
                          <span style={{ fontSize: 11, fontWeight: 700, flex: 1, color: '#0F1419' }}>{p.name}</span>
                          <span style={{ fontSize: 11, fontWeight: 800, color: p.ok ? '#065F46' : '#DC2626', minWidth: 80, textAlign: 'right' }}>{p.value}</span>
                          <span style={{ fontSize: 9, color: '#94A3B8', minWidth: 80 }}>норма: {p.norm}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button style={{ fontSize: 10, padding: '4px 10px', borderRadius: 6, border: '1px solid #E4E6EA', background: '#fff', cursor: 'pointer', color: '#374151', fontWeight: 700 }}>
                      Сертификат PDF
                    </button>
                    <button style={{ fontSize: 10, padding: '4px 10px', borderRadius: 6, border: '1px solid #E4E6EA', background: '#fff', cursor: 'pointer', color: '#374151', fontWeight: 700 }}>
                      Протокол качества
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ fontSize: 9, color: '#94A3B8', padding: '4px 8px', borderRadius: 6, background: '#F8FAFB', border: '1px solid #E4E6EA' }}>
        Россельхознадзор · ФГИС «Меркурий» + «Аргус-ФТО» · Нормы: ГОСТ Р 52554-2006, ТР ТС 015/2011 · Интеграция требует доступа к ФГИС · Демо-данные.
      </div>
    </div>
  );
}
