import Link from 'next/link';
import { notFound } from 'next/navigation';
import { SberKorusBadge } from '@/components/v7r/SberKorusBadge';
import { getDealById } from '@/lib/v7r/data';
import {
  getTransportPackByDealId,
  getTransportSimulationScenario,
  legalRouteLabel,
  moneyImpactLabel,
  transportDocumentStatusLabel,
  transportPackStatusLabel,
  transportReleaseStateLabel,
} from '@/lib/v7r/transport-docs';

function tone(status: string) {
  if (['completed', 'registered_in_gis_epd', 'release_allowed', 'allowed'].includes(status)) {
    return { bg: 'rgba(10,122,95,0.08)', border: 'rgba(10,122,95,0.18)', color: '#0A7A5F' };
  }
  if (['provider_error', 'manual_review', 'blocks_release', 'declined', 'cancelled', 'blocked', 'error'].includes(status)) {
    return { bg: 'rgba(220,38,38,0.08)', border: 'rgba(220,38,38,0.18)', color: '#B91C1C' };
  }
  return { bg: 'rgba(217,119,6,0.08)', border: 'rgba(217,119,6,0.18)', color: '#B45309' };
}

function signatureLabel(type: string) {
  if (type === 'ukep') return 'УКЭП';
  if (type === 'unep') return 'УНЭП';
  if (type === 'provider_managed') return 'Подпись провайдера';
  return 'ПЭП';
}

function signatureStatusLabel(status: string) {
  if (status === 'signed') return 'Подписано';
  if (status === 'failed') return 'Ошибка';
  return 'Ожидается';
}

