import { getLocale, getTranslations } from 'next-intl/server';
import {
  ArrowRight,
  CheckCircle2,
  CircleDollarSign,
  FileCheck2,
  FlaskConical,
  Landmark,
  LogIn,
  MapPinned,
  ShieldCheck,
  Sparkles,
  Truck,
  Warehouse,
  Waypoints,
  Wheat,
} from 'lucide-react';
import { PublicSiteHeader } from './PublicSiteHeader';
import { PublicLocaleLink } from './PublicLocaleLink';
import { PublicExperienceLink, PublicExperiencePageView } from './PublicExperienceAnalytics';
import { PublicDealRoleScenario, PublicDealExecutionStates } from './PublicDealRoleScenario';
import { PublicMarketTeaser } from './PublicMarketTeaser';
import { OrganizationConnectForm } from './OrganizationConnectForm';
import { GEKTA_PATHS } from '@/lib/gekta/content';
import { GektaFloatingEntry } from '@/components/gekta/GektaFloatingEntry';
import '@/styles/platform-v7-public-assistant.css';
import '@/styles/platform-v7-public-assistant-shortcut.css';
import '@/styles/platform-v7-public-assistant-mobile-fix.css';
import '@/styles/platform-v7-unified-modal-fullscreen.css';

type Locale = 'ru' | 'en' | 'zh';

function HeroGrainIllustration({ label }: { label: string }) {
  return (
    <svg className='pc-final-hero-image' width='1200' height='900' viewBox='0 0 1200 900' role='img' aria-label={label} focusable='false' preserveAspectRatio='xMidYMid slice'>
      <defs>
        <linearGradient id='pcHeroStem' x1='0' y1='0' x2='0.35' y2='1'>
          <stop offset='0' stopColor='#d8c58d' />
          <stop offset='0.55' stopColor='#b9903c' />
          <stop offset='1' stopColor='#0a7a3b' />
        </linearGradient>
        <linearGradient id='pcHeroGrain' x1='0' y1='0' x2='1' y2='1'>
          <stop offset='0' stopColor='#fff2bf' />
          <stop offset='0.45' stopColor='#d6b35e' />
          <stop offset='1' stopColor='#9b7227' />
        </linearGradient>
        <linearGradient id='pcHeroLeaf' x1='0' y1='0' x2='1' y2='1'>
          <stop offset='0' stopColor='#e3eadc' />
          <stop offset='0.5' stopColor='#9bb78e' />
          <stop offset='1' stopColor='#0a7a3b' />
        </linearGradient>
      </defs>
      <rect width='1200' height='900' fill='none' />
      <g opacity='0.22'>
        <ellipse cx='920' cy='380' rx='250' ry='360' fill='#d8c58d' />
        <ellipse cx='1025' cy='620' rx='220' ry='230' fill='#0a7a3b' opacity='0.42' />
        <ellipse cx='742' cy='680' rx='150' ry='210' fill='#fff2bf' opacity='0.74' />
      </g>
      <g transform='translate(430 54)' fill='none' strokeLinecap='round' strokeLinejoin='round'>
        <path d='M168 792 C178 652 206 514 265 352 C302 252 360 154 430 54' stroke='url(#pcHeroStem)' strokeWidth='7' opacity='0.56' />
        <path d='M334 820 C328 676 350 524 420 344 C464 230 538 136 626 38' stroke='url(#pcHeroStem)' strokeWidth='8' opacity='0.62' />
        <path d='M512 820 C490 690 512 542 590 366 C646 240 728 142 820 70' stroke='url(#pcHeroStem)' strokeWidth='7' opacity='0.50' />
        <path d='M88 822 C106 690 132 574 178 440 C218 324 270 224 342 128' stroke='url(#pcHeroStem)' strokeWidth='5' opacity='0.35' />
      </g>
      <g transform='translate(430 54)' fill='url(#pcHeroGrain)' opacity='0.58'>
        <g transform='translate(430 54) rotate(34)'>
          <ellipse cx='0' cy='0' rx='15' ry='48' /><ellipse cx='-33' cy='38' rx='13' ry='43' transform='rotate(-28)' /><ellipse cx='34' cy='42' rx='13' ry='43' transform='rotate(28)' /><ellipse cx='-39' cy='88' rx='12' ry='39' transform='rotate(-31)' /><ellipse cx='38' cy='92' rx='12' ry='39' transform='rotate(31)' /><ellipse cx='-31' cy='138' rx='10' ry='34' transform='rotate(-29)' /><ellipse cx='30' cy='142' rx='10' ry='34' transform='rotate(29)' />
          <path d='M0 -50 C-8 18 -4 114 3 190' stroke='#9b7227' strokeWidth='3' opacity='0.42' fill='none' />
        </g>
        <g transform='translate(626 38) rotate(25)'>
          <ellipse cx='0' cy='0' rx='17' ry='58' /><ellipse cx='-40' cy='45' rx='15' ry='50' transform='rotate(-30)' /><ellipse cx='40' cy='52' rx='15' ry='50' transform='rotate(30)' /><ellipse cx='-44' cy='106' rx='14' ry='46' transform='rotate(-32)' /><ellipse cx='43' cy='112' rx='14' ry='46' transform='rotate(32)' /><ellipse cx='-35' cy='166' rx='12' ry='40' transform='rotate(-30)' /><ellipse cx='34' cy='172' rx='12' ry='40' transform='rotate(30)' /><ellipse cx='-20' cy='224' rx='9' ry='31' transform='rotate(-18)' /><ellipse cx='20' cy='226' rx='9' ry='31' transform='rotate(18)' />
          <path d='M0 -60 C-5 30 -2 152 2 264' stroke='#8d6722' strokeWidth='3.4' opacity='0.45' fill='none' />
        </g>
        <g transform='translate(820 70) rotate(20)' opacity='0.82'>
          <ellipse cx='0' cy='0' rx='14' ry='46' /><ellipse cx='-31' cy='42' rx='12' ry='39' transform='rotate(-29)' /><ellipse cx='31' cy='48' rx='12' ry='39' transform='rotate(29)' /><ellipse cx='-30' cy='94' rx='10' ry='34' transform='rotate(-31)' /><ellipse cx='30' cy='100' rx='10' ry='34' transform='rotate(31)' />
          <path d='M0 -48 C-2 28 0 96 2 158' stroke='#8d6722' strokeWidth='2.8' opacity='0.42' fill='none' />
        </g>
        <g transform='translate(342 128) rotate(35)' opacity='0.48'>
          <ellipse cx='0' cy='0' rx='10' ry='34' /><ellipse cx='-24' cy='34' rx='9' ry='29' transform='rotate(-28)' /><ellipse cx='25' cy='39' rx='9' ry='29' transform='rotate(28)' /><ellipse cx='-22' cy='74' rx='8' ry='25' transform='rotate(-28)' /><ellipse cx='23' cy='79' rx='8' ry='25' transform='rotate(28)' />
        </g>
      </g>
      <g transform='translate(430 54)' fill='url(#pcHeroLeaf)' opacity='0.32'>
        <path d='M206 612 C106 584 62 534 28 472 C112 480 172 516 230 586 C238 600 226 618 206 612Z' />
        <path d='M386 604 C474 548 548 536 646 566 C556 636 478 658 390 632 C374 628 371 613 386 604Z' />
        <path d='M520 686 C624 638 724 644 842 702 C714 742 616 748 520 716 C500 708 500 696 520 686Z' opacity='0.62' />
        <path d='M116 720 C56 700 16 660 0 610 C74 620 126 650 160 700 C168 713 154 732 116 720Z' opacity='0.52' />
      </g>
      <g opacity='0.26' stroke='#0a7a3b' strokeWidth='2.2' strokeLinecap='round' fill='none'>
        <path d='M720 170 C820 158 930 180 1038 240' /><path d='M770 244 C892 230 1016 260 1132 336' opacity='0.70' /><path d='M668 350 C778 344 906 380 1016 456' opacity='0.52' />
      </g>
    </svg>
  );
}


