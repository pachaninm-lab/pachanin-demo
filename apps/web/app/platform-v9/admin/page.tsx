'use client';
import * as React from 'react';
import { Users, Shield, Plus, Edit2, Trash2, ToggleLeft, ToggleRight, Settings2, Bell, ChevronDown } from 'lucide-react';
import { Badge } from '@/components/v9/ui/badge';
import { Button } from '@/components/v9/ui/button';
import { KpiCard } from '@/components/v9/cards/KpiCard';
import { useSessionStore } from '@/stores/useSessionStore';
import { roleLabels } from '@/lib/v9/roles';
import { toast } from 'sonner';

interface UserRecord {
  id: string;
  name: string;
  email: string;
  role: string;
  status: 'active' | 'suspended' | 'pending';
  lastLogin: string;
  dealsCount: number;
}

const USERS: UserRecord[] = [
  { id: 'USR-001', name: 'Смирнов А.В.', email: 'smirnov@platform.ru', role: 'operator', status: 'active', lastLogin: '2024-04-12T09:00:00Z', dealsCount: 42 },
  { id: 'USR-002', name: 'Агро-Юг ООО', email: 'contact@agro-yug.ru', role: 'seller', status: 'active', lastLogin: '2024-04-12T10:15:00Z', dealsCount: 8 },
  { id: 'USR-003', name: 'Агрохолдинг СК', email: 'deals@agro-sk.ru', role: 'buyer', status: 'active', lastLogin: '2024-04-12T11:30:00Z', dealsCount: 12 },
  { id: 'USR-004', name: 'Ковалёв А.С.', email: 'kovalev@transport.ru', role: 'driver', status: 'active', lastLogin: '2024-04-12T07:45:00Z', dealsCount: 15 },
  { id: 'USR-005', name: 'Лаб. ЦентрГрейн', email: 'lab@centergrain.ru', role: 'lab', status: 'active', lastLogin: '2024-04-11T16:00:00Z', dealsCount: 30 },
  { id: 'USR-006', name: 'Элеватор Черноземный', email: 'elevator@chernoz.ru', role: 'elevator', status: 'active', lastLogin: '2024-04-12T08:20:00Z', dealsCount: 20 },
  { id: 'USR-007', name: 'Сбербанк (API)', email: 'api@sber.ru', role: 'bank', status: 'active', lastLogin: '2024-04-12T12:00:00Z', dealsCount: 99 },
  { id: 'USR-008', name: 'Петрова О.Н.', email: 'petrova@arbitration.ru', role: 'arbitrator', status: 'active', lastLogin: '2024-04-10T14:00:00Z', dealsCount: 5 },
  { id: 'USR-009', name: 'Иванов К.Д.', email: 'ivanov@compliance.ru', role: 'compliance', status: 'active', lastLogin: '2024-04-12T09:50:00Z', dealsCount: 0 },
  { id: 'USR-010', name: 'Новый пользователь', email: 'new@test.ru', role: 'buyer', status: 'pending', lastLogin: '', dealsCount: 0 },
  { id: 'USR-011', name: 'Сидоров П.М.', email: 'sidorov@test.ru', role: 'seller', status: 'suspended', lastLogin: '2024-03-01T10:00:00Z', dealsCount: 2 },
];

const roleColors: Record<string, string> = {
  operator: '#0A7A5F', buyer: '#0284C7', seller: '#16A34A', driver: '#D97706',
  lab: '#7C3AED', elevator: '#0891B2', bank: '#1D4ED8',
  arbitrator: '#DC2626', compliance: '#6B778C', admin: '#0F1419',
};

const platformSettings = [
  { key: 'sandbox_mode', label: 'SANDBOX режим', description: 'Все финансовые операции симулированы', value: true },
  { key: 'sla_alerts', label: 'SLA уведомления', description: 'Email-алерты за 3 дня до дедлайна', value: true },
  { key: 'auto_escalation', label: 'Автоэскалация споров', description: 'Автоматически после 72ч без арбитра', value: false },
  { key: 'fgis_sync', label: 'ФГИС Зерно интеграция', description: 'Синхронизация паспортов качества', value: true },
  { key: 'ai_suggestions', label: 'AI-рекомендации', description: 'Контекстные подсказки для всех ролей', value: true },
];

