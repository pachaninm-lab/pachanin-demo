interface Props {
  dealId: string;
  reservedAmount: number;
  holdAmount: number;
  releaseBlocked: boolean;
}

const GUARANTEES = [
  {
    icon: '🏦',
    title: 'Банковский счёт эскроу',
    description: 'Деньги покупателя депонированы на специальном счёте банка-партнёра до завершения всех проверок. Продавец получает средства только после подтверждения банком.',
    active: true,
  },
  {
    icon: '🔬',
    title: 'Лабораторный контроль качества',
    description: 'Перед выплатой обязательна верификация качества по ГОСТ. Протокол лаборатории является условием снятия блокировки выплаты.',
    active: true,
  },
  {
    icon: '📋',
    title: 'ФГИС «Зерно» верификация',
    description: 'Партия зерна проверяется по СДИЗ в федеральной информационной системе Минсельхоза. Несоответствие блокирует сделку автоматически.',
    active: true,
  },
  {
    icon: '📄',
    title: 'Полный документальный пакет',
    description: 'ЭТрН, УПД, акты приёма-передачи и транспортные документы обязательны для банковской выплаты. Оператор контролирует комплектность в реальном времени.',
    active: true,
  },
  {
    icon: '⚖️',
    title: 'Механизм споров и удержаний',
    description: 'При расхождении по качеству или объёму запускается процедура спора. Удержанная сумма замораживается до решения арбитра платформы.',
    active: true,
  },
  {
    icon: '🔒',
    title: 'Аудит-лог критичных действий',
    description: 'Каждое действие по сделке фиксируется с временной меткой, IP-адресом и ролью исполнителя. Журнал недоступен для изменения задним числом.',
    active: true,
  },
];

export function DealGuaranteesBlock({ dealId, reservedAmount, holdAmount, releaseBlocked }: Props) {
  const formatRub = (n: number) =>
    new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(n);

  return (
    <section
      aria-label="Гарантии сделки"
      style={{
        background: 'var(--p7-color-surface, #fff)',
        border: '1px solid var(--p7-color-border, #E4E6EA)',
        borderRadius: 18,
        padding: 18,
        display: 'grid',
        gap: 16,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--pc-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
            Гарантии сделки · {dealId}
          </div>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--pc-text-primary, #0F1419)', lineHeight: 1.2 }}>
            Защита обеих сторон
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <span style={{
            fontSize: 11, fontWeight: 700,
            background: 'rgba(10,122,95,0.08)', border: '1px solid rgba(10,122,95,0.2)',
            borderRadius: 999, padding: '4px 10px',
            color: '#0A7A5F',
          }}>
            {formatRub(reservedAmount)} зарезервировано
          </span>
          {holdAmount > 0 && (
            <span style={{
              fontSize: 11, fontWeight: 700,
              background: 'rgba(180,83,9,0.08)', border: '1px solid rgba(180,83,9,0.2)',
              borderRadius: 999, padding: '4px 10px',
              color: '#B45309',
            }}>
              {formatRub(holdAmount)} удержано
            </span>
          )}
          <span style={{
            fontSize: 11, fontWeight: 700,
            background: releaseBlocked ? 'rgba(220,38,38,0.08)' : 'rgba(5,150,105,0.08)',
            border: `1px solid ${releaseBlocked ? 'rgba(220,38,38,0.2)' : 'rgba(5,150,105,0.2)'}`,
            borderRadius: 999, padding: '4px 10px',
            color: releaseBlocked ? '#DC2626' : '#059669',
          }}>
            {releaseBlocked ? 'выплата заблокирована' : 'выплата разрешена'}
          </span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
        {GUARANTEES.map((g) => (
          <div
            key={g.title}
            style={{
              display: 'grid', gap: 6,
              padding: '12px 14px',
              borderRadius: 12,
              background: 'var(--p7-color-surface-muted, #F8FAFB)',
              border: '1px solid var(--p7-color-border, #E4E6EA)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: '1.25rem' }}>{g.icon}</span>
              <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--pc-text-primary, #0F1419)', lineHeight: 1.2 }}>{g.title}</span>
              <span style={{ marginLeft: 'auto', fontSize: 9, fontWeight: 700, color: '#059669' }}>✓ Активно</span>
            </div>
            <p style={{ margin: 0, fontSize: 11, color: 'var(--pc-text-secondary, #475569)', lineHeight: 1.55 }}>
              {g.description}
            </p>
          </div>
        ))}
      </div>

      <div style={{ fontSize: 10, color: 'var(--pc-text-muted)', lineHeight: 1.5, padding: '8px 12px', borderRadius: 8, background: 'rgba(10,122,95,0.04)', border: '1px solid rgba(10,122,95,0.1)' }}>
        Все гарантии активны одновременно и взаимосвязаны. Нарушение любого из условий автоматически блокирует выплату до урегулирования. Оператор платформы не может вручную обойти банковский контур.
      </div>
    </section>
  );
}
