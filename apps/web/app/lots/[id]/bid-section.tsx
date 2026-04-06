'use client';
import { useState } from 'react';
import { api, ApiError } from '../../../lib/api-client';
import { useToast } from '../../../components/toast';
import { ConfirmDialog } from '../../../components/confirm-dialog';

export function BidSection({ lotId, startPrice, maxVolume }: { lotId: string; startPrice: number; maxVolume: number }) {
  const { show } = useToast();
  const [price, setPrice] = useState('');
  const [volume, setVolume] = useState(String(maxVolume));
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const total = (parseFloat(price || '0') * parseFloat(volume || '0')) || 0;

  const handleBid = async () => {
    const p = parseFloat(price);
    if (!p || p < startPrice) { show('error', `Цена должна быть не ниже ${startPrice.toLocaleString('ru-RU')} ₽/т`); return; }
    const v = parseFloat(volume);
    if (!v || v <= 0 || v > maxVolume) { show('error', `Объём: от 1 до ${maxVolume} т`); return; }
    setSubmitting(true);
    try {
      await api.post('/auctions/bids', { lotId, amount: p, pricePerTon: p, volumeTons: v });
      show('success', `Ставка ${p.toLocaleString('ru-RU')} ₽/т отправлена`);
      setSubmitted(true);
    } catch (e) {
      show('error', e instanceof ApiError ? e.message : 'Не удалось отправить ставку');
    } finally { setSubmitting(false); }
  };

  if (submitted) {
    return (
      <div className="card-success info-card" style={{ marginTop: 8 }}>
        <div className="label">Ставка отправлена</div>
        <div className="value">Продавец получил предложение и увидит его в контуре лота.</div>
        <button onClick={() => setSubmitted(false)} className="button ghost compact" style={{ marginTop: 10 }}>Сделать ещё одну ставку</button>
      </div>
    );
  }

  return (
    <div className="section-stack">
      <div className="cta-grid">
        <div className="field">
          <label className="tiny muted">Цена, ₽/т *</label>
          <input type="number" value={price} onChange={e => setPrice(e.target.value)} placeholder={String(startPrice)} className="filter-input" />
          <span className="tiny muted">Минимум: {startPrice.toLocaleString('ru-RU')} ₽/т</span>
        </div>
        <div className="field">
          <label className="tiny muted">Объём, т</label>
          <input type="number" value={volume} onChange={e => setVolume(e.target.value)} className="filter-input" />
          <span className="tiny muted">Доступно: {maxVolume} т</span>
        </div>
      </div>
      <div className="info-card">
        <div className="label">Итог заявки</div>
        <div className="value">{total.toLocaleString('ru-RU')} ₽</div>
      </div>
      <ConfirmDialog
        title="Подтвердить ставку?"
        message={`${parseFloat(price || '0').toLocaleString('ru-RU')} ₽/т × ${volume} т = ${total.toLocaleString('ru-RU')} ₽`}
        onConfirm={handleBid}
      >
        {(open) => (
          <button onClick={open} disabled={submitting || !price} className="field-cta" style={{ opacity: submitting || !price ? 0.5 : 1 }}>
            {submitting ? 'Отправка...' : 'Отправить ставку'}
          </button>
        )}
      </ConfirmDialog>
    </div>
  );
}
