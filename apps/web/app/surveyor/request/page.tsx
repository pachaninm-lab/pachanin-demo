'use client';
import { PageAccessGuard } from '../../../components/page-access-guard';
import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { api, ApiError } from '../../../lib/api-client';

function RequestSurveyorPageInner() {
  const searchParams = useSearchParams();
  const queryDealId = searchParams.get('dealId') || '';
  const queryType = searchParams.get('type') || '';
  const [form, setForm] = useState({
    dealId: queryDealId,
    type: queryType || 'QUALITY',
    urgency: 'STANDARD',
    notes: '',
  });
  const [dealInfo, setDealInfo] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (queryDealId) setForm((current) => ({ ...current, dealId: current.dealId || queryDealId }));
    if (queryType) setForm((current) => ({ ...current, type: current.type || queryType }));
  }, [queryDealId, queryType]);

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

  const handleSubmit = async () => {
    if (!form.dealId) {
      alert('Укажи номер сделки. Сюрвей должен быть привязан к конкретной сделке.');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/surveyor/inspections', form);
      setDone(true);
    } catch (e) {
      alert(e instanceof ApiError ? e.message : 'Не удалось заказать инспекцию');
    } finally {
      setSubmitting(false);
    }
  };

  const backHref = form.dealId ? `/deals/${form.dealId}` : '/surveyor';

  if (done) return (
    <div className="max-w-lg mx-auto text-center py-12">
      <div className="text-5xl mb-4">✅</div>
      <h2 className="text-xl font-bold">Инспекция заказана</h2>
      <p className="text-muted-foreground mt-2">Инспектор будет назначен в ближайшее время. Заказ привязан к сделке и может использоваться как доказательство.</p>
      <Link href={form.dealId ? `/surveyor?dealId=${encodeURIComponent(form.dealId)}` : '/surveyor'} className="text-primary text-sm mt-4 inline-block">← К списку инспекций</Link>
    </div>
  );

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div>
        <Link href={backHref} className="text-sm text-primary">← Назад</Link>
        <h1 className="text-2xl font-bold mt-2">Вызов сюрвейера</h1>
        <p className="text-sm text-muted-foreground mt-1">Сюрвей должен усиливать спор и качество, а не жить отдельно от сделки.</p>
      </div>

      <div className="border rounded-xl p-4 bg-violet-50">
        <div className="text-xs text-muted-foreground">Связка со сделкой</div>
        <div className="font-semibold mt-1">{form.dealId || 'Сделка не выбрана'}</div>
        <div className="text-sm text-muted-foreground mt-1">
          {dealInfo?.title || dealInfo?.lot?.title || 'Открывай вызов из карточки сделки, чтобы не терять контекст, спор и доказательства.'}
        </div>
      </div>

      <div className="border rounded-xl p-5 space-y-4">
        <div>
          <label className="text-xs font-medium">Номер сделки *</label>
          <input value={form.dealId} onChange={e => setForm({ ...form, dealId: e.target.value })} className="w-full border rounded-lg p-2.5 text-sm mt-1" placeholder="DEAL-240312-01" />
        </div>
        <div>
          <label className="text-xs font-medium">Тип инспекции</label>
          <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} className="w-full border rounded-lg p-2.5 text-sm mt-1">
            <option value="LOADING">Осмотр при погрузке</option>
            <option value="UNLOADING">Осмотр при выгрузке</option>
            <option value="QUALITY">Контроль качества</option>
            <option value="WEIGHT">Весовой контроль</option>
            <option value="FULL">Полная инспекция</option>
          </select>
        </div>
        <div>
          <label className="text-xs font-medium">Срочность</label>
          <select value={form.urgency} onChange={e => setForm({ ...form, urgency: e.target.value })} className="w-full border rounded-lg p-2.5 text-sm mt-1">
            <option value="STANDARD">Стандартная (24 часа)</option>
            <option value="URGENT">Срочная (4–6 часов)</option>
            <option value="EMERGENCY">Экстренная (до 2 часов)</option>
          </select>
        </div>
        <div>
          <label className="text-xs font-medium">Комментарий</label>
          <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className="w-full border rounded-lg p-2.5 text-sm mt-1" rows={3} placeholder="Что нужно проверить, где риск, почему инспекция критична..." />
        </div>
        <button onClick={handleSubmit} disabled={submitting} className="w-full bg-primary text-white py-2.5 rounded-lg text-sm font-medium disabled:opacity-50">
          {submitting ? 'Отправка...' : 'Заказать инспекцию'}
        </button>
      </div>
    </div>
  );
}

export default function RequestSurveyorPage() {
  return <Suspense fallback={<div className="muted">Загрузка...</div>}><RequestSurveyorPageInner /></Suspense>;
}
