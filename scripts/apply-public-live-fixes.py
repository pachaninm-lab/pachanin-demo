from __future__ import annotations

import json
from pathlib import Path


def replace_exact(path: str, old: str, new: str) -> None:
    target = Path(path)
    source = target.read_text()
    if old not in source:
        raise RuntimeError(f'missing expected source in {path}: {old[:120]!r}')
    target.write_text(source.replace(old, new))


replace_exact(
    'apps/web/app/v9.css',
    "@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');\n@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&display=swap');\n",
    '',
)
replace_exact(
    'apps/web/app/v9.css',
    "  --font-sans: 'Inter', system-ui, sans-serif;\n  --font-mono: 'JetBrains Mono', ui-monospace, monospace;",
    "  --font-sans: var(--font-inter, 'Inter'), system-ui, sans-serif;\n  --font-mono: var(--font-jetbrains-mono, 'JetBrains Mono'), ui-monospace, monospace;",
)

replace_exact(
    'apps/web/app/layout.tsx',
    '<html lang={HTML_LANG[locale] ?? \'ru\'} translate="no" className={`notranslate ${inter.variable} ${manrope.variable} ${jetbrainsMono.variable}`}>',
    '<html lang={HTML_LANG[locale] ?? \'ru\'} translate="no" data-theme="light" suppressHydrationWarning className={`notranslate ${inter.variable} ${manrope.variable} ${jetbrainsMono.variable}`}>',
)
replace_exact(
    'apps/web/app/layout.tsx',
    '        {/* D-20: preconnect to Google Fonts for faster font load */}\n        <link rel="preconnect" href="https://fonts.googleapis.com" />\n        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />\n',
    '',
)

replace_exact(
    'apps/web/middleware.ts',
    "function applySecurityHeaders(response: NextResponse, protectedResponse = false) {\n  response.headers.set('x-robots-tag', 'noindex, nofollow, noarchive, nosnippet, noimageindex');",
    "function applySecurityHeaders(response: NextResponse, protectedResponse = false, indexable = false) {\n  response.headers.set(\n    'x-robots-tag',\n    indexable ? 'index, follow, max-image-preview:large' : 'noindex, nofollow, noarchive, nosnippet, noimageindex'\n  );",
)
replace_exact(
    'apps/web/middleware.ts',
    'payment=(), usb=(), bluetooth=(), accelerometer=(), gyroscope=()',
    'payment=(), usb=(), accelerometer=(), gyroscope=()',
)
replace_exact(
    'apps/web/middleware.ts',
    'function withRoleHeaders(req: NextRequest, role: string, protectedResponse = false) {',
    'function withRoleHeaders(req: NextRequest, role: string, protectedResponse = false, indexable = false) {',
)
replace_exact(
    'apps/web/middleware.ts',
    '  return applySecurityHeaders(response, protectedResponse || Boolean(queryLocale));',
    '  return applySecurityHeaders(response, protectedResponse || Boolean(queryLocale), indexable);',
)
replace_exact(
    'apps/web/middleware.ts',
    "    const response = withRoleHeaders(req, resolvedRole, privateModeEnabled && protectedPath);\n    persistRoleCookie(req, response, resolvedRole);\n    if (isEntry) markPlatformV7Entry(response);",
    "    const response = withRoleHeaders(req, resolvedRole, privateModeEnabled && protectedPath, isEntry && !privateModeEnabled);\n    persistRoleCookie(req, response, resolvedRole);\n    if (isEntry) markPlatformV7Entry(response);",
)

page = Path('apps/web/app/platform-v7/page.tsx')
page_source = page.read_text()
if "import type { Metadata } from 'next';" not in page_source:
    page_source = page_source.replace("import Link from 'next/link';", "import type { Metadata } from 'next';\nimport Link from 'next/link';")
metadata = """export const metadata: Metadata = {
  title: 'Прозрачная Цена — исполнение зерновой сделки',
  description: 'Цифровой контур исполнения внебиржевой зерновой сделки: логистика, приёмка, качество, документы, расчёты, спор и доказательства.',
  alternates: {
    canonical: '/platform-v7',
    languages: {
      ru: '/platform-v7?lang=ru',
      en: '/platform-v7?lang=en',
      zh: '/platform-v7?lang=zh',
    },
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
};

"""
marker = "type Card = { key: string; Icon: LucideIcon };"
if metadata not in page_source:
    if marker not in page_source:
        raise RuntimeError('landing metadata insertion marker missing')
    page_source = page_source.replace(marker, metadata + marker)
page_source = page_source.replace(
    "<div className='entry-process-row'>",
    "<div className='entry-process-row' tabIndex={0} role='region' aria-label={t('process.title')}>",
)
page.write_text(page_source)

Path('apps/web/components/platform-v7/PlatformV7ProtectedShell.tsx').write_text("""'use client';

import * as React from 'react';
import { AppShellV4 } from '@/components/v7r/AppShellV4';
import { ShellCopyNormalizer } from '@/components/v7r/ShellCopyNormalizer';
import { ScopedShellGuard } from '@/components/platform-v7/ScopedShellGuard';
import { RbacCabinetGuard } from '@/components/platform-v7/RbacCabinetGuard';
import { PlatformV7SingleEntryGuard } from '@/components/platform-v7/PlatformV7SingleEntryGuard';
import { PlatformV7ShellUxController } from '@/components/platform-v7/PlatformV7ShellUxController';
import { CalculatorHeaderWidget } from '@/components/platform-v7/CalculatorHeaderWidget';
import { MobileHeaderActionRail } from '@/components/platform-v7/MobileHeaderActionRail';
import { NotepadHeaderWidget } from '@/components/platform-v7/NotepadHeaderWidget';
import { RoleAssistantWidget } from '@/components/platform-v7/RoleAssistantWidget';
import { PlatformFooter } from '@/components/platform-v7/PlatformFooter';
import { OnboardingTour } from '@/components/platform-v7/OnboardingTour';
import { SupportHeaderIcon } from '@/components/platform-v7/SupportHeaderIcon';
import { HeaderLanguageSwitch } from '@/components/platform-v7/HeaderLanguageSwitch';
import { RoleIntentDashboard } from '@/components/platform-v7/RoleIntentDashboard';
import type { PlatformRole } from '@/stores/usePlatformV7RStore';

const ROLE_INTENT_ROOT_PATHS = new Set([
  '/platform-v7/control-tower',
  '/platform-v7/buyer',
  '/platform-v7/seller',
  '/platform-v7/logistics',
  '/platform-v7/driver',
  '/platform-v7/surveyor',
  '/platform-v7/elevator',
  '/platform-v7/lab',
  '/platform-v7/bank',
  '/platform-v7/compliance',
  '/platform-v7/arbitrator',
  '/platform-v7/executive',
]);

function normalizePath(pathname: string): string {
  return pathname.split('?')[0].replace(/\\/$/, '') || '/platform-v7';
}

function roleFromPath(pathname: string): PlatformRole {
  const path = normalizePath(pathname);
  if (path.startsWith('/platform-v7/driver')) return 'driver';
  if (path.startsWith('/platform-v7/surveyor')) return 'surveyor';
  if (path.startsWith('/platform-v7/elevator')) return 'elevator';
  if (path.startsWith('/platform-v7/lab')) return 'lab';
  if (path.startsWith('/platform-v7/bank')) return 'bank';
  if (path.startsWith('/platform-v7/arbitrator') || path.startsWith('/platform-v7/disputes')) return 'arbitrator';
  if (path.startsWith('/platform-v7/compliance') || path.startsWith('/platform-v7/connectors')) return 'compliance';
  if (path.startsWith('/platform-v7/buyer') || path.startsWith('/platform-v7/procurement')) return 'buyer';
  if (path.startsWith('/platform-v7/seller') || path.startsWith('/platform-v7/lots')) return 'seller';
  if (path.startsWith('/platform-v7/logistics')) return 'logistics';
  if (path.startsWith('/platform-v7/executive') || path.startsWith('/platform-v7/analytics')) return 'executive';
  return 'operator';
}

export function PlatformV7ProtectedShell({ pathname, children }: { pathname: string; children: React.ReactNode }) {
  const initialRole = roleFromPath(pathname);
  const workSurface = ROLE_INTENT_ROOT_PATHS.has(normalizePath(pathname))
    ? <RoleIntentDashboard role={initialRole} />
    : children;

  return (
    <>
      <ShellCopyNormalizer />
      <AppShellV4 initialRole={initialRole}>
        <>
          <ScopedShellGuard />
          <PlatformV7SingleEntryGuard />
          <PlatformV7ShellUxController />
          <RbacCabinetGuard />
          <ShellCopyNormalizer />
          <HeaderLanguageSwitch />
          <CalculatorHeaderWidget />
          <NotepadHeaderWidget />
          <SupportHeaderIcon />
          <MobileHeaderActionRail />
          <RoleAssistantWidget />
          {workSurface}
          <PlatformFooter />
          <OnboardingTour />
        </>
      </AppShellV4>
    </>
  );
}
""")

