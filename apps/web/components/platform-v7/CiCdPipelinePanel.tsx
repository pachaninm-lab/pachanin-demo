'use client';

import { useState } from 'react';

type StageStatus = 'success' | 'running' | 'failed' | 'pending' | 'skipped';

interface PipelineRun {
  id: string;
  branch: string;
  commit: string;
  triggeredBy: string;
  startedAt: string;
  duration: string | null;
  stages: PipelineStage[];
  canaryPct: number | null;
}

interface PipelineStage {
  name: string;
  status: StageStatus;
  duration: string | null;
  note: string | null;
}

const PIPELINE_RUNS: PipelineRun[] = [
  {
    id: 'run-2847', branch: 'main', commit: 'a3f92bc', triggeredBy: 'merge PR#412', startedAt: '2024-03-20T10:30:00Z', duration: '18 мин', canaryPct: 100,
    stages: [
      { name: 'lint-typecheck',       status: 'success', duration: '1м 42с', note: null },
      { name: 'unit-tests',           status: 'success', duration: '2м 55с', note: '94% coverage' },
      { name: 'build',                status: 'success', duration: '4м 12с', note: 'multi-stage Docker' },
      { name: 'sast',                 status: 'success', duration: '3м 08с', note: 'Semgrep: 0 critical' },
      { name: 'container-scan',       status: 'success', duration: '1м 55с', note: 'Trivy: 0 High CVE' },
      { name: 'secret-scan',          status: 'success', duration: '0м 28с', note: 'GitLeaks: clean' },
      { name: 'integration-tests',    status: 'success', duration: '4м 19с', note: 'mock adapters OK' },
      { name: 'deploy-staging',       status: 'success', duration: '0м 45с', note: 'ArgoCD sync' },
      { name: 'e2e-tests',            status: 'success', duration: '9м 11с', note: 'Playwright: 47/47' },
      { name: 'performance-gate',     status: 'success', duration: '2м 30с', note: 'k6 p95 < 480мс' },
      { name: 'deploy-production',    status: 'success', duration: '31м',   note: 'Canary 5→50→100%' },
      { name: 'post-deploy-smoke',    status: 'success', duration: '1м 12с', note: 'Critical path OK' },
    ],
  },
  {
    id: 'run-2846', branch: 'feat/railway', commit: 'b81d4ef', triggeredBy: 'push', startedAt: '2024-03-20T08:15:00Z', duration: '7 мин', canaryPct: null,
    stages: [
      { name: 'lint-typecheck',  status: 'success', duration: '1м 38с', note: null },
      { name: 'unit-tests',      status: 'failed',  duration: '3м 02с', note: '1 failed: wagons.test.ts' },
      { name: 'build',           status: 'skipped', duration: null,    note: null },
      { name: 'sast',            status: 'skipped', duration: null,    note: null },
      { name: 'container-scan',  status: 'skipped', duration: null,    note: null },
      { name: 'secret-scan',     status: 'skipped', duration: null,    note: null },
      { name: 'integration-tests',status: 'skipped',duration: null,    note: null },
      { name: 'deploy-staging',  status: 'skipped', duration: null,    note: null },
      { name: 'e2e-tests',       status: 'skipped', duration: null,    note: null },
      { name: 'performance-gate',status: 'skipped', duration: null,    note: null },
      { name: 'deploy-production',status:'skipped', duration: null,    note: null },
      { name: 'post-deploy-smoke',status:'skipped', duration: null,    note: null },
    ],
  },
];

const STAGE_CFG: Record<StageStatus, { bg: string; color: string; icon: string }> = {
  success: { bg: '#D1FAE5', color: '#065F46', icon: '✓' },
  running: { bg: '#EFF6FF', color: '#1E40AF', icon: '⟳' },
  failed:  { bg: '#FEE2E2', color: '#991B1B', icon: '✗' },
  pending: { bg: '#F1F5F9', color: '#64748B', icon: '○' },
  skipped: { bg: '#F1F5F9', color: '#94A3B8', icon: '—' },
};

