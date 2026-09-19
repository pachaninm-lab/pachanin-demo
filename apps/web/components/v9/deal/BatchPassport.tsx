'use client';
import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, AlertTriangle, MapPin, Package, FlaskConical, Route, History } from 'lucide-react';
import { Badge } from '@/components/v9/ui/badge';
import { Skeleton } from '@/components/v9/ui/skeleton';
import { useSessionStore } from '@/stores/useSessionStore';

interface QualityMeasure {
  parameter: string;
  value: number;
  unit: string;
  norm: string;
  status: 'ok' | 'warn' | 'fail';
  lab: string;
  date: string;
}

interface RoutePoint {
  point: string;
  location: string;
  lat: number;
  lon: number;
  ts: string;
  actor: string;
}

interface BatchEvent {
  type: string;
  ts: string;
  actor: string;
  detail: string;
}

interface Scores {
  disputeRisk: number;
  qualityScore: number;
  deliveryScore: number;
  sellerRating: number;
}

interface BatchData {
  batchId: string;
  dealId: string;
  crop: string;
  variety?: string;
  harvestYear?: number;
  origin?: { region: string; district: string; farm: string; field: string };
  quantity?: { gross: number; net: number; unit: string; weightBridgeTicket: string };
  fgisId?: string;
  fgisStatus: string;
  epdStatus?: string;
  epdId?: string;
  quality: QualityMeasure[];
  route: RoutePoint[];
  events: BatchEvent[];
  scores: Scores;
}

const eventTypeLabels: Record<string, string> = {
  doc_uploaded: 'Документ загружен',
  payment_reserved: 'Платёж зарезервирован',
  loaded: 'Загрузка завершена',
  fgis_sdiz: 'СДИЗ подписан',
  in_transit: 'В пути',
  arrived: 'Прибытие',
  lab_result: 'Лаб. результат',
  dispute_opened: 'Спор открыт',
  released: 'Средства выпущены',
};

function ScoreMeter({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ flex: 1, minWidth: 80 }}>
      <div style={{ fontSize: 11, color: '#6B778C', marginBottom: 4 }}>{label}</div>
      <div style={{ height: 6, background: '#E4E6EA', borderRadius: 999, overflow: 'hidden', marginBottom: 4 }}>
        <div style={{ height: '100%', width: `${value}%`, background: color, borderRadius: 999 }} />
      </div>
      <div style={{ fontSize: 13, fontWeight: 700, color }}>{value}</div>
    </div>
  );
}

interface Props {
  dealId: string;
}

