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
    experimentBadge: 'Выберите удобный взгляд на Сделку',
    role: {
      title: 'Кто вы в сделке?',
      lead: 'Выберите свою роль. Это только публичная перспектива: она не назначает права и не открывает рабочий кабинет.',
      options: [
        { id: 'seller', label: 'Продавец', description: 'Лот, условия, отгрузка, документы и готовность расчёта.', perspective: 'seller', lens: 'participants' },
        { id: 'buyer', label: 'Покупатель', description: 'Предложения, условия, приёмка, качество и основание оплаты.', perspective: 'buyer', lens: 'participants' },
        { id: 'logistics', label: 'Логистика', description: 'Перевозчик, рейс, маршрут, сроки и подтверждение доставки.', perspective: 'logistics', lens: 'execution' },
        { id: 'driver', label: 'Водитель', description: 'Назначенный рейс, маршрут, документы и следующий шаг.', perspective: 'driver', lens: 'execution' },
        { id: 'storage', label: 'Элеватор / хранение', description: 'Приёмка, вес, размещение и статус партии.', perspective: 'elevator', lens: 'execution' },
        { id: 'laboratory', label: 'Лаборатория', description: 'Проба, методика, результат и протокол качества.', perspective: 'lab', lens: 'documents' },
        { id: 'surveyor', label: 'Сюрвейер', description: 'Независимая проверка количества, качества и доказательств.', perspective: 'surveyor', lens: 'risk' },
        { id: 'bank', label: 'Банк / финансы', description: 'Подтверждённые расчётные основания и финансовые блокеры.', perspective: 'bank', lens: 'money' },
        { id: 'employee', label: 'Сотрудник платформы', description: 'Операционные задачи, контроль, сроки, доказательства и эскалации в пределах реальных полномочий.', perspective: 'operator', lens: 'execution' },
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
    experimentBadge: 'Choose the most useful view of the Deal',
    role: {
      title: 'Who are you in the Deal?',
      lead: 'Choose your role. This is only a public perspective: it never assigns permissions or opens a workspace.',
      options: [
        { id: 'seller', label: 'Seller', description: 'Lot, terms, dispatch, documents and settlement readiness.', perspective: 'seller', lens: 'participants' },
        { id: 'buyer', label: 'Buyer', description: 'Offers, terms, acceptance, quality and payment basis.', perspective: 'buyer', lens: 'participants' },
        { id: 'logistics', label: 'Logistics', description: 'Carrier, trip, route, timing and delivery evidence.', perspective: 'logistics', lens: 'execution' },
        { id: 'driver', label: 'Driver', description: 'Assigned trip, route, transport documents and next action.', perspective: 'driver', lens: 'execution' },
        { id: 'storage', label: 'Elevator / storage', description: 'Acceptance, weight, placement and lot status.', perspective: 'elevator', lens: 'execution' },
        { id: 'laboratory', label: 'Laboratory', description: 'Sample, method, result and quality protocol.', perspective: 'lab', lens: 'documents' },
        { id: 'surveyor', label: 'Surveyor', description: 'Independent quantity, quality and evidence verification.', perspective: 'surveyor', lens: 'risk' },
        { id: 'bank', label: 'Bank / finance', description: 'Verified settlement grounds and financial blockers.', perspective: 'bank', lens: 'money' },
        { id: 'employee', label: 'Platform employee', description: 'Operational work, control, deadlines, evidence and escalation within real authority.', perspective: 'operator', lens: 'execution' },
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
    experimentBadge: '选择最适合你的交易视角',
    role: {
      title: '你在交易中承担什么角色？',
      lead: '请选择你的角色。这里仅改变公共视角，不会授予权限或打开工作空间。',
      options: [
        { id: 'seller', label: '卖方', description: '批次、条件、发运、文件和结算准备状态。', perspective: 'seller', lens: 'participants' },
        { id: 'buyer', label: '买方', description: '报价、条件、验收、质量和付款依据。', perspective: 'buyer', lens: 'participants' },
        { id: 'logistics', label: '物流', description: '承运方、运输任务、路线、时限和交付证明。', perspective: 'logistics', lens: 'execution' },
        { id: 'driver', label: '司机', description: '已分配运输任务、路线、运输文件和下一步。', perspective: 'driver', lens: 'execution' },
        { id: 'storage', label: '筒仓 / 仓储', description: '验收、重量、存放位置和批次状态。', perspective: 'elevator', lens: 'execution' },
        { id: 'laboratory', label: '实验室', description: '样品、检测方法、结果和质量报告。', perspective: 'lab', lens: 'documents' },
        { id: 'surveyor', label: '检验机构', description: '独立核验数量、质量和证据。', perspective: 'surveyor', lens: 'risk' },
        { id: 'bank', label: '银行 / 金融', description: '已确认的结算依据和金融阻塞项。', perspective: 'bank', lens: 'money' },
        { id: 'employee', label: '平台员工', description: '在真实权限范围内处理运营、控制、期限、证据和升级。', perspective: 'operator', lens: 'execution' },
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
