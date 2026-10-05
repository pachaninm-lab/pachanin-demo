import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { CanonicalMarketPreview, CanonicalMarketResults } from '@/components/platform-v7/PublicCanonicalMarket';
import { LoginFormClient, type LoginCopy } from '@/app/platform-v7/login/LoginFormClient';
import { RegisterFormClient } from '@/app/platform-v7/register/RegisterFormClient';
import TermsPage from '@/app/platform-v7/terms/page';

const provider = vi.hoisted(() => ({ available: true }));
vi.mock('@/lib/public-market-server', () => ({ getPublicMarketLots: async () => ({ available: provider.available, items: [] }) }));

function documentFor(element: React.ReactNode) {
  return new DOMParser().parseFromString(renderToStaticMarkup(element), 'text/html');
}

describe('public QA presentation regressions', () => {
  for (const locale of ['ru', 'en', 'zh'] as const) {
    it(`keeps buyer and seller navigation with the complete empty-market context (${locale})`, async () => {
      provider.available = true;
      const doc = documentFor(await CanonicalMarketResults({ locale, query: 'grain', filters: { crop: 'barley', region: 'Rostov', grade: '3' }, sort: 'volume-desc' }));
      for (const intent of ['buy', 'sell']) {
        const links = [...doc.querySelectorAll('[data-market-state="empty"] a')];
        const link = links.find(a => new URL(a.getAttribute('href')!, 'https://test.invalid').searchParams.get('intent') === intent);
        expect(link).toBeDefined();
        const target = new URL(link!.getAttribute('href')!, 'https://test.invalid');
        expect(target.pathname).toBe('/platform-v7/register');
        expect(target.searchParams.get('lang')).toBe(locale);
        expect(target.searchParams.get('crop')).toBe('barley');
        expect(target.searchParams.has('lot')).toBe(false);
        const back = new URL(target.searchParams.get('returnTo')!, 'https://test.invalid');
        expect(Object.fromEntries(back.searchParams)).toEqual({ lang: locale, q: 'grain', crop: 'barley', region: 'Rostov', grade: '3', sort: 'volume-desc' });
      }
    });

    it(`keeps unavailable data distinct from an empty market (${locale})`, async () => {
      provider.available = false;
      const doc = documentFor(await CanonicalMarketResults({ locale }));
      const links = doc.querySelectorAll('[data-market-state="unavailable"] a');
      expect(links).toHaveLength(1);
      expect(links[0]!.getAttribute('href')).toBe(`/platform-v7/market?lang=${locale}`);
    });

    it(`preserves the explicit Login locale on recovery and registration (${locale})`, () => {
      const copy = new Proxy({ locale }, { get: (target, key) => key === 'locale' ? target.locale : String(key) }) as LoginCopy & { locale: typeof locale };
      const doc = documentFor(<LoginFormClient copy={copy} />);
      expect(doc.querySelector('.pc-auth-recovery-link')?.getAttribute('href')).toBe(`/platform-v7/forgot-password?lang=${locale}`);
      expect(doc.querySelector('.pc-auth-register a')?.getAttribute('href')).toBe(`/platform-v7/register?lang=${locale}`);
    });

    it(`connects identifier format hints without changing required fields (${locale})`, () => {
      const doc = documentFor(<RegisterFormClient locale={locale} />);
      for (const [name, numbers] of [['orgInn', ['10', '12']], ['orgKpp', ['9']], ['orgOgrn', ['13', '15']]] as const) {
        const input = doc.querySelector<HTMLInputElement>(`input[name="${name}"]`)!;
        const hint = doc.getElementById(input.getAttribute('aria-describedby')!);
        expect(hint).not.toBeNull();
        for (const number of numbers) expect(hint!.textContent).toContain(number);
        expect(input.required).toBe(name === 'orgInn');
      }
      expect([...doc.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')].every(input => !input.checked)).toBe(true);
    });
  }

  it('describes the docs destination as Deal documentation rather than a legal catalogue', () => {
    const doc = documentFor(<TermsPage />);
    const link = doc.querySelector('a[href="/platform-v7/docs"]');
    expect(link?.textContent).toContain('Документы в сделке');
    expect(link?.textContent).not.toContain('Политика конфиденциальности');
  });

  // DOM/CSS composition regression with the actual homepage ancestry and loaded
  // stylesheet. This covers the mobile selector collision, not browser release.
  for (const locale of ['ru', 'en', 'zh'] as const) {
    for (const width of [390, 760, 761, 1280]) {
      for (const kind of ['empty', 'unavailable'] as const) {
        it('keeps homepage '+kind+' recovery visible at '+width+'px ('+locale+')', async () => {
          provider.available = kind === 'empty';
          const homeSource = readFileSync(join(process.cwd(), 'components/platform-v7/PlatformV7StrategicHome.tsx'), 'utf8');
          const mainClass = homeSource.match(/<main className='([^']*pc-cp-page-home[^']*)'/u)?.[1];
          expect(mainClass).toBeDefined();
          expect(homeSource).toContain("<section className='pc-cp-section' id='market'");
          expect(homeSource).toContain('<CanonicalMarketPreview locale={locale} limit={4} />');
          const entrySource = readFileSync(join(process.cwd(), 'app/platform-v7/page.tsx'), 'utf8');
          expect(entrySource).toContain("import '@/styles/platform-v7-canonical-home-v1.css'");
          const homeCss = readFileSync(join(process.cwd(), 'styles/platform-v7-canonical-home-v1.css'), 'utf8');
          const style = document.createElement('style');
          // Semantically identical media whitespace lets happy-dom parse the
          // existing compact CSS. No production stylesheet is changed.
          style.textContent = homeCss.replace(/@media(?=\()/gu, '@media ');
          const viewportApi: unknown = Reflect.get(window, 'happyDOM');
          if (typeof viewportApi !== 'object' || viewportApi === null
            || !('setWindowSize' in viewportApi) || typeof viewportApi.setWindowSize !== 'function') {
            throw new Error('Native happy-dom viewport API is required for the CSS regression');
          }
          const resizeWindow = viewportApi.setWindowSize;
          const resize = (size: { width: number; height: number }) => Reflect.apply(resizeWindow, viewportApi, [size]);
          const previous = { width: window.innerWidth, height: window.innerHeight };
          const root = document.createElement('div');
          try {
            resize({ width, height: 900 });
            document.head.appendChild(style);
            const preview = await CanonicalMarketPreview({ locale, limit: 4 });
            root.innerHTML = renderToStaticMarkup(
              <main className={mainClass}>
                <section className='pc-cp-section' id='market'>
                  <div className='pc-cp-container'>{preview}</div>
                </section>
              </main>,
            );
            document.body.appendChild(root);
            const container = root.querySelector<HTMLElement>('#market > .pc-cp-container')!;
            const control = document.createElement('div');
            control.className = 'pc-cp-actions';
            container.appendChild(control);
            if (width <= 760) expect(window.getComputedStyle(control).display).toBe('none');
            else expect(window.getComputedStyle(control).display).not.toBe('none');
            const state = root.querySelector<HTMLElement>('[data-market-state="'+kind+'"]')!;
            const links = [...state.querySelectorAll<HTMLAnchorElement>('a')];
            expect(links).toHaveLength(kind === 'empty' ? 2 : 1);
            for (const link of links) {
              for (let ancestor: HTMLElement | null = link; ancestor && ancestor !== root; ancestor = ancestor.parentElement) {
                expect(window.getComputedStyle(ancestor).display).not.toBe('none');
                expect(window.getComputedStyle(ancestor).visibility).not.toBe('hidden');
              }
            }
          } finally {
            root.remove();
            style.remove();
            resize(previous);
          }
        });
      }
    }
  }
});
