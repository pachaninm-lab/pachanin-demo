'use client';
import { useState } from 'react';
import { api, ApiError } from '../../lib/api-client';
import { useToast } from '../../components/toast';
import { ConfirmDialog } from '../../components/confirm-dialog';
import { ActionOutcomePanel } from '../../components/action-outcome-panel';

export function SettlementActions({ dealId }: { dealId: string }) {
  const { show } = useToast();
  const [confirmed, setConfirmed] = useState(false);
  const [released, setReleased] = useState(false);
  const [loading, setLoading] = useState('');

  const confirm = async () => {
    setLoading('confirm');
    try {
      await api.post(`/settlement-engine/deal/${dealId}/confirm`);
      setConfirmed(true);
      show('success', 'Калькуляция подтверждена покупателем');
    } catch (e) {
      show('error', e instanceof ApiError ? e.message : 'Ошибка');
    } finally {
      setLoading('');
    }
  };

  const release = async () => {
    setLoading('release');
    try {
      await api.post(`/settlement-engine/deal/${dealId}/release`);
      setReleased(true);
      show('success', 'Оплата разрешена оператором');
    } catch (e) {
      show('error', e instanceof ApiError ? e.message : 'Ошибка');
    } finally {
      setLoading('');
    }
  };

  return (
    <div className="section-stack" style={{ marginTop: 16 }}>
      <div className="card">
        <div className="section-title">Действия по расчёту</div>
        <div className="muted" style={{ marginTop: 8 }}>Сначала подтверждение калькуляции, затем release выплаты. После каждого шага пользователь не должен теряться: следующий модуль должен быть виден сразу.</div>
        <div style={{ display: 'flex', gap: 12, marginTop: 14, flexWrap: 'wrap' }}>
          <ConfirmDialog title="Подтвердить калькуляцию?" message="Вы подтверждаете итоговую сумму расчёта по данной сделке." confirmLabel="Подтвердить" onConfirm={confirm}>
            {(open) => <button onClick={open} disabled={confirmed || loading === 'confirm'} className="button primary" style={{ opacity: confirmed ? 0.5 : 1 }}>
              {confirmed ? '✓ Подтверждено' : loading === 'confirm' ? '...' : 'Подтвердить калькуляцию'}
            </button>}
          </ConfirmDialog>
          <ConfirmDialog title="Разрешить выплату?" message="Средства будут направлены продавцу. Действие необратимо." confirmLabel="Разрешить выплату" onConfirm={release}>
            {(open) => <button onClick={open} disabled={released || !confirmed || loading === 'release'} className="button" style={{ opacity: released || !confirmed ? 0.5 : 1 }}>
              {released ? '✓ Выплата разрешена' : 'Разрешить выплату'}
            </button>}
          </ConfirmDialog>
        </div>
      </div>

      {confirmed && !released ? (
        <ActionOutcomePanel
          title="Калькуляция подтверждена"
          detail="Промежуточный шаг закрыт. Теперь оператору нужно открыть следующий обязательный модуль и разрешить выплату без потери worksheet-контекста."
          status="confirmed"
          primary={{ href: `/settlement/${dealId}`, label: 'Открыть settlement contour' }}
          secondary={[
            { href: '/documents', label: 'Проверить документы' },
            { href: '/payments', label: 'Открыть платежи', variant: 'tertiary' }
          ]}
        />
      ) : null}

      {released ? (
        <ActionOutcomePanel
          title="Выплата разрешена"
          detail="Деньги выпущены в сделку. Дальше нужно открыть карточку сделки и убедиться, что документы, аудит и реестр платежей согласованы между собой."
          status="released"
          primary={{ href: `/deals/${dealId}`, label: 'Открыть сделку' }}
          secondary={[
            { href: '/payments', label: 'Реестр платежей' },
            { href: '/audit', label: 'Проверить аудит', variant: 'tertiary' }
          ]}
        />
      ) : null}
    </div>
  );
}
