'use client';
import { PageAccessGuard } from '../../components/page-access-guard';
import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { api } from '../../lib/api-client';

const STATUS_LABEL: Record<string, { text: string; color: string }> = {
  REQUESTED: { text: 'Запрошен', color: '#D97706' },
  ASSIGNED: { text: 'Назначен', color: '#2563EB' },
  IN_PROGRESS: { text: 'На осмотре', color: '#7C3AED' },
  REPORT_SUBMITTED: { text: 'Акт готов', color: '#0A5C36' },
  ACCEPTED: { text: 'Принят', color: '#16A34A' },
  DISPUTED: { text: 'Оспорен', color: '#DC2626' },
};

const TYPE_LABEL: Record<string, string> = {
  LOADING: '📦 Погрузка',
  UNLOADING: '📦 Выгрузка',
  QUALITY: '🔬 Качество',
  WEIGHT: '⚖️ Весовой контроль',
  FULL: '📋 Полная инспекция',
};

function SurveyorPageInner() {
  const searchParams = useSearchParams();
  const dealId = searchParams.get('dealId') || '';
  const [inspections, setInspections] = useState<any[]>([]);
  const [providers, setProviders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/surveyor/inspections').catch(() => []),
      api.get('/surveyor/providers').catch(() => []),
    ]).then(([insp, prov]) => {
      setInspections(Array.isArray(insp) ? insp : []);
      setProviders(Array.isArray(prov) ? prov : [
        { id: 'sv-1', name: 'ООО «АгроИнспект»', region: 'ЦФО', rating: 4.8, inspections: 247, responseTime: '2-4 часа' },
        { id: 'sv-2', name: 'ИП Кузнецов (GAFTA)', region: 'Тамбовская обл.', rating: 4.9, inspections: 189, responseTime: '4-6 часов' },
        { id: 'sv-3', name: 'SGS Россия', region: 'Федеральный', rating: 4.7, inspections: 1200, responseTime: '24 часа' },
      ]);
    }).finally(() => setLoading(false));
  }, []);

  const visibleInspections = useMemo(() => dealId ? inspections.filter((item) => String(item.dealId || '') === dealId) : inspections, [inspections, dealId]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Сюрвейер</h1>
          <p className="text-sm text-muted-foreground">Независимый осмотр: погрузка, выгрузка, качество и весовой контроль.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {dealId ? <Link href={`/deals/${dealId}`} className="border px-4 py-2 rounded-lg text-sm font-medium">К сделке</Link> : null}
          <Link href={dealId ? `/surveyor/request?dealId=${encodeURIComponent(dealId)}` : '/surveyor/request'} className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium">+ Вызвать сюрвейера</Link>
        </div>
      </div>

      {dealId ? (
        <div className="border rounded-xl p-4 bg-violet-50">
          <div className="text-xs text-muted-foreground">Фильтр по сделке</div>
          <div className="font-semibold mt-1">{dealId}</div>
          <div className="text-sm text-muted-foreground mt-1">Показываются только инспекции, связанные с этой сделкой.</div>
        </div>
      ) : null}

      <div>
        <h2 className="text-lg font-semibold mb-3">Аккредитованные инспекторы</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {providers.map((p: any) => (
            <div key={p.id} className="border rounded-xl p-4">
              <div className="font-semibold">{p.name}</div>
              <div className="text-sm text-muted-foreground">{p.region} · ⭐ {p.rating} · {p.inspections} инспекций</div>
              <div className="text-xs text-muted-foreground mt-1">Время ответа: {p.responseTime}</div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-3">Инспекции {dealId ? 'по сделке' : ''} ({visibleInspections.length})</h2>
        {visibleInspections.length === 0 && <div className="border rounded-xl p-8 text-center text-muted-foreground">Инспекций пока нет. Нажми «Вызвать сюрвейера» и привяжи заказ к конкретной сделке.</div>}
        {visibleInspections.map((insp: any) => (
          <Link key={insp.id} href={`/surveyor/${insp.id}`} className="block border rounded-xl p-4 mb-2 hover:shadow-sm transition">
            <div className="flex justify-between items-center gap-3">
              <div>
                <div className="font-medium">{TYPE_LABEL[insp.type] || insp.type} · Сделка {insp.dealId}</div>
                <div className="text-sm text-muted-foreground">{insp.assignedSurveyorName || 'Инспектор не назначен'}</div>
              </div>
              <span style={{ background: `${STATUS_LABEL[insp.status]?.color || '#64748B'}20`, color: STATUS_LABEL[insp.status]?.color || '#64748B', padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600 }}>
                {STATUS_LABEL[insp.status]?.text || insp.status}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

export default function SurveyorPage() {
  return <Suspense fallback={<div className="muted">Загрузка...</div>}><SurveyorPageInner /></Suspense>;
}
