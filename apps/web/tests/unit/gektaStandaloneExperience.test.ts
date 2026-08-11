import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

const page = read('app/gekta/page.tsx');
const app = read('components/gekta/GektaChatApp.tsx');
const css = read('components/gekta/GektaChatApp.module.css');
const middleware = read('middleware.ts');
const seoAuthority = read('lib/platform-v7/public-seo-routes.json');

describe('Gekta standalone public experience', () => {
  it('publishes Gekta as a top-level product route with independent metadata', () => {
    expect(page).toContain("canonical: '/gekta'");
    expect(page).toContain("applicationName: 'Гекта'");
    expect(page).toContain("title: 'Гекта — аграрный интеллект для сельского хозяйства и агробизнеса'");
    expect(page).toContain("name: 'Гекта'");
    expect(page).toContain("alternateName: ['Gekta', 'ГЕКТА']");
    expect(page).toContain('<GektaChatApp />');
  });

  it('is anonymously reachable and indexable without entering platform cabinet authority', () => {
    expect(middleware).toContain("const PUBLIC_EXACT = new Set(['/', '/login', '/register', '/gekta']);");
    expect(middleware).toContain("'/api/agro-chat'");
    expect(middleware).toContain("(p === '/' || PLATFORM_V7_INDEXABLE_EXACT.has(p)) && !privateModeEnabled");
    expect(seoAuthority).toContain('{ "path": "/gekta", "priority": 0.95, "changeFrequency": "weekly" }');
  });

  it('uses a dedicated ChatGPT-like shell rather than the platform assistant component', () => {
    expect(app).toContain("data-gekta-standalone='true'");
    expect(app).not.toContain('PublicPlatformAssistant');
    expect(app).not.toMatch(/href=['\"]\/platform-v7/u);
    expect(app).toContain("href='/'");
    expect(app).toContain("newChat: 'Новый диалог'");
    expect(app).toContain("placeholder: 'Опиши задачу по сельскому хозяйству или агробизнесу'");
    expect(css).toContain('grid-template-columns: 286px minmax(0, 1fr)');
    expect(css).toContain('.composerArea');
    expect(css).toContain('.sidebar');
  });

  it('reuses the accepted public streaming boundary without duplicating model infrastructure', () => {
    expect(app).toContain("fetch('/api/agro-chat?stream=1'");
    expect(app).toContain("context: 'gekta-standalone'");
    expect(app).toContain("mode: 'public'");
    expect(app).toContain('readGatewayStream(response');
    expect(app).toContain('AbortController');
    expect(app).toContain('conversationId');
    expect(app).toContain('historyFrom(messages)');
    expect(app).toContain('historyFrom(messages.slice(0, userIndex))');
  });

  it('keeps public authority and current-information limitations explicit', () => {
    expect(app).toContain('Без доступа к личным кабинетам и закрытым данным.');
    expect(app).toContain('Гекта не выполняет действия от имени пользователя');
    expect(app).toContain('не выдумывает актуальные факты без подтверждённого источника');
    expect(app).toContain('Актуальные цены, погода, нормы, субсидии');
    expect(app).toContain('подтверждённого текущего источника');
    expect(app).not.toContain('лучшая в России');
    expect(app).not.toContain('умеет всё');
  });

  it('covers broad agricultural positioning in RU, EN and ZH without module selection', () => {
    for (const phrase of [
      'Дача, огород и ЛПХ',
      'Растениеводство и агрономия',
      'Животноводство',
      'Сельхозтехника и диагностика',
      'Экономика и агробизнес',
      '1С и государственные системы',
      'Documents and calculations',
      '农业机械与诊断',
    ]) {
      expect(app).toContain(phrase);
    }
    expect(app).toContain('без выбора модулей и сложных меню');
  });

  it('preserves mobile, accessibility and rural-network UX boundaries', () => {
    expect(css).toContain('@media (max-width: 820px)');
    expect(css).toContain('@media (max-width: 620px)');
    expect(css).toContain('env(safe-area-inset-bottom)');
    expect(css).toContain('min-height: 44px');
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
    expect(app).toContain("aria-expanded={sidebarOpen}");
    expect(app).toContain("aria-live='polite'");
    expect(app).toContain("maxLength={1_200}");
  });
});
