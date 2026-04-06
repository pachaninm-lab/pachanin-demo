import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageFrame } from '../../../components/page-frame';
import { Breadcrumbs } from '../../../components/breadcrumbs';
import { DetailHero } from '../../../components/detail-hero';
import { ModuleHub } from '../../../components/module-hub';
import { NextStepBar } from '../../../components/next-step-bar';
import { SourceNote } from '../../../components/source-note';
import { PageAccessGuard } from '../../../components/page-access-guard';
import { EXECUTIVE_ROLES, TRADING_ROLES, FINANCE_ROLES, INTERNAL_ONLY_ROLES } from '../../../lib/route-roles';
import { readCommercialWorkspace } from '../../../lib/commercial-workspace-store';

export default async function CompanyDetailPage({ params }: { params: { id: string } }) {
  const state = await readCommercialWorkspace();
  const company = state.companies.find((item) => item.id === params.id) || null;

  if (!company) {
    return (
      <PageFrame title="Компания не найдена" subtitle="Карточка компании отсутствует в текущем рабочем контуре.">
        <div className="section-card">
          <div className="section-title">Нет данных</div>
          <div className="muted" style={{ marginTop: 8 }}>Вернись в каталог компаний и открой актуального контрагента.</div>
          <div className="cta-stack" style={{ marginTop: 16 }}>
            <Link href="/companies" className="primary-link">Каталог компаний</Link>
            <Link href="/anti-fraud" className="secondary-link">Антифрод</Link>
          </div>
        </div>
      </PageFrame>
    );
  }

  const linkedMarket = state.marketRows.filter((row) => row.buyerId === company.id || row.companyId === company.id).slice(0, 3);

  return (
    <PageAccessGuard allowedRoles={[...EXECUTIVE_ROLES, ...TRADING_ROLES, ...FINANCE_ROLES, ...INTERNAL_ONLY_ROLES]} title="Карточка компании ограничена" subtitle="Карточка company нужна торговым, финансовым и internal-ролям.">
      <PageFrame title={company.name} subtitle={`${company.role} · ${company.region}`} breadcrumbs={<Breadcrumbs items={[{ href: '/', label: 'Главная' }, { href: '/companies', label: 'Компании' }, { label: company.name }]} />}>
        <SourceNote source="commercial workspace / persisted state" warning="Карточка company — это рабочий узел trust/KYB/антифрод/финансы, а не просто справочник контактов." compact />

        <DetailHero
          kicker="Company profile"
          title={company.role}
          description={`${company.region} · ${company.kybStatus}. Показываем trust, скорость денег, связанный рынок и куда дальше вести пользователя.`}
          chips={[`trust ${company.trust}`, company.kybStatus, company.paymentDiscipline, company.logisticsReliability]}
          nextStep={company.nextAction}
          owner={company.owner}
          blockers={company.blocker}
          actions={[
            company.activeModules[0] ? { href: company.activeModules[0].href, label: company.activeModules[0].label } : { href: '/lots', label: 'К торговому контуру' },
            { href: '/anti-fraud', label: 'Антифрод', variant: 'secondary' },
            { href: '/finance', label: 'Финансы', variant: 'secondary' }
          ]}
        />

        <div className="mobile-two-grid">
          <div className="section-card-tight">
            <div className="section-title">Доверие и дисциплина</div>
            <div className="section-stack" style={{ marginTop: 12 }}>
              <div className="list-row"><span>Trust score</span><b>{company.trust}</b></div>
              <div className="list-row"><span>KYB</span><b>{company.kybStatus}</b></div>
              <div className="list-row"><span>Платёжная дисциплина</span><b>{company.paymentDiscipline}</b></div>
              <div className="list-row"><span>Логистическая надёжность</span><b>{company.logisticsReliability}</b></div>
              <div className="list-row"><span>Dispute score</span><b>{company.disputeScore}</b></div>
            </div>
          </div>
          <div className="section-card-tight">
            <div className="section-title">Сигналы и next action</div>
            <div className="detail-meta" style={{ marginTop: 12 }}>
              {company.flags.map((flag) => <span key={flag} className="mini-chip">{flag}</span>)}
            </div>
            <div className="muted small" style={{ marginTop: 16 }}>{company.nextAction}</div>
            <div className="muted tiny" style={{ marginTop: 8 }}>{company.blocker}</div>
            <div className="section-stack" style={{ marginTop: 16 }}>
              {linkedMarket.map((row) => (
                <Link key={row.id} href={`/market-center/${row.id}`} className="list-row">
                  <div>
                    <div style={{ fontWeight: 700 }}>{row.culture} · {row.buyerName}</div>
                    <div className="muted small">{row.region} · {row.basis}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="mini-chip">{row.netbackRubPerTon.toLocaleString('ru-RU')} ₽/т</div>
                    <div className="muted tiny" style={{ marginTop: 4 }}>trust {row.trust}</div>
                  </div>
                </Link>
              ))}
              {!linkedMarket.length ? <div className="muted tiny">По компании пока нет прямых рыночных строк.</div> : null}
            </div>
          </div>
        </div>

        <ModuleHub
          title="Активные модули компании"
          subtitle="Карточка компании должна вести в контур, где эта компания реально работает: торги, RFQ, логистика, финансы, антифрод."
          items={company.activeModules.map((item, index) => ({ href: item.href, label: item.label, detail: 'Открыть модуль, связанный с контрагентом и продолжить действие без ручного поиска.', icon: index === 0 ? '→' : index === 1 ? '₽' : '⌁', meta: index === 0 ? 'open' : 'linked', tone: index === 0 ? 'blue' : index === 1 ? 'green' : 'gray' }))}
        />

        <NextStepBar
          title="Перевести карточку компании в рабочее действие"
          detail={`${company.name} не должен оставаться справочником. Выбери связанный модуль и продолжи процесс.`}
          primary={{ href: company.activeModules[0]?.href || '/lots', label: company.activeModules[0]?.label || 'Открыть модуль' }}
          secondary={[{ href: '/companies', label: 'Каталог' }, { href: '/anti-fraud', label: 'Антифрод' }]}
        />
      </PageFrame>
    </PageAccessGuard>
  );
}
