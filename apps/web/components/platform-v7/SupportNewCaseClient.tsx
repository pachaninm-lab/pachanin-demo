'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import type { PlatformRole } from '@/stores/usePlatformV7RStore';
import { useSupportCases } from '@/lib/platform-v7/support-client-store';
import type { SupportCase, SupportCategory, SupportPriority, SupportRelatedEntityType } from '@/lib/platform-v7/support-types';
import { SUPPORT_CATEGORY_LABELS, SUPPORT_PRIORITY_LABELS, supportCategoryByText, supportFormatRub, supportOwner, supportPriority, supportSlaDueAt, supportSlaHours, supportStatusByOwner } from '@/lib/platform-v7/support-helpers';

const roles: PlatformRole[] = ['operator', 'buyer', 'seller', 'logistics', 'driver', 'elevator', 'lab', 'bank'];
const roleLabels: Record<string, string> = { operator: 'Оператор', buyer: 'Покупатель', seller: 'Продавец', logistics: 'Логистика', driver: 'Водитель', elevator: 'Элеватор', lab: 'Лаборатория', bank: 'Банк' };
const entityTypes: SupportRelatedEntityType[] = ['deal', 'lot', 'trip', 'document', 'blocker', 'dispute', 'money', 'integration', 'other'];
const entityLabels: Record<SupportRelatedEntityType, string> = { deal: 'Сделка', lot: 'Лот', trip: 'Рейс', document: 'Документ', blocker: 'Блокер', dispute: 'Спор', money: 'Деньги', integration: 'Интеграция', other: 'Объект' };
const inputStyle: React.CSSProperties = { width: '100%', minHeight: 44, border: '1px solid var(--pc-border, #E4E6EA)', borderRadius: 12, padding: '10px 12px', background: 'var(--pc-bg-card, #fff)', color: 'var(--pc-text-primary, #0F1419)' };
const card: React.CSSProperties = { background: 'var(--pc-bg-card, #fff)', border: '1px solid var(--pc-border, #E4E6EA)', borderRadius: 18, padding: 16 };