const FINAL_HERO_CRITICAL_CSS = `
.pc-v7-public-entry.pc-final-page{background:#fff;color:#102019;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif}
.pc-v7-public-entry .pc-final-shell{width:min(100% - 40px,1200px);margin:0 auto}
.pc-v7-public-entry .pc-final-hero{display:grid;grid-template-columns:minmax(0,55fr) minmax(0,45fr);gap:48px;align-items:center;padding:58px 0 30px}
.pc-v7-public-entry .pc-final-eyebrow{display:block;color:#087a3b;font-size:12px;font-weight:800;letter-spacing:.1em;text-transform:uppercase}
.pc-v7-public-entry .pc-final-hero-copy{min-width:0}
.pc-v7-public-entry .pc-final-hero-copy h1{margin:14px 0 0;max-width:12ch;font-size:clamp(48px,5.2vw,76px);font-weight:760;line-height:.98;letter-spacing:-.055em;text-wrap:balance}
.pc-v7-public-entry .pc-final-hero-copy h1 span,.pc-v7-public-entry .pc-final-hero-copy h1 strong{display:block}
.pc-v7-public-entry .pc-final-hero-copy h1 strong{color:#087a3b;font-weight:760}
.pc-v7-public-entry .pc-final-hero-copy>p{max-width:720px;margin:22px 0 0;color:#53645a;font-size:18px;line-height:1.62}
@media(max-width:1023px){.pc-v7-public-entry .pc-final-hero{grid-template-columns:1fr;gap:28px}}
@media(max-width:767px){.pc-v7-public-entry .pc-final-shell{width:min(100% - 28px,1200px)}.pc-v7-public-entry .pc-final-hero{padding:20px 0 18px}.pc-v7-public-entry .pc-final-hero-copy h1{max-width:none;margin-top:10px;font-size:clamp(32px,10vw,42px);line-height:1.01}.pc-v7-public-entry .pc-final-hero-copy>p{margin-top:14px;font-size:14px;line-height:1.5}.pc-v7-public-entry .pc-final-hero-visual{min-height:120px;border-radius:20px}}
@media(max-width:360px){.pc-v7-public-entry .pc-final-shell{width:min(100% - 22px,1200px)}.pc-v7-public-entry .pc-final-hero-copy h1{font-size:36px}.pc-v7-public-entry .pc-final-hero-visual{min-height:112px}}
`;

const COPY = {
  ru: {
    nav: { market: 'Рынок', how: 'Как работает', participants: 'Для участников', trust: 'Доверие', gekta: 'Гекта', login: 'Войти', register: 'Зарегистрироваться' },
    hero: {
      kicker: 'Платформа управления агросделками в растениеводстве',
      title: 'От лота и цены',
      accent: 'до поставки, качества и расчёта',
      lead: '«Прозрачная Цена» связывает продавца, покупателя и исполнителей в одной Сделке — от размещения товара и торгов до поставки, качества, документов и расчёта.',
      sell: 'Продать продукцию', buy: 'Купить продукцию',
      roles: 'Логистика · Элеватор · Лаборатория · Сюрвейер · Банк',
      rolesCta: 'посмотреть свою роль',
      visualAlt: 'Растениеводство и исполнение агросделки',
      visualCulture: 'Растениеводство', visualVolume: 'Одна Сделка', visualStage: 'Приёмка и качество', visualStatus: 'От товара до расчёта',
      proof: [['Реальные лоты', 'Публичный рынок'], ['9 ролей', 'Одна Сделка'], ['7 этапов Сделки', 'От товара до закрытия'], ['RU · EN · 中文', 'Три языка']],
    },
    journey: {
      eyebrow: 'Одна Сделка', title: 'Торги — только начало',
      lead: 'После выбора цены платформа ведёт Сделку через обязательства, поставку, качество, документы, расчёт и закрытие.',
      stages: ['Товар / потребность', 'Торги', 'Обязательства', 'Доставка', 'Приёмка и качество', 'Документы и расчёт', 'Закрытие'],
      note: 'Нормальное исполнение, отклонения и разногласия остаются частью одной истории Сделки.',
      cta: 'Посмотреть весь путь',
    },
    participants: {
      eyebrow: 'Для участников', title: 'Одна Сделка — разные задачи',
      lead: 'Каждый участник работает с одним контекстом Сделки, но видит только относящиеся к своей роли данные и действия.',
      cards: [
        { icon: 'seller', title: 'Продать продукцию', sub: 'Для сельхозпроизводителя.', bullets: ['разместить товар', 'получить предложения', 'видеть исполнение', 'понимать расчётное основание'], cta: 'Продать продукцию', intent: 'sell' },
        { icon: 'buyer', title: 'Купить продукцию', sub: 'Для покупателя.', bullets: ['найти товар', 'сравнить условия', 'провести приёмку', 'связать качество с расчётом'], cta: 'Купить продукцию', intent: 'buy' },
        { icon: 'execution', title: 'Исполнить Сделку', sub: 'Логистика · Водитель · Элеватор · Лаборатория · Сюрвейер', bullets: ['получить свою задачу', 'подтвердить относящийся факт', 'передать результат или документ', 'работать в пределах своей роли'], cta: 'Роли исполнения', intent: 'execution' },
        { icon: 'finance', title: 'Финансы', sub: 'Банк · финансовая организация', bullets: ['увидеть основание', 'проверить относящиеся документы', 'видеть влияние исполнения на расчёт', 'действовать в пределах полномочий'], cta: 'Финансовый контур', intent: 'finance' },
      ],
      explorerTitle: 'Посмотреть все роли',
      explorerLead: 'Что видит роль, за что отвечает, что делает дальше и как её действия связаны с основанием и деньгами.',
    },
    execution: {
      eyebrow: 'Исполнение', title: 'Когда всё идёт по плану — и когда нет',
      lead: 'Состояние Сделки показывает факт, ответственного, влияние на расчёт и допустимый следующий шаг.',
      labels: { happened: 'Что произошло', owner: 'Кто действует', money: 'Что с расчётом', next: 'Следующий шаг' },
      states: [
        { key: 'normal', tab: 'Норма', happened: 'Исполнение соответствует условиям Сделки.', owner: 'Покупатель.', money: 'Основание подтверждено.', next: 'Завершить предусмотренное действие.' },
        { key: 'deviation', tab: 'Отклонение', happened: 'Фактическое качество отличается от условия Сделки.', owner: 'Уполномоченная сторона.', money: 'Требуется решение.', next: 'Выбрать предусмотренный условиями вариант.' },
        { key: 'dispute', tab: 'Спор', happened: 'Источники или позиции сторон расходятся.', owner: 'Участники процедуры разногласия.', money: 'Финансовое действие остановлено до появления достаточного основания.', next: 'Собрать и рассмотреть связанные доказательства.' },
      ],
    },
    trust: {
      eyebrow: 'Доверие и контроль', title: 'Проверяемое основание критических действий',
      lead: 'Критическое действие связано с полномочием, основанием, источником факта и ответственным решением.',
      cards: [
        ['Полномочия', 'Кто имеет право действовать'],
        ['Основание', 'Какие условия, документы и события позволяют действие'],
        ['Источник', 'Откуда получен конкретный факт'],
        ['Решение', 'Кто принимает окончательное решение'],
      ],
      integrations: '1С · ФГИС · ЭДО · Банки · Лаборатории · Логистика',
      integrationText: 'Когда внешний источник подключён на подтверждённом основании, его данные могут быть связаны со Сделкой. Источник сохраняет собственную роль и не считается активным без подтверждения.',
      cta: 'Центр доверия',
    },
    gekta: {
      eyebrow: 'Аграрный интеллект', title: 'Гекта понимает контекст Сделки',
      lead: 'Она помогает разобрать доступные факты, риск и следующий шаг. Критическое решение остаётся за уполномоченным человеком.',
      fact: 'Факт', factText: 'Результат лаборатории отличается от согласованного условия.',
      risk: 'Риск', riskText: 'Расчётное основание требует решения участника.',
      next: 'Следующий шаг', nextText: 'Показать доступные варианты и связанные подтверждения.',
      dealCta: 'Гекта в Сделке', productCta: 'Гекта — аграрный ИИ',
    },
    capabilities: {
      eyebrow: 'Возможности', title: 'Что умеет платформа', lead: 'Ключевые функции одной Сделки — от рынка до закрытия.',
      items: [
        ['Рынок и лоты', 'Размещение обезличенных товарных предложений и работа с торговым контуром.'],
        ['Торги и предложения', 'Коммерческие условия и выбор стороны связаны с исходным товаром или потребностью.'],
        ['Логистика и рейсы', 'Транспортная задача, маршрут, водитель и события перевозки остаются частью Сделки.'],
        ['Приёмка и хранение', 'Вес, приёмка, размещение и движение партии фиксируются в связанном контексте.'],
        ['Лаборатория и качество', 'Проба, методика, результат и протокол связаны с конкретной партией.'],
        ['Документы', 'Документы, события, версии и основания остаются связаны с историей исполнения.'],
        ['Расчётные основания', 'Видно, какие подтверждённые факты и документы позволяют или блокируют финансовое действие.'],
        ['Отклонения и споры', 'Расхождения, доказательства, решения сторон, перерасчёт и итог остаются внутри одной Сделки.'],
        ['Роли и полномочия', 'Все участники работают с одной историей, но видят только относящиеся к своей роли данные и действия.'],
        ['Гекта', 'Анализ доступных фактов, риска, источников и следующего допустимого шага.'],
        ['Учёт', 'Расчётные и учётные данные остаются связаны с исполнением Сделки.'],
        ['Внешние системы', 'Подключение учётных, государственных, финансовых и сервисных систем выполняется только через управляемый контур и подтверждённое основание.'],
      ],
    },
    final: {
      title: 'Начните со своей задачи',
      lead: 'Разместите товар или найдите предложение — остальные этапы Сделки останутся связаны в одном процессе.',
      sell: 'Продать продукцию', buy: 'Купить продукцию', help: 'Нужна помощь перед регистрацией?',
      helpNote: 'Обращение не создаёт аккаунт и не предоставляет доступ к платформе.',
    },
    footer: {
      note: 'Одна Сделка — от товара и цены до исполнения и расчёта.',
      groups: [
        ['Платформа', [['Рынок', '#market'], ['Как работает', '#how-it-works'], ['Для участников', '#participants'], ['Гекта', '#gekta']]],
        ['Доверие', [['Центр доверия', '/platform-v7/trust'], ['Документы', '/platform-v7/docs'], ['Конфиденциальность', '/platform-v7/privacy']]],
        ['Компания', [['О платформе', '/platform-v7/about'], ['Контакты', '/platform-v7/contact']]],
        ['Доступ', [['Войти', '/platform-v7/login'], ['Зарегистрироваться', '/platform-v7/register']]],
      ],
    },
  },
  en: {
    nav: { market: 'Market', how: 'How it works', participants: 'Participants', trust: 'Trust', gekta: 'Gekta', login: 'Sign in', register: 'Register' },
    hero: {
      kicker: 'Crop Deal management platform',
      title: 'From lot and price',
      accent: 'to delivery, quality and settlement',
      lead: 'Transparent Price connects seller, buyer and execution parties in one Deal — from product listing and bidding to delivery, quality, documents and settlement.',
      sell: 'Sell produce', buy: 'Buy produce',
      roles: 'Logistics · Elevator · Laboratory · Surveyor · Bank',
      rolesCta: 'view your role',
      visualAlt: 'Crop production and agricultural Deal execution',
      visualCulture: 'Crop production', visualVolume: 'One Deal', visualStage: 'Acceptance and quality', visualStatus: 'Product to settlement',
      proof: [['Real lots', 'Public market'], ['9 roles', 'One Deal'], ['7 Deal stages', 'Product to closure'], ['RU · EN · 中文', 'Three languages']],
    },
    journey: {
      eyebrow: 'One Deal', title: 'Bidding is only the beginning',
      lead: 'After price selection, the platform carries the Deal through obligations, delivery, quality, documents, settlement and closure.',
      stages: ['Product / demand', 'Bidding', 'Obligations', 'Delivery', 'Acceptance and quality', 'Documents and settlement', 'Closure'],
      note: 'Normal execution, deviations and disagreements remain part of one Deal history.',
      cta: 'See the full journey',
    },
    participants: {
      eyebrow: 'For participants', title: 'One Deal — different responsibilities',
      lead: 'Every participant works with one Deal context while seeing only the data and actions relevant to their role.',
      cards: [
        { icon: 'seller', title: 'Sell produce', sub: 'For agricultural producers.', bullets: ['list product', 'receive offers', 'track execution', 'understand the settlement basis'], cta: 'Sell produce', intent: 'sell' },
        { icon: 'buyer', title: 'Buy produce', sub: 'For buyers.', bullets: ['find product', 'compare terms', 'complete acceptance', 'link quality to settlement'], cta: 'Buy produce', intent: 'buy' },
        { icon: 'execution', title: 'Execute the Deal', sub: 'Logistics · Driver · Elevator · Laboratory · Surveyor', bullets: ['receive the assigned task', 'confirm the relevant fact', 'submit a result or document', 'work within role authority'], cta: 'Execution roles', intent: 'execution' },
        { icon: 'finance', title: 'Finance', sub: 'Bank · financial organisation', bullets: ['see the basis', 'review relevant documents', 'see execution impact on settlement', 'act within authority'], cta: 'Financial circuit', intent: 'finance' },
      ],
      explorerTitle: 'View all roles',
      explorerLead: 'What each role sees, owns, does next, and how its action relates to evidence and money.',
    },
    execution: {
      eyebrow: 'Execution', title: 'When everything goes to plan — and when it does not',
      lead: 'The Deal state shows the fact, responsible party, settlement impact and allowed next step.',
      labels: { happened: 'What happened', owner: 'Who acts', money: 'Settlement state', next: 'Next step' },
      states: [
        { key: 'normal', tab: 'Normal', happened: 'Execution matches the Deal terms.', owner: 'Buyer.', money: 'The basis is confirmed.', next: 'Complete the required action.' },
        { key: 'deviation', tab: 'Deviation', happened: 'Actual quality differs from the Deal condition.', owner: 'Authorised party.', money: 'A decision is required.', next: 'Choose an option allowed by the terms.' },
        { key: 'dispute', tab: 'Dispute', happened: 'Sources or party positions conflict.', owner: 'Participants in the disagreement procedure.', money: 'Financial action is paused until sufficient basis exists.', next: 'Collect and review linked evidence.' },
      ],
    },
    trust: {
      eyebrow: 'Trust and control', title: 'Verifiable basis for critical actions',
      lead: 'A critical action is tied to authority, basis, source and an accountable decision.',
      cards: [['Authority', 'Who has the right to act'], ['Basis', 'Which terms, documents and events allow the action'], ['Source', 'Where the specific fact came from'], ['Decision', 'Who makes the final decision']],
      integrations: '1C · Government systems · EDI · Banks · Laboratories · Logistics',
      integrationText: 'When an external source is connected on a confirmed basis, its data can be linked to the Deal. The source keeps its own role and is not shown as active without confirmation.',
      cta: 'Trust Center',
    },
    gekta: {
      eyebrow: 'Agricultural intelligence', title: 'Gekta understands the Deal context',
      lead: 'It helps interpret available facts, risk and the next step. Critical decisions remain with an authorised person.',
      fact: 'Fact', factText: 'The laboratory result differs from the agreed condition.',
      risk: 'Risk', riskText: 'The settlement basis requires a participant decision.',
      next: 'Next step', nextText: 'Show available options and linked evidence.',
      dealCta: 'Gekta in the Deal', productCta: 'Gekta — agricultural AI',
    },
    capabilities: {
      eyebrow: 'Capabilities', title: 'What the platform does', lead: 'Core functions of one Deal — from market to closure.',
      items: [
        ['Market and lots', 'Publish anonymised product offers and work with the trading circuit.'],
        ['Bidding and offers', 'Commercial terms and party selection stay linked to the original product or demand.'],
        ['Logistics and trips', 'Transport task, route, driver and transport events remain part of the Deal.'],
        ['Acceptance and storage', 'Weight, intake, placement and lot movement are recorded in connected context.'],
        ['Laboratory and quality', 'Sample, method, result and protocol are linked to the specific lot.'],
        ['Documents', 'Documents, events, versions and bases stay connected to execution history.'],
        ['Settlement basis', 'See which confirmed facts and documents allow or block financial action.'],
        ['Deviations and disputes', 'Differences, evidence, party decisions, recalculation and outcome remain inside one Deal.'],
        ['Roles and authority', 'All participants share one history while seeing only role-relevant data and actions.'],
        ['Gekta', 'Analysis of available facts, risk, sources and the next allowed step.'],
        ['Accounting', 'Settlement and accounting data remain linked to Deal execution.'],
        ['External systems', 'Accounting, government, financial and service systems are connected only through a governed exchange circuit and a confirmed basis.'],
      ],
    },
    final: {
      title: 'Start with your task',
      lead: 'List product or find an offer — the remaining Deal stages stay connected in one process.',
      sell: 'Sell produce', buy: 'Buy produce', help: 'Need help before registration?',
      helpNote: 'A help request does not create an account or grant platform access.',
    },
    footer: {
      note: 'One Deal — from product and price to execution and settlement.',
      groups: [
        ['Platform', [['Market', '#market'], ['How it works', '#how-it-works'], ['Participants', '#participants'], ['Gekta', '#gekta']]],
        ['Trust', [['Trust Center', '/platform-v7/trust'], ['Documents', '/platform-v7/docs'], ['Privacy', '/platform-v7/privacy']]],
        ['Company', [['About', '/platform-v7/about'], ['Contact', '/platform-v7/contact']]],
        ['Access', [['Sign in', '/platform-v7/login'], ['Register', '/platform-v7/register']]],
      ],
    },
  },
  zh: {
    nav: { market: '市场', how: '如何运行', participants: '参与方', trust: '信任', gekta: 'Gekta', login: '登录', register: '注册' },
    hero: {
      kicker: '种植业农业交易管理平台',
      title: '从批次和价格',
      accent: '到交付、质量与结算',
      lead: '“透明价格”把卖方、买方和履约参与方连接在同一笔交易中——从商品发布和竞价到交付、质量、文件与结算。',
      sell: '出售农产品', buy: '采购农产品',
      roles: '物流 · 筒仓 · 实验室 · 检验机构 · 银行',
      rolesCta: '查看你的角色',
      visualAlt: '种植业与农业交易履约',
      visualCulture: '种植业', visualVolume: '同一笔交易', visualStage: '验收与质量', visualStatus: '从商品到结算',
      proof: [['真实批次', '公开市场'], ['9 个角色', '同一笔交易'], ['7 个交易阶段', '从商品到关闭'], ['RU · EN · 中文', '三种语言']],
    },
    journey: {
      eyebrow: '同一笔交易', title: '竞价只是开始',
      lead: '价格确定后，平台继续管理义务、交付、质量、文件、结算与关闭。',
      stages: ['商品 / 需求', '竞价', '义务', '交付', '验收与质量', '文件与结算', '关闭'],
      note: '正常履约、偏差和争议都保留在同一笔交易历史中。',
      cta: '查看完整流程',
    },
    participants: {
      eyebrow: '面向参与方', title: '同一笔交易 — 不同任务',
      lead: '所有参与方共享同一交易上下文，但只看到与自身角色相关的数据和操作。',
      cards: [
        { icon: 'seller', title: '出售农产品', sub: '面向农业生产者。', bullets: ['发布商品', '接收报价', '查看履约', '理解结算依据'], cta: '出售农产品', intent: 'sell' },
        { icon: 'buyer', title: '采购农产品', sub: '面向买方。', bullets: ['寻找商品', '比较条件', '完成验收', '把质量与结算关联'], cta: '采购农产品', intent: 'buy' },
        { icon: 'execution', title: '履行交易', sub: '物流 · 司机 · 筒仓 · 实验室 · 检验机构', bullets: ['接收自己的任务', '确认相关事实', '提交结果或文件', '仅在角色权限内工作'], cta: '履约角色', intent: 'execution' },
        { icon: 'finance', title: '金融', sub: '银行 · 金融机构', bullets: ['查看依据', '核验相关文件', '查看履约对结算的影响', '在权限范围内操作'], cta: '金融闭环', intent: 'finance' },
      ],
      explorerTitle: '查看全部角色',
      explorerLead: '每个角色能看到什么、负责什么、下一步是什么，以及操作如何与依据和资金关联。',
    },
    execution: {
      eyebrow: '履约', title: '一切按计划进行时 — 以及出现偏差时',
      lead: '交易状态展示事实、责任方、对结算的影响以及允许的下一步。',
      labels: { happened: '发生了什么', owner: '谁来操作', money: '结算状态', next: '下一步' },
      states: [
        { key: 'normal', tab: '正常', happened: '履约符合交易条件。', owner: '买方。', money: '结算依据已确认。', next: '完成规定操作。' },
        { key: 'deviation', tab: '偏差', happened: '实际质量与交易条件不同。', owner: '获授权的一方。', money: '需要作出决定。', next: '选择条件允许的处理方案。' },
        { key: 'dispute', tab: '争议', happened: '来源或各方立场存在冲突。', owner: '争议程序参与方。', money: '在出现充分依据前，金融操作暂停。', next: '收集并审查关联证据。' },
      ],
    },
    trust: {
      eyebrow: '信任与控制', title: '关键操作具有可核验依据',
      lead: '关键操作与权限、依据、事实来源和责任决定绑定。',
      cards: [['权限', '谁有权操作'], ['依据', '哪些条件、文件和事件允许操作'], ['来源', '具体事实来自哪里'], ['决定', '谁作出最终决定']],
      integrations: '1C · 政府系统 · 电子单据 · 银行 · 实验室 · 物流',
      integrationText: '只有在外部来源已基于可确认依据接入时，其数据才可关联到交易。该来源保留自身角色，未经确认不会显示为已启用。',
      cta: '信任中心',
    },
    gekta: {
      eyebrow: '农业智能', title: 'Gekta 理解交易上下文',
      lead: '它帮助分析可用事实、风险和下一步。关键决定仍由获授权人员作出。',
      fact: '事实', factText: '实验室结果与约定条件不同。',
      risk: '风险', riskText: '结算依据需要参与方作出决定。',
      next: '下一步', nextText: '展示可用方案和关联证据。',
      dealCta: '交易中的 Gekta', productCta: 'Gekta — 农业 AI',
    },
    capabilities: {
      eyebrow: '能力', title: '平台可以做什么', lead: '同一笔交易的关键功能——从市场到关闭。',
      items: [
        ['市场与批次', '发布匿名商品报价并使用交易闭环。'],
        ['竞价与报价', '商业条件和交易方选择与原始商品或需求保持关联。'],
        ['物流与车次', '运输任务、路线、司机和运输事件都属于同一笔交易。'],
        ['验收与仓储', '重量、验收、入库和批次移动在关联上下文中记录。'],
        ['实验室与质量', '样品、方法、结果和报告与具体批次关联。'],
        ['文件', '文件、事件、版本和依据与履约历史保持关联。'],
        ['结算依据', '清楚看到哪些已确认事实和文件允许或阻止金融操作。'],
        ['偏差与争议', '差异、证据、各方决定、重算和结果都保留在同一笔交易内。'],
        ['角色与权限', '所有参与方共享同一历史，但只看到与自身角色相关的数据和操作。'],
        ['Gekta', '分析可用事实、风险、来源和下一个允许的步骤。'],
        ['核算', '结算和核算数据与交易履约保持关联。'],
        ['外部系统', '核算、政府、金融和服务系统只有通过受控数据交换闭环并具备已确认依据时才接入。'],
      ],
    },
    final: {
      title: '从你的任务开始',
      lead: '发布商品或寻找报价——交易其余阶段仍会保留在同一流程中。',
      sell: '出售农产品', buy: '采购农产品', help: '注册前需要帮助？',
      helpNote: '帮助请求不会创建账户，也不会授予平台访问权限。',
    },
    footer: {
      note: '同一笔交易——从商品和价格到履约与结算。',
      groups: [
        ['平台', [['市场', '#market'], ['如何运行', '#how-it-works'], ['参与方', '#participants'], ['Gekta', '#gekta']]],
        ['信任', [['信任中心', '/platform-v7/trust'], ['文件', '/platform-v7/docs'], ['隐私', '/platform-v7/privacy']]],
        ['公司', [['关于平台', '/platform-v7/about'], ['联系', '/platform-v7/contact']]],
        ['访问', [['登录', '/platform-v7/login'], ['注册', '/platform-v7/register']]],
      ],
    },
  },
} as const;

