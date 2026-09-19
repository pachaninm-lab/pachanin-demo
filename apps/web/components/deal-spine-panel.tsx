import Link from 'next/link';
import type { DealSpineView } from '../lib/industrialization-server';

function toneClass(status: string) {
  if (status === 'GREEN') return 'highlight-green';
  if (status === 'RED') return 'highlight-red';
  return 'highlight-amber';
}

export function DealSpinePanel({ spine }: { spine: DealSpineView | null }) {
  if (!spine) return null;

  return (
    <section className="grid cols-2">
      <div className="card">
        <div className="section-title">One Deal Spine</div>
        <div className="muted small" style={{ marginTop: 8 }}>
          Один объект должен держать коммерцию, транспорт, приёмку, лабораторию, документы, деньги, спор, evidence и trust. Тогда оператор и роль открывают не модуль, а текущую сделку.
        </div>
        <div className="stack-sm" style={{ marginTop: 12 }}>
          {spine.sections.map((section) => (
            <div key={section.key} className="soft-box">
              <div className="list-row" style={{ alignItems: 'flex-start' }}>
                <div>
                  <b>{section.title}</b>
                  <div className="muted small">{section.owner}</div>
                </div>
                <span className={toneClass(section.status)}>{section.status}</span>
              </div>
              <div className="muted small" style={{ marginTop: 8 }}>{section.summary}</div>
              <div className="cta-stack" style={{ marginTop: 10 }}>
                <Link href={section.href} className="secondary-link">Открыть {section.title}</Link>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="section-title">Next step from deal spine</div>
        <div className="muted small" style={{ marginTop: 8 }}>
          Взрослый execution rail должен отвечать на один вопрос: что сейчас мешает дойти от цены до денег и кто это закрывает.
        </div>
        <div className="soft-box" style={{ marginTop: 12 }}>
          <b>{spine.nextStep}</b>
          <div className="muted small" style={{ marginTop: 6 }}>
            Primary CTA всегда ведёт в ближайший незелёный контур, а не в обзорную витрину.
          </div>
        </div>
        <div className="section-stack" style={{ marginTop: 12 }}>
          {spine.blockers.length ? spine.blockers.map((item) => (
            <div key={item} className="list-row"><span>{item}</span><b>blocker</b></div>
          )) : <div className="muted tiny">Критичных блокеров не видно.</div>}
        </div>
        <div className="cta-stack" style={{ marginTop: 14 }}>
          <Link href={spine.primaryCtaHref} className="primary-link">{spine.primaryCtaLabel}</Link>
          <Link href="/trust-center" className="secondary-link">Trust / admission</Link>
          <Link href="/liquidity-layer" className="secondary-link">Managed liquidity</Link>
        </div>
      </div>
    </section>
  );
}
