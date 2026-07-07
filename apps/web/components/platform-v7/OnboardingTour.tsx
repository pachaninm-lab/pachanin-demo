'use client';

import { useState, useEffect } from 'react';

interface TourStep {
  id: string;
  title: string;
  body: string;
}

const STEPS: TourStep[] = [
  {
    id: 'deal',
    title: 'Контур сделки',
    body: 'Сделка связывает цену, логистику, приёмку, качество, документы, деньги и спор в одном рабочем процессе.',
  },
  {
    id: 'roles',
    title: 'Роли',
    body: 'Каждый участник видит только свои действия: продавец, покупатель, логистика, водитель, элеватор, лаборатория, банк и оператор.',
  },
  {
    id: 'money',
    title: 'Деньги и основания',
    body: 'Банковский шаг зависит от подтверждённых событий сделки, документов, качества и статуса спора.',
  },
];

const TOUR_KEY = 'pc-onboarding-done';
const TOUR_EVENT = 'pc-v7-open-tour';

export function OnboardingTour() {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    function openTour() {
      setStep(0);
      setVisible(true);
    }

    window.addEventListener(TOUR_EVENT, openTour);
    return () => window.removeEventListener(TOUR_EVENT, openTour);
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
      <div
        onClick={finish}
        style={{
          position: 'fixed', inset: 0, zIndex: 950,
          background: 'rgba(15,23,42,0.42)',
          backdropFilter: 'blur(2px)',
        }}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Краткий обзор платформы"
        style={{
          position: 'fixed', zIndex: 960,
          top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 'min(420px, calc(100vw - 32px))',
          background: '#fff',
          borderRadius: 22,
          boxShadow: '0 28px 70px rgba(15,23,42,0.24)',
          display: 'grid',
          overflow: 'hidden',
        }}
      >
        <div style={{ height: 3, background: '#F1F5F9' }}>
          <div style={{ height: '100%', width: `${((step + 1) / STEPS.length) * 100}%`, background: '#0A7A5F', transition: 'width 260ms ease' }} />
        </div>

        <div style={{ padding: '22px', display: 'grid', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 10, fontWeight: 900, color: '#0A7A5F', letterSpacing: '0.07em', textTransform: 'uppercase' }}>
              {step + 1} / {STEPS.length}
            </span>
            <button
              onClick={finish}
              aria-label="Закрыть обзор"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', fontSize: 20, lineHeight: 1, padding: 4 }}
            >
              ×
            </button>
          </div>

          <div style={{ display: 'grid', gap: '8px' }}>
            <div style={{ fontSize: 21, fontWeight: 900, color: '#0F1419', lineHeight: 1.18 }}>{current.title}</div>
            <div style={{ fontSize: 14, color: '#475569', lineHeight: 1.52 }}>{current.body}</div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: step > 0 ? '1fr 2fr' : '1fr', gap: 8 }}>
            {step > 0 && (
              <button
                onClick={prev}
                style={{ padding: '11px', borderRadius: 12, border: '1px solid #E2E8F0', background: '#fff', color: '#475569', fontSize: 14, fontWeight: 760, cursor: 'pointer' }}
              >
                Назад
              </button>
            )}
            <button
              onClick={next}
              style={{ padding: '11px', borderRadius: 12, border: 'none', background: '#0A7A5F', color: '#fff', fontSize: 14, fontWeight: 900, cursor: 'pointer' }}
            >
              {step < STEPS.length - 1 ? 'Далее' : 'Закрыть'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
