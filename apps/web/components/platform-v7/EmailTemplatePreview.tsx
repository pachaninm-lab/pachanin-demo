'use client';

import { useState } from 'react';

type EmailTemplateKey =
  | 'deal_created'
  | 'payment_blocked'
  | 'payment_released'
  | 'dispute_opened'
  | 'document_required'
  | 'lot_offer';

interface EmailTemplate {
  id: EmailTemplateKey;
  subject: string;
  trigger: string;
  recipient: string;
  body: string;
}

const TEMPLATES: EmailTemplate[] = [
  {
    id: 'deal_created',
    subject: 'Сделка DL-{{deal_id}} создана · Прозрачная Цена',
    trigger: 'Создание новой сделки',
    recipient: 'Продавец + Покупатель',
    body: `Здравствуйте, {{actor_name}}.

Сделка **DL-{{deal_id}}** успешно создана на платформе Прозрачная Цена.

Культура: {{culture}}
Объём: {{volume_tons}} т
Сумма: {{amount_rub}} ₽
Базис: {{delivery_basis}}

Следующий шаг: резервирование средств через банк-партнёр.

Открыть сделку → {{deal_url}}

С уважением,
Платформа «Прозрачная Цена»`,
  },
  {
    id: 'payment_blocked',
    subject: '⚠️ Выплата по DL-{{deal_id}} заблокирована · действие требуется',
    trigger: 'Автоматическая блокировка выплаты',
    recipient: 'Продавец + Оператор',
    body: `Здравствуйте, {{actor_name}}.

Выплата по сделке DL-{{deal_id}} на сумму **{{amount_rub}} ₽** заблокирована.

Причина блокировки: {{block_reason}}

Что нужно сделать:
1. {{action_1}}
2. {{action_2}}

Срок реакции: {{deadline}}

Открыть сделку → {{deal_url}}
Связаться с оператором → {{operator_url}}`,
  },
  {
    id: 'payment_released',
    subject: '✅ Выплата {{amount_rub}} ₽ выполнена · DL-{{deal_id}}',
    trigger: 'Успешная выплата банком',
    recipient: 'Продавец',
    body: `Здравствуйте, {{actor_name}}.

Отличная новость! Выплата по сделке DL-{{deal_id}} выполнена.

Сумма: **{{amount_rub}} ₽**
Дата: {{paid_at}}
Банк: {{bank_name}}
Ссылка на платёж: {{payment_ref}}

Документы сделки доступны в архиве → {{docs_url}}`,
  },
  {
    id: 'dispute_opened',
    subject: '⚖️ Открыт спор {{dispute_id}} по DL-{{deal_id}}',
    trigger: 'Создание спора',
    recipient: 'Все стороны сделки + Оператор',
    body: `Здравствуйте, {{actor_name}}.

По сделке DL-{{deal_id}} открыт спор **{{dispute_id}}**.

Основание: {{dispute_reason}}
Удержание: {{hold_rub}} ₽
Срок ответа: {{response_deadline}}

Ответственный следующего шага: {{next_owner}}

Открыть спор → {{dispute_url}}

Для урегулирования необходимо предоставить доказательный пакет в течение {{response_deadline}}.`,
  },
  {
    id: 'document_required',
    subject: '📄 Требуется документ: {{doc_type}} · DL-{{deal_id}}',
    trigger: 'Отсутствие обязательного документа',
    recipient: 'Ответственный за документ',
    body: `Здравствуйте, {{actor_name}}.

Для завершения сделки DL-{{deal_id}} требуется документ:

Тип: **{{doc_type}}**
Источник: {{doc_source}}
Влияние: {{doc_impact}}
Дедлайн: {{doc_deadline}}

Загрузить документ → {{docs_url}}

Без этого документа выплата по сделке невозможна.`,
  },
  {
    id: 'lot_offer',
    subject: '🌾 Новый лот {{lot_id}} соответствует вашему запросу',
    trigger: 'Публикация лота по параметрам RFQ',
    recipient: 'Покупатель',
    body: `Здравствуйте, {{actor_name}}.

На платформе появился лот, соответствующий вашему закупочному запросу.

Лот: **{{lot_id}}**
Культура: {{culture}} ({{quality_class}})
Объём: {{volume_tons}} т
Цена: {{price_rub_per_ton}} ₽/т
Регион: {{region}}
Базис: {{delivery_basis}}

Просмотреть лот → {{lot_url}}

Предложение действует до: {{offer_expires_at}}`,
  },
];

