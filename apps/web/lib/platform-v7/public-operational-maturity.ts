type LocaleKey = 'ru' | 'en' | 'zh';

export type PublicOperationalMaturity = Readonly<{
  cardLabel: string;
  status: string;
  summary: string;
  points: readonly string[];
  cta: string;
  ctaHref: '/platform-v7/trust';
}>;

const PUBLIC_OPERATIONAL_MATURITY = {
  ru: {
    cardLabel: 'Эксплуатационная зрелость',
    status: 'Ограниченный production-контур',
    summary:
      'Публичные функции работают в заявленном контуре. Полная промышленная аттестация, универсальное SLA и подключение внешних систем подтверждаются отдельно.',
    points: [
      'Доступность публичного веб-контура проверяется отдельно от готовности закрытых рабочих пространств.',
      'Гекта в публичном режиме не получает закрытые данные организаций и не выполняет критические действия.',
      'Государственные, банковские и иные внешние источники считаются подключёнными только после подтверждённого обмена.',
    ],
    cta: 'Проверить границы доверия',
    ctaHref: '/platform-v7/trust',
  },
  en: {
    cardLabel: 'Operational maturity',
    status: 'Limited production contour',
    summary:
      'Public capabilities operate within the stated contour. Full industrial attestation, a universal SLA and external-system connectivity are verified separately.',
    points: [
      'Public web availability is assessed separately from readiness of private workspaces.',
      'In public mode, Gekta receives no private organisation data and performs no critical action.',
      'Government, banking and other external sources are treated as connected only after confirmed data exchange.',
    ],
    cta: 'Review trust boundaries',
    ctaHref: '/platform-v7/trust',
  },
  zh: {
    cardLabel: '运行成熟度',
    status: '有限生产链路',
    summary: '公开功能在声明的链路内运行。完整工业认证、统一 SLA 以及外部系统连接均需单独验证。',
    points: [
      '公开 Web 链路的可用性与私有工作区的就绪状态分开评估。',
      '在公开模式下，Gekta 不接收机构私有数据，也不执行关键操作。',
      '政府、银行及其他外部来源仅在确认数据交换后才视为已连接。',
    ],
    cta: '查看信任边界',
    ctaHref: '/platform-v7/trust',
  },
} as const satisfies Readonly<Record<LocaleKey, PublicOperationalMaturity>>;

function normalizeLocale(locale: string | null | undefined): LocaleKey {
  const normalized = String(locale ?? '').trim().toLowerCase().replaceAll('_', '-');
  if (normalized === 'en' || normalized.startsWith('en-')) return 'en';
  if (normalized === 'zh' || normalized.startsWith('zh-')) return 'zh';
  return 'ru';
}

export function getPublicOperationalMaturity(
  locale: string | null | undefined,
): PublicOperationalMaturity {
  return PUBLIC_OPERATIONAL_MATURITY[normalizeLocale(locale)];
}
