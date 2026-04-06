'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { api, ApiError } from '../../../lib/api-client';
import { Breadcrumbs } from '../../../components/breadcrumbs';
import { SourceNote } from '../../../components/source-note';
import { PageAccessGuard } from '../../../components/page-access-guard';
import { PageFrame } from '../../../components/page-frame';
import { DetailHero } from '../../../components/detail-hero';
import { CriticalBlockersPanel } from '../../../components/critical-blockers-panel';
import { NextStepBar } from '../../../components/next-step-bar';
import { OperationalStatePanel } from '../../../components/operational-state-panel';
import { TRADING_ROLES } from '../../../lib/route-roles';
import { companyProfiles } from '../../../lib/commercial-expansion-data';

function PurchaseRequestDetailPage({ params }: { params: { id: string } }) {
  const [request, setRequest] = useState<any>(null);
  const [offers, setOffers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [offerPrice, setOfferPrice] = useState('');
  const [offerVolume, setOfferVolume] = useState('');
  const [offerNote, setOfferNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState('');

  async function load() {
    const [req, offs] = await Promise.all([
      api.get(`/purchase-requests/${params.id}`),
      api.get(`/purchase-requests/${params.id}/offers`)
    ]);
    setRequest(req);
    setOffers(Array.isArray(offs) ? offs : []);
  }

  useEffect(() => {
    load().catch((e) => setMsg(e instanceof ApiError ? e.message : 'Не удалось загрузить RFQ')).finally(() => setLoading(false));
  }, [params.id]);

  async function handleOffer() {
    const p = parseFloat(offerPrice);
    const v = parseFloat(offerVolume);
    if (!p || p <= 0) return setMsg('Укажи цену');
    if (!v || v <= 0) return setMsg('Укажи объём');
    setSubmitting(true);
    setMsg('');
    try {
      await api.post(`/purchase-requests/${params.id}/offers`, { pricePerTon: p, volumeTons: v, note: offerNote });
      setOfferPrice('');
      setOfferVolume('');
      setOfferNote('');
      await load();
      setMsg('✓ Предложение отправлено');
    } catch (e) {
      setMsg(e instanceof ApiError ? e.message : 'Ошибка отправки');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAcceptOffer(offerId: string) {
    try {
      const result: any = await api.post(`/purchase-requests/${params.id}/offers/${offerId}/accept`);
      await load();
      setMsg(`✓ Предложение принято. Сделка ${result?.dealId || 'создана'}`);
    } catch (e) {
      setMsg(e instanceof ApiError ? e.message : 'Ошибка принятия предложения');
    }
  }

  async function handleStatus(action: 'close' | 'cancel') {
    try {
      await api.post(`/purchase-requests/${params.id}/${action}`, { reason: action === 'cancel' ? 'Окно поставки снято' : 'Победитель выбран' });
      await load();
      setMsg(action === 'close' ? '✓ RFQ закрыт' : '✓ RFQ отменён');
    } catch (e) {
      setMsg(e instanceof ApiError ? e.message : 'Не удалось обновить статус');
    }
  }

  const blockers = useMemo(() => [
    request?.status === 'open' && offers.length === 0 ? 'по RFQ ещё нет офферов' : null,
    request?.status === 'open' && !request?.bestOffer ? 'не выбран лучший оффер' : null,
    request?.status === 'open' && !request?.deliveryDate ? 'не зафиксировано окно поставки' : null,
    msg && !msg.startsWith('✓') ? msg : null
  ].filter(Boolean) as string[], [request, offers.length, msg]);

  const procurementStages = useMemo(() => {
    const winner = request?.bestOffer || offers.find((item) => String(item.status).toLowerCase().includes('accepted')) || null;
    const linkedDeal = request?.linked?.dealsHref || request?.dealId;
    return [
      { title: 'Потребность и окно', status: request ? 'DONE' : 'PENDING', detail: `${request?.product || '—'} · ${request?.volumeTons || '—'} т · ${request?.deliveryDate || 'нужно окно поставки'}` },
      { title: 'Сбор офферов', status: offers.length ? 'DONE' : request?.status === 'open' ? 'ACTIVE' : 'PENDING', detail: offers.length ? `офферов ${offers.length}` : 'нужно получить предложения продавцов и сервисных партнёров' },
      { title: 'Выбор победителя', status: winner ? 'DONE' : request?.status === 'open' ? 'ACTIVE' : 'PENDING', detail: winner ? `${winner.sellerName || 'Победитель'} · ${Number(winner.pricePerTon || 0).toLocaleString('ru-RU')} ₽/т` : 'нет выбранного победителя' },
      { title: 'Поставка / исполнение', status: linkedDeal ? 'ACTIVE' : 'PENDING', detail: linkedDeal ? 'создана связанная сделка, нужно вести dispatch / receiving / docs' : 'нужно перевести победителя в сделку' },
      { title: 'Документы и претензии', status: request?.status === 'closed' ? 'DONE' : linkedDeal ? 'ACTIVE' : 'PENDING', detail: linkedDeal ? 'контролировать документы качества, поставку и претензии' : 'контур претензии ещё не открыт' },
      { title: 'Закрытие RFQ', status: request?.status === 'closed' ? 'DONE' : request?.status === 'cancelled' ? 'BLOCKED' : 'PENDING', detail: request?.status === 'closed' ? 'RFQ закрыт с outcome' : request?.status === 'cancelled' ? 'RFQ отменён, нужен reason log' : 'после создания сделки или осознанной отмены' },
    ];
  }, [request, offers]);

  const supplierShortlist = useMemo(() => {
    const query = String(request?.product || '').toLowerCase();
    return companyProfiles.filter((company) => {
      const hay = `${company.focus.join(' ')} ${company.segment} ${company.value}`.toLowerCase();
      return (!query || hay.includes(query.split(' ')[0])) || hay.includes('логист') || hay.includes('услуг');
    }).slice(0, 4);
  }, [request]);

  return (
    <PageFrame title={`RFQ · ${params.id}`} subtitle="Карточка запроса должна завершаться либо выбранным победителем и deal creation, либо осознанным закрытием / отменой." breadcrumbs={<Breadcrumbs items={[{ href: '/', label: 'Главная' }, { href: '/purchase-requests', label: 'Запросы покупателей' }, { label: params.id }]} />}>
      {!request && !loading ? (
        <OperationalStatePanel
          source="sandbox-runtime"
          title="RFQ не найден"
          detail={msg || 'Backend не подтвердил карточку RFQ. Вернись в общий реестр запросов.'}
          primary={{ href: '/purchase-requests', label: 'Вернуться в RFQ-реестр' }}
          secondary={[{ href: '/lots', label: 'Открыть витрину лотов' }]}
        />
      ) : loading ? (
        <div className="empty-state">Загрузка RFQ…</div>
      ) : (
        <div className="space-y-6 mobile-page-bottom-space">
          <SourceNote source={request.meta?.source || request.source} updatedAt={request.meta?.updatedAt} warning="RFQ должен быть не тупиком, а полноценным procurement-cycle: офферы → победитель → исполнение → документы → претензия → закрытие." compact />

          <DetailHero
            kicker="RFQ workspace"
            title={`${request.product} · ${request.volumeTons} т`}
            description={`${request.buyerName || 'Покупатель'} · ${request.region} · целевая цена ${Number(request.priceTarget || 0).toLocaleString('ru-RU')} ₽/т`}
            chips={[
              <span key="status">{request.status}</span>,
              <span key="offers">Офферы {offers.length}</span>,
              <span key="best">Лучший {request.bestOffer ? `${Number(request.bestOffer.pricePerTon).toLocaleString('ru-RU')} ₽/т` : '—'}</span>
            ]}
            nextStep={request.nextAction || (request.status === 'open' ? 'Разобрать офферы и выбрать победителя' : 'Проверить сделку или причину закрытия')}
            owner="buyer / trading owner"
            blockers={blockers.join(' · ') || 'критических блокеров нет'}
            actions={[
              { href: '/purchase-requests', label: 'Вернуться в RFQ-реестр' },
              { href: '/deals', label: 'Сделки', variant: 'secondary' },
              { href: '/companies', label: 'Каталог компаний', variant: 'tertiary' }
            ]}
            status={request.status}
            deadline={request.deliveryDate || '—'}
          />

          <CriticalBlockersPanel items={blockers} emptyLabel="Критических блокеров по RFQ не видно." />

          <div className="toolbar-row">
            {request.status === 'open' ? <button onClick={() => handleStatus('close')} className="button secondary compact">Закрыть RFQ</button> : null}
            {request.status === 'open' ? <button onClick={() => handleStatus('cancel')} className="button secondary compact">Отменить RFQ</button> : null}
          </div>

          <section className="section-card">
            <div className="panel-title-row"><div><div className="dashboard-section-title">Полный procurement-cycle</div><div className="dashboard-section-subtitle">Запрос должен жить как управляемый цикл снабжения и исполнения, а не просто как список предложений.</div></div></div>
            <div className="section-stack" style={{ marginTop: 16 }}>
              {procurementStages.map((stage) => (
                <div key={stage.title} className="list-row">
                  <div>
                    <b>{stage.title}</b>
                    <div className="muted small">{stage.detail}</div>
                  </div>
                  <span className={`mini-chip`}>{stage.status}</span>
                </div>
              ))}
            </div>
          </section>

          <div className="info-grid-2">
            <div className="section-card">
              <div className="section-title">Контур запроса</div>
              <div className="info-grid-2" style={{ marginTop: 12 }}>
                <div className="info-card"><div className="label">Объём</div><div className="value">{request.volumeTons} т</div></div>
                <div className="info-card"><div className="label">Целевая цена</div><div className="value">{Number(request.priceTarget || 0).toLocaleString('ru-RU')} ₽/т</div></div>
                <div className="info-card"><div className="label">Срок поставки</div><div className="value">{request.deliveryDate || '—'}</div></div>
                <div className="info-card"><div className="label">Лучший оффер</div><div className="value">{request.bestOffer ? `${Number(request.bestOffer.pricePerTon).toLocaleString('ru-RU')} ₽/т` : '—'}</div></div>
              </div>
              {request.description ? <div className="muted small" style={{ marginTop: 12 }}>{request.description}</div> : null}
            </div>

            <div className="section-card space-y-3">
              <div className="section-title">Отправить оффер</div>
              <div className="info-grid-2">
                <div className="field"><label>Цена (₽/т)</label><input type="number" value={offerPrice} onChange={(e) => setOfferPrice(e.target.value)} placeholder="18600" /></div>
                <div className="field"><label>Объём (т)</label><input type="number" value={offerVolume} onChange={(e) => setOfferVolume(e.target.value)} placeholder={String(request.volumeTons)} /></div>
              </div>
              <div className="field"><label>Комментарий</label><textarea value={offerNote} onChange={(e) => setOfferNote(e.target.value)} rows={3} placeholder="Окно отгрузки, склад, ETA" /></div>
              {msg ? <div className={`alert ${msg.startsWith('✓') ? 'alert-success' : 'alert-error'}`}>{msg}</div> : null}
              <button onClick={handleOffer} disabled={submitting || request.status !== 'open'} className="button primary">{submitting ? 'Отправка...' : 'Отправить предложение'}</button>
            </div>
          </div>

          <section className="section-card">
            <div className="panel-title-row"><div><div className="dashboard-section-title">Supplier shortlist и follow-up контуры</div><div className="dashboard-section-subtitle">Не ждать, пока RFQ умрёт. Быстро открыть каталог компаний, логистику, качество и финансы рядом с запросом.</div></div></div>
            <div className="section-stack" style={{ marginTop: 16 }}>
              {supplierShortlist.map((company) => (
                <Link key={company.id} href={`/companies/${company.id}`} className="list-row linkable">
                  <div>
                    <b>{company.name}</b>
                    <div className="muted small">{company.segment} · {company.paymentDiscipline} · {company.financeReadiness}</div>
                  </div>
                  <span className="mini-chip">Открыть</span>
                </Link>
              ))}
            </div>
          </section>

          <div className="section-card">
            <div className="panel-title-row">
              <div className="section-title">Предложения ({offers.length})</div>
              {request.linked?.dealsHref ? <Link href={request.linked.dealsHref} className="secondary-link">Перейти к сделкам</Link> : null}
            </div>
            <div className="section-stack" style={{ marginTop: 12 }}>
              {offers.map((o) => (
                <div key={o.id} className="mobile-list-card">
                  <div className="panel-title-row">
                    <div>
                      <div className="font-semibold">{o.sellerName || 'Продавец'} {o.recommended ? <span className="mini-chip" style={{ marginLeft: 8 }}>лучшая цена</span> : null}</div>
                      <div className="muted small" style={{ marginTop: 6 }}>{Number(o.pricePerTon || 0).toLocaleString('ru-RU')} ₽/т × {o.volumeTons} т = {(Number(o.pricePerTon || 0) * Number(o.volumeTons || 0)).toLocaleString('ru-RU')} ₽</div>
                      <div className="muted tiny" style={{ marginTop: 6 }}>ETA {o.etaDays || '—'} дн. · {o.note || 'без комментария'}</div>
                    </div>
                    <div className="action-list">
                      <span className="mini-chip">{o.status || 'submitted'}</span>
                      {request.status === 'open' ? <button onClick={() => handleAcceptOffer(o.id)} className="button primary compact">Принять</button> : null}
                    </div>
                  </div>
                </div>
              ))}
              {!offers.length ? <div className="empty-state">По этому RFQ пока нет предложений.</div> : null}
            </div>
          </div>

          <NextStepBar
            title={request.status === 'open' ? 'Выбрать лучший оффер и перевести RFQ в сделку' : 'Проверить финальный outcome RFQ'}
            detail="После выбора победителя контур должен продолжиться в deal / dispatch / receiving / docs / claims, а не остановиться на статусе accepted."
            primary={request.linked?.dealsHref ? { href: request.linked.dealsHref, label: 'Открыть сделки' } : { href: '/deals', label: 'Сделки' }}
            secondary={[{ href: '/companies', label: 'Компании' }, { href: '/purchase-requests', label: 'Все RFQ' }]}
          />
        </div>
      )}
    </PageFrame>
  );
}

export default function PurchaseRequestDetailPageGuarded(props: any) {
  return (
    <PageAccessGuard allowedRoles={[...TRADING_ROLES]} title="Карточка RFQ ограничена" subtitle="Карточка RFQ скрыта от нерелевантных ролей: здесь принимают коммерческие решения.">
      <PurchaseRequestDetailPage {...props} />
    </PageAccessGuard>
  );
}
