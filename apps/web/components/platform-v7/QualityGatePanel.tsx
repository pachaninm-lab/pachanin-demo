'use client';

import { useState } from 'react';

type GateStatus = 'pass' | 'fail' | 'warn' | 'skip';

interface QualityGate {
  id: string;
  category: string;
  check: string;
  threshold: string;
  actual: string;
  status: GateStatus;
  tool: string;
  blocksBuild: boolean;
}

interface E2EScenario {
  num: number;
  name: string;
  pass: boolean;
  durationSec: number;
}

const GATES: QualityGate[] = [
  { id: 'g-01', category: 'Coverage',    check: 'Unit test coverage',         threshold: '≥ 85%',          actual: '87.4%',       status: 'pass', tool: 'Vitest + Istanbul', blocksBuild: true },
  { id: 'g-02', category: 'Coverage',    check: 'Integration tests pass',     threshold: '100%',           actual: '100%',        status: 'pass', tool: 'Jest + Supertest',  blocksBuild: true },
  { id: 'g-03', category: 'SAST',        check: 'SonarQube Critical/Blocker', threshold: '0 issues',       actual: '0 issues',    status: 'pass', tool: 'SonarQube',         blocksBuild: true },
  { id: 'g-04', category: 'SAST',        check: 'SonarQube High',             threshold: '≤ 2 issues',     actual: '1 issue',     status: 'pass', tool: 'SonarQube',         blocksBuild: false },
  { id: 'g-05', category: 'Security',    check: 'Trivy High+ CVE (prod img)', threshold: '0 CVE',          actual: '0 CVE',       status: 'pass', tool: 'Trivy',             blocksBuild: true },
  { id: 'g-06', category: 'Security',    check: 'GitLeaks — secrets in code', threshold: '0 secrets',      actual: '0 secrets',   status: 'pass', tool: 'GitLeaks',          blocksBuild: true },
  { id: 'g-07', category: 'E2E',         check: 'Critical scenarios pass',    threshold: '100%',           actual: '100% (8/8)',  status: 'pass', tool: 'Playwright',        blocksBuild: true },
  { id: 'g-08', category: 'Performance', check: 'k6 p95 latency',            threshold: '< 500 мс',       actual: '312 мс',      status: 'pass', tool: 'k6',                blocksBuild: true },
  { id: 'g-09', category: 'Performance', check: 'k6 error rate',             threshold: '< 1%',           actual: '0.12%',       status: 'pass', tool: 'k6',                blocksBuild: true },
  { id: 'g-10', category: 'UI',          check: 'Lighthouse LCP',             threshold: '< 2.5 сек',      actual: '1.8 сек',     status: 'pass', tool: 'Lighthouse CI',     blocksBuild: false },
  { id: 'g-11', category: 'UI',          check: 'Bundle size (initial)',       threshold: '< 200 КБ',       actual: '187 КБ',      status: 'pass', tool: 'Webpack Analyzer',  blocksBuild: false },
  { id: 'g-12', category: 'Types',       check: 'TypeScript strict errors',   threshold: '0 errors',       actual: '0 errors',    status: 'pass', tool: 'tsc --strict',      blocksBuild: true },
  { id: 'g-13', category: 'Data',        check: 'DataExposureGuard',          threshold: '0 leaks',        actual: '0 leaks',     status: 'pass', tool: 'Custom script',     blocksBuild: true },
  { id: 'g-14', category: 'Container',   check: 'Docker build success',       threshold: 'PASS',           actual: 'PASS',        status: 'pass', tool: 'Docker',            blocksBuild: true },
  { id: 'g-15', category: 'Lint',        check: 'ESLint errors',              threshold: '0 errors',       actual: '0 errors',    status: 'pass', tool: 'ESLint',            blocksBuild: true },
];

const E2E_SCENARIOS: E2EScenario[] = [
  { num: 1, name: 'Full deal cycle (21 шаг)',                 pass: true,  durationSec: 47 },
  { num: 2, name: 'Dispute resolution (арбитр + settlement)', pass: true,  durationSec: 31 },
  { num: 3, name: 'Offline driver (sync + конфликт)',         pass: true,  durationSec: 22 },
  { num: 4, name: 'Integration failure + graceful degradation', pass: true, durationSec: 18 },
  { num: 5, name: 'Security: unauthorized access → audit',   pass: true,  durationSec: 8 },
  { num: 6, name: 'Money invariants: double release reject',  pass: true,  durationSec: 12 },
  { num: 7, name: 'Scale: 1000 concurrent users',            pass: true,  durationSec: 180 },
  { num: 8, name: 'MFA enforcement: финансовая операция',    pass: true,  durationSec: 15 },
];

const STATUS_CFG: Record<GateStatus, { label: string; bg: string; color: string; icon: string }> = {
  pass: { label: 'PASS', bg: '#D1FAE5', color: '#065F46', icon: '✓' },
  fail: { label: 'FAIL', bg: '#FEE2E2', color: '#DC2626', icon: '✗' },
  warn: { label: 'WARN', bg: '#FEF3C7', color: '#92400E', icon: '⚠' },
  skip: { label: 'SKIP', bg: '#F1F5F9', color: '#64748B', icon: '○' },
};

const CATEGORY_COLOR: Record<string, string> = {
  Coverage: '#6366F1', SAST: '#0EA5E9', Security: '#DC2626', E2E: '#10B981',
  Performance: '#F59E0B', UI: '#8B5CF6', Types: '#0F1419', Container: '#64748B', Lint: '#374151', Data: '#B45309',
};

