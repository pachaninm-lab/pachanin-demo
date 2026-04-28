import { createPlatformV7ExecutionMachineBridgeSnapshot } from '@/lib/platform-v7/execution-state-machine-bridge';
import { PLATFORM_V7_TOKENS } from '@/lib/platform-v7/design/tokens';

const blockerLabels: Record<string, string> = {
  reserve_not_confirmed: 'Резерв денег не подтверждён',
  quality_not_accepted: 'Качество не принято',
  documents_missing: 'Документы не приложены',
  sdiz_missing: 'СДИЗ не подтверждён',
  dispute_open: 'Открыт спор',
};

const actionLabels: Record<string, string> = {
  confirmMoneyReserveManual: 'Подтвердить резерв вручную',
  cancelMoneyReserveIntent: 'Отменить запрос резерва',
  createLogisticsOrder: 'Создать логистический заказ',
  markLoadingPointArrived: 'Прибытие на погрузку',
  startLoading: 'Начать погрузку',
  finishLoading: 'Завершить погрузку',
  markDepartedLoadingPoint: 'Выезд с погрузки',
  markArrivedElevator: 'Прибытие на элеватор',
  startQualityCheck: 'Начать проверку качества',
  acceptQuality: 'Принять качество',
  rejectQuality: 'Отклонить качество',
  attachLabResult: 'Приложить лабораторный результат',
  markDocumentsPending: 'Документы на оформлении',
  attachDealDocuments: 'Приложить документы',
  markSdizRequired: 'СДИЗ требуется',
  markSdizReadyManual: 'Подтвердить СДИЗ вручную',
  requestReleaseAfterGates: 'Проверить финальный gate',
  blockReleaseBecauseGatesPending: 'Зафиксировать блокировку gate',
  resolveDispute: 'Закрыть спор',
  closeDeal: 'Закрыть сделку',
};

export function P7ExecutionMachineReadOnlyStrip({ compact = false }: { readonly compact?: boolean }) {
  const snapshot = createPlatformV7ExecutionMachineBridgeSnapshot();
  const { context } = snapshot;
  const blockers = snapshot.blockers.length ? snapshot.blockers : ['—'];
  const actions = snapshot.availableActions.slice(0, compact ? 3 : 6);

  return (
    <section style={{ background: PLATFORM_V7_TOKENS.color.surface, border: `1px solid ${snapshot.finalGateReady ? 'rgba(10,122,95,0.28)' : 'rgba(217,119,6,0.28)'}`, borderRadius: 18, padding: compact ? 14 : 18, display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 11, color: PLATFORM_V7_TOKENS.color.brand, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            State machine · read-only · {snapshot.maturity}
          </div>
          <div style={{ marginTop: 5, fontSize: compact ? 16 : 20, fontWeight: 900, color: PLATFORM_V7_TOKENS.color.text }}>
            {snapshot.dealId} · текущий state: <span style={{ fontFamily: 'monospace' }}>{context.state}</span>
          </div>
          <div style={{ marginTop: 5, fontSize: 12, color: PLATFORM_V7_TOKENS.color.textMuted, lineHeight: 1.5 }}>
            Только чтение. Никаких live-интеграций, выпуска денег или внешних действий. Показывает, что мешает финальному gate.
          </div>
        </div>
        <span style={{ borderRadius: 999, padding: '6px 10px', background: snapshot.finalGateReady ? 'rgba(10,122,95,0.08)' : 'rgba(217,119,6,0.08)', border: `1px solid ${snapshot.finalGateReady ? 'rgba(10,122,95,0.18)' : 'rgba(217,119,6,0.18)'}`, color: snapshot.finalGateReady ? PLATFORM_V7_TOKENS.color.brand : '#B45309', fontSize: 12, fontWeight: 900 }}>
          {snapshot.finalGateReady ? 'final gate готов' : 'final gate заблокирован'}
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: compact ? '1fr' : 'repeat(auto-fit,minmax(220px,1fr))', gap: 10 }}>
        <div style={box()}>
          <div style={label()}>Блокеры</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
            {blockers.map((item) => (
              <span key={item} style={pill(item === '—' ? 'good' : 'warn')}>{blockerLabels[item] ?? item}</span>
            ))}
          </div>
        </div>
        <div style={box()}>
          <div style={label()}>Доступные следующие действия</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
            {actions.length ? actions.map((item) => <span key={item} style={pill('neutral')}>{actionLabels[item] ?? item}</span>) : <span style={pill('neutral')}>—</span>}
          </div>
        </div>
      </div>
    </section>
  );
}

function box(): React.CSSProperties {
  return { border: `1px solid ${PLATFORM_V7_TOKENS.color.border}`, borderRadius: 14, padding: 12, background: PLATFORM_V7_TOKENS.color.surfaceStrong };
}

function label(): React.CSSProperties {
  return { fontSize: 11, color: PLATFORM_V7_TOKENS.color.textMuted, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' };
}

function pill(tone: 'good' | 'warn' | 'neutral'): React.CSSProperties {
  const good = tone === 'good';
  const warn = tone === 'warn';
  return { borderRadius: 999, padding: '5px 8px', background: good ? 'rgba(10,122,95,0.08)' : warn ? 'rgba(217,119,6,0.08)' : 'rgba(15,23,42,0.04)', border: `1px solid ${good ? 'rgba(10,122,95,0.18)' : warn ? 'rgba(217,119,6,0.18)' : 'rgba(15,23,42,0.08)'}`, color: good ? PLATFORM_V7_TOKENS.color.brand : warn ? '#B45309' : PLATFORM_V7_TOKENS.color.text, fontSize: 11, fontWeight: 800 };
}
