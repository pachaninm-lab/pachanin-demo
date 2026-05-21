'use client';

import Link from 'next/link';
import { usePlatformV7RStore, type PlatformRole } from '@/stores/usePlatformV7RStore';
import {
  PLATFORM_V7_EXECUTION_SOURCE,
  executionBlockers,
  executionReadinessScore,
  expectedDealAmountRub,
  formatRub,
  formatTons,
} from '@/lib/platform-v7/deal-execution-source-of-truth';

type RoleCard = {
  title: string;
  href: string;
  role?: PlatformRole;
  accent: string;
  focus: string;
  sees: string;
  hidden: string;
};

type RouteStep = {
  step: string;
  title: string;
  href: string;
  role?: PlatformRole;
  actor: string;
  answer: string;
  guard: string;
};

const { deal, logistics, money, documents, readiness, dispute } = PLATFORM_V7_EXECUTION_SOURCE;
const readinessScore = executionReadinessScore();
const blockers = executionBlockers();
const firstBlocker = blockers[0] ?? 'активных блокеров нет';
const expectedDealAmount = expectedDealAmountRub();

const CONTROL_ANSWERS = [
  {
    label: 'Что происходит',
    value: `${deal.lotId} → ставка → ${deal.id} → резерв → ${logistics.orderId} → ${logistics.tripId}`,
    note: 'Показ ведётся по одной сделке от цены до доказательств, а не по случайному набору экранов.',
  },
  {
    label: 'Где деньги',
    value: `${formatRub(money.reservedRub)} · резервный контур; ${formatRub(money.releaseCandidateRub)} · к выпуску`,
    note: `Решение банка: ${money.bankDecision}. Продавец не получает деньги сразу после ставки.`,
  },
  {
    label: 'Где груз',
    value: `${logistics.orderId} / ${logistics.tripId} · ${logistics.currentLeg}`,
    note: `${logistics.pickupPoint} → ${logistics.deliveryPoint}. ETA: ${logistics.eta}.`,
  },
  {
    label: 'Где документы',
    value: `СДИЗ: ${documents.sdizStatus}; ЭДО: ${documents.edoStatus}; КЭП: ${documents.kepStatus}`,
    note: `Не хватает: ${documents.missingDocuments.join(', ')}. Без полного пакета выпуск денег закрыт.`,
  },
  {
    label: 'Что заблокировано',
    value: blockers.length > 0 ? `${blockers.length} блокера` : 'критических блокеров нет',
    note: firstBlocker,
  },
  {
    label: 'Кто следующий',
    value: blockers.length > 0 ? 'владелец блокера + оператор' : 'банк / оператор по регламенту',
    note: 'Следующий шаг должен иметь владельца, срок, основание и след в журнале.',
  },
];