Path('apps/web/components/platform-v7/PlatformV7ShellSwitch.tsx').write_text("""'use client';

import * as React from 'react';
import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';

const PlatformV7ProtectedShell = dynamic(
  () => import('@/components/platform-v7/PlatformV7ProtectedShell').then((module) => module.PlatformV7ProtectedShell)
);

const PUBLIC_EXACT_PATHS = new Set([
  '/platform-v7',
  '/platform-v7/open',
  '/platform-v7/login',
  '/platform-v7/forgot-password',
  '/platform-v7/register',
  '/platform-v7/help',
  '/platform-v7/pricing',
  '/platform-v7/roadmap',
  '/platform-v7/deal-flow',
  '/platform-v7/demo',
  '/platform-v7/contact',
  '/platform-v7/request',
  '/platform-v7/docs',
]);
const PUBLIC_PREFIX_PATHS = ['/platform-v7/role-preview'];

function normalizePath(pathname: string): string {
  return pathname.split('?')[0].replace(/\\/$/, '') || '/platform-v7';
}

function isPublicPath(pathname: string): boolean {
  const path = normalizePath(pathname);
  return PUBLIC_EXACT_PATHS.has(path) || PUBLIC_PREFIX_PATHS.some((prefix) => path.startsWith(prefix));
}

export function PlatformV7ShellSwitch({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || '/platform-v7';
  if (isPublicPath(pathname)) return <>{children}</>;
  return <PlatformV7ProtectedShell pathname={pathname}>{children}</PlatformV7ProtectedShell>;
}
""")

