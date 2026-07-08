'use client';

import { useState } from 'react';

type StageStatus = 'ready' | 'planned' | 'required';

interface PipelineStage {
  name: string;
  status: StageStatus;
  requirement: string;
  evidence: string;
  blocksRelease: boolean;
}

const PIPELINE_STAGES: PipelineStage[] = [
  { name: 'typecheck-build', status: 'ready', requirement: 'приложение должно собираться на активном deploy-контуре', evidence: 'подтверждается Railway status', blocksRelease: true },
  { name: 'lint', status: 'planned', requirement: 'lint не должен иметь блокирующих ошибок', evidence: 'нужен текущий CI-отчёт', blocksRelease: true },
  { name: 'unit-tests', status: 'required', requirement: 'критическая доменная логика должна иметь тесты', evidence: 'нужен отчёт текущего прогона', blocksRelease: true },
  { name: 'integration-tests', status: 'required', requirement: 'сделка, документы, деньги и спор должны проверяться вместе', evidence: 'нужен отчёт интеграционных тестов', blocksRelease: true },
  { name: 'browser-e2e', status: 'planned', requirement: 'ключевой путь сделки должен проходить в браузере', evidence: 'нужен E2E-прогон', blocksRelease: true },
  { name: 'mobile-smoke', status: 'planned', requirement: 'мобильная шапка, навигация, формы и RU/EN/ZH должны проверяться отдельно', evidence: 'нужен UI-smoke', blocksRelease: true },
  { name: 'load-profile', status: 'required', requirement: 'проверка нагрузки на тысячи пользователей требует сохранённого отчёта', evidence: 'нужен нагрузочный отчёт', blocksRelease: true },
  { name: 'release-verification', status: 'planned', requirement: 'после deploy нужен smoke критических страниц и ролей', evidence: 'нужен deploy verification отчёт', blocksRelease: true },
  { name: 'rollback-plan', status: 'planned', requirement: 'должен быть понятный ручной rollback без потери сделок и журнала событий', evidence: 'нужен runbook', blocksRelease: false },
];

const STAGE_CFG: Record<StageStatus, { label: string; bg: string; color: string; icon: string }> = {
  ready: { label: 'READY', bg: '#D1FAE5', color: '#065F46', icon: '✓' },
  planned: { label: 'PLANNED', bg: '#DBEAFE', color: '#1E40AF', icon: '◌' },
  required: { label: 'REQUIRED', bg: '#FEF3C7', color: '#92400E', icon: '!' },
};

const lbl: React.CSSProperties = { fontSize: 10, fontWeight: 900, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em' };

type Tab = 'stages' | 'rules';

export function CiCdPipelinePanel() {
  const [tab, setTab] = useState<Tab>('stages');
  const ready = PIPELINE_STAGES.filter(s => s.status === 'ready').length;
  const required = PIPELINE_STAGES.filter(s => s.status === 'required').length;
  const blockers = PIPELINE_STAGES.filter(s => s.blocksRelease && s.status !== 'ready').length;

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(110px,1fr))', gap: 8 }}>
        {[
          { label: 'Этапов', value: PIPELINE_STAGES.length, color: '#0F1419' },
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
        Release readiness · настоящая платформа временно без интеграций. История pipeline, PASS-статусы, canary, perf и E2E не заявляются без текущих отчётов активного deploy-контура.
      </div>

      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
        {([['stages', 'Этапы'], ['rules', 'Правила релиза']] as const).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} style={{ padding: '4px 10px', borderRadius: 6, border: tab === id ? 'none' : '1px solid #E4E6EA', background: tab === id ? '#0F1419' : '#F8FAFB', color: tab === id ? '#fff' : '#64748B', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'stages' && (
        <div style={{ display: 'grid', gap: 5 }}>
          <div style={lbl}>Release gates · evidence-based readiness</div>
          {PIPELINE_STAGES.map((stage, i) => {
            const st = STAGE_CFG[stage.status];
            return (
              <div key={stage.name} style={{ padding: '8px 10px', borderRadius: 8, background: stage.status === 'required' ? '#FFFBEB' : '#F8FAFB', border: `1px solid ${stage.status === 'required' ? '#FDE68A' : '#E4E6EA'}` }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 8, fontWeight: 900, minWidth: 18, textAlign: 'center', color: st.color }}>{i + 1}.</span>
                  <span style={{ fontSize: 8, fontWeight: 800, padding: '2px 6px', borderRadius: 4, background: st.bg, color: st.color }}>{st.icon} {st.label}</span>
                  <code style={{ fontSize: 9, fontWeight: 700, color: '#0F1419', flex: 1 }}>{stage.name}</code>
                  {stage.blocksRelease && <span style={{ fontSize: 8, padding: '1px 4px', borderRadius: 3, background: '#FEE2E2', color: '#DC2626', fontWeight: 800 }}>release gate</span>}
                </div>
                <div style={{ fontSize: 9, color: '#64748B', marginTop: 2 }}>{stage.requirement}</div>
                <div style={{ fontSize: 8, color: '#94A3B8', marginTop: 1 }}>Evidence: {stage.evidence}</div>
              </div>
            );
          })}
        </div>
      )}

      {tab === 'rules' && (
        <div style={{ display: 'grid', gap: 6 }}>
          <div style={lbl}>Правила релиза</div>
          {[
            { key: 'Нет fake-pass', value: 'не показывать успешные тесты, проценты покрытия, E2E и нагрузку без сохранённого отчёта' },
            { key: 'Deploy source', value: 'активный статус берётся только из актуального deploy-контура, старые Vercel/Deno failures не смешиваются с Railway' },
            { key: 'Интеграции', value: 'релиз платформы не равен подключению ФГИС, ЭДО, банка, КЭП, ЕСИА, ERP или CRM' },
            { key: 'Mobile smoke', value: 'релиз не должен проходить без проверки шапки, навигации, форм и критических страниц на телефоне' },
            { key: 'Rollback', value: 'откат не должен терять сделки, документы, деньги, события и evidence trail' },
          ].map((row) => (
            <div key={row.key} style={{ display: 'flex', gap: 12, padding: '6px 10px', borderRadius: 6, background: '#F8FAFB', border: '1px solid #E4E6EA' }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: '#374151', width: 120, flexShrink: 0 }}>{row.key}</span>
              <span style={{ fontSize: 10, color: '#64748B' }}>{row.value}</span>
            </div>
          ))}
        </div>
      )}

      {blockers > 0 && (
        <div style={{ padding: '8px 12px', borderRadius: 8, background: '#FFFBEB', border: '1px solid #FDE68A', fontSize: 10, color: '#92400E', fontWeight: 700 }}>
          {blockers} release-gate требуют подтверждения отчётом перед заявлением production proof.
        </div>
      )}

      <div style={{ fontSize: 9, color: '#94A3B8', padding: '4px 8px', borderRadius: 6, background: '#F8FAFB', border: '1px solid #E4E6EA' }}>
        CI/CD readiness · сборка, тесты, E2E, нагрузка, mobile-smoke и release verification должны подтверждаться текущими отчётами; внешние интеграции временно не подключены.
      </div>
    </div>
  );
}