const GUIDED_ROUTE: RouteStep[] = [
  {
    step: '01',
    title: 'Продавец',
    href: '/platform-v7/seller',
    role: 'seller',
    actor: 'КФХ / хозяйство',
    answer: `${deal.seller} публикует ${deal.lotId}: ${deal.crop}, ${formatTons(deal.volumeTons)}, базис — ${deal.basis}.`,
    guard: 'Покупатели обезличены, виден числовой рейтинг. Кредитная линия продавцу не показывается.',
  },
  {
    step: '02',
    title: 'Deal 360',
    href: `/platform-v7/deals/${deal.id}/clean`,
    actor: 'единая карточка сделки',
    answer: `${deal.id} связывает лот, ставку, резервный контур, логистику, документы, деньги и спор.`,
    guard: `Статус: ${deal.maturity}. Это controlled-pilot / simulation-grade, не live-integrated контур.`,
  },
  {
    step: '03',
    title: 'Банк',
    href: '/platform-v7/bank',
    role: 'bank',
    actor: 'финансовый партнёр',
    answer: `Сумма сделки: ${formatRub(expectedDealAmount)}. Резервный контур: ${formatRub(money.reservedRub)}. К выпуску сейчас: ${formatRub(money.releaseCandidateRub)}.`,
    guard: 'Нет фальшивой кнопки выплаты: выпуск денег невозможен без СДИЗ, ЭТрН, УПД, акта, качества и закрытого спора.',
  },
  {
    step: '04',
    title: 'Документы',
    href: '/platform-v7/documents',
    actor: 'ЭДО / ФГИС / КЭП',
    answer: `Договор: ${documents.contractStatus}; СДИЗ: ${documents.sdizStatus}; транспортный пакет: ${documents.transportPackStatus}.`,
    guard: 'У каждого документа должен быть источник, ответственный, статус и влияние на выплату.',
  },
  {
    step: '05',
    title: 'Логистика',
    href: '/platform-v7/logistics',
    role: 'logistics',
    actor: 'перевозчик / диспетчер',
    answer: `${logistics.orderId}: перевозчик назначен, ${logistics.driverAlias}, машина ${logistics.vehicleMasked}, статус — ${logistics.currentLeg}.`,
    guard: 'Логист видит рейс, маршрут, окна и инциденты. Ставки, цену зерна, банк, резерв и кредит не видит.',
  },
  {
    step: '06',
    title: 'Водитель',
    href: '/platform-v7/driver',
    role: 'driver',
    actor: 'полевой мобильный контур',
    answer: `${logistics.tripId}: один рейс, маршрут, обязательные шаги, фотофиксация, проблема и офлайн-очередь.`,
    guard: 'Водитель не видит деньги, ставки, банк, покупателя и кредит. Только исполнение своего рейса.',
  },
  {
    step: '07',
    title: 'Приёмка',
    href: '/platform-v7/elevator',
    role: 'elevator',
    actor: 'элеватор / лаборатория',
    answer: 'Вес, акт приёмки, качество и протокол формируют расчётную базу и возможную качественную дельту.',
    guard: 'Приёмка не видит ставки, цену, банк, резерв и кредит. Только факт, вес, качество, акт и отклонения.',
  },
  {
    step: '08',
    title: 'Спор',
    href: '/platform-v7/disputes',
    actor: 'стороны / арбитр / оператор',
    answer: `Статус спора: ${dispute.status}. Доказательств в пакете: ${dispute.evidenceCount}.`,
    guard: 'Спор имеет причину, сумму влияния, SLA, владельца и пакет доказательств. Он не решается устной перепиской.',
  },
  {
    step: '09',
    title: 'Оператор',
    href: '/platform-v7/control-tower',
    role: 'operator',
    actor: 'центр исполнения',
    answer: `Готовность контура: ${readinessScore}%. Первый блокер: ${firstBlocker}.`,
    guard: 'Оператор видит блокер, сумму влияния, ответственного и следующий шаг. Без тихого ручного обхода.',
  },
];

const ROLE_CARDS: RoleCard[] = [
  {
    title: 'Продавец',
    href: '/platform-v7/seller',
    role: 'seller',
    accent: '#0A7A5F',
    focus: 'продать зерно и дойти до денег без ручного хаоса',
    sees: `${deal.lotId}, обезличенные офферы, рейтинг покупателей, свои документы, рейсы, расчётный лист`,
    hidden: 'кредитная линия покупателя, чужие ставки закрытого режима, банковая внутренняя логика',
  },
  {
    title: 'Покупатель',
    href: '/platform-v7/buyer',
    role: 'buyer',
    accent: '#2563EB',
    focus: 'закупить объём с контролем качества, маршрута, документов и денег',
    sees: 'доступные лоты, свою ставку, свой резервный контур, Сбер · Оплата в кредит, приёмку и документы',
    hidden: 'чужие закрытые ставки и внутренние данные продавца вне допуска',
  },
  {
    title: 'Логистика',
    href: '/platform-v7/logistics',
    role: 'logistics',
    accent: '#7C3AED',
    focus: 'принять заявку, назначить рейс и довести машину до приёмки',
    sees: `${logistics.orderId}, маршрут, окна, перевозчика, водителя, машину, инциденты`,
    hidden: 'цена зерна, ставки, банк, резерв и кредит',
  },
  {
    title: 'Водитель',
    href: '/platform-v7/driver',
    role: 'driver',
    accent: '#475569',
    focus: 'выполнить один рейс без лишних экранов',
    sees: `${logistics.tripId}, маршрут, чек-лист, фото, пломбу, проблему, офлайн-очередь`,
    hidden: 'деньги, ставки, банк, покупатель и кредит',
  },
  {
    title: 'Элеватор / приёмка',
    href: '/platform-v7/elevator',
    role: 'elevator',
    accent: '#B45309',
    focus: 'зафиксировать физические факты погрузки и приёмки',
    sees: 'окна, транспорт, вес, пломбу, акт, очередь, замечания',
    hidden: 'коммерческие ставки, банковые решения и кредитные сценарии',
  },
  {
    title: 'Банк',
    href: '/platform-v7/bank',
    role: 'bank',
    accent: '#0F172A',
    focus: 'видеть деньги, документы, причины остановки и условия выпуска',
    sees: `сумму сделки ${formatRub(expectedDealAmount)}, резервный контур, блокеры, документы, условия выпуска`,
    hidden: 'кнопка выплаты без закрытых условий и подтверждённых событий',
  },
  {
    title: 'Оператор',
    href: '/platform-v7/control-tower',
    role: 'operator',
    accent: '#991B1B',
    focus: 'снимать узкие места и вести сделку по SLA',
    sees: 'блокер, сумму влияния, владельца шага, следующий ответственный шаг, журнал действий',
    hidden: 'тихое редактирование первичных фактов и ручной обход без следа',
  },
  {
    title: 'Deal 360',
    href: `/platform-v7/deals/${deal.id}/clean`,
    accent: '#334155',
    focus: 'единая правда по сделке',
    sees: `${deal.id}, ${deal.lotId}, ${logistics.orderId}, ${logistics.tripId}, деньги, документы, блокеры, доказательства`,
    hidden: 'несвязанные карточки, конфликтующие суммы и разрозненные статусы',
  },
  {
    title: 'Документы',
    href: '/platform-v7/documents',
    accent: '#0369A1',
    focus: 'понять, что именно мешает выплате',
    sees: 'ФГИС, СДИЗ, ЭТрН, УПД, акты, КЭП, источник, ответственного, статус, влияние на деньги',
    hidden: 'внутренний PDF как подмена обязательного государственного или ЭДО-контура',
  },
];

