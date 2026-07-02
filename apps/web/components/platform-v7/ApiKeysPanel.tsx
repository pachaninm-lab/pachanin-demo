'use client';

import { useState } from 'react';

interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  createdAt: string;
  lastUsedAt: string | null;
  expiresAt: string;
  rateLimit: number;
  status: 'active' | 'rotated' | 'revoked';
}

const SCOPE_LABELS: Record<string, string> = {
  'deals:read': 'Сделки · чтение',
  'deals:write': 'Сделки · создание',
  'deals:status': 'Статус сделок',
  'webhooks:write': 'Вебхуки',
  'docs:read': 'Документы · чтение',
  'counterparties:read': 'Контрагенты · чтение',
  'analytics:read': 'Аналитика · чтение',
};

const ALL_SCOPES = Object.keys(SCOPE_LABELS);

const DEMO_KEYS: ApiKey[] = [
  {
    id: 'key-001',
    name: '1С:Предприятие ERP — АгроХолдинг Юг',
    prefix: 'gf_live_A1b2',
    scopes: ['deals:read', 'deals:write', 'deals:status', 'webhooks:write'],
    createdAt: '2024-01-10T09:00:00Z',
    lastUsedAt: '2024-03-14T18:42:11Z',
    expiresAt: '2024-04-10T09:00:00Z',
    rateLimit: 100,
    status: 'active',
  },
  {
    id: 'key-002',
    name: 'CRM Bitrix24 — Отдел продаж',
    prefix: 'gf_live_X9m3',
    scopes: ['deals:read', 'deals:status', 'counterparties:read'],
    createdAt: '2024-02-01T12:00:00Z',
    lastUsedAt: '2024-03-13T10:15:00Z',
    expiresAt: '2024-05-01T12:00:00Z',
    rateLimit: 60,
    status: 'active',
  },
  {
    id: 'key-003',
    name: 'Аналитика BI · Power BI коннектор',
    prefix: 'gf_live_P4k7',
    scopes: ['analytics:read', 'deals:read'],
    createdAt: '2023-12-15T08:00:00Z',
    lastUsedAt: null,
    expiresAt: '2024-03-15T08:00:00Z',
    rateLimit: 30,
    status: 'rotated',
  },
];

const ENDPOINTS = [
  { method: 'POST', path: '/api/v1/partner/deals', desc: 'Создать сделку от имени организации', rateLimit: '100/мин' },
  { method: 'GET',  path: '/api/v1/partner/deals/{id}/status', desc: 'Статус сделки', rateLimit: '200/мин' },
  { method: 'POST', path: '/api/v1/partner/webhooks', desc: 'Подписаться на события (callback URL)', rateLimit: '10/мин' },
  { method: 'GET',  path: '/api/v1/partner/counterparties/{inn}', desc: 'Профиль контрагента', rateLimit: '100/мин' },
];

const lbl: React.CSSProperties = { fontSize: 10, fontWeight: 900, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em' };
const methodColor: Record<string, string> = { GET: '#059669', POST: '#2563EB', DELETE: '#DC2626', PATCH: '#D97706' };

function daysBetween(a: string, b: string) {
  return Math.ceil((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000);
}

function ExpiryBar({ createdAt, expiresAt }: { createdAt: string; expiresAt: string }) {
  const total = daysBetween(createdAt, expiresAt);
  const elapsed = daysBetween(createdAt, new Date().toISOString());
  const pct = Math.min(100, Math.round((elapsed / total) * 100));
  const color = pct > 85 ? '#DC2626' : pct > 60 ? '#D97706' : '#0A7A5F';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10 }}>
      <div style={{ flex: 1, height: 4, borderRadius: 2, background: '#E4E6EA', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 2 }} />
      </div>
      <span style={{ color, minWidth: 32 }}>{100 - pct}%</span>
    </div>
  );
}

