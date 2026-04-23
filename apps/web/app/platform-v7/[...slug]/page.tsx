'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import {
  AlertTriangle,
  ArrowRight,
  Banknote,
  Compass,
  FileCheck2,
  FlaskConical,
  Gavel,
  Landmark,
  LayoutDashboard,
  Search,
  ShieldCheck,
  Sparkles,
  Truck,
  User,
  Wheat,
  type LucideIcon,
} from 'lucide-react';
import { CatchAllPage } from '@/components/v7r/CatchAllPage';
import { usePlatformV7RStore, type PlatformRole } from '@/stores/usePlatformV7RStore';
import { trackGigaChatAsked } from '@/lib/analytics/track';

const ROLE_LABELS: Record<PlatformRole, string> = {
  operator: 'Оператор',
  buyer: 'Покупатель',
  seller: 'Продавец',
  logistics: 'Логистика',
  driver: 'Водитель',
  surveyor: 'Сюрвейер',
  elevator: 'Элеватор',
  lab: 'Лаборатория',
  bank: 'Банк',
  arbitrator: 'Арбитр',
  compliance: 'Комплаенс',
  executive: 'Руководитель',
};

type RoleAiConfig = {
  title: string;
  subtitle: string;
  promise: string;
  icon: LucideIcon;
  questions: string[];
  actions: Array<{ label: string; href: string }>;
  scopes: string[];
  limits: string[];
};

