'use client';

import * as React from 'react';
import { ArrowRight } from 'lucide-react';
import { createPortal } from 'react-dom';

type Locale = 'ru' | 'en' | 'zh';

const COPY = {
  ru: {
    title: 'ИИ работает в платформе',
    text: 'Показывает риски, объясняет причины и готовит следующий шаг. Критические действия остаются за участником.',
    aria: 'Открыть страницу о работе ИИ в платформе',
  },
  en: {
    title: 'AI is active in the platform',
    text: 'Highlights risks, explains causes and prepares the next step. Consequential actions remain with the participant.',
    aria: 'Open the platform AI in action page',
  },
  zh: {
    title: 'AI 已在平台中运行',
    text: '识别风险、解释原因并准备下一步。重要操作仍由参与方确认和执行。',
    aria: '打开平台 AI 工作说明页面',
  },
} as const;

function resolveLocale(): Locale {
  const query = new URLSearchParams(window.location.search).get('lang');
  if (query === 'en' || query === 'zh') return query;
  const htmlLocale = document.documentElement.lang.toLowerCase();
  if (htmlLocale.startsWith('en')) return 'en';
  if (htmlLocale.startsWith('zh')) return 'zh';
  return 'ru';
}

function isPublicHome(pathname: string): boolean {
  const clean = pathname.replace(/\/+$/u, '') || '/';
  return clean === '/' || clean === '/platform-v7' || clean === '/pc-public-entry/platform-v7';
}

export function SingleServerHomeAiEntry() {
  const [mount, setMount] = React.useState<HTMLElement | null>(null);
  const [locale, setLocale] = React.useState<Locale>('ru');

  React.useEffect(() => {
    if (!isPublicHome(window.location.pathname)) return;

    setLocale(resolveLocale());
    const hero = document.querySelector<HTMLElement>('.pc-ppe-hero-copy');
    if (!hero) return;

    const existing = hero.querySelector<HTMLElement>("[data-single-server-ai-entry='true']");
    if (existing) {
      setMount(existing);
      return;
    }

    const node = document.createElement('div');
    node.dataset.singleServerAiEntry = 'true';
    const publicMode = hero.querySelector<HTMLElement>('.pc-ppe-public-status');
    if (publicMode) hero.insertBefore(node, publicMode);
    else hero.appendChild(node);
    setMount(node);

    return () => node.remove();
  }, []);

  if (!mount) return null;
  const ui = COPY[locale];

  return createPortal(
    <>
      <a
        className='pc-ss-home-ai-entry'
        href={`/platform-v7/ai-in-action?lang=${locale}`}
        aria-label={ui.aria}
      >
        <span>
          <strong>{ui.title}</strong>
          <small>{ui.text}</small>
        </span>
        <ArrowRight size={20} aria-hidden='true' />
      </a>
      <style>{css}</style>
    </>,
    mount,
  );
}

const css = `
[data-single-server-ai-entry='true']{display:block;margin-top:16px}
.pc-ss-home-ai-entry{display:grid;grid-template-columns:minmax(0,1fr) 32px;align-items:center;gap:12px;min-height:72px;padding:13px 14px;border:1px solid #9fceb0;border-radius:15px;background:linear-gradient(145deg,#eff9f2,#e5f4ea);color:#07572e;text-decoration:none;box-shadow:0 8px 22px rgba(8,57,36,.06)}
.pc-ss-home-ai-entry>span{display:grid;gap:4px;min-width:0}.pc-ss-home-ai-entry strong{font-size:15px;line-height:1.22;font-weight:850;letter-spacing:-.012em}.pc-ss-home-ai-entry small{display:-webkit-box;overflow:hidden;-webkit-line-clamp:2;-webkit-box-orient:vertical;color:#496158;font-size:13px;line-height:1.4;font-weight:560}.pc-ss-home-ai-entry>svg{justify-self:end;color:#087a3b;transition:transform .16s ease}.pc-ss-home-ai-entry:hover>svg,.pc-ss-home-ai-entry:focus-visible>svg{transform:translateX(3px)}.pc-ss-home-ai-entry:focus-visible{outline:3px solid #17649b;outline-offset:3px}
[data-single-server-ai-entry='true']+.pc-ppe-public-status{margin-top:8px!important;padding:10px 12px!important;border-radius:12px!important;background:#f8faf9!important;box-shadow:none!important}[data-single-server-ai-entry='true']+.pc-ppe-public-status strong{font-size:12px!important}[data-single-server-ai-entry='true']+.pc-ppe-public-status>span{font-size:12px!important;line-height:1.38!important}
@media(min-width:761px){[data-single-server-ai-entry='true']{max-width:760px;margin-top:22px}.pc-ss-home-ai-entry{min-height:78px;padding:15px 16px}.pc-ss-home-ai-entry strong{font-size:16px}.pc-ss-home-ai-entry small{font-size:14px}}
@media(prefers-reduced-motion:reduce){.pc-ss-home-ai-entry>svg{transition:none}}
`;
