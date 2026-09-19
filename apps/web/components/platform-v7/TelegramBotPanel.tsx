'use client';

import { useState } from 'react';

type EventType = 'deal_status' | 'payment_released' | 'dispute_opened' | 'doc_signed' | 'kyc_required' | 'price_alert' | 'wagon_arrived' | 'arbitration';

interface NotificationRule {
  id: string;
  event: EventType;
  enabled: boolean;
  chatType: 'personal' | 'group';
  label: string;
  example: string;
}

const EVENT_LABELS: Record<EventType, string> = {
  deal_status:      'Изменение статуса сделки',
  payment_released: 'Выплата продавцу',
  dispute_opened:   'Открыт спор',
  doc_signed:       'Документ подписан',
  kyc_required:     'Требуется KYC',
  price_alert:      'Ценовой алерт',
  wagon_arrived:    'Вагон прибыл на станцию',
  arbitration:      'Решение арбитра',
};

const DEMO_RULES: NotificationRule[] = [
  { id: 'r1', event: 'deal_status', enabled: true, chatType: 'personal', label: 'Статус сделки', example: '🟡 DL-9106 · Статус изменён: В пути → Прибыл. Объём 120 т.' },
  { id: 'r2', event: 'payment_released', enabled: true, chatType: 'personal', label: 'Выплата', example: '💰 DL-9095 · Выплата 12 800 000 ₽ отправлена продавцу. Банк: подтверждение.' },
  { id: 'r3', event: 'dispute_opened', enabled: true, chatType: 'group', label: 'Спор открыт', example: '⚠️ DL-9102 · Открыт спор DK-2024-91. Причина: расхождение веса. Арбитраж активирован.' },
  { id: 'r4', event: 'doc_signed', enabled: false, chatType: 'personal', label: 'Подписание документа', example: '✅ УКЭП · Договор КП-2024-0195 подписан обеими сторонами.' },
  { id: 'r5', event: 'kyc_required', enabled: true, chatType: 'group', label: 'KYC требуется', example: '🛡 KYC · ООО МаслоПресс — ожидает верификации. AML: требует проверки.' },
  { id: 'r6', event: 'price_alert', enabled: false, chatType: 'personal', label: 'Ценовой алерт', example: '📈 Пшеница 3 кл · Цена достигла 15 200 ₽/т (+5.2% за 7 дней). Кубань.' },
  { id: 'r7', event: 'wagon_arrived', enabled: true, chatType: 'group', label: 'Вагон прибыл', example: '🚂 ЭТ-2024-089213 · Вагон 58441100 прибыл на ст. Азов-Порт. Выгрузка ожидается.' },
  { id: 'r8', event: 'arbitration', enabled: true, chatType: 'personal', label: 'Решение арбитра', example: '⚖️ DK-2024-89 · Арбитр вынес решение. Удержание 5%: 642 000 ₽ → продавцу 11 874 000 ₽.' },
];

