import { isAppLocale, type AppLocale } from '@/i18n/locale';
import type { TourLens, TourPerspective } from '@/lib/platform-v7/public-product-experience-state';

export type RoleEntryOption = {
  id: string;
  label: string;
  description: string;
  perspective: TourPerspective;
  lens: TourLens;
};

export type ProblemEntryOption = {
  id: string;
  label: string;
  description: string;
  lens: TourLens;
};

export type PublicProductEntryVariantsCopy = {
  experimentBadge: string;
  role: {
    title: string;
    lead: string;
    options: readonly RoleEntryOption[];
  };
  problem: {
    title: string;
    lead: string;
    options: readonly ProblemEntryOption[];
  };
  direct: string;
  back: string;
};

const copy: Record<AppLocale, PublicProductEntryVariantsCopy> = {
  ru: {
    experimentBadge: 'Выберите роль или задачу',
    role: {
      title: 'Кто вы в сделке?',
      lead: 'Выберите ближайшую задачу. Это только публичный обзор и не влияет на права доступа.',
      options: [
        { id: 'sell', label: 'Я продаю', description: 'Партия, отгрузка, документы и получение оплаты.', perspective: 'seller', lens: 'execution' },
        { id: 'buy', label: 'Я покупаю', description: 'Условия, приёмка, качество и основание расчёта.', perspective: 'buyer', lens: 'execution' },
        { id: 'execute', label: 'Я обеспечиваю исполнение', description: 'Рейс, приёмка, лаборатория и операционные блокеры.', perspective: 'operator', lens: 'execution' },
        { id: 'control', label: 'Я контролирую деньги и риски', description: 'Основания, спорные суммы, сверка и решения.', perspective: 'bank', lens: 'money' },
      ],
    },
    problem: {
      title: 'Что вы хотите контролировать?',
      lead: 'Выберите задачу — откроется нужный раздел одной и той же сделки.',
      options: [
        { id: 'progress', label: 'Где сейчас сделка', description: 'Текущий этап, ответственный, блокер и следующий переход.', lens: 'execution' },
        { id: 'evidence', label: 'Какие документы являются основанием', description: 'Событие, подпись, версия и разрешённое действие.', lens: 'documents' },
        { id: 'payment', label: 'Что разрешает денежное действие', description: 'Полный, частичный и спорный расчёт.', lens: 'money' },
        { id: 'deviation', label: 'Что происходит при отклонении', description: 'Риск, блокировка, доказательства и денежное последствие.', lens: 'risk' },
      ],
    },
    direct: 'Посмотреть сделку без выбора',
    back: 'На главную',
  },
  en: {
    experimentBadge: 'Choose a role or task',
    role: {
      title: 'Who are you in the deal?',
      lead: 'Choose the closest task. This is only a public overview and never changes access rights.',
      options: [
        { id: 'sell', label: 'I sell', description: 'Lot, dispatch, documents and payment receipt.', perspective: 'seller', lens: 'execution' },
        { id: 'buy', label: 'I buy', description: 'Terms, acceptance, quality and settlement basis.', perspective: 'buyer', lens: 'execution' },
        { id: 'execute', label: 'I ensure execution', description: 'Trip, acceptance, laboratory and operational blockers.', perspective: 'operator', lens: 'execution' },
        { id: 'control', label: 'I control money and risk', description: 'Evidence, disputed amounts, reconciliation and decisions.', perspective: 'bank', lens: 'money' },
      ],
    },
    problem: {
      title: 'What do you want to control?',
      lead: 'Choose a task to open the relevant area of the same deal.',
      options: [
        { id: 'progress', label: 'Where the deal is now', description: 'Current stage, responsible party, blocker and next transition.', lens: 'execution' },
        { id: 'evidence', label: 'Which documents form the evidence', description: 'Event, signature, version and allowed action.', lens: 'documents' },
        { id: 'payment', label: 'What permits a money action', description: 'Full, partial and disputed settlement.', lens: 'money' },
        { id: 'deviation', label: 'What happens after a deviation', description: 'Risk, block, evidence and money consequence.', lens: 'risk' },
      ],
    },
    direct: 'View the deal without choosing',
    back: 'Back to home',
  },
  zh: {
    experimentBadge: '选择角色或任务',
    role: {
      title: '你在交易中承担什么角色？',
      lead: '请选择最接近的任务。该选择仅改变公共概览，不会改变访问权限。',
      options: [
        { id: 'sell', label: '我是卖方', description: '批次、发运、文件和收款。', perspective: 'seller', lens: 'execution' },
        { id: 'buy', label: '我是买方', description: '条款、验收、质量和结算依据。', perspective: 'buyer', lens: 'execution' },
        { id: 'execute', label: '我负责履约', description: '运输、验收、实验室和运营阻塞项。', perspective: 'operator', lens: 'execution' },
        { id: 'control', label: '我控制资金与风险', description: '依据、争议金额、对账和决定。', perspective: 'bank', lens: 'money' },
      ],
    },
    problem: {
      title: '你希望控制什么？',
      lead: '请选择任务，系统将打开同一笔交易的相关内容。',
      options: [
        { id: 'progress', label: '交易当前在哪里', description: '当前阶段、责任方、阻塞项和下一步。', lens: 'execution' },
        { id: 'evidence', label: '哪些文件构成依据', description: '事件、签名、版本和允许的操作。', lens: 'documents' },
        { id: 'payment', label: '什么允许资金操作', description: '全额、部分和争议结算。', lens: 'money' },
        { id: 'deviation', label: '发生偏差后如何处理', description: '风险、阻塞、证据和资金后果。', lens: 'risk' },
      ],
    },
    direct: '不选择，直接查看交易',
    back: '返回首页',
  },
};

export function getPublicProductEntryVariantsCopy(locale: string): PublicProductEntryVariantsCopy {
  const resolved: AppLocale = isAppLocale(locale) ? locale : 'ru';
  return copy[resolved];
}