const PERMS = ['deal.view', 'deal.edit', 'release.request', 'release.approve', 'doc.upload', 'doc.verify', 'dispute.open', 'dispute.resolve'];
const PERM_LABELS: Record<string, string> = {
  'deal.view': 'Просмотр сделок',
  'deal.edit': 'Редакт. сделок',
  'release.request': 'Запрос выпуска',
  'release.approve': 'Одобрение выпуска',
  'doc.upload': 'Загрузка докум.',
  'doc.verify': 'Верификация докум.',
  'dispute.open': 'Открытие спора',
  'dispute.resolve': 'Закрытие спора',
};

const PERM_ROWS = [
  { role: 'operator',   perms: [true, true, true, true, true, true, true, true] },
  { role: 'buyer',      perms: [true, false, true, false, false, false, true, false] },
  { role: 'seller',     perms: [true, false, false, false, true, false, false, false] },
  { role: 'driver',     perms: [true, false, false, false, false, false, false, false] },
  { role: 'lab',        perms: [true, false, false, false, true, true, false, false] },
  { role: 'bank',       perms: [true, false, false, true, false, false, false, false] },
  { role: 'arbitrator', perms: [true, false, false, false, true, true, true, true] },
  { role: 'compliance', perms: [true, false, false, false, false, true, false, false] },
];

