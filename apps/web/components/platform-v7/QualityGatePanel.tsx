'use client';

import { useState } from 'react';

type GateStatus = 'ready' | 'planned' | 'required';

interface QualityGate {
  id: string;
  category: string;
  check: string;
  threshold: string;
  actual: string;
  status: GateStatus;
  tool: string;
  blocksRelease: boolean;
}

interface E2EScenario {
  num: number;
  name: string;
  status: GateStatus;
  evidence: string;
}

const GATES: QualityGate[] = [
  { id: 'g-01', category: 'Tests', check: 'Unit coverage', threshold: 'целевой порог ≥ 85%', actual: 'нужен текущий отчёт', status: 'required', tool: 'test runner', blocksRelease: true },
  { id: 'g-02', category: 'Tests', check: 'Integration scenarios', threshold: 'ключевые сценарии без падений', actual: 'нужен текущий отчёт', status: 'required', tool: 'test suite', blocksRelease: true },
  { id: 'g-03', category: 'Build', check: 'Application build', threshold: 'сборка проходит на активном deploy-контуре', actual: 'подтверждается Railway status', status: 'ready', tool: 'deploy pipeline', blocksRelease: true },
  { id: 'g-04', category: 'E2E', check: 'Critical deal path', threshold: 'полный путь сделки подтверждён', actual: 'нужен browser-прогон', status: 'planned', tool: 'browser tests', blocksRelease: true },
  { id: 'g-05', category: 'Performance', check: 'Load profile', threshold: 'профиль на тысячи пользователей', actual: 'нужен нагрузочный отчёт', status: 'required', tool: 'load test', blocksRelease: true },
  { id: 'g-06', category: 'Performance', check: 'Response targets', threshold: 'целевые p95 и error budget', actual: 'нужны live-метрики', status: 'required', tool: 'monitoring', blocksRelease: false },
  { id: 'g-07', category: 'UI', check: 'Mobile smoke', threshold: 'нет белых экранов, перекрытий и горизонтального скролла', actual: 'нужен UI-smoke', status: 'planned', tool: 'manual/browser smoke', blocksRelease: true },
  { id: 'g-08', category: 'UI', check: 'Language coverage', threshold: 'RU/EN/ZH без непереведённых элементов', actual: 'нужна проверка словарей', status: 'planned', tool: 'i18n review', blocksRelease: false },
  { id: 'g-09', category: 'UI', check: 'Core Web Vitals', threshold: 'целевые метрики на фактическом домене', actual: 'нужно измерение', status: 'planned', tool: 'browser metrics', blocksRelease: false },
  { id: 'g-10', category: 'Data', check: 'Client data exposure review', threshold: 'чувствительные данные не уходят в клиентский слой', actual: 'нужен отдельный отчёт', status: 'required', tool: 'code review', blocksRelease: true },
];

const E2E_SCENARIOS: E2EScenario[] = [
  { num: 1, name: 'Цена → аукцион → сделка', status: 'planned', evidence: 'нужен полный browser-прогон' },
  { num: 2, name: 'Сделка → логистика → приёмка', status: 'planned', evidence: 'нужна проверка мобильного сценария' },
  { num: 3, name: 'Лаборатория → документы → банковская проверка', status: 'planned', evidence: 'только readiness, без fake payout' },
  { num: 4, name: 'Спор → evidence bundle → закрытие', status: 'planned', evidence: 'нужна проверка доказательного пакета' },
  { num: 5, name: 'Роли и права доступа', status: 'required', evidence: 'нужен отдельный access-smoke' },
  { num: 6, name: 'Повторные операции без дублей', status: 'required', evidence: 'нужен технический отчёт' },
  { num: 7, name: 'Нагрузка и безопасная деградация', status: 'required', evidence: 'нужен нагрузочный прогон' },
  { num: 8, name: 'RU/EN/ZH и единая навигация', status: 'planned', evidence: 'нужен UI-smoke' },
];

const STATUS_CFG: Record<GateStatus, { label: string; bg: string; color: string; icon: string }> = {
  ready: { label: 'READY', bg: '#D1FAE5', color: '#065F46', icon: '✓' },
  planned: { label: 'PLANNED', bg: '#DBEAFE', color: '#1E40AF', icon: '◌' },
  required: { label: 'REQUIRED', bg: '#FEF3C7', color: '#92400E', icon: '!' },
};

const CATEGORY_COLOR: Record<string, string> = {
  Tests: '#6366F1', Build: '#0F1419', E2E: '#10B981', Performance: '#F59E0B', UI: '#8B5CF6', Data: '#B45309',
};

