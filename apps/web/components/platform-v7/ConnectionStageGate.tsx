import type { ContactRevealContext, ContactVaultEntry } from '../../lib/platform-v7/contact-vault';
import { canRevealContact } from '../../lib/platform-v7/contact-vault';

export function ConnectionStageGate({ entry, context }: { entry: ContactVaultEntry; context: ContactRevealContext }) {
  const decision = canRevealContact(entry, context);
  const color = decision.allowed ? '#0A7A5F' : '#B45309';
  return (
    <div style={{ border: '1px solid #E4E6EA', borderRadius: 16, padding: 12, display: 'grid', gap: 6, background: '#fff' }}>
      <strong style={{ color: '#0F1419', fontSize: 14 }}>Связь со стороной</strong>
      <span style={{ color, fontSize: 13, fontWeight: 900 }}>{decision.allowed ? 'Доступ разрешён по этапу сделки' : 'Доступ закрыт до нужного этапа'}</span>
      <span style={{ color: '#64748B', fontSize: 12 }}>{decision.allowed ? `Тип данных: ${entry.contactType}` : `Причина: ${decision.reason ?? 'проверка не пройдена'}`}</span>
    </div>
  );
}