const ROLE_AI: Record<PlatformRole, RoleAiConfig> = {
  operator: {
    title: 'AI-оператор исполнения',
    subtitle: 'Очереди, блокеры, владелец шага, деньги под риском и ручные эскалации.',
    promise: 'Помогает довести сделку до следующего подтверждённого шага без потери управляемости.',
    icon: LayoutDashboard,
    questions: ['Почему выпуск заблокирован?', 'Кто держит следующий шаг?', 'Где главный блокер по сделке?', 'Что открыть оператору прямо сейчас?'],
    actions: [
      { label: 'Control Tower', href: '/platform-v7/control-tower' },
      { label: 'Сделки', href: '/platform-v7/deals' },
      { label: 'Споры', href: '/platform-v7/disputes' },
    ],
    scopes: ['owner / SLA / next action', 'docs completeness', 'bank / hold / release', 'risk / dispute / callbacks'],
    limits: ['не обещает live-интеграцию там, где sandbox', 'не выпускает деньги сам', 'не закрывает спор без регламента'],
  },
  buyer: {
    title: 'AI-помощник покупателя',
    subtitle: 'Качество, приёмка, резерв денег, окно разгрузки и пакет покупателя.',
    promise: 'Сводит в один ответ цену риска, качество партии и шаг до выпуска денег.',
    icon: Banknote,
    questions: ['Почему деньги стоят?', 'Каких документов не хватает от покупателя?', 'Что по качественной дельте?', 'Куда идти дальше по сделке?'],
    actions: [
      { label: 'Кабинет покупателя', href: '/platform-v7/buyer' },
      { label: 'Сделки', href: '/platform-v7/deals' },
      { label: 'Банк', href: '/platform-v7/bank' },
    ],
    scopes: ['резерв и release', 'приёмка / лаборатория', 'документы стороны покупателя', 'маршрут до расчёта'],
    limits: ['не меняет результат лаборатории', 'не подменяет банковое решение', 'не подтверждает чужие документы'],
  },
  seller: {
    title: 'AI-помощник продавца',
    subtitle: 'Цена, документы продавца, удержания, причины REVIEW и путь к выплате.',
    promise: 'Показывает, что мешает получить деньги и какой пакет надо закрыть первым.',
    icon: Wheat,
    questions: ['Почему лот в REVIEW?', 'Каких документов не хватает?', 'Что нужно для выпуска денег?', 'Кто держит следующий шаг по сделке?'],
    actions: [
      { label: 'Кабинет продавца', href: '/platform-v7/seller' },
      { label: 'Лоты', href: '/platform-v7/lots' },
      { label: 'Сделки', href: '/platform-v7/deals' },
    ],
    scopes: ['документы продавца', 'статус лота / сделки', 'удержания и причина блокировки', 'следующий подтверждённый шаг'],
    limits: ['не обещает моментальную оплату', 'не меняет коммерческие условия задним числом', 'не заменяет ЭДО и КЭП'],
  },
  logistics: {
    title: 'AI-диспетчер логистики',
    subtitle: 'Рейс, ETA, отклонения маршрута, окно разгрузки и транспортные документы.',
    promise: 'Собирает картину рейса и подсказывает, где риск для сделки и денег.',
    icon: Truck,
    questions: ['Где сейчас главный логистический риск?', 'Что по ETA и окну приёмки?', 'Какие транспортные документы обязательны?', 'Куда идти дальше по рейсу?'],
    actions: [
      { label: 'Логистика', href: '/platform-v7/logistics' },
      { label: 'Водитель', href: '/platform-v7/driver' },
      { label: 'Приёмка', href: '/platform-v7/elevator' },
    ],
    scopes: ['маршрут и отклонения', 'ETA / checkpoint / arrival', 'перевозочные документы', 'связь рейса с деньгами'],
    limits: ['не рисует fake-live GPS', 'не закрывает приёмку без подтверждения', 'не выпускает деньги без downstream шагов'],
  },
  driver: {
    title: 'AI-помощник водителя',
    subtitle: 'Маршрут, прибытие, инциденты, фотофиксация и офлайн-очередь событий.',
    promise: 'Даёт только следующий понятный шаг по текущему рейсу без перегруза интерфейса.',
    icon: User,
    questions: ['Что делать после прибытия?', 'Почему рейс держит следующий шаг?', 'Какие события надо зафиксировать?', 'Что делать, если нет связи?'],
    actions: [
      { label: 'Маршрут', href: '/platform-v7/driver' },
      { label: 'Сделка', href: '/platform-v7/deals/DL-9103' },
      { label: 'Логистика', href: '/platform-v7/logistics' },
    ],
    scopes: ['arrival / unload / queue', 'обязательные фото и чеки', 'офлайн-события', 'эскалация инцидента'],
    limits: ['не требует лишних полей', 'не меняет рейс без подтверждения', 'не даёт финансовых обещаний'],
  },
  surveyor: {
    title: 'AI-помощник сюрвейера',
    subtitle: 'Назначение, пакет доказательств, фото, акт осмотра и спорный контур.',
    promise: 'Подсказывает, какой материал обязателен, чтобы спор не рассыпался.',
    icon: Search,
    questions: ['Какой пакет доказательств обязателен?', 'Что приложить к спору?', 'Кто владелец кейса сейчас?', 'Куда передать результат осмотра?'],
    actions: [
      { label: 'Назначения', href: '/platform-v7/surveyor' },
      { label: 'Споры', href: '/platform-v7/disputes' },
    ],
    scopes: ['доказательства / фото / видео', 'связь с dispute pack', 'следующий владелец', 'денежное влияние'],
    limits: ['не решает спор вместо арбитра', 'не меняет цену сам', 'не редактирует чужие факты'],
  },
  elevator: {
    title: 'AI-помощник приёмки',
    subtitle: 'Окна разгрузки, очередь, вес, акт приёмки и готовность к лаборатории.',
    promise: 'Подсказывает, какой факт должен быть зафиксирован сейчас, чтобы не сломать расчёт.',
    icon: Compass,
    questions: ['Что подтвердить на приёмке?', 'Что по очереди и окну разгрузки?', 'Какие акты обязательны?', 'Куда идти дальше после выгрузки?'],
    actions: [
      { label: 'Приёмка', href: '/platform-v7/elevator' },
      { label: 'Сделки', href: '/platform-v7/deals' },
    ],
    scopes: ['въезд / очередь / выгрузка', 'вес и акты', 'переход в лабораторию', 'что откроется дальше'],
    limits: ['не подтверждает деньги', 'не меняет коммерческие условия', 'не скрывает расхождения по весу'],
  },
  lab: {
    title: 'AI-помощник лаборатории',
    subtitle: 'Проба, протокол, повторный анализ, качественная дельта и спорность результата.',
    promise: 'Сводит путь от результата анализа к спору или выпуску денег.',
    icon: FlaskConical,
    questions: ['Что по качественной дельте?', 'Нужен ли повторный анализ?', 'Что передать в спор?', 'Когда протокол открывает выпуск денег?'],
    actions: [
      { label: 'Лаборатория', href: '/platform-v7/lab' },
      { label: 'Сделки', href: '/platform-v7/deals' },
      { label: 'Споры', href: '/platform-v7/disputes' },
    ],
    scopes: ['проба / протокол / версия', 'повторный анализ', 'влияние на расчёт', 'переход в спор или release'],
    limits: ['не выпускает деньги сам', 'не закрывает спор без процедуры', 'не подменяет независимый осмотр'],
  },
  bank: {
    title: 'AI-помощник банка',
    subtitle: 'Резерв, hold, callbacks, release, возврат и конфликт статусов.',
    promise: 'Показывает, какой банковый шаг допустим следующим и что его блокирует.',
    icon: Landmark,
    questions: ['Почему hold не снят?', 'Что нужно для release?', 'Есть ли конфликт callback?', 'Кто держит следующий шаг по деньгам?'],
    actions: [
      { label: 'Банковый контур', href: '/platform-v7/bank' },
      { label: 'Сделки', href: '/platform-v7/deals' },
      { label: 'Удержания', href: '/platform-v7/disputes' },
    ],
    scopes: ['reserve / hold / release', 'callbacks и mismatch', 'документы для банка', 'денежный owner'],
    limits: ['не подменяет банковую систему', 'не даёт фальшивый live-proof', 'не проводит платёж без правил'],
  },
  arbitrator: {
    title: 'AI-помощник арбитра',
    subtitle: 'Основание спора, пакет доказательств, сумма влияния и следующий owner.',
    promise: 'Собирает dispute pack в одну картину и подсказывает, чего не хватает до решения.',
    icon: Gavel,
    questions: ['Что входит в dispute pack?', 'Каких доказательств не хватает?', 'Кто владелец спора?', 'Что нужно для закрытия спора?'],
    actions: [
      { label: 'Арбитр', href: '/platform-v7/arbitrator' },
      { label: 'Споры', href: '/platform-v7/disputes' },
      { label: 'Сделки', href: '/platform-v7/deals' },
    ],
    scopes: ['основание и сумма спора', 'evidence chain', 'следующий owner / SLA', 'влияние на деньги'],
    limits: ['не обещает автоматическое решение', 'не меняет документы задним числом', 'не скрывает открытые блокеры'],
  },
  compliance: {
    title: 'AI-помощник комплаенса',
    subtitle: 'Допуск, реквизиты, полномочия, stop-флаги и readiness обязательного пакета.',
    promise: 'Помогает не открыть риск раньше времени и не перепутать sandbox с legal-ready.',
    icon: ShieldCheck,
    questions: ['Что мешает допуску?', 'Каких полномочий не хватает?', 'Где юридический стоп-флаг?', 'Что нужно для controlled pilot?'],
    actions: [
      { label: 'Комплаенс', href: '/platform-v7/compliance' },
      { label: 'Интеграции', href: '/platform-v7/connectors' },
      { label: 'Сделки', href: '/platform-v7/deals' },
    ],
    scopes: ['допуск и полномочия', 'обязательные документы', 'стоп-факторы', 'граница зрелости'],
    limits: ['не выдаёт sandbox за live', 'не заменяет юриста по конкретному кейсу', 'не закрывает AML/KYC за банк'],
  },
  executive: {
    title: 'AI-помощник руководителя',
    subtitle: 'Деньги под риском, топ-блокеры, срыв пилота, сервисный слой и прогресс контура.',
    promise: 'Собирает управленческую картину без воды: где риск, где деньги, что делать сейчас.',
    icon: Sparkles,
    questions: ['Где главный риск пилота?', 'Какие деньги под риском?', 'Что мешает следующему раунду?', 'Куда смотреть руководителю прямо сейчас?'],
    actions: [
      { label: 'Сводка', href: '/platform-v7/executive' },
      { label: 'Control Tower', href: '/platform-v7/control-tower' },
      { label: 'Банк', href: '/platform-v7/bank' },
    ],
    scopes: ['pilot health', 'деньги под риском', 'ручной слой и repeatability', 'следующий критический шаг'],
    limits: ['не скрывает незакрытые блокеры', 'не рисует proof без сделок', 'не завышает зрелость'],
  },
};

