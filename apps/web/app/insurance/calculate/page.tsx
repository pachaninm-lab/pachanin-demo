'use client';
import { PageAccessGuard } from '../../../components/page-access-guard';
import Link from 'next/link';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { api } from '../../../lib/api-client';

const CULTURES = ['wheat', 'barley', 'sunflower', 'corn', 'peas', 'chickpeas', 'rapeseed', 'soybean', 'millet'];
const CULTURE_RU: Record<string, string> = { wheat: 'Пшеница', barley: 'Ячмень', sunflower: 'Подсолнечник', corn: 'Кукуруза', peas: 'Горох', chickpeas: 'Нут', rapeseed: 'Рапс', soybean: 'Соя', millet: 'Просо' };

function riskLabel(level?: string) {
  if (level === 'HIGH') return 'Высокий';
  if (level === 'MEDIUM') return 'Средний';
  return 'Низкий';
}

function InsuranceCalcPageInner() {
  const searchParams = useSearchParams();
  const queryDealId = searchParams.get('dealId') || '';
  const [form, setForm] = useState({ dealId: queryDealId, cargoValue: '3960000', distance: '120', culture: 'wheat', transportType: 'auto' });
  const [result, setResult] = useState<any>(null);
  const [dealInfo, setDealInfo] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [issuing, setIssuing] = useState(false);
  const backHref = form.dealId ? `/deals/${form.dealId}` : '/insurance';

  useEffect(() => {
    if (!queryDealId) return;
    setForm((current) => current.dealId ? current : { ...current, dealId: queryDealId });
  }, [queryDealId]);

  useEffect(() => {
    let active = true;
    if (!form.dealId) {
      setDealInfo(null);
      return;
    }
    api.get(`/deals/${form.dealId}`)
      .then((payload: any) => { if (active) setDealInfo(payload); })
      .catch(() => { if (active) setDealInfo(null); });
    return () => { active = false; };
  }, [form.dealId]);

  const calculate = async () => {
    setLoading(true);
    try {
      const res = await api.post('/insurance/calculate', {
        dealId: form.dealId || undefined,
        cargoValue: Number(form.cargoValue),
        distance: Number(form.distance),
        culture: form.culture,
        transportType: form.transportType,
      });
      setResult(res);
    } catch {
      const value = Number(form.cargoValue);
      const dist = Number(form.distance);
      let rate = 0.0015;
      if (dist > 500) rate *= 1.3;
      if (['sunflower', 'rapeseed'].includes(form.culture)) rate *= 1.2;
      if (form.transportType === 'railway') rate *= 0.9;
      setResult({
        premium: Math.round(value * rate),
        coverageLimit: value,
        rate: (rate * 100).toFixed(3) + '%',
        riskLevel: rate > 0.002 ? 'HIGH' : rate > 0.0015 ? 'MEDIUM' : 'LOW',
        coverageTypes: [
          { type: 'CARGO_LOSS', name: 'Утрата груза', included: true },
          { type: 'CARGO_DAMAGE', name: 'Повреждение груза', included: true },
          { type: 'QUALITY_DEGRADATION', name: 'Ухудшение качества', included: true },
          { type: 'WEIGHT_SHORTAGE', name: 'Недостача по весу (>0.5%)', included: true },
          { type: 'DELAY_PENALTY', name: 'Штрафы за просрочку', included: dist > 200 },
          { type: 'COUNTERPARTY_DEFAULT', name: 'Неисполнение контрагентом', included: false, additionalPremium: Math.round(value * 0.005) },
        ],
      });
    } finally {
      setLoading(false);
    }
  };

  const handleIssue = async () => {
    if (!form.dealId) {
      alert('Страхование должно быть привязано к конкретной сделке. Открой расчёт из карточки сделки или укажи номер сделки.');
      return;
    }
    if (!result?.premium) {
      alert('Сначала рассчитай премию.');
      return;
    }
    setIssuing(true);
    try {
      await api.post('/insurance/policies', {
        dealId: form.dealId,
        coverageType: 'FULL',
        cargoValue: Number(form.cargoValue),
        premium: result.premium,
      });
      window.location.href = `/insurance?dealId=${encodeURIComponent(form.dealId)}`;
    } catch {
      alert('Не удалось оформить полис.');
    } finally {
      setIssuing(false);
    }
  };

  const coverageHint = useMemo(() => {
    if (!result?.coverageTypes?.length) return 'Полис должен закрывать риск груза, качество, недостачу и спорный хвост по рейсу.';
    return result.coverageTypes.filter((item: any) => item.included).map((item: any) => item.name).slice(0, 3).join(' · ');
  }, [result]);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <Link href={backHref} className="text-sm text-primary">← Назад</Link>
        <h1 className="text-2xl font-bold mt-2">Расчёт страховой премии</h1>
        <p className="text-sm text-muted-foreground mt-1">Страхование должно быть частью сделки, а не отдельной формой без привязки к контексту.</p>
      </div>

      <div className="border rounded-xl p-4 bg-blue-50">
        <div className="text-xs text-muted-foreground">Связка со сделкой</div>
        <div className="font-semibold mt-1">{form.dealId || 'Сделка не выбрана'}</div>
        <div className="text-sm text-muted-foreground mt-1">
          {dealInfo?.title || dealInfo?.lot?.title || 'Лучший сценарий — открывать расчёт прямо из карточки сделки.'}
        </div>
      </div>

      <div className="border rounded-xl p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium">Номер сделки</label>
            <input value={form.dealId} onChange={e => setForm({ ...form, dealId: e.target.value })} className="w-full border rounded-lg p-2.5 text-sm mt-1" placeholder="DEAL-240312-01" />
          </div>
          <div>
            <label className="text-xs font-medium">Стоимость груза (₽)</label>
            <input type="number" value={form.cargoValue} onChange={e => setForm({ ...form, cargoValue: e.target.value })} className="w-full border rounded-lg p-2.5 text-sm mt-1" />
          </div>
          <div>
            <label className="text-xs font-medium">Расстояние (км)</label>
            <input type="number" value={form.distance} onChange={e => setForm({ ...form, distance: e.target.value })} className="w-full border rounded-lg p-2.5 text-sm mt-1" />
          </div>
          <div>
            <label className="text-xs font-medium">Культура</label>
            <select value={form.culture} onChange={e => setForm({ ...form, culture: e.target.value })} className="w-full border rounded-lg p-2.5 text-sm mt-1">
              {CULTURES.map(c => <option key={c} value={c}>{CULTURE_RU[c] || c}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium">Транспорт</label>
            <select value={form.transportType} onChange={e => setForm({ ...form, transportType: e.target.value })} className="w-full border rounded-lg p-2.5 text-sm mt-1">
              <option value="auto">Автомобильный</option>
              <option value="railway">Железнодорожный</option>
            </select>
          </div>
        </div>
        <button onClick={calculate} disabled={loading} className="w-full bg-primary text-white py-2.5 rounded-lg text-sm font-medium disabled:opacity-50">
          {loading ? 'Расчёт...' : 'Рассчитать премию'}
        </button>
      </div>

      {result ? (
        <div className="border rounded-xl p-5 space-y-4">
          <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
            <div>
              <div className="text-sm text-muted-foreground">Страховая премия</div>
              <div className="text-3xl font-bold text-primary">{result.premium?.toLocaleString('ru-RU')} ₽</div>
              <div className="text-sm text-muted-foreground mt-1">Тариф: {result.rate} · Уровень риска: {riskLabel(result.riskLevel)}</div>
            </div>
            <div className="md:text-right">
              <div className="text-sm text-muted-foreground">Лимит покрытия</div>
              <div className="text-xl font-bold">{result.coverageLimit?.toLocaleString('ru-RU')} ₽</div>
              <div className="text-xs text-muted-foreground mt-1">{coverageHint}</div>
            </div>
          </div>

          <div>
            <div className="font-semibold text-sm mb-2">Что входит в полис</div>
            <div className="space-y-2">
              {result.coverageTypes?.map((ct: any) => (
                <div key={ct.type} className="flex justify-between items-center py-2 border-b border-gray-100 text-sm gap-4">
                  <div className="flex items-center gap-2">
                    <span>{ct.included ? '✅' : '➕'}</span>
                    <span>{ct.name}</span>
                  </div>
                  {ct.included ? (
                    <span className="text-green-600 text-xs">Включено</span>
                  ) : (
                    <span className="text-muted-foreground text-xs">+{ct.additionalPremium?.toLocaleString('ru-RU')} ₽</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-3">
            <button onClick={handleIssue} disabled={issuing} className="w-full bg-green-600 text-white py-3 rounded-lg font-medium disabled:opacity-50">
              {issuing ? 'Оформление...' : `Оформить полис за ${result.premium?.toLocaleString('ru-RU')} ₽`}
            </button>
            <Link href={form.dealId ? `/deals/${form.dealId}` : '/insurance'} className="w-full border rounded-lg py-3 text-center text-sm font-medium">
              Вернуться к сделке
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function InsuranceCalcPage() {
  return <Suspense fallback={<div className="muted">Загрузка...</div>}><InsuranceCalcPageInner /></Suspense>;
}
