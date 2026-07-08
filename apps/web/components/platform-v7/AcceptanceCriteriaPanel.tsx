'use client';

import { useState } from 'react';

type ItemStatus = 'ready' | 'planned' | 'external';

interface CriteriaItem {
  id: string;
  label: string;
  status: ItemStatus;
  note?: string;
}

interface CriteriaGroup {
  id: string;
  title: string;
  items: CriteriaItem[];
}

const GROUPS: CriteriaGroup[] = [
  {
    id: 'deal',
    title: 'Контур сделки',
    items: [
      { id: 'd1', label: 'Сделка является главным объектом системы', status: 'ready' },
      { id: 'd2', label: 'Аукцион, логистика, приёмка, лаборатория, документы, деньги и спор связаны со сделкой', status: 'ready' },
      { id: 'd3', label: 'Документная полнота влияет на движение сделки и банковскую проверку', status: 'ready' },
      { id: 'd4', label: 'Пакет доказательств должен подтверждаться промышленным хранилищем и регламентом экспорта', status: 'planned' },
    ],
  },
  {
    id: 'product',
    title: 'Продукт и UX',
    items: [
      { id: 'p1', label: 'Пользователь видит следующий шаг после входа', status: 'ready' },
      { id: 'p2', label: 'Интерфейс строится от намерений пользователя, а не от списка разделов', status: 'ready' },
      { id: 'p3', label: 'Mobile-first, единая шапка, единая навигация и RU/EN/ZH остаются обязательными', status: 'planned' },
      { id: 'p4', label: 'UI-smoke по всем ролям и ключевым страницам ещё должен быть пройден отдельно', status: 'planned' },
    ],
  },
  {
    id: 'platform',
    title: 'Промышленная платформа',
    items: [
      { id: 't1', label: 'Архитектура рассчитана на масштабирование без переписывания ядра сделки', status: 'ready' },
      { id: 't2', label: 'Нагрузочная проверка с отчётом остаётся обязательным этапом перед заявлением production proof', status: 'planned' },
      { id: 't3', label: 'Наблюдаемость, резервирование и восстановление оформлены как целевой эксплуатационный контур', status: 'planned' },
      { id: 't4', label: 'Исторические метрики и SLA нельзя заявлять без промышленной эксплуатации', status: 'external' },
    ],
  },
  {
    id: 'integrations',
    title: 'Внешние интеграции',
    items: [
      { id: 'e1', label: 'Банковый контур готовится к интеграции, но не считается подключённым', status: 'external' },
      { id: 'e2', label: 'Государственные контуры готовятся к интеграции, но требуют доступов и регламента', status: 'external' },
      { id: 'e3', label: 'Электронные документы и подпись требуют договоров, сертификатов и проверенного процесса', status: 'external' },
      { id: 'e4', label: 'Внешние ERP/CRM интеграции не должны подменять ядро сделки', status: 'planned' },
    ],
  },
  {
    id: 'legal',
    title: 'Юридическая исполнимость',
    items: [
      { id: 'l1', label: 'Регламент споров и доказательств должен быть закреплён документально', status: 'planned' },
      { id: 'l2', label: 'Пользовательские документы и оферта требуют юридического утверждения', status: 'planned' },
      { id: 'l3', label: 'Внешние договоры являются отдельными блокерами, а не технической готовностью', status: 'external' },
    ],
  },
];

const STATUS_CFG: Record<ItemStatus, { label: string; bg: string; color: string; icon: string }> = {
  ready: { label: 'Платформа', bg: '#D1FAE5', color: '#065F46', icon: '✓' },
  planned: { label: 'Доработка', bg: '#DBEAFE', color: '#1E40AF', icon: '◌' },
  external: { label: 'Интеграция', bg: '#FEF3C7', color: '#92400E', icon: '!' },
};

