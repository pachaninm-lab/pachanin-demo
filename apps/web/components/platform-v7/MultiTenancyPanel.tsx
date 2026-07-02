'use client';

import { useState } from 'react';

interface SubAccount {
  id: string;
  name: string;
  inn: string;
  role: string;
  status: 'active' | 'pending' | 'suspended';
  dealsCount: number;
  gmvMlnRub: number;
  joinedAt: string;
  permissions: string[];
}

interface Cooperative {
  id: string;
  name: string;
  inn: string;
  region: string;
  memberCount: number;
  totalGmvMlnRub: number;
  sharedPoolTons: number;
  status: 'active' | 'draft';
}

const COOPERATIVES: Cooperative[] = [
  {
    id: 'coop-001',
    name: 'АгроКооператив Черноземье',
    inn: '3664012345',
    region: 'Воронежская обл.',
    memberCount: 14,
    totalGmvMlnRub: 847,
    sharedPoolTons: 12400,
    status: 'active',
  },
  {
    id: 'coop-002',
    name: 'Ставропольский зерновой пул',
    inn: '2636019876',
    region: 'Ставропольский край',
    memberCount: 8,
    totalGmvMlnRub: 412,
    sharedPoolTons: 6800,
    status: 'active',
  },
  {
    id: 'coop-003',
    name: 'Новый кооператив (черновик)',
    inn: '6829054321',
    region: 'Тамбовская обл.',
    memberCount: 3,
    totalGmvMlnRub: 0,
    sharedPoolTons: 0,
    status: 'draft',
  },
];

const SUB_ACCOUNTS: SubAccount[] = [
  {
    id: 'sub-001',
    name: 'ООО «АгроТрейд Юг» (дочерняя)',
    inn: '6164065090',
    role: 'Продавец',
    status: 'active',
    dealsCount: 47,
    gmvMlnRub: 612,
    joinedAt: '2024-01-10T00:00:00Z',
    permissions: ['deals:create', 'deals:read', 'docs:sign', 'bank:view'],
  },
  {
    id: 'sub-002',
    name: 'Элеватор ТМБ-03 (аффилиат)',
    inn: '6829099001',
    role: 'Элеватор',
    status: 'active',
    dealsCount: 23,
    gmvMlnRub: 235,
    joinedAt: '2024-02-01T00:00:00Z',
    permissions: ['elevator:accept', 'docs:read', 'deals:read'],
  },
  {
    id: 'sub-003',
    name: 'ИП Ковалёв С.А. (внешний)',
    inn: '2309160154',
    role: 'Продавец',
    status: 'pending',
    dealsCount: 12,
    gmvMlnRub: 89,
    joinedAt: '2024-03-01T00:00:00Z',
    permissions: ['deals:read'],
  },
];

const STATUS_CONFIG = {
  active:    { label: 'Активен',   bg: '#D1FAE5', color: '#065F46' },
  pending:   { label: 'На проверке', bg: '#FEF3C7', color: '#92400E' },
  suspended: { label: 'Приостановлен', bg: '#FEE2E2', color: '#991B1B' },
  draft:     { label: 'Черновик',  bg: '#F1F5F9', color: '#64748B' },
};

