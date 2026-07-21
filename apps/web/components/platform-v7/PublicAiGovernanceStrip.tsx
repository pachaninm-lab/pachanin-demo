import { CheckCircle2, ShieldCheck, Sparkles } from 'lucide-react';

type Locale = 'ru' | 'en' | 'zh';

const COPY = {
  ru: {
    title: 'Управление ИИ и госданными',
    items: ['Ролевой доступ', 'Изоляция организаций', 'Проверяемые источники', 'Контроль актуальности', 'Подтверждение действий', 'Полный аудит'],
  },
  en: {
    title: 'AI and government data governance',
    items: ['Role-based access', 'Organisation isolation', 'Verifiable sources', 'Freshness control', 'Action confirmation', 'Complete audit'],
  },
  zh: {
    title: 'AI 与政府数据治理',
    items: ['基于角色的访问', '组织隔离', '可核验来源', '时效控制', '操作确认', '完整审计'],
  },
} as const;

export function PublicAiGovernanceStrip({ locale }: { locale: string }) {
  const localeKey: Locale = locale === 'en' || locale === 'zh' ? locale : 'ru';
  const copy = COPY[localeKey];

  return (
    <aside className='pc-public-ai-governance-strip' aria-label={copy.title}>
      <span aria-hidden='true'><Sparkles size={17} /></span>
      <strong>{copy.title}</strong>
      <ul>{copy.items.map((item) => <li key={item}><CheckCircle2 size={14} aria-hidden='true' />{item}</li>)}</ul>
      <ShieldCheck size={18} aria-hidden='true' />
    </aside>
  );
}