const MARKET_NAV_LABEL: Record<Locale, string> = {
  ru: 'Рынок',
  en: 'Market',
  zh: '市场',
};

const participantIcons = [Wheat, CircleDollarSign, Truck, Landmark] as const;
const capabilityIcons = [Wheat, CircleDollarSign, Truck, Warehouse, FlaskConical, FileCheck2, CircleDollarSign, ShieldCheck, Waypoints, Sparkles, FileCheck2, MapPinned] as const;

function localeOf(locale: string): Locale {
  return locale === 'en' || locale === 'zh' ? locale : 'ru';
}

function registerHref(locale: Locale, intent?: string) {
  const query = new URLSearchParams({ lang: locale });
  if (intent) query.set('intent', intent);
  return `/platform-v7/register?${query.toString()}`;
}

export async function PlatformV7StrategicHome() {
  const locale = localeOf(await getLocale());
  const normalizedLocale = locale;
  const copy = COPY[locale];
  const marketNavLabel = MARKET_NAV_LABEL[normalizedLocale];
  const chrome = await getTranslations('publicEntry.chrome');
  const loginHref = `/platform-v7/login?lang=${locale}`;
  const trustHref = `/platform-v7/trust?lang=${locale}`;
  const howHref = `/platform-v7/how-it-works?lang=${locale}`;
  const aiInActionHref = `/platform-v7/ai-in-action?lang=${locale}`;
  const gektaProductHref = GEKTA_PATHS[locale];

  const nav = (
    <>
      <a href='#market'>{marketNavLabel}</a>
      <a href='#how-it-works'>{copy.nav.how}</a>
      <a href='#participants'>{copy.nav.participants}</a>
      <a href='#trust'>{copy.nav.trust}</a>
      <a href='#gekta'>{copy.nav.gekta}</a>
      <a className='pc-final-mobile-access' href={loginHref}>{copy.nav.login}</a>
      <a className='pc-final-mobile-access' href={registerHref(locale)}>{copy.nav.register}</a>
    </>
  );

  const structuredData = JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'Organization', '@id': 'https://процент-агро.рф/#organization', name: 'Прозрачная Цена', url: 'https://процент-агро.рф/' },
      { '@type': 'WebSite', '@id': 'https://процент-агро.рф/#website', url: 'https://процент-агро.рф/', name: 'Прозрачная Цена', publisher: { '@id': 'https://процент-агро.рф/#organization' }, inLanguage: ['ru', 'en', 'zh'] },
    ],
  }).replace(/</g, '\\u003c');

  return (
    <div className='pc-v7-public-entry pc-final-page' data-testid='platform-v7-root-execution-cockpit'>
      <style>{FINAL_HERO_CRITICAL_CSS}</style>
      <a className='pc-skip-link' href='#main-content'>{chrome('skipToContent')}</a>
      <PublicExperiencePageView locale={locale} name='home_v3_view' />
      <script type='application/ld+json' dangerouslySetInnerHTML={{ __html: structuredData }} />

      <PublicSiteHeader
        ariaLabel={copy.nav.how}
        brandHomeLabel='Прозрачная Цена'
        navLabel={copy.nav.how}
        menuLabel={chrome('menuLabel')}
        nav={nav}
        showMobileMenu
        localeControl={<PublicLocaleLink />}
        actions={(
          <div className='pc-v6-header-actions'>
            <a href={loginHref} className='entry-login' aria-label={copy.nav.login}>
              <LogIn aria-hidden='true' size={18} />
              <span>{copy.nav.login}</span>
            </a>
            <a href={registerHref(locale)} className='pc-v6-header-cta'>{copy.nav.register}</a>
          </div>
        )}
      />

      <main id='main-content' tabIndex={-1}>
        <div className='pc-final-shell'>
          <section className='pc-final-hero' aria-labelledby='pc-final-title'>
            <div className='pc-final-hero-copy'>
              <span className='pc-final-eyebrow'>{copy.hero.kicker}</span>
              <h1 id='pc-final-title'><span>{copy.hero.title}</span><strong>{copy.hero.accent}</strong></h1>
              <p>{copy.hero.lead}</p>
              <div className='pc-final-actions'>
                <PublicExperienceLink href={registerHref(locale, 'sell')} className='pc-final-primary' eventName='registration_open' locale={locale} params={{ source: 'public_v5_intent', option: 'sell', role_entry: 'seller' }}>
                  {copy.hero.sell}<ArrowRight aria-hidden='true' size={18} />
                </PublicExperienceLink>
                <PublicExperienceLink href={registerHref(locale, 'buy')} className='pc-final-secondary' eventName='registration_open' locale={locale} params={{ source: 'public_v5_intent', option: 'buy', role_entry: 'buyer' }}>
                  {copy.hero.buy}<ArrowRight aria-hidden='true' size={18} />
                </PublicExperienceLink>
              </div>
              <a className='pc-final-role-link' href='#participants'>{copy.hero.roles} <b>→ {copy.hero.rolesCta}</b></a>
            </div>

            <div className='pc-final-hero-visual'>
              <HeroGrainIllustration label={copy.hero.visualAlt} />
              <div className='pc-final-visual-overlay'>
                <span>{copy.hero.visualCulture}</span>
                <strong>{copy.hero.visualVolume}</strong>
                <small>{copy.hero.visualStage}</small>
                <b><ArrowRight aria-hidden='true' size={15} />{copy.hero.visualStatus}</b>
              </div>
            </div>
          </section>

          <section className='pc-final-proof' aria-label={copy.hero.kicker}>
            {copy.hero.proof.map(([value, label]) => <article key={value}><strong>{value}</strong><span>{label}</span></article>)}
          </section>

          <PublicMarketTeaser locale={locale} />

          <span id='deal-path' className='pc-final-legacy-anchor' aria-hidden='true' />
          <section id='how-it-works' className='pc-final-section' aria-labelledby='journey-title'>
            <SectionHead eyebrow={copy.journey.eyebrow} title={copy.journey.title} lead={copy.journey.lead} id='journey-title' />
            <ol className='pc-final-stages' tabIndex={0} aria-labelledby='journey-title'>
              {copy.journey.stages.map((stage, index) => <li key={stage}><i>{index + 1}</i><span>{stage}</span></li>)}
            </ol>
            <div className='pc-final-section-note'><ShieldCheck aria-hidden='true' size={20} /><span>{copy.journey.note}</span></div>
            <a className='pc-final-text-link' href={howHref}>{copy.journey.cta}<ArrowRight aria-hidden='true' size={17} /></a>
          </section>

          <section id='participants' className='pc-final-section' aria-labelledby='participants-title'>
            <SectionHead eyebrow={copy.participants.eyebrow} title={copy.participants.title} lead={copy.participants.lead} id='participants-title' />
            <div className='pc-final-participant-grid'>
              {copy.participants.cards.map((card, index) => {
                const Icon = participantIcons[index] ?? Waypoints;
                return <article key={card.title} className='pc-final-participant-card'>
                  <Icon aria-hidden='true' size={24} />
                  <div><h3>{card.title}</h3><p>{card.sub}</p></div>
                  <ul>{card.bullets.map((item) => <li key={item}><CheckCircle2 aria-hidden='true' size={15} />{item}</li>)}</ul>
                  <a href={registerHref(locale, card.intent)}>{card.cta}<ArrowRight aria-hidden='true' size={16} /></a>
                </article>;
              })}
            </div>
            <details className='pc-final-role-explorer'>
              <summary>{copy.participants.explorerTitle}</summary>
              <p>{copy.participants.explorerLead}</p>
              <PublicDealRoleScenario locale={locale} />
            </details>
          </section>

          <section className='pc-final-section' aria-labelledby='execution-title'>
            <SectionHead eyebrow={copy.execution.eyebrow} title={copy.execution.title} lead={copy.execution.lead} id='execution-title' />
            <PublicDealExecutionStates title={copy.execution.title} states={copy.execution.states} labels={copy.execution.labels} />
          </section>

          <section id='trust' className='pc-final-section' aria-labelledby='trust-title'>
            <SectionHead eyebrow={copy.trust.eyebrow} title={copy.trust.title} lead={copy.trust.lead} id='trust-title' />
            <div className='pc-final-trust-grid'>
              {copy.trust.cards.map(([title, text], index) => {
                const Icon = [ShieldCheck, FileCheck2, MapPinned, CheckCircle2][index] ?? ShieldCheck;
                return <article key={title}><Icon aria-hidden='true' size={23} /><h3>{title}</h3><p>{text}</p></article>;
              })}
            </div>
            <div className='pc-final-integration-strip'>
              <strong>{copy.trust.integrations}</strong>
              <p>{copy.trust.integrationText}</p>
              <a href={trustHref}>{copy.trust.cta}<ArrowRight aria-hidden='true' size={16} /></a>
            </div>
          </section>

          <section id='gekta' className='pc-final-section pc-final-gekta' aria-labelledby='gekta-title'>
            <div className='pc-final-gekta-copy'>
              <SectionHead eyebrow={copy.gekta.eyebrow} title={copy.gekta.title} lead={copy.gekta.lead} id='gekta-title' />
              <div className='pc-final-actions'>
                <PublicExperienceLink className='pc-final-primary' href={aiInActionHref} eventName='tai_detail_open' locale={locale}>{copy.gekta.dealCta}<ArrowRight aria-hidden='true' size={17} /></PublicExperienceLink>
                <PublicExperienceLink className='pc-final-secondary' href={gektaProductHref} eventName='gekta_product_open' locale={locale}>{copy.gekta.productCta}<ArrowRight aria-hidden='true' size={17} /></PublicExperienceLink>
              </div>
            </div>
            <div className='pc-final-gekta-visual' aria-label={copy.gekta.title}>
              <Sparkles aria-hidden='true' size={30} />
              <StateFact label={copy.gekta.fact} value={copy.gekta.factText} />
              <StateFact label={copy.gekta.risk} value={copy.gekta.riskText} />
              <StateFact label={copy.gekta.next} value={copy.gekta.nextText} />
            </div>
          </section>

          <section className='pc-final-section' aria-labelledby='capabilities-title'>
            <SectionHead eyebrow={copy.capabilities.eyebrow} title={copy.capabilities.title} lead={copy.capabilities.lead} id='capabilities-title' />
            <div className='pc-final-carousel' tabIndex={0} role='region' aria-label={copy.capabilities.title}>
              {copy.capabilities.items.map(([title, text], index) => {
                const Icon = capabilityIcons[index] ?? Waypoints;
                const previous = index > 0 ? `#capability-${index}` : null;
                const next = index < copy.capabilities.items.length - 1 ? `#capability-${index + 2}` : null;
                return <article key={title} id={`capability-${index + 1}`}>
                  <div className='pc-final-capability-top'>
                    <span>{String(index + 1).padStart(2, '0')}</span>
                    <Icon aria-hidden='true' size={22} />
                    <nav aria-label={title}>
                      {previous ? <a href={previous} aria-label={`← ${title}`}>←</a> : <i aria-hidden='true'>←</i>}
                      {next ? <a href={next} aria-label={`→ ${title}`}>→</a> : <i aria-hidden='true'>→</i>}
                    </nav>
                  </div>
                  <h3>{title}</h3><p>{text}</p>
                </article>;
              })}
            </div>
          </section>

          <section className='pc-final-cta' aria-labelledby='final-title'>
            <h2 id='final-title'>{copy.final.title}</h2>
            <p>{copy.final.lead}</p>
            <div className='pc-final-actions'>
              <PublicExperienceLink href={registerHref(locale, 'sell')} className='pc-final-primary' eventName='registration_open' locale={locale} params={{ source: 'public_v5_complete', option: 'sell', role_entry: 'seller' }}>{copy.final.sell}<ArrowRight aria-hidden='true' size={18} /></PublicExperienceLink>
              <PublicExperienceLink href={registerHref(locale, 'buy')} className='pc-final-secondary' eventName='registration_open' locale={locale} params={{ source: 'public_v5_complete', option: 'buy', role_entry: 'buyer' }}>{copy.final.buy}<ArrowRight aria-hidden='true' size={18} /></PublicExperienceLink>
            </div>
            <a className='pc-final-help-link' href='#connect-organization'>{copy.final.help}</a>
            <small>{copy.final.helpNote}</small>
          </section>

          <OrganizationConnectForm locale={locale} />
        </div>
      </main>

      <footer className='pc-final-footer'>
        <div className='pc-final-shell'>
          <div className='pc-final-footer-brand'><strong>Прозрачная Цена</strong><p>{copy.footer.note}</p></div>
          <div className='pc-final-footer-groups'>
            {copy.footer.groups.map(([title, links]) => <nav key={title} aria-label={title}><strong>{title}</strong>{links.map(([label, href]) => <a key={label} href={href.startsWith('/') ? `${href}?lang=${locale}` : href}>{label}</a>)}</nav>)}
          </div>
        </div>
      </footer>

      <GektaFloatingEntry locale={locale} />
    </div>
  );
}

function SectionHead({ eyebrow, title, lead, id }: { eyebrow: string; title: string; lead: string; id: string }) {
  return <div className='pc-final-section-head'><span className='pc-final-eyebrow'>{eyebrow}</span><h2 id={id}>{title}</h2><p>{lead}</p></div>;
}

function StateFact({ label, value }: { label: string; value: string }) {
  return <div className='pc-final-state-fact'><span>{label}</span><strong>{value}</strong></div>;
}
