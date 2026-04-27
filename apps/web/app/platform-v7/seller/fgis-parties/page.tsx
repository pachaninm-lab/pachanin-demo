'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  SANDBOX_FGIS_PARTIES,
  SANDBOX_LOT_PASSPORTS,
  canCreateLotPassport,
  type FGISParty,
  type FGISPartyBatch,
  type FGISPartyStatus,
} from '@/lib/platform-v7/fgis-lot-passport';

// ─── palette ────────────────────────────────────────────────────────────────
const S = 'var(--pc-bg-card)';
const SS = 'var(--pc-bg-elevated)';
const B = 'var(--pc-border)';
const T = 'var(--pc-text-primary)';
const M = 'var(--pc-text-secondary)';
const BRAND = '#0A7A5F';
const BRAND_BG = 'rgba(10,122,95,0.08)';
const BRAND_BORDER = 'rgba(10,122,95,0.18)';
const WARN_BG = 'rgba(217,119,6,0.08)';
const WARN_BORDER = 'rgba(217,119,6,0.18)';
const WARN = '#B45309';
const ERR_BG = 'rgba(220,38,38,0.08)';
const ERR_BORDER = 'rgba(220,38,38,0.18)';
const ERR = '#B91C1C';

// ─── helpers ────────────────────────────────────────────────────────────────

function statusTone(s: FGISPartyStatus) {
  if (s === 'verified') return { bg: BRAND_BG, border: BRAND_BORDER, color: BRAND, label: 'Подтверждено ФГИС' };
  if (s === 'pending_sync') return { bg: WARN_BG, border: WARN_BORDER, color: WARN, label: 'Синхронизация…' };
  if (s === 'sync_error') return { bg: ERR_BG, border: ERR_BORDER, color: ERR, label: 'Ошибка синхронизации' };
  if (s === 'manual_mode') return { bg: WARN_BG, border: WARN_BORDER, color: WARN, label: 'Ручной режим' };
  return { bg: ERR_BG, border: ERR_BORDER, color: ERR, label: 'Заблокировано' };
}

function btn(kind: 'primary' | 'default' = 'default'): React.CSSProperties {
  if (kind === 'primary') return { textDecoration: 'none', borderRadius: 12, padding: '10px 14px', background: BRAND_BG, border: `1px solid ${BRAND_BORDER}`, color: BRAND, fontSize: 13, fontWeight: 700, cursor: 'pointer' };
  return { textDecoration: 'none', borderRadius: 12, padding: '10px 14px', background: SS, border: `1px solid ${B}`, color: T, fontSize: 13, fontWeight: 700, cursor: 'pointer' };
}

// ─── component ──────────────────────────────────────────────────────────────

