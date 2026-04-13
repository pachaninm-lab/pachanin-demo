'use client';
import * as React from 'react';
import { CheckCircle2, AlertTriangle, Loader2, Banknote } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { useSessionStore } from '@/stores/useSessionStore';

interface ReleaseDialogProps {
  open: boolean;
  onClose: () => void;
  dealId: string;
  totalAmount: number;
  holdAmount: number;
  onSuccess?: (amount: number) => void;
}

type Step = 'amount' | 'confirm' | 'processing' | 'done';

function fmt(n: number): string {
  return n.toLocaleString('ru-RU') + ' ₽';
}

export function ReleaseDialog({ open, onClose, dealId, totalAmount, holdAmount, onSuccess }: ReleaseDialogProps) {
  const demoMode = useSessionStore(s => s.demoMode);
  const [step, setStep] = React.useState<Step>('amount');
  const [pct, setPct] = React.useState('100');
  const [error, setError] = React.useState('');

  const availableAmount = totalAmount - holdAmount;
  const releaseAmount = Math.round(availableAmount * (Math.min(100, Math.max(0, Number(pct) || 0)) / 100));

  function reset() {
    setStep('amount');
    setPct('100');
    setError('');
  }

  function handleClose() {
    reset();
    onClose();
  }

  function validateAmount() {
    const n = Number(pct);
    if (isNaN(n) || n <= 0 || n > 100) {
      setError('Введите значение от 1 до 100%');
      return false;
    }
    setError('');
    return true;
  }

  async function handleConfirm() {
    setStep('processing');
    try {
      const res = await fetch(`/api/deals/${dealId}/release`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: releaseAmount, percentage: Number(pct) }),
      });
      const data = await res.json() as { success: boolean; sandbox: boolean };
      if (data.success) {
        setStep('done');
        onSuccess?.(releaseAmount);
      }
    } catch {
      setStep('confirm'); // fallback
    }
  }

  return (
    <Dialog open={open} onOpenChange={open ? undefined : handleClose}>
      <DialogContent>
        {/* Sandbox banner */}
        {demoMode && (
          <div className="v9-sandbox-banner mb-4" role="note">
            <AlertTriangle size={14} />
            SANDBOX — операция будет симулирована, реальных транзакций нет
          </div>
        )}

        {step === 'amount' && (
          <>
            <DialogHeader>
              <DialogTitle>
                <Banknote className="inline-block mr-2" size={18} />
                Release средств · {dealId}
              </DialogTitle>
              <DialogDescription>
                Шаг 1 из 2 — укажите процент к выпуску
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-4 my-2">
              <div className="v9-card" style={{ background: '#FAFAFA' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: '#6B778C' }}>Доступно к выпуску</span>
                  <span style={{ fontFamily: '"JetBrains Mono",monospace', fontWeight: 700 }}>{fmt(availableAmount)}</span>
                </div>
                {holdAmount > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginTop: 6 }}>
                    <span style={{ color: '#DC2626' }}>Под hold (спор)</span>
                    <span style={{ fontFamily: '"JetBrains Mono",monospace', fontWeight: 700, color: '#DC2626' }}>{fmt(holdAmount)}</span>
                  </div>
                )}
              </div>

              <div className="flex gap-3 items-end">
                <div className="flex-1">
                  <Input
                    label="Процент к выпуску (%)"
                    type="number"
                    min={1}
                    max={100}
                    value={pct}
                    onChange={e => { setPct(e.target.value); setError(''); }}
                    error={error}
                    aria-describedby="release-amount-preview"
                  />
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  {[30, 50, 70, 100].map(p => (
                    <button
                      key={p}
                      onClick={() => setPct(String(p))}
                      style={{
                        padding: '4px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600,
                        background: Number(pct) === p ? '#0A7A5F' : '#F4F5F7',
                        color: Number(pct) === p ? '#fff' : '#495057',
                        border: 'none', cursor: 'pointer',
                      }}
                    >
                      {p}%
                    </button>
                  ))}
                </div>
              </div>

              <div
                id="release-amount-preview"
                style={{
                  padding: '10px 14px', background: 'rgba(10,122,95,0.06)',
                  border: '1px solid rgba(10,122,95,0.2)', borderRadius: 6,
                  display: 'flex', justifyContent: 'space-between',
                }}
              >
                <span style={{ fontSize: 13, color: '#495057' }}>К выпуску:</span>
                <span style={{ fontFamily: '"JetBrains Mono",monospace', fontSize: 16, fontWeight: 800, color: '#0A7A5F' }}>
                  {fmt(releaseAmount)}
                </span>
              </div>
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={handleClose}>Отмена</Button>
              <Button
                variant="primary"
                onClick={() => { if (validateAmount()) setStep('confirm'); }}
              >
                Далее →
              </Button>
            </DialogFooter>
          </>
        )}

        {step === 'confirm' && (
          <>
            <DialogHeader>
              <DialogTitle>Подтверждение release</DialogTitle>
              <DialogDescription>Шаг 2 из 2 — финальное подтверждение</DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-3 my-2">
              {[
                ['Сделка', dealId],
                ['Сумма к выпуску', fmt(releaseAmount)],
                ['Процент', `${pct}%`],
                ['Получатель', 'КФХ Ковалёв А.С. (Продавец)'],
                ['Банк', 'ПАО Сбербанк · Номинальный счёт'],
              ].map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '6px 0', borderBottom: '1px solid #E4E6EA' }}>
                  <span style={{ color: '#6B778C' }}>{k}</span>
                  <span style={{ fontWeight: 600, fontFamily: k === 'Сумма к выпуску' ? '"JetBrains Mono",monospace' : undefined }}>{v}</span>
                </div>
              ))}
            </div>

            <div style={{ padding: '10px 14px', background: 'rgba(220,38,38,0.05)', border: '1px solid rgba(220,38,38,0.2)', borderRadius: 6, marginTop: 8 }}>
              <p style={{ fontSize: 12, color: '#DC2626', fontWeight: 600, margin: 0 }}>
                ⚠ Это необратимое действие. После подтверждения средства будут перечислены продавцу.
              </p>
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={() => setStep('amount')}>← Назад</Button>
              <Button variant="danger" onClick={handleConfirm}>
                {demoMode ? 'SANDBOX: Подтвердить release' : 'Подтвердить release'}
              </Button>
            </DialogFooter>
          </>
        )}

        {step === 'processing' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '24px 0' }}>
            <Loader2 size={40} color="#0A7A5F" className="animate-spin" aria-label="Обработка" />
            <p style={{ fontSize: 15, fontWeight: 600, color: '#0F1419' }}>Отправляем запрос в банк...</p>
            <p style={{ fontSize: 12, color: '#6B778C' }}>Callback CB-44x · ПАО Сбербанк</p>
          </div>
        )}

        {step === 'done' && (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '20px 0' }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(22,163,74,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CheckCircle2 size={32} color="#16A34A" />
              </div>
              <p style={{ fontSize: 16, fontWeight: 800, color: '#0F1419' }}>Release выполнен</p>
              <p style={{ fontSize: 24, fontFamily: '"JetBrains Mono",monospace', fontWeight: 800, color: '#16A34A' }}>
                {fmt(releaseAmount)}
              </p>
              <p style={{ fontSize: 12, color: '#6B778C' }}>
                {demoMode ? 'SANDBOX: симулировано' : `Банк подтвердил · ${new Date().toLocaleString('ru-RU')}`}
              </p>
            </div>
            <DialogFooter>
              <Button variant="primary" onClick={handleClose}>Закрыть</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
