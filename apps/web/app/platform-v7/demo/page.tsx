import Link from 'next/link';
import { AlertTriangle, ArrowRight, Banknote, CheckCircle2, ClipboardCheck, FileCheck2, FlaskConical, HelpCircle, LockKeyhole, MapPinned, Scale, ShieldCheck, Truck, UserRound, Wheat } from 'lucide-react';

const DEAL = {
  id: 'DL-DEMO-001',
  culture: 'Пшеница 4 класс',
  volume: '240 т',
  amount: '2 964 000 ₽',
  route: 'Хозяйство → элеватор → покупатель',
  status: 'ДЕМО · синтетические данные',
};

const FLOW_STEPS = [
  { title: 'Создать лот', role: 'Продавец', status: 'партия подготовлена', blocker: 'паспорт и СДИЗ требуют сверки', impact: 'деньги ещё не запрошены', Icon: Wheat },
  { title: 'Получить ставку', role: 'Покупатель', status: 'есть предложение по цене', blocker: 'предложение ещё не принято', impact: 'резерв ещё не открыт', Icon: UserRound },
  { title: 'Принять предложение', role: 'Продавец', status: 'цена согласована', blocker: 'сделка ещё не создана', impact: 'можно переходить к резерву', Icon: CheckCircle2 },
  { title: 'Создать сделку', role: 'Оператор', status: 'сделка собрана', blocker: 'нужен запрос резерва', impact: 'деньги переходят в банковский контур', Icon: ClipboardCheck },
  { title: 'Запросить резерв', role: 'Банк', status: 'запрос отправлен', blocker: 'ответ банка ожидается', impact: 'банковская проверка выплаты ещё невозможна', Icon: Banknote },
  { title: 'Подтвердить резерв', role: 'Банк', status: 'резерв подтверждён в тестовом сценарии', blocker: 'требуются логистика и документы', impact: 'резерв виден в денежном контуре сделки', Icon: LockKeyhole },
  { title: 'Назначить логистику', role: 'Логистика', status: 'рейс назначен', blocker: 'нужны машина и водитель', impact: 'транспортный пакет ещё неполный', Icon: Truck },
  { title: 'Закрыть рейс', role: 'Водитель', status: 'рейс проходит field-события', blocker: 'фото, GPS, пломба и вес должны быть отправлены', impact: 'без закрытия рейса банковская проверка выплаты блокируется', Icon: MapPinned },
  { title: 'Подтвердить приёмку', role: 'Элеватор', status: 'вес и пломба зафиксированы', blocker: 'расхождение веса создаёт остановку', impact: 'может появиться удержание', Icon: ShieldCheck },
  { title: 'Загрузить лабораторию', role: 'Лаборатория', status: 'качество проверяется', blocker: 'протокол должен быть загружен', impact: 'отклонение качества влияет на спор и удержание', Icon: FlaskConical },
  { title: 'Проверить документы', role: 'Банк / оператор', status: 'пакет документов сверяется', blocker: 'нет подписи или внешнего ответа', impact: 'деньги остаются в резерве до основания', Icon: FileCheck2 },
  { title: 'Выпуск или удержание', role: 'Банк', status: 'банк получил основание', blocker: 'спор или ручная проверка могут остановить выпуск', impact: 'банк подтверждает выплату или удержание', Icon: Banknote },
  { title: 'Открыть спор', role: 'Арбитр', status: 'сумма под риском выделена', blocker: 'нужны доказательства', impact: 'удержание остаётся до решения', Icon: AlertTriangle },
  { title: 'Закрыть по доказательствам', role: 'Арбитр / оператор', status: 'решение требует основания', blocker: 'без причины спор не закрывается', impact: 'решение объясняет влияние на удержание и выплату', Icon: Scale },
] as const;