const lbl: React.CSSProperties = { fontSize: 10, fontWeight: 900, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em' };

export function TelegramBotPanel() {
  const [rules, setRules] = useState<NotificationRule[]>(DEMO_RULES);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [testSent, setTestSent] = useState(false);

  function toggleRule(id: string) {
    setRules((prev) => prev.map((r) => r.id === id ? { ...r, enabled: !r.enabled } : r));
  }

  function handleConnect() {
    setConnecting(true);
    setTimeout(() => { setConnecting(false); setConnected(true); }, 1500);
  }

  function handleTest() {
    setTestSent(true);
    setTimeout(() => setTestSent(false), 3000);
  }

  const enabledCount = rules.filter((r) => r.enabled).length;

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      {/* Connection block */}
      <div style={{ padding: '14px 16px', borderRadius: 14, background: connected ? '#F0FDF4' : '#F0F9FF', border: `1px solid ${connected ? '#BBF7D0' : '#BAE6FD'}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 900, color: '#0F1419', display: 'flex', gap: 8, alignItems: 'center' }}>
              <span>🤖</span>
              <span>GrainFlow Bot</span>
              {connected && <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 999, background: '#D1FAE5', color: '#065F46' }}>✓ Подключён</span>}
            </div>
            <div style={{ fontSize: 11, color: '#64748B', marginTop: 4 }}>
              {connected
                ? `Активных уведомлений: ${enabledCount} · Чат: @grainflow_alerts · User ID: demo`
                : 'Уведомления о сделках, выплатах, спорах и документах прямо в Telegram'}
            </div>
          </div>
          {!connected ? (
            <button onClick={handleConnect} disabled={connecting} style={{ padding: '8px 16px', borderRadius: 10, border: 'none', background: '#2563EB', color: '#fff', cursor: connecting ? 'wait' : 'pointer', fontSize: 12, fontWeight: 800, opacity: connecting ? 0.7 : 1 }}>
              {connecting ? 'Подключение...' : 'Подключить Telegram'}
            </button>
          ) : (
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={handleTest} style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #BBF7D0', background: '#fff', cursor: 'pointer', fontSize: 11, fontWeight: 700, color: '#065F46' }}>
                {testSent ? '✓ Отправлено' : 'Тест'}
              </button>
              <button onClick={() => setConnected(false)} style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #FECACA', background: '#FFF1F1', cursor: 'pointer', fontSize: 11, fontWeight: 700, color: '#DC2626' }}>
                Отключить
              </button>
            </div>
          )}
        </div>

        {!connected && (
          <div style={{ marginTop: 12, padding: '10px 12px', borderRadius: 10, background: '#EFF6FF', border: '1px solid #BFDBFE' }}>
            <div style={lbl}>Как подключить</div>
            <ol style={{ margin: '6px 0 0', paddingLeft: 16, fontSize: 11, color: '#1E40AF', lineHeight: 1.8 }}>
              <li>Откройте Telegram, найдите <code style={{ fontFamily: 'monospace' }}>@GrainFlowBot</code></li>
              <li>Отправьте команду <code style={{ fontFamily: 'monospace' }}>/start</code></li>
              <li>Бот выдаст одноразовый код — вставьте его ниже</li>
            </ol>
          </div>
        )}
      </div>

      {/* Rules */}
      <div>
        <div style={{ ...lbl, marginBottom: 8 }}>Настройка уведомлений</div>
        <div style={{ display: 'grid', gap: 6 }}>
          {rules.map((rule) => (
            <div
              key={rule.id}
              style={{ padding: '10px 12px', borderRadius: 10, border: `1px solid ${rule.enabled ? '#BBF7D0' : '#E4E6EA'}`, background: rule.enabled ? '#F0FDF4' : '#F8FAFB', display: 'flex', gap: 10, alignItems: 'center' }}
            >
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', flex: 1, minWidth: 0 }}>
                <input
                  type="checkbox"
                  checked={rule.enabled}
                  onChange={() => toggleRule(rule.id)}
                  style={{ margin: 0, flexShrink: 0 }}
                />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#0F1419' }}>{rule.label}</div>
                  <div style={{ fontSize: 9, color: '#64748B' }}>
                    {rule.chatType === 'personal' ? '👤 личный чат' : '👥 групповой чат'}
                  </div>
                </div>
              </label>
              <button
                onClick={() => setPreview(preview === rule.id ? null : rule.id)}
                style={{ fontSize: 9, padding: '3px 8px', borderRadius: 6, border: '1px solid #E4E6EA', background: '#fff', cursor: 'pointer', color: '#64748B', fontWeight: 700, flexShrink: 0 }}
              >
                Пример
              </button>
              {preview === rule.id && (
                <div style={{ position: 'absolute' }} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Example preview */}
      {preview && (
        <div style={{ padding: '12px 14px', borderRadius: 12, background: '#0F1419', border: '1px solid #374151' }}>
          <div style={{ ...lbl, color: '#9CA3AF', marginBottom: 6 }}>Пример сообщения в Telegram</div>
          <div style={{ fontFamily: 'monospace', fontSize: 12, color: '#F9FAFB', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
            {rules.find((r) => r.id === preview)?.example}
          </div>
          <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
            <span style={{ display: 'inline-block', padding: '3px 8px', borderRadius: 6, background: '#1F2937', color: '#6EE7B7', fontSize: 10, fontWeight: 700 }}>Открыть сделку</span>
            <span style={{ display: 'inline-block', padding: '3px 8px', borderRadius: 6, background: '#1F2937', color: '#93C5FD', fontSize: 10, fontWeight: 700 }}>Детали</span>
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div style={{ padding: '10px 14px', borderRadius: 10, background: '#F8FAFB', border: '1px solid #E4E6EA' }}>
        <div style={{ ...lbl, marginBottom: 8 }}>Команды бота</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 6 }}>
          {[
            { cmd: '/deals', desc: 'Список активных сделок' },
            { cmd: '/status DL-XXXX', desc: 'Статус сделки' },
            { cmd: '/price пшеница', desc: 'Рыночная цена' },
            { cmd: '/profile', desc: 'Профиль компании' },
            { cmd: '/disputes', desc: 'Активные споры' },
            { cmd: '/help', desc: 'Список команд' },
          ].map((c) => (
            <div key={c.cmd} style={{ padding: '6px 8px', borderRadius: 6, background: '#fff', border: '1px solid #E4E6EA' }}>
              <code style={{ fontSize: 11, fontFamily: 'monospace', color: '#2563EB', fontWeight: 700 }}>{c.cmd}</code>
              <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 2 }}>{c.desc}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ fontSize: 9, color: '#94A3B8', padding: '4px 8px', borderRadius: 6, background: '#F8FAFB', border: '1px solid #E4E6EA' }}>
        Telegram Bot API · Уведомления в реальном времени через Kafka → Bot Sender · HMAC-верификация · Простые действия через бота · Демо-превью.
      </div>
    </div>
  );
}