const KEY_COLORS: Record<EmailTemplateKey, { bg: string; border: string; badge: string }> = {
  deal_created:     { bg: 'rgba(10,122,95,0.06)',  border: 'rgba(10,122,95,0.2)',  badge: '#0A7A5F' },
  payment_blocked:  { bg: 'rgba(220,38,38,0.06)',  border: 'rgba(220,38,38,0.2)',  badge: '#B91C1C' },
  payment_released: { bg: 'rgba(52,211,153,0.06)', border: 'rgba(52,211,153,0.2)', badge: '#059669' },
  dispute_opened:   { bg: 'rgba(217,119,6,0.06)',  border: 'rgba(217,119,6,0.2)',  badge: '#B45309' },
  document_required:{ bg: 'rgba(37,99,235,0.06)',  border: 'rgba(37,99,235,0.2)',  badge: '#2563EB' },
  lot_offer:        { bg: 'rgba(124,58,237,0.06)', border: 'rgba(124,58,237,0.2)', badge: '#7C3AED' },
};

export function EmailTemplatePreview() {
  const [active, setActive] = useState<EmailTemplateKey>('deal_created');
  const template = TEMPLATES.find((t) => t.id === active)!;
  const colors = KEY_COLORS[active];

  return (
    <div style={{ display: 'grid', gap: '0.875rem' }}>
      {/* Template selector */}
      <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
        {TEMPLATES.map((t) => (
          <button
            key={t.id}
            onClick={() => setActive(t.id)}
            style={{ fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 999, cursor: 'pointer', background: active === t.id ? KEY_COLORS[t.id].badge : 'transparent', color: active === t.id ? '#fff' : 'var(--pc-text-muted)', border: `1px solid ${active === t.id ? 'transparent' : 'var(--p7-color-border)'}` }}
          >
            {t.trigger.split(' ').slice(0, 2).join(' ')}
          </button>
        ))}
      </div>

      {/* Email preview */}
      <div style={{ border: `1px solid ${colors.border}`, borderRadius: 14, overflow: 'hidden' }}>
        {/* Fake email header */}
        <div style={{ background: colors.bg, borderBottom: `1px solid ${colors.border}`, padding: '0.875rem 1rem', display: 'grid', gap: '0.375rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#0F1419' }}>{template.subject}</div>
            <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 5, background: colors.badge, color: '#fff' }}>
              {template.trigger}
            </span>
          </div>
          <div style={{ display: 'flex', gap: '1rem', fontSize: 10, color: 'var(--pc-text-muted)' }}>
            <span>От: noreply · grainflow.ru</span>
            <span>Кому: {template.recipient}</span>
          </div>
        </div>

        {/* Email body */}
        <div style={{ padding: '1rem', background: '#fff' }}>
          {/* Platform logo stub */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', paddingBottom: '0.75rem', borderBottom: '1px solid #F1F5F9' }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: '#0A7A5F', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 14, fontWeight: 900 }}>П</div>
            <span style={{ fontSize: 12, fontWeight: 800, color: '#0A7A5F' }}>Прозрачная Цена</span>
            <span style={{ fontSize: 9, color: '#94A3B8', marginLeft: 'auto' }}>grainflow.ru</span>
          </div>

          {/* Body text with highlighted variables */}
          <div style={{ fontSize: 12, color: '#374151', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
            {template.body.split(/(\*\*[^*]+\*\*|\{\{[^}]+\}\})/g).map((part, i) => {
              if (part.startsWith('**') && part.endsWith('**')) {
                return <strong key={i}>{part.slice(2, -2)}</strong>;
              }
              if (part.startsWith('{{') && part.endsWith('}}')) {
                return <span key={i} style={{ background: 'rgba(124,58,237,0.1)', color: '#7C3AED', borderRadius: 3, padding: '0 3px', fontSize: 10, fontFamily: 'var(--font-mono)' }}>{part}</span>;
              }
              return part;
            })}
          </div>

          {/* Footer */}
          <div style={{ marginTop: '1.25rem', paddingTop: '0.875rem', borderTop: '1px solid #F1F5F9', fontSize: 9, color: '#94A3B8', display: 'flex', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span>Прозрачная Цена · B2B зерновая платформа</span>
            <span>Отписаться · Политика конфиденциальности (152-ФЗ)</span>
          </div>
        </div>
      </div>

      <div style={{ fontSize: 9, color: 'var(--pc-text-muted)', padding: '5px 9px', borderRadius: 7, background: 'var(--p7-color-surface-muted)', border: '1px solid var(--p7-color-border)' }}>
        Шаблон-превью. Переменные <code style={{ fontSize: 9, fontFamily: 'var(--font-mono)' }}>{`{{variable}}`}</code> заменяются данными события. Отправка через Resend/SendPulse с React Email в боевом контуре.
      </div>
    </div>
  );
}
