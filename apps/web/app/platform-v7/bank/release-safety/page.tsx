import Link from 'next/link';
import { P7ExecutionMachineReadOnlyStrip } from '@/components/platform-v7/P7ExecutionMachineReadOnlyStrip';
import { P7Grid, P7LinkButton, P7MetricCard, P7Notice, P7PanelShell } from '@/components/platform-v7/P7UiPrimitives';
import { canonicalDomainDeals } from '@/lib/domain/selectors';
import { evaluateReleaseGuard, type ReleaseGuardBlocker } from '@/lib/platform-v7/domain/release-guard';
import { getBlockedIrreversibleActions, getDeal360Scenario } from '@/lib/platform-v7/deal360-source-of-truth';
import { formatCompactMoney } from '@/lib/v7r/helpers';
import {
  PLATFORM_V7_BANK_ROUTE,
  PLATFORM_V7_CONTROL_TOWER_ROUTE,
  PLATFORM_V7_OPERATOR_ROUTE,
} from '@/lib/platform-v7/routes';

const SS = 'var(--pc-bg-elevated)';
const B = 'var(--pc-border)';
const T = 'var(--pc-text-primary)';
const M = 'var(--pc-text-secondary)';
const BRAND = '#0A7A5F';
const BRAND_BG = 'rgba(10,122,95,0.08)';
const BRAND_BORDER = 'rgba(10,122,95,0.18)';
const WARN = '#B45309';
const ERR = '#B91C1C';
const ERR_BG = 'rgba(220,38,38,0.08)';
const ERR_BORDER = 'rgba(220,38,38,0.18)';

const reasonLabels: Record<ReleaseGuardBlocker, string> = {
  NO_RESERVED_MONEY: 'нет подтверждённого резерва',
  NO_RELEASE_AMOUNT: 'нет суммы к выплате',
  HOLD_AMOUNT_ACTIVE: 'есть активное удержание',
  OPEN_DISPUTE: 'открыт спор',
  DOCUMENTS_NOT_READY: 'документы не закрыты',
  FGIS_NOT_READY: 'ФГИС/СДИЗ не подтверждены',
  TRANSPORT_NOT_READY: 'рейс или транспортные документы не закрыты',
  ACCEPTANCE_NOT_CONFIRMED: 'приёмка не подтверждена',
  QUALITY_NOT_APPROVED: 'качество не подтверждено',
  MANUAL_BLOCKER: 'есть ручная остановка',
  DEAL_NOT_READY: 'стадия сделки не готова к выплате',
};

function stateStyle(stopped: boolean) {
  return stopped
    ? { label: 'Остановлено', bg: ERR_BG, border: ERR_BORDER, color: ERR }
    : { label: 'Разрешено к запросу', bg: BRAND_BG, border: BRAND_BORDER, color: BRAND };
}

function reasonText(reasons: readonly ReleaseGuardBlocker[]) {
  return reasons.length ? reasons.map((reason) => reasonLabels[reason]).join(', ') : '—';
}

