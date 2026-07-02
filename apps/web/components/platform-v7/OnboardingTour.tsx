'use client';

import { useState, useEffect } from 'react';

interface TourStep {
  id: string;
  title: string;
  body: string;
  icon: string;
  role?: string;
}

const STEPS: TourStep[] = [
  {
    id: 'welcome',
    title: 'Добро пожаловать в GrainFlow',
    body: 'GrainFlow — федеральная платформа для зерновых сделок. Здесь деньги, документы, логистика и качество связаны в единую цепочку. Давайте пройдём короткое знакомство.',
    icon: '🌾',
  },
  {
    id: 'roles',
    title: 'Ролевые кабинеты',
    body: 'Каждый участник видит только своё: продавец — лоты и выплаты, покупатель — поставку и риски, оператор — блокеры и SLA, банк — основания и резервы. Переключайтесь через Выбор роли.',
    icon: '👥',
  },
  {
    id: 'deal',
    title: 'Карточка сделки',
    body: 'В карточке сделки — вся цепочка: деньги, документы, рейс, качество и споры. Один экран показывает что заблокировано, кто отвечает и что нужно сделать прямо сейчас.',
    icon: '📋',
  },
  {
    id: 'control-tower',
    title: 'Control Tower',
    body: 'Главная панель оператора: блокеры выплат, SLA-дедлайны, статус банка и ФГИС. Все критичные события — на одном экране с приоритетами.',
    icon: '🗼',
  },
  {
    id: 'money',
    title: 'Когда деньги выходят',
    body: 'Банк переводит деньги только при выполнении условий: документы подтверждены, качество принято, спор закрыт, ФГИС прошёл. Видите блокер — значит, вот что мешает оплате.',
    icon: '💰',
  },
  {
    id: 'done',
    title: 'Готово!',
    body: 'Вы ознакомились с платформой. Начните с выбора роли и перехода в свой кабинет. При вопросах — чат поддержки в правом нижнем углу или раздел Помощь.',
    icon: '✅',
  },
];

const TOUR_KEY = 'pc-onboarding-done';

export function OnboardingTour() {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    try {
      if (!localStorage.getItem(TOUR_KEY)) {
        setVisible(true);
      }
    } catch {}
  }, []);

  function next() {
    if (step < STEPS.length - 1) {
      setStep((s) => s + 1);
    } else {
      finish();
    }
  }

  function prev() {
    setStep((s) => Math.max(0, s - 1));
  }

  function finish() {
    try { localStorage.setItem(TOUR_KEY, '1'); } catch {}
    setVisible(false);
  }

  if (!visible) return null;

  const current = STEPS[step];

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={finish}
        style={{
          position: 'fixed', inset: 0, zIndex: 950,
          background: 'rgba(15,23,42,0.6)',
          backdropFilter: 'blur(2px)',
        }}
      />

      {/* Dialog */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Знакомство с платформой"
        style={{
          position: 'fixed', zIndex: 960,
          top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 'min(480px, calc(100vw - 32px))',
          background: '#fff',
          borderRadius: 24,
          boxShadow: '0 32px 80px rgba(15,23,42,0.28)',
          display: 'grid',
          overflow: 'hidden',
        }}
      >
        {/* Progress bar */}
        <div style={{ height: 4, background: '#F1F5F9' }}>
          <div style={{ height: '100%', width: `${((step + 1) / STEPS.length) * 100}%`, background: '#0A7A5F', transition: 'width 300ms ease' }} />
        </div>

        {/* Content */}
        <div style={{ padding: '2rem', display: 'grid', gap: '1.25rem' }}>
          {/* Step counter */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 10, fontWeight: 900, color: '#0A7A5F', letterSpacing: '0.07em', textTransform: 'uppercase' }}>
              Шаг {step + 1} из {STEPS.length}
            </span>
            <button
              onClick={finish}
              aria-label="Закрыть тур"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', fontSize: 20, lineHeight: 1, padding: 4 }}
            >
              ×
            </button>
          </div>

          {/* Icon + text */}
          <div style={{ textAlign: 'center', display: 'grid', gap: '1rem' }}>
            <div style={{ fontSize: 52 }}>{current.icon}</div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 900, color: '#0F1419', lineHeight: 1.2 }}>{current.title}</div>
              <div style={{ fontSize: 14, color: '#475569', lineHeight: 1.65, marginTop: '0.75rem' }}>{current.body}</div>
            </div>
          </div>

          {/* Step dots */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 6 }}>
            {STEPS.map((_, i) => (
              <div
                key={i}
                style={{ width: i === step ? 20 : 8, height: 8, borderRadius: 999, background: i === step ? '#0A7A5F' : '#E2E8F0', transition: 'width 200ms, background 200ms', cursor: 'pointer' }}
                onClick={() => setStep(i)}
              />
            ))}
          </div>

          {/* Buttons */}
          <div style={{ display: 'grid', gridTemplateColumns: step > 0 ? '1fr 2fr' : '1fr', gap: 8 }}>
            {step > 0 && (
              <button
                onClick={prev}
                style={{ padding: '12px', borderRadius: 12, border: '1px solid #E2E8F0', background: '#fff', color: '#475569', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
              >
                Назад
              </button>
            )}
            <button
              onClick={next}
              style={{ padding: '12px', borderRadius: 12, border: 'none', background: '#0A7A5F', color: '#fff', fontSize: 14, fontWeight: 900, cursor: 'pointer' }}
            >
              {step < STEPS.length - 1 ? 'Далее' : 'Начать работу'}
            </button>
          </div>

          {step < STEPS.length - 1 && (
            <button
              onClick={finish}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', fontSize: 12, textAlign: 'center' }}
            >
              Пропустить тур
            </button>
          )}
        </div>
      </div>
    </>
  );
}