export default function AdminPage() {
  const demoMode = useSessionStore(s => s.demoMode);
  const [users, setUsers] = React.useState(USERS);
  const [settings, setSettings] = React.useState(platformSettings);
  const [activeTab, setActiveTab] = React.useState<'users' | 'settings' | 'notifications'>('users');
  const [expandedRole, setExpandedRole] = React.useState<string | null>(null);

  const toggleUserStatus = (id: string) => {
    setUsers(prev => prev.map(u => {
      if (u.id !== id) return u;
      const newStatus = u.status === 'active' ? 'suspended' : 'active';
      toast.success(demoMode
        ? `[SANDBOX] ${u.name}: статус изменён → ${newStatus === 'active' ? 'Активен' : 'Приостановлен'}`
        : `${u.name}: статус изменён`);
      return { ...u, status: newStatus };
    }));
  };

  const toggleSetting = (key: string) => {
    setSettings(prev => prev.map(s => {
      if (s.key !== key) return s;
      toast.success(demoMode
        ? `[SANDBOX] Настройка "${s.label}": ${!s.value ? 'включена' : 'выключена'}`
        : `Настройка "${s.label}" обновлена`);
      return { ...s, value: !s.value };
    }));
  };

  const totalActive = users.filter(u => u.status === 'active').length;
  const totalPending = users.filter(u => u.status === 'pending').length;
  const totalSuspended = users.filter(u => u.status === 'suspended').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ borderLeft: '4px solid #0F1419', paddingLeft: 16 }}>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: '#0F1419', margin: 0 }}>Администрирование</h1>
          <p style={{ fontSize: 13, color: '#6B778C', marginTop: 4 }}>Управление пользователями, роли и настройки платформы</p>
        </div>
        <Button
          variant="primary"
          size="sm"
          onClick={() => toast.success(demoMode ? '[SANDBOX] Форма создания пользователя открыта' : 'Создание пользователя')}
        >
          <Plus size={13} style={{ marginRight: 4 }} />Добавить пользователя
        </Button>
      </div>

      <div className="v9-bento">
        <KpiCard title="Всего пользователей" value={String(users.length)} tone="neutral" />
        <KpiCard
          title="Активных"
          value={String(totalActive)}
          tone="success"
          sub={`Приостановлено: ${totalSuspended} · Ожидает: ${totalPending}`}
        />
        <KpiCard title="Ожидают подтверждения" value={String(totalPending)} tone="warning" sub="Требуют ручной проверки" />
        <KpiCard title="Приостановлено" value={String(totalSuspended)} tone={totalSuspended > 0 ? 'danger' : 'neutral'} sub="Доступ заблокирован" />
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 2, borderBottom: '1px solid #E4E6EA', overflowX: 'auto' }}>
        {[
          { id: 'users' as const, label: 'Пользователи', icon: <Users size={13} /> },
          { id: 'settings' as const, label: 'Настройки', icon: <Settings2 size={13} /> },
          { id: 'notifications' as const, label: 'Уведомления', icon: <Bell size={13} /> },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 14px', border: 'none', background: 'none',
              cursor: 'pointer', fontSize: 13, fontWeight: activeTab === tab.id ? 700 : 400,
              color: activeTab === tab.id ? '#0A7A5F' : '#6B778C',
              borderBottom: activeTab === tab.id ? '2px solid #0A7A5F' : '2px solid transparent',
              marginBottom: -1, whiteSpace: 'nowrap', flexShrink: 0,
            }}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Users tab */}
      {activeTab === 'users' && (
        <section className="v9-card">
          <div className="v9-table-wrap">
            <table className="v9-table v9-table-mobile-cards">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Пользователь</th>
                  <th>Роль</th>
                  <th>Статус</th>
                  <th>Последний вход</th>
                  <th style={{ textAlign: 'right' }}>Сделок</th>
                  <th>Действия</th>
                </tr>
              </thead>
              <tbody>
                {users.map(user => (
                  <tr key={user.id}>
                    <td data-label="ID" style={{ fontFamily: '"JetBrains Mono",monospace', fontSize: 11, color: '#6B778C' }}>{user.id}</td>
                    <td data-label="Пользователь">
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{user.name}</div>
                      <div style={{ fontSize: 11, color: '#6B778C' }}>{user.email}</div>
                    </td>
                    <td data-label="Роль">
                      <span style={{
                        display: 'inline-block', padding: '2px 8px', borderRadius: 4,
                        fontSize: 11, fontWeight: 700,
                        background: `${roleColors[user.role] ?? '#6B778C'}18`,
                        color: roleColors[user.role] ?? '#6B778C',
                      }}>
                        {roleLabels[user.role as keyof typeof roleLabels] ?? user.role}
                      </span>
                    </td>
                    <td data-label="Статус">
                      <Badge
                        variant={user.status === 'active' ? 'success' : user.status === 'pending' ? 'warning' : 'danger'}
                        dot
                      >
                        {user.status === 'active' ? 'Активен' : user.status === 'pending' ? 'Ожидает' : 'Приостановлен'}
                      </Badge>
                    </td>
                    <td data-label="Последний вход" style={{ fontSize: 12, color: '#6B778C' }}>
                      {user.lastLogin
                        ? new Date(user.lastLogin).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
                        : '—'}
                    </td>
                    <td data-label="Сделок" style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: 12 }}>{user.dealsCount}</td>
                    <td className="v9-td-no-label">
                      <div className="v9-card-actions">
                        <button
                          onClick={() => toast.success(demoMode ? `[SANDBOX] Редактирование ${user.name}` : `Редактирование ${user.name}`)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B778C', padding: 4, borderRadius: 4 }}
                          title="Редактировать"
                          aria-label={`Редактировать ${user.name}`}
                        >
                          <Edit2 size={12} />
                        </button>
                        <button
                          onClick={() => toggleUserStatus(user.id)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: user.status === 'active' ? '#D97706' : '#16A34A', padding: 4, borderRadius: 4 }}
                          title={user.status === 'active' ? 'Приостановить' : 'Активировать'}
                          aria-label={user.status === 'active' ? `Приостановить ${user.name}` : `Активировать ${user.name}`}
                        >
                          {user.status === 'active' ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                        </button>
                        {user.status !== 'active' && (
                          <button
                            onClick={() => {
                              setUsers(prev => prev.filter(u => u.id !== user.id));
                              toast.success(demoMode ? `[SANDBOX] ${user.name} удалён` : `${user.name} удалён`);
                            }}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#DC2626', padding: 4, borderRadius: 4 }}
                            title="Удалить"
                            aria-label={`Удалить ${user.name}`}
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Settings tab */}
      {activeTab === 'settings' && (
        <section className="v9-card">
          <h2 style={{ fontSize: 13, fontWeight: 700, marginBottom: 14 }}>Настройки платформы</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {settings.map(setting => (
              <div key={setting.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', background: '#FAFAFA', borderRadius: 6, border: '1px solid #E4E6EA' }}>
                <div style={{ flex: 1, minWidth: 0, marginRight: 12 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{setting.label}</div>
                  <div style={{ fontSize: 11, color: '#6B778C', marginTop: 2 }}>{setting.description}</div>
                </div>
                <button
                  onClick={() => toggleSetting(setting.key)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: setting.value ? '#0A7A5F' : '#6B778C', flexShrink: 0 }}
                  aria-label={`Переключить ${setting.label}`}
                  aria-checked={setting.value}
                  role="switch"
                >
                  {setting.value ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Notifications tab */}
      {activeTab === 'notifications' && (
        <section className="v9-card">
          <h2 style={{ fontSize: 13, fontWeight: 700, marginBottom: 14 }}>Настройки уведомлений</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { label: 'SLA дедлайн (3 дня)', target: 'Оператор, Арбитратор', channel: 'Email + Push' },
              { label: 'Новый спор открыт', target: 'Оператор, Банк', channel: 'Email' },
              { label: 'Расхождение (Mismatch)', target: 'Оператор, Банк, Комплаенс', channel: 'Email + SMS' },
              { label: 'Выпуск одобрен', target: 'Продавец, Покупатель', channel: 'Email + Push' },
              { label: 'Документ загружен', target: 'Оператор', channel: 'Push' },
              { label: 'Офлайн-события (>10)', target: 'Оператор', channel: 'Email' },
            ].map((n, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: '#FAFAFA', borderRadius: 6, border: '1px solid #E4E6EA', flexWrap: 'wrap', gap: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600 }}>{n.label}</div>
                  <div style={{ fontSize: 11, color: '#6B778C' }}>{n.target}</div>
                </div>
                <div className="v9-card-actions">
                  <Badge variant="neutral">{n.channel}</Badge>
                  <button
                    onClick={() => toast.success(demoMode ? `[SANDBOX] Настройка "${n.label}" изменена` : `Настройка "${n.label}" сохранена`)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#0A7A5F', padding: 4 }}
                    aria-label={`Изменить настройку "${n.label}"`}
                  >
                    <Edit2 size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Permission matrix */}
      <section className="v9-card">
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 14 }}>
          <Shield size={14} color="#7C3AED" aria-hidden />
          <h2 style={{ fontSize: 13, fontWeight: 700, margin: 0 }}>Матрица прав доступа</h2>
        </div>

        {/* Desktop: sticky-first-column table */}
        <div className="v9-desktop-only" style={{ overflowX: 'auto' }}>
          <table className="v9-table v9-matrix-table">
            <thead>
              <tr>
                <th>Роль</th>
                {PERMS.map(p => (
                  <th key={p} style={{ fontSize: 10, whiteSpace: 'nowrap' }} title={PERM_LABELS[p]}>{p}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PERM_ROWS.map(({ role, perms }) => (
                <tr key={role}>
                  <td>
                    <span style={{ fontSize: 12, fontWeight: 600, color: roleColors[role] ?? '#495057' }}>
                      {roleLabels[role as keyof typeof roleLabels]}
                    </span>
                  </td>
                  {perms.map((has, i) => (
                    <td key={i} style={{ textAlign: 'center' }}>
                      {has
                        ? <span style={{ color: '#16A34A', fontSize: 14 }} aria-label="Разрешено">✓</span>
                        : <span style={{ color: '#E4E6EA', fontSize: 14 }} aria-label="Запрещено">—</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile: accordion by role */}
        <div className="v9-mobile-only" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {PERM_ROWS.map(({ role, perms }) => {
            const isExpanded = expandedRole === role;
            const grantedPerms = PERMS.filter((_, i) => perms[i]);
            return (
              <div key={role} style={{ border: '1px solid #E4E6EA', borderRadius: 8, overflow: 'hidden' }}>
                <button
                  onClick={() => setExpandedRole(isExpanded ? null : role)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '10px 12px', background: isExpanded ? 'rgba(10,122,95,0.04)' : '#FAFAFA',
                    border: 'none', cursor: 'pointer', textAlign: 'left',
                  }}
                  aria-expanded={isExpanded}
                >
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: roleColors[role] ?? '#495057' }}>
                      {roleLabels[role as keyof typeof roleLabels]}
                    </span>
                    <Badge variant="neutral">{grantedPerms.length} прав</Badge>
                  </div>
                  <ChevronDown
                    size={14}
                    color="#6B778C"
                    style={{ transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}
                  />
                </button>
                {isExpanded && (
                  <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 6, borderTop: '1px solid #E4E6EA' }}>
                    {PERMS.map((perm, i) => (
                      <div key={perm} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                        {perms[i]
                          ? <span style={{ color: '#16A34A', fontWeight: 700, width: 14 }}>✓</span>
                          : <span style={{ color: '#C1C7D0', fontWeight: 700, width: 14 }}>—</span>}
                        <span style={{ color: perms[i] ? '#0F1419' : '#6B778C' }}>{PERM_LABELS[perm]}</span>
                        <code style={{ fontSize: 10, color: '#6B778C', marginLeft: 'auto' }}>{perm}</code>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
