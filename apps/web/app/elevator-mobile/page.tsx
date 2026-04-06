import { INTERNAL_ONLY_ROLES, OPERATOR_ROLES } from '../../lib/route-roles';
import { PageAccessGuard } from '../../components/page-access-guard';
import { AppShell } from '../../components/app-shell';
import { ModuleHub } from '../../components/module-hub';
import { OperationBlueprint } from '../../components/operation-blueprint';
import { NextStepBar } from '../../components/next-step-bar';
import { SourceOfTruthStrip } from '../../components/source-of-truth-strip';
import { readCommercialWorkspace } from '../../lib/commercial-workspace-store';

export default async function ElevatorMobilePage() {
  const state = await readCommercialWorkspace();
  const leadSlot = state.queueSlots[0];
  const recentWeight = state.inventoryBatches[0];

  return (
    <PageAccessGuard allowedRoles={[...INTERNAL_ONLY_ROLES, ...OPERATOR_ROLES]} title="Elevator mobile ограничен" subtitle="Экран нужен складу, оператору и роли, которая закрывает приёмку на площадке.">
      <AppShell title="Elevator mobile" subtitle="Мобильный rail склада и площадки: слот, вес, выгрузка, quality handoff и документы.">
        <div className="page-surface">
          <SourceOfTruthStrip
            entries={[
              { label: 'Слот', value: leadSlot?.status || 'no slot', tone: leadSlot ? 'blue' : 'gray' },
              { label: 'Weight', value: recentWeight?.weightStatus || 'pending', tone: recentWeight ? 'green' : 'gray' },
              { label: 'Batch rail', value: recentWeight?.status || 'queued', tone: recentWeight ? 'amber' : 'gray' },
            ]}
          />

          <ModuleHub
            title="Что должно связывать elevator mobile"
            subtitle="Экран площадки должен продолжать receiving, weighbridge, lab и inventory rails, а не жить отдельно."
            items={[
              { href: '/receiving', label: 'Receiving rail', detail: 'Открыть слот, очередь и handoff по партии.', icon: '🏁', meta: leadSlot?.slot || 'slot', tone: 'blue' },
              { href: '/weighbridge', label: 'Weight rail', detail: 'Сверить вес и загрузить weight evidence.', icon: '⚖️', meta: recentWeight?.weightStatus || 'pending', tone: 'green' },
              { href: '/lab', label: 'Lab rail', detail: 'Если качество не подтверждено, следующий rail должен быть лабораторией.', icon: '🧪', meta: recentWeight?.qualityStatus || 'quality', tone: 'amber' },
              { href: '/inventory', label: 'Inventory rail', detail: 'После unload партия обязана перейти в batch / storage rail.', icon: '📦', meta: recentWeight?.id || 'batch', tone: 'gray' },
            ]}
          />

          <OperationBlueprint
            title="Как должен заканчиваться elevator mobile"
            subtitle="После мобильного действия на площадке контур должен переходить в receiving/weight/lab/inventory, а не заканчиваться просто отметкой у оператора."
            stages={[
              { title: 'Slot handoff', detail: 'Открыть слот и убедиться, что машина заведена в очередь.', state: leadSlot ? 'active' : 'pending', href: '/receiving' },
              { title: 'Weight capture', detail: 'Вес должен попасть в weight rail вместе с evidence.', state: recentWeight ? 'active' : 'pending', href: '/weighbridge' },
              { title: 'Quality check', detail: 'Если quality не финален, следующий rail — lab.', state: recentWeight?.qualityStatus === 'final' ? 'done' : 'active', href: '/lab' },
              { title: 'Inventory batch', detail: 'Финал площадочного rail — переход в inventory/storage.', state: recentWeight ? 'pending' : 'blocked', href: '/inventory' },
            ]}
            outcomes={[
              { href: '/receiving', label: 'Receiving', detail: 'Закрыть slot owner action и проверить queue status.', meta: leadSlot?.status || 'slot' },
              { href: '/weighbridge', label: 'Weight', detail: 'Открыть weight rail и сверить proof.', meta: recentWeight?.weightStatus || 'pending' },
              { href: '/inventory', label: 'Inventory', detail: 'После unload партия должна уйти в batch rail.', meta: recentWeight?.id || 'batch' },
            ]}
            rules={[
              'Elevator mobile не должен быть отдельным экраном склада — он обязан продолжать receiving/weight/lab/inventory rails.',
              'Любая запись о весе и выгрузке должна сопровождаться evidence и linked batch.',
              'Если quality не закрыт, финалом мобильного шага должен быть переход в lab, а не "done" внутри площадочного экрана.'
            ]}
          />

          <NextStepBar
            title={leadSlot ? 'Открыть receiving rail и закрыть slot handoff' : 'Начать с очереди приёмки'}
            detail={leadSlot ? `${leadSlot.vehicle} · ${leadSlot.slot}` : 'Без очереди нет площадочного handoff.'}
            primary={{ href: '/receiving', label: 'Открыть receiving' }}
            secondary={[{ href: '/weighbridge', label: 'Weight rail' }, { href: '/inventory', label: 'Inventory rail' }]}
          />
        </div>
      </AppShell>
    </PageAccessGuard>
  );
}
