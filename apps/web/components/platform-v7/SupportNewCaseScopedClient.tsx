'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { usePlatformV7RStore, type PlatformRole } from '@/stores/usePlatformV7RStore';
import { useSupportCases } from '@/lib/platform-v7/support-client-store';
import type { SupportCase, SupportCategory, SupportPriority, SupportRelatedEntityType } from '@/lib/platform-v7/support-types';
import { SUPPORT_CATEGORY_LABELS, SUPPORT_PRIORITY_LABELS, supportCategoryByText, supportOwner, supportPriority, supportSlaDueAt, supportSlaHours, supportStatusByOwner } from '@/lib/platform-v7/support-helpers';
import { SupportNewCaseClient } from './SupportNewCaseClient';

const FIELD_SUPPORT_ROLES = new Set<PlatformRole>(['driver', 'surveyor', 'elevator', 'lab']);
const fieldEntityTypes: SupportRelatedEntityType[] = ['trip', 'document', 'blocker', 'other'];
const entityLabels: Record<SupportRelatedEntityType, string> = { deal: 'Сделка', lot: 'Лот', trip: 'Рейс', document: 'Документ', blocker: 'Блокер', dispute: 'Спор', money: 'Деньги', integration: 'Интеграция', other: 'Объект' };
const inputStyle: React.CSSProperties = { width: '100%', minHeight: 44, border: '1px solid var(--pc-border, #E4E6EA)', borderRadius: 12, padding: '10px 12px', background: 'var(--pc-bg-card, #fff)', color: 'var(--pc-text-primary, #0F1419)' };
const card: React.CSSProperties = { background: 'var(--pc-bg-card, #fff)', border: '1px solid var(--pc-border, #E4E6EA)', borderRadius: 18, padding: 16 };

