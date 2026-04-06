import Link from 'next/link';
import { AppShell } from '../../components/app-shell';
import { Breadcrumbs } from '../../components/breadcrumbs';
import { PageAccessGuard } from '../../components/page-access-guard';
import { ALL_AUTHENTICATED_ROLES } from '../../lib/route-roles';

type WorkflowStage = {
  id: string; label: string; description: string; roles: string[];
  link: string; status: 'active' | 'pending' | 'blocked';
};

const STAGES: WorkflowStage[] = [
  { id: '1', label: 'Создание лота', description: 'FARMER создаёт лот с качественными параметрами, ценой и объёмом', roles: ['FARMER'], link: '/lots', status: 'active' },
  { id: '2', label: 'Публикация и торги', description: 'Лот публикуется на торговой площадке. BUYER подаёт заявки', roles: ['FARMER', 'BUYER'], link: '/auctions', status: 'active' },
  { id: '3', label: 'Матчинг и создание сделки', description: 'Система матчит лучшую заявку и автоматически создаёт сделку', roles: ['SYSTEM'], link: '/deals', status: 'active' },
  { id: '4', label: 'Подписание договора', description: 'Обе стороны подписывают договор через EDO (Диадок) с КЭП', roles: ['FARMER', 'BUYER'], link: '/documents', status: 'active' },
  { id: '5', label: 'Резервирование предоплаты', description: 'BUYER резервирует предоплату через банк (Сбер/РСХБ). Hold активен', roles: ['BUYER', 'ACCOUNTING'], link: '/payments', status: 'active' },
  { id: '6', label: 'Погрузка на элеваторе', description: 'ELEVATOR принимает груз, взвешивает, выдаёт весовую квитанцию', roles: ['ELEVATOR'], link: '/receiving', status: 'active' },
  { id: '7', label: 'Логистика и транспортировка', description: 'DRIVER выполняет рейс. LOGISTICIAN контролирует маршрут по GPS', roles: ['DRIVER', 'LOGISTICIAN'], link: '/logistics', status: 'active' },
  { id: '8', label: 'Проверка качества', description: 'LAB анализирует пробы, выдаёт протокол. При несоответствии — спор', roles: ['LAB', 'ELEVATOR'], link: '/lab', status: 'active' },
  { id: '9', label: 'Акцепт и финальный платёж', description: 'BUYER акцептует, ACCOUNTING инициирует release. Банк переводит средства', roles: ['BUYER', 'ACCOUNTING'], link: '/payments', status: 'active' },
  { id: '10', label: 'Расчёт завершён', description: 'Сделка переходит в SETTLED. Документы финализируются в ФГИС', roles: ['SYSTEM', 'ACCOUNTING'], link: '/settlement', status: 'active' },
];

const ROLE_COLOR: Record<string, string> = {
  FARMER: 'green', BUYER: 'blue', LOGISTICIAN: 'amber', DRIVER: 'amber',
  LAB: 'purple', ELEVATOR: 'gray', ACCOUNTING: 'blue', EXECUTIVE: 'red',
  SUPPORT_MANAGER: 'gray', ADMIN: 'red', SYSTEM: 'gray',
};

export default function WorkflowPage() {
  return (
    <PageAccessGuard allowedRoles={[...ALL_AUTHENTICATED_ROLES]}
      title="Workflow ограничен"
      subtitle="Схема процесса доступна авторизованным пользователям.">
      <AppShell title="Workflow" subtitle="Сквозной маршрут сделки: lot → deal → logistics → docs → money → dispute">
        <div className="space-y-6">
          <Breadcrumbs items={[{ href: '/', label: 'Главная' }, { label: 'Workflow' }]} />

          <div className="soft-box">
            <div style={{ fontWeight: 700, marginBottom: 6 }}>Полный цикл зерновой сделки</div>
            <div className="muted small">10 этапов от создания лота до финального расчёта. Каждый этап имеет ответственную роль, документы и условия перехода.</div>
          </div>

          {/* Stage list */}
          <div style={{ position: 'relative' }}>
            <div style={{ position: 'absolute', left: 20, top: 28, bottom: 28, width: 2, background: 'var(--color-border, #e5e7eb)' }} />
            <div className="section-stack" style={{ paddingLeft: 48 }}>
              {STAGES.map((stage) => (
                <div key={stage.id} style={{ position: 'relative' }}>
                  <div style={{
                    position: 'absolute', left: -36, top: 16, width: 28, height: 28,
                    borderRadius: '50%', background: 'var(--color-surface, white)',
                    border: '2px solid var(--color-border, #e5e7eb)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 700, fontSize: '0.75rem', color: 'var(--color-muted, #6b7280)',
                  }}>
                    {stage.id}
                  </div>
                  <div className="soft-box">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, marginBottom: 4 }}>{stage.label}</div>
                        <div className="muted small" style={{ marginBottom: 6 }}>{stage.description}</div>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {stage.roles.map((r) => (
                            <span key={r} className={`mini-chip ${ROLE_COLOR[r] || 'gray'}`}>{r}</span>
                          ))}
                        </div>
                      </div>
                      <Link href={stage.link} className="mini-chip">→</Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Dispute branch */}
          <div className="soft-box" style={{ borderLeft: '3px solid var(--color-red, #ef4444)' }}>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>⚖ Ветка споров</div>
            <div className="muted small" style={{ marginBottom: 6 }}>При несоответствии качества или веса сделка переходит в DISPUTE_OPEN. SUPPORT_MANAGER ведёт кейс через арбитраж.</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Link href="/disputes" className="mini-chip red">Споры →</Link>
              <Link href="/operator-cockpit" className="mini-chip">Кокпит оператора</Link>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Link href="/deals" className="mini-chip">Сделки</Link>
            <Link href="/lots" className="mini-chip">Лоты</Link>
            <Link href="/documents" className="mini-chip">Документы</Link>
            <Link href="/logistics" className="mini-chip">Логистика</Link>
            <Link href="/payments" className="mini-chip">Платежи</Link>
          </div>
        </div>
      </AppShell>
    </PageAccessGuard>
  );
}
