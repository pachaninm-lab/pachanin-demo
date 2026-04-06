'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api, ApiError } from '../../../lib/api-client';
import { PageFrame } from '../../../components/page-frame';
import { Breadcrumbs } from '../../../components/breadcrumbs';
import { SourceNote } from '../../../components/source-note';
import { DetailHero } from '../../../components/detail-hero';
import { CriticalBlockersPanel } from '../../../components/critical-blockers-panel';
import { ModuleHub } from '../../../components/module-hub';
import { NextStepBar } from '../../../components/next-step-bar';
import { ObjectCopilotCard } from '../../../components/object-copilot-card';
import { ClosureEnginePanel } from '../../../components/closure-engine-panel';
import { buildDocumentClosureState } from '../../../lib/closure-readiness-engine';
import { CardSkeleton } from '../../../components/skeleton';
import { PageAccessGuard } from '../../../components/page-access-guard';
import { TRANSACTIONAL_ROLES } from '../../../lib/route-roles';
import { legalFinalityLabel, normalizeBlockers, providerModeLabel, truthStateLabel } from '../../../lib/operational-vocabulary';
import { useToast } from '../../../components/toast';

const TYPE_LABEL: Record<string, string> = {
  CONTRACT: 'Договор',
  TTN: 'ТТН',
  WEIGH_TICKET: 'Весовой билет',
  LAB_PROTOCOL: 'Лабораторный протокол',
  QUALITY_PASSPORT: 'Паспорт качества',
  PAYMENT_PROOF: 'Платёжный документ',
  OTHER: 'Прочее'
};

