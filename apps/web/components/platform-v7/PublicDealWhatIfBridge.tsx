'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

type Locale = 'ru' | 'en' | 'zh';
type Scenario = 'standard' | 'partial' | 'dispute';

const SCENARIOS: readonly Scenario[] = ['standard', 'partial', 'dispute'];

const COPY = {
  ru: {
    question: 'Что будет, если…',
    lead: 'Выберите ситуацию — покажем, как изменится ход этой демонстрационной Сделки. Это сценарий интерфейса, а не прогноз.',
    consequence: 'Что изменится',
    options: {
      standard: 'Всё прошло нормально',
      partial: 'Приняли не весь объём',
      dispute: 'Качество не совпало',
    },
    results: {
      standard: 'В демонстрации критических отклонений нет: Сделка продолжает стандартный маршрут по этапам.',
      partial: 'В демонстрации фиксируется фактически принятый объём, а расчётное основание меняется только по подтверждённым данным.',
      dispute: 'В демонстрации расчётный этап останавливается до фиксации доказательств, результата качества и решения по отклонению.',
    },
  },
  en: {
    question: 'What if…',
    lead: 'Choose a situation to see how this demonstration Deal changes. This is an interface scenario, not a prediction.',
    consequence: 'What changes',
    options: {
      standard: 'Everything goes normally',
      partial: 'Only part of the volume is accepted',
      dispute: 'Quality does not match',
    },
    results: {
      standard: 'In the demonstration there are no critical deviations, so the Deal continues through the standard execution path.',
      partial: 'In the demonstration the actually accepted volume is recorded and the settlement basis changes only from confirmed data.',
      dispute: 'In the demonstration the settlement stage stops until evidence, the quality result and the deviation decision are recorded.',
    },
  },
  zh: {
    question: '如果……会怎样？',
    lead: '选择一种情况，查看这笔演示交易的流程会如何变化。这是界面演示场景，不是预测。',
    consequence: '将发生什么变化',
    options: {
      standard: '一切正常完成',
      partial: '只接收了部分数量',
      dispute: '质量不符合约定',
    },
    results: {
      standard: '在演示中没有关键偏差，交易将继续按照标准履约路径推进。',
      partial: '在演示中系统记录实际接收数量，结算依据只根据已确认的数据发生变化。',
      dispute: '在演示中结算阶段会暂停，直到证据、质量结果和偏差处理决定被记录。',
    },
  },
} as const;

function resolveLocale(locale: string): Locale {
  return locale === 'en' || locale === 'zh' ? locale : 'ru';
}

function readScenario(): Scenario {
  if (typeof window === 'undefined') return 'standard';
  const value = new URLSearchParams(window.location.search).get('scenario');
  return SCENARIOS.includes(value as Scenario) ? value as Scenario : 'standard';
}

