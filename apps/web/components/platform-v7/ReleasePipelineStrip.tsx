import { DEALS } from '@/lib/v7r/data';
import { evaluateReleaseGuard } from '@/lib/platform-v7/domain/release-guard';
import { canonicalDomainDeals } from '@/lib/domain/selectors';

type GateStatus = 'ok' | 'wait' | 'blocked';

interface PipelineGate {
  id: string;
  label: string;
  status: GateStatus;
  note: string;
}

function gateColor(status: GateStatus) {
  if (status === 'ok') return { fg: '#0A7A5F', bg: 'rgba(10,122,95,0.10)', border: 'rgba(10,122,95,0.22)' };
  if (status === 'wait') return { fg: '#B45309', bg: 'rgba(217,119,6,0.08)', border: 'rgba(217,119,6,0.20)' };
  return { fg: '#B91C1C', bg: 'rgba(220,38,38,0.08)', border: 'rgba(220,38,38,0.20)' };
}

function gateIcon(status: GateStatus) {
  if (status === 'ok') return '✓';
  if (status === 'wait') return '○';
  return '✕';
}

export function ReleasePipelineStrip({ dealId = 'DL-9106' }: { dealId?: string }) {
  const deal = DEALS.find((d) => d.id === dealId);
  const domainDeal = canonicalDomainDeals.find((d) => d.id === dealId);
  const guard = domainDeal ? evaluateReleaseGuard(domainDeal) : null;

  const blockers = guard?.blockers ?? [];

  const gates: PipelineGate[] = [
    {
      id: 'fgis',
      label: 'ФГИС',
      status: blockers.includes('FGIS_NOT_READY') ? 'blocked' : 'ok',
      note: 'партия и СДИЗ',
    },
    {
      id: 'lab',
      label: 'Лаб',
      status: blockers.includes('QUALITY_NOT_APPROVED') ? 'blocked' : 'ok',
      note: 'протокол качества',
    },
    {
      id: 'weight',
      label: 'Вес',
      status: blockers.includes('ACCEPTANCE_NOT_CONFIRMED') ? 'blocked' : 'ok',
      note: 'приёмка · вес · акт',
    },
    {
      id: 'edo',
      label: 'ЭДО',
      status: blockers.includes('DOCUMENTS_NOT_READY') ? 'blocked' : 'ok',
      note: 'ЭТрН · УПД · КЭП',
    },
    {
      id: 'dispute',
      label: 'Спор',
      status: blockers.includes('OPEN_DISPUTE') ? 'blocked' : 'ok',
      note: deal?.dispute ? `${deal.dispute.id}` : 'нет споров',
    },
    {
      id: 'bank',
      label: 'Банк',
      status:
        blockers.includes('NO_RESERVED_MONEY') || blockers.includes('HOLD_AMOUNT_ACTIVE')
          ? 'blocked'
          : guard?.canRequestRelease
            ? 'ok'
            : 'wait',
      note: 'проверка основания',
    },
  ];

  const allOk = gates.every((g) => g.status === 'ok');

  return (
    <section style={shell} aria-label={`Конвейер выпуска — ${dealId}`}>
      <div style={header}>
        <span style={dealLabel}>{dealId}</span>
        <span style={{ ...statusPill, ...(allOk ? okPill : blockedPill) }}>
          {allOk ? 'все условия выполнены' : `${gates.filter((g) => g.status === 'blocked').length} заблокировано`}
        </span>
      </div>
      <div style={track}>
        {gates.map((gate, idx) => {
          const c = gateColor(gate.status);
          return (
            <div key={gate.id} style={{ display: 'contents' }}>
              {idx > 0 && (
                <span style={{ ...connector, borderColor: gateColor(gates[idx - 1].status === 'ok' ? 'ok' : 'wait').border }} aria-hidden />
              )}
              <div style={{ ...gateBox, background: c.bg, border: `1px solid ${c.border}` }}>
                <span style={{ fontSize: 12, color: c.fg, fontWeight: 900, lineHeight: 1 }} aria-hidden>
                  {gateIcon(gate.status)}
                </span>
                <span style={gateLabel}>{gate.label}</span>
                <span style={gateNote}>{gate.note}</span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

const shell = {
  background: 'var(--pc-bg-card)',
  border: '1px solid var(--pc-border)',
  borderRadius: 18,
  padding: 14,
  display: 'grid',
  gap: 10,
} as const;

const header = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  flexWrap: 'wrap' as const,
} as const;

const dealLabel = {
  fontFamily: 'JetBrains Mono, monospace',
  fontWeight: 800,
  color: 'var(--pc-accent, #0A7A5F)',
  fontSize: 13,
} as const;

const statusPill = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '4px 10px',
  borderRadius: 999,
  border: '1px solid',
  fontSize: 11,
  fontWeight: 900,
} as const;

const okPill = {
  background: 'rgba(10,122,95,0.08)',
  borderColor: 'rgba(10,122,95,0.22)',
  color: '#0A7A5F',
} as const;

const blockedPill = {
  background: 'rgba(220,38,38,0.07)',
  borderColor: 'rgba(220,38,38,0.20)',
  color: '#B91C1C',
} as const;

const track = {
  display: 'flex',
  alignItems: 'center',
  gap: 0,
  overflowX: 'auto' as const,
  scrollbarWidth: 'none' as const,
} as const;

const connector = {
  flex: '1 1 12px',
  height: 0,
  borderTop: '1px dashed',
  minWidth: 8,
  borderColor: 'var(--pc-border)',
} as const;

const gateBox = {
  flex: '0 0 auto',
  display: 'grid',
  gap: 3,
  justifyItems: 'center',
  padding: '7px 10px',
  borderRadius: 10,
  minWidth: 60,
  textAlign: 'center' as const,
} as const;

const gateLabel = {
  color: 'var(--pc-text-primary)',
  fontSize: 11,
  fontWeight: 900,
  lineHeight: 1.2,
} as const;

const gateNote = {
  color: 'var(--pc-text-muted)',
  fontSize: 9,
  lineHeight: 1.2,
  fontWeight: 700,
  whiteSpace: 'nowrap' as const,
} as const;
