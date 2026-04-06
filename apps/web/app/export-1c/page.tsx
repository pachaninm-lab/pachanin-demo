import Link from 'next/link';
import { PageFrame } from '../../components/page-frame';
import { Breadcrumbs } from '../../components/breadcrumbs';
import { DetailHero } from '../../components/detail-hero';
import { ModuleHub } from '../../components/module-hub';
import { NextStepBar } from '../../components/next-step-bar';
import { SourceNote } from '../../components/source-note';
import { PageAccessGuard } from '../../components/page-access-guard';
import { BANK_RAIL_ROLES, INTERNAL_ONLY_ROLES } from '../../lib/route-roles';

const exportsQueue = [
  { id: 'EXP-001', lane: 'payments', status: 'READY', detail: 'Платёжный пакет готов к выгрузке в учётный контур.', linkedHref: '/payments' },
  { id: 'EXP-002', lane: 'documents', status: 'WAITING_DOCS', detail: 'Не хватает финального документного пакета.', linkedHref: '/documents' },
  { id: 'EXP-003', lane: 'settlement', status: 'HOLD', detail: 'Спор удерживает финальную выгрузку проводок.', linkedHref: '/disputes' },
];

export default function Export1CPage() {
  return (
    <PageAccessGuard allowedRoles={[...BANK_RAIL_ROLES, ...INTERNAL_ONLY_ROLES]} title="1С / экспорт ограничен" subtitle="Учётный контур нужен только finance и internal-ролям как post-payment rail.">
      <PageFrame title="1С / экспорт" subtitle="Выгрузка проводок, сверка и post-payment continuation в учётном контуре." breadcrumbs={<Breadcrumbs items={[{ href: '/', label: 'Главная' }, { label: '1С / экспорт' }]} />}>
        <SourceNote source="embedded accounting export rail" warning="Экспорт не должен быть мёртвой кнопкой. Он обязан завершать money rail: release/hold → accounting export → reconciliation." compact />

        <DetailHero
          kicker="Accounting export"
          title="Учётный rail после денег"
          description="После платежа или hold операция должна сразу переходить в выгрузку, сверку и post-payment контроль."
          chips={[`queue ${exportsQueue.length}`, 'accounting rail', 'post-payment']}
          nextStep="Открыть проблемную выгрузку и проверить, какой upstream rail её блокирует."
          owner="finance / accounting"
          blockers="экспорт не должен жить отдельно от документов, settlement и dispute rail"
          actions={[
            { href: '/payments', label: 'Payments' },
            { href: '/documents', label: 'Documents', variant: 'secondary' },
            { href: '/disputes', label: 'Disputes', variant: 'secondary' }
          ]}
        />

        <section className="section-card-tight">
          <div className="dashboard-section-title">Очередь выгрузки</div>
          <div className="section-stack" style={{ marginTop: 16 }}>
            {exportsQueue.map((item) => (
              <Link key={item.id} href={item.linkedHref} className="list-row linkable">
                <div>
                  <div style={{ fontWeight: 700 }}>{item.id}</div>
                  <div className="muted small">{item.lane} · {item.detail}</div>
                </div>
                <span className="mini-chip">{item.status}</span>
              </Link>
            ))}
          </div>
        </section>

        <ModuleHub
          title="Связанные rails"
          subtitle="Из accounting export пользователь должен уходить в тот rail, который реально блокирует или завершает выгрузку."
          items={[
            { href: '/payments', label: 'Payments', detail: 'Проверить release / hold и финальный money truth.', icon: '₽', meta: 'money', tone: 'blue' },
            { href: '/documents', label: 'Documents', detail: 'Понять, хватает ли документного пакета для учёта.', icon: '⌁', meta: 'docs', tone: 'green' },
            { href: '/settlement', label: 'Settlement', detail: 'Проверить расчётный rail перед финальной выгрузкой.', icon: '≣', meta: 'settlement', tone: 'amber' },
            { href: '/disputes', label: 'Disputes', detail: 'Если выгрузка удержана спором, перейти в claim rail.', icon: '!', meta: 'hold', tone: 'gray' }
          ]}
        />

        <NextStepBar
          title="Открыть проблемную выгрузку и upstream rail"
          detail="Следующий шаг — не смотреть на очередь, а зайти в rail, который реально мешает выгрузке."
          primary={{ href: '/payments', label: 'Открыть payments' }}
          secondary={[{ href: '/documents', label: 'Documents' }, { href: '/disputes', label: 'Disputes' }]}
        />
      </PageFrame>
    </PageAccessGuard>
  );
}