function buildAiHref(from: string, role: PlatformRole, question?: string) {
  const params = new URLSearchParams();
  params.set('from', from);
  params.set('role', role);
  if (question) params.set('q', question);
  return `/platform-v7/ai?${params.toString()}`;
}

function screenLabel(from: string) {
  if (!from) return 'Текущий экран';
  if (from.includes('/control-tower')) return 'Control Tower';
  if (from.includes('/deals/')) return 'Карточка сделки';
  if (from.includes('/deals')) return 'Реестр сделок';
  if (from.includes('/lots/create')) return 'Создание лота';
  if (from.includes('/lots/')) return 'Карточка лота';
  if (from.includes('/lots')) return 'Реестр лотов';
  if (from.includes('/bank')) return 'Банковый контур';
  if (from.includes('/disputes')) return 'Контур спора';
  if (from.includes('/driver')) return 'Маршрут водителя';
  if (from.includes('/logistics')) return 'Логистика';
  if (from.includes('/seller')) return 'Кабинет продавца';
  if (from.includes('/buyer')) return 'Кабинет покупателя';
  if (from.includes('/elevator')) return 'Приёмка';
  if (from.includes('/lab')) return 'Лаборатория';
  if (from.includes('/compliance')) return 'Комплаенс';
  if (from.includes('/executive')) return 'Сводка руководителя';
  return from.replace('/platform-v7/', '').replaceAll('/', ' → ');
}

function inferQuery(question: string | null, role: PlatformRole, from: string) {
  return question?.trim() || ROLE_AI[role].questions[0] || `Что делать дальше на экране ${screenLabel(from)}?`;
}

function buildResponse(role: PlatformRole, question: string, from: string) {
  const lower = question.toLowerCase();
  const roleLabel = ROLE_LABELS[role];
  const screen = screenLabel(from);

  if (lower.includes('документ')) {
    return {
      headline: 'Фокус на полноте пакета',
      summary: `AI в роли «${roleLabel}» сначала проверяет обязательный пакет для экрана «${screen}», затем ищет, какой документ держит следующий переход и влияет ли это на деньги или спор.`,
      sources: ['document completeness', 'owner / next action', 'bank / dispute dependency'],
      steps: ['Открой список обязательных документов по объекту.', 'Сними разрыв: кто должен загрузить / подписать следующий документ.', 'Проверь, откроет ли это release или только снимет REVIEW.'],
    };
  }

  if (lower.includes('выпуск') || lower.includes('release') || lower.includes('деньг')) {
    return {
      headline: 'Фокус на деньгах и блокерах',
      summary: `AI проверяет три слоя: reserve / hold / release, затем спорность и полноту документов, и только после этого называет следующий допустимый шаг. На экране «${screen}» он не обещает выпуск, если контур ещё держит hold или manual review.`,
      sources: ['reserve / hold / release', 'callback / mismatch', 'docs / quality / dispute'],
      steps: ['Проверь, есть ли hold или manual blocker.', 'Сверь, закрыт ли quality / dispute контур.', 'Попроси AI назвать owner следующего подтверждения до release.'],
    };
  }

  if (lower.includes('кто ') || lower.includes('владел')) {
    return {
      headline: 'Фокус на owner и SLA',
      summary: `AI в роли «${roleLabel}» отвечает не абстрактно, а через owner текущего шага: кто держит переход, почему именно он, и что должно произойти до передачи следующему владельцу.`,
      sources: ['owner / SLA / ballAt', 'current blocker', 'next action'],
      steps: ['Сначала спроси owner шага.', 'Потом спроси, что именно он должен подтвердить.', 'Только после этого переходи к деньгам, спору или документам.'],
    };
  }

  if (lower.includes('куда') || lower.includes('дальше') || lower.includes('что делать')) {
    return {
      headline: 'Фокус на следующем ходе',
      summary: `AI строит ответ как маршрут: что у роли «${roleLabel}» открыто на экране «${screen}», какой шаг следующий, и какой экран надо открыть сразу после него.`,
      sources: ['current screen context', 'next action', 'allowed route by role'],
      steps: ['Открой самый близкий к money / dispute / docs экран.', 'Сними первый подтверждаемый blocker.', 'Вернись в сделку и проверь, изменился ли owner следующего шага.'],
    };
  }

  return {
    headline: 'Фокус на текущем экране и роли',
    summary: `AI даёт ответ только в контексте роли «${roleLabel}» и экрана «${screen}»: что видно сейчас, какой blocker главный, и какой следующий шаг даст движение без потери доказательности.`,
    sources: ['screen context', 'role scope', 'blocker / next action / money impact'],
    steps: ['Уточни главный blocker.', 'Спроси, кто следующий owner.', 'Открой экран, который меняет статус, а не просто показывает его.'],
  };
}