Path('apps/web/components/v7r/PlatformV7IntelligenceStrip.tsx').write_text("""import { ArrowRight, Banknote, ShieldCheck } from 'lucide-react';
import { getLocale } from 'next-intl/server';

type Lang = 'ru' | 'en' | 'zh';

const copy = {
  ru: {
    kicker: 'Контур исполнения после цены',
    title: 'Сделка не заканчивается на согласованной цене',
    text: 'Главный риск начинается дальше: рейс, приёмка, качество, документы, расчёт, спор и доказательства должны быть связаны в один проверяемый процесс.',
    flow: ['Цена', 'Рейс', 'Приёмка', 'Расчёт'],
    items: [
      ['Видит место остановки', 'Показывает, где сделка требует действия: рейс, вес, качество, документ, расчёт или спор.'],
      ['Фиксирует следующий шаг', 'Связывает задачу с ролью участника: продавец, покупатель, логистика, элеватор, лаборатория, банк или арбитр.'],
      ['Собирает основание', 'Факты исполнения, документы и статусы складываются в проверяемую базу для расчёта и разбора расхождений.'],
    ],
  },
  en: {
    kicker: 'Execution circuit after price agreement',
    title: 'The deal does not end at the agreed price',
    text: 'The main risk starts after that: trip, acceptance, quality, documents, settlement, dispute and evidence must stay connected in one verifiable process.',
    flow: ['Price', 'Trip', 'Acceptance', 'Settlement'],
    items: [
      ['Shows the blocker', 'Shows where the deal requires action: trip, weight, quality, document, settlement or dispute.'],
      ['Locks the next step', 'Links the task to the participant role: seller, buyer, logistics, elevator, laboratory, bank or arbitrator.'],
      ['Builds the basis', 'Execution facts, documents and statuses form a verifiable basis for settlement and discrepancy review.'],
    ],
  },
  zh: {
    kicker: '价格确认后的执行闭环',
    title: '交易不会停在已确认的价格上',
    text: '真正的风险在后续环节开始：运输、验收、质量、文件、结算、争议和证据必须连接成一个可核验流程。',
    flow: ['价格', '运输', '验收', '结算'],
    items: [
      ['看清卡点位置', '显示交易在哪个环节需要行动：运输、重量、质量、文件、结算或争议。'],
      ['固定下一步动作', '把任务绑定到对应参与方角色：卖方、买方、物流、粮仓、实验室、银行或仲裁员。'],
      ['汇集结算依据', '执行事实、文件和状态汇集成可核验基础，用于结算和差异复盘。'],
    ],
  },
} as const;

const icons = [ShieldCheck, ArrowRight, Banknote];

export async function PlatformV7IntelligenceStrip() {
  const locale = await getLocale();
  const lang: Lang = locale === 'en' || locale === 'zh' ? locale : 'ru';
  const t = copy[lang];

  return (
    <section id='intelligence' className='entry-section entry-intelligence-section' aria-labelledby='intelligence-title' data-lang={lang}>
      <style>{css}</style>
      <div className='entry-intelligence-panel'>
        <div className='entry-intelligence-main'>
          <span className='entry-section-kicker'>{t.kicker}</span>
          <h2 id='intelligence-title'>{t.title}</h2>
          <p>{t.text}</p>
        </div>
        <div className='entry-intelligence-flow' aria-label={t.kicker}>{t.flow.map((item) => <span key={item}>{item}</span>)}</div>
        <div className='entry-intelligence-grid'>
          {t.items.map(([title, text], index) => {
            const Icon = icons[index];
            return <article className='entry-intelligence-tile' key={title}><span><Icon size={20} aria-hidden='true' /></span><strong>{title}</strong><small>{text}</small></article>;
          })}
        </div>
      </div>
    </section>
  );
}

const css = `
.entry-intelligence-section{padding-top:8px}.entry-intelligence-panel{display:grid;grid-template-columns:1fr;gap:14px;padding:16px;border-radius:30px;border:1px solid rgba(0,122,47,.12);background:linear-gradient(135deg,rgba(255,255,255,.92),rgba(246,250,245,.94));box-shadow:0 18px 48px rgba(7,22,17,.07)}.entry-intelligence-main{padding:20px;border-radius:23px;background:rgba(255,255,255,.82);border:1px solid rgba(7,22,17,.06)}.entry-intelligence-main h2{margin:0;font-size:clamp(25px,2.4vw,38px);line-height:1.04;letter-spacing:-.047em;font-weight:950}.entry-intelligence-main p{margin:12px 0 0;color:#5c6862;font-size:14.5px;line-height:1.44;font-weight:650}.entry-intelligence-flow{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;padding:14px;border-radius:23px;background:rgba(7,65,46,.05)}.entry-intelligence-flow span{display:grid;place-items:center;min-height:44px;border-radius:16px;background:#fff;color:#153028;font-size:12px;font-weight:950}.entry-intelligence-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.entry-intelligence-tile{min-height:154px;padding:16px;border-radius:22px;display:grid;align-content:start;gap:9px;border:1px solid rgba(7,22,17,.075);background:rgba(255,255,255,.82);box-shadow:0 14px 34px rgba(7,22,17,.06)}.entry-intelligence-tile span{display:grid;place-items:center;width:42px;height:42px;border-radius:15px;color:#087a3b;background:rgba(0,122,47,.08)}.entry-intelligence-tile strong{color:#071611;font-size:16px;font-weight:950;letter-spacing:-.03em}.entry-intelligence-tile small{color:#65716b;font-size:12.5px;line-height:1.34;font-weight:650}.entry-intelligence-section[data-lang='zh']{font-family:-apple-system,BlinkMacSystemFont,'PingFang SC','Noto Sans SC','Microsoft YaHei','Segoe UI',sans-serif}.entry-intelligence-section[data-lang='zh'] *{letter-spacing:0!important;word-break:keep-all;overflow-wrap:anywhere}.entry-intelligence-section[data-lang='zh'] .entry-intelligence-main h2{line-height:1.15;font-size:clamp(25px,5.6vw,34px)}.entry-intelligence-section[data-lang='zh'] .entry-intelligence-main p{line-height:1.58;font-size:14px}.entry-intelligence-section[data-lang='zh'] .entry-intelligence-tile strong{font-size:17px;line-height:1.18}.entry-intelligence-section[data-lang='zh'] .entry-intelligence-tile small{line-height:1.5}@media(max-width:980px){.entry-intelligence-grid{grid-template-columns:1fr}.entry-intelligence-tile{min-height:120px}}@media(max-width:420px){.entry-intelligence-flow{grid-template-columns:repeat(4,minmax(0,1fr));padding:10px;gap:6px}.entry-intelligence-flow span{font-size:11px;min-height:40px}}
`;
""")

