import { isAppLocale, type AppLocale } from '@/i18n/locale';

const copy = {
  ru: {
    home: {
      hero: {
        kicker: 'Исполнение внебиржевой зерновой сделки',
        title: 'Сделка под контролем — от условий до расчёта',
        lead: 'Участники, перевозка, приёмка, качество, документы, деньги и спор связаны одной проверяемой историей исполнения.',
        primary: 'Посмотреть сделку изнутри',
        secondary: 'Подключить организацию',
        progressAria: 'Текущий путь сделки',
        stageCounter: 'Этап 6 из 10',
        currentStage: 'Приёмка',
        nextStage: 'Далее: проверка качества',
        showAllStages: 'Показать все этапы',
      },
      preview: {
        open: 'Посмотреть полный путь сделки',
        stageCounter: 'Этап 6 из 10',
        nextPrefix: 'Далее',
      },
      perspectives: {
        title: 'Как сделку видит каждый участник',
        lead: 'Выберите роль — изменятся действия, документы, ответственность и денежный контекст.',
        more: 'Показать остальные роли',
      },
      final: {
        title: 'Посмотрите полный путь сделки для своей роли',
        primary: 'Открыть сделку изнутри',
        secondary: 'Подключить организацию',
        signInPrefix: 'Уже подключены?',
        signIn: 'Войти в рабочее место',
      },
    },
    explorer: {
      kicker: 'Публичный пример сделки',
      title: 'Сделка изнутри',
      lead: 'Выберите роль и сценарий, затем проверьте этапы, документы, деньги и риски на одном учебном примере.',
      backHome: 'На главную',
      connect: 'Подключить организацию',
      entryBadge: 'Выберите, с чего начать',
      lensLabel: 'Что посмотреть',
      roleLabel: 'Роль',
      scenarioLabel: 'Сценарий сделки',
      startGuide: 'Показать всю сделку',
      stagePrefix: 'Этап',
      stageDivider: 'из',
      showStages: 'Показать все этапы',
      hideStages: 'Скрыть этапы',
      scenarios: {
        standard: 'Без отклонений',
        partial: 'Частичная приёмка',
        dispute: 'Спорный — по качеству',
      },
    },
  },
  en: {
    home: {
      hero: {
        kicker: 'Execution of an OTC grain transaction',
        title: 'A controlled deal — from terms to settlement',
        lead: 'Participants, transport, acceptance, quality, documents, money and disputes remain connected in one verifiable execution history.',
        primary: 'View the deal from inside',
        secondary: 'Connect an organisation',
        progressAria: 'Current deal path',
        stageCounter: 'Stage 6 of 10',
        currentStage: 'Acceptance',
        nextStage: 'Next: quality inspection',
        showAllStages: 'Show all stages',
      },
      preview: {
        open: 'View the complete deal path',
        stageCounter: 'Stage 6 of 10',
        nextPrefix: 'Next',
      },
      perspectives: {
        title: 'How each participant sees the deal',
        lead: 'Choose a role to change actions, documents, responsibility and money context.',
        more: 'Show the remaining roles',
      },
      final: {
        title: 'View the complete deal path for your role',
        primary: 'Open the deal from inside',
        secondary: 'Connect an organisation',
        signInPrefix: 'Already connected?',
        signIn: 'Open your workspace',
      },
    },
    explorer: {
      kicker: 'Public example deal',
      title: 'Deal from inside',
      lead: 'Choose a role and scenario, then review stages, documents, money and risks in one illustrative deal.',
      backHome: 'Back to home',
      connect: 'Connect an organisation',
      entryBadge: 'Choose where to start',
      lensLabel: 'What to review',
      roleLabel: 'Role',
      scenarioLabel: 'Deal scenario',
      startGuide: 'Play the complete deal',
      stagePrefix: 'Stage',
      stageDivider: 'of',
      showStages: 'Show all stages',
      hideStages: 'Hide stages',
      scenarios: {
        standard: 'No deviations',
        partial: 'Partial acceptance',
        dispute: 'Quality dispute',
      },
    },
  },
  zh: {
    home: {
      hero: {
        kicker: '场外粮食交易履约',
        title: '从交易条件到结算，全程受控',
        lead: '参与方、运输、收货、质量、文件、资金与争议统一在一条可核验的履约记录中。',
        primary: '从内部查看交易',
        secondary: '接入组织',
        progressAria: '当前交易路径',
        stageCounter: '第 6 阶段，共 10 阶段',
        currentStage: '收货',
        nextStage: '下一步：质量检验',
        showAllStages: '查看全部阶段',
      },
      preview: {
        open: '查看完整交易路径',
        stageCounter: '第 6 阶段，共 10 阶段',
        nextPrefix: '下一步',
      },
      perspectives: {
        title: '各参与方如何查看交易',
        lead: '选择角色后，操作、文件、责任和资金上下文会随之变化。',
        more: '查看其他角色',
      },
      final: {
        title: '查看适合你角色的完整交易路径',
        primary: '从内部打开交易',
        secondary: '接入组织',
        signInPrefix: '已接入？',
        signIn: '进入工作区',
      },
    },
    explorer: {
      kicker: '公开交易示例',
      title: '交易内部视图',
      lead: '选择角色和场景，然后在同一示例中查看阶段、文件、资金和风险。',
      backHome: '返回首页',
      connect: '接入组织',
      entryBadge: '选择开始方式',
      lensLabel: '查看内容',
      roleLabel: '角色',
      scenarioLabel: '交易场景',
      startGuide: '播放完整交易',
      stagePrefix: '第',
      stageDivider: '阶段，共',
      showStages: '查看全部阶段',
      hideStages: '收起阶段',
      scenarios: {
        standard: '无偏差',
        partial: '部分收货',
        dispute: '质量争议',
      },
    },
  },
} as const;

export type PublicProductExperienceV4Copy = (typeof copy)[AppLocale];

export function getPublicProductExperienceV4Copy(locale: string): PublicProductExperienceV4Copy {
  const resolved: AppLocale = isAppLocale(locale) ? locale : 'ru';
  return copy[resolved];
}
