'use client';
import { useMemo, useState } from 'react';
import { commercialFetch, CommercialApiError } from '../lib/commercial-api';
import { useToast } from './toast';
import { getQueueSlotPolicy } from '../lib/workflow-policies';

type Slot = { id: string; slot: string; status: string; note: string; predictedWaitMin: number; queuePosition: number };

export function ReceivingSlotConsole({ slotId, initialSlot }: { slotId: string; initialSlot: Slot | null }) {
  const { show } = useToast();
  const [slot, setSlot] = useState(initialSlot);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState('');
  const policy = useMemo(() => getQueueSlotPolicy(slot?.status || ''), [slot?.status]);

  if (!slot) return null;

  async function act(action: string) {
    setLoading(action);
    try {
      const payload: any = { action };
      if (note) payload.note = note;
      if (action === 'rebook') payload.slot = `${slot.slot} → +20 мин`;
      const data = await commercialFetch<{ slot: Slot }>(`/queue/${slotId}`, { method: 'PATCH', body: JSON.stringify(payload) });
      setSlot(data.slot || slot);
      setNote('');
      show('success', 'Слот обновлён');
    } catch (e) {
      show('error', e instanceof CommercialApiError ? e.message : 'Не удалось обновить слот');
    } finally {
      setLoading('');
    }
  }

  return (
    <section className="section-card-tight">
      <div className="section-title">Slot / gate flow</div>
      <div className="muted small" style={{ marginTop: 8 }}>
        Вместо всех кнопок сразу система показывает только следующий допустимый шаг. Это снижает риск ручного рассинхрона между queue, receiving и деньгами.
      </div>
      <div className="info-grid-2" style={{ marginTop: 12 }}>
        <div className="info-card"><div className="label">Статус</div><div className="value">{slot.status}</div></div>
        <div className="info-card"><div className="label">Окно / очередь</div><div className="value">{slot.slot} · #{slot.queuePosition}</div></div>
      </div>
      <div className="field" style={{ marginTop: 12 }}>
        <label>Комментарий</label>
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Причина переноса / отметка оператора" />
      </div>
      <div className="section-stack" style={{ marginTop: 12 }}>
        {policy.primary ? (
          <button onClick={() => act(policy.primary!.id)} disabled={!!loading} className="button primary compact">
            {loading === policy.primary.id ? '...' : policy.primary.label}
          </button>
        ) : null}
        <div className="detail-meta">
          {policy.secondary.map((action) => (
            <button key={action.id} onClick={() => act(action.id)} disabled={!!loading} className="mini-chip">
              {loading === action.id ? '...' : action.label}
            </button>
          ))}
        </div>
        <div className="muted tiny">{policy.primary?.description || policy.blockedReason || 'Дальнейших действий по слоту нет.'}</div>
        <div className="muted tiny">Ожидание: {slot.predictedWaitMin} мин · {slot.note}</div>
      </div>
    </section>
  );
}
