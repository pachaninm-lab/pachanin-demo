import type { Metadata } from 'next';
import { StatusChip } from '@pc/design-system-v8';
import { Activity, AlertTriangle, Bot, Clock3, Database, Gauge, ShieldCheck, Wrench } from 'lucide-react';
import { getLocale, getTranslations } from 'next-intl/server';
import { PublicLocaleLink } from '@/components/platform-v7/PublicLocaleLink';
import { PublicSiteHeader } from '@/components/platform-v7/PublicSiteHeader';
import { getPublicOperationalMaturity } from '@/lib/platform-v7/public-operational-maturity';

export const metadata: Metadata = {
  title: 'Статус сервиса — Прозрачная Цена',
  description: 'Публичная страница эксплуатационного статуса и зрелости платформы «Прозрачная Цена».',
  robots: { index: true, follow: true },
};

export default async function PlatformV7StatusPage() {
  const t = await getTranslations('publicEntry');
  const locale = await getLocale();
  const localeKey = locale === 'en' || locale === 'zh' ? locale : 'ru';
  const maturity = getPublicOperationalMaturity(locale);
  const copy = {
    ru: {
      title: 'Статус сервиса',
      subtitle: 'Эксплуатационная зрелость, ограничения и обязательства показываются отдельно от продуктовых функций.',
      updated: 'Срез статуса',
      public: 'Публичный production-контур',
      operational: 'Работает в ограниченном контуре',
      notAttested: 'Нет заявления о полной промышленной аттестации',
      service: 'Область',
      state: 'Состояние',
      note: 'Пояснение',
      core: 'Публичный веб-контур',
      coreState: 'Работает',
      coreNote: 'Главная, публичные сценарии и регистрация доступны в заявленном контуре.',
      aiState: 'Ограниченный режим',
      aiNote: 'Публичный контур работает без доступа к закрытым данным организаций; модельные ответы ограничены политиками и доступностью проверяемых источников.',
      data: 'Государственные и внешние данные',
      dataState: 'Зависит от подключения',
      dataNote: 'Источники показываются подключёнными только при наличии официального доступа и подтверждённого обмена.',
      sla: 'SLA',
      slaState: 'По договору',
      slaNote: 'Публичное универсальное SLA не заявляется. Параметры доступности и поддержки закрепляются в договоре.',
      incident: 'Инциденты и изменения',
      incidentText: 'Ограничения, деградация и плановые работы публикуются после подтверждения влияния на пользовательский контур.',
      contact: 'Сообщить о проблеме',
      trust: 'Открыть Trust Center',
      home: 'На главную',
    },
    en: {
      title: 'Service status',
      subtitle: 'Operational maturity, limitations and commitments are shown separately from product capabilities.',
      updated: 'Status snapshot',
      public: 'Public production contour',
      operational: 'Operating in a limited contour',
      notAttested: 'No claim of full industrial attestation',
      service: 'Area', state: 'State', note: 'Explanation',
      core: 'Public web contour', coreState: 'Operating', coreNote: 'Homepage, public scenarios and registration are available in the stated contour.',
      aiState: 'Limited mode', aiNote: 'The public contour has no access to private organisation data; model answers are limited by policies and available verifiable sources.',
      data: 'Government and external data', dataState: 'Connection-dependent', dataNote: 'Sources are shown as connected only with official access and confirmed exchange.',
      sla: 'SLA', slaState: 'Contractual', slaNote: 'No universal public SLA is claimed. Availability and support parameters are fixed in the contract.',
      incident: 'Incidents and changes', incidentText: 'Limitations, degradation and scheduled work are published after their impact on the user contour is confirmed.',
      contact: 'Report an issue', trust: 'Open Trust Center', home: 'Home',
    },
    zh: {
      title: '服务状态',
      subtitle: '运营成熟度、限制和承诺与产品功能分开显示。',
      updated: '状态快照', public: '公开生产链路', operational: '在有限链路内运行', notAttested: '不声明已完成完整工业认证',
      service: '范围', state: '状态', note: '说明',
      core: '公开 Web 链路', coreState: '运行中', coreNote: '主页、公开场景和注册在声明的链路内可用。',
      aiState: '有限模式', aiNote: '公开链路不访问机构私有数据；模型回答受政策和可验证来源可用性的限制。',
      data: '政府与外部数据', dataState: '取决于连接', dataNote: '只有在获得官方访问并确认交换后，来源才显示为已连接。',
      sla: 'SLA', slaState: '按合同', slaNote: '不声明统一公开 SLA。可用性和支持参数在合同中确定。',
      incident: '事件与变更', incidentText: '限制、降级和计划工作在确认对用户链路的影响后发布。',
      contact: '报告问题', trust: '打开信任中心', home: '首页',
    },
  }[localeKey];

  const rows = [
    { icon: Gauge, title: copy.core, state: copy.coreState, note: copy.coreNote, tone: 'ready' },
    { icon: Bot, title: localeKey === 'ru' ? 'Гекта' : 'Gekta', state: copy.aiState, note: copy.aiNote, tone: 'limited' },
    { icon: Database, title: copy.data, state: copy.dataState, note: copy.dataNote, tone: 'limited' },
    { icon: Clock3, title: copy.sla, state: copy.slaState, note: copy.slaNote, tone: 'neutral' },
  ] as const;

  return (
    <main id="main-content" className="p7-static-page p7-status-page" data-testid="platform-v7-status-authority">
      <a className="pc-skip-link" href="#p7-status-title">{t('chrome.skipToContent')}</a>
      <PublicSiteHeader
        ariaLabel={t('chrome.language')}
        brandHomeLabel={copy.home}
        navLabel={t('chrome.language')}
        menuLabel={t('chrome.language')}
        actions={<a href="/platform-v7/support">{copy.contact}</a>}
        localeControl={<PublicLocaleLink />}
      />

      <div className="p7-static-page-inner p7-status-inner">
        <section className="p7-static-hero p7-status-hero" aria-labelledby="p7-status-title">
          <span className="p7-static-eyebrow"><Activity size={16} />{copy.public}</span>
          <h1 id="p7-status-title">{copy.title}</h1>
          <p>{copy.subtitle}</p>
          <div className="p7-status-snapshot" role="status">
            <strong><ShieldCheck size={18} />{copy.operational}</strong>
            <span>{copy.notAttested}</span>
            <small>{copy.updated}: {new Date().toISOString().slice(0, 10)}</small>
          </div>
        </section>

        <section className="p7-status-maturity" aria-label={maturity.cardLabel}>
          <div className="p7-status-maturity-head">
            <Wrench size={19} aria-hidden="true" />
            <div>
              <strong>{maturity.cardLabel}</strong>
              <span>{maturity.status}</span>
            </div>
          </div>
          <p>{maturity.summary}</p>
          <ul>
            {maturity.points.map((point) => <li key={point}>{point}</li>)}
          </ul>
          <a href={maturity.ctaHref}>{maturity.cta}</a>
        </section>

        <section className="p7-status-grid" aria-label={copy.service}>
          {rows.map(({ icon: Icon, title, state, note, tone }) => (
            <article key={title} data-tone={tone}>
              <div className="p7-status-card-head">
                <Icon size={19} aria-hidden="true" />
                <h2>{title}</h2>
              </div>
              <StatusChip tone={tone === 'ready' ? 'success' : 'warning'}>{state}</StatusChip>
              <p>{note}</p>
            </article>
          ))}
        </section>

        <section className="p7-status-incidents">
          <AlertTriangle size={20} aria-hidden="true" />
          <div><h2>{copy.incident}</h2><p>{copy.incidentText}</p></div>
        </section>

        <section className="p7-static-actions">
          <a href="/platform-v7/support" className="p7-static-primary">{copy.contact}</a>
          <a href="/platform-v7/trust">{copy.trust}</a>
          <a href="/platform-v7">{copy.home}</a>
        </section>
      </div>
    </main>
  );
}