function AiWorkspace() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const storeRole = usePlatformV7RStore((state) => state.role);
  const role = ((searchParams.get('role') as PlatformRole) || storeRole || 'operator') as PlatformRole;
  const from = searchParams.get('from') || '/platform-v7/control-tower';
  const question = inferQuery(searchParams.get('q'), role, from);
  const config = ROLE_AI[role] || ROLE_AI.operator;
  const Icon = config.icon;
  const response = buildResponse(role, question, from);

  React.useEffect(() => {
    trackGigaChatAsked(`${role}:${from}:${question}`);
  }, [role, from, question]);

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <section style={{ background: 'var(--pc-shell-surface)', border: '1px solid var(--pc-border)', borderRadius: 22, padding: 18, boxShadow: 'var(--pc-shadow-sm)', display: 'grid', gap: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <div style={{ width: 42, height: 42, borderRadius: 14, display: 'grid', placeItems: 'center', background: 'var(--pc-accent-bg)', border: '1px solid var(--pc-accent-border)', color: 'var(--pc-accent)' }}>
              <Icon size={20} strokeWidth={2.1} />
            </div>
            <div style={{ display: 'grid', gap: 6 }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 999, background: 'var(--pc-shell-surface-soft)', border: '1px solid var(--pc-border)', color: 'var(--pc-text-secondary)', fontSize: 11, fontWeight: 800, width: 'fit-content' }}>
                <Sparkles size={14} strokeWidth={2.1} /> AI-контур по роли
              </div>
              <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--pc-text-primary)' }}>{config.title}</div>
              <div style={{ fontSize: 13, color: 'var(--pc-text-secondary)', lineHeight: 1.6, maxWidth: 920 }}>{config.subtitle}</div>
            </div>
          </div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 999, background: 'var(--pc-accent-bg)', border: '1px solid var(--pc-accent-border)', color: 'var(--pc-accent-strong)', fontSize: 12, fontWeight: 800 }}>
            Симуляция по роли · {ROLE_LABELS[role]}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
          <div style={{ background: 'var(--pc-shell-surface-soft)', border: '1px solid var(--pc-border)', borderRadius: 18, padding: 16, display: 'grid', gap: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--pc-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Контекст</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--pc-text-primary)' }}>{screenLabel(from)}</div>
            <div style={{ fontSize: 12, color: 'var(--pc-text-secondary)', lineHeight: 1.55 }}>{config.promise}</div>
          </div>
          <div style={{ background: 'var(--pc-shell-surface-soft)', border: '1px solid var(--pc-border)', borderRadius: 18, padding: 16, display: 'grid', gap: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--pc-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Граница</div>
            <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--pc-text-primary)' }}>Только подтверждённый контур</div>
            <div style={{ fontSize: 12, color: 'var(--pc-text-secondary)', lineHeight: 1.55 }}>AI не рисует live там, где sandbox, не выпускает деньги сам и не подменяет юридический или банковый контур.</div>
          </div>
        </div>
      </section>

      <section style={{ background: 'var(--pc-shell-surface)', border: '1px solid var(--pc-border)', borderRadius: 22, padding: 18, boxShadow: 'var(--pc-shadow-sm)', display: 'grid', gap: 14 }}>
        <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--pc-text-primary)' }}>Текущий запрос</div>
        <div style={{ padding: '14px 16px', borderRadius: 18, background: 'var(--pc-shell-surface-soft)', border: '1px solid var(--pc-border)', display: 'grid', gap: 12 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 800, color: 'var(--pc-text-primary)' }}>
            <Search size={16} strokeWidth={2.1} /> {question}
          </div>
          <div style={{ fontSize: 15, fontWeight: 900, color: 'var(--pc-text-primary)' }}>{response.headline}</div>
          <div style={{ fontSize: 13, color: 'var(--pc-text-secondary)', lineHeight: 1.7 }}>{response.summary}</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {response.sources.map((item) => (
              <span key={item} style={{ display: 'inline-flex', alignItems: 'center', padding: '7px 10px', borderRadius: 999, background: 'var(--pc-bg-elevated)', border: '1px solid var(--pc-border)', fontSize: 11, fontWeight: 800, color: 'var(--pc-text-primary)' }}>{item}</span>
            ))}
          </div>
          <div style={{ display: 'grid', gap: 8 }}>
            {response.steps.map((item, index) => (
              <div key={item} style={{ display: 'grid', gridTemplateColumns: '28px minmax(0, 1fr)', gap: 10, alignItems: 'start' }}>
                <div style={{ width: 28, height: 28, borderRadius: 999, display: 'grid', placeItems: 'center', background: 'var(--pc-accent-bg)', border: '1px solid var(--pc-accent-border)', color: 'var(--pc-accent)', fontSize: 12, fontWeight: 900 }}>{index + 1}</div>
                <div style={{ fontSize: 13, color: 'var(--pc-text-secondary)', lineHeight: 1.6 }}>{item}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
        <section style={{ background: 'var(--pc-shell-surface)', border: '1px solid var(--pc-border)', borderRadius: 22, padding: 18, boxShadow: 'var(--pc-shadow-sm)', display: 'grid', gap: 12 }}>
          <div style={{ fontSize: 16, fontWeight: 900, color: 'var(--pc-text-primary)' }}>Что AI реально делает</div>
          <div style={{ display: 'grid', gap: 8 }}>
            {config.scopes.map((item) => (
              <div key={item} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '10px 12px', borderRadius: 14, background: 'var(--pc-shell-surface-soft)', border: '1px solid var(--pc-border)' }}>
                <FileCheck2 size={16} strokeWidth={2.1} color='var(--pc-accent)' />
                <div style={{ fontSize: 13, color: 'var(--pc-text-secondary)' }}>{item}</div>
              </div>
            ))}
          </div>
        </section>

        <section style={{ background: 'var(--pc-shell-surface)', border: '1px solid var(--pc-border)', borderRadius: 22, padding: 18, boxShadow: 'var(--pc-shadow-sm)', display: 'grid', gap: 12 }}>
          <div style={{ fontSize: 16, fontWeight: 900, color: 'var(--pc-text-primary)' }}>Что AI не обещает</div>
          <div style={{ display: 'grid', gap: 8 }}>
            {config.limits.map((item) => (
              <div key={item} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '10px 12px', borderRadius: 14, background: 'rgba(255,139,144,0.08)', border: '1px solid rgba(255,139,144,0.18)' }}>
                <AlertTriangle size={16} strokeWidth={2.1} color='var(--pc-danger)' />
                <div style={{ fontSize: 13, color: 'var(--pc-text-secondary)' }}>{item}</div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section style={{ background: 'var(--pc-shell-surface)', border: '1px solid var(--pc-border)', borderRadius: 22, padding: 18, boxShadow: 'var(--pc-shadow-sm)', display: 'grid', gap: 14 }}>
        <div style={{ fontSize: 16, fontWeight: 900, color: 'var(--pc-text-primary)' }}>Быстрые вопросы по роли</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {config.questions.map((item) => (
            <Link
              key={item}
              href={buildAiHref(from, role, item)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 999, background: 'var(--pc-bg-elevated)', border: '1px solid var(--pc-accent-border)', color: 'var(--pc-accent)', textDecoration: 'none', fontSize: 12, fontWeight: 800 }}
            >
              <Search size={14} strokeWidth={2.1} /> {item}
            </Link>
          ))}
        </div>
      </section>

      <section style={{ background: 'var(--pc-shell-surface)', border: '1px solid var(--pc-border)', borderRadius: 22, padding: 18, boxShadow: 'var(--pc-shadow-sm)', display: 'grid', gap: 14 }}>
        <div style={{ fontSize: 16, fontWeight: 900, color: 'var(--pc-text-primary)' }}>Следующие экраны по роли</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
          {config.actions.map((action) => (
            <Link key={action.href} href={action.href} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', padding: '14px 16px', borderRadius: 16, background: 'var(--pc-shell-surface-soft)', border: '1px solid var(--pc-border)', textDecoration: 'none' }}>
              <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--pc-text-primary)' }}>{action.label}</span>
              <ArrowRight size={16} strokeWidth={2.1} color='var(--pc-accent)' />
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

export default function PlatformV7CatchAllPage() {
  const pathname = usePathname();
  if (pathname.startsWith('/platform-v7/ai')) {
    return <AiWorkspace />;
  }
  return <CatchAllPage />;
}
