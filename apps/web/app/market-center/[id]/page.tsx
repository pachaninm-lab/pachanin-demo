import Link from 'next/link';
import { PageFrame } from '../../../components/page-frame';
import { Breadcrumbs } from '../../../components/breadcrumbs';
import { DetailHero } from '../../../components/detail-hero';
import { ModuleHub } from '../../../components/module-hub';
import { NextStepBar } from '../../../components/next-step-bar';
import { SourceNote } from '../../../components/source-note';
import { PageAccessGuard } from '../../../components/page-access-guard';
import { TRADING_ROLES, EXECUTIVE_ROLES, INTERNAL_ONLY_ROLES } from '../../../lib/route-roles';
import { readCommercialWorkspace } from '../../../lib/commercial-workspace-store';

export default async function MarketCenterDetailPage({ params }: { params: { id: string } }) {
  const state = await readCommercialWorkspace();
  const row = state.marketRows.find((item) => item.id === params.id) || null;

  if (!row) {
    return (
      <PageFrame title="Оффер рынка не найден" subtitle="Строка market desk не найдена или была удалена.">
        <div className="section-card">
          <div className="section-title">Нет данных</div>
          <div className="muted" style={{ marginTop: 8 }}>Вернись в ценовой центр и открой актуальный оффер.</div>
          <div className="cta-stack" style={{ marginTop: 16 }}>
            <Link href="/market-center" className="primary-link">Назад в ценовой центр</Link>
            <Link href="/lots" className="secondary-link">Витрина лотов</Link>
          </div>
        </div>
      </PageFrame>
    );
  }

  const deduction = row.logisticsRubPerTon + row.queueRiskRubPerTon - row.qualityAdjustmentRubPerTon;

  return (
    <PageAccessGuard allowedRoles={[...TRADING_ROLES, ...EXECUTIVE_ROLES, ...INTERNAL_ONLY_ROLES]} title="Оффер рынка ограничен" subtitle="Карточка buyer offer открывается только рабочим ролям.">
      <PageFrame title={row.buyerName} subtitle="Карточка buyer offer: gross price, логистика, очередь, качество, деньги и доверие в одном решении." breadcrumbs={<Breadcrumbs items={[{ href: '/', label: 'Главная' }, { href: '/market-center', label: 'Ценовой центр' }, { label: row.buyerName }]} />}>
        <SourceNote source="commercial workspace / persisted state" warning="Карточка buyer offer живёт в рабочем market desk и используется для реального сравнения gross price, netback, скорости денег и trust." compact />

        <DetailHero
          kicker="Buyer offer"
          title={`${row.culture} · ${row.grade}`}
          description={`${row.region} · ${row.basis}. В карточке уже собраны gross price, логистика, risk по очереди и скорость денег.`}
          chips={[`gross ${row.grossPrice.toLocaleString('ru-RU')} ₽/т`, `netback ${row.netbackRubPerTon.toLocaleString('ru-RU')} ₽/т`, `${row.distanceKm} км`, `ETA ${row.etaHours}ч`, `trust ${row.trust}`]}
          nextStep={row.linkedLotId ? 'Открыть лот и принять ставку/решение по buyer.' : 'Открыть калькулятор и пересчитать оффер под свою географию.'}
          owner="Фермер / buyer desk"
          blockers={row.watchouts.join(' · ')}
          actions={[
            row.linkedLotId ? { href: `/lots/${row.linkedLotId}`, label: 'Открыть связанный лот' } : { href: '/lots', label: 'Перейти в лоты' },
            row.linkedDealId ? { href: `/deals/${row.linkedDealId}`, label: 'Открыть сделку', variant: 'secondary' } : { href: '/calculator', label: 'Пересчитать в калькуляторе', variant: 'secondary' },
            { href: `/companies/${row.buyerId}`, label: 'Проверить компанию', variant: 'secondary' }
          ]}
        />

        <div className="mobile-two-grid">
          <div className="section-card-tight">
            <div className="section-title">Разложение цены</div>
            <div className="section-stack" style={{ marginTop: 12 }}>
              <div className="list-row"><span>Gross price</span><b>{row.grossPrice.toLocaleString('ru-RU')} ₽/т</b></div>
              <div className="list-row"><span>Логистика</span><b>-{row.logisticsRubPerTon.toLocaleString('ru-RU')} ₽/т</b></div>
              <div className="list-row"><span>Риск очереди / простой</span><b>-{row.queueRiskRubPerTon.toLocaleString('ru-RU')} ₽/т</b></div>
              <div className="list-row"><span>Quality adjustment</span><b>{row.qualityAdjustmentRubPerTon.toLocaleString('ru-RU')} ₽/т</b></div>
              <div className="list-row"><span>Итоговый netback</span><b>{row.netbackRubPerTon.toLocaleString('ru-RU')} ₽/т</b></div>
            </div>
            <div className="muted tiny" style={{ marginTop: 10 }}>Общая нагрузка на gross price: {deduction.toLocaleString('ru-RU')} ₽/т.</div>
          </div>
          <div className="section-card-tight">
            <div className="section-title">Исполнение и деньги</div>
            <div className="section-stack" style={{ marginTop: 12 }}>
              <div className="list-row"><span>Схема оплаты</span><b>{row.paymentMode}</b></div>
              <div className="list-row"><span>Скорость денег</span><b>{row.paymentSpeed}</b></div>
              <div className="list-row"><span>Финансы внутри сделки</span><b>{row.financeAvailable}</b></div>
              <div className="list-row"><span>Окно поставки</span><b>{row.deliveryWindow}</b></div>
              <div className="list-row"><span>Км / ETA</span><b>{row.distanceKm} км · {row.etaHours}ч</b></div>
            </div>
          </div>
        </div>

        <div className="mobile-two-grid">
          <div className="section-card-tight">
            <div className="section-title">За что этот buyer силён</div>
            <div className="section-stack" style={{ marginTop: 12 }}>
              {row.strengths.map((item) => <div key={item} className="mini-chip">{item}</div>)}
            </div>
          </div>
          <div className="section-card-tight">
            <div className="section-title">Что может убить экономику</div>
            <div className="section-stack" style={{ marginTop: 12 }}>
              {row.watchouts.map((item) => <div key={item} className="mini-chip">{item}</div>)}
            </div>
          </div>
        </div>

        <ModuleHub
          title="Следующие логичные действия"
          subtitle="Карточка buyer offer должна вести дальше в компанию, лот, сделку, финансы и калькулятор, а не быть тупиком."
          items={[
            { href: `/companies/${row.buyerId}`, label: 'Карточка компании', detail: 'Trust, KYB, история оплаты и риски обхода.', icon: '⌘', meta: `trust ${row.trust}`, tone: 'green' },
            row.linkedLotId ? { href: `/lots/${row.linkedLotId}`, label: 'Связанный лот', detail: 'Принять решение по buyer внутри торгового контура.', icon: '◌', meta: row.linkedLotId, tone: 'blue' } : { href: '/lots', label: 'Лоты', detail: 'Открыть торговый контур и связать оффер с партией.', icon: '◌', meta: 'open', tone: 'blue' },
            row.linkedDealId ? { href: `/deals/${row.linkedDealId}`, label: 'Связанная сделка', detail: 'Проверить blockers, queue и payment waterfall.', icon: '≣', meta: row.linkedDealId, tone: 'amber' } : { href: '/deals', label: 'Сделки', detail: 'После выбора buyer открыть сделочный контур.', icon: '≣', meta: 'next', tone: 'amber' },
            { href: '/finance', label: 'Финансы', detail: 'Посмотреть аванс, deferral или factoring под этот оффер.', icon: '₽', meta: 'money', tone: 'green' },
            { href: '/calculator', label: 'Калькулятор', detail: 'Смоделировать свой маршрут и своё качество.', icon: '⊡', meta: 'recalc', tone: 'gray' }
          ]}
        />

        <NextStepBar
          title={row.linkedLotId ? 'Вернуться в лот и принять решение по buyer' : 'Перейти из оффера в торговый контур'}
          detail={`Логика решения уже собрана: ${row.buyerName}, netback ${row.netbackRubPerTon.toLocaleString('ru-RU')} ₽/т, trust ${row.trust}.`}
          primary={{ href: row.linkedLotId ? `/lots/${row.linkedLotId}` : '/lots', label: row.linkedLotId ? 'Открыть лот' : 'Открыть лоты' }}
          secondary={[{ href: `/companies/${row.buyerId}`, label: 'Компания' }, { href: '/finance', label: 'Финансы' }]}
        />
      </PageFrame>
    </PageAccessGuard>
  );
}