const ROLE_LENSES = [
  { role: 'Продавец', sees: 'партия, рейс, приёмка, документы и основание для оплаты' },
  { role: 'Покупатель', sees: 'поставку, качество, расхождения, документы и риск удержания' },
  { role: 'Логистика', sees: 'рейс, водителя, маршрут, контрольные точки и отклонения' },
  { role: 'Элеватор', sees: 'вес, пломбу, приёмку, хранение и расхождения' },
  { role: 'Лаборатория', sees: 'показатели качества, протокол и влияние на расчёт' },
  { role: 'Банк', sees: 'резерв, блокеры, документы и основание для выпуска денег' },
  { role: 'Арбитр', sees: 'спор, доказательства, влияние на удержание и решение' },
  { role: 'Руководитель', sees: 'узкие места, SLA, деньги, документы и риск обхода контура' },
] as const;

const EVIDENCE = ['GPS-метка рейса', 'Фото приёмки', 'Протокол качества', 'ЭДО / документы', 'Журнал действий', 'Основание решения'];

export default function DemoModePage() {
  return (
    <main className="p7-demo-page">
      <style>{css}</style>
      <header className="p7-demo-header" aria-label="Навигация демо-режима">
        <Link href="/platform-v7" className="p7-demo-brand" aria-label="На главную Прозрачная Цена"><span><Wheat size={24} /></span><strong>Прозрачная Цена</strong></Link>
        <nav className="p7-demo-nav" aria-label="Действия демо"><Link href="/platform-v7/contact">Задать вопрос</Link><Link href="/platform-v7/login">Войти</Link></nav>
      </header>

      <section data-testid="platform-v7-demo-flow-hero" className="p7-demo-hero" aria-labelledby="p7-demo-title">
        <div>
          <span className="p7-demo-kicker">{DEAL.status}</span>
          <h1 id="p7-demo-title">Демо-сделка: от цены до безопасного расчёта</h1>
          <p>Тестовый сценарий показывает весь путь зерновой сделки после согласования цены: логистика, приёмка, качество, документы, деньги, спор и доказательства в одном контуре. Это не live-интеграция и не доступ в рабочие кабинеты.</p>
          <div className="p7-demo-actions"><Link href="/platform-v7/register" className="p7-demo-primary">Подключить организацию<ArrowRight size={18} /></Link><Link href="/platform-v7/contact" className="p7-demo-secondary"><HelpCircle size={18} />Задать вопрос</Link></div>
        </div>
        <aside className="p7-demo-deal-card" aria-label="Параметры демо-сделки">
          <span>{DEAL.id}</span>
          <strong>{DEAL.amount}</strong>
          <dl>
            <div><dt>Культура</dt><dd>{DEAL.culture}</dd></div>
            <div><dt>Объём</dt><dd>{DEAL.volume}</dd></div>
            <div><dt>Маршрут</dt><dd>{DEAL.route}</dd></div>
          </dl>
        </aside>
      </section>

      <section className="p7-demo-money" aria-labelledby="p7-demo-money-title">
        <div>
          <span className="p7-demo-kicker">Денежный gate</span>
          <h2 id="p7-demo-money-title">Деньги не выпускаются по обещанию</h2>
          <p>В демо показана логика pre-integration: резерв удержан до подтверждения приёмки, качества и комплекта документов. Рабочие операции в демо заблокированы.</p>
        </div>
        <div className="p7-demo-gate-grid">
          <Gate title="Резерв" value={DEAL.amount} />
          <Gate title="Статус" value="удержано до основания" />
          <Gate title="Следующее условие" value="протокол качества + ЭДО" />
        </div>
      </section>

      <section data-testid="platform-v7-demo-flow" className="p7-demo-flow" aria-labelledby="p7-demo-flow-title">
        <div className="p7-demo-section-head">
          <span className="p7-demo-kicker">Роль · статус · причину остановки · влияние</span>
          <h2 id="p7-demo-flow-title">Сквозной маршрут сделки</h2>
          <p>Каждый шаг показывает роль, статус, блокер, влияние на деньги или документы и следующий безопасный переход.</p>
        </div>
        <div className="p7-demo-rail" aria-label="Этапы демо-сделки">
          {FLOW_STEPS.map((step, index) => <StepCard key={step.title} step={step} index={index} />)}
        </div>
      </section>

      <section className="p7-demo-two-col" aria-label="Ролевой просмотр и доказательства">
        <div className="p7-demo-panel">
          <span className="p7-demo-kicker">Ролевой просмотр</span>
          <h2>Линзы ролей, а не вход в ЛК</h2>
          <div className="p7-demo-lenses">{ROLE_LENSES.map((item) => <article key={item.role}><strong>{item.role}</strong><span>{item.sees}</span></article>)}</div>
        </div>
        <div className="p7-demo-panel">
          <span className="p7-demo-kicker">Evidence pack</span>
          <h2>Что попадает в доказательную цепочку</h2>
          <div className="p7-demo-evidence">{EVIDENCE.map((item) => <span key={item}><FileCheck2 size={16} />{item}</span>)}</div>
          <p className="p7-demo-note">Демо не создаёт сессию, не меняет роль и не открывает защищённые кабинеты. Любое рабочее действие доступно только после авторизации.</p>
        </div>
      </section>

      <section className="p7-demo-final" aria-label="Следующее действие">
        <div><strong>Хотите проверить на своей сделке?</strong><span>Оставьте вопрос или заявку на подключение организации.</span></div>
        <Link href="/platform-v7/contact" className="p7-demo-secondary">Задать вопрос</Link>
        <Link href="/platform-v7/register" className="p7-demo-primary">Подключить организацию</Link>
      </section>
    </main>
  );
}

