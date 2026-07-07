'use client';

import { useState } from 'react';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

interface ApiEndpoint {
  id: string;
  method: HttpMethod;
  path: string;
  summary: string;
  tags: string[];
  auth: string;
  requestBody?: string;
  responseExample: string;
  statusCodes: Array<{ code: number; desc: string }>;
}

const METHOD_CONFIG: Record<HttpMethod, { bg: string; color: string }> = {
  GET:    { bg: '#D1FAE5', color: '#065F46' },
  POST:   { bg: '#DBEAFE', color: '#1E40AF' },
  PUT:    { bg: '#FEF3C7', color: '#92400E' },
  DELETE: { bg: '#FEE2E2', color: '#991B1B' },
  PATCH:  { bg: '#EDE9FE', color: '#5B21B6' },
};

const ENDPOINTS: ApiEndpoint[] = [
  {
    id: 'ep-001', method: 'GET', path: '/api/v1/deals', summary: 'Список сделок с фильтрацией и пагинацией',
    tags: ['deals'], auth: 'Bearer JWT + role scope',
    responseExample: '{"data":[{"id":"DL-9095","status":"READY_FOR_BANK_STEP","amountKopecks":6264000000,"currency":"RUB"}],"meta":{"total":142,"page":1}}',
    statusCodes: [{ code: 200, desc: 'OK — список сделок' }, { code: 401, desc: 'Unauthorized' }, { code: 403, desc: 'Forbidden — роль не имеет доступа' }],
  },
  {
    id: 'ep-002', method: 'POST', path: '/api/v1/deals/{id}/bank-step', summary: 'Запрос банковского шага по сделке',
    tags: ['deals', 'money'], auth: 'Bearer JWT + operator policy',
    requestBody: '{"dealId":"DL-9095","operatorNote":"Условия закрыты","idempotencyKey":"bank-step.DL-9095.1"}',
    responseExample: '{"status":"BANK_STEP_REQUESTED","eventId":"EV-2026-00892","requiresExternalConfirmation":true}',
    statusCodes: [{ code: 202, desc: 'Accepted — запрос принят' }, { code: 409, desc: 'Conflict — открыт спор или не все условия' }, { code: 422, desc: 'Unprocessable — недостаточно документов' }],
  },
  {
    id: 'ep-003', method: 'POST', path: '/api/v1/disputes', summary: 'Создание спора по сделке',
    tags: ['disputes'], auth: 'Bearer JWT + role scope',
    requestBody: '{"dealId":"DL-9110","claimAmountKopecks":31200000,"reason":"quality_mismatch","description":"Показатель качества вне допуска"}',
    responseExample: '{"id":"DK-2026-91","status":"OPEN","holdAmountKopecks":31200000}',
    statusCodes: [{ code: 201, desc: 'Created — спор создан, сумма удержана' }, { code: 400, desc: 'Bad Request — сумма превышает доступное основание' }],
  },
  {
    id: 'ep-004', method: 'GET', path: '/api/v1/fgis/sdiz/{id}', summary: 'Статус СДИЗ из внешнего контура',
    tags: ['integrations', 'fgis'], auth: 'Bearer JWT + compliance scope',
    responseExample: '{"sdizId":"SDIZ-2026-00891","status":"REQUIRES_CONNECTION","culture":"пшеница","weight":195.3,"blockedReason":"external_access_required"}',
    statusCodes: [{ code: 200, desc: 'OK' }, { code: 404, desc: 'СДИЗ не найден' }, { code: 424, desc: 'Внешний источник требует подключения' }],
  },
  {
    id: 'ep-005', method: 'POST', path: '/settlement-engine/bank-event', summary: 'Событие банка после подключения',
    tags: ['money', 'bank'], auth: 'HMAC-SHA256 signature after bank onboarding',
    requestBody: '{"eventId":"EV-2026-00892","status":"CONFIRMED","confirmedAt":"2026-07-01T09:02:30Z","bankRef":"BANK-9095"}',
    responseExample: '{"received":true,"outboxId":"OB-2026-00892"}',
    statusCodes: [{ code: 200, desc: 'OK — событие принято' }, { code: 401, desc: 'Invalid signature' }],
  },
  {
    id: 'ep-006', method: 'GET', path: '/health', summary: 'Health check для runtime-проверки',
    tags: ['system'], auth: 'Нет',
    responseExample: '{"status":"UP","version":"pre-integration","checks":{"database":"UP","queue":"UP"}}',
    statusCodes: [{ code: 200, desc: 'UP — сервис отвечает' }, { code: 503, desc: 'DOWN — зависимость недоступна' }],
  },
];

