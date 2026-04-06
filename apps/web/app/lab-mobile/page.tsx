import { LAB_ROLES } from '../../lib/route-roles';
import { PageAccessGuard } from '../../components/page-access-guard';
import { AppShell } from '../../components/app-shell';
import { ModuleHub } from '../../components/module-hub';
import { OperationBlueprint } from '../../components/operation-blueprint';
import { NextStepBar } from '../../components/next-step-bar';
import { SourceOfTruthStrip } from '../../components/source-of-truth-strip';
import { readCommercialWorkspace, buildQualityView } from '../../lib/commercial-workspace-store';

export default async function LabMobilePage() {
  const state = await readCommercialWorkspace();
  const qualityView = buildQualityView(state);
  const leadCheck = qualityView.checks[0];

  return (
    <PageAccessGuard allowedRoles={[...LAB_ROLES]} title="Lab mobile ограничен" subtitle="Экран нужен лаборатории, оператору и quality роли.">
      <AppShell title="Lab mobile" subtitle="Мобильный rail лаборатории: проба, протокол, dispute/settlement handoff.">
        <div className="page-surface">
          <SourceOfTruthStrip
            entries={[
              { label: 'Lead sample', value: leadCheck?.id || 'no sample', tone: leadCheck ? 'blue' : 'gray' },
              { label: 'Quality status', value: leadCheck?.status || 'pending', tone: leadCheck?.status === 'final' ? 'green' : 'amber' },
              { label: 'Settlement handoff', value: leadCheck?.status === 'final' ? 'ready' : 'blocked', tone: leadCheck?.status === 'final' ? 'green' : 'red' },
            ]}
          />

          <ModuleHub
            title="Что должен связывать lab mobile"
            subtitle="Лабораторный мобильный экран должен продолжать receiving, settlement и dispute rails, а не быть автономным полевым протоколом."
            items={[
              { href: '/receiving', label: 'Receiving rail', detail: 'Понять, с какого слота и партии пришла проба.', icon: '🏁', meta: leadCheck?.dealId || 'receiving', tone: 'blue' },
              { href: '/lab', label: 'Lab rail', detail: 'Открыть основной quality rail и протоколы.', icon: '🧪', meta: leadCheck?.status || 'lab', tone: 'green' },
              { href: '/settlement', label: 'Settlement rail', detail: 'После финального quality перевести сделку в money formula.', icon: '₽', meta: leadCheck?.status === 'final' ? 'ready' : 'blocked', tone: leadCheck?.status === 'final' ? 'amber' : 'gray' },
              { href: '/disputes', label: 'Dispute rail', detail: 'Если quality спорный, мобильный rail должен вести в спор.', icon: '⚠️', meta: leadCheck?.flags?.join(' · ') || 'clear', tone: leadCheck?.flags?.length ? 'red' : 'gray' },
            ]}
          />

          <OperationBlueprint
            title="Как должен заканчиваться lab mobile"
            subtitle="Мобильная проба должна завершаться финальным quality truth и переводом в settlement/dispute, а не просто сохранением формы."
            stages={[
              { title: 'Sample open', detail: 'Понять, с какого receiving rail пришла проба и кто owner.', state: leadCheck ? 'active' : 'pending', href: '/receiving' },
              { title: 'Protocol capture', detail: 'Собрать показатели и evidence в lab rail.', state: leadCheck ? 'active' : 'pending', href: '/lab' },
              { title: 'Settlement handoff', detail: 'Если quality финален, следующий rail — settlement.', state: leadCheck?.status === 'final' ? 'active' : 'pending', href: '/settlement' },
              { title: 'Dispute fallback', detail: 'Если quality спорный, mobile rail должен вести в dispute.', state: leadCheck?.flags?.length ? 'risk' : 'pending', href: '/disputes' },
            ]}
            outcomes={[
              { href: '/lab', label: 'Lab rail', detail: 'Открыть основной quality rail и убедиться, что sample truth собран.', meta: leadCheck?.id || 'sample' },
              { href: '/settlement', label: 'Settlement', detail: 'После final quality перевести сделку в money formula.', meta: leadCheck?.status === 'final' ? 'ready' : 'blocked' },
              { href: '/disputes', label: 'Dispute rail', detail: 'Если quality спорный — перейти в claim/dispute path.', meta: leadCheck?.flags?.join(' · ') || 'clear' },
            ]}
            rules={[
              'Lab mobile не должен завершаться на сохранении формы — он обязан вести в settlement/dispute.',
              'Каждая проба должна быть привязана к receiving/deal, иначе quality не влияет на execution truth.',
              'Если quality не финален, settlement и payout должны оставаться заблокированными.'
            ]}
          />

          <NextStepBar
            title={leadCheck?.status === 'final' ? 'Открыть settlement rail' : 'Открыть основной lab rail'}
            detail={leadCheck ? `${leadCheck.id} · ${leadCheck.status}` : 'Нет активной пробы.'}
            primary={{ href: leadCheck?.status === 'final' ? '/settlement' : '/lab', label: leadCheck?.status === 'final' ? 'Settlement' : 'Lab rail' }}
            secondary={[{ href: '/receiving', label: 'Receiving' }, { href: '/disputes', label: 'Disputes' }]}
          />
        </div>
      </AppShell>
    </PageAccessGuard>
  );
}