replace_exact(
    'apps/web/tests/unit/platformV7PublicLayoutSplit.test.ts',
    "const shellSwitch = fs.readFileSync(path.join(process.cwd(), 'apps/web/components/platform-v7/PlatformV7ShellSwitch.tsx'), 'utf8');",
    "const shellSwitch = fs.readFileSync(path.join(process.cwd(), 'apps/web/components/platform-v7/PlatformV7ShellSwitch.tsx'), 'utf8');\nconst protectedShell = fs.readFileSync(path.join(process.cwd(), 'apps/web/components/platform-v7/PlatformV7ProtectedShell.tsx'), 'utf8');",
)
layout_test = Path('apps/web/tests/unit/platformV7PublicLayoutSplit.test.ts')
layout_source = layout_test.read_text()
layout_source = layout_source.replace("    expect(shellSwitch).toContain('<AppShellV4 initialRole={initialRole}>');", "    expect(shellSwitch).toContain('dynamic(');\n    expect(shellSwitch).toContain('PlatformV7ProtectedShell');\n    expect(protectedShell).toContain('<AppShellV4 initialRole={initialRole}>');")
for token in ['<PlatformV7SingleEntryGuard />', '<PlatformV7ShellUxController />', '<RbacCabinetGuard />', '<CalculatorHeaderWidget />', '<SupportHeaderIcon />', '<RoleAssistantWidget />']:
    layout_source = layout_source.replace(f"expect(shellSwitch).toContain('{token}');", f"expect(protectedShell).toContain('{token}');")
layout_source = layout_source.replace("expect(shellSwitch).not.toContain('<CommandPalette />');", "expect(protectedShell).not.toContain('<CommandPalette />');")
layout_test.write_text(layout_source)

replace_exact(
    'apps/web/tests/unit/platformV7CanonicalDealWorkspace.test.ts',
    "const shell = source('components/platform-v7/PlatformV7ShellSwitch.tsx');",
    "const shell = source('components/platform-v7/PlatformV7ProtectedShell.tsx');",
)

role_test = Path('apps/web/tests/unit/platformV7RoleIntentDashboard.test.ts')
role_source = role_test.read_text().replace(
    "const shell = read('apps/web/components/platform-v7/PlatformV7ShellSwitch.tsx');",
    "const shell = read('apps/web/components/platform-v7/PlatformV7ProtectedShell.tsx');",
)
role_source = role_source.replace(
    "    expect(dashboard).toContain('Что хотите сделать?');\n    expect(dashboard).toContain('Требует внимания');\n    expect(dashboard).toContain('Продолжить начатое');\n",
    "    expect(dashboard).toContain('<CanonicalDealWorkspace role={role} />');\n    expect(dashboard).not.toContain('getRoleIntentConfig');\n",
)
role_test.write_text(role_source)

