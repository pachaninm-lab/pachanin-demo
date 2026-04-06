'use client';

import { useState } from 'react';

export function OnboardingTour({ steps }: { steps: Array<{ id: string; title: string; detail?: string }> }) {
  const [index, setIndex] = useState(0);
  const step = steps[index];
  if (!step) return null;
  return (
    <section className="card">
      <div className="section-title">Onboarding tour</div>
      <div className="soft-box" style={{ marginTop: 12 }}>
        <b>{step.title}</b>
        {step.detail ? <div className="muted small" style={{ marginTop: 6 }}>{step.detail}</div> : null}
      </div>
      <div className="cta-stack" style={{ marginTop: 12 }}>
        <button className="button secondary compact" onClick={() => setIndex((v) => Math.max(0, v - 1))}>Назад</button>
        <button className="button secondary compact" onClick={() => setIndex((v) => Math.min(steps.length - 1, v + 1))}>Дальше</button>
      </div>
    </section>
  );
}