const SUPPORT_LINKS = [
  { title: 'Лот LOT-2403', href: `/platform-v7/lots/${deal.lotId}`, role: 'seller' as PlatformRole },
  { title: 'Заявка в логистике', href: '/platform-v7/logistics/inbox', role: 'logistics' as PlatformRole },
  { title: 'Лаборатория', href: '/platform-v7/lab', role: 'lab' as PlatformRole },
  { title: 'Сюрвейер', href: '/platform-v7/surveyor', role: 'surveyor' as PlatformRole },
  { title: 'Комплаенс', href: '/platform-v7/compliance', role: 'compliance' as PlatformRole },
] as const;

const DOCUMENT_FLOW = [
  {
    name: 'СДИЗ',
    source: 'ФГИС «Зерно»',
    owner: 'продавец + оператор',
    status: documents.sdizStatus,
    impact: 'блокирует финальный выпуск денег',
  },
  {
    name: 'ЭТрН / транспортный пакет',
    source: 'СБИС / Saby + ГИС ЭПД',
    owner: 'логист + перевозчик',
    status: documents.transportPackStatus,
    impact: 'блокирует закрытие рейса и транспортное основание',
  },
  {
    name: 'УПД',
    source: 'Контур.Диадок',
    owner: 'продавец + покупатель',
    status: documents.edoStatus,
    impact: 'блокирует бухгалтерское и денежное закрытие',
  },
  {
    name: 'КЭП / МЧД',
    source: 'КриптоПро DSS',
    owner: 'уполномоченные подписанты',
    status: documents.kepStatus,
    impact: 'блокирует внешне значимое подписание',
  },
  {
    name: 'Акт приёмки',
    source: 'элеватор / точка приёмки',
    owner: 'элеватор',
    status: readiness.logistics.status,
    impact: 'подтверждает факт исполнения и вес',
  },
  {
    name: 'Протокол качества',
    source: 'ФГБУ ЦОК АПК / лаборатория',
    owner: 'лаборатория',
    status: readiness.quality.status,
    impact: 'меняет расчётную базу и может открыть спор',
  },
];

const STATUS_STYLES: Record<string, { background: string; border: string; color: string }> = {
  готово: { background: 'rgba(10,122,95,0.10)', border: 'rgba(10,122,95,0.22)', color: '#0A7A5F' },
  проверить: { background: 'rgba(180,83,9,0.10)', border: 'rgba(180,83,9,0.24)', color: '#B45309' },
  стоп: { background: 'rgba(185,28,28,0.10)', border: 'rgba(185,28,28,0.25)', color: '#B91C1C' },
};