export function BatchPassport({ dealId }: Props) {
  const demoMode = useSessionStore(s => s.demoMode);
  const [activeSection, setActiveSection] = React.useState<'quality' | 'route' | 'events'>('quality');

  const { data: batch, isLoading, isError } = useQuery<BatchData>({
    queryKey: ['deals', dealId, 'passport'],
    queryFn: () => fetch(`/api/deals/${dealId}/passport`).then(r => r.json()),
  });

  if (isLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Skeleton className="h-24" />
        <Skeleton className="h-40" />
        <Skeleton className="h-32" />
      </div>
    );
  }

  if (isError || !batch) {
    return <div style={{ textAlign: 'center', padding: 24, color: '#DC2626' }}>Паспорт партии недоступен</div>;
  }

  const warnQuality = batch.quality.filter(q => q.status !== 'ok');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Batch header */}
      <div style={{ padding: '16px 20px', background: 'rgba(10,122,95,0.04)', border: '1px solid rgba(10,122,95,0.15)', borderRadius: 8 }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
          <Badge variant="success">Паспорт партии</Badge>
          {batch.fgisStatus === 'signed' && <Badge variant="success">ФГИС: СДИЗ подписан</Badge>}
          {batch.epdStatus === 'transmitted' && <Badge variant="success">ЭПД: передан</Badge>}
          {warnQuality.length > 0 && <Badge variant="warning">{warnQuality.length} отклонений кач-ва</Badge>}
          {demoMode && <Badge variant="neutral">SANDBOX</Badge>}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <div style={{ fontSize: 11, color: '#6B778C' }}>ID партии</div>
            <div style={{ fontFamily: '"JetBrains Mono",monospace', fontSize: 12, fontWeight: 700, color: '#0A7A5F' }}>{batch.batchId}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: '#6B778C' }}>Культура / Сорт</div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{batch.crop}{batch.variety ? ` · ${batch.variety}` : ''}</div>
          </div>
          {batch.fgisId && (
            <div>
              <div style={{ fontSize: 11, color: '#6B778C' }}>СДИЗ</div>
              <div style={{ fontFamily: '"JetBrains Mono",monospace', fontSize: 11, color: '#0A7A5F' }}>{batch.fgisId}</div>
            </div>
          )}
          {batch.epdId && (
            <div>
              <div style={{ fontSize: 11, color: '#6B778C' }}>ЭПД</div>
              <div style={{ fontFamily: '"JetBrains Mono",monospace', fontSize: 11, color: '#0A7A5F' }}>{batch.epdId}</div>
            </div>
          )}
          {batch.origin && (
            <div>
              <div style={{ fontSize: 11, color: '#6B778C' }}>Хозяйство</div>
              <div style={{ fontSize: 12 }}>{batch.origin.farm}</div>
              <div style={{ fontSize: 11, color: '#6B778C' }}>{batch.origin.region}, {batch.origin.district}</div>
            </div>
          )}
          {batch.quantity && (
            <div>
              <div style={{ fontSize: 11, color: '#6B778C' }}>Масса нетто / брутто</div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{batch.quantity.net} {batch.quantity.unit}</div>
              <div style={{ fontSize: 11, color: '#6B778C' }}>Брутто: {batch.quantity.gross} {batch.quantity.unit} · {batch.quantity.weightBridgeTicket}</div>
            </div>
          )}
        </div>
      </div>

      {/* Score meters */}
      <div style={{ display: 'flex', gap: 12, padding: '12px 16px', background: '#FAFAFA', border: '1px solid #E4E6EA', borderRadius: 8 }}>
        <ScoreMeter label="Риск спора" value={batch.scores.disputeRisk} color={batch.scores.disputeRisk >= 70 ? '#DC2626' : batch.scores.disputeRisk >= 40 ? '#D97706' : '#16A34A'} />
        <ScoreMeter label="Качество" value={batch.scores.qualityScore} color={batch.scores.qualityScore >= 80 ? '#0A7A5F' : '#D97706'} />
        <ScoreMeter label="Логистика" value={batch.scores.deliveryScore} color={batch.scores.deliveryScore >= 80 ? '#0A7A5F' : '#D97706'} />
        <div style={{ flex: 1, minWidth: 80 }}>
          <div style={{ fontSize: 11, color: '#6B778C', marginBottom: 4 }}>Рейтинг продавца</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: batch.scores.sellerRating >= 4.5 ? '#0A7A5F' : '#D97706' }}>
            {batch.scores.sellerRating > 0 ? `★ ${batch.scores.sellerRating}` : '—'}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 2, borderBottom: '1px solid #E4E6EA' }}>
        {[
          { id: 'quality' as const, label: 'Качество', icon: <FlaskConical size={12} /> },
          { id: 'route' as const, label: 'Маршрут', icon: <Route size={12} /> },
          { id: 'events' as const, label: 'История', icon: <History size={12} /> },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveSection(tab.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '7px 14px', border: 'none', background: 'none', cursor: 'pointer',
              fontSize: 12, fontWeight: activeSection === tab.id ? 700 : 400,
              color: activeSection === tab.id ? '#0A7A5F' : '#6B778C',
              borderBottom: activeSection === tab.id ? '2px solid #0A7A5F' : '2px solid transparent',
              marginBottom: -1,
            }}
          >
            {tab.icon}{tab.label}
          </button>
        ))}
      </div>

      {/* Quality */}
      {activeSection === 'quality' && (
        <div>
          {batch.quality.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 24, color: '#6B778C', fontSize: 13 }}>Нет данных о качестве</div>
          ) : (
            <div className="v9-table-wrap">
              <table className="v9-table">
                <thead>
                  <tr>
                    <th>Показатель</th>
                    <th style={{ textAlign: 'right' }}>Значение</th>
                    <th>Норма</th>
                    <th>Лаборатория</th>
                    <th>Дата</th>
                    <th>Статус</th>
                  </tr>
                </thead>
                <tbody>
                  {batch.quality.map((q, i) => (
                    <tr key={i} style={{ background: q.status !== 'ok' ? 'rgba(217,119,6,0.04)' : undefined }}>
                      <td style={{ fontSize: 12, fontWeight: 600 }}>{q.parameter}</td>
                      <td style={{ textAlign: 'right', fontFamily: '"JetBrains Mono",monospace', fontSize: 12, fontWeight: 700, color: q.status !== 'ok' ? '#D97706' : '#0F1419' }}>
                        {q.value} {q.unit !== '—' ? q.unit : ''}
                      </td>
                      <td style={{ fontSize: 11, color: '#6B778C' }}>{q.norm}</td>
                      <td style={{ fontSize: 11, color: '#6B778C' }}>{q.lab}</td>
                      <td style={{ fontSize: 11, color: '#6B778C' }}>{q.date}</td>
                      <td>
                        {q.status === 'ok'
                          ? <CheckCircle2 size={13} color="#16A34A" />
                          : <AlertTriangle size={13} color="#D97706" />}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Route */}
      {activeSection === 'route' && (
        <div>
          {batch.route.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 24, color: '#6B778C', fontSize: 13 }}>Маршрут не зафиксирован</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {batch.route.map((pt, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '20px 1fr', gap: 10, paddingBottom: 12 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: i === 0 ? '#0A7A5F' : i === batch.route.length - 1 ? '#0284C7' : '#D97706', flexShrink: 0 }} />
                    {i < batch.route.length - 1 && <div style={{ width: 1, flex: 1, background: '#E4E6EA', marginTop: 2 }} />}
                  </div>
                  <div style={{ paddingBottom: 4 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span style={{ fontSize: 12, fontWeight: 700 }}>{pt.point}</span>
                      <Badge variant="neutral" style={{ fontSize: 10 }}>{pt.actor}</Badge>
                    </div>
                    <div style={{ fontSize: 11, color: '#6B778C', marginTop: 1 }}>
                      <MapPin size={10} style={{ marginRight: 3, display: 'inline' }} />
                      {pt.location}
                    </div>
                    <div style={{ fontSize: 11, color: '#6B778C', marginTop: 1 }}>
                      {new Date(pt.ts).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      {' · '}
                      <span style={{ fontFamily: 'monospace' }}>{pt.lat.toFixed(4)}, {pt.lon.toFixed(4)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Events */}
      {activeSection === 'events' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {batch.events.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 24, color: '#6B778C', fontSize: 13 }}>Нет событий</div>
          ) : (
            batch.events.map((ev, i) => (
              <div key={i} style={{ display: 'flex', gap: 12, padding: '8px 12px', background: '#FAFAFA', border: '1px solid #E4E6EA', borderRadius: 6 }}>
                <div style={{ fontSize: 11, color: '#6B778C', minWidth: 80 }}>
                  {new Date(ev.ts).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 600 }}>{eventTypeLabels[ev.type] ?? ev.type}</div>
                  <div style={{ fontSize: 11, color: '#6B778C', marginTop: 2 }}>{ev.detail}</div>
                </div>
                <Badge variant="neutral" style={{ fontSize: 10, whiteSpace: 'nowrap' }}>{ev.actor}</Badge>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