export function ApiKeysPanel() {
  const [keys] = useState<ApiKey[]>(DEMO_KEYS);
  const [showCreate, setShowCreate] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyScopes, setNewKeyScopes] = useState<Set<string>>(new Set(['deals:read', 'deals:status']));
  const [copied, setCopied] = useState<string | null>(null);
  const [tab, setTab] = useState<'keys' | 'endpoints'>('keys');

  function toggleScope(s: string) {
    setNewKeyScopes((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s); else next.add(s);
      return next;
    });
  }

  function handleCopy(prefix: string) {
    setCopied(prefix);
    setTimeout(() => setCopied(null), 2000);
  }

  const inp: React.CSSProperties = {
    width: '100%', padding: '7px 10px', borderRadius: 8, border: '1px solid #E4E6EA',
    fontSize: 13, fontWeight: 700, color: '#0F1419', background: '#F8FAFB', outline: 'none',
  };

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, background: '#F8FAFB', borderRadius: 999, padding: 3, border: '1px solid #E4E6EA', width: 'fit-content' }}>
        {(['keys', 'endpoints'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} style={{ padding: '4px 14px', borderRadius: 999, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 800, background: tab === t ? '#0F1419' : 'transparent', color: tab === t ? '#fff' : '#64748B' }}>
            {t === 'keys' ? 'API-ключи' : 'Эндпоинты'}
          </button>
        ))}
      </div>

      {tab === 'keys' && (
        <>
          {/* Key list */}
          <div style={{ display: 'grid', gap: 8 }}>
            {keys.map((key) => (
              <div key={key.id} style={{ padding: '12px 14px', borderRadius: 12, border: `1px solid ${key.status === 'active' ? '#BBF7D0' : '#E4E6EA'}`, background: key.status === 'active' ? '#F0FDF4' : '#F8FAFB' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#0F1419' }}>{key.name}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                      <code style={{ fontSize: 11, background: '#E8F0FE', color: '#1E40AF', padding: '2px 8px', borderRadius: 6, fontFamily: 'monospace' }}>
                        {key.prefix}·····
                      </code>
                      <button
                        onClick={() => handleCopy(key.prefix)}
                        style={{ fontSize: 10, padding: '2px 8px', borderRadius: 6, border: '1px solid #E4E6EA', background: '#fff', cursor: 'pointer', color: '#64748B', fontWeight: 700 }}
                      >
                        {copied === key.prefix ? '✓ Скопировано' : 'Копировать'}
                      </button>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <span style={{ fontSize: 10, fontWeight: 800, padding: '3px 8px', borderRadius: 999, background: key.status === 'active' ? '#D1FAE5' : key.status === 'rotated' ? '#FEF3C7' : '#FEE2E2', color: key.status === 'active' ? '#065F46' : key.status === 'rotated' ? '#92400E' : '#991B1B' }}>
                      {key.status === 'active' ? 'Активен' : key.status === 'rotated' ? 'Ротирован' : 'Отозван'}
                    </span>
                    {key.status === 'active' && (
                      <button style={{ fontSize: 10, padding: '3px 8px', borderRadius: 6, border: '1px solid #FECACA', background: '#FFF1F1', cursor: 'pointer', color: '#DC2626', fontWeight: 700 }}>
                        Отозвать
                      </button>
                    )}
                  </div>
                </div>

                <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {key.scopes.map((s) => (
                    <span key={s} style={{ fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: '#EDE9FE', color: '#5B21B6' }}>
                      {s}
                    </span>
                  ))}
                </div>

                <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 8 }}>
                  <div>
                    <div style={lbl}>Rate limit</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#0F1419', marginTop: 2 }}>{key.rateLimit} запр./мин</div>
                  </div>
                  <div>
                    <div style={lbl}>Последнее использование</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: key.lastUsedAt ? '#0F1419' : '#94A3B8', marginTop: 2 }}>
                      {key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleString('ru-RU') : 'Никогда'}
                    </div>
                  </div>
                  <div>
                    <div style={lbl}>Срок действия ({new Date(key.expiresAt).toLocaleDateString('ru-RU')})</div>
                    <ExpiryBar createdAt={key.createdAt} expiresAt={key.expiresAt} />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Create key */}
          {!showCreate ? (
            <button onClick={() => setShowCreate(true)} style={{ padding: '8px 16px', borderRadius: 10, border: '1px dashed #CBD5E1', background: '#F8FAFB', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: '#0A7A5F' }}>
              + Создать новый ключ
            </button>
          ) : (
            <div style={{ padding: '14px', borderRadius: 14, border: '1px solid #BFDBFE', background: '#EFF6FF' }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#1E3A8A', marginBottom: 12 }}>Новый API-ключ</div>
              <div style={{ display: 'grid', gap: 10 }}>
                <div>
                  <div style={{ ...lbl, marginBottom: 4 }}>Название интеграции</div>
                  <input value={newKeyName} onChange={(e) => setNewKeyName(e.target.value)} placeholder="Например: 1С ERP — Агрохолдинг" style={inp} />
                </div>
                <div>
                  <div style={{ ...lbl, marginBottom: 6 }}>Разрешения (scope)</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {ALL_SCOPES.map((s) => (
                      <label key={s} style={{ display: 'flex', gap: 5, alignItems: 'center', fontSize: 11, cursor: 'pointer', padding: '4px 8px', borderRadius: 6, background: newKeyScopes.has(s) ? '#DDD6FE' : '#fff', border: '1px solid #E4E6EA', fontWeight: newKeyScopes.has(s) ? 700 : 400, color: newKeyScopes.has(s) ? '#5B21B6' : '#64748B' }}>
                        <input type="checkbox" checked={newKeyScopes.has(s)} onChange={() => toggleScope(s)} style={{ margin: 0 }} />
                        {SCOPE_LABELS[s]}
                      </label>
                    ))}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    disabled={!newKeyName.trim() || newKeyScopes.size === 0}
                    style={{ padding: '7px 16px', borderRadius: 8, border: 'none', background: '#0F1419', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 700, opacity: (!newKeyName.trim() || newKeyScopes.size === 0) ? 0.5 : 1 }}
                  >
                    Сгенерировать ключ
                  </button>
                  <button onClick={() => setShowCreate(false)} style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid #E4E6EA', background: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: '#64748B' }}>
                    Отмена
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {tab === 'endpoints' && (
        <div style={{ display: 'grid', gap: 8 }}>
          {ENDPOINTS.map((ep) => (
            <div key={ep.path} style={{ padding: '12px 14px', borderRadius: 12, border: '1px solid #E4E6EA', background: '#F8FAFB' }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <span style={{ fontSize: 10, fontWeight: 900, padding: '3px 8px', borderRadius: 4, background: methodColor[ep.method] + '18', color: methodColor[ep.method], fontFamily: 'monospace', flexShrink: 0 }}>
                  {ep.method}
                </span>
                <code style={{ fontSize: 12, color: '#1E40AF', fontFamily: 'monospace', flex: 1 }}>{ep.path}</code>
                <span style={{ fontSize: 10, color: '#64748B', background: '#E4E6EA', padding: '2px 6px', borderRadius: 4, flexShrink: 0 }}>{ep.rateLimit}</span>
              </div>
              <div style={{ marginTop: 6, fontSize: 11, color: '#475569' }}>{ep.desc}</div>
            </div>
          ))}
          <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(37,99,235,0.06)', border: '1px solid rgba(37,99,235,0.15)', fontSize: 11, color: '#1E40AF', fontWeight: 600 }}>
            Авторизация: <code style={{ fontFamily: 'monospace' }}>Authorization: ApiKey gf_live_···</code> · HMAC-подпись + timestamp в заголовке · Replay protection: 5 мин окно
          </div>
        </div>
      )}

      <div style={{ padding: '8px 12px', borderRadius: 8, background: '#F8FAFB', border: '1px solid #E4E6EA', fontSize: 9, color: '#94A3B8' }}>
        Ключи хранятся в Vault (hash в БД, значение не отображается). Ротация: 90 дней или по требованию. Scope-based: ключ видит только разрешённые ресурсы. Демо-данные.
      </div>
    </div>
  );
}