function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] ?? STATUS_STYLES.проверить;
  return (
    <span style={{ display: 'inline-flex', width: 'fit-content', borderRadius: 999, padding: '5px 9px', border: `1px solid ${style.border}`, background: style.background, color: style.color, fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
      {status}
    </span>
  );
}

function RoleCardView({ scenario }: { scenario: RoleCard }) {
  const { setRole } = usePlatformV7RStore();

  return (
    <Link
      href={`${scenario.href}${scenario.role ? `?as=${scenario.role}` : ''}`}
      onClick={() => scenario.role && setRole(scenario.role)}
      style={{
        textDecoration: 'none',
        background: '#FFFFFF',
        border: '1px solid #E4E6EA',
        borderRadius: 24,
        padding: 18,
        display: 'grid',
        gap: 14,
        minHeight: 262,
        boxShadow: '0 14px 34px rgba(15,20,25,0.05)',
      }}
    >
      <div style={{ width: 44, height: 4, borderRadius: 999, background: scenario.accent }} />
      <div style={{ display: 'grid', gap: 8 }}>
        <h3 style={{ margin: 0, fontSize: 25, lineHeight: 1.08, fontWeight: 950, color: '#0F1419', letterSpacing: '-0.035em' }}>{scenario.title}</h3>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: '#475569' }}>{scenario.focus}</p>
      </div>
      <div style={{ display: 'grid', gap: 8 }}>
        <div style={miniBlock}>
          <div style={greenLabel}>видит</div>
          <p style={miniText}>{scenario.sees}</p>
        </div>
        <div style={miniBlock}>
          <div style={amberLabel}>скрыто / запрещено</div>
          <p style={miniText}>{scenario.hidden}</p>
        </div>
      </div>
      <div style={{ marginTop: 'auto', minHeight: 44, borderRadius: 14, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '11px 14px', background: scenario.accent, color: '#fff', fontSize: 15, fontWeight: 900, textAlign: 'center' }}>
        Открыть кабинет
      </div>
    </Link>
  );
}

function RouteStepCard({ route }: { route: RouteStep }) {
  const { setRole } = usePlatformV7RStore();

  return (
    <Link
      href={`${route.href}${route.role ? `?as=${route.role}` : ''}`}
      onClick={() => route.role && setRole(route.role)}
      style={{ textDecoration: 'none', background: '#FFFFFF', border: '1px solid #E4E6EA', borderRadius: 22, padding: 18, display: 'grid', gap: 12, minHeight: 232 }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14 }}>
        <div style={{ display: 'grid', gap: 6 }}>
          <div style={microLabel}>{route.step} · {route.actor}</div>
          <h3 style={{ margin: 0, color: '#0F1419', fontSize: 23, lineHeight: 1.1, fontWeight: 950, letterSpacing: '-0.035em' }}>{route.title}</h3>
        </div>
        <span style={openPill}>открыть</span>
      </div>
      <p style={{ margin: 0, color: '#334155', fontSize: 14, lineHeight: 1.55 }}>{route.answer}</p>
      <p style={{ margin: 0, borderRadius: 16, border: '1px solid #E4E6EA', background: '#F8FAFB', padding: 12, color: '#64748B', fontSize: 13, lineHeight: 1.5 }}>{route.guard}</p>
    </Link>
  );
}

