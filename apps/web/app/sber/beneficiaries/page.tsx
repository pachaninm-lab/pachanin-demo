import Link from 'next/link';
import { PageFrame } from '../../../components/page-frame';
import { Breadcrumbs } from '../../../components/breadcrumbs';
import { DetailHero } from '../../../components/detail-hero';
import { ModuleHub } from '../../../components/module-hub';
import { NextStepBar } from '../../../components/next-step-bar';
import { SourceNote } from '../../../components/source-note';
import { PageAccessGuard } from '../../../components/page-access-guard';
import { BANK_RAIL_ROLES } from '../../../lib/route-roles';

const beneficiaries = [
  { id: 'DEMO', name: 'ООО Агроцентр', status: 'VERIFIED', accountStatus: 'READY', linkedDealId: 'DEAL-001' },
  { id: 'BEN-002', name: 'КФХ Алексеев', status: 'REVIEW', accountStatus: 'PENDING', linkedDealId: 'DEAL-002' },
];

export default function SberBeneficiariesPage() {
  return (
    <PageAccessGuard allowedRoles={[...BANK_RAIL_ROLES]} title="Beneficiary registry ограничен" subtitle="Бенефициары доступны только money-ролям и operator/finance контуру.">
      <PageFrame title="Sber beneficiaries" subtitle="Реестр бенефициаров, KYB/account readiness и переход в linked money rail." breadcrumbs={<Breadcrumbs items={[{ href: '/', label: 'Главная' }, { href: '/sber', label: 'Сбер' }, { label: 'Бенефициары' }]} />}>
        <SourceNote source="embedded sber beneficiary registry" warning="Reестр бенефициаров нужен не как справочник реквизитов. Из него должен быть прямой вход в payments, documents и linked deal rail." compact />

        <DetailHero
          kicker="Beneficiary registry"
          title="Бенефициары и account readiness"
          description="Каждый beneficiary должен вести дальше в payment/deal/document rail, а не оставаться отдельной карточкой банка."
          chips={[`beneficiaries ${beneficiaries.length}`, 'kyb', 'bank readiness']}
          nextStep="Открыть проблемного beneficiary и проверить release readiness."
          owner="finance / bank / operator"
          blockers="beneficiary registry не должен быть тупиком без money continuation"
          actions={[
            { href: '/payments', label: 'Payments' },
            { href: '/documents', label: 'Documents', variant: 'secondary' },
            { href: '/sber', label: 'Sber hub', variant: 'secondary' }
          ]}
        />

        <section className="section-card-tight">
          <div className="dashboard-section-title">Бенефициары</div>
          <div className="section-stack" style={{ marginTop: 16 }}>
            {beneficiaries.map((item) => (
              <Link key={item.id} href={`/sber/beneficiaries/${item.id}`} className="list-row linkable">
                <div>
                  <div style={{ fontWeight: 700 }}>{item.name}</div>
                  <div className="muted small">{item.id} · account {item.accountStatus} · deal {item.linkedDealId}</div>
                </div>
                <span className="mini-chip">{item.status}</span>
              </Link>
            ))}
          </div>
        </section>

        <ModuleHub
          title="Связанные rails"
          subtitle="Из beneficiary registry пользователь должен уходить в money rail, а не только смотреть статусы KYB."
          items={[
            { href: '/payments', label: 'Payments', detail: 'Проверить release / hold по beneficiary path.', icon: '₽', meta: 'money', tone: 'blue' },
            { href: '/documents', label: 'Documents', detail: 'Проверить legal пакет и bank readiness.', icon: '⌁', meta: 'docs', tone: 'green' },
            { href: '/deals', label: 'Deal rail', detail: 'Открыть linked deal и finance continuation.', icon: '≣', meta: 'deals', tone: 'amber' },
            { href: '/sber/events/DEMO', label: 'Bank events', detail: 'Проверить callback sequence по beneficiary path.', icon: '↗', meta: 'events', tone: 'gray' }
          ]}
        />

        <NextStepBar
          title="Открыть beneficiary и money rail"
          detail="Следующий шаг — зайти в beneficiary card и проверить release readiness в linked rails."
          primary={{ href: '/sber/beneficiaries/DEMO', label: 'Открыть beneficiary' }}
          secondary={[{ href: '/payments', label: 'Payments' }, { href: '/documents', label: 'Documents' }]}
        />
      </PageFrame>
    </PageAccessGuard>
  );
}