function FieldSupportNewCase({ defaults, activeRole }: { defaults: Partial<SupportCase>; activeRole: PlatformRole }) {
  const router = useRouter();
  const { createCase } = useSupportCases();
  const [title, setTitle] = React.useState(defaults.title ?? '');
  const [description, setDescription] = React.useState(defaults.description ?? '');
  const [relatedEntityType, setRelatedEntityType] = React.useState<SupportRelatedEntityType>(defaults.relatedEntityType === 'document' || defaults.relatedEntityType === 'blocker' || defaults.relatedEntityType === 'other' ? defaults.relatedEntityType : 'trip');
  const [relatedEntityId, setRelatedEntityId] = React.useState(defaults.relatedEntityId ?? defaults.tripId ?? '');
  const [tripId, setTripId] = React.useState(defaults.tripId ?? '');
  const [blocker, setBlocker] = React.useState(defaults.blocker ?? '');
  const [error, setError] = React.useState('');

  const category: SupportCategory = supportCategoryByText(`${title} ${description} ${blocker}`);
  const priority: SupportPriority = supportPriority(category, 0, `${description} ${blocker}`);
  const owner = supportOwner(category);
  const now = new Date().toISOString();
  const objectReady = Boolean(relatedEntityId || tripId);

  function submitCase() {
    const safeEntityId = relatedEntityId || tripId;
    if (!safeEntityId) {
      setError('Нужно указать рейс, документ, блокер или другой объект.');
      return;
    }
    const supportCase: SupportCase = {
      id: `SC-${Date.now().toString().slice(-6)}`,
      title: title || `${SUPPORT_CATEGORY_LABELS[category]}: обращение по объекту ${safeEntityId}`,
      description: description || 'Нужно проверить проблему и определить следующий шаг.',
      status: supportStatusByOwner(owner),
      priority,
      category,
      requesterRole: activeRole,
      relatedEntityType,
      relatedEntityId: safeEntityId,
      tripId: tripId || undefined,
      moneyAtRiskRub: 0,
      blocker: blocker || 'Блокер требует уточнения',
      owner,
      nextAction: 'Проверить рейс, подтверждения и следующий шаг.',
      slaDueAt: supportSlaDueAt(priority, now),
      createdAt: now,
      updatedAt: now,
    };
    createCase(supportCase, description || supportCase.description);
    router.push(`/platform-v7/support/${supportCase.id}`);
  }

  return (
    <div style={{ display: 'grid', gap: 16, maxWidth: 920, margin: '0 auto' }}>
      <section style={{ ...card, display: 'grid', gap: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 900, color: 'var(--pc-accent, #0A7A5F)' }}>Обращение по исполнению</div>
        <h1 style={{ margin: 0, fontSize: 28 }}>Сообщить о проблеме по рейсу</h1>
        <p style={{ margin: 0, color: 'var(--pc-text-muted, #64748b)', lineHeight: 1.6 }}>Укажи, что мешает выполнить рейс или проверку: фото, пломба, вес, документ, задержка или связь.</p>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 14 }}>
        <div style={{ ...card, display: 'grid', gap: 12 }}>
          <label>Тема<input value={title} onChange={(event) => setTitle(event.target.value)} style={inputStyle} /></label>
          <label>Описание<textarea value={description} onChange={(event) => setDescription(event.target.value)} style={{ ...inputStyle, minHeight: 110 }} /></label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 10 }}>
            <label>Тип объекта<select value={relatedEntityType} onChange={(event) => setRelatedEntityType(event.target.value as SupportRelatedEntityType)} style={inputStyle}>{fieldEntityTypes.map((type) => <option key={type} value={type}>{entityLabels[type]}</option>)}</select></label>
            <label>ID объекта<input value={relatedEntityId} onChange={(event) => setRelatedEntityId(event.target.value)} style={inputStyle} /></label>
            <label>ID рейса<input value={tripId} onChange={(event) => setTripId(event.target.value)} style={inputStyle} /></label>
          </div>
          <label>Блокер<textarea value={blocker} onChange={(event) => setBlocker(event.target.value)} style={{ ...inputStyle, minHeight: 90 }} /></label>
          {error ? <div style={{ color: 'var(--pc-danger, #B42318)', fontSize: 13, fontWeight: 800 }}>{error}</div> : null}
          <button onClick={submitCase} disabled={!objectReady} style={{ minHeight: 46, borderRadius: 14, border: 0, background: objectReady ? 'var(--pc-accent, #0A7A5F)' : 'var(--pc-bg-muted, #E4E6EA)', color: objectReady ? '#fff' : 'var(--pc-text-muted, #64748b)', fontWeight: 900, cursor: objectReady ? 'pointer' : 'not-allowed' }}>Создать обращение</button>
        </div>
        <aside style={{ ...card, display: 'grid', gap: 10, alignContent: 'start' }}>
          <div style={{ fontWeight: 900 }}>Предварительная оценка</div>
          <div>Категория: <b>{SUPPORT_CATEGORY_LABELS[category]}</b></div>
          <div>Приоритет: <b>{SUPPORT_PRIORITY_LABELS[priority]}</b></div>
          <div>Срок реакции: <b>{supportSlaHours(priority)} ч.</b></div>
          <div style={{ color: objectReady ? 'var(--pc-text-muted, #64748b)' : 'var(--pc-danger, #B42318)', fontSize: 13, lineHeight: 1.5 }}>{objectReady ? 'Объект указан. Обращение можно создать.' : 'Нужен рейс, документ, блокер или другой объект.'}</div>
        </aside>
      </section>
    </div>
  );
}

export function SupportNewCaseScopedClient({ defaults }: { defaults: Partial<SupportCase> }) {
  const activeRole = usePlatformV7RStore((state) => state.role);
  return FIELD_SUPPORT_ROLES.has(activeRole) ? <FieldSupportNewCase defaults={defaults} activeRole={activeRole} /> : <SupportNewCaseClient defaults={defaults} />;
}