export function PlatformRolesHub() {
  const { setRole } = usePlatformV7RStore();

  return (
    <main style={{ display: 'grid', gap: 16, padding: '4px 0 28px' }}>
      <section style={{ background: 'linear-gradient(135deg,#FFFFFF 0%,#F8FAFB 58%,#EEF6F3 100%)', border: '1px solid #E4E6EA', borderRadius: 30, padding: 22, display: 'grid', gap: 18, boxShadow: '0 18px 55px rgba(15,20,25,0.06)' }}>
        <div style={{ display: 'grid', gap: 12, maxWidth: 940 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <span style={statusPill}>controlled-pilot</span>
            <span style={statusPill}>simulation-grade</span>
            <span style={statusPill}>не production-ready</span>
          </div>
          <h1 style={{ margin: 0, fontSize: 'clamp(34px, 8.5vw, 64px)', lineHeight: 1.01, letterSpacing: '-0.058em', fontWeight: 950, color: '#0F1419' }}>
            Маршрут сделки за 3 минуты
          </h1>
          <p style={{ margin: 0, fontSize: 17, lineHeight: 1.62, color: '#475569', maxWidth: 780 }}>
            Главная страница показывает не «одинаковую платформу для всех», а один понятный контур исполнения: продавец → Deal 360 → банк → документы → логистика → водитель → приёмка → спор → оператор.
          </p>
        </div>

        <div style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 24, padding: 18, display: 'grid', gap: 14 }}>
          <div style={{ display: 'grid', gap: 6 }}>
            <div style={microLabel}>сквозной сценарий</div>
            <h2 style={{ margin: 0, color: '#0F1419', fontSize: 'clamp(24px, 6vw, 42px)', lineHeight: 1.08, letterSpacing: '-0.045em', fontWeight: 950 }}>
              {deal.lotId} → ставка → {deal.id} → резерв → {logistics.orderId} → {logistics.tripId}
            </h2>
            <p style={{ margin: 0, color: '#64748B', fontSize: 14, lineHeight: 1.55 }}>
              {deal.crop} · {formatTons(deal.volumeTons)} · сумма сделки {formatRub(expectedDealAmount)} · резерв {formatRub(money.reservedRub)} · готовность {readinessScore}%
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Link href='/platform-v7/seller?as=seller' onClick={() => setRole('seller')} style={darkButton}>Начать с продавца</Link>
            <Link href={`/platform-v7/deals/${deal.id}/clean`} style={lightButton}>Открыть Deal 360</Link>
            <Link href='/platform-v7/bank?as=bank' onClick={() => setRole('bank')} style={lightButton}>Условия выпуска</Link>
            <Link href='/platform-v7/driver?as=driver' onClick={() => setRole('driver')} style={lightButton}>Рейс водителя</Link>
          </div>
        </div>
      </section>

      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 26, padding: 18, display: 'grid', gap: 14 }}>
        <div style={{ display: 'grid', gap: 6 }}>
          <div style={microLabel}>первый экран</div>
          <h2 style={sectionTitle}>Ответы за 5 секунд</h2>
          <p style={sectionText}>На главной странице сразу видно, что происходит, где деньги, где груз, где документы, что заблокировано и кто следующий ответственный.</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(245px, 1fr))', gap: 10 }}>
          {CONTROL_ANSWERS.map((item) => (
            <div key={item.label} style={{ border: '1px solid #E4E6EA', borderRadius: 20, background: '#F8FAFB', padding: 15, display: 'grid', gap: 8 }}>
              <div style={microLabel}>{item.label}</div>
              <p style={{ margin: 0, color: '#0F1419', fontSize: 15, fontWeight: 900, lineHeight: 1.45 }}>{item.value}</p>
              <p style={{ margin: 0, color: '#64748B', fontSize: 13, lineHeight: 1.5 }}>{item.note}</p>
            </div>
          ))}
        </div>
      </section>

      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 26, padding: 18, display: 'grid', gap: 14 }}>
        <div style={{ display: 'grid', gap: 6 }}>
          <div style={microLabel}>маршрут показа</div>
          <h2 style={sectionTitle}>Одна сделка, девять рабочих поверхностей</h2>
          <p style={sectionText}>Путь ведёт пользователя по исполнению сделки, а не по меню. Каждый шаг показывает: что видит роль, что скрыто и почему выпуск денег не происходит без доказательств.</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
          {GUIDED_ROUTE.map((route) => <RouteStepCard key={route.step} route={route} />)}
        </div>
      </section>

      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 26, padding: 18, display: 'grid', gap: 14 }}>
        <div style={{ display: 'grid', gap: 6 }}>
          <div style={microLabel}>документы</div>
          <h2 style={sectionTitle}>Источник → ответственный → статус → влияние на выплату</h2>
          <p style={sectionText}>Документный контур не подменяет ФГИС, ГИС ЭПД, ЭДО и КЭП внутренней карточкой. В интерфейсе видно, что именно блокирует деньги.</p>
        </div>
        <div style={{ display: 'grid', gap: 8 }}>
          {DOCUMENT_FLOW.map((doc) => (
            <div key={doc.name} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, border: '1px solid #E4E6EA', borderRadius: 18, padding: 14, background: '#F8FAFB' }}>
              <div>
                <div style={microLabel}>документ</div>
                <p style={tableStrong}>{doc.name}</p>
              </div>
              <div>
                <div style={microLabel}>источник</div>
                <p style={tableText}>{doc.source}</p>
              </div>
              <div>
                <div style={microLabel}>ответственный / статус</div>
                <p style={tableText}>{doc.owner}</p>
                <StatusBadge status={doc.status} />
              </div>
              <div>
                <div style={microLabel}>влияние на выплату</div>
                <p style={tableText}>{doc.impact}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 26, padding: 18, display: 'grid', gap: 14 }}>
        <div style={{ display: 'grid', gap: 6 }}>
          <div style={microLabel}>роли</div>
          <h2 style={sectionTitle}>Одинаково понятная платформа, но не одинаковая для всех</h2>
          <p style={sectionText}>У каждой роли свой безопасный контур. Чем меньше лишнего видит роль, тем выше доверие к деньгам, документам и спору.</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
          {ROLE_CARDS.map((scenario) => <RoleCardView key={scenario.title} scenario={scenario} />)}
        </div>
      </section>

      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 22, padding: 16, display: 'grid', gap: 12 }}>
        <div style={microLabel}>дополнительные контуры</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {SUPPORT_LINKS.map((link) => (
            <Link
              key={link.href}
              href={`${link.href}?as=${link.role}`}
              onClick={() => setRole(link.role)}
              style={pillLink}
            >
              {link.title}
            </Link>
          ))}
        </div>
      </section>

      <section style={{ border: '1px solid #E4E6EA', borderRadius: 24, padding: 16, background: '#F8FAFB', display: 'grid', gap: 6 }}>
        <div style={microLabel}>честная граница показа</div>
        <p style={{ margin: 0, color: '#475569', fontSize: 14, lineHeight: 1.6 }}>
          Это сильный controlled-pilot маршрут и единый контур исполнения. Он не заявляет production-ready, live-integrated или полностью боевой статус внешних систем. ФГИС, ЭДО, ГИС ЭПД, КЭП и банковый контур показаны как управляемые маршруты и адаптеры, требующие договоров, доступов и подтверждения на реальных сделках.
        </p>
      </section>
    </main>
  );
}