export default function DealTransportDocumentsPage({ params }: { params: { id: string } }) {
  const deal = getDealById(params.id);
  if (!deal) return notFound();

  const pack = getTransportPackByDealId(deal.id);
  const scenario = getTransportSimulationScenario(deal.id);
  if (!pack) {
    return (
      <div style={{ display: 'grid', gap: 16, maxWidth: 980, margin: '0 auto' }}>
        <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18, display: 'grid', gap: 10 }}>
          <SberKorusBadge subtitle='Пакет перевозочных документов не создан' />
          <div style={{ fontSize: 13, color: '#6B778C', lineHeight: 1.7 }}>
            Для сделки {deal.id} пакет перевозочных документов пока не создан. Это значит, что юридически значимый транспортный контур ещё не заведён во внешний провайдер и деньги нельзя считать полностью защищёнными транспортным следом.
          </div>
        </section>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link href={`/platform-v7/deals/${deal.id}`} style={{ textDecoration: 'none', padding: '10px 14px', borderRadius: 12, background: '#0A7A5F', border: '1px solid #0A7A5F', color: '#fff', fontSize: 13, fontWeight: 800 }}>
            Вернуться в сделку
          </Link>
        </div>
      </div>
    );
  }

  const packTone = tone(pack.status);
  const moneyTone = tone(pack.moneyImpactStatus);
  const currentStep = scenario?.steps[scenario.currentStepIndex];

  return (
    <div style={{ display: 'grid', gap: 16, maxWidth: 1120, margin: '0 auto' }}>
      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18, display: 'grid', gap: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div style={{ display: 'grid', gap: 8 }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#0F1419' }}>Перевозочные документы · {deal.id}</div>
            <div style={{ fontSize: 13, color: '#6B778C', lineHeight: 1.7 }}>
              Внешний юридически значимый контур рейса через СберКорус. Здесь платформа показывает не внутренние события, а состояние пакета перевозочных документов, подписей, webhooks и влияние на выпуск денег.
            </div>
          </div>
          <SberKorusBadge subtitle='Юридически значимый транспортный контур' />
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', padding: '6px 10px', borderRadius: 999, background: packTone.bg, border: `1px solid ${packTone.border}`, color: packTone.color, fontSize: 11, fontWeight: 800 }}>
            {transportPackStatusLabel(pack.status)}
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', padding: '6px 10px', borderRadius: 999, background: moneyTone.bg, border: `1px solid ${moneyTone.border}`, color: moneyTone.color, fontSize: 11, fontWeight: 800 }}>
            {moneyImpactLabel(pack.moneyImpactStatus)}
          </span>
        </div>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
        <Metric title='Пакет' value={pack.id} note={`Provider pack: ${pack.providerPackId}`} />
        <Metric title='Провайдер' value='СберКорус' note='Именно этот контур несёт юридически значимое транспортное подписание.' />
        <Metric title='Юрмаршрут' value={legalRouteLabel(pack.legalRouteClass)} note='Класс правового маршрута документа.' />
        <Metric title='1С' value={pack.oneCStatus === 'exported' ? 'Экспортировано' : pack.oneCStatus === 'ready' ? 'Готово' : 'Не связано'} note='Статус обмена с учётным контуром.' />
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: 16 }}>
        <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18, display: 'grid', gap: 12 }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#0F1419' }}>Что важно по пакету</div>
          <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.7 }}>{pack.summary}</div>
          <div style={{ display: 'grid', gap: 8 }}>
            {pack.blockers.length ? pack.blockers.map((blocker) => (
              <div key={blocker} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13, color: '#475569', lineHeight: 1.6 }}>
                <span style={{ fontWeight: 900 }}>•</span>
                <span>{blocker}</span>
              </div>
            )) : <div style={{ fontSize: 13, color: '#0A7A5F', fontWeight: 700 }}>Критичных блокеров по пакету нет.</div>}
          </div>
        </section>

        <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18, display: 'grid', gap: 12 }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#0F1419' }}>Текущий сценарий по деньгам</div>
          {scenario && currentStep ? (
            <>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#0F1419' }}>{scenario.headline}</div>
              <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.7 }}>{scenario.objective}</div>
              <div style={{ border: '1px solid #E4E6EA', borderRadius: 14, padding: 12, background: '#F8FAFB', display: 'grid', gap: 6 }}>
                <div style={{ fontSize: 12, color: '#6B778C' }}>Текущий шаг</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#0F1419' }}>{currentStep.label}</div>
                <div style={{ fontSize: 12, color: '#475569', lineHeight: 1.6 }}>{currentStep.detail}</div>
                <div style={{ fontSize: 12, color: tone(currentStep.releaseState).color, fontWeight: 800 }}>{transportReleaseStateLabel(currentStep.releaseState)} · {currentStep.releaseReason}</div>
              </div>
              <Link href={`/platform-v7/deals/${deal.id}/transport-documents/simulation`} style={{ textDecoration: 'none', padding: '10px 14px', borderRadius: 12, background: '#0A7A5F', border: '1px solid #0A7A5F', color: '#fff', fontSize: 13, fontWeight: 800, justifySelf: 'start' }}>
                Открыть полную симуляцию СберКорус
              </Link>
            </>
          ) : null}
        </section>
      </section>

      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18, display: 'grid', gap: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#0F1419' }}>Документы пакета</div>
          {pack.driverActionUrl ? <span style={{ fontSize: 12, color: '#6B778C' }}>Для водителя доступен отдельный mobile-flow провайдера</span> : null}
        </div>
        <div style={{ display: 'grid', gap: 12 }}>
          {pack.documents.map((document) => {
            const documentTone = tone(document.status);
            return (
              <article key={document.id} style={{ border: '1px solid #E4E6EA', borderRadius: 16, padding: 16, background: '#F8FAFB', display: 'grid', gap: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, fontWeight: 800, color: '#0A7A5F' }}>{document.providerDocumentId}</div>
                    <div style={{ marginTop: 6, fontSize: 18, fontWeight: 800, color: '#0F1419' }}>{document.title}</div>
                  </div>
                  <div style={{ display: 'grid', gap: 6 }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '6px 10px', borderRadius: 999, background: documentTone.bg, border: `1px solid ${documentTone.border}`, color: documentTone.color, fontSize: 11, fontWeight: 800 }}>
                      {transportDocumentStatusLabel(document.status)}
                    </span>
                    <span style={{ fontSize: 12, color: '#6B778C' }}>ГИС ЭПД: {document.gisStatus === 'registered' ? 'зарегистрирован' : document.gisStatus === 'pending' ? 'ожидается' : document.gisStatus === 'error' ? 'ошибка' : 'не требуется'}</span>
                  </div>
                </div>
                <div style={{ display: 'grid', gap: 8 }}>
                  {document.signatures.map((signature) => (
                    <div key={signature.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 120px 180px', gap: 12, border: '1px solid #E4E6EA', borderRadius: 12, padding: 12, background: '#fff' }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#0F1419' }}>{signature.actor}</div>
                        <div style={{ marginTop: 4, fontSize: 12, color: '#6B778C' }}>{signature.role}</div>
                      </div>
                      <div style={{ fontSize: 12, color: '#475569', fontWeight: 700 }}>{signatureLabel(signature.signatureType)}</div>
                      <div style={{ fontSize: 12, color: signature.status === 'signed' ? '#0A7A5F' : signature.status === 'failed' ? '#B91C1C' : '#B45309', fontWeight: 800 }}>
                        {signatureStatusLabel(signature.status)}{signature.signedAt ? ` · ${new Date(signature.signedAt).toLocaleString('ru-RU')}` : ''}
                      </div>
                    </div>
                  ))}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Link href={`/platform-v7/deals/${deal.id}`} style={{ textDecoration: 'none', padding: '10px 14px', borderRadius: 12, background: '#0A7A5F', border: '1px solid #0A7A5F', color: '#fff', fontSize: 13, fontWeight: 800 }}>
          Вернуться в сделку
        </Link>
        <Link href='/platform-v7/control-tower/hotlist' style={{ textDecoration: 'none', padding: '10px 14px', borderRadius: 12, border: '1px solid #E4E6EA', background: '#fff', color: '#0F1419', fontSize: 13, fontWeight: 700 }}>
          Горячий список Control Tower
        </Link>
      </div>
    </div>
  );
}

function Metric({ title, value, note }: { title: string; value: string; note: string }) {
  return (
    <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18 }}>
      <div style={{ fontSize: 11, color: '#6B778C', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 800 }}>{title}</div>
      <div style={{ marginTop: 8, fontSize: 24, fontWeight: 800, color: '#0F1419' }}>{value}</div>
      <div style={{ marginTop: 8, fontSize: 12, color: '#6B778C', lineHeight: 1.6 }}>{note}</div>
    </section>
  );
}