export function SupportNewCaseClient({ defaults }: { defaults: Partial<SupportCase> }) {
  const router = useRouter();
  const { createCase } = useSupportCases();
  const [title, setTitle] = React.useState(defaults.title ?? '');
  const [description, setDescription] = React.useState(defaults.description ?? '');
  const [requesterRole, setRequesterRole] = React.useState<PlatformRole>(defaults.requesterRole ?? 'operator');
  const [relatedEntityType, setRelatedEntityType] = React.useState<SupportRelatedEntityType>(defaults.relatedEntityType ?? 'deal');
  const [relatedEntityId, setRelatedEntityId] = React.useState(defaults.relatedEntityId ?? defaults.dealId ?? defaults.tripId ?? defaults.lotId ?? '');
  const [dealId, setDealId] = React.useState(defaults.dealId ?? '');
  const [lotId, setLotId] = React.useState(defaults.lotId ?? '');
  const [tripId, setTripId] = React.useState(defaults.tripId ?? '');
  const [moneyAtRiskRub, setMoneyAtRiskRub] = React.useState(String(defaults.moneyAtRiskRub ?? 0));
  const [blocker, setBlocker] = React.useState(defaults.blocker ?? '');
  const [error, setError] = React.useState('');

  const category: SupportCategory = supportCategoryByText(`${title} ${description} ${blocker}`);
  const money = Number(moneyAtRiskRub.replace(/[^0-9]/g, '')) || 0;
  const priority: SupportPriority = supportPriority(category, money, `${description} ${blocker}`);
  const owner = supportOwner(category);
  const now = new Date().toISOString();
  const objectReady = Boolean(relatedEntityId || dealId || tripId || lotId);

  function submitCase() {
    const safeEntityId = relatedEntityId || dealId || tripId || lotId;
    if (!safeEntityId) {
      setError('Нужно указать объект: сделку, лот, рейс, документ, блокер или спор. Обращение без объекта не создаётся.');
      return;
    }
    const supportCase: SupportCase = {
      id: `SC-${Date.now().toString().slice(-6)}`,
      title: title || `${SUPPORT_CATEGORY_LABELS[category]}: обращение по объекту ${safeEntityId}`,
      description: description || 'Нужно проверить блокер и определить следующий шаг.',
      status: supportStatusByOwner(owner),
      priority,
      category,
      requesterRole,
      relatedEntityType,
      relatedEntityId: safeEntityId,
      dealId: dealId || undefined,
      lotId: lotId || undefined,
      tripId: tripId || undefined,
      moneyAtRiskRub: money,
      blocker: blocker || 'Блокер требует уточнения',
      owner,
      nextAction: owner === 'Логистика' ? 'Проверить рейс, маршрут и подтверждения.' : owner === 'Банковый контур' ? 'Проверить деньги, основание удержания и доказательства.' : 'Проверить объект, блокер и ответственного.',
      slaDueAt: supportSlaDueAt(priority, now),
      createdAt: now,
      updatedAt: now,
    };
    createCase(supportCase, description || supportCase.description);
    router.push(`/platform-v7/support/${supportCase.id}`);
  }

  return (
    <div style={{ display: 'grid', gap: 16, maxWidth: 1120, margin: '0 auto' }}>
      <section style={{ ...card, display: 'grid', gap: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 900, color: 'var(--pc-accent, #0A7A5F)' }}>Помощник для сбора обращения</div>
        <h1 style={{ margin: 0, fontSize: 28 }}>Создать обращение</h1>
        <p style={{ margin: 0, color: 'var(--pc-text-muted, #64748b)', lineHeight: 1.6 }}>Помощник определяет категорию, предлагает приоритет, подтягивает ID объекта и формирует следующий шаг. Он не меняет статусы сделки, не выпускает деньги, не закрывает спор и не обещает результат.</p>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 14 }}>
        <div style={{ ...card, display: 'grid', gap: 12 }}>
          <label>Тема<input value={title} onChange={(e) => setTitle(e.target.value)} style={inputStyle} /></label>
          <label>Описание<textarea value={description} onChange={(e) => setDescription(e.target.value)} style={{ ...inputStyle, minHeight: 110 }} /></label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 10 }}>
            <label>Роль<select value={requesterRole} onChange={(e) => setRequesterRole(e.target.value as PlatformRole)} style={inputStyle}>{roles.map((role) => <option key={role} value={role}>{roleLabels[role]}</option>)}</select></label>
            <label>Тип объекта<select value={relatedEntityType} onChange={(e) => setRelatedEntityType(e.target.value as SupportRelatedEntityType)} style={inputStyle}>{entityTypes.map((type) => <option key={type} value={type}>{entityLabels[type]}</option>)}</select></label>
            <label>ID объекта<input value={relatedEntityId} onChange={(e) => setRelatedEntityId(e.target.value)} style={inputStyle} /></label>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10 }}>
            <label>ID сделки<input value={dealId} onChange={(e) => setDealId(e.target.value)} style={inputStyle} /></label>
            <label>ID лота<input value={lotId} onChange={(e) => setLotId(e.target.value)} style={inputStyle} /></label>
            <label>ID рейса<input value={tripId} onChange={(e) => setTripId(e.target.value)} style={inputStyle} /></label>
          </div>
          <label>Деньги под риском<input value={moneyAtRiskRub} onChange={(e) => setMoneyAtRiskRub(e.target.value)} style={inputStyle} /></label>
          <label>Блокер<textarea value={blocker} onChange={(e) => setBlocker(e.target.value)} style={{ ...inputStyle, minHeight: 90 }} /></label>
          {error ? <div style={{ color: 'var(--pc-danger, #B42318)', fontSize: 13, fontWeight: 800 }}>{error}</div> : null}
          <button onClick={submitCase} disabled={!objectReady} style={{ minHeight: 46, borderRadius: 14, border: 0, background: objectReady ? 'var(--pc-accent, #0A7A5F)' : 'var(--pc-bg-muted, #E4E6EA)', color: objectReady ? '#fff' : 'var(--pc-text-muted, #64748b)', fontWeight: 900, cursor: objectReady ? 'pointer' : 'not-allowed' }}>Создать обращение</button>
        </div>
        <aside style={{ ...card, display: 'grid', gap: 10, alignContent: 'start' }}>
          <div style={{ fontWeight: 900 }}>Предварительная оценка</div>
          <div>Категория: <b>{SUPPORT_CATEGORY_LABELS[category]}</b></div>
          <div>Приоритет: <b>{SUPPORT_PRIORITY_LABELS[priority]}</b></div>
          <div>Ответственный: <b>{owner}</b></div>
          <div>SLA: <b>{supportSlaHours(priority)} ч.</b></div>
          <div>Деньги под риском: <b>{supportFormatRub(money)}</b></div>
          <div style={{ color: objectReady ? 'var(--pc-text-muted, #64748b)' : 'var(--pc-danger, #B42318)', fontSize: 13, lineHeight: 1.5 }}>{objectReady ? 'Объект указан. Обращение можно создать.' : 'Нужен объект платформы: сделка, лот, рейс, документ, блокер или спор.'}</div>
        </aside>
      </section>
    </div>
  );
}