export default function BankReleaseSafetyPage() {
  const rows = canonicalDomainDeals.slice(0, 12).map((deal) => {
    const check = evaluateReleaseGuard(deal);
    const scenario = getDeal360Scenario(deal.id);
    const irreversibleBlocks = getBlockedIrreversibleActions(scenario);
    const providerBlocks = scenario.providerGates.filter((gate) => gate.blocksIrreversibleAction).length;
    const documentBlocks = scenario.documents.filter((doc) => doc.requiredForRelease && doc.blocksMoney).length;
    const stopped = !check.canRequestRelease || irreversibleBlocks.length > 0;

    return {
      id: deal.id,
      grain: deal.grain,
      reserved: check.reservedAmount,
      hold: deal.money.holdAmount,
      release: stopped ? 0 : check.releaseAmount,
      rawRelease: check.releaseAmount,
      reasons: check.blockers,
      stopped,
      providerBlocks,
      documentBlocks,
      irreversibleBlocks,
      maturity: scenario.maturityLabel,
    };
  });

  const stoppedRows = rows.filter((row) => row.stopped);
  const releaseCandidate = rows.filter((row) => !row.stopped).reduce((sum, row) => sum + row.release, 0);
  const moneyUnderCheck = stoppedRows.reduce((sum, row) => sum + Math.max(row.hold, row.rawRelease), 0);
  const irreversibleBlockCount = rows.reduce((sum, row) => sum + row.irreversibleBlocks.length, 0);

  return (
    <div style={{ display: 'grid', gap: 18, padding: '8px 0' }}>
      <P7PanelShell>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 11, color: WARN, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Проверка выплаты · controlled-pilot</div>
            <div style={{ marginTop: 6, fontSize: 26, lineHeight: 1.1, fontWeight: 900, color: T }}>Проверка безопасности выпуска денег</div>
            <div style={{ marginTop: 8, fontSize: 14, color: M, maxWidth: 860 }}>
              Экран показывает, почему выпуск денег не должен обходить резерв, документы, ФГИС/СДИЗ, рейс, приёмку, качество, спор, удержание и внешний банковый контур. Это контрольный экран, а не платёжный механизм и не доказательство production-ready.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <P7LinkButton href={PLATFORM_V7_BANK_ROUTE}>← Банк</P7LinkButton>
            <P7LinkButton href={PLATFORM_V7_OPERATOR_ROUTE}>Оператор</P7LinkButton>
            <P7LinkButton href={PLATFORM_V7_CONTROL_TOWER_ROUTE}>Центр управления</P7LinkButton>
          </div>
        </div>
      </P7PanelShell>

      <P7Grid min={200} gap={14}>
        <P7MetricCard title='К выплате после проверки' value={formatCompactMoney(releaseCandidate)} tone='green' />
        <P7MetricCard title='Остановлено' value={String(stoppedRows.length)} tone={stoppedRows.length > 0 ? 'red' : 'green'} />
        <P7MetricCard title='На проверке' value={formatCompactMoney(moneyUnderCheck)} tone={moneyUnderCheck > 0 ? 'red' : 'green'} />
        <P7MetricCard title='Необратимых блокировок' value={String(irreversibleBlockCount)} tone={irreversibleBlockCount > 0 ? 'red' : 'green'} />
      </P7Grid>

      <P7Notice title='Правило' tone='amber'>
        Выплата допустима только после закрытия условий: резерв, сумма к выплате, отсутствие удержания, документы, ФГИС/СДИЗ, рейс, приёмка, качество, отсутствие спора, отсутствие ручных остановок и подтверждённое событие банка. Внутренняя карточка платформы не заменяет банк, ФГИС, ЭДО или транспортный ЭПД.
      </P7Notice>

      <P7ExecutionMachineReadOnlyStrip compact />

      <P7PanelShell>
        <div style={{ fontSize: 16, fontWeight: 900, color: T, marginBottom: 14 }}>Сделки и условия выплаты</div>
        <div style={{ display: 'grid', gap: 10 }}>
          {rows.map((row) => {
            const tone = stateStyle(row.stopped);
            return (
              <div key={row.id} style={{ background: SS, border: `1px solid ${B}`, borderRadius: 14, padding: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <div>
                    <Link href={`/platform-v7/deals/${row.id}/clean`} style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 900, color: BRAND, textDecoration: 'none' }}>{row.id}</Link>
                    <span style={{ marginLeft: 8, fontSize: 13, color: M }}>{row.grain}</span>
                    <span style={{ marginLeft: 8, fontSize: 11, color: WARN, fontWeight: 800 }}>{row.maturity}</span>
                  </div>
                  <span style={{ padding: '4px 10px', borderRadius: 99, fontSize: 11, fontWeight: 800, background: tone.bg, border: `1px solid ${tone.border}`, color: tone.color }}>{tone.label}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10, marginTop: 12 }}>
                  <Cell label='Резерв' value={formatCompactMoney(row.reserved)} />
                  <Cell label='Удержано' value={formatCompactMoney(row.hold)} danger={row.hold > 0} />
                  <Cell label='К выплате' value={formatCompactMoney(row.release)} danger={row.stopped} />
                  <Cell label='Release guard' value={reasonText(row.reasons)} danger={row.reasons.length > 0} />
                  <Cell label='Интеграционные gate-ы' value={`${row.providerBlocks} блок.`} danger={row.providerBlocks > 0} />
                  <Cell label='Документные gate-ы' value={`${row.documentBlocks} блок.`} danger={row.documentBlocks > 0} />
                </div>
                {row.irreversibleBlocks.length > 0 ? (
                  <div style={{ marginTop: 12, background: ERR_BG, border: `1px solid ${ERR_BORDER}`, borderRadius: 10, padding: 10 }}>
                    <div style={{ fontSize: 10, color: ERR, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Запрещено до закрытия gate-ов</div>
                    <div style={{ marginTop: 6, display: 'grid', gap: 4 }}>
                      {row.irreversibleBlocks.slice(0, 4).map((block) => (
                        <div key={block} style={{ fontSize: 12, color: T, fontWeight: 750 }}>— {block}</div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </P7PanelShell>
    </div>
  );
}

function Cell({ label, value, danger = false }: { label: string; value: string; danger?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: M, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
      <div style={{ marginTop: 4, fontSize: 13, fontWeight: 800, color: danger ? ERR : T, wordBreak: 'break-word' }}>{value}</div>
    </div>
  );
}
