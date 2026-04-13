'use client';
import * as React from 'react';
import Link from 'next/link';
import { useQuery, useMutation } from '@tanstack/react-query';
import { CheckCircle2, XCircle, Clock, AlertTriangle, ExternalLink, Loader2, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/v9/ui/badge';
import { Button } from '@/components/v9/ui/button';
import { Skeleton } from '@/components/v9/ui/skeleton';
import { useSessionStore } from '@/stores/useSessionStore';
import { toast } from 'sonner';

interface ReadinessContour {
  id: string;
  label: string;
  status: 'done' | 'pending' | 'blocked' | 'active' | 'none';
  owner: string;
  blocker: string | null;
  nextAction: string | null;
  sla: string;
  fgisId?: string | null;
  epdId?: string | null;
  nominalAccountId?: string | null;
  disputeId?: string | null;
}

interface ReadinessData {
  dealId: string;
  contours: ReadinessContour[];
}

const statusConfig = {
  done: { label: 'Выполнено', color: '#16A34A', bg: 'rgba(22,163,74,0.06)', border: 'rgba(22,163,74,0.2)', icon: CheckCircle2 },
  pending: { label: 'Ожидает', color: '#D97706', bg: 'rgba(217,119,6,0.06)', border: 'rgba(217,119,6,0.2)', icon: Clock },
  blocked: { label: 'Заблокировано', color: '#DC2626', bg: 'rgba(220,38,38,0.06)', border: 'rgba(220,38,38,0.2)', icon: XCircle },
  active: { label: 'Активный', color: '#DC2626', bg: 'rgba(220,38,38,0.06)', border: 'rgba(220,38,38,0.2)', icon: AlertTriangle },
  none: { label: 'Нет', color: '#6B778C', bg: 'rgba(107,119,140,0.04)', border: '#E4E6EA', icon: CheckCircle2 },
};

interface Props {
  dealId: string;
}

export function DealReadinessMatrix({ dealId }: Props) {
  const demoMode = useSessionStore(s => s.demoMode);
  const [actioningId, setActioningId] = React.useState<string | null>(null);

  const { data, isLoading, isError, refetch } = useQuery<ReadinessData>({
    queryKey: ['deals', dealId, 'readiness'],
    queryFn: () => fetch(`/api/deals/${dealId}/readiness`).then(r => r.json()),
  });

  const fgisMutation = useMutation({
    mutationFn: async (contourId: string) => {
      setActioningId(contourId);
      await fetch('/api/fgis/sdiz', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dealId }) });
      await new Promise(r => setTimeout(r, 600));
    },
    onSuccess: (_, contourId) => {
      setActioningId(null);
      toast.success(demoMode ? `[SANDBOX] ${contourId.toUpperCase()} — статус обновлён` : 'Статус обновлён');
      refetch();
    },
    onError: () => setActioningId(null),
  });

  const sberMutation = useMutation({
    mutationFn: async () => {
      setActioningId('bank');
      await fetch(`/api/deals/${dealId}/nominal/confirm`, { method: 'POST' });
    },
    onSuccess: () => {
      setActioningId(null);
      toast.success(demoMode ? '[SANDBOX] Эскалация в Сбер отправлена' : 'Эскалация отправлена');
      refetch();
    },
    onError: () => setActioningId(null),
  });

  if (isLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {[0,1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-16" />)}
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div style={{ textAlign: 'center', padding: 24, color: '#DC2626' }}>
        Ошибка загрузки матрицы
        <Button variant="ghost" size="sm" onClick={() => refetch()} style={{ marginLeft: 8 }}>
          <RefreshCw size={12} style={{ marginRight: 4 }} />Повторить
        </Button>
      </div>
    );
  }

  const blockedCount = data.contours.filter(c => c.status === 'blocked' || c.status === 'active').length;
  const doneCount = data.contours.filter(c => c.status === 'done' || c.status === 'none').length;
  const readinessPct = Math.round((doneCount / data.contours.length) * 100);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header summary */}
      <div style={{ display: 'flex', gap: 16, alignItems: 'center', padding: '12px 16px', background: blockedCount > 0 ? 'rgba(220,38,38,0.04)' : 'rgba(22,163,74,0.04)', border: `1px solid ${blockedCount > 0 ? 'rgba(220,38,38,0.2)' : 'rgba(22,163,74,0.2)'}`, borderRadius: 8 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: blockedCount > 0 ? '#DC2626' : '#16A34A' }}>
            {blockedCount > 0 ? `${blockedCount} контур(а) заблокированы — переход к расчёту невозможен` : 'Все контуры в норме — сделка готова к расчёту'}
          </div>
          <div style={{ fontSize: 11, color: '#6B778C', marginTop: 2 }}>
            {doneCount} из {data.contours.length} контуров закрыты · Готовность {readinessPct}%
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {blockedCount > 0 && <Badge variant="danger" dot>{blockedCount} блокера</Badge>}
          <Badge variant={readinessPct === 100 ? 'success' : 'warning'}>{readinessPct}%</Badge>
        </div>
      </div>

      {/* Readiness bar */}
      <div style={{ height: 6, background: '#E4E6EA', borderRadius: 999, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${readinessPct}%`, background: blockedCount > 0 ? '#D97706' : '#16A34A', borderRadius: 999, transition: 'width 0.5s ease' }} />
      </div>

      {/* Contours table */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {data.contours.map(contour => {
          const cfg = statusConfig[contour.status] ?? statusConfig.pending;
          const Icon = cfg.icon;
          const isActioning = actioningId === contour.id;

          return (
            <div
              key={contour.id}
              style={{
                padding: '12px 14px',
                background: cfg.bg,
                border: `1px solid ${cfg.border}`,
                borderRadius: 8,
              }}
            >
              <div style={{ display: 'grid', gridTemplateColumns: '20px 1fr auto', gap: 10, alignItems: 'flex-start' }}>
                {/* Status icon */}
                {isActioning
                  ? <Loader2 size={14} color={cfg.color} style={{ marginTop: 1, animation: 'spin 0.8s linear infinite' }} />
                  : <Icon size={14} color={cfg.color} style={{ marginTop: 1, flexShrink: 0 }} />}

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#0F1419' }}>{contour.label}</span>
                    <Badge variant={contour.status === 'done' || contour.status === 'none' ? 'success' : contour.status === 'blocked' || contour.status === 'active' ? 'danger' : 'warning'}>
                      {cfg.label}
                    </Badge>
                    {contour.fgisId && (
                      <span style={{ fontFamily: '"JetBrains Mono",monospace', fontSize: 10, color: '#6B778C' }}>
                        {contour.fgisId}
                      </span>
                    )}
                    {contour.epdId && (
                      <span style={{ fontFamily: '"JetBrains Mono",monospace', fontSize: 10, color: '#6B778C' }}>
                        {contour.epdId}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: '#6B778C', marginTop: 3 }}>
                    Ответственный: {contour.owner} · SLA: {contour.sla}
                  </div>
                  {contour.blocker && (
                    <div style={{ fontSize: 12, color: '#DC2626', marginTop: 4, fontWeight: 500 }}>
                      ⚠ {contour.blocker}
                    </div>
                  )}
                  {contour.nextAction && (
                    <div style={{ fontSize: 11, color: '#495057', marginTop: 3 }}>
                      → {contour.nextAction}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  {contour.id === 'fgis' && contour.status !== 'done' && (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => fgisMutation.mutate(contour.id)}
                      disabled={isActioning}
                      style={{ fontSize: 11 }}
                    >
                      {isActioning ? 'Отправка...' : 'Создать СДИЗ'}
                    </Button>
                  )}
                  {contour.id === 'bank' && contour.status === 'blocked' && (
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => sberMutation.mutate()}
                      disabled={isActioning}
                      style={{ fontSize: 11 }}
                    >
                      {isActioning ? '...' : 'Эскалировать'}
                    </Button>
                  )}
                  {contour.id === 'edo' && contour.status === 'blocked' && (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => { toast.success(demoMode ? '[SANDBOX] Запрос подписи КЭП/МЧД отправлен' : 'Запрос отправлен'); }}
                      style={{ fontSize: 11 }}
                    >
                      Подписать КЭП
                    </Button>
                  )}
                  {contour.disputeId && (
                    <Button variant="ghost" size="sm" asChild style={{ fontSize: 11 }}>
                      <Link href={`/platform-v7/disputes/${contour.disputeId}`}>
                        War-room <ExternalLink size={10} style={{ marginLeft: 2 }} />
                      </Link>
                    </Button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {demoMode && (
        <div style={{ fontSize: 11, color: '#6B778C', textAlign: 'center', marginTop: 4 }}>
          SANDBOX — статусы ФГИС, ЭПД и Сбер симулированы. В production — реальные API-вызовы.
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