const lbl: React.CSSProperties = { fontSize: 10, fontWeight: 900, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em' };

export function CiCdPipelinePanel() {
  const [selected, setSelected] = useState<string>(PIPELINE_RUNS[0].id);
  const run = PIPELINE_RUNS.find(r => r.id === selected) ?? PIPELINE_RUNS[0];
  const successStages = run.stages.filter(s => s.status === 'success').length;
  const failedStages = run.stages.filter(s => s.status === 'failed').length;

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      {/* Run selector */}
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
        {PIPELINE_RUNS.map((r) => {
          const hasFail = r.stages.some(s => s.status === 'failed');
          const isSelected = r.id === selected;
          return (
            <button key={r.id} onClick={() => setSelected(r.id)} style={{ padding: '5px 12px', borderRadius: 8, border: isSelected ? 'none' : '1px solid #E4E6EA', background: isSelected ? '#0F1419' : '#F8FAFB', color: isSelected ? '#fff' : '#374151', fontSize: 10, fontWeight: 700, cursor: 'pointer', display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ color: hasFail ? '#DC2626' : '#065F46', fontWeight: 900 }}>{hasFail ? '✗' : '✓'}</span>
              {r.id} · {r.branch} · {r.commit}
            </button>
          );
        })}
      </div>

      {/* Run summary */}
      <div style={{ padding: '10px 14px', borderRadius: 10, background: '#F8FAFB', border: '1px solid #E4E6EA', display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 8 }}>
        {[
          { label: 'Ветка', value: run.branch },
          { label: 'Триггер', value: run.triggeredBy },
          { label: 'Начало', value: new Date(run.startedAt).toLocaleString('ru-RU') },
          { label: 'Длительность', value: run.duration ?? 'Идёт...' },
          { label: 'Этапов OK', value: `${successStages}/${run.stages.length}` },
          { label: 'Canary', value: run.canaryPct !== null ? `${run.canaryPct}%` : '—' },
        ].map((s) => (
          <div key={s.label}>
            <div style={lbl}>{s.label}</div>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#0F1419', marginTop: 2 }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Stages */}
      <div style={{ display: 'grid', gap: 4 }}>
        <div style={lbl}>Этапы pipeline · GitHub Actions + ArgoCD</div>
        {run.stages.map((s, i) => {
          const st = STAGE_CFG[s.status];
          return (
            <div key={s.name} style={{ padding: '5px 10px', borderRadius: 7, background: s.status === 'failed' ? '#FEF2F2' : '#F8FAFB', border: `1px solid ${s.status === 'failed' ? '#FECACA' : '#E4E6EA'}`, display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 8, fontWeight: 900, minWidth: 18, textAlign: 'center', color: st.color }}>{st.icon}</span>
              <span style={{ fontSize: 9, color: '#94A3B8', minWidth: 20 }}>{i + 1}.</span>
              <code style={{ fontSize: 9, fontWeight: 700, color: '#0F1419', flex: 1 }}>{s.name}</code>
              {s.duration && <span style={{ fontSize: 9, color: '#64748B', minWidth: 60, textAlign: 'right' }}>{s.duration}</span>}
              {s.note && <span style={{ fontSize: 9, color: s.status === 'failed' ? '#991B1B' : '#064E3B' }}>{s.note}</span>}
            </div>
          );
        })}
      </div>

      {failedStages > 0 && (
        <div style={{ padding: '8px 12px', borderRadius: 8, background: '#FEE2E2', border: '1px solid #FECACA', fontSize: 10, color: '#991B1B', fontWeight: 700 }}>
          ✗ Pipeline заблокирован — {failedStages} этап(а) завершились с ошибкой. Deploy заморожен до исправления.
        </div>
      )}

      <div style={{ padding: '8px 12px', borderRadius: 8, background: '#EFF6FF', border: '1px solid #BFDBFE', fontSize: 9, color: '#1E40AF', fontWeight: 700, lineHeight: 1.6 }}>
        CI: GitHub Actions · CD: ArgoCD GitOps · SAST: Semgrep · Container: Trivy · Secrets: GitLeaks · Canary: 5%→50%→100% · Rollback: error rate &gt; 1% → auto-revert
      </div>

      <div style={{ fontSize: 9, color: '#94A3B8', padding: '4px 8px', borderRadius: 6, background: '#F8FAFB', border: '1px solid #E4E6EA' }}>
        GitHub Actions 12 этапов · ArgoCD GitOps · Flagsmith canary · Playwright E2E · k6 perf gate · Демо-данные.
      </div>
    </div>
  );
}