export function PublicDealWhatIfBridge({ locale }: { locale: string }) {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [scenario, setScenario] = useState<Scenario>('standard');
  const ui = COPY[resolveLocale(locale)];

  useEffect(() => {
    setScenario(readScenario());

    const syncTarget = () => {
      const next = document.querySelector<HTMLElement>('.pc-ppe-v5-scenario');
      setTarget((current) => current === next ? current : next);
    };
    syncTarget();

    const observer = new MutationObserver(syncTarget);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!target) return;
    target.setAttribute('data-what-if-upgraded', 'true');
    return () => target.removeAttribute('data-what-if-upgraded');
  }, [target]);

  useEffect(() => {
    const syncScenario = () => setScenario(readScenario());
    const onAnalytics = (event: Event) => {
      const detail = event instanceof CustomEvent && event.detail && typeof event.detail === 'object'
        ? event.detail as Record<string, unknown>
        : {};
      if (detail.name === 'scenario_selected' || detail.name === 'guided_tour_started') {
        window.requestAnimationFrame(syncScenario);
      }
    };

    window.addEventListener('popstate', syncScenario);
    window.addEventListener('pc:public-product-analytics', onAnalytics);
    return () => {
      window.removeEventListener('popstate', syncScenario);
      window.removeEventListener('pc:public-product-analytics', onAnalytics);
    };
  }, []);

  const selectScenario = (next: Scenario) => {
    const params = new URLSearchParams(window.location.search);
    params.set('scenario', next);
    const url = `${window.location.pathname}?${params.toString()}${window.location.hash}`;
    window.history.pushState({}, '', url);
    setScenario(next);
    window.dispatchEvent(new PopStateEvent('popstate'));
    window.dispatchEvent(new CustomEvent('pc:public-product-analytics', {
      detail: {
        name: 'scenario_selected',
        locale: resolveLocale(locale),
        scenario: next,
        source: 'public_v5_what_if',
      },
    }));
  };

  if (!target) return null;

  return createPortal(
    <div className='pc-ppe-v5-what-if' data-testid='public-deal-what-if'>
      <div className='pc-ppe-v5-what-if-head'>
        <span className='pc-ppe-v5-control-label'>{ui.question}</span>
        <p>{ui.lead}</p>
      </div>
      <div className='pc-ppe-v5-what-if-grid' role='group' aria-label={ui.question}>
        {SCENARIOS.map((key) => (
          <button
            key={key}
            type='button'
            aria-pressed={scenario === key}
            data-active={scenario === key ? 'true' : 'false'}
            onClick={() => selectScenario(key)}
          >
            {ui.options[key]}
          </button>
        ))}
      </div>
      <div className='pc-ppe-v5-what-if-result' role='status' aria-live='polite'>
        <span>{ui.consequence}</span>
        <strong>{ui.results[scenario]}</strong>
      </div>
      <style jsx global>{`
        .pc-ppe-v5-scenario[data-what-if-upgraded='true'] > :not(.pc-ppe-v5-what-if) { display: none !important; }
        .pc-ppe-v5-what-if { display: grid; gap: 12px; }
        .pc-ppe-v5-what-if-head { display: grid; gap: 5px; }
        .pc-ppe-v5-what-if-head p { margin: 0; color: var(--pc-ppe-v5-muted, #53645d); font-size: 13px; line-height: 1.45; }
        .pc-ppe-v5-what-if-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
        .pc-ppe-v5-what-if-grid button { min-height: 52px; padding: 8px 10px; border: 1px solid rgba(8, 122, 59, .18); border-radius: 12px; background: #fff; color: var(--pc-ppe-v5-ink, #092118); font: inherit; font-size: 12px; line-height: 1.25; font-weight: 720; cursor: pointer; touch-action: manipulation; }
        .pc-ppe-v5-what-if-grid button[data-active='true'] { border-color: var(--pc-ppe-v5-green, #087a3b); background: rgba(8, 122, 59, .08); box-shadow: inset 0 0 0 1px rgba(8, 122, 59, .08); }
        .pc-ppe-v5-what-if-grid button:focus-visible { outline: 2px solid var(--pc-ppe-v5-green, #087a3b); outline-offset: 2px; }
        .pc-ppe-v5-what-if-result { display: grid; gap: 4px; padding: 12px 13px; border-radius: 12px; background: rgba(8, 122, 59, .055); border: 1px solid rgba(8, 122, 59, .14); }
        .pc-ppe-v5-what-if-result span { color: var(--pc-ppe-v5-muted, #53645d); font-size: 11px; line-height: 1.2; font-weight: 760; text-transform: uppercase; letter-spacing: .035em; }
        .pc-ppe-v5-what-if-result strong { color: var(--pc-ppe-v5-ink, #092118); font-size: 13px; line-height: 1.42; font-weight: 700; }
        @media (max-width: 520px) {
          .pc-ppe-v5-what-if-grid { grid-template-columns: 1fr; gap: 7px; }
          .pc-ppe-v5-what-if-grid button { min-height: 48px; text-align: left; padding-inline: 13px; }
        }
        @media (prefers-reduced-motion: reduce) {
          .pc-ppe-v5-what-if-grid button { transition: none; }
        }
      `}</style>
    </div>,
    target,
  );
}