const microLabel = { fontSize: 11, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 900 } as const;
const statusPill = { display: 'inline-flex', width: 'fit-content', alignItems: 'center', padding: '7px 11px', borderRadius: 999, background: 'rgba(10,122,95,0.08)', border: '1px solid rgba(10,122,95,0.18)', color: '#0A7A5F', fontSize: 12, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em' } as const;
const sectionTitle = { margin: 0, color: '#0F1419', fontSize: 'clamp(25px, 6vw, 38px)', lineHeight: 1.08, letterSpacing: '-0.045em', fontWeight: 950 } as const;
const sectionText = { margin: 0, color: '#64748B', fontSize: 14, lineHeight: 1.6, maxWidth: 860 } as const;
const darkButton = { textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minHeight: 44, padding: '11px 15px', borderRadius: 14, background: '#0F172A', color: '#fff', fontSize: 14, fontWeight: 900 } as const;
const lightButton = { textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minHeight: 44, padding: '11px 15px', borderRadius: 14, background: '#fff', border: '1px solid #CBD5E1', color: '#0F1419', fontSize: 14, fontWeight: 900 } as const;
const pillLink = { textDecoration: 'none', minHeight: 40, display: 'inline-flex', alignItems: 'center', padding: '9px 13px', borderRadius: 999, background: '#F8FAFB', border: '1px solid #E4E6EA', color: '#0F1419', fontSize: 13, fontWeight: 850 } as const;
const openPill = { border: '1px solid #CBD5E1', borderRadius: 999, padding: '5px 9px', color: '#64748B', fontSize: 12, fontWeight: 850, whiteSpace: 'nowrap' } as const;
const miniBlock = { border: '1px solid #E4E6EA', borderRadius: 16, background: '#F8FAFB', padding: 12, display: 'grid', gap: 6 } as const;
const greenLabel = { fontSize: 10, color: '#0A7A5F', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 950 } as const;
const amberLabel = { fontSize: 10, color: '#B45309', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 950 } as const;
const miniText = { margin: 0, color: '#475569', fontSize: 13, lineHeight: 1.5 } as const;
const tableStrong = { margin: '5px 0 0', color: '#0F1419', fontSize: 14, lineHeight: 1.45, fontWeight: 900 } as const;
const tableText = { margin: '5px 0 8px', color: '#475569', fontSize: 13, lineHeight: 1.5 } as const;
