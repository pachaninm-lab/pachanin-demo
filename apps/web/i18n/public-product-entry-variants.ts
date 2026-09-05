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
    experimentBadge: 'Быстрый вход в пример Сделки',
    role: {
      title: 'С чего вы хотите начать?',
      lead: 'Это четыре быстрых маршрута по задаче, а не список ролей и не назначение прав. Все девять публичных ролей доступны внутри Сделки.',
      options: [
        { id: 'sell', label: 'Я продаю', description: 'Товар, условия, поставка, документы и готовность расчёта.', perspective: 'seller', lens: 'participants' },
        { id: 'buy', label: 'Я покупаю', description: 'Предложения, условия, приёмка, качество и основание оплаты.', perspective: 'buyer', lens: 'participants' },
        { id: 'execute', label: 'Я обеспечиваю исполнение', description: 'Логистика, приёмка, качество, сроки и операционные блокеры.', perspective: 'operator', lens: 'execution' },
        { id: 'control', label: 'Я контролирую деньги и риски', description: 'Расчётные основания, отклонения, доказательства и финансовые блокеры.', perspective: 'bank', lens: 'money' },
      ],
    },
    problem: {
      title: 'Что вы хотите контролировать?',
      lead: 'Выберите задачу — откроется соответствующий раздел одной и той же Сделки.',
      options: [
        { id: 'progress', label: 'Где сейчас Сделка', description: 'Текущий этап, ответственный, блокер и следующий переход.', lens: 'execution' },
        { id: 'evidence', label: 'Какие документы являются основанием', description: 'Событие, подпись, версия и разрешённое действие.', lens: 'documents' },
        { id: 'payment', label: 'Что разрешает денежное действие', description: 'Полный, частичный и спорный расчёт.', lens: 'money' },
        { id: 'deviation', label: 'Что происходит при отклонении', description: 'Риск, блокировка, доказательства и денежное последствие.', lens: 'risk' },
      ],
    },
    direct: 'Открыть пример Сделки без выбора',
    back: 'Вернуться к главной',
  },
  en: {
    experimentBadge: 'Quick entry to the example Deal',
    role: {
      title: 'Where do you want to start?',
      lead: 'These are four task shortcuts, not a role list and not permission assignment. All nine public roles remain available inside the Deal.',
      options: [
        { id: 'sell', label: 'I sell', description: 'Product, terms, delivery, documents and settlement readiness.', perspective: 'seller', lens: 'participants' },
        { id: 'buy', label: 'I buy', description: 'Offers, terms, acceptance, quality and payment basis.', perspective: 'buyer', lens: 'participants' },
        { id: 'execute', label: 'I support execution', description: 'Logistics, acceptance, quality, deadlines and operational blockers.', perspective: 'operator', lens: 'execution' },
        { id: 'control', label: 'I control money and risk', description: 'Settlement grounds, deviations, evidence and financial blockers.', perspective: 'bank', lens: 'money' },
      ],
    },
    problem: {
      title: 'What do you want to control?',
      lead: 'Choose a task to open the relevant area of the same Deal.',
      options: [
        { id: 'progress', label: 'Where the Deal is now', description: 'Current stage, responsible party, blocker and next transition.', lens: 'execution' },
        { id: 'evidence', label: 'Which documents form the evidence', description: 'Event, signature, version and allowed action.', lens: 'documents' },
        { id: 'payment', label: 'What permits a money action', description: 'Full, partial and disputed settlement.', lens: 'money' },
        { id: 'deviation', label: 'What happens after a deviation', description: 'Risk, block, evidence and money consequence.', lens: 'risk' },
      ],
    },
    direct: 'Open the example Deal without choosing',
    back: 'Back to home',
  },
  zh: {
    experimentBadge: '快速进入交易示例',
    role: {
      title: '你想从哪里开始？',
      lead: '这里是四个任务快捷入口，不是角色列表，也不会授予权限。交易内部仍提供全部九个公开角色。',
      options: [
        { id: 'sell', label: '我要出售', description: '商品、条件、交付、文件和结算准备状态。', perspective: 'seller', lens: 'participants' },
        { id: 'buy', label: '我要购买', description: '报价、条件、验收、质量和付款依据。', perspective: 'buyer', lens: 'participants' },
        { id: 'execute', label: '我负责履约支持', description: '物流、验收、质量、期限和运营阻塞项。', perspective: 'operator', lens: 'execution' },
        { id: 'control', label: '我控制资金与风险', description: '结算依据、偏差、证据和金融阻塞项。', perspective: 'bank', lens: 'money' },
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
    direct: '不选择，直接打开示例交易',
    back: '返回首页',
  },
};

export function getPublicProductEntryVariantsCopy(locale: string): PublicProductEntryVariantsCopy {
  const resolved: AppLocale = isAppLocale(locale) ? locale : 'ru';
  return copy[resolved];
}