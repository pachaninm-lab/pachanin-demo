import Link from 'next/link';
import { WorkflowActionPanel } from '../../../components/platform-v7/WorkflowActionPanel';
import { RoleExecutionHandoff, type HandoffItem } from '../../../components/platform-v7/RoleExecutionHandoff';
import { P7ActionStateChip } from '../../../components/platform-v7/P7ActionStateChip';
import { JournalPreview } from '../../../components/platform-v7/JournalPreview';
import { ConditionReasonStrip } from '../../../components/platform-v7/ConditionReasonStrip';
import { DocumentReadinessMiniMatrix } from '../../../components/platform-v7/DocumentReadinessMiniMatrix';
import { MoneyImpactSummaryStrip } from '../../../components/platform-v7/MoneyImpactSummaryStrip';
import { ActionFeedbackPreviewStrip } from '../../../components/platform-v7/ActionFeedbackPreviewStrip';
import { RoleExecutionCockpitPage } from '@/components/platform-v7/RoleExecutionCockpit';
import { PRIMARY_ROLE_EXECUTION_COCKPITS } from '@/lib/platform-v7/role-execution-cockpit';

const sellerHandoff: HandoffItem[] = [
  {
    direction: 'sends',
    role: 'продавец → покупатель',
    requirement: 'публикует лот и ждёт встречного предложения от покупателя',
    entity: 'LOT-2403',
    href: '/platform-v7/lots/LOT-2403',
    documentImpact: true,
  },
  {
    direction: 'awaits',
    role: 'от покупателя и банка',
    requirement: 'резерв ожидает банковского подтверждения',
    moneyImpact: true,
  },
  {
    direction: 'awaits',
    role: 'от ФГИС «Зерно»',
    requirement: 'СДИЗ ожидает закрытия — без этого основание не передаётся на банковскую проверку',
    moneyImpact: true,
    documentImpact: true,
  },
  {
    direction: 'blockedBy',
    requirement: 'ЭТрН, акт приёмки и протокол качества ещё не закрыты',
    documentImpact: true,
    moneyImpact: true,
  },
  {
    direction: 'next',
    requirement: 'закрыть СДИЗ, ЭТрН и акт приёмки для передачи основания на банковскую проверку',
    entity: 'DL-9106',
    href: '/platform-v7/deals/DL-9106/clean',
    moneyImpact: true,
  },
];

const sellerLots = [
  {
    id: 'LOT-2403',
    title: 'Пшеница 4 класса · 600 т · EXW',
    status: 'предложение принято',
    money: 'резерв 9,65 млн ₽ · на проверку банку 0 ₽',
    next: 'закрыть СДИЗ, ЭТрН и приёмку',
    href: '/platform-v7/lots/LOT-2403',
  },
  {
    id: 'LOT-2405',
    title: 'Пшеница 4 класса · 240 т · EXW',
    status: 'идут предложения',
    money: 'лучшая ставка 16 120 ₽/т',
    next: 'проверить рейтинг покупателя и условия резерва',
    href: '/platform-v7/lots/LOT-2405',
  },
] as const;

const sellerPaths = [
  { title: 'Создать партию', href: '/platform-v7/seller/batches/new', note: 'культура, объём, качество, документы, ФГИС' },
  { title: 'Опубликовать лот', href: '/platform-v7/seller/lots/new', note: 'управляемая публикация без раскрытия контактов' },
  { title: 'Проверить запросы', href: '/platform-v7/seller/rfq', note: 'сравнение спроса, netback и рисков покупателя' },
  { title: 'Открыть сделку', href: '/platform-v7/deals/DL-9106/clean', note: 'документы, рейс, основание и банковская проверка' },
] as const;

export default function PlatformV7SellerPage() {
  return (
    <RoleExecutionCockpitPage cockpit={PRIMARY_ROLE_EXECUTION_COCKPITS.seller}>

      <MoneyImpactSummaryStrip
        amountContext='резерв 9,65 млн ₽ · на проверку банку 0 ₽'
        pilotState='waiting'
        pilotStateLabel='контур исполнения · ожидание документов'
        responsible='продавец · ФГИС «Зерно»'
        nextStep='закрыть СДИЗ и ЭТрН для передачи основания банку на проверку'
        stopReason='банковская проверка остановлена: СДИЗ и ЭТрН не закрыты'
        requiredEvidence='закрытый СДИЗ, ЭТрН, акт приёмки и протокол качества без незакрытых расхождений'
        afterResolved='сделка передаёт основание банку; банк проверяет выплату по своим правилам'
        bankPlatformBoundary='платформа показывает основание и статус, банк подтверждает проверку и движение денег'
      />

      <P7ActionStateChip
        status='waiting'
        label='контур исполнения'
        nextActor='ФГИС «Зерно» и банк'
        blocker='СДИЗ и ЭТрН не закрыты'
        moneyEffect='банковская проверка остановлена'
      />

      <ConditionReasonStrip
        condition='контур исполнения'
        responsible='ФГИС «Зерно» и банк'
        documentState='СДИЗ и ЭТрН не закрыты'
        stopReason='банковская проверка остановлена'
      />

      <DocumentReadinessMiniMatrix role='seller' />

      <WorkflowActionPanel context='seller' />

      <ActionFeedbackPreviewStrip context='seller' />

      <RoleExecutionHandoff items={sellerHandoff} title='исполнение: что продавец отправляет и ожидает' />

      <JournalPreview role='seller' maxEntries={3} />

      <section style={card}>
        <div style={micro}>рабочие маршруты продавца</div>
        <div style={pathGrid}>
          {sellerPaths.map((path) => (
            <Link key={path.href} href={path.href} style={pathCard}>
              <strong style={{ color: '#0F1419', fontSize: 16 }}>{path.title}</strong>
              <span style={{ color: '#64748B', fontSize: 13, lineHeight: 1.45 }}>{path.note}</span>
              <span style={{ color: '#0A7A5F', fontSize: 12, fontWeight: 900 }}>Открыть</span>
            </Link>
          ))}
        </div>
      </section>

      <section style={card}>
        <div style={micro}>лоты продавца</div>
        <div style={{ display: 'grid', gap: 8 }}>
          {sellerLots.map((lot) => (
            <Link key={lot.id} href={lot.href} style={lotRow}>
              <div>
                <div style={idText}>{lot.id}</div>
                <h2 style={h2}>{lot.title}</h2>
              </div>
              <div style={rowGrid}>
                <Cell label='Статус' value={lot.status} />
                <Cell label='Деньги' value={lot.money} strong />
                <Cell label='Следующее действие' value={lot.next} warning />
              </div>
            </Link>
          ))}
        </div>
      </section>
    </RoleExecutionCockpitPage>
  );
}

function Cell({ label, value, strong = false, warning = false }: { label: string; value: string; strong?: boolean; warning?: boolean }) {
  return <div style={cell}><div style={micro}>{label}</div><div style={{ marginTop: 4, color: warning ? '#B45309' : strong ? '#0A7A5F' : '#0F1419', fontSize: 13, lineHeight: 1.35, fontWeight: 900 }}>{value}</div></div>;
}

const card = { background: 'linear-gradient(180deg,#FFFFFF 0%,#F8FAFB 100%)', border: '1px solid #E4E6EA', borderRadius: 24, padding: 18, display: 'grid', gap: 12, boxShadow: '0 14px 34px rgba(15,23,42,0.055)' } as const;
const h2 = { margin: '4px 0 0', color: '#0F1419', fontSize: 22, lineHeight: 1.08, fontWeight: 950, letterSpacing: '-0.025em' } as const;
const pathGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 8 } as const;
const pathCard = { textDecoration: 'none', minHeight: 132, display: 'grid', alignContent: 'start', gap: 8, padding: 14, borderRadius: 20, background: '#fff', border: '1px solid #E4E6EA', boxShadow: '0 10px 24px rgba(15,23,42,0.045)' } as const;
const lotRow = { textDecoration: 'none', color: 'inherit', background: 'linear-gradient(180deg,#FFFFFF 0%,#F8FAFB 100%)', border: '1px solid #E4E6EA', borderRadius: 22, padding: 16, display: 'grid', gap: 12, boxShadow: '0 12px 30px rgba(15,23,42,0.055)' } as const;
const rowGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(155px,1fr))', gap: 8 } as const;
const cell = { background: '#fff', border: '1px solid #E4E6EA', borderRadius: 14, padding: 10, minWidth: 0, boxShadow: '0 8px 18px rgba(15,23,42,0.035)' } as const;
const idText = { color: '#0A7A5F', fontSize: 13, fontWeight: 950 } as const;
const micro = { color: '#64748B', fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.07em' } as const;
