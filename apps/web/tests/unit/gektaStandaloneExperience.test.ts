import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

const page = read('app/gekta/page.tsx');
const enPage = read('app/gekta/en/page.tsx');
const zhPage = read('app/gekta/zh/page.tsx');
const product = read('components/gekta/GektaProductShell.tsx');
const workspace = read('components/gekta/GektaChatWorkspace.tsx');
const sidebar = read('components/gekta/GektaSidebar.tsx');
const composer = read('components/gekta/GektaComposer.tsx');
const attachments = read('components/gekta/GektaAttachments.tsx');
const markdown = read('components/gekta/GektaMarkdown.tsx');
const sources = read('components/gekta/GektaSourceList.tsx');
const content = read('lib/gekta/content.ts');
const seo = read('lib/gekta/seo.ts');
const middleware = read('middleware.ts');
const seoAuthority = read('lib/platform-v7/public-seo-routes.json');
const liveAcceptance = read('../../scripts/production-web-live-acceptance.sh');

describe('Gekta standalone public experience', () => {
  it('keeps product meaning server-rendered and the chat client-isolated', () => {
    expect(page).not.toContain("'use client'");
    expect(product).not.toContain("'use client'");
    expect(page).toContain("<GektaProductShell locale='ru' />");
    expect(product).toContain('<GektaHero locale={locale} />');
    expect(product).toContain('<GektaDiscoverySections locale={locale} />');
    expect(workspace).toContain("'use client'");
    expect(content).toContain('Гекта — аграрный ИИ для сельского хозяйства и агробизнеса');
    expect(content).toContain('Не просто чат. Аграрный контекст в одном диалоге.');
    expect(content).toContain('Для тех, кто принимает решения в сельском хозяйстве');
    expect(content).toContain('Факты, предположения и риски не смешиваются');
  });

  it('uses exact RU metadata and standalone locale URLs with cross-language alternates', () => {
    expect(seo).toContain("title: { absolute: meta.title }");
    expect(seo).toContain('Гекта — аграрный ИИ для сельского хозяйства и агробизнеса');
    expect(seo).toContain('Гекта — аграрный ИИ для фермеров и агробизнеса: агрономия, растениеводство, животноводство, техника, хранение, экономика, документы и расчёты.');
    expect(seo).toContain("'ru-RU': '/gekta'");
    expect(seo).toContain("en: '/gekta/en'");
    expect(seo).toContain("'zh-CN': '/gekta/zh'");
    expect(seo).toContain("'x-default': '/gekta'");
    expect(enPage).toContain("locale='en'");
    expect(zhPage).toContain("locale='zh'");
  });

  it('redirects compatibility lang queries permanently while preserving unrelated query parameters', () => {
    expect(middleware).toContain('function legacyGektaLocaleRedirect');
    expect(middleware).toContain("target.searchParams.delete('lang')");
    expect(middleware).toContain("target.pathname = lang === 'en' ? '/gekta/en' : lang === 'zh' ? '/gekta/zh' : '/gekta'");
    expect(middleware).toContain('NextResponse.redirect(target, 301)');
    expect(middleware).toContain("p.startsWith('/gekta/')");
    expect(middleware).toContain('resolveGektaPathLocale');
    expect(middleware).toContain("requestHeaders.set('x-pc-locale', requestLocale)");
  });

  it('provides real conversation management instead of a static capabilities sidebar', () => {
    expect(sidebar).toContain('Search history');
    expect(sidebar).toContain('Переименовать');
    expect(sidebar).toContain('Очистить историю');
    expect(sidebar).toContain('<GektaConversationList');
    expect(sidebar).not.toContain('С чем помогает');
    expect(workspace).toContain('const HISTORY_STORAGE');
    expect(workspace).toContain('renameConversation');
    expect(workspace).toContain('deleteConversation');
    expect(workspace).toContain('clearHistory');
  });

  it('reuses the governed public streaming and attachment boundaries without a second backend', () => {
    expect(workspace).toContain("fetch('/api/agro-chat?stream=1'");
    expect(workspace).toContain("context: 'gekta-standalone'");
    expect(workspace).toContain("mode: 'public'");
    expect(workspace).toContain('readGatewayStream(response');
    expect(workspace).toContain('AbortController');
    expect(workspace).toContain('historyFrom(');
    expect(attachments).toContain("fetch('/api/public-platform-assistant/attachments'");
    expect(attachments).toContain('MAX_FILES = 4');
    expect(attachments).toContain('MAX_FILE_SIZE = 10 * 1024 * 1024');
    expect(attachments).toContain('onDrop=');
  });

  it('supports markdown, tables, safe links, sources, stop/retry/copy and safe-area composer UX', () => {
    expect(markdown).toContain("url.protocol === 'http:' || url.protocol === 'https:'");
    expect(markdown).toContain("className='my-4 max-w-full overflow-x-auto rounded-2xl border border-slate-200'");
    expect(markdown).not.toContain('dangerouslySetInnerHTML');
    expect(sources).toContain("url.protocol === 'https:' || url.protocol === 'http:'");
    expect(sources).toContain('<details');
    expect(composer).toContain('env(safe-area-inset-bottom)');
    expect(composer).toContain("id='gekta-composer-input'");
    expect(composer).toContain('onStop');
    expect(workspace).toContain('retry');
    expect(workspace).toContain('copyMessage');
    expect(workspace).toContain('showScroll');
  });

  it('emits privacy-safe analytics names without putting prompt or answer bodies into event payloads', () => {
    for (const event of ['gekta_page_view', 'gekta_prompt_submitted', 'gekta_answer_started', 'gekta_answer_completed', 'gekta_answer_stopped', 'gekta_retry', 'gekta_source_opened', 'gekta_starter_used', 'gekta_new_chat', 'gekta_locale_changed']) {
      expect(workspace).toContain(event);
    }
    expect(workspace).toContain("{ hasAttachments: attached.length > 0 }");
    expect(workspace).toContain("{ sourceCount: finalMessage.citations?.length || 0 }");
    expect(workspace).not.toMatch(/track\([^\n]+question/u);
    expect(workspace).not.toMatch(/track\([^\n]+message\.text/u);
  });

  it('registers locale and topic pages in the existing sitemap authority only', () => {
    for (const route of ['/gekta', '/gekta/en', '/gekta/zh', '/gekta/agronomiya-rastenievodstvo', '/gekta/zhivotnovodstvo', '/gekta/selhoztehnika', '/gekta/agrobiznes', '/gekta/hranenie-logistika', '/gekta/dokumenty-raschety', '/gekta/dacha-lph']) {
      expect(seoAuthority).toContain(`\"path\": \"${route}\"`);
    }
    expect(content).toContain("slug: 'agronomiya-rastenievodstvo'");
    expect(content).toContain("slug: 'dacha-lph'");
  });

  it('keeps unaccepted infrastructure and fabricated proof out of the standalone public surface', () => {
    const publicSource = [product, workspace, sidebar, composer, attachments, markdown, sources, content, seo].join('\n');
    expect(publicSource).not.toMatch(/llama\.cpp|Qwen3|private model endpoint|system prompt|chain-of-thought/iu);
    expect(seo).not.toMatch(/aggregateRating|reviewCount|ratingValue|offers|award/iu);
    expect(content).not.toContain('№1 в России');
    expect(content).not.toContain('лучшая в России');
    expect(content).not.toContain('умеет всё');
  });

  it('makes exact-SHA live acceptance inspect canonical crawler HTML and the real SSE boundary', () => {
    expect(liveAcceptance).toContain('$LIVE_BASE/gekta/en?release=$cache_bust');
    expect(liveAcceptance).toContain('$LIVE_BASE/gekta/zh?release=$cache_bust');
    expect(liveAcceptance).toContain('GEKTA_CRAWLER_HTML=PASS');
    expect(liveAcceptance).toContain('GEKTA_COMPAT_REDIRECT=PASS');
    expect(liveAcceptance).toContain('GEKTA_STREAM=PASS');
    expect(liveAcceptance).toContain('/api/agro-chat?stream=1');
    expect(liveAcceptance).toContain("\"event\":\"done\"");
  });
});