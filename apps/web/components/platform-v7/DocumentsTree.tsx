'use client';

import { useState } from 'react';
import { DocumentPdfPreview } from './DocumentPdfPreview';

export type DocStatus = 'MISSING' | 'DRAFT' | 'GENERATED' | 'SIGNED' | 'EXPIRED' | 'DISPUTED' | 'ARCHIVED';

export interface DocumentNode {
  id: string;
  name: string;
  type: 'CONTRACT' | 'TTN' | 'ETTN' | 'SDIZ' | 'WEIGH_TICKET' | 'LAB_PROTOCOL' | 'ACT' | 'INVOICE' | 'OTHER';
  status: DocStatus;
  dealId?: string;
  sizeKb?: number;
  signedAt?: string;
  signatories?: string[];
  href?: string;
}

export interface DocumentYear {
  year: number;
  months: Array<{
    month: number;
    label: string;
    deals: Array<{
      dealId: string;
      dealLabel: string;
      documents: DocumentNode[];
    }>;
  }>;
}

const STATUS_LABEL: Record<DocStatus, string> = {
  MISSING:   'Отсутствует',
  DRAFT:     'Черновик',
  GENERATED: 'Сформирован',
  SIGNED:    'Подписан',
  EXPIRED:   'Просрочен',
  DISPUTED:  'Оспорен',
  ARCHIVED:  'Архив',
};

const STATUS_COLOR: Record<DocStatus, string> = {
  MISSING:   'var(--status-error-text)',
  DRAFT:     'var(--status-draft-text)',
  GENERATED: 'var(--status-pending-text)',
  SIGNED:    'var(--status-paid-text)',
  EXPIRED:   'var(--status-warning-text)',
  DISPUTED:  'var(--status-dispute-text)',
  ARCHIVED:  'var(--status-closed-text)',
};

const TYPE_ICON: Record<DocumentNode['type'], string> = {
  CONTRACT:     '📄',
  TTN:          '📦',
  ETTN:         '📡',
  SDIZ:         '🌾',
  WEIGH_TICKET: '⚖️',
  LAB_PROTOCOL: '🔬',
  ACT:          '✅',
  INVOICE:      '💰',
  OTHER:        '📎',
};

interface TreeNodeProps {
  doc: DocumentNode;
}

function DocRow({ doc }: TreeNodeProps) {
  const color = STATUS_COLOR[doc.status];
  const icon = TYPE_ICON[doc.type];
  const href = doc.href ?? (doc.dealId ? `/platform-v7/deals/${doc.dealId}/documents` : '#');
  const canPreview = doc.status === 'SIGNED' || doc.status === 'GENERATED';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginLeft: '1.5rem' }}>
      <a
        href={href}
        className="hover-row"
        style={{
          flex: 1, display: 'flex', alignItems: 'center', gap: '0.75rem',
          padding: '0.5rem 0.75rem', borderRadius: '6px',
          textDecoration: 'none', color: 'inherit', minWidth: 0,
        }}
      >
        <span style={{ fontSize: '1rem', flexShrink: 0 }}>{icon}</span>
        <span style={{ flex: 1, fontSize: 'var(--text-sm)', color: 'var(--pc-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {doc.name}
        </span>
        {doc.sizeKb && (
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--pc-text-muted)', flexShrink: 0 }}>
            {doc.sizeKb < 1024 ? `${doc.sizeKb} КБ` : `${(doc.sizeKb / 1024).toFixed(1)} МБ`}
          </span>
        )}
        <span
          className="status-badge"
          data-status={doc.status === 'SIGNED' ? 'paid' : doc.status === 'MISSING' ? 'error' : doc.status === 'DISPUTED' ? 'dispute' : 'draft'}
          style={{ color, fontSize: '10px' }}
        >
          {STATUS_LABEL[doc.status]}
        </span>
      </a>
      {canPreview && (
        <DocumentPdfPreview
          documentName={doc.name}
          documentType={doc.type}
          documentId={doc.id}
          signedBy={doc.signatories?.[0]}
          signedAt={doc.signedAt}
          watermark="ДЕМО-ДАННЫЕ"
        />
      )}
    </div>
  );
}

interface CollapsibleProps {
  label: string;
  count: number;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

function CollapsibleGroup({ label, count, children, defaultOpen = false }: CollapsibleProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex', alignItems: 'center', gap: '0.5rem',
          width: '100%', padding: '0.5rem 0.75rem',
          background: 'none', border: 'none', cursor: 'pointer',
          fontSize: 'var(--text-sm)', color: 'var(--pc-text-secondary)',
          fontWeight: 600, textAlign: 'left',
        }}
        aria-expanded={open}
      >
        <span style={{ fontSize: '0.625rem', color: 'var(--pc-text-muted)', transform: open ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 150ms ease' }}>▶</span>
        <span style={{ flex: 1 }}>{label}</span>
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--pc-text-muted)', fontWeight: 400 }}>{count} доков</span>
      </button>
      {open && <div>{children}</div>}
    </div>
  );
}

interface DocumentsTreeProps {
  data: DocumentYear[];
}

export function DocumentsTree({ data }: DocumentsTreeProps) {
  if (data.length === 0) {
    return (
      <div className="empty-state">
        <p className="empty-state__title">Документов нет</p>
        <p className="empty-state__description">Документы появятся после заключения первой сделки.</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      {data.map((year) => (
        <CollapsibleGroup
          key={year.year}
          label={String(year.year)}
          count={year.months.reduce((acc, m) => acc + m.deals.reduce((a, d) => a + d.documents.length, 0), 0)}
          defaultOpen={year.year === new Date().getFullYear()}
        >
          {year.months.map((month) => (
            <CollapsibleGroup
              key={`${year.year}-${month.month}`}
              label={month.label}
              count={month.deals.reduce((a, d) => a + d.documents.length, 0)}
              defaultOpen
            >
              {month.deals.map((deal) => (
                <CollapsibleGroup
                  key={deal.dealId}
                  label={`${deal.dealId} · ${deal.dealLabel}`}
                  count={deal.documents.length}
                  defaultOpen
                >
                  {deal.documents.map((doc) => (
                    <DocRow key={doc.id} doc={doc} />
                  ))}
                </CollapsibleGroup>
              ))}
            </CollapsibleGroup>
          ))}
        </CollapsibleGroup>
      ))}
    </div>
  );
}

// Demo data factory lives in ./DocumentsTree.data (server-safe, no 'use client')
// so Server Components can call it — importing a plain function through this
// 'use client' boundary would yield a non-callable client-reference proxy.
