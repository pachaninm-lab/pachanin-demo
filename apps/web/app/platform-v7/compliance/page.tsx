'use client';
import * as React from 'react';
import { Shield, Search, Download, Filter, CheckCircle2, XCircle, AlertTriangle, Eye } from 'lucide-react';
import { Badge } from '@/components/v9/ui/badge';
import { Button } from '@/components/v9/ui/button';
import { KpiCard } from '@/components/v9/cards/KpiCard';
import { useSessionStore } from '@/stores/useSessionStore';
import { toast } from 'sonner';

interface AuditEntry {
  id: string;
  ts: string;
  actor: string;
  role: string;
  action: string;
  entity: string;
  entityId: string;
  result: 'ok' | 'warn' | 'blocked';
  ip: string;
  details: string;
}

const AUDIT_DATA: AuditEntry[] = [
  { id: 'AUD-001', ts: '2024-04-12T09:15:22Z', actor: 'Оператор Смирнов', role: 'operator', action: 'release.approve', entity: 'deal', entityId: 'DL-9103', result: 'ok', ip: '10.0.1.14', details: 'Release 1 820 000 ₽ одобрен после верификации документов' },
  { id: 'AUD-002', ts: '2024-04-12T09:42:10Z', actor: 'Банк Сбер', role: 'bank', action: 'callback.receive', entity: 'callback', entityId: 'CB-442', result: 'warn', ip: '185.60.1.2', details: 'Mismatch callback CB-442: расхождение 0.8% протеина, автоматически переведён в ручной разбор' },
  { id: 'AUD-003', ts: '2024-04-12T10:05:01Z', actor: 'Продавец Агро-Юг', role: 'seller', action: 'doc.upload', entity: 'document', entityId: 'DOC-LAB-2847', result: 'ok', ip: '10.0.2.55', details: 'Загружен протокол лаборатории ЛАБ-2847 (PDF, 1.2MB)' },
  { id: 'AUD-004', ts: '2024-04-12T10:31:44Z', actor: 'Арбитр Петрова', role: 'arbitrator', action: 'dispute.open', entity: 'dispute', entityId: 'DK-2024-89', result: 'ok', ip: '10.0.3.7', details: 'Открыт спор о качестве зерна: 16.8% vs 14% влажность кукурузы' },
  { id: 'AUD-005', ts: '2024-04-12T11:00:00Z', actor: 'Система', role: 'operator', action: 'sla.alert', entity: 'dispute', entityId: 'DK-2024-89', result: 'warn', ip: 'internal', details: 'SLA alert: осталось 6 дней до дедлайна арбитража' },
  { id: 'AUD-006', ts: '2024-04-12T11:22:15Z', actor: 'Комплаенс Иванов', role: 'compliance', action: 'doc.verify', entity: 'document', entityId: 'DOC-FGIS-9102', result: 'ok', ip: '10.0.4.12', details: 'Паспорт ФГИС Зерно DL-9102 верифицирован, расхождение допустимое' },
  { id: 'AUD-007', ts: '2024-04-12T12:15:30Z', actor: 'Покупатель Агрохолдинг', role: 'buyer', action: 'release.request', entity: 'deal', entityId: 'DL-9102', result: 'blocked', ip: '10.0.5.3', details: 'Запрос release заблокирован: активный спор DK-2024-89 + незакрытый CB-442' },
  { id: 'AUD-008', ts: '2024-04-12T13:45:00Z', actor: 'Лаборатория ЦентрГрейн', role: 'lab', action: 'field.submit', entity: 'quality_check', entityId: 'QC-DL-9102', result: 'warn', ip: '10.0.6.1', details: 'Протокол лаборатории: влажность 16.2% (норма ≤14%), ГМО отрицательно, спорные показатели переданы арбитру' },
  { id: 'AUD-009', ts: '2024-04-12T14:05:22Z', actor: 'Водитель Ковалёв', role: 'driver', action: 'field.submit', entity: 'event', entityId: 'EVT-ARRIVAL-9102', result: 'ok', ip: 'mobile', details: 'Подтверждено прибытие на площадку. GPS: 51.2934, 37.2185. Элеватор Черноземный' },
  { id: 'AUD-010', ts: '2024-04-12T15:30:00Z', actor: 'Элеватор Черноземный', role: 'elevator', action: 'doc.upload', entity: 'document', entityId: 'DOC-ELEVATOR-9102', result: 'ok', ip: '10.0.7.88', details: 'Загружена накладная элеватора, взвешивание 200.3 т (отклонение 0.15%)' },
];

const actionLabels: Record<string, string> = {
  'release.approve': 'Release одобрен',
  'release.request': 'Запрос release',
  'callback.receive': 'Callback получен',
  'doc.upload': 'Документ загружен',
  'doc.verify': 'Документ верифицирован',
  'dispute.open': 'Спор открыт',
  'field.submit': 'Полевое событие',
  'sla.alert': 'SLA уведомление',
};

