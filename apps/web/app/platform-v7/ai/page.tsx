'use client';

import * as React from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
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
  actions: Array<{ label: string; href: string; note: string }>;
  scopes: string[];
  limits: string[];
};

type SuggestedAction = { label: string; href: string; note: string };

type ResponseModel = {
  headline: string;
  summary: string;
  sources: string[];
  steps: string[];
  actions: SuggestedAction[];
};

const ROLE_AI: Record<PlatformRole, RoleAiConfig> = {
  operator: {
    title: 'AI-оператор исполнения',
    subtitle: 'Блокеры, владелец шага, документы, деньги под риском и ручные эскалации.',
    promise: 'Даёт следующий подтверждённый ход по экрану без fake-live обещаний.',
    icon: LayoutDashboard,
    questions: ['Почему выпуск заблокирован?', 'Кто держит следующий шаг?', 'Каких документов не хватает?', 'Куда идти дальше?'],
    actions: [
      { label: 'Control Tower', href: '/platform-v7/control-tower', note: 'Открыть центр управления' },
      { label: 'Сделки', href: '/platform-v7/deals', note: 'Перейти в реестр сделок' },
      { label: 'Споры', href: '/platform-v7/disputes', note: 'Открыть спорный контур' },
    ],
    scopes: ['owner / blocker / next action', 'docs completeness', 'hold / release / disputes'],
    limits: ['не рисует live вместо sandbox', 'не выпускает деньги сам', 'не закрывает спор без регламента'],
  },
  buyer: {
    title: 'AI-помощник покупателя',
    subtitle: 'Качество, приёмка, резерв денег и путь до расчёта.',
    promise: 'Сводит цену риска, качество партии и шаг до выпуска денег.',
    icon: Banknote,
    questions: ['Почему деньги стоят?', 'Что по качественной дельте?', 'Каких документов не хватает?', 'Куда идти дальше?'],
    actions: [
      { label: 'Кабинет покупателя', href: '/platform-v7/buyer', note: 'Открыть контекст покупателя' },
      { label: 'Сделки', href: '/platform-v7/deals', note: 'Открыть сделки покупателя' },
      { label: 'Банк', href: '/platform-v7/bank', note: 'Проверить резерв и release' },
    ],
    scopes: ['резерв / release', 'качество и приёмка', 'обязательные документы'],
    limits: ['не меняет результат лаборатории', 'не подменяет банковое решение', 'не подтверждает чужие документы'],
  },
  seller: {
    title: 'AI-помощник продавца',
    subtitle: 'Документы продавца, удержания, REVIEW и путь к выплате.',
    promise: 'Показывает, что мешает получить деньги и какой пакет закрыть первым.',
    icon: Wheat,
    questions: ['Почему лот в REVIEW?', 'Каких документов не хватает?', 'Что нужно для выпуска денег?', 'Куда идти дальше?'],
    actions: [
      { label: 'Кабинет продавца', href: '/platform-v7/seller', note: 'Открыть выплаты и пакет продавца' },
      { label: 'Лоты', href: '/platform-v7/lots', note: 'Открыть текущие лоты' },
      { label: 'Сделки', href: '/platform-v7/deals', note: 'Открыть сделки продавца' },
    ],
    scopes: ['документы продавца', 'удержания и причины стопа', 'следующий подтверждённый шаг'],
    limits: ['не обещает моментальную оплату', 'не меняет условия задним числом', 'не заменяет ЭДО и КЭП'],
  },
  logistics: {
    title: 'AI-диспетчер логистики',
    subtitle: 'Рейс, ETA, отклонения маршрута, окно разгрузки и транспортные документы.',
    promise: 'Связывает рейс с деньгами и спорностью сделки.',
    icon: Truck,
    questions: ['Где главный логистический риск?', 'Что по ETA и окну приёмки?', 'Какие транспортные документы обязательны?', 'Куда идти дальше?'],
    actions: [
      { label: 'Логистика', href: '/platform-v7/logistics', note: 'Открыть диспетчерскую' },
      { label: 'Водитель', href: '/platform-v7/driver', note: 'Перейти в маршрут водителя' },
      { label: 'Приёмка', href: '/platform-v7/elevator', note: 'Открыть окно разгрузки' },
    ],
    scopes: ['маршрут / ETA / arrival', 'транспортные документы', 'связь с hold / release'],
    limits: ['не рисует fake-live GPS', 'не закрывает приёмку без подтверждения', 'не выпускает деньги без downstream шагов'],
  },
  driver: {
    title: 'AI-помощник водителя',
    subtitle: 'Маршрут, прибытие, фотофиксация и офлайн-очередь событий.',
    promise: 'Даёт один понятный следующий шаг по рейсу.',
    icon: User,
    questions: ['Что делать после прибытия?', 'Какие события надо зафиксировать?', 'Почему рейс держит следующий шаг?', 'Куда идти дальше?'],
    actions: [
      { label: 'Маршрут', href: '/platform-v7/driver', note: 'Открыть маршрут' },
      { label: 'Логистика', href: '/platform-v7/logistics', note: 'Открыть диспетчерскую' },
      { label: 'Сделка', href: '/platform-v7/deals/DL-9103', note: 'Открыть связанную сделку' },
    ],
    scopes: ['arrival / unload / queue', 'обязательные фото и чеки', 'офлайн-события'],
    limits: ['не требует лишних полей', 'не меняет рейс без подтверждения', 'не даёт финансовых обещаний'],
  },
  surveyor: {
    title: 'AI-помощник сюрвейера',
    subtitle: 'Пакет доказательств, фото, акт осмотра и спорный контур.',
    promise: 'Подсказывает, чего не хватает dispute pack.',
    icon: Search,
    questions: ['Какой пакет доказательств обязателен?', 'Что приложить к спору?', 'Кто владелец кейса сейчас?', 'Куда идти дальше?'],
    actions: [
      { label: 'Назначения', href: '/platform-v7/surveyor', note: 'Открыть текущие назначения' },
      { label: 'Споры', href: '/platform-v7/disputes', note: 'Открыть контур спора' },
    ],
    scopes: ['доказательства / фото / видео', 'следующий владелец', 'денежное влияние'],
    limits: ['не решает спор вместо арбитра', 'не меняет цену сам', 'не редактирует чужие факты'],
  },
  elevator: {
    title: 'AI-помощник приёмки',
    subtitle: 'Окна разгрузки, очередь, вес, акт приёмки и готовность к лаборатории.',
    promise: 'Подсказывает, какой факт должен быть зафиксирован сейчас.',
    icon: Compass,
    questions: ['Что подтвердить на приёмке?', 'Какие акты обязательны?', 'Что по очереди?', 'Куда идти дальше?'],
    actions: [
      { label: 'Приёмка', href: '/platform-v7/elevator', note: 'Открыть контур разгрузки' },
      { label: 'Лаборатория', href: '/platform-v7/lab', note: 'Перейти к пробе и качеству' },
      { label: 'Сделки', href: '/platform-v7/deals', note: 'Открыть сделки приёмки' },
    ],
    scopes: ['въезд / очередь / выгрузка', 'вес и акты', 'переход в лабораторию'],
    limits: ['не подтверждает деньги', 'не меняет коммерческие условия', 'не скрывает расхождения по весу'],
  },
  lab: {
    title: 'AI-помощник лаборатории',
    subtitle: 'Проба, протокол, повторный анализ и качественная дельта.',
    promise: 'Связывает результат анализа со спором или выпуском денег.',
    icon: FlaskConical,
    questions: ['Что по качественной дельте?', 'Нужен ли повторный анализ?', 'Что передать в спор?', 'Куда идти дальше?'],
    actions: [
      { label: 'Лаборатория', href: '/platform-v7/lab', note: 'Открыть пробы и протоколы' },
      { label: 'Сделки', href: '/platform-v7/deals', note: 'Открыть сделки с качеством' },
      { label: 'Споры', href: '/platform-v7/disputes', note: 'Перейти в спорный контур' },
    ],
    scopes: ['проба / протокол / версия', 'повторный анализ', 'влияние на расчёт'],
    limits: ['не выпускает деньги сам', 'не закрывает спор без процедуры', 'не подменяет независимый осмотр'],
  },
  bank: {
    title: 'AI-помощник банка',
    subtitle: 'Резерв, hold, callbacks, release и конфликт статусов.',
    promise: 'Показывает, какой банковый шаг допустим следующим.',
    icon: Landmark,
    questions: ['Почему hold не снят?', 'Что нужно для release?', 'Есть ли конфликт callback?', 'Куда идти дальше?'],
    actions: [
      { label: 'Банковый контур', href: '/platform-v7/bank', note: 'Открыть reserve / hold / release' },
      { label: 'Сделки', href: '/platform-v7/deals', note: 'Открыть сделки с резервом' },
      { label: 'Удержания', href: '/platform-v7/disputes', note: 'Открыть спорные удержания' },
    ],
    scopes: ['reserve / hold / release', 'callbacks и mismatch', 'документы для банка'],
    limits: ['не подменяет банковую систему', 'не даёт фальшивый live-proof', 'не проводит платёж без правил'],
  },
  arbitrator: {
    title: 'AI-помощник арбитра',
    subtitle: 'Основание спора, пакет доказательств, сумма влияния и следующий owner.',
    promise: 'Собирает dispute pack в одну картину.',
    icon: Gavel,
    questions: ['Что входит в dispute pack?', 'Каких доказательств не хватает?', 'Кто владелец спора?', 'Что нужно для закрытия спора?'],
    actions: [
      { label: 'Арбитр', href: '/platform-v7/arbitrator', note: 'Открыть арбитражный контур' },
      { label: 'Споры', href: '/platform-v7/disputes', note: 'Открыть реестр споров' },
      { label: 'Сделки', href: '/platform-v7/deals', note: 'Открыть сделки со спором' },
    ],
    scopes: ['основание и сумма спора', 'evidence chain', 'следующий owner / SLA'],
    limits: ['не обещает автоматическое решение', 'не меняет документы задним числом', 'не скрывает открытые блокеры'],
  },
  compliance: {
    title: 'AI-помощник комплаенса',
    subtitle: 'Допуск, полномочия, stop-флаги и readiness обязательного пакета.',
    promise: 'Помогает не открыть риск раньше времени.',
    icon: ShieldCheck,
    questions: ['Что мешает допуску?', 'Каких полномочий не хватает?', 'Где стоп-флаг?', 'Куда идти дальше?'],
    actions: [
      { label: 'Комплаенс', href: '/platform-v7/compliance', note: 'Открыть допуск и стоп-флаги' },
      { label: 'Интеграции', href: '/platform-v7/connectors', note: 'Открыть readiness интеграций' },
      { label: 'Сделки', href: '/platform-v7/deals', note: 'Открыть сделки под контролем' },
    ],
    scopes: ['допуск и полномочия', 'обязательные документы', 'граница зрелости'],
    limits: ['не выдаёт sandbox за live', 'не заменяет юриста по конкретному кейсу', 'не закрывает AML/KYC за банк'],
  },
  executive: {
    title: 'AI-помощник руководителя',
    subtitle: 'Деньги под риском, топ-блокеры, срыв пилота и прогресс контура.',
    promise: 'Собирает управленческую картину без воды.',
    icon: Sparkles,
    questions: ['Где главный риск пилота?', 'Какие деньги под риском?', 'Что мешает следующему шагу?', 'Куда идти дальше?'],
    actions: [
      { label: 'Сводка', href: '/platform-v7/executive', note: 'Открыть сводку руководителя' },
      { label: 'Control Tower', href: '/platform-v7/control-tower', note: 'Открыть операционный центр' },
      { label: 'Банк', href: '/platform-v7/bank', note: 'Открыть деньги и hold' },
    ],
    scopes: ['pilot health', 'деньги под риском', 'следующий критический шаг'],
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

function dealIdFromPath(from: string) {
  const match = from.match(/\/deals\/([^/?#]+)/);
  return match?.[1] ?? null;
}

function disputeIdFromPath(from: string) {
  const match = from.match(/\/disputes\/([^/?#]+)/);
  return match?.[1] ?? null;
}

function inferQuery(question: string | null, role: PlatformRole, from: string) {
  return question?.trim() || ROLE_AI[role].questions[0] || `Что делать дальше на экране ${screenLabel(from)}?`;
}

function buildSuggestedActions(role: PlatformRole, question: string, from: string): SuggestedAction[] {
  const lower = question.toLowerCase();
  const config = ROLE_AI[role] || ROLE_AI.operator;
  const dealId = dealIdFromPath(from);
  const disputeId = disputeIdFromPath(from);

  if ((lower.includes('документ') || lower.includes('пакет')) && dealId) {
    return [
      { label: `Документы ${dealId}`, href: `/platform-v7/deals/${dealId}/documents`, note: 'Открыть обязательный пакет по сделке' },
      { label: `Review ${dealId}`, href: `/platform-v7/deals/${dealId}/review`, note: 'Проверить blocker и качество по сделке' },
      { label: 'Документы', href: '/platform-v7/documents', note: 'Открыть общий контур документов' },
    ];
  }

  if ((lower.includes('выпуск') || lower.includes('release') || lower.includes('деньг') || lower.includes('hold')) && dealId) {
    return [
      { label: `Сделка ${dealId}`, href: `/platform-v7/deals/${dealId}`, note: 'Открыть owner, blocker и денежный статус' },
      { label: 'Банк', href: '/platform-v7/bank', note: 'Проверить reserve / hold / release' },
      { label: disputeId ? `Спор ${disputeId}` : 'Споры', href: disputeId ? `/platform-v7/disputes/${disputeId}` : '/platform-v7/disputes', note: 'Открыть спор или удержание' },
    ];
  }

  if ((lower.includes('кто ') || lower.includes('владел')) && dealId) {
    return [
      { label: `Сделка ${dealId}`, href: `/platform-v7/deals/${dealId}`, note: 'Открыть текущего owner и blocker' },
      { label: 'Control Tower', href: '/platform-v7/control-tower', note: 'Посмотреть очередь и эскалации' },
      { label: 'Споры', href: '/platform-v7/disputes', note: 'Проверить, не держит ли шаг спор' },
    ];
  }

  if (from.includes('/driver') || role === 'driver') {
    return [
      { label: 'Маршрут', href: '/platform-v7/driver', note: 'Вернуться к текущему рейсу' },
      { label: 'Логистика', href: '/platform-v7/logistics', note: 'Открыть диспетчерскую и ETA' },
      { label: 'Приёмка', href: '/platform-v7/elevator', note: 'Открыть окно разгрузки' },
    ];
  }

  if (from.includes('/logistics') || role === 'logistics') {
    return [
      { label: 'Логистика', href: '/platform-v7/logistics', note: 'Открыть рейсы и отклонения' },
      { label: 'Водитель', href: '/platform-v7/driver', note: 'Перейти к полевому контуру' },
      { label: 'Приёмка', href: '/platform-v7/elevator', note: 'Открыть окно приёмки' },
    ];
  }

  if (from.includes('/bank') || role === 'bank') {
    return [
      { label: 'Банк', href: '/platform-v7/bank', note: 'Открыть reserve / hold / release' },
      { label: 'Сделки', href: '/platform-v7/deals', note: 'Проверить сделки, влияющие на деньги' },
      { label: 'Споры', href: '/platform-v7/disputes', note: 'Проверить спорные удержания' },
    ];
  }

  if (from.includes('/disputes') || role === 'arbitrator' || role === 'surveyor') {
    return [
      { label: disputeId ? `Спор ${disputeId}` : 'Споры', href: disputeId ? `/platform-v7/disputes/${disputeId}` : '/platform-v7/disputes', note: 'Открыть dispute pack и owner' },
      { label: 'Арбитр', href: '/platform-v7/arbitrator', note: 'Перейти в арбитражный контур' },
      { label: 'Сделки', href: '/platform-v7/deals', note: 'Проверить связанную сделку' },
    ];
  }

  return config.actions;
}

function buildResponse(role: PlatformRole, question: string, from: string): ResponseModel {
  const lower = question.toLowerCase();
  const roleLabel = ROLE_LABELS[role];
  const screen = screenLabel(from);
  const actions = buildSuggestedActions(role, question, from);

  if (lower.includes('документ') || lower.includes('пакет')) {
    return {
      headline: 'Фокус на полноте пакета',
      summary: `AI в роли «${roleLabel}» сначала проверяет обязательный пакет для экрана «${screen}», затем ищет, какой документ держит следующий переход и влияет ли это на деньги или спор.`,
      sources: ['document completeness', 'owner / next action', 'bank / dispute dependency'],
      steps: ['Открой обязательный пакет по объекту.', 'Сними разрыв: кто должен загрузить или подписать следующий документ.', 'Проверь, откроет ли это release или только снимет REVIEW.'],
      actions,
    };
  }

  if (lower.includes('выпуск') || lower.includes('release') || lower.includes('деньг') || lower.includes('hold')) {
    return {
      headline: 'Фокус на деньгах и блокерах',
      summary: `AI проверяет reserve / hold / release, затем спорность и полноту документов. На экране «${screen}» он не обещает выпуск, если контур ещё держит hold или manual review.`,
      sources: ['reserve / hold / release', 'callback / mismatch', 'docs / quality / dispute'],
      steps: ['Проверь, есть ли hold или manual blocker.', 'Сверь, закрыт ли quality / dispute контур.', 'Переходи в банковый или спорный экран, который меняет статус, а не просто показывает его.'],
      actions,
    };
  }

  if (lower.includes('кто ') || lower.includes('владел')) {
    return {
      headline: 'Фокус на owner и SLA',
      summary: `AI в роли «${roleLabel}» отвечает через owner текущего шага: кто держит переход, почему именно он и что должно произойти до передачи следующему владельцу.`,
      sources: ['owner / SLA / next action', 'current blocker', 'handover logic'],
      steps: ['Сначала открой текущего owner.', 'Потом проверь, что именно он должен подтвердить.', 'Только после этого переходи к деньгам, спору или документам.'],
      actions,
    };
  }

  if (lower.includes('куда') || lower.includes('дальше') || lower.includes('что делать')) {
    return {
      headline: 'Фокус на следующем ходе',
      summary: `AI строит маршрут для роли «${roleLabel}»: что открыто на экране «${screen}», какой шаг следующий и в какой экран надо перейти сразу после него.`,
      sources: ['current screen context', 'next action', 'allowed route by role'],
      steps: ['Открой самый близкий к money / dispute / docs экран.', 'Сними первый подтверждаемый blocker.', 'Вернись в сделку и проверь, изменился ли owner следующего шага.'],
      actions,
    };
  }

  return {
    headline: 'Фокус на текущем экране и роли',
    summary: `AI даёт ответ только в контексте роли «${roleLabel}» и экрана «${screen}»: что видно сейчас, какой blocker главный и какой следующий ход даст движение без потери доказательности.`,
    sources: ['screen context', 'role scope', 'blocker / next action / money impact'],
    steps: ['Уточни главный blocker.', 'Спроси, кто следующий owner.', 'Перейди в экран, который меняет статус, а не просто показывает его.'],
    actions,
  };
}

export default function PlatformV7AiPage() {
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
                <Sparkles size={14} strokeWidth={2.1} /> AI по роли
              </div>
              <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--pc-text-primary)' }}>{config.title}</div>
              <div style={{ fontSize: 13, color: 'var(--pc-text-secondary)', lineHeight: 1.6, maxWidth: 920 }}>{config.subtitle}</div>
            </div>
          </div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 999, background: 'var(--pc-accent-bg)', border: '1px solid var(--pc-accent-border)', color: 'var(--pc-accent-strong)', fontSize: 12, fontWeight: 800 }}>
            {ROLE_LABELS[role]} · {screenLabel(from)}
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

      <section style={{ background: 'var(--pc-shell-surface)', border: '1px solid var(--pc-border)', borderRadius: 22, padding: 18, boxShadow: 'var(--pc-shadow-sm)', display: 'grid', gap: 14 }}>
        <div style={{ fontSize: 16, fontWeight: 900, color: 'var(--pc-text-primary)' }}>Куда перейти сейчас</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
          {response.actions.map((action) => (
            <Link key={`${action.href}-${action.label}`} href={action.href} style={{ display: 'grid', gap: 6, padding: '14px 16px', borderRadius: 16, background: 'var(--pc-shell-surface-soft)', border: '1px solid var(--pc-border)', textDecoration: 'none' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
                <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--pc-text-primary)' }}>{action.label}</span>
                <ArrowRight size={16} strokeWidth={2.1} color='var(--pc-accent)' />
              </div>
              <span style={{ fontSize: 12, lineHeight: 1.55, color: 'var(--pc-text-secondary)' }}>{action.note}</span>
            </Link>
          ))}
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
        <div style={{ fontSize: 16, fontWeight: 900, color: 'var(--pc-text-primary)' }}>Быстрые вопросы</div>
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
    </div>
  );
}
