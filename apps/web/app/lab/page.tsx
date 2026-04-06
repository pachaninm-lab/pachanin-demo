'use client';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '../../lib/api-client';
import { PageFrame } from '../../components/page-frame';
import { Breadcrumbs } from '../../components/breadcrumbs';
import { SourceNote } from '../../components/source-note';
import { DetailHero } from '../../components/detail-hero';
import { CriticalBlockersPanel } from '../../components/critical-blockers-panel';
import { PageAccessGuard } from '../../components/page-access-guard';
import { LAB_ROLES } from '../../lib/route-roles';
import { ServiceProviderSelectionPanel } from '../../components/service-provider-selection-panel';
import { ServiceProviderAssignmentConsole } from '../../components/service-provider-assignment-console';
import { buildProviderStagePlan } from '../../../../packages/domain-core/src';
import { buildProviderContextPreset, describeProviderContext } from '../../lib/provider-stage-context';
import { buildLinkedObjectId, readDealIdParam } from '../../lib/deal-context';

function LabPage() {
  const searchParams = useSearchParams();
  const queryDealId = readDealIdParam(searchParams);
  const [samples, setSamples] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/labs/samples').then((data: any) => setSamples(Array.isArray(data) ? data : [])).catch(() => setSamples([])).finally(() => setLoading(false));
  }, []);

  const visibleSamples = useMemo(() => queryDealId ? samples.filter((sample) => sample.dealId === queryDealId) : samples, [samples, queryDealId]);

  const labContext = useMemo(() => buildProviderContextPreset('LAB', {
    disputeSensitive: visibleSamples.some((sample) => Array.isArray(sample.blockers) && sample.blockers.length > 0),
    exportFlow: visibleSamples.some((sample) => String(sample.reason || '').toLowerCase().includes('export')),
    targetHours: visibleSamples[0]?.targetHours || 24,
    amountRub: visibleSamples.reduce((sum, sample) => sum + Math.max(Number(sample.financialImpactRub || 0), 0), 0) || null,
  }), [visibleSamples]);
  const labPlan = useMemo(() => buildProviderStagePlan('LAB', labContext), [labContext]);
  const labPolicy = labPlan.items.find((item) => item.category === 'LAB')!;
  const surveyPolicy = labPlan.items.find((item) => item.category === 'SURVEY')!;

  const blockers = useMemo(() => {
    const pending = visibleSamples.filter((sample) => Array.isArray(sample.blockers) && sample.blockers.length > 0).length;
    return [
      pending > 0 ? `проб с незакрытыми блокерами: ${pending}` : null,
      !visibleSamples.length && !loading ? 'нет подтверждённых проб / тестов' : null
    ].filter(Boolean) as string[];
  }, [visibleSamples, loading]);

  return (
    <PageFrame title="Лаборатория" subtitle="Пробы, цепочка хранения, ретест и решение по качеству должны быть привязаны к деньгам и спорам.">
      <div className="space-y-6">
        <Breadcrumbs items={[{ href: '/', label: 'Главная' }, { label: 'Лаборатория' }]} />
        <SourceNote source={samples[0]?.source || 'canonical.lab.in-progress'} warning="Лаборатория должна показывать цепочку хранения, результат по качеству и финансовое влияние. Нельзя прятать ретест и влияние на цену внутри свободного текста." compact />

        <DetailHero
          kicker="Контур качества"
          title="Каждая проба должна иметь полную цепочку хранения"
          description="Система должна отвечать на 4 вопроса: кто взял пробу, где она сейчас, есть ли ретест и как результат влияет на деньги и спор."
          chips={[`Проб ${visibleSamples.length}`, `С блокерами ${visibleSamples.filter((sample) => sample.blockers?.length).length}`]}
          nextStep={visibleSamples[0]?.nextAction || 'Открыть верхнюю пробу и снять блокер'}
          owner="Лаборатория"
          blockers={blockers.length ? blockers.join(' · ') : 'критичных блокеров не видно'}
          actions={[{ href: '/lab/new', label: 'Новая проба' }, { href: '/survey', label: 'Сюрвей', variant: 'secondary' }, { href: '/disputes', label: 'Споры', variant: 'secondary' }]}
        />

        <CriticalBlockersPanel items={blockers} emptyLabel="Критичных блокеров по quality-контуру не видно." />

        <ServiceProviderSelectionPanel title="Рекомендуемая лаборатория" subtitle={describeProviderContext(labContext) || 'Выбор строится по культуре, SLA, устойчивости к спору и интеграции результата в сделку.'} selection={labPolicy.selection}
        policy={labPolicy} primaryHref="/service-providers" primaryLabel="Все исполнители" />
        <ServiceProviderAssignmentConsole stage="LAB" category="LAB" linkedObjectType="SLOT" linkedObjectId={visibleSamples[0]?.id || buildLinkedObjectId('LAB', visibleSamples[0]?.dealId, queryDealId)} linkedDealId={visibleSamples[0]?.dealId || queryDealId || null} context={labContext} policy={labPolicy} />

        <ServiceProviderSelectionPanel title="Рекомендуемый сюрвей / инспекция" subtitle={describeProviderContext(labContext) || 'Нужен для спорного и экспортного контура: качество, количество, независимый контроль.'} selection={surveyPolicy.selection}
        policy={surveyPolicy} primaryHref="/service-providers" primaryLabel="Сравнить сюрвей" />
        <ServiceProviderAssignmentConsole stage="LAB" category="SURVEY" linkedObjectType="SLOT" linkedObjectId={visibleSamples[0]?.id || buildLinkedObjectId('SURVEY', visibleSamples[0]?.dealId, queryDealId)} linkedDealId={visibleSamples[0]?.dealId || queryDealId || null} context={labContext} policy={surveyPolicy} />

        {loading && <div className="text-sm text-muted-foreground">Загрузка проб...</div>}
        {!loading && visibleSamples.length === 0 && <div className="text-sm text-muted-foreground">Проб пока нет</div>}
        <div className="space-y-3">
          {visibleSamples.map((sample: any) => {
            const latestTest = sample.latestTest || (Array.isArray(sample.tests) && sample.tests.length > 0 ? sample.tests[0] : null);
            const testId = latestTest?.id || sample.id;
            return (
              <Link key={sample.id} href={`/lab/${testId}`} className="block border rounded-xl p-4 hover:shadow-sm transition">
                <div className="flex justify-between items-center gap-3">
                  <div>
                    <div className="font-medium">{latestTest?.protocolNumber || sample.sampleCode || sample.id}</div>
                    <div className="text-sm text-muted-foreground">Сделка: {sample.dealId} · Статус пробы: {sample.status}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">Шагов цепочки: {sample.chainOfCustody?.length || 0} · Финансовое влияние: {Number(sample.financialImpactRub || 0).toLocaleString('ru-RU')} ₽</div>
                    {Array.isArray(sample.blockers) && sample.blockers.length > 0 ? <div className="text-xs text-amber-600 mt-1">Блокеры: {sample.blockers.join(' · ')}</div> : null}
                  </div>
                  <div className="text-right">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${(latestTest?.status || '').includes('COMPLETED') ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                      {latestTest?.status || 'DRAFT'}
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </PageFrame>
  );
}

export default function LabPageGuarded(props: any) {
  return (
    <PageAccessGuard allowedRoles={[...LAB_ROLES]} title="Лаборатория ограничена" subtitle="Экран нужен лаборатории, оператору и администратору: здесь ведут пробы, ретест и quality-решения.">
      <Suspense fallback={<div className="muted">Загрузка...</div>}>
        <LabPage {...props} />
      </Suspense>
    </PageAccessGuard>
  );
}