function DocumentDetailPage({ params }: { params: { id: string } }) {
  const { show } = useToast();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const payload = await api.get(`/documents/${params.id}/preview`);
      setData(payload);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Не удалось открыть карточку документа');
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [params.id]);

  async function signDocument() {
    try {
      setBusy('sign');
      const payload: any = await api.post(`/documents/${params.id}/sign`);
      setData(payload);
      show('success', payload?.providerMode === 'LIVE' ? 'Документ подписан в live-контуре' : 'Документ подписан в sandbox-контуре');
    } catch (e) {
      show('error', e instanceof ApiError ? e.message : 'Подписание не выполнено');
    } finally {
      setBusy('');
    }
  }

  const blockers = useMemo(() => {
    if (!data) return [] as string[];
    return [
      ...(Array.isArray(data.blockers) ? normalizeBlockers(data.blockers) : []),
      Array.isArray(data.packageState?.missing) && data.packageState.missing.length > 0 ? `Не хватает документов: ${data.packageState.missing.join(', ')}` : null,
      data.signStatus === 'SIGNED' ? null : 'без подписи документ не закрывает обязательство по сделке'
    ].filter(Boolean) as string[];
  }, [data]);

  const closureEngine = useMemo(() => (data ? buildDocumentClosureState(data) : null), [data]);

  const relatedModules = useMemo(() => {
    if (!data) return [];
    return [
      data.dealId ? { href: `/deals/${data.dealId}`, label: 'Сделка', detail: 'Проверить, какой этап исполнения и кто владелец следующего действия.', icon: '≣', meta: data.dealId, tone: 'blue' } : null,
      data.dealId ? { href: `/payments?dealId=${data.dealId}`, label: 'Платежи', detail: 'Финконтур должен видеть полный документарный пакет.', icon: '₽', meta: data.signStatus === 'SIGNED' ? 'можно release' : 'hold', tone: data.signStatus === 'SIGNED' ? 'green' : 'amber' } : null,
      data.type === 'LAB_PROTOCOL' ? { href: '/lab', label: 'Лаборатория', detail: 'Протокол должен менять quality impact и settlement.', icon: '∴', meta: 'качество', tone: 'amber' } : null,
      data.dealId ? { href: `/receiving/${data.dealId}`, label: 'Приёмка', detail: 'Акты и весовые билеты должны закрывать решение по партии.', icon: '◫', meta: 'handoff', tone: 'blue' } : null,
      data.dealId ? { href: '/disputes', label: 'Споры', detail: 'Если документ спорный или неполный, нужен претензионный контур.', icon: '!', meta: blockers.length ? `${blockers.length} блокера` : 'чисто', tone: blockers.length ? 'red' : 'gray' } : null,
      { href: '/documents', label: 'Реестр документов', detail: 'Вернуться в список и сравнить соседние документы пакета.', icon: '⌁', meta: TYPE_LABEL[data.type] || data.type, tone: 'gray' }
    ].filter(Boolean);
  }, [data, blockers.length]);

  if (loading) {
    return (
      <PageFrame title={`Документ ${params.id}`} subtitle="Карточка документа должна объяснять происхождение, статус подписания и следующий обязательный переход.">
        <div className="space-y-3"><CardSkeleton /><CardSkeleton /><CardSkeleton /></div>
      </PageFrame>
    );
  }

  return (
    <PageFrame
      title={`Документ ${params.id}`}
      subtitle="Карточка документа должна объяснять происхождение, статус подписания и следующий обязательный переход."
      breadcrumbs={<Breadcrumbs items={[{ href: '/', label: 'Главная' }, { href: '/documents', label: 'Документы' }, { label: params.id }]} />}
      actions={data ? <div className="cta-stack">{data.signStatus !== 'SIGNED' ? <button onClick={signDocument} className="button primary compact" disabled={busy === 'sign'}>{busy === 'sign' ? 'Подписываем...' : 'Подписать'}</button> : null}<a href={`/api/proxy/documents/${params.id}/content`} target="_blank" rel="noreferrer" className="button secondary compact">Открыть файл</a></div> : null}
    >
      {error || !data ? (
        <div className="alert alert-error">{error || 'Документ не найден'}</div>
      ) : (
        <div className="space-y-6 mobile-page-bottom-space">
          <SourceNote source={data.source || 'documents.preview'} warning={data.providerMode === 'LIVE' ? 'Документ идёт через live-провайдера и может использоваться как юридически значимый артефакт.' : 'Карточка и preview уже живут в backend, но провайдер может работать в sandbox-only режиме.'} compact />

          <DetailHero
            kicker="Document workspace"
            title={data.originalName || params.id}
            description="Документ должен не просто открываться, а объяснять: зачем он нужен, что сейчас блокирует и куда идти дальше после подписи."
            chips={[
              TYPE_LABEL[data.type] || data.type,
              `ЭДО ${data.edoStatus || '—'}`,
              `КЭП ${data.signStatus || '—'}`,
              legalFinalityLabel(data.legalFinality || data.truthState)
            ]}
            nextStep={data.signStatus === 'SIGNED' ? 'Открыть связанную сделку и продолжить исполнение или release денег.' : 'Подписать документ или дособрать пакет, чтобы не стопорить сделку.'}
            owner={data.signStatus === 'SIGNED' ? 'Владелец следующего этапа сделки' : 'Сторона, обязанная подписать документ'}
            blockers={blockers.join(' · ') || 'критичных блокеров не видно'}
            actions={[
              { href: '/documents', label: 'Назад в реестр' },
              data.dealId ? { href: `/deals/${data.dealId}`, label: 'Связанная сделка', variant: 'secondary' } : { href: '/payments', label: 'Финансы', variant: 'secondary' }
            ]}
          />

          <CriticalBlockersPanel items={blockers} emptyLabel="Документ не содержит критичных блокеров и может двигать контур сделки дальше." />

          <ObjectCopilotCard
            title="Document copilot"
            detail="Помощник должен объяснять, чего не хватает в документном пакете, что именно блокирует выплату и куда идти после подписи."
            prompts={[
              `Что не хватает по документу ${params.id}?`,
              `Блокирует ли документ ${params.id} release денег?`,
              `Какой следующий шаг после подписи документа ${params.id}?`,
            ]}
          />

          {closureEngine ? <ClosureEnginePanel {...closureEngine} /> : null}

          <section className="stat-strip">
            <div className="stat-tile"><div className="label">Источник</div><div className="value" style={{ fontSize: 20 }}>{data.sourceLabel || data.source || '—'}</div></div>
            <div className="stat-tile"><div className="label">Provider mode</div><div className="value" style={{ fontSize: 20 }}>{providerModeLabel(data.providerMode)}</div></div>
            <div className="stat-tile"><div className="label">Truth state</div><div className="value" style={{ fontSize: 20 }}>{truthStateLabel(data.truthState)}</div></div>
            <div className="stat-tile"><div className="label">Сделка</div><div className="value" style={{ fontSize: 20 }}>{data.dealId || '—'}</div></div>
          </section>

          <div className="workspace-grid">
            <div className="section-card space-y-4">
              <div className="section-title">Суть документа</div>
              <div className="info-grid-2">
                <div className="info-card"><div className="label">Тип</div><div className="value">{TYPE_LABEL[data.type] || data.type}</div></div>
                <div className="info-card"><div className="label">Создан</div><div className="value">{data.createdAt ? String(data.createdAt).slice(0, 16).replace('T', ' ') : '—'}</div></div>
                <div className="info-card"><div className="label">Версия</div><div className="value">{data.version || '—'}</div></div>
                <div className="info-card"><div className="label">Связанная сделка</div><div className="value">{data.dealId || '—'}</div></div>
              </div>

              <div className="section-title">Что уже произошло</div>
              <div className="section-stack">
                {(Array.isArray(data.auditTrail) && data.auditTrail.length > 0 ? data.auditTrail : [{ action: 'NO_AUDIT', createdAt: data.updatedAt || data.createdAt }]).map((item: any, index: number) => (
                  <div key={`${item.action || 'audit'}-${index}`} className="list-row">
                    <div>
                      <div style={{ fontWeight: 700 }}>{item.action || 'Событие не определено'}</div>
                      <div className="muted small">{item.actorRole || item.actor || 'system'}</div>
                    </div>
                    <div className="muted small">{item.createdAt ? String(item.createdAt).slice(0, 16).replace('T', ' ') : '—'}</div>
                  </div>
                ))}
              </div>
            </div>

            <aside className="aside-stack">
              <div className="section-card">
                <div className="section-title">Открыть и использовать</div>
                <div className="cta-stack" style={{ marginTop: 12 }}>
                  <a href={`/api/proxy/documents/${params.id}/content`} target="_blank" rel="noreferrer" className="primary-link">Открыть файл</a>
                  <a href={`/api/proxy/documents/${params.id}/content`} download={data.originalName || params.id} className="secondary-link">Скачать</a>
                </div>
                <div className="muted small" style={{ marginTop: 12 }}>После открытия файл не должен жить отдельно от процесса: из него обязан быть прямой вход назад в сделку, приёмку и деньги.</div>
              </div>
              <div className="section-card">
                <div className="section-title">Что блокирует следующий шаг</div>
                <div className="muted small" style={{ marginTop: 10 }}>{blockers.join(' · ') || 'Документ готов двигать контур дальше.'}</div>
              </div>
            </aside>
          </div>

          <ModuleHub title="Куда документ должен вести дальше" subtitle="Карточка документа не должна быть тупиком: из неё должен быть прямой вход в сделку, деньги, качество и приёмку." items={relatedModules as any} />

          <NextStepBar
            title={data.signStatus === 'SIGNED' ? 'Документ подписан: продолжить основной контур сделки' : 'Подписать документ и закрыть документарный блокер'}
            detail={data.dealId ? `Сделка ${data.dealId}` : 'Документ пока без привязки к сделке'}
            primary={data.dealId ? { href: `/deals/${data.dealId}`, label: 'Открыть сделку' } : { href: '/documents', label: 'Вернуться в реестр' }}
            secondary={[{ href: '/payments', label: 'Финансы' }, { href: '/disputes', label: 'Споры' }]}
          />
        </div>
      )}
    </PageFrame>
  );
}

export default function DocumentDetailPageGuarded(props: any) {
  return (
    <PageAccessGuard allowedRoles={[...TRANSACTIONAL_ROLES]} title="Карточка документа ограничена" subtitle="Документарный контур доступен только участникам сделки, бухгалтерии и оператору.">
      <DocumentDetailPage {...props} />
    </PageAccessGuard>
  );
}