export default function CompliancePage() {
  const demoMode = useSessionStore(s => s.demoMode);
  const [search, setSearch] = React.useState('');
  const [filterResult, setFilterResult] = React.useState<string>('all');
  const [expandedId, setExpandedId] = React.useState<string | null>(null);

  const filtered = AUDIT_DATA.filter(e => {
    const matchSearch = !search || [e.actor, e.action, e.entityId, e.id, e.details].some(f => f.toLowerCase().includes(search.toLowerCase()));
    const matchFilter = filterResult === 'all' || e.result === filterResult;
    return matchSearch && matchFilter;
  });

  const totalOk = AUDIT_DATA.filter(e => e.result === 'ok').length;
  const totalWarn = AUDIT_DATA.filter(e => e.result === 'warn').length;
  const totalBlocked = AUDIT_DATA.filter(e => e.result === 'blocked').length;

  const handleExport = () => {
    // Build CSV from the filtered audit entries so the export matches what
    // the user actually sees on screen. Escape fields with commas/quotes.
    const esc = (s: string) => `"${String(s).replace(/"/g, '""')}"`;
    const header = 'ID,Время,Актор,Роль,Действие,Объект,Результат,IP,Описание';
    const rows = filtered.map(e =>
      [e.id, e.ts, e.actor, e.role, e.action, `${e.entity}:${e.entityId}`, e.result, e.ip, e.details]
        .map(esc)
        .join(',')
    );
    const csv = '\uFEFF' + [header, ...rows].join('\n'); // BOM for Excel cyrillic
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-log-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast.success(
      demoMode
        ? `[SANDBOX] Аудит-лог экспортирован (${filtered.length} записей)`
        : `Аудит-лог экспортирован (${filtered.length} записей)`
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ borderLeft: '4px solid #7C3AED', paddingLeft: 16 }}>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: '#0F1419', margin: 0 }}>Комплаенс</h1>
          <p style={{ fontSize: 13, color: '#6B778C', marginTop: 4 }}>Аудит-лог всех действий, верификация документов и регуляторная отчётность</p>
        </div>
        <Button variant="ghost" size="sm" onClick={handleExport}>
          <Download size={13} style={{ marginRight: 4 }} />
          Экспорт CSV
        </Button>
      </div>

      {/* KPI row */}
      <div className="v9-bento">
        <KpiCard title="Всего событий" value={String(AUDIT_DATA.length)} tone="neutral" sub="За последние 24 ч" />
        <KpiCard title="Успешных" value={String(totalOk)} tone="success" sub={`${Math.round(totalOk/AUDIT_DATA.length*100)}% событий`} />
        <KpiCard title="Предупреждений" value={String(totalWarn)} tone="warning" sub="Требует внимания" />
        <KpiCard title="Заблокировано" value={String(totalBlocked)} tone="danger" sub="Нарушения политики" />
      </div>

      {/* Compliance status */}
      <section className="v9-card">
        <h2 style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Статус регуляторного соответствия</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[
            { label: 'ФГИС Зерно API', status: 'ok', detail: 'Интеграция активна, последний sync 5 мин назад' },
            { label: 'Верификация документов ФЗ-264', status: 'ok', detail: '100% документов по активным сделкам верифицированы' },
            { label: 'Арбитражный регламент', status: 'warn', detail: 'DK-2024-89: требует эксперта, SLA 6 дней' },
            { label: 'KYC / AML проверки', status: 'ok', detail: 'Все стороны активных сделок проверены' },
            { label: 'Аудит trail 63-ФЗ', status: 'ok', detail: 'Полный трейл, нет пропусков' },
          ].map(item => (
            <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: '#FAFAFA', borderRadius: 6, border: '1px solid #E4E6EA' }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                {item.status === 'ok' ? <CheckCircle2 size={14} color="#16A34A" /> : <AlertTriangle size={14} color="#D97706" />}
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600 }}>{item.label}</div>
                  <div style={{ fontSize: 11, color: '#6B778C', marginTop: 1 }}>{item.detail}</div>
                </div>
              </div>
              <Badge variant={item.status === 'ok' ? 'success' : 'warning'}>
                {item.status === 'ok' ? 'Соответствует' : 'Требует внимания'}
              </Badge>
            </div>
          ))}
        </div>
      </section>

      {/* Audit log */}
      <section className="v9-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
          <h2 style={{ fontSize: 13, fontWeight: 700, margin: 0 }}>Аудит-лог</h2>
          <div className="v9-audit-toolbar">
            <div style={{ position: 'relative' }}>
              <Search size={12} color="#6B778C" style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)' }} />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Поиск..."
                aria-label="Поиск по аудит-логу"
                style={{ paddingLeft: 26, paddingRight: 8, paddingTop: 5, paddingBottom: 5, border: '1px solid #E4E6EA', borderRadius: 6, fontSize: 12, outline: 'none', width: 140 }}
              />
            </div>
            <select
              value={filterResult}
              onChange={e => setFilterResult(e.target.value)}
              aria-label="Фильтр по результату"
              style={{ padding: '4px 8px', border: '1px solid #E4E6EA', borderRadius: 6, fontSize: 12, color: '#495057' }}
            >
              <option value="all">Все</option>
              <option value="ok">OK</option>
              <option value="warn">Предупр.</option>
              <option value="blocked">Блокировано</option>
            </select>
          </div>
        </div>

        <div className="v9-table-wrap">
          <table className="v9-table v9-table-mobile-cards">
            <thead>
              <tr>
                <th>ID</th>
                <th>Время</th>
                <th>Актор</th>
                <th>Действие</th>
                <th>Объект</th>
                <th>Итог</th>
                <th>IP</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: 24, color: '#6B778C', fontSize: 13 }}>Нет результатов</td></tr>
              ) : filtered.map(entry => (
                <React.Fragment key={entry.id}>
                  <tr
                    style={{ cursor: 'pointer', background: expandedId === entry.id ? 'rgba(10,122,95,0.04)' : undefined }}
                    onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
                  >
                    <td data-label="ID" style={{ fontFamily: '"JetBrains Mono",monospace', fontSize: 11, color: '#6B778C' }}>{entry.id}</td>
                    <td data-label="Время" style={{ fontSize: 11, color: '#6B778C', whiteSpace: 'nowrap' }}>
                      {new Date(entry.ts).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </td>
                    <td data-label="Актор">
                      <div style={{ fontSize: 12, fontWeight: 500 }}>{entry.actor}</div>
                      <div style={{ fontSize: 10, color: '#6B778C' }}>{entry.role}</div>
                    </td>
                    <td data-label="Действие">
                      <Badge variant={entry.result === 'ok' ? 'success' : entry.result === 'warn' ? 'warning' : 'danger'}>
                        {actionLabels[entry.action] ?? entry.action}
                      </Badge>
                    </td>
                    <td data-label="Объект" style={{ fontFamily: '"JetBrains Mono",monospace', fontSize: 11, color: '#0A7A5F' }}>
                      {entry.entityId}
                    </td>
                    <td data-label="Итог">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        {entry.result === 'ok' && <><CheckCircle2 size={14} color="#16A34A" aria-hidden /><span className="sr-only">Успешно</span></>}
                        {entry.result === 'warn' && <><AlertTriangle size={14} color="#D97706" aria-hidden /><span style={{ fontSize: 11, color: '#D97706' }}>Предупр.</span></>}
                        {entry.result === 'blocked' && <><XCircle size={14} color="#DC2626" aria-hidden /><span style={{ fontSize: 11, color: '#DC2626' }}>Блок</span></>}
                      </div>
                    </td>
                    <td data-label="IP" style={{ fontSize: 11, color: '#6B778C', fontFamily: 'monospace' }}>{entry.ip}</td>
                    <td className="v9-td-no-label">
                      <button
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B778C', padding: '2px 4px' }}
                        aria-label={`Детали записи ${entry.id}`}
                        onClick={e => { e.stopPropagation(); setExpandedId(expandedId === entry.id ? null : entry.id); }}
                      >
                        <Eye size={12} />
                      </button>
                    </td>
                  </tr>
                  {expandedId === entry.id && (
                    <tr style={{ background: 'rgba(10,122,95,0.03)' }}>
                      <td colSpan={8} style={{ padding: '8px 12px', fontSize: 12, color: '#495057', borderBottom: '1px solid #E4E6EA' }}>
                        <strong>Детали:</strong> {entry.details}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ marginTop: 10, fontSize: 11, color: '#6B778C', textAlign: 'right' }}>
          {filtered.length} из {AUDIT_DATA.length} записей
          {demoMode && ' · SANDBOX-данные'}
        </div>
      </section>

      {/* Document verification queue */}
      <section className="v9-card">
        <h2 style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Очередь верификации документов</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[
            { id: 'DOC-FGIS-9110', deal: 'DL-9110', type: 'Паспорт ФГИС Зерно', status: 'pending', submittedAt: '2024-04-12T08:00:00Z' },
            { id: 'DOC-LAB-9110', deal: 'DL-9110', type: 'Протокол лаборатории', status: 'reviewing', submittedAt: '2024-04-12T09:30:00Z' },
            { id: 'DOC-CONTRACT-9112', deal: 'DL-9112', type: 'Контракт купли-продажи', status: 'pending', submittedAt: '2024-04-12T11:00:00Z' },
          ].map(doc => (
            <div key={doc.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: '#FAFAFA', borderRadius: 6, border: '1px solid #E4E6EA' }}>
              <div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ fontFamily: '"JetBrains Mono",monospace', fontSize: 11, color: '#6B778C' }}>{doc.id}</span>
                  <span style={{ fontSize: 12, fontWeight: 600 }}>{doc.type}</span>
                  <Badge variant="neutral" style={{ fontSize: 10 }}>{doc.deal}</Badge>
                </div>
                <div style={{ fontSize: 11, color: '#6B778C', marginTop: 2 }}>
                  Подан {new Date(doc.submittedAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
              <div className="v9-card-actions">
                <Badge variant={doc.status === 'reviewing' ? 'warning' : 'neutral'}>
                  {doc.status === 'reviewing' ? 'На проверке' : 'Ожидает'}
                </Badge>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => toast.success(demoMode ? `[SANDBOX] ${doc.id} верифицирован` : `${doc.id} верифицирован`)}
                >
                  Верифицировать
                </Button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
