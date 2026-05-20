'use client';

import * as React from 'react';
import { Activity, Banknote, FileText, Truck, FlaskConical, Shield, Gavel, BookOpen } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/**
 * DealMiniMap — навигация по карточке сделки.
 *
 * Desktop: sticky справа — вертикальный список якорей.
 * Mobile: horizontal pills — прокручиваемая лента.
 *
 * Позволяет перейти к любой секции сделки без скролла всей страницы.
 */

export type DealMiniMapSectionId =
  | 'pulse'
  | 'money'
  | 'documents'
  | 'trip'
  | 'quality'
  | 'evidence'
  | 'dispute'
  | 'journal';

export interface DealMiniMapSection {
  readonly id: DealMiniMapSectionId;
  readonly label: string;
  readonly shortLabel?: string;
  readonly status?: 'ok' | 'warn' | 'blocked' | 'neutral';
  readonly count?: number;
  readonly anchorId?: string;
}

export interface DealMiniMapProps {
  readonly sections: DealMiniMapSection[];
  readonly activeSection?: DealMiniMapSectionId;
  readonly onSectionClick?: (id: DealMiniMapSectionId) => void;
  readonly mobile?: boolean;
  readonly 'data-testid'?: string;
}

const DEFAULT_SECTIONS: DealMiniMapSection[] = [
  { id: 'pulse',     label: 'Пульс',        shortLabel: 'Пульс',   anchorId: 'deal-pulse' },
  { id: 'money',     label: 'Деньги',       shortLabel: 'Деньги',  anchorId: 'deal-money' },
  { id: 'documents', label: 'Документы',    shortLabel: 'Доки',    anchorId: 'deal-documents' },
  { id: 'trip',      label: 'Рейс',         shortLabel: 'Рейс',    anchorId: 'deal-trip' },
  { id: 'quality',   label: 'Качество',     shortLabel: 'Качество',anchorId: 'deal-quality' },
  { id: 'evidence',  label: 'Доказательства',shortLabel: 'Факты',  anchorId: 'deal-evidence' },
  { id: 'dispute',   label: 'Спор',         shortLabel: 'Спор',    anchorId: 'deal-dispute' },
  { id: 'journal',   label: 'Журнал',       shortLabel: 'Журнал',  anchorId: 'deal-journal' },
];

const SECTION_ICONS: Record<DealMiniMapSectionId, LucideIcon> = {
  pulse:     Activity,
  money:     Banknote,
  documents: FileText,
  trip:      Truck,
  quality:   FlaskConical,
  evidence:  Shield,
  dispute:   Gavel,
  journal:   BookOpen,
};

const STATUS_COLORS = {
  ok:      'var(--p7-color-success, #027A48)',
  warn:    'var(--p7-color-warning, #B54708)',
  blocked: 'var(--p7-color-danger, #B42318)',
  neutral: 'var(--p7-color-text-muted, #667085)',
};

export function DealMiniMap({
  sections = DEFAULT_SECTIONS,
  activeSection,
  onSectionClick,
  mobile = false,
  'data-testid': testId,
}: DealMiniMapProps) {
  function handleClick(section: DealMiniMapSection) {
    if (onSectionClick) {
      onSectionClick(section.id);
    } else if (section.anchorId && typeof document !== 'undefined') {
      const el = document.getElementById(section.anchorId);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  if (mobile) {
    return (
      <nav
        aria-label='Навигация по сделке'
        data-testid={testId ?? 'p7-vil-deal-minimap-mobile'}
        style={{
          display: 'flex',
          gap: 6,
          overflowX: 'auto',
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          paddingBottom: 2,
        }}
      >
        {sections.map((section) => {
          const isActive = section.id === activeSection;
          const Icon = SECTION_ICONS[section.id];
          const statusColor = section.status ? STATUS_COLORS[section.status] : undefined;

          return (
            <button
              key={section.id}
              type='button'
              onClick={() => handleClick(section)}
              aria-current={isActive ? 'true' : undefined}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '5px 10px',
                borderRadius: 999,
                border: isActive
                  ? '1px solid var(--pc-accent-border, rgba(11,122,95,0.3))'
                  : '1px solid var(--pc-border, #D7DEE3)',
                background: isActive
                  ? 'var(--pc-accent-bg, rgba(11,122,95,0.08))'
                  : 'var(--pc-bg-card, #FFFFFF)',
                color: isActive
                  ? 'var(--p7-color-brand, #0A7A5F)'
                  : statusColor ?? 'var(--p7-color-text-secondary, #475569)',
                fontSize: 11,
                fontWeight: isActive ? 850 : 700,
                cursor: 'pointer',
                flexShrink: 0,
                whiteSpace: 'nowrap',
              }}
            >
              <Icon size={12} strokeWidth={2} />
              {section.shortLabel ?? section.label}
              {section.count !== undefined && section.count > 0 && (
                <span
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: '50%',
                    background: statusColor ?? 'var(--p7-color-text-muted, #667085)',
                    color: '#FFFFFF',
                    fontSize: 9,
                    fontWeight: 900,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    lineHeight: 1,
                  }}
                >
                  {section.count > 9 ? '9+' : section.count}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    );
  }

  // Desktop: sticky vertical list
  return (
    <nav
      aria-label='Навигация по сделке'
      data-testid={testId ?? 'p7-vil-deal-minimap'}
      style={{
        position: 'sticky',
        top: 130,
        alignSelf: 'flex-start',
        display: 'grid',
        gap: 2,
        width: 152,
        flexShrink: 0,
      }}
    >
      <span
        style={{
          fontSize: 10,
          fontWeight: 900,
          color: 'var(--p7-color-text-muted, #667085)',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          padding: '0 10px 6px',
        }}
      >
        Разделы
      </span>

      {sections.map((section) => {
        const isActive = section.id === activeSection;
        const Icon = SECTION_ICONS[section.id];
        const statusColor = section.status ? STATUS_COLORS[section.status] : undefined;

        return (
          <button
            key={section.id}
            type='button'
            onClick={() => handleClick(section)}
            aria-current={isActive ? 'true' : undefined}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '7px 10px',
              borderRadius: 10,
              border: isActive
                ? '1px solid var(--pc-accent-border, rgba(11,122,95,0.3))'
                : '1px solid transparent',
              background: isActive
                ? 'var(--pc-accent-bg, rgba(11,122,95,0.08))'
                : 'transparent',
              color: isActive
                ? 'var(--p7-color-brand, #0A7A5F)'
                : statusColor ?? 'var(--p7-color-text-secondary, #475569)',
              fontSize: 12,
              fontWeight: isActive ? 850 : 650,
              cursor: 'pointer',
              textAlign: 'left',
              width: '100%',
            }}
          >
            <Icon size={13} strokeWidth={isActive ? 2.2 : 1.8} style={{ flexShrink: 0 }} />
            <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {section.label}
            </span>
            {section.count !== undefined && section.count > 0 && (
              <span
                style={{
                  flexShrink: 0,
                  width: 18,
                  height: 18,
                  borderRadius: '50%',
                  background: statusColor ?? 'var(--p7-color-text-muted, #667085)',
                  color: '#FFFFFF',
                  fontSize: 10,
                  fontWeight: 900,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  lineHeight: 1,
                }}
              >
                {section.count > 9 ? '9+' : section.count}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}
