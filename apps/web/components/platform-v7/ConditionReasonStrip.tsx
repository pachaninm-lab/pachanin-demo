export interface ConditionReasonStripProps {
  condition: string;
  responsible: string;
  documentState: string;
  stopReason?: string;
}

export function ConditionReasonStrip({
  condition,
  responsible,
  documentState,
  stopReason,
}: ConditionReasonStripProps) {
  return (
    <div
      data-testid='condition-reason-strip'
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
        gap: 8,
        padding: '10px 14px',
        background: '#F8FAFB',
        border: '1px solid #E4E6EA',
        borderRadius: 14,
      }}
    >
      <Slot label='условие' value={condition} testId='condition-reason-condition' />
      <Slot label='ответственный' value={responsible} testId='condition-reason-responsible' />
      <Slot label='документ' value={documentState} testId='condition-reason-document' />
      {stopReason && (
        <Slot label='причина остановки' value={stopReason} testId='condition-reason-stop' danger />
      )}
    </div>
  );
}

function Slot({
  label,
  value,
  testId,
  danger = false,
}: {
  label: string;
  value: string;
  testId: string;
  danger?: boolean;
}) {
  return (
    <div style={{ display: 'grid', gap: 3 }}>
      <span
        style={{
          color: '#64748B',
          fontSize: 10,
          fontWeight: 900,
          textTransform: 'uppercase' as const,
          letterSpacing: '0.07em',
        }}
      >
        {label}
      </span>
      <span
        data-testid={testId}
        style={{
          color: danger ? '#B91C1C' : '#0F1419',
          fontSize: 12,
          fontWeight: 900,
          lineHeight: 1.35,
        }}
      >
        {value}
      </span>
    </div>
  );
}
