'use client';

import Link from 'next/link';
import { usePlatformV7RStore, type PlatformRole } from '@/stores/usePlatformV7RStore';

type ScenarioCard = {
  title: string;
  description: string;
  cta: string;
  href: string;
  role?: PlatformRole;
  accent: string;
};

type Stage = {
  title: string;
  state: string;
  href: string;
};

const SCENARIO_CARDS: ScenarioCard[] = [
  {
    title: 'Продавец',
    description: 'Лот, предложения, согласование цены, документы, отгрузка и получение денег.',
    cta: 'Открыть продавца',
    href: '/platform-v7/seller',
    role: 'seller',
    accent: '#0A7A5F',
  },
  {
    title: 'Покупатель',
    description: 'Выбор лота, ставка, резерв денег, приёмка груза и закрытие документов.',
    cta: 'Открыть покупателя',
    href: '/platform-v7/buyer',
    role: 'buyer',
    accent: '#2563EB',
  },
  {
    title: 'Логистика',
    description: 'Заявка, рейс, водитель, маршрут, пломба, фото, вес и отклонения.',
    cta: 'Открыть логистику',
    href: '/platform-v7/logistics',
    role: 'logistics',
    accent: '#7C3AED',
  },
  {
    title: 'Приёмка',
    description: 'Элеватор, лаборатория, сюрвейер, вес, качество и основание удержаний.',
    cta: 'Открыть приёмку',
    href: '/platform-v7/elevator',
    role: 'elevator',
    accent: '#B45309',
  },
  {
    title: 'Оператор',
    description: 'Деньги, документы, споры, причины остановки и следующий ответственный шаг.',
    cta: 'Открыть контроль',
    href: '/platform-v7/control-tower',
    role: 'operator',
    accent: '#0F172A',
  },
];

const EXECUTION_STAGES: Stage[] = [
  { title: 'Лот', state: 'Опубликован', href: '/platform-v7/lots' },
  { title: 'Ставка', state: 'Цена согласована', href: '/platform-v7/buyer' },
  { title: 'Сделка', state: 'DL-9102', href: '/platform-v7/deals/DL-9102/clean' },
  { title: 'Деньги', state: 'Резерв 6,24 млн ₽', href: '/platform-v7/bank/clean' },
  { title: 'Логистика', state: 'Рейс ТМБ-14', href: '/platform-v7/logistics' },
  { title: 'Приёмка', state: 'Нужна сверка', href: '/platform-v7/elevator' },
  { title: 'Спор', state: 'DK-2024-89', href: '/platform-v7/disputes/DK-2024-89' },
];

const SECONDARY_LINKS = [
  { title: 'Все роли', href: '/platform-v7/roles' },
  { title: 'Демо-сценарий', href: '/platform-v7/demo' },
  { title: 'Инвесторский режим', href: '/platform-v7/investor' },
] as const;

const RECEIVING_LINKS = [
  { title: 'Элеватор', href: '/platform-v7/elevator', role: 'elevator' as PlatformRole },
  { title: 'Лаборатория', href: '/platform-v7/lab', role: 'lab' as PlatformRole },
  { title: 'Сюрвейер', href: '/platform-v7/surveyor', role: 'surveyor' as PlatformRole },
] as const;

const CONTROL_LINKS = [
  { title: 'Центр управления', href: '/platform-v7/control-tower', role: 'operator' as PlatformRole },
  { title: 'Банк', href: '/platform-v7/bank', role: 'bank' as PlatformRole },
  { title: 'Комплаенс', href: '/platform-v7/compliance', role: 'compliance' as PlatformRole },
  { title: 'Арбитр', href: '/platform-v7/arbitrator', role: 'arbitrator' as PlatformRole },
] as const;

function ScenarioLink({ scenario }: { scenario: ScenarioCard }) {
  const { setRole } = usePlatformV7RStore();

  return (
    <Link
      href={`${scenario.href}${scenario.role ? `?as=${scenario.role}` : ''}`}
      onClick={() => scenario.role && setRole(scenario.role)}
      style={{
        textDecoration: 'none',
        background: '#fff',
        border: '1px solid #E4E6EA',
        borderRadius: 20,
        padding: 18,
        display: 'grid',
        gap: 12,
        minHeight: 214,
        boxShadow: '0 16px 38px rgba(15, 20, 25, 0.055)',
      }}
    >
      <div style={{ width: 42, height: 4, borderRadius: 999, background: scenario.accent }} />
      <div style={{ display: 'grid', gap: 9 }}>
        <h2 style={{ margin: 0, fontSize: 21, lineHeight: 1.18, fontWeight: 900, color: '#0F1419' }}>{scenario.title}</h2>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: '#475569' }}>{scenario.description}</p>
      </div>
      <div style={{ marginTop: 'auto', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minHeight: 42, padding: '10px 13px', borderRadius: 13, background: scenario.accent, color: '#fff', fontSize: 14, lineHeight: 1.2, fontWeight: 850, textAlign: 'center' }}>
        {scenario.cta}
      </div>
    </Link>
  );
}

function InlineRoleLinks({ mode }: { mode: 'receiving' | 'control' }) {
  const { setRole } = usePlatformV7RStore();
  const links = mode === 'receiving' ? RECEIVING_LINKS : CONTROL_LINKS;

  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {links.map((link) => (
        <Link
          key={link.href}
          href={`${link.href}?as=${link.role}`}
          onClick={() => setRole(link.role)}
          style={pillLink}
        >
          {link.title}
        </Link>
      ))}
    </div>
  );
}

function Metric({ label, value, tone = 'base' }: { label: string; value: string; tone?: 'base' | 'good' | 'warn' | 'danger' }) {
  const color = tone === 'good' ? '#0A7A5F' : tone === 'warn' ? '#B45309' : tone === 'danger' ? '#B91C1C' : '#0F1419';
  const border = tone === 'good' ? 'rgba(10,122,95,0.18)' : tone === 'warn' ? 'rgba(217,119,6,0.20)' : tone === 'danger' ? 'rgba(220,38,38,0.20)' : '#E4E6EA';
  const background = tone === 'base' ? '#fff' : tone === 'good' ? 'rgba(10,122,95,0.055)' : tone === 'warn' ? 'rgba(217,119,6,0.065)' : 'rgba(220,38,38,0.055)';

  return (
    <div style={{ background, border: `1px solid ${border}`, borderRadius: 16, padding: 15, display: 'grid', gap: 7 }}>
      <div style={microLabel}>{label}</div>
      <div style={{ color, fontSize: 20, lineHeight: 1.12, fontWeight: 950 }}>{value}</div>
    </div>
  );
}

function StageLink({ stage, index }: { stage: Stage; index: number }) {
  return (
    <Link href={stage.href} style={{ textDecoration: 'none', background: '#fff', border: '1px solid #E4E6EA', borderRadius: 16, padding: 14, display: 'grid', gap: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
        <span style={microLabel}>{String(index + 1).padStart(2, '0')}</span>
        <span style={{ width: 8, height: 8, borderRadius: 999, background: index < 5 ? '#0A7A5F' : '#D97706' }} />
      </div>
      <strong style={{ color: '#0F1419', fontSize: 15 }}>{stage.title}</strong>
      <span style={{ color: '#64748B', fontSize: 12, lineHeight: 1.45 }}>{stage.state}</span>
    </Link>
  );
}

export function PlatformRolesHub() {
  return (
    <main style={{ display: 'grid', gap: 18, padding: '8px 0 24px' }}>
      <section style={{ background: 'linear-gradient(135deg, #FFFFFF 0%, #F8FAFB 58%, #EEF6F3 100%)', border: '1px solid #E4E6EA', borderRadius: 28, padding: 24, display: 'grid', gap: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 18, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div style={{ display: 'grid', gap: 11, maxWidth: 890 }}>
            <div style={{ display: 'inline-flex', width: 'fit-content', alignItems: 'center', padding: '7px 11px', borderRadius: 999, background: 'rgba(10,122,95,0.08)', border: '1px solid rgba(10,122,95,0.18)', color: '#0A7A5F', fontSize: 12, fontWeight: 900 }}>
              Пилотный контур. Внешние подключения требуют боевого подтверждения.
            </div>
            <h1 style={{ margin: 0, fontSize: 'clamp(34px, 5.2vw, 62px)', lineHeight: 1.02, letterSpacing: '-0.052em', fontWeight: 950, color: '#0F1419' }}>
              Центр исполнения зерновой сделки
            </h1>
            <p style={{ margin: 0, fontSize: 16, lineHeight: 1.7, color: '#475569', maxWidth: 850 }}>
              Один экран показывает, где сейчас сделка, где деньги, какие документы не закрыты, где груз, есть ли спор и кто делает следующий шаг.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Link href='/platform-v7/control-tower?as=operator' style={darkButton}>Центр управления</Link>
            <Link href='/platform-v7/deals/DL-9102/clean' style={lightButton}>Открыть сделку DL-9102</Link>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 1.25fr) minmax(260px, 0.75fr)', gap: 14 }}>
          <div style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 22, padding: 18, display: 'grid', gap: 15 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
              <div>
                <div style={microLabel}>Активная сделка</div>
                <h2 style={{ margin: '6px 0 0', color: '#0F1419', fontSize: 27, lineHeight: 1.15 }}>DL-9102 · Пшеница 4 кл. · 200,3 т</h2>
                <p style={{ margin: '7px 0 0', color: '#64748B', fontSize: 13, lineHeight: 1.6 }}>Агро-Юг ООО → Агрохолдинг СК · рейс ТМБ-14 · спор DK-2024-89</p>
              </div>
              <span style={{ ...pillBase, background: 'rgba(217,119,6,0.08)', borderColor: 'rgba(217,119,6,0.22)', color: '#B45309' }}>Нужна сверка</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(145px, 1fr))', gap: 10 }}>
              <Metric label='Деньги в резерве' value='6,24 млн ₽' tone='good' />
              <Metric label='Удержание' value='624 тыс. ₽' tone='danger' />
              <Metric label='Документы' value='неполный пакет' tone='warn' />
              <Metric label='Следующий шаг' value='оператор' tone='warn' />
            </div>
          </div>

          <aside style={{ background: '#0F172A', borderRadius: 22, padding: 18, color: '#fff', display: 'grid', gap: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 900, color: '#A7F3D0', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Что остановлено</div>
            <div style={{ fontSize: 24, lineHeight: 1.13, fontWeight: 950 }}>Выплата не выпускается без закрытия документов и спора</div>
            <p style={{ margin: 0, color: '#CBD5E1', fontSize: 13, lineHeight: 1.6 }}>Платформа должна удержать сделку внутри контура: доказательства, ответственный, причина остановки и следующий шаг видны сразу.</p>
            <Link href='/platform-v7/disputes/DK-2024-89' style={{ ...lightButton, justifyContent: 'center' }}>Открыть спор</Link>
          </aside>
        </div>
      </section>

      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 22, padding: 18, display: 'grid', gap: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <div>
            <div style={microLabel}>Сквозной сценарий</div>
            <h2 style={{ margin: '5px 0 0', color: '#0F1419', fontSize: 24 }}>Лот → ставка → сделка → деньги → логистика → приёмка → спор</h2>
          </div>
          <Link href='/platform-v7/demo/execution-flow' style={lightButton}>Показать сценарий</Link>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(138px, 1fr))', gap: 10 }}>
          {EXECUTION_STAGES.map((stage, index) => <StageLink key={stage.title} stage={stage} index={index} />)}
        </div>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(225px, 1fr))', gap: 14 }}>
        {SCENARIO_CARDS.map((scenario) => (
          <ScenarioLink key={scenario.title} scenario={scenario} />
        ))}
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
        <div style={smallPanel}>
          <div style={{ fontSize: 16, fontWeight: 900, color: '#0F1419' }}>Роли приёмки</div>
          <div style={{ fontSize: 13, color: '#64748B', lineHeight: 1.6 }}>Вес, качество и проверка на площадке разнесены по отдельным рабочим кабинетам.</div>
          <InlineRoleLinks mode='receiving' />
        </div>
        <div style={smallPanel}>
          <div style={{ fontSize: 16, fontWeight: 900, color: '#0F1419' }}>Контроль сделки</div>
          <div style={{ fontSize: 13, color: '#64748B', lineHeight: 1.6 }}>Оператор, банк, комплаенс и арбитр видят только свой участок контроля.</div>
          <InlineRoleLinks mode='control' />
        </div>
      </section>

      <nav aria-label='Дополнительные режимы platform-v7' style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        {SECONDARY_LINKS.map((link) => (
          <Link key={link.href} href={link.href} style={pillLink}>{link.title}</Link>
        ))}
      </nav>
    </main>
  );
}

const microLabel = { fontSize: 11, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 900 } as const;
const pillBase = { display: 'inline-flex', alignItems: 'center', width: 'fit-content', padding: '7px 11px', borderRadius: 999, border: '1px solid #E4E6EA', fontSize: 12, fontWeight: 900 } as const;
const pillLink = { textDecoration: 'none', minHeight: 40, display: 'inline-flex', alignItems: 'center', padding: '9px 13px', borderRadius: 999, background: '#fff', border: '1px solid #E4E6EA', color: '#0F1419', fontSize: 13, fontWeight: 850 } as const;
const darkButton = { textDecoration: 'none', display: 'inline-flex', alignItems: 'center', minHeight: 44, padding: '11px 14px', borderRadius: 14, background: '#0F172A', color: '#fff', fontSize: 14, fontWeight: 850 } as const;
const lightButton = { textDecoration: 'none', display: 'inline-flex', alignItems: 'center', minHeight: 44, padding: '11px 14px', borderRadius: 14, background: '#fff', border: '1px solid #CBD5E1', color: '#0F1419', fontSize: 14, fontWeight: 850 } as const;
const smallPanel = { background: '#fff', border: '1px solid #E4E6EA', borderRadius: 20, padding: 18, display: 'grid', gap: 12 } as const;
