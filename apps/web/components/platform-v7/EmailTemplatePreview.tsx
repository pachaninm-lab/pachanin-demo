'use client';

const EVENTS = [
  ['Сделка', 'создана или изменила статус'],
  ['Документы', 'требуется пакет или проверка'],
  ['Банк', 'нужно основание для банковского шага'],
  ['Спор', 'нужен доказательный пакет'],
  ['Лот', 'подходит под запрос покупателя'],
];

export function EmailTemplatePreview() {
  return (
    <div style={{ display: 'grid', gap: '0.875rem' }}>
      <div style={{ padding: '12px 14px', borderRadius: 14, border: '1px solid var(--p7-color-border)', background: 'var(--p7-color-surface-muted)', display: 'grid', gap: 6 }}>
        <div style={{ fontSize: 13, fontWeight: 900, color: 'var(--pc-text-primary)' }}>События уведомлений</div>
        <div style={{ fontSize: 11, lineHeight: 1.5, color: 'var(--pc-text-secondary)' }}>
          Предынтеграционный контур. Тексты уведомлений и почтовый провайдер подключаются после согласования регламента, домена отправителя и юридических шаблонов.
        </div>
      </div>

      <div style={{ display: 'grid', gap: 6 }}>
        {EVENTS.map(([title, note]) => (
          <div key={title} style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'space-between', padding: '9px 11px', borderRadius: 12, border: '1px solid var(--p7-color-border)', background: '#fff' }}>
            <strong style={{ fontSize: 12, color: 'var(--pc-text-primary)' }}>{title}</strong>
            <span style={{ fontSize: 10, color: 'var(--pc-text-muted)', textAlign: 'right' }}>{note}</span>
          </div>
        ))}
      </div>

      <div style={{ fontSize: 9, color: 'var(--pc-text-muted)', padding: '5px 9px', borderRadius: 7, background: 'var(--p7-color-surface-muted)', border: '1px solid var(--p7-color-border)' }}>
        Уведомления не считаются подключёнными до настройки отправителя, журнала событий и проверки доставки.
      </div>
    </div>
  );
}
