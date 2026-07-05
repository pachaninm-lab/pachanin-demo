#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const TRANSLATOR_PATH = path.join(ROOT, 'apps/web/components/platform-v7/PlatformTranslator.tsx');
const TEMPLATE_PATH = path.join(ROOT, 'apps/web/app/platform-v7/template.tsx');
const CJK_CSS_PATH = path.join(ROOT, 'apps/web/styles/platform-v7-i18n-cjk.css');

function writeIfChanged(filePath, next) {
  const current = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
  if (current === next) return false;
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, next, 'utf8');
  return true;
}

function patchTranslatorCache() {
  const source = fs.readFileSync(TRANSLATOR_PATH, 'utf8');
  const next = source.replace(/pc-v7-translation-dictionaries-v\d+/g, 'pc-v7-translation-dictionaries-v5');
  return writeIfChanged(TRANSLATOR_PATH, next);
}

function patchTemplate() {
  let source = fs.readFileSync(TEMPLATE_PATH, 'utf8');
  if (!source.includes('PlatformV7I18nGuard')) {
    source = source.replace(
      "import { PlatformTranslator } from '@/components/platform-v7/PlatformTranslator';\n",
      "import { PlatformTranslator } from '@/components/platform-v7/PlatformTranslator';\nimport { PlatformV7I18nGuard } from '@/components/platform-v7/PlatformV7I18nGuard';\n",
    );
    source = source.replace(
      "import '@/styles/platform-v7-adaptive-devices.css';\n",
      "import '@/styles/platform-v7-adaptive-devices.css';\nimport '@/styles/platform-v7-i18n-cjk.css';\n",
    );
    source = source.replace(
      '      <ViewportStabilityGuard />\n',
      '      <ViewportStabilityGuard />\n      <PlatformV7I18nGuard />\n',
    );
  }
  return writeIfChanged(TEMPLATE_PATH, source);
}

function patchCjkCss() {
  const css = `html[data-p7-language='zh'] body,
html[data-p7-language='zh'] .entry-shell,
html[data-p7-language='zh'] .pc-v4-shell,
html[data-p7-language='zh'] .pc-v7-shell,
html[data-p7-language='zh'] .platform-v7-shell {
  font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Noto Sans SC', 'Microsoft YaHei', 'Segoe UI', sans-serif;
}

html[data-p7-language='zh'] h1,
html[data-p7-language='zh'] h2,
html[data-p7-language='zh'] h3,
html[data-p7-language='zh'] .entry-intelligence-main h2,
html[data-p7-language='zh'] .entry-intelligence-tile strong,
html[data-p7-language='zh'] .entry-section-kicker {
  letter-spacing: 0;
  line-height: 1.18;
  text-wrap: balance;
}

html[data-p7-language='zh'] p,
html[data-p7-language='zh'] small,
html[data-p7-language='zh'] span,
html[data-p7-language='zh'] button,
html[data-p7-language='zh'] label,
html[data-p7-language='zh'] input,
html[data-p7-language='zh'] textarea {
  letter-spacing: 0;
  word-break: keep-all;
  overflow-wrap: anywhere;
}

html[data-p7-language='zh'] .entry-intelligence-flow span,
html[data-p7-language='zh'] .entry-execution-anchor,
html[data-p7-language='zh'] .entry-intelligence-tile {
  min-width: 0;
}
`;
  return writeIfChanged(CJK_CSS_PATH, css);
}

const changed = [patchTranslatorCache(), patchTemplate(), patchCjkCss()].filter(Boolean).length;
console.log(`[p7-i18n] runtime patch complete; changed files: ${changed}`);
