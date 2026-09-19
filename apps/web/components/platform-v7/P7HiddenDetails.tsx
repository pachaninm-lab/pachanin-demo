import type { CSSProperties, ReactNode } from 'react';

export function P7HiddenDetails({
  title,
  meta,
  children,
  defaultOpen = false,
}: {
  title: string;
  meta: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details open={defaultOpen} style={detailsCard}>
      <summary style={summaryRow}>
        <span style={{ display: 'grid', gap: 4, minWidth: 0 }}>
          <strong style={summaryTitle}>{title}</strong>
          <span style={summaryMeta}>{meta}</span>
        </span>
        <span style={summaryPill}>раскрыть</span>
      </summary>
      <div style={detailsBody}>{children}</div>
    </details>
  );
}

const detailsCard: CSSProperties = {
  background: 'linear-gradient(180deg,#FFFFFF 0%,#F8FAFB 100%)',
  border: '1px solid var(--pc-border, #E4E6EA)',
  borderRadius: 20,
  padding: 0,
  boxShadow: '0 10px 24px rgba(15,23,42,0.045)',
  overflow: 'hidden',
};

const summaryRow: CSSProperties = {
  cursor: 'pointer',
  listStyle: 'none',
  display: 'flex',
  justifyContent: 'space-between',
  gap: 12,
  alignItems: 'center',
  padding: 14,
};

const summaryTitle: CSSProperties = {
  color: 'var(--pc-text, #0F1419)',
  fontSize: 16,
  lineHeight: 1.2,
  fontWeight: 900,
};

const summaryMeta: CSSProperties = {
  color: 'var(--pc-text-muted, #64748B)',
  fontSize: 12,
  lineHeight: 1.35,
};

const summaryPill: CSSProperties = {
  flex: '0 0 auto',
  display: 'inline-flex',
  alignItems: 'center',
  borderRadius: 999,
  border: '1px solid var(--pc-border, #CBD5E1)',
  background: '#fff',
  color: 'var(--pc-text, #0F1419)',
  padding: '7px 10px',
  fontSize: 12,
  fontWeight: 900,
};

const detailsBody: CSSProperties = {
  borderTop: '1px solid var(--pc-border, #E4E6EA)',
  padding: 14,
  display: 'grid',
  gap: 12,
};
