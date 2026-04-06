type ReleaseGate = {
  docsReady?: boolean;
  weighingReady?: boolean;
  labReady?: boolean;
  disputeFree?: boolean;
  canAcceptDecision?: boolean;
  canOpenPaymentContour?: boolean;
  canFinalRelease?: boolean;
  owner?: string;
  nextAction?: string;
  reasonCodes?: string[];
};

export function ReceivingReleaseGate({ gate }: { gate: ReleaseGate | null | undefined }) {
  if (!gate) return null;
  const cards = [
    { label: 'Весовая', value: gate.weighingReady ? 'GREEN' : 'WAIT', detail: 'Факт веса и ticket должны быть подтверждены.' },
    { label: 'Лаборатория', value: gate.labReady ? 'GREEN' : 'WAIT', detail: 'Финальный protocol должен быть привязан к приёмке.' },
    { label: 'Документы', value: gate.docsReady ? 'GREEN' : 'WAIT', detail: 'Пакет сделки не должен держать payment contour.' },
    { label: 'Спор', value: gate.disputeFree ? 'CLEAN' : 'HOLD', detail: 'Открытый спор не допускает тихий переход в release.' },
    { label: 'Решение по приёмке', value: gate.canAcceptDecision ? 'READY' : 'WAIT', detail: 'Принятие/отклонение должно происходить из этой карточки.' },
    { label: 'Переход в деньги', value: gate.canOpenPaymentContour ? 'OPEN' : 'WAIT', detail: 'После приёмки сделка обязана открыть money contour.' },
    { label: 'Final release', value: gate.canFinalRelease ? 'READY' : 'HOLD', detail: 'Финальные деньги разрешены только при green readiness.' },
  ];

  return (
    <section className="section-card-tight">
      <div className="panel-title-row" style={{ alignItems: 'flex-start' }}>
        <div>
          <div className="section-title">Receiving → quality → money gate</div>
          <div className="muted small" style={{ marginTop: 6 }}>
            Приёмка не должна обрываться на весовой. Эта связка показывает, можно ли реально передавать сделку в payments и кто сейчас владеет следующим шагом.
          </div>
        </div>
      </div>
      <div className="mobile-stat-grid" style={{ marginTop: 14 }}>
        {cards.map((item) => (
          <div key={item.label} className="border rounded-xl p-4">
            <div className="text-xs text-muted-foreground">{item.label}</div>
            <div className="font-semibold mt-1">{item.value}</div>
            <div className="text-sm text-muted-foreground mt-2">{item.detail}</div>
          </div>
        ))}
      </div>
      <div className="soft-box" style={{ marginTop: 14 }}>
        <div className="list-row"><span>Owner</span><b>{gate.owner || '—'}</b></div>
        <div className="list-row"><span>Next action</span><b>{gate.nextAction || '—'}</b></div>
        <div className="muted tiny" style={{ marginTop: 8 }}>reason codes: {(gate.reasonCodes || []).join(' · ') || '—'}</div>
      </div>
    </section>
  );
}
