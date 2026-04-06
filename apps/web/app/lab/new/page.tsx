'use client';
import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { api, ApiError } from '../../../lib/api-client';
import { useToast } from '../../../components/toast';
import { PageAccessGuard } from '../../../components/page-access-guard';
import { LAB_ROLES } from '../../../lib/route-roles';
import { AppShell } from '../../../components/app-shell';
import { OperationBlueprint } from '../../../components/operation-blueprint';
import { ModuleHub } from '../../../components/module-hub';
import { NextStepBar } from '../../../components/next-step-bar';
import { ActionOutcomePanel } from '../../../components/action-outcome-panel';

function NewLabSamplePageInner() {
  const { show } = useToast();
  const searchParams = useSearchParams();
  const [dealId, setDealId] = useState('');
  const [sealNumber, setSealNumber] = useState('');
  const [location, setLocation] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [createdSampleId, setCreatedSampleId] = useState('');

  useEffect(() => {
    const deal = searchParams.get('dealId');
    const seal = searchParams.get('sealNumber');
    const place = searchParams.get('location');
    if (deal) setDealId(deal);
    if (seal) setSealNumber(seal);
    if (place) setLocation(place);
  }, [searchParams]);

  const handleCreate = async () => {
    if (!dealId) {
      show('error', 'Укажите номер сделки');
      return;
    }
    setSubmitting(true);
    try {
      const result = await api.post<{ id: string }>('/labs/samples', { dealId, sealNumber, samplingLocation: location });
      setCreatedSampleId(String(result.id || ''));
      show('success', 'Проба зарегистрирована');
    } catch (e) {
      show('error', e instanceof ApiError ? e.message : 'Ошибка');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PageAccessGuard allowedRoles={[...LAB_ROLES]} title="Регистрация пробы скрыта по роли" subtitle="Создание новой пробы должно быть доступно только лаборатории и оператору.">
      <AppShell title="Регистрация новой пробы" subtitle="Проба должна логично связывать сделку, пломбу, место отбора, протокол и возможный спор.">
        <div className="page-surface form-shell">
          <OperationBlueprint
            title="Как функция пробы должна завершаться"
            subtitle="Лабораторная регистрация — это вход в контур качества, а не отдельная форма без продолжения."
            stages={[
              { title: 'Идентификация сделки', detail: 'Проба должна быть привязана к конкретной сделке и партии.', state: dealId ? 'done' : 'active', href: dealId ? `/deals/${dealId}` : '/deals' },
              { title: 'Отбор и пломба', detail: 'Место отбора и номер пломбы нужны для доказательной цепочки.', state: sealNumber || location ? 'active' : 'pending' },
              { title: 'Протокол лаборатории', detail: 'После регистрации следующий обязательный шаг — открыть карточку пробы и довести её до результата.', state: 'pending', href: '/lab' },
              { title: 'Влияние на приёмку и деньги', detail: 'Результат качества должен влиять на приёмку, спор или расчёт.', state: 'pending', href: '/receiving' }
            ]}
            outcomes={[
              { href: '/lab', label: 'Реестр лаборатории', detail: 'Открыть уже созданные пробы и протоколы.', meta: 'центр качества' },
              { href: dealId ? `/receiving/${dealId}` : '/receiving', label: 'Приёмка', detail: 'Передать результат в контур приёмки и решение по партии.', meta: 'после анализа' },
              { href: '/disputes', label: 'Споры по качеству', detail: 'Если показатели расходятся с допусками — открыть претензию без ручного поиска.', meta: 'quality dispute' }
            ]}
            rules={[
              'Проба считается рабочей только если её можно продолжить в карточку лаборатории и затем в решение по приёмке.',
              'Без номера сделки или цепочки доказательств запись пробы нельзя считать завершённой функцией.',
              'Результат качества обязан иметь операционное следствие: принять, пересчитать, отклонить или открыть спор.'
            ]}
          />

          {createdSampleId ? (
            <ActionOutcomePanel
              title="Проба зарегистрирована и ждёт протокол"
              detail={`Карточка ${createdSampleId} создана. Теперь открой пробу, внеси показатели и передай результат в приёмку или спор.`}
              status="проба создана"
              primary={{ href: `/lab/${createdSampleId}`, label: 'Открыть пробу' }}
              secondary={[
                { href: dealId ? `/receiving/${dealId}` : '/receiving', label: 'Передать в приёмку' },
                { href: '/disputes', label: 'Открыть спор по качеству', variant: 'tertiary' }
              ]}
            />
          ) : null}

          <div className="section-card space-y-4" style={{ maxWidth: 720 }}>
            <div className="section-title">Данные отбора</div>
            <div className="info-grid-2">
              <div className="field"><label>Номер сделки *</label><input value={dealId} onChange={e => setDealId(e.target.value)} placeholder="DEAL-240312-01" /></div>
              <div className="field"><label>Номер пломбы</label><input value={sealNumber} onChange={e => setSealNumber(e.target.value)} placeholder="847291" /></div>
              <div className="field"><label>Место отбора</label><input value={location} onChange={e => setLocation(e.target.value)} placeholder="Элеватор Рассказово" /></div>
            </div>
            <div className="cta-stack">
              <button onClick={handleCreate} disabled={submitting} className="button primary compact">{submitting ? 'Регистрация...' : 'Зарегистрировать пробу'}</button>
              <Link href={dealId ? `/receiving/${dealId}` : '/receiving'} className="button secondary compact">Открыть приёмку</Link>
            </div>
          </div>

          <ModuleHub title="Что должно быть рядом с пробой" subtitle="Лаборатория должна сразу вести в связанные рабочие контуры." items={[
            { href: dealId ? `/deals/${dealId}` : '/deals', label: 'Сделка', detail: 'Источник обязательств и параметров партии.', icon: '≣', meta: dealId || 'выбрать', tone: 'blue' },
            { href: dealId ? `/receiving/${dealId}` : '/receiving', label: 'Приёмка', detail: 'Весовая, решение по партии и передача после лаборатории.', icon: '◫', meta: 'следующий этап', tone: 'amber' },
            { href: '/documents', label: 'Доказательства', detail: 'Протоколы, акты, фото и цепочка пломб.', icon: '⌁', meta: 'доказательства', tone: 'green' },
            { href: '/disputes', label: 'Спор', detail: 'Если проба подтверждает расхождение, претензия должна открываться отсюда.', icon: '!', meta: 'спор по качеству', tone: 'red' }
          ] as any} />

          <NextStepBar
            title={dealId ? `После регистрации открыть карточку качества по сделке ${dealId}` : 'Сначала привязать пробу к сделке'}
            detail="Функция завершена только когда проба становится частью контура качества и приёмки, а не остаётся изолированной записью."
            primary={{ href: '/lab', label: 'Открыть лабораторию' }}
            secondary={[{ href: dealId ? `/receiving/${dealId}` : '/receiving', label: 'Приёмка' }, { href: '/deals', label: 'Сделки' }]}
          />
        </div>
      </AppShell>
    </PageAccessGuard>
  );
}

export default function NewLabSamplePage() {
  return <Suspense fallback={<div className="muted">Загрузка...</div>}><NewLabSamplePageInner /></Suspense>;
}
