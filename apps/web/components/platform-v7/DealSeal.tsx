import { formatDateMsk } from '@/lib/utils/formatDate';

export interface DealSealProps {
  dealId: string;
  lotId: string;
  grain: string;
  quantity: number;
  unit: string;
  reservedAmount: number;
  releaseAmount: number;
  seller: string;
  buyer: string;
  sealedAt?: Date;
}

function rub(n: number) {
  return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(n);
}

export function DealSeal({
  dealId,
  lotId,
  grain,
  quantity,
  unit,
  reservedAmount,
  releaseAmount,
  seller,
  buyer,
  sealedAt = new Date(),
}: DealSealProps) {
  const ts = formatDateMsk(sealedAt, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <section
      data-deal-seal
      data-deal={dealId}
      aria-label={`Печать сделки ${dealId}`}
      style={shell}
    >
      <div className="pc-deal-seal-print-header" style={printHeaderStyle}>
        <div style={brand}>Прозрачная Цена · Deal Seal</div>
        <div style={tsStyle}>{ts}</div>
      </div>

      <div style={centerMark}>
        <div style={sealRing} aria-hidden>
          <div style={sealInner}>
            <span style={sealCheck}>✓</span>
          </div>
        </div>
        <div style={sealTitle}>Сделка подтверждена</div>
        <div style={sealSub}>все условия выполнены · основание готово для банка</div>
      </div>

      <div style={dataGrid}>
        <DataCell label="Сделка" value={dealId} mono />
        <DataCell label="Лот" value={lotId} mono />
        <DataCell label="Зерно" value={`${grain} · ${quantity} ${unit}`} />
        <DataCell label="Резерв" value={rub(reservedAmount)} />
        <DataCell label="К выплате" value={rub(releaseAmount)} accent />
        <DataCell label="Продавец" value={seller} />
        <DataCell label="Покупатель" value={buyer} />
        <DataCell label="Зафиксировано" value={ts} />
      </div>

      <div style={footer}>
        <span style={footerText}>
          Платформа фиксирует момент — выпуск денег подтверждает банк. Deal Seal не является платёжным документом.
        </span>
        <button
          onClick={() => window.print()}
          data-print-keep
          style={printBtn}
          type="button"
        >
          Распечатать
        </button>
      </div>
    </section>
  );
}

function DataCell({ label, value, mono, accent }: { label: string; value: string; mono?: boolean; accent?: boolean }) {
  return (
    <div style={cellStyle}>
      <div style={cellLabel}>{label}</div>
      <div style={{
        ...cellValue,
        fontFamily: mono ? 'JetBrains Mono, monospace' : 'inherit',
        color: accent ? 'var(--pc-accent, #0A7A5F)' : 'var(--pc-text-primary, #0F1419)',
        fontVariantNumeric: 'tabular-nums',
      }}>
        {value}
      </div>
    </div>
  );
}

const shell = {
  background: 'var(--pc-bg-card, #fff)',
  border: '1px solid rgba(10,122,95,0.28)',
  borderRadius: 24,
  padding: 24,
  display: 'grid',
  gap: 20,
  boxShadow: '0 0 0 4px rgba(10,122,95,0.06)',
} as const;

const printHeaderStyle = {
  display: 'none',
} as const;

const brand = {
  fontSize: 13,
  fontWeight: 900,
  color: 'var(--pc-accent, #0A7A5F)',
} as const;

const tsStyle = {
  fontSize: 12,
  color: 'var(--pc-text-muted, #64748B)',
} as const;

const centerMark = {
  display: 'grid',
  gap: 8,
  justifyItems: 'center',
  textAlign: 'center' as const,
} as const;

const sealRing = {
  width: 72,
  height: 72,
  borderRadius: '50%',
  background: 'rgba(10,122,95,0.10)',
  border: '2px solid rgba(10,122,95,0.30)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
} as const;

const sealInner = {
  width: 52,
  height: 52,
  borderRadius: '50%',
  background: 'rgba(10,122,95,0.18)',
  border: '1px solid rgba(10,122,95,0.40)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
} as const;

const sealCheck = {
  color: 'var(--pc-accent, #0A7A5F)',
  fontSize: 24,
  fontWeight: 900,
  lineHeight: 1,
} as const;

const sealTitle = {
  fontSize: 20,
  fontWeight: 950,
  color: 'var(--pc-text-primary, #0F1419)',
  lineHeight: 1.15,
} as const;

const sealSub = {
  fontSize: 13,
  color: 'var(--pc-text-muted, #64748B)',
  lineHeight: 1.5,
} as const;

const dataGrid = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
  gap: 10,
  padding: '16px 0',
  borderTop: '1px solid var(--pc-border, #E4E6EA)',
  borderBottom: '1px solid var(--pc-border, #E4E6EA)',
} as const;

const cellStyle = {
  display: 'grid',
  gap: 4,
} as const;

const cellLabel = {
  fontSize: 10,
  fontWeight: 900,
  color: 'var(--pc-text-muted, #64748B)',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.07em',
} as const;

const cellValue = {
  fontSize: 14,
  fontWeight: 800,
  lineHeight: 1.3,
} as const;

const footer = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 12,
  flexWrap: 'wrap' as const,
} as const;

const footerText = {
  fontSize: 11,
  color: 'var(--pc-text-muted, #64748B)',
  lineHeight: 1.45,
  flex: 1,
} as const;

const printBtn = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '8px 14px',
  borderRadius: 10,
  border: '1px solid var(--pc-border, #E4E6EA)',
  background: 'var(--pc-bg-elevated, #F8FAFB)',
  color: 'var(--pc-text-primary, #0F1419)',
  fontSize: 12,
  fontWeight: 800,
  cursor: 'pointer',
  flexShrink: 0,
} as const;