function StepCard({ step, index }: { step: (typeof FLOW_STEPS)[number]; index: number }) {
  const Icon = step.Icon;
  return (
    <article className="p7-demo-step">
      <div className="p7-demo-step-top"><span>{index + 1}</span><Icon size={20} /><strong>{step.title}</strong></div>
      <div className="p7-demo-step-role">{step.role}</div>
      <dl>
        <div><dt>Статус</dt><dd>{step.status}</dd></div>
        <div><dt>Что блокирует</dt><dd>{step.blocker}</dd></div>
        <div><dt>Влияние</dt><dd>{step.impact}</dd></div>
      </dl>
      <button type="button" disabled>Рабочее действие недоступно в демо</button>
    </article>
  );
}

function Gate({ title, value }: { title: string; value: string }) {
  return <article><span>{title}</span><strong>{value}</strong></article>;
}

const css = `
.pc-shell-root-v4:has(.p7-demo-page) { --pc-header-offset: 0px !important; background: #f7faf6 !important; }
.pc-shell-root-v4:has(.p7-demo-page) .pc-v4-header, .pc-shell-root-v4:has(.p7-demo-page) .pc-v4-bottomnav, .pc-shell-root-v4:has(.p7-demo-page) .pc-v4-drawer, .pc-shell-root-v4:has(.p7-demo-page) .pc-v4-pilot-note { display: none !important; }
.pc-shell-root-v4:has(.p7-demo-page) .pc-v4-main { max-width: none !important; margin: 0 !important; padding: 0 20px 34px !important; background: #f7faf6 !important; min-height: 100svh !important; }
.p7-demo-page { width: 100%; max-width: 1180px; margin: 0 auto; padding: max(10px, env(safe-area-inset-top)) 0 36px; display: grid; gap: 16px; color: #102019; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
.p7-demo-page * { box-sizing: border-box; }
.p7-demo-page a { text-decoration: none; color: inherit; }
.p7-demo-header { position: sticky; top: max(8px, env(safe-area-inset-top)); z-index: 30; display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 12px; padding: 13px 14px; border: 1px solid rgba(15,23,42,.08); border-radius: 26px; background: rgba(255,255,255,.94); box-shadow: 0 16px 38px rgba(15,23,42,.055); backdrop-filter: blur(18px); }
.p7-demo-brand { display: inline-flex; align-items: center; gap: 10px; min-width: 0; font-weight: 930; letter-spacing: -.035em; }
.p7-demo-brand span { width: 42px; height: 42px; border-radius: 15px; display: inline-grid; place-items: center; color: #087a3b; background: rgba(8,122,59,.09); }
.p7-demo-nav { display: flex; gap: 8px; } .p7-demo-nav a { min-height: 42px; display: inline-flex; align-items: center; justify-content: center; padding: 0 13px; border: 1px solid rgba(15,23,42,.10); border-radius: 15px; background: rgba(255,255,255,.86); font-size: 13px; font-weight: 880; }
.p7-demo-hero, .p7-demo-money, .p7-demo-flow, .p7-demo-panel, .p7-demo-final { border: 1px solid rgba(15,23,42,.08); border-radius: 28px; background: rgba(255,255,255,.92); box-shadow: 0 16px 38px rgba(15,23,42,.055); }
.p7-demo-hero { display: grid; grid-template-columns: minmax(0, 1fr) 360px; gap: 18px; padding: clamp(22px, 4vw, 38px); overflow: hidden; position: relative; }
.p7-demo-hero::after { content: ''; position: absolute; inset: auto -90px -110px 40%; height: 260px; background: radial-gradient(circle, rgba(8,122,59,.18), transparent 62%); pointer-events: none; }
.p7-demo-kicker { width: fit-content; display: inline-flex; padding: 8px 12px; border-radius: 999px; background: rgba(8,122,59,.09); color: #087a3b; font-size: 12px; font-weight: 950; text-transform: uppercase; letter-spacing: .055em; }
.p7-demo-hero h1, .p7-demo-section-head h2, .p7-demo-money h2, .p7-demo-panel h2 { margin: 12px 0 0; color: #0f1f18; font-size: clamp(30px, 4.4vw, 56px); line-height: 1.02; letter-spacing: -.055em; font-weight: 950; }
.p7-demo-money h2, .p7-demo-panel h2, .p7-demo-section-head h2 { font-size: clamp(25px, 3vw, 38px); }
.p7-demo-hero p, .p7-demo-money p, .p7-demo-section-head p, .p7-demo-note { max-width: 780px; margin: 14px 0 0; color: #5d6b64; font-size: 15.5px; line-height: 1.55; font-weight: 620; }
.p7-demo-actions, .p7-demo-final { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
.p7-demo-actions { margin-top: 22px; }
.p7-demo-primary, .p7-demo-secondary { min-height: 52px; display: inline-flex; align-items: center; justify-content: center; gap: 8px; padding: 0 18px; border-radius: 16px; font-weight: 930; }
.p7-demo-primary { background: #087a3b; color: #fff !important; box-shadow: 0 16px 34px rgba(8,122,59,.20); }
.p7-demo-secondary { background: #fff; color: #087a3b !important; border: 1px solid rgba(8,122,59,.22); }
.p7-demo-deal-card { position: relative; z-index: 1; align-self: stretch; display: grid; align-content: space-between; gap: 18px; padding: 22px; border-radius: 24px; color: #fff; background: linear-gradient(145deg, #087a3b, #0b5f35); box-shadow: 0 18px 40px rgba(8,122,59,.20); }
.p7-demo-deal-card > span { font-size: 12px; font-weight: 950; opacity: .78; } .p7-demo-deal-card > strong { font-size: 36px; line-height: 1; letter-spacing: -.055em; }
.p7-demo-deal-card dl, .p7-demo-step dl { display: grid; gap: 8px; margin: 0; } .p7-demo-deal-card div, .p7-demo-step dl div { display: grid; gap: 2px; } .p7-demo-deal-card dt, .p7-demo-step dt { color: inherit; opacity: .65; font-size: 10px; text-transform: uppercase; letter-spacing: .06em; font-weight: 900; } .p7-demo-deal-card dd, .p7-demo-step dd { margin: 0; font-size: 13px; line-height: 1.35; font-weight: 790; }
.p7-demo-money { display: grid; grid-template-columns: minmax(0, .95fr) minmax(0, 1.05fr); gap: 18px; padding: 24px; }
.p7-demo-gate-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; align-self: center; }
.p7-demo-gate-grid article { min-height: 110px; padding: 16px; border: 1px solid rgba(8,122,59,.13); border-radius: 20px; background: rgba(8,122,59,.045); display: grid; align-content: center; gap: 8px; } .p7-demo-gate-grid span { color: #68746f; font-size: 12px; font-weight: 900; } .p7-demo-gate-grid strong { color: #102019; font-size: 17px; line-height: 1.2; font-weight: 950; }
.p7-demo-flow { padding: 24px; overflow: hidden; }
.p7-demo-section-head { display: grid; gap: 2px; margin-bottom: 16px; }
.p7-demo-rail { display: flex; gap: 12px; overflow-x: auto; padding: 2px 2px 12px; scroll-snap-type: x mandatory; -webkit-overflow-scrolling: touch; } .p7-demo-rail::-webkit-scrollbar { height: 8px; } .p7-demo-rail::-webkit-scrollbar-thumb { border-radius: 999px; background: rgba(8,122,59,.25); }
.p7-demo-step { flex: 0 0 278px; scroll-snap-align: start; display: grid; gap: 10px; padding: 16px; border: 1px solid rgba(15,23,42,.08); border-radius: 22px; background: #fbfdf9; }
.p7-demo-step-top { display: grid; grid-template-columns: auto auto 1fr; gap: 9px; align-items: center; color: #087a3b; } .p7-demo-step-top span { width: 28px; height: 28px; display: inline-grid; place-items: center; border-radius: 999px; background: rgba(8,122,59,.09); font-size: 12px; font-weight: 950; } .p7-demo-step-top strong { color: #102019; font-size: 14px; line-height: 1.18; font-weight: 950; }
.p7-demo-step-role { color: #66736e; font-size: 12px; font-weight: 850; }
.p7-demo-step dl { gap: 7px; } .p7-demo-step dl div { padding: 10px; border: 1px solid rgba(15,23,42,.06); border-radius: 14px; background: #fff; } .p7-demo-step dt { color: #6d7872; opacity: 1; } .p7-demo-step dd { color: #25342d; }
.p7-demo-step button { min-height: 42px; border: 1px solid rgba(15,23,42,.08); border-radius: 14px; background: #eef2ee; color: #6d7872; font-weight: 900; cursor: not-allowed; }
.p7-demo-two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.p7-demo-panel { padding: 24px; }
.p7-demo-lenses { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin-top: 16px; } .p7-demo-lenses article { display: grid; gap: 5px; padding: 13px; border: 1px solid rgba(15,23,42,.08); border-radius: 17px; background: #fbfdf9; } .p7-demo-lenses strong { color: #102019; font-size: 13px; font-weight: 950; } .p7-demo-lenses span { color: #66736e; font-size: 12.5px; line-height: 1.36; font-weight: 650; }
.p7-demo-evidence { display: grid; gap: 9px; margin-top: 16px; } .p7-demo-evidence span { display: inline-flex; align-items: center; gap: 8px; min-height: 42px; padding: 0 12px; border-radius: 14px; background: rgba(8,122,59,.06); color: #173027; font-size: 13px; font-weight: 850; }
.p7-demo-final { justify-content: space-between; padding: 20px 22px; } .p7-demo-final div { display: grid; gap: 4px; margin-right: auto; } .p7-demo-final strong { font-size: 20px; letter-spacing: -.035em; } .p7-demo-final span { color: #66736e; font-size: 13.5px; font-weight: 650; }
@media (max-width: 860px) { .pc-shell-root-v4:has(.p7-demo-page) .pc-v4-main { padding: 0 12px 28px !important; } .p7-demo-page { gap: 12px; } .p7-demo-header { border-radius: 23px; padding: 11px; } .p7-demo-nav a { min-height: 40px; padding: 0 11px; font-size: 12.5px; } .p7-demo-hero, .p7-demo-money, .p7-demo-two-col { grid-template-columns: 1fr; } .p7-demo-hero, .p7-demo-money, .p7-demo-flow, .p7-demo-panel { border-radius: 24px; padding: 18px; } .p7-demo-deal-card { min-height: 240px; } .p7-demo-gate-grid { grid-template-columns: 1fr; } .p7-demo-lenses { grid-template-columns: 1fr; } .p7-demo-final { display: grid; } .p7-demo-primary, .p7-demo-secondary { width: 100%; } }
@media (max-width: 390px) { .p7-demo-brand strong { font-size: 15px; } .p7-demo-nav a:first-child { display: none; } .p7-demo-hero h1 { font-size: 31px; } .p7-demo-step { flex-basis: 258px; } }
`;