const lbl: React.CSSProperties = { fontSize: 10, fontWeight: 900, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em' };

type Tab = 'gates' | 'e2e';

export function QualityGatePanel() {
  const [tab, setTab] = useState<Tab>('gates');
  const [filterCategory, setFilterCategory] = useState<string>('');

  const ready = GATES.filter(g => g.status === 'ready').length;
  const required = GATES.filter(g => g.status === 'required').length;
  const blockers = GATES.filter(g => g.blocksRelease && g.status !== 'ready').length;
  const categories = [...new Set(GATES.map(g => g.category))];
  const filtered = filterCategory ? GATES.filter(g => g.category === filterCategory) : GATES;

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(110px,1fr))', gap: 8 }}>
        {[
          { label: 'Гейтов', value: GATES.length, color: '#0F1419' },
          { label: 'READY', value: ready, color: '#065F46' },
          { label: 'REQUIRED', value: required, color: required > 0 ? '#92400E' : '#065F46' },
          { label: 'Release blockers', value: blockers, color: blockers > 0 ? '#DC2626' : '#065F46' },
        ].map((s) => (
          <div key={s.label} style={{ padding: '10px 12px', borderRadius: 10, background: '#F8FAFB', border: '1px solid #E4E6EA' }}>
            <div style={lbl}>{s.label}</div>
            <div style={{ fontSize: 14, fontWeight: 900, color: s.color, marginTop: 4 }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div style={{ padding: '8px 12px', borderRadius: 8, background: '#EFF6FF', border: '1px solid #BFDBFE', fontSize: 9, color: '#1E40AF', fontWeight: 700, lineHeight: 1.6 }}>
        §15.4 Quality Gate · панель показывает требования к качеству и evidence-based readiness. PASS, coverage, нагрузка и E2E не заявляются без сохранённых отчётов текущего прогона.
      </div>

      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
        {([['gates', 'Quality Gates'], ['e2e', 'E2E сценарии']] as const).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} style={{ padding: '4px 10px', borderRadius: 6, border: tab === id ? 'none' : '1px solid #E4E6EA', background: tab === id ? '#0F1419' : '#F8FAFB', color: tab === id ? '#fff' : '#64748B', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'gates' && (
        <div style={{ display: 'grid', gap: 8 }}>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
            <button onClick={() => setFilterCategory('')} style={{ padding: '3px 8px', borderRadius: 5, fontSize: 9, fontWeight: 700, cursor: 'pointer', background: !filterCategory ? '#0F1419' : '#F8FAFB', color: !filterCategory ? '#fff' : '#64748B', border: !filterCategory ? 'none' : '1px solid #E4E6EA' }}>
              Все
            </button>
            {categories.map(cat => (
              <button key={cat} onClick={() => setFilterCategory(cat)} style={{ padding: '3px 8px', borderRadius: 5, fontSize: 9, fontWeight: 700, cursor: 'pointer', background: filterCategory === cat ? CATEGORY_COLOR[cat] : '#F8FAFB', color: filterCategory === cat ? '#fff' : '#64748B', border: filterCategory === cat ? 'none' : '1px solid #E4E6EA' }}>
                {cat}
              </button>
            ))}
          </div>

          {filtered.map((gate) => {
            const st = STATUS_CFG[gate.status];
            return (
              <div key={gate.id} style={{ padding: '7px 10px', borderRadius: 8, background: gate.status === 'required' ? '#FFFBEB' : '#F8FAFB', border: `1px solid ${gate.status === 'required' ? '#FDE68A' : '#E4E6EA'}` }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 8, fontWeight: 800, padding: '2px 5px', borderRadius: 3, background: st.bg, color: st.color }}>{st.icon} {st.label}</span>
                  <span style={{ fontSize: 8, fontWeight: 800, color: CATEGORY_COLOR[gate.category] ?? '#374151' }}>[{gate.category}]</span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#0F1419', flex: 1 }}>{gate.check}</span>
                  <span style={{ fontSize: 9, fontWeight: 900, color: st.color }}>{gate.actual}</span>
                  {gate.blocksRelease && <span style={{ fontSize: 8, padding: '1px 4px', borderRadius: 3, background: '#FEE2E2', color: '#DC2626', fontWeight: 800 }}>release gate</span>}
                </div>
                <div style={{ fontSize: 9, color: '#94A3B8', marginTop: 1 }}>Порог: {gate.threshold} · {gate.tool}</div>
              </div>
            );
          })}
        </div>
      )}

      {tab === 'e2e' && (
        <div style={{ display: 'grid', gap: 5 }}>
          <div style={lbl}>Критические E2E сценарии · требуется подтверждение</div>
          {E2E_SCENARIOS.map((sc) => {
            const st = STATUS_CFG[sc.status];
            return (
              <div key={sc.num} style={{ padding: '7px 10px', borderRadius: 8, background: sc.status === 'required' ? '#FFFBEB' : '#F8FAFB', border: `1px solid ${sc.status === 'required' ? '#FDE68A' : '#E4E6EA'}` }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 10, fontWeight: 900, color: '#94A3B8', width: 20, flexShrink: 0 }}>{sc.num}</span>
                  <span style={{ fontSize: 8, fontWeight: 800, padding: '2px 5px', borderRadius: 3, background: st.bg, color: st.color }}>{st.icon} {st.label}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#0F1419', flex: 1 }}>{sc.name}</span>
                </div>
                <div style={{ fontSize: 9, color: '#94A3B8', marginTop: 2 }}>{sc.evidence}</div>
              </div>
            );
          })}
          <div style={{ padding: '6px 10px', borderRadius: 8, background: '#EFF6FF', border: '1px solid #BFDBFE', fontSize: 9, color: '#1E40AF', fontWeight: 700 }}>
            E2E readiness: сценарии определены; результаты должны появляться только из фактического прогона.
          </div>
        </div>
      )}
    </div>
  );
}