Path('apps/web/tests/unit/platformV7PublicLiveHardening.test.ts').write_text("""import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), 'utf8');

describe('platform-v7 public live hardening', () => {
  it('self-hosts the configured fonts and keeps root theme hydration stable', () => {
    const css = read('apps/web/app/v9.css');
    const layout = read('apps/web/app/layout.tsx');
    expect(css).not.toContain('fonts.googleapis.com');
    expect(css).not.toContain('fonts.gstatic.com');
    expect(css).toContain("var(--font-inter, 'Inter')");
    expect(css).toContain("var(--font-jetbrains-mono, 'JetBrains Mono')");
    expect(layout).toContain('data-theme="light"');
    expect(layout).toContain('suppressHydrationWarning');
    expect(layout).not.toContain('rel="preconnect" href="https://fonts.googleapis.com"');
  });

  it('indexes only the public landing while auth and protected surfaces remain noindex by default', () => {
    const middleware = read('apps/web/middleware.ts');
    const page = read('apps/web/app/platform-v7/page.tsx');
    const platformLayout = read('apps/web/app/platform-v7/layout.tsx');
    expect(middleware).toContain("indexable ? 'index, follow, max-image-preview:large'");
    expect(middleware).toContain('isEntry && !privateModeEnabled');
    expect(middleware).toContain("'noindex, nofollow, noarchive, nosnippet, noimageindex'");
    expect(page).toContain('export const metadata: Metadata');
    expect(page).toContain('index: true');
    expect(platformLayout).toContain('index: false');
  });

  it('keeps the mobile process rail keyboard-accessible', () => {
    const page = read('apps/web/app/platform-v7/page.tsx');
    expect(page).toContain("className='entry-process-row' tabIndex={0} role='region'");
  });

  it('does not ship the protected cabinet graph in the public shell entry chunk', () => {
    const shellSwitch = read('apps/web/components/platform-v7/PlatformV7ShellSwitch.tsx');
    const protectedShell = read('apps/web/components/platform-v7/PlatformV7ProtectedShell.tsx');
    expect(shellSwitch).toContain('dynamic(');
    expect(shellSwitch).not.toContain("from '@/components/v7r/AppShellV4'");
    expect(shellSwitch).not.toContain('RoleAssistantWidget');
    expect(protectedShell).toContain("from '@/components/v7r/AppShellV4'");
    expect(protectedShell).toContain('RoleAssistantWidget');
  });

  it('renders the public intelligence strip on the server in the request locale', () => {
    const strip = read('apps/web/components/v7r/PlatformV7IntelligenceStrip.tsx');
    expect(strip).not.toContain("'use client'");
    expect(strip).toContain('getLocale');
    expect(strip).not.toContain('readStoredLanguage');
    expect(strip).not.toContain('useEffect');
  });

  it('does not emit unsupported permissions-policy directives', () => {
    const middleware = read('apps/web/middleware.ts');
    expect(middleware).not.toContain('bluetooth=()');
  });
});
""")

state_path = Path('docs/platform-v7/autopilot/autopilot-state.json')
state = json.loads(state_path.read_text())
state.setdefault('approvedConcurrentScopes', {})['agent/fix-platform-v7-public-live-defects'] = [
    'apps/web/app/layout.tsx',
    'apps/web/app/v9.css',
    'apps/web/app/platform-v7/page.tsx',
    'apps/web/middleware.ts',
    'apps/web/components/platform-v7/PlatformV7ShellSwitch.tsx',
    'apps/web/components/platform-v7/PlatformV7ProtectedShell.tsx',
    'apps/web/components/v7r/PlatformV7IntelligenceStrip.tsx',
    'apps/web/tests/unit/platformV7PublicLayoutSplit.test.ts',
    'apps/web/tests/unit/platformV7CanonicalDealWorkspace.test.ts',
    'apps/web/tests/unit/platformV7RoleIntentDashboard.test.ts',
    'apps/web/tests/unit/platformV7PublicLiveHardening.test.ts',
    'docs/platform-v7/autopilot/autopilot-state.json',
]
state_path.write_text(json.dumps(state, ensure_ascii=False, indent=2) + '\n')