export default function SellerFgisPartiesPage() {
  const [expanded, setExpanded] = React.useState<string | null>(null);
  const parties = SANDBOX_FGIS_PARTIES;
  const lotPassportCount = SANDBOX_LOT_PASSPORTS.length;

  return (
    <div style={{ display: 'grid', gap: 18, padding: '8px 0' }}>
      {/* Header */}
      <section style={{ background: S, border: `1px solid ${B}`, borderRadius: 18, padding: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 11, color: M, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              ФГИС ЗЕРНО · <span style={{ color: WARN }}>sandbox</span>
            </div>
            <div style={{ fontSize: 26, fontWeight: 900, color: T, marginTop: 8, lineHeight: 1.1 }}>Мои партии из ФГИС</div>
            <div style={{ marginTop: 8, fontSize: 14, color: M, maxWidth: 700 }}>
              Подключите вашу организацию к ФГИС ЗЕРНО, чтобы видеть зарегистрированные партии и создавать лоты напрямую из подтверждённых данных.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Link href='/platform-v7/lots/create' style={btn()}>Создать лот вручную</Link>
            <Link href='/platform-v7/seller' style={btn()}>← Назад</Link>
          </div>
        </div>

        <div style={{ marginTop: 14, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Chip label={`${parties.length} организации`} />
          <Chip label={`${parties.reduce((s, p) => s + p.batches.length, 0)} партий`} />
          <Chip label={`${lotPassportCount} паспортов лотов`} />
          <Chip label='Интеграция: sandbox' tone='warn' />
        </div>
      </section>

      {/* Sandbox notice */}
      <SandboxNotice />

      {/* Party cards */}
      {parties.map((party) => (
        <PartyCard
          key={party.id}
          party={party}
          isExpanded={expanded === party.id}
          onToggle={() => setExpanded((prev) => (prev === party.id ? null : party.id))}
        />
      ))}
    </div>
  );
}

// ─── sub-components ──────────────────────────────────────────────────────────

function SandboxNotice() {
  return (
    <section style={{ background: WARN_BG, border: `1px solid ${WARN_BORDER}`, borderRadius: 14, padding: 14 }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: WARN, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        Режим: sandbox
      </div>
      <div style={{ marginTop: 6, fontSize: 13, color: T, lineHeight: 1.5 }}>
        Данные демонстрационные. Реальных запросов к ФГИС ЗЕРНО не выполняется. В production-режиме синхронизация идёт через SOAP API ФГИС с XMLDSig-подписью.
        Лоты, созданные в sandbox, не попадают в реестр.
      </div>
    </section>
  );
}

function Chip({ label, tone = 'neutral' }: { label: string; tone?: 'neutral' | 'warn' }) {
  const style: React.CSSProperties = {
    display: 'inline-block',
    padding: '4px 10px',
    borderRadius: 99,
    fontSize: 11,
    fontWeight: 700,
    border: `1px solid ${tone === 'warn' ? WARN_BORDER : B}`,
    background: tone === 'warn' ? WARN_BG : SS,
    color: tone === 'warn' ? WARN : M,
  };
  return <span style={style}>{label}</span>;
}

function PartyCard({
  party,
  isExpanded,
  onToggle,
}: {
  party: FGISParty;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const tone = statusTone(party.status);
  const canCreate = canCreateLotPassport(party);
  const totalTons = party.batches.reduce((s, b) => s + b.volumeTons, 0);

  return (
    <section style={{ background: S, border: `1px solid ${B}`, borderRadius: 18, overflow: 'hidden' }}>
      {/* Party header */}
      <div
        onClick={onToggle}
        style={{ padding: 18, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}
      >
        <div>
          <div style={{ fontSize: 16, fontWeight: 800, color: T }}>{party.orgName}</div>
          <div style={{ fontSize: 12, color: M, marginTop: 4 }}>
            ИНН {party.inn} · {party.region} · {party.batches.length} партий · {totalTons} т
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ padding: '4px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700, background: tone.bg, border: `1px solid ${tone.border}`, color: tone.color }}>
            {tone.label}
          </span>
          {party.lastSyncAt && (
            <span style={{ fontSize: 11, color: M }}>
              Синхр: {new Date(party.lastSyncAt).toLocaleDateString('ru-RU')}
            </span>
          )}
          <span style={{ fontSize: 18, color: M, userSelect: 'none' }}>{isExpanded ? '▲' : '▼'}</span>
        </div>
      </div>

      {/* Expanded batches */}
      {isExpanded && (
        <div style={{ borderTop: `1px solid ${B}`, padding: 18 }}>
          {party.status === 'sync_error' && party.batches[0]?.syncError && (
            <div style={{ marginBottom: 12, background: ERR_BG, border: `1px solid ${ERR_BORDER}`, borderRadius: 10, padding: 12, fontSize: 13, color: ERR }}>
              {party.batches[0].syncError}
            </div>
          )}
          <div style={{ fontSize: 12, color: M, fontWeight: 800, textTransform: 'uppercase', marginBottom: 10 }}>Партии</div>
          <div style={{ display: 'grid', gap: 10 }}>
            {party.batches.map((batch) => (
              <BatchRow key={batch.batchId} batch={batch} />
            ))}
          </div>

          {canCreate ? (
            <div style={{ marginTop: 14, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Link href='/platform-v7/lots/create' style={btn('primary')}>
                Создать лот из партии
              </Link>
              <span style={{ alignSelf: 'center', fontSize: 12, color: M }}>Данные ФГИС будут подтянуты автоматически</span>
            </div>
          ) : (
            <div style={{ marginTop: 14, fontSize: 13, color: WARN }}>
              Нельзя создать лот: партия ещё не синхронизирована или заблокирована.
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function BatchRow({ batch }: { batch: FGISPartyBatch }) {
  const tone = statusTone(batch.syncStatus);
  return (
    <div style={{ background: SS, border: `1px solid ${B}`, borderRadius: 12, padding: 14, display: 'grid', gap: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <div>
          <span style={{ fontWeight: 800, color: T, fontSize: 14 }}>{batch.grain}</span>
          <span style={{ marginLeft: 8, fontSize: 13, color: M }}>{batch.volumeTons} т · {batch.harvestYear}</span>
        </div>
        <span style={{ padding: '3px 9px', borderRadius: 99, fontSize: 11, fontWeight: 700, background: tone.bg, border: `1px solid ${tone.border}`, color: tone.color }}>
          {tone.label}
        </span>
      </div>
      {batch.sdizNumber && (
        <div style={{ fontSize: 12, color: M }}>СДИЗ: <span style={{ fontFamily: 'monospace', color: T }}>{batch.sdizNumber}</span></div>
      )}
      {batch.fgisRecordId && (
        <div style={{ fontSize: 12, color: M }}>ФГИС ID: <span style={{ fontFamily: 'monospace', color: T }}>{batch.fgisRecordId}</span></div>
      )}
    </div>
  );
}
