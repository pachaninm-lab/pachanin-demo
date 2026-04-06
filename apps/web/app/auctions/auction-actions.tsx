'use client';
import { useState } from 'react';
import { api, ApiError } from '../../lib/api-client';
import { useToast } from '../../components/toast';
import { ConfirmDialog } from '../../components/confirm-dialog';

export function AuctionActions({ lotId, bidId, bidStatus }: { lotId: string; bidId: string; bidStatus?: string }) {
  const { show } = useToast();
  const [accepted, setAccepted] = useState(bidStatus === 'WINNER' || bidStatus === 'WON');
  const [loading, setLoading] = useState(false);

  const acceptBid = async () => {
    setLoading(true);
    try {
      await api.post(`/auctions/lots/${lotId}/accept`, { bidId });
      setAccepted(true);
      show('success', 'Ставка принята. Сделка создана.');
      window.location.reload();
    } catch (error: any) {
      const message = error instanceof ApiError ? error.message : 'Не удалось принять ставку';
      show('error', message);
    } finally {
      setLoading(false);
    }
  };

  const refuseBid = async () => {
    setLoading(true);
    try {
      await api.post(`/auctions/lots/${lotId}/refuse`, { bidId });
      show('success', 'Ставка отклонена.');
      window.location.reload();
    } catch (error: any) {
      const message = error instanceof ApiError ? error.message : 'Не удалось отклонить ставку';
      show('error', message);
    } finally {
      setLoading(false);
    }
  };

  if (accepted) {
    return <span style={{ color: '#22C55E', fontWeight: 700 }}>Победитель сделки</span>;
  }

  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <ConfirmDialog
        title="Принять ставку?"
        message="После подтверждения будет создана сделка и лот перейдёт в deal rail."
        confirmLabel="Принять"
        onConfirm={acceptBid}
      >
        {(open) => <button className="btn btn-primary" disabled={loading} onClick={open}>Принять</button>}
      </ConfirmDialog>
      <ConfirmDialog
        title="Отклонить ставку?"
        message="Ставка будет снята с рассмотрения."
        confirmLabel="Отклонить"
        onConfirm={refuseBid}
      >
        {(open) => <button className="btn btn-secondary" disabled={loading} onClick={open}>Отклонить</button>}
      </ConfirmDialog>
    </div>
  );
}