const lbl: React.CSSProperties = { fontSize: 10, fontWeight: 900, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em' };

export function AcceptanceCriteriaPanel() {
  const [openGroup, setOpenGroup] = useState<string | null>('deal');
  const allItems = GROUPS.flatMap(g => g.items);
  const ready = allItems.filter(i => i.status === 'ready').length;
  const planned = allItems.filter(i => i.status === 'planned').length;
  const external = allItems.filter(i => i.status === 'external').length;
  const pct = Math.round((ready / allItems.length) * 100);

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(110px,1fr))', gap: 8 }}>
        {[
          { label: 'Критериев', value: allItems.length, color: '#0F1419' },
          { label: 'Платформа', value: `${ready} (${pct}%)`, color: '#065F46' },
          { label: 'Доработка', value: planned, color: planned > 0 ? '#1E40AF' : '#065F46' },
          { label: 'Интеграции', value: external, color: external > 0 ? '#92400E' : '#065F46' },
        ].map((s) => (
          <div key={s.label} style={{ padding: '10px 12px', borderRadius: 10, background: '#F8FAFB', border: '1px solid #E4E6EA' }}>
            <div style={lbl}>{s.label}</div>
            <div style={{ fontSize: 14, fontWeight: 900, color: s.color, marginTop: 4 }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div style={{ padding: '8px 12px', borderRadius: 8, background: '#EFF6FF', border: '1px solid #BFDBFE' }}>
        <div style={{ fontSize: 9, color: '#1E40AF', fontWeight: 700, marginBottom: 6 }}>§17 Промышленная приёмка: настоящая платформа временно без интеграций</div>
        <div style={{ height: 8, borderRadius: 4, background: '#DBEAFE', overflow: 'hidden' }}>
          <div style={{ height: '100%', borderRadius: 4, background: 'linear-gradient(90deg, #1E40AF, #0EA5E9)', width: `${pct}%`, transition: 'width 0.4s' }} />
        </div>
        <div style={{ fontSize: 9, color: '#1E40AF', fontWeight: 700, marginTop: 4 }}>{pct}% — {ready}/{allItems.length} критериев платформы</div>
      </div>

      <div style={{ display: 'grid', gap: 8 }}>
        {GROUPS.map((group) => {
          const groupReady = group.items.filter(i => i.status === 'ready').length;
          const groupExternal = group.items.filter(i => i.status === 'external').length;
          const isOpen = openGroup === group.id;

          return (
            <div key={group.id} style={{ borderRadius: 10, border: '1px solid #E4E6EA', background: '#F8FAFB', overflow: 'hidden' }}>
              <button onClick={() => setOpenGroup(isOpen ? null : group.id)} style={{ width: '100%', textAlign: 'left', padding: '10px 12px', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: '#0F1419', flex: 1 }}>{group.title}</span>
                <span style={{ fontSize: 9, color: '#065F46', fontWeight: 700 }}>{groupReady}/{group.items.length}</span>
                {groupExternal > 0 && <span style={{ fontSize: 8, padding: '1px 5px', borderRadius: 3, background: '#FEF3C7', color: '#92400E', fontWeight: 800 }}>{groupExternal} интегр.</span>}
                <span style={{ fontSize: 10, color: '#94A3B8' }}>{isOpen ? '▲' : '▼'}</span>
              </button>

              {isOpen && (
                <div style={{ padding: '0 12px 10px', display: 'grid', gap: 5 }}>
                  {group.items.map((item) => {
                    const st = STATUS_CFG[item.status];
                    return (
                      <div key={item.id} style={{ padding: '6px 8px', borderRadius: 7, background: '#fff', border: '1px solid #E4E6EA' }}>
                        <div style={{ display: 'flex', gap: 7, alignItems: 'flex-start' }}>
                          <span style={{ fontSize: 8, fontWeight: 800, padding: '2px 5px', borderRadius: 3, background: st.bg, color: st.color, flexShrink: 0, marginTop: 1 }}>{st.icon}</span>
                          <span style={{ fontSize: 9, color: '#374151', flex: 1 }}>{item.label}</span>
                        </div>
                        {item.note && <div style={{ fontSize: 8, color: '#94A3B8', marginTop: 2, paddingLeft: 22 }}>{item.note}</div>}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ padding: '8px 12px', borderRadius: 8, background: '#ECFDF5', border: '1px solid #A7F3D0', fontSize: 9, color: '#065F46', fontWeight: 700, lineHeight: 1.7 }}>
        Статус: настоящая платформа временно без интеграций. Приёмка разделяет готовность платформы, доработки и внешние интеграции.
      </div>
    </div>
  );
}