const lbl: React.CSSProperties = { fontSize: 10, fontWeight: 900, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em' };

type Tab = 'gates' | 'e2e';

export function QualityGatePanel() {
  const [tab, setTab] = useState<Tab>('gates');
  const [filterCategory, setFilterCategory] = useState<string>('');

  const pass = GATES.filter(g => g.status === 'pass').length;
  const blockers = GATES.filter(g => g.blocksBuild && g.status !== 'pass').length;
  const categories = [...new Set(GATES.map(g => g.category))];

  const filtered = filterCategory ? GATES.filter(g => g.category === filterCategory) : GATES;

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(110px,1fr))', gap: 8 }}>
        {[
          { label: 'Гейтов',        value: GATES.length, color: '#0F1419' },
          { label: 'PASS',          value: pass,         color: '#065F46' },
          { label: 'Блокируют CI',  value: GATES.filter(g => g.blocksBuild).length, color: '#1E40AF' },
          { label: 'Блокеров',      value: blockers,     color: blockers > 0 ? '#DC2626' : '#065F46' },
        ].map((s) => (
          <div key={s.label} style={{ padding: '10px 12px', borderRadius: 10, background: '#F8FAFB', border: '1px solid #E4E6EA' }}>
            <div style={lbl}>{s.label}</div>
            <div style={{ fontSize: 14, fontWeight: 900, color: s.color, marginTop: 4 }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div style={{ padding: '8px 12px', borderRadius: 8, background: blockers === 0 ? '#ECFDF5' : '#FEF2F2', border: `1px solid ${blockers === 0 ? '#A7F3D0' : '#FECACA'}`, fontSize: 9, color: blockers === 0 ? '#065F46' : '#DC2626', fontWeight: 700, lineHeight: 1.6 }}>
        §15.4 Quality Gate · CI блокируется при: coverage &lt;85% · Trivy High+ CVE · GitLeaks · Playwright fail · k6 p95 &gt;500мс · TypeScript errors · {blockers === 0 ? 'Все ворота PASS — сборка разрешена' : `${blockers} блокеров!`}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
        {([['gates', 'Quality Gates'], ['e2e', 'E2E сценарии (§15.2)']] as const).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} style={{ padding: '4px 10px', borderRadius: 6, border: tab === id ? 'none' : '1px solid #E4E6EA', background: tab === id ? '#0F1419' : '#F8FAFB', color: tab === id ? '#fff' : '#64748B', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'gates' && (
        <div style={{ display: 'grid', gap: 8 }}>
          {/* Category filter */}
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
              <div key={gate.id} style={{ padding: '7px 10px', borderRadius: 8, background: gate.status === 'fail' ? '#FEF2F2' : '#F8FAFB', border: `1px solid ${gate.status === 'fail' ? '#FECACA' : '#E4E6EA'}` }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 8, fontWeight: 800, padding: '2px 5px', borderRadius: 3, background: st.bg, color: st.color }}>{st.icon} {st.label}</span>
                  <span style={{ fontSize: 8, fontWeight: 800, color: CATEGORY_COLOR[gate.category] ?? '#374151' }}>[{gate.category}]</span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#0F1419', flex: 1 }}>{gate.check}</span>
                  <span style={{ fontSize: 9, fontWeight: 900, color: st.color }}>{gate.actual}</span>
                  {gate.blocksBuild && <span style={{ fontSize: 8, padding: '1px 4px', borderRadius: 3, background: '#FEE2E2', color: '#DC2626', fontWeight: 800 }}>CI block</span>}
                </div>
                <div style={{ fontSize: 9, color: '#94A3B8', marginTop: 1 }}>Порог: {gate.threshold} · {gate.tool}</div>
              </div>
            );
          })}
        </div>
      )}

      {tab === 'e2e' && (
        <div style={{ display: 'grid', gap: 5 }}>
          <div style={lbl}>8 критических E2E сценариев (Playwright)</div>
          {E2E_SCENARIOS.map((sc) => (
            <div key={sc.num} style={{ padding: '7px 10px', borderRadius: 8, background: sc.pass ? '#F8FAFB' : '#FEF2F2', border: `1px solid ${sc.pass ? '#E4E6EA' : '#FECACA'}` }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontSize: 10, fontWeight: 900, color: '#94A3B8', width: 20, flexShrink: 0 }}>{sc.num}</span>
                <span style={{ fontSize: 8, fontWeight: 800, padding: '2px 5px', borderRadius: 3, background: sc.pass ? '#D1FAE5' : '#FEE2E2', color: sc.pass ? '#065F46' : '#DC2626' }}>{sc.pass ? '✓ PASS' : '✗ FAIL'}</span>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#0F1419', flex: 1 }}>{sc.name}</span>
                <span style={{ fontSize: 9, color: '#94A3B8' }}>{sc.durationSec} сек</span>
              </div>
            </div>
          ))}
          <div style={{ padding: '6px 10px', borderRadius: 8, background: '#ECFDF5', border: '1px solid #A7F3D0', fontSize: 9, color: '#065F46', fontWeight: 700 }}>
            Итого: {E2E_SCENARIOS.filter(s => s.pass).length}/{E2E_SCENARIOS.length} · Общее время: {E2E_SCENARIOS.reduce((a, s) => a + s.durationSec, 0)} сек
          </div>
        </div>
      )}
    </div>
  );
}
