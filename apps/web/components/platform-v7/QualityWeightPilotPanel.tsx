import {
  calculateElevatorWeightImpact,
  calculateLabQualityImpact,
  formatRub,
  formatTons,
  selectDealExecutionCase,
  type DealExecutionLabProtocol,
} from '@/lib/platform-v7/deal-execution-source-of-truth';

const LAB_PROTOCOL: DealExecutionLabProtocol = {
  crop: 'Пшеница',
  class: '5 класс',
  moisture: 15.2,
  nature: 724,
  protein: 10.9,
  gluten: 16.7,
  idk: 108,
  fallingNumber: 166,
  weedImpurity: 2.6,
  grainImpurity: 5.8,
  infestation: 'не обнаружена',
  protocolNumber: 'LAB-DL-9106-001',
  method: 'ГОСТ 13586 / ручной протокол пилота',
  laboratory: 'Лаборатория пилота',
  signer: 'Иванова А.А.',
  kepStatus: 'КЭП лаборатории · ручная проверка',
  measuredAt: '2026-05-21T13:20:00+03:00',
};

export function QualityWeightPilotPanel({ mode }: { readonly mode: 'elevator' | 'lab' }) {
  const executionCase = selectDealExecutionCase('DL-9106');
  if (!executionCase) return null;

  const weightImpact = calculateElevatorWeightImpact({
    dealId: executionCase.dealId,
    declaredTons: executionCase.commodity.volumeDeclaredTons,
    grossTons: 596.8,
    tareTons: 0,
    moistureAdjustmentTons: 1.5,
    impurityAdjustmentTons: 0.8,
    pricePerTon: executionCase.price.pricePerTon,
  });
  const qualityImpact = calculateLabQualityImpact(executionCase, LAB_PROTOCOL);

  if (mode === 'lab') {
    return (
      <section style={panel}>
        <div style={micro}>Лаборатория · структурированный протокол</div>
        <h2 style={h2}>{LAB_PROTOCOL.protocolNumber}</h2>
        <div style={grid}>
          <Fact label='Культура / класс' value={`${LAB_PROTOCOL.crop} · ${LAB_PROTOCOL.class}`} tone='warn' />
          <Fact label='Влажность' value={`${LAB_PROTOCOL.moisture}%`} tone='warn' />
          <Fact label='Натура' value={`${LAB_PROTOCOL.nature} г/л`} tone='warn' />
          <Fact label='Белок' value={`${LAB_PROTOCOL.protein}%`} tone='warn' />
          <Fact label='Клейковина' value={`${LAB_PROTOCOL.gluten}%`} tone='warn' />
          <Fact label='ИДК' value={String(LAB_PROTOCOL.idk)} tone='warn' />
          <Fact label='Число падения' value={`${LAB_PROTOCOL.fallingNumber} сек.`} tone='warn' />
          <Fact label='Сорная примесь' value={`${LAB_PROTOCOL.weedImpurity}%`} tone='warn' />
          <Fact label='Зерновая примесь' value={`${LAB_PROTOCOL.grainImpurity}%`} tone='warn' />
          <Fact label='КЭП' value={LAB_PROTOCOL.kepStatus} />
        </div>
        <div style={notice}>
          Корректировка качества: {formatRub(qualityImpact.priceAdjustment)} · удержание: {formatRub(qualityImpact.holdAmount)} · статус банка: {qualityImpact.bankStatus}.
        </div>
        <div style={list}>
          {qualityImpact.qualityDelta.map((delta) => <div key={delta} style={deltaRow}>{delta}</div>)}
        </div>
      </section>
    );
  }

  return (
    <section style={panel}>
      <div style={micro}>Элеватор · вес и зачётный вес</div>
      <h2 style={h2}>TRIP-SIM-001 · акт зачётного веса</h2>
      <div style={grid}>
        <Fact label='Заявленный вес' value={formatTons(executionCase.commodity.volumeDeclaredTons)} />
        <Fact label='Брутто' value={formatTons(596.8)} />
        <Fact label='Тара' value={formatTons(0)} />
        <Fact label='Нетто' value={formatTons(weightImpact.netTons)} />
        <Fact label='Коррекция влажности' value={formatTons(1.5)} tone='warn' />
        <Fact label='Коррекция сорности' value={formatTons(0.8)} tone='warn' />
        <Fact label='Зачётный вес' value={formatTons(weightImpact.acceptedTons)} tone='warn' />
        <Fact label='Отклонение' value={formatTons(weightImpact.deltaTons)} tone='bad' />
      </div>
      <div style={notice}>
        {weightImpact.moneyImpact}
      </div>
      <div style={formula}>
        Заявленный вес - фактическое отклонение - корректировка влажности - корректировка сорности = зачётный вес; зачётный вес × цена за тонну влияет на удержание.
      </div>
      {weightImpact.draftDiscrepancyActRequired ? <div style={deltaRow}>{weightImpact.nextRoleTask}</div> : null}
    </section>
  );
}

function Fact({ label, value, tone = 'neutral' }: { readonly label: string; readonly value: string; readonly tone?: 'neutral' | 'warn' | 'bad' }) {
  const color = tone === 'bad' ? '#B91C1C' : tone === 'warn' ? '#B45309' : '#0F1419';
  return (
    <div style={fact}>
      <div style={factLabel}>{label}</div>
      <div style={{ ...factValue, color }}>{value}</div>
    </div>
  );
}

const panel = { background: 'linear-gradient(180deg,#FFFFFF 0%,#F8FAFB 100%)', border: '1px solid #E4E6EA', borderRadius: 20, padding: 16, display: 'grid', gap: 12, boxShadow: '0 10px 22px rgba(15,23,42,0.045)' } as const;
const grid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 8 } as const;
const list = { display: 'grid', gap: 7 } as const;
const micro = { color: '#0A7A5F', fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' } as const;
const h2 = { margin: 0, color: '#0F1419', fontSize: 20, lineHeight: 1.15, fontWeight: 950 } as const;
const fact = { display: 'grid', gap: 4, border: '1px solid #E4E6EA', borderRadius: 12, padding: 10, background: '#FFFFFF' } as const;
const factLabel = { color: '#64748B', fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' } as const;
const factValue = { color: '#0F1419', fontSize: 13, lineHeight: 1.35, fontWeight: 900 } as const;
const notice = { border: '1px solid rgba(217,119,6,0.18)', background: 'rgba(217,119,6,0.07)', borderRadius: 12, padding: 12, color: '#0F1419', fontSize: 13, lineHeight: 1.5, fontWeight: 850 } as const;
const formula = { border: '1px solid #E4E6EA', background: '#FFFFFF', borderRadius: 12, padding: 12, color: '#475569', fontSize: 12, lineHeight: 1.5, fontWeight: 800 } as const;
const deltaRow = { border: '1px solid rgba(220,38,38,0.16)', background: 'rgba(220,38,38,0.06)', borderRadius: 10, padding: 10, color: '#7F1D1D', fontSize: 12, lineHeight: 1.45, fontWeight: 850 } as const;