const ALL_TAGS = Array.from(new Set(ENDPOINTS.flatMap(e => e.tags)));
const lbl: React.CSSProperties = { fontSize: 10, fontWeight: 900, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em' };

export function ApiDocPanel() {
  const [selected, setSelected] = useState<string | null>(null);
  const [tagFilter, setTagFilter] = useState<string>('all');

  const visible = tagFilter === 'all' ? ENDPOINTS : ENDPOINTS.filter(e => e.tags.includes(tagFilter));

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <div style={{ padding: '10px 14px', borderRadius: 10, background: '#F0FDF4', border: '1px solid #BBF7D0', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 800, color: '#065F46' }}>Прозрачная Цена API · OpenAPI 3.1.0</div>
          <div style={{ fontSize: 9, color: '#0A7A5F', marginTop: 2 }}>Base URL: /api/v1 · Format: JSON · Auth: Bearer JWT + HMAC для банковских событий</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={{ fontSize: 10, padding: '4px 10px', borderRadius: 6, border: '1px solid #BBF7D0', background: '#D1FAE5', cursor: 'pointer', fontWeight: 700, color: '#065F46' }}>OpenAPI</button>
          <button style={{ fontSize: 10, padding: '4px 10px', borderRadius: 6, border: '1px solid #E4E6EA', background: '#fff', cursor: 'pointer', fontWeight: 700, color: '#374151' }}>YAML</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {['all', ...ALL_TAGS].map((tag) => (
          <button key={tag} onClick={() => setTagFilter(tag)} style={{ padding: '3px 8px', borderRadius: 5, border: tagFilter === tag ? 'none' : '1px solid #E4E6EA', background: tagFilter === tag ? '#0F1419' : '#F8FAFB', color: tagFilter === tag ? '#fff' : '#64748B', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>
            {tag === 'all' ? 'Все' : tag}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gap: 4 }}>
        {visible.map((ep) => {
          const cfg = METHOD_CONFIG[ep.method];
          const isOpen = selected === ep.id;
          return (
            <div key={ep.id} style={{ borderRadius: 10, border: `1px solid ${isOpen ? '#0A7A5F' : '#E4E6EA'}`, overflow: 'hidden' }}>
              <button onClick={() => setSelected(isOpen ? null : ep.id)} style={{ width: '100%', padding: '8px 12px', display: 'flex', gap: 8, alignItems: 'center', background: isOpen ? '#F0FDF4' : '#F8FAFB', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                <span style={{ fontSize: 9, fontWeight: 900, padding: '2px 6px', borderRadius: 4, background: cfg.bg, color: cfg.color, minWidth: 38, textAlign: 'center', flexShrink: 0 }}>{ep.method}</span>
                <code style={{ fontSize: 10, fontWeight: 700, color: '#0F1419', flex: 1 }}>{ep.path}</code>
                <span style={{ fontSize: 9, color: '#64748B', flexShrink: 0, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ep.summary}</span>
              </button>
              {isOpen && (
                <div style={{ borderTop: '1px solid #E4E6EA', padding: '10px 12px', background: '#fff', display: 'grid', gap: 8 }}>
                  <div>
                    <div style={lbl}>Авторизация</div>
                    <div style={{ fontSize: 9, color: '#374151', marginTop: 2 }}>{ep.auth}</div>
                  </div>
                  {ep.requestBody && (
                    <div>
                      <div style={lbl}>Request Body</div>
                      <pre style={{ fontSize: 9, background: '#F8FAFB', border: '1px solid #E4E6EA', borderRadius: 6, padding: '6px 8px', margin: '4px 0 0', overflow: 'auto', color: '#0F1419', fontFamily: 'monospace', lineHeight: 1.5 }}>{ep.requestBody}</pre>
                    </div>
                  )}
                  <div>
                    <div style={lbl}>Response Example</div>
                    <pre style={{ fontSize: 9, background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 6, padding: '6px 8px', margin: '4px 0 0', overflow: 'auto', color: '#065F46', fontFamily: 'monospace', lineHeight: 1.5 }}>{ep.responseExample}</pre>
                  </div>
                  <div>
                    <div style={lbl}>Статус коды</div>
                    <div style={{ display: 'grid', gap: 2, marginTop: 4 }}>
                      {ep.statusCodes.map((sc) => (
                        <div key={sc.code} style={{ display: 'flex', gap: 8, fontSize: 9 }}>
                          <span style={{ fontWeight: 900, fontFamily: 'monospace', color: sc.code < 300 ? '#065F46' : sc.code < 500 ? '#92400E' : '#991B1B', minWidth: 28 }}>{sc.code}</span>
                          <span style={{ color: '#374151' }}>{sc.desc}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ fontSize: 9, color: '#94A3B8', padding: '4px 8px', borderRadius: 6, background: '#F8FAFB', border: '1px solid #E4E6EA' }}>
        OpenAPI 3.1.0 · REST JSON · JWT Bearer + HMAC для банковских событий · Versioning: /api/v1/ · предынтеграционный контур.
      </div>
    </div>
  );
}
