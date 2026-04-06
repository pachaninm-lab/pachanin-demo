'use client';
import { PageAccessGuard } from '../../components/page-access-guard';
import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { api } from '../../lib/api-client';

function InsurancePageInner() {
  const searchParams = useSearchParams();
  const dealId = searchParams.get('dealId') || '';
  const [policies, setPolicies] = useState<any[]>([]);
  const [providers, setProviders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/insurance/policies').catch(() => []),
      api.get('/insurance/providers').catch(() => [
        { id: 'ins-1', name: 'СОГАЗ АгроСтрахование', rating: 4.7, coverage: ['грузы', 'урожай'], minPremium: 5000 },
        { id: 'ins-2', name: 'Ингосстрах Cargo', rating: 4.6, coverage: ['грузы', 'контрагентный риск'], minPremium: 3000 },
        { id: 'ins-3', name: 'АльфаСтрахование Агро', rating: 4.5, coverage: ['грузы', 'урожай'], minPremium: 4000 },
      ]),
    ]).then(([pol, prov]) => {
      setPolicies(Array.isArray(pol) ? pol : []);
      setProviders(Array.isArray(prov) ? prov : []);
    }).finally(() => setLoading(false));
  }, []);

  const visiblePolicies = useMemo(() => dealId ? policies.filter((item) => String(item.dealId || '') === dealId) : policies, [policies, dealId]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Страхование</h1>
          <p className="text-sm text-muted-foreground">Страхование грузов, спорного хвоста и исполнения по сделке.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {dealId ? <Link href={`/deals/${dealId}`} className="border px-4 py-2 rounded-lg text-sm font-medium">К сделке</Link> : null}
          <Link href={dealId ? `/insurance/calculate?dealId=${encodeURIComponent(dealId)}` : '/insurance/calculate'} className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium">💰 Рассчитать премию</Link>
        </div>
      </div>

      {dealId ? (
        <div className="border rounded-xl p-4 bg-blue-50">
          <div className="text-xs text-muted-foreground">Фильтр по сделке</div>
          <div className="font-semibold mt-1">{dealId}</div>
          <div className="text-sm text-muted-foreground mt-1">Показываются только полисы и действия, связанные с этой сделкой.</div>
        </div>
      ) : null}

      <div>
        <h2 className="text-lg font-semibold mb-3">Страховые компании</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {providers.map((p: any) => (
            <div key={p.id} className="border rounded-xl p-4">
              <div className="font-semibold">{p.name}</div>
              <div className="text-sm text-muted-foreground">⭐ {p.rating} · от {p.minPremium?.toLocaleString('ru-RU')} ₽</div>
              <div className="flex gap-1 mt-2 flex-wrap">{(p.coverage || []).map((c: string) => <span key={c} className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs">{c}</span>)}</div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-3">Полисы {dealId ? 'по сделке' : ''} ({visiblePolicies.length})</h2>
        {visiblePolicies.length === 0 && <div className="border rounded-xl p-8 text-center text-muted-foreground">Полисов пока нет. Открой расчёт из сделки и оформи страхование прямо по контексту.</div>}
        {visiblePolicies.map((pol: any) => (
          <Link key={pol.id} href={`/insurance/${pol.id}`} className="block border rounded-xl p-4 mb-2 hover:shadow-sm transition">
            <div className="flex justify-between items-center gap-3">
              <div>
                <div className="font-medium">Полис #{pol.id} · Сделка {pol.dealId}</div>
                <div className="text-sm text-muted-foreground">Покрытие: {pol.cargoValue?.toLocaleString('ru-RU')} ₽ · Премия: {pol.premium?.toLocaleString('ru-RU')} ₽</div>
              </div>
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${pol.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-gray-100'}`}>{pol.status === 'ACTIVE' ? 'Действует' : pol.status}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

export default function InsurancePage() {
  return <Suspense fallback={<div className="muted">Загрузка...</div>}><InsurancePageInner /></Suspense>;
}