const lbl: React.CSSProperties = { fontSize: 10, fontWeight: 900, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em' };

function fmt(v: number) {
  if (v >= 1000) return `${(v / 1000).toFixed(1)} млрд ₽`;
  return `${v} млн ₽`;
}

export function MultiTenancyPanel() {
  const [tab, setTab] = useState<'sub' | 'coop' | 'pool'>('coop');
  const [selectedCoop, setSelectedCoop] = useState(COOPERATIVES[0].id);
  const coop = COOPERATIVES.find((c) => c.id === selectedCoop) ?? COOPERATIVES[0];

  const tabs: { key: typeof tab; label: string }[] = [
    { key: 'coop', label: 'Кооперативы' },
    { key: 'sub', label: 'Суб-аккаунты' },
    { key: 'pool', label: 'Общий пул заявок' },
  ];

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 8 }}>
        {[
          { label: 'Кооперативов', value: COOPERATIVES.filter((c) => c.status === 'active').length },
          { label: 'Суб-аккаунтов', value: SUB_ACCOUNTS.length },
          { label: 'Участников (всего)', value: COOPERATIVES.reduce((s, c) => s + c.memberCount, 0) },
          { label: 'Общий GMV', value: fmt(COOPERATIVES.reduce((s, c) => s + c.totalGmvMlnRub, 0)) },
        ].map((s) => (
          <div key={s.label} style={{ padding: '10px 12px', borderRadius: 10, background: '#F8FAFB', border: '1px solid #E4E6EA' }}>
            <div style={lbl}>{s.label}</div>
            <div style={{ fontSize: typeof s.value === 'number' ? 22 : 15, fontWeight: 900, color: '#0A7A5F', marginTop: 4 }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4 }}>
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{ padding: '5px 14px', borderRadius: 8, border: tab === t.key ? 'none' : '1px solid #E4E6EA', background: tab === t.key ? '#0F1419' : '#F8FAFB', color: tab === t.key ? '#fff' : '#64748B', fontSize: 11, fontWeight: 800, cursor: 'pointer' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Cooperatives tab */}
      {tab === 'coop' && (
        <div style={{ display: 'grid', gap: 8 }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {COOPERATIVES.map((c) => {
              const st = STATUS_CONFIG[c.status];
              return (
                <button
                  key={c.id}
                  onClick={() => setSelectedCoop(c.id)}
                  style={{ padding: '6px 14px', borderRadius: 10, border: selectedCoop === c.id ? '2px solid #0A7A5F' : '1px solid #E4E6EA', background: selectedCoop === c.id ? '#F0FDF4' : '#F8FAFB', cursor: 'pointer', fontSize: 11, fontWeight: 700, color: selectedCoop === c.id ? '#065F46' : '#374151' }}
                >
                  {c.name}
                </button>
              );
            })}
            <button style={{ padding: '6px 14px', borderRadius: 10, border: '1px dashed #CBD5E1', background: 'transparent', cursor: 'pointer', fontSize: 11, fontWeight: 700, color: '#0A7A5F' }}>
              + Создать кооператив
            </button>
          </div>

          {/* Selected coop detail */}
          <div style={{ padding: '14px', borderRadius: 14, border: '1px solid #BBF7D0', background: '#F0FDF4' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 900, color: '#0F1419' }}>{coop.name}</div>
                <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>ИНН {coop.inn} · {coop.region}</div>
              </div>
              <span style={{ fontSize: 10, fontWeight: 800, padding: '3px 10px', borderRadius: 999, background: STATUS_CONFIG[coop.status].bg, color: STATUS_CONFIG[coop.status].color }}>
                {STATUS_CONFIG[coop.status].label}
              </span>
            </div>
            <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 8 }}>
              {[
                { label: 'Участников', value: String(coop.memberCount) },
                { label: 'Общий GMV', value: fmt(coop.totalGmvMlnRub) },
                { label: 'Общий пул', value: `${coop.sharedPoolTons.toLocaleString('ru-RU')} т` },
                { label: 'Регион', value: coop.region },
              ].map((s) => (
                <div key={s.label} style={{ padding: '8px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.9)' }}>
                  <div style={lbl}>{s.label}</div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: '#0F1419', marginTop: 2 }}>{s.value}</div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button style={{ fontSize: 11, padding: '5px 12px', borderRadius: 8, border: '1px solid #BBF7D0', background: '#fff', cursor: 'pointer', color: '#065F46', fontWeight: 700 }}>
                Управление участниками
              </button>
              <button style={{ fontSize: 11, padding: '5px 12px', borderRadius: 8, border: '1px solid #E4E6EA', background: '#fff', cursor: 'pointer', color: '#374151', fontWeight: 700 }}>
                Настройки пула
              </button>
              <button style={{ fontSize: 11, padding: '5px 12px', borderRadius: 8, border: '1px solid #E4E6EA', background: '#fff', cursor: 'pointer', color: '#374151', fontWeight: 700 }}>
                Отчёт по кооперативу
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sub-accounts tab */}
      {tab === 'sub' && (
        <div style={{ display: 'grid', gap: 8 }}>
          {SUB_ACCOUNTS.map((acc) => {
            const st = STATUS_CONFIG[acc.status];
            return (
              <div key={acc.id} style={{ padding: '12px 14px', borderRadius: 12, border: `1px solid ${acc.status === 'active' ? '#BBF7D0' : '#E4E6EA'}`, background: acc.status === 'active' ? '#F0FDF4' : '#F8FAFB' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#0F1419' }}>{acc.name}</div>
                    <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 2 }}>ИНН {acc.inn} · {acc.role} · с {new Date(acc.joinedAt).toLocaleDateString('ru-RU')}</div>
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 800, padding: '3px 8px', borderRadius: 999, background: st.bg, color: st.color }}>{st.label}</span>
                </div>

                <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(100px,1fr))', gap: 6 }}>
                  {[
                    { label: 'Сделок', value: String(acc.dealsCount) },
                    { label: 'GMV', value: fmt(acc.gmvMlnRub) },
                  ].map((s) => (
                    <div key={s.label} style={{ padding: '6px 8px', borderRadius: 6, background: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.9)' }}>
                      <div style={lbl}>{s.label}</div>
                      <div style={{ fontSize: 12, fontWeight: 800, color: '#0F1419', marginTop: 1 }}>{s.value}</div>
                    </div>
                  ))}
                </div>

                <div style={{ marginTop: 8 }}>
                  <div style={{ ...lbl, marginBottom: 4 }}>Права</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {acc.permissions.map((p) => (
                      <span key={p} style={{ fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: '#EDE9FE', color: '#5B21B6' }}>{p}</span>
                    ))}
                    <button style={{ fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4, border: '1px dashed #CBD5E1', background: 'transparent', cursor: 'pointer', color: '#64748B' }}>+ право</button>
                  </div>
                </div>
              </div>
            );
          })}
          <button style={{ padding: '8px 16px', borderRadius: 10, border: '1px dashed #CBD5E1', background: '#F8FAFB', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: '#0A7A5F' }}>
            + Добавить суб-аккаунт
          </button>
        </div>
      )}

      {/* Shared pool tab */}
      {tab === 'pool' && (
        <div style={{ display: 'grid', gap: 10 }}>
          <div style={{ padding: '14px', borderRadius: 14, background: '#F0F9FF', border: '1px solid #BAE6FD' }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#0C4A6E', marginBottom: 8 }}>Общий пул заявок кооперативов</div>
            <div style={{ fontSize: 11, color: '#0369A1', lineHeight: 1.6 }}>
              Участники кооператива формируют консолидированную заявку из нескольких мелких партий. Покупатель видит единый лот — платформа автоматически распределяет объём между участниками пропорционально взносу.
            </div>
          </div>
          {[
            { label: 'POOL-2024-001', culture: 'Пшеница 3 кл', totalTons: 1850, members: 6, status: 'Собирается', filled: 72 },
            { label: 'POOL-2024-002', culture: 'Ячмень 2 кл', totalTons: 900, members: 4, status: 'Готов к торгам', filled: 100 },
            { label: 'POOL-2024-003', culture: 'Кукуруза', totalTons: 3200, members: 11, status: 'Открыт', filled: 38 },
          ].map((pool) => (
            <div key={pool.label} style={{ padding: '12px 14px', borderRadius: 12, border: '1px solid #E4E6EA', background: '#fff' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <span style={{ fontSize: 12, fontFamily: 'monospace', color: '#0A7A5F', fontWeight: 900 }}>{pool.label}</span>
                  <span style={{ fontSize: 12, color: '#374151', marginLeft: 8 }}>{pool.culture} · {pool.totalTons.toLocaleString('ru-RU')} т</span>
                </div>
                <span style={{ fontSize: 10, fontWeight: 800, padding: '3px 8px', borderRadius: 999, background: pool.filled === 100 ? '#D1FAE5' : '#FEF3C7', color: pool.filled === 100 ? '#065F46' : '#92400E' }}>
                  {pool.status}
                </span>
              </div>
              <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8, fontSize: 10 }}>
                <span style={{ color: '#64748B', minWidth: 70 }}>{pool.members} участников</span>
                <div style={{ flex: 1, height: 6, borderRadius: 3, background: '#E4E6EA', overflow: 'hidden' }}>
                  <div style={{ width: `${pool.filled}%`, height: '100%', background: pool.filled === 100 ? '#0A7A5F' : '#D97706', borderRadius: 3 }} />
                </div>
                <span style={{ color: pool.filled === 100 ? '#0A7A5F' : '#D97706', fontWeight: 700, minWidth: 36 }}>{pool.filled}%</span>
              </div>
            </div>
          ))}
          <button style={{ padding: '8px 16px', borderRadius: 10, border: '1px dashed #CBD5E1', background: '#F8FAFB', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: '#0A7A5F' }}>
            + Создать пул
          </button>
        </div>
      )}

      <div style={{ fontSize: 9, color: '#94A3B8', padding: '4px 8px', borderRadius: 6, background: '#F8FAFB', border: '1px solid #E4E6EA' }}>
        Multi-tenancy: кооперативы, суб-аккаунты, общий пул заявок · scope-based права · распределение GMV пропорционально взносу · Демо-данные.
      </div>
    </div>
  );
}
