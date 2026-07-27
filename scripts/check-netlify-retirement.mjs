#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const FORBIDDEN_NETLIFY_PATHS = Object.freeze([
  'netlify.toml',
  '.netlify',
  'apps/web/netlify.toml',
  'apps/web/.netlify',
]);

const PACKAGE_SECTIONS = Object.freeze([
  'dependencies',
  'devDependencies',
  'optionalDependencies',
  'peerDependencies',
  'bundledDependencies',
]);
const SOURCE_EXTENSIONS = new Set([
  '.js', '.cjs', '.mjs', '.jsx', '.ts', '.cts', '.mts', '.tsx',
  '.py', '.sh', '.bash', '.zsh', '.fish',
]);
const CONFIG_EXTENSIONS = new Set([
  '.json', '.yaml', '.yml', '.toml', '.ini', '.conf', '.env',
]);
const NETLIFY_ENDPOINT = /(?:https?:\/\/)?(?:api\.|app\.)?netlify\.com|(?:https?:\/\/)?[^\s'"`]+\.netlify\.app/iu;
const NETLIFY_PACKAGE = /netlify/iu;
const NETLIFY_ENV_NAME = /^NETLIFY_[A-Z0-9_]+$/u;
const EXECUTABLE_CLI = /(?:^|[\s;&|()])(?:(?:npx|yarn)\s+|pnpm\s+(?:exec\s+)?|npm\s+exec(?:\s+--)?\s+)?netlify(?:\s|$)/iu;

function normalizePath(value) {
  return value.split(path.sep).join('/').replace(/^\.\//u, '');
}

function textAt(root, relativePath) {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

function push(violations, file, reason) {
  violations.push(`${file}: ${reason}`);
}

function scanPackageManifest(relativePath, content, violations) {
  let manifest;
  try {
    manifest = JSON.parse(content);
  } catch (error) {
    push(violations, relativePath, `invalid package manifest: ${error instanceof Error ? error.message : String(error)}`);
    return;
  }
  for (const section of PACKAGE_SECTIONS) {
    const entries = manifest?.[section];
    if (!entries) continue;
    const names = Array.isArray(entries) ? entries : Object.keys(entries);
    for (const name of names) {
      if (NETLIFY_PACKAGE.test(String(name))) {
        push(violations, relativePath, `${section} contains active Netlify package ${JSON.stringify(name)}`);
      }
    }
  }
  if (manifest && Object.prototype.hasOwnProperty.call(manifest, 'netlify')) {
    push(violations, relativePath, 'contains an active top-level Netlify configuration');
  }
  for (const [name, command] of Object.entries(manifest?.scripts ?? {})) {
    if (typeof command !== 'string') continue;
    if (EXECUTABLE_CLI.test(command)) {
      push(violations, relativePath, `script ${JSON.stringify(name)} executes Netlify CLI`);
    }
    if (NETLIFY_ENDPOINT.test(command)) {
      push(violations, relativePath, `script ${JSON.stringify(name)} references a Netlify endpoint`);
    }
    if (/\bNETLIFY_[A-Z0-9_]+\b/u.test(command)) {
      push(violations, relativePath, `script ${JSON.stringify(name)} references Netlify credentials/configuration`);
    }
  }
}

function stripYamlComment(line) {
  const index = line.indexOf('#');
  return index < 0 ? line : line.slice(0, index);
}

function scanExecutableText(value, relativePath, context, violations) {
  if (EXECUTABLE_CLI.test(value)) {
    push(violations, relativePath, `${context} executes Netlify CLI`);
  }
  if (NETLIFY_ENDPOINT.test(value)) {
    push(violations, relativePath, `${context} references a Netlify endpoint`);
  }
  if (/\bNETLIFY_[A-Z0-9_]+\b/u.test(value)) {
    push(violations, relativePath, `${context} references Netlify credentials/configuration`);
  }
}

function scanWorkflow(relativePath, content, violations) {
  const lines = content.split(/\r?\n/u);
  let runBlockIndent = null;
  for (let index = 0; index < lines.length; index += 1) {
    const raw = lines[index];
    const line = stripYamlComment(raw);
    if (!line.trim()) continue;
    const indent = line.length - line.trimStart().length;
    if (runBlockIndent !== null) {
      if (indent > runBlockIndent) {
        scanExecutableText(line.trim(), relativePath, `run block line ${index + 1}`, violations);
        continue;
      }
      runBlockIndent = null;
    }
    const uses = line.match(/^\s*uses:\s*(.+?)\s*$/u);
    if (uses && /netlify/iu.test(uses[1])) {
      push(violations, relativePath, `uses active Netlify action at line ${index + 1}`);
    }
    const run = line.match(/^\s*run:\s*(.*?)\s*$/u);
    if (run) {
      if (run[1] === '|' || run[1] === '>' || run[1] === '|-' || run[1] === '>-') {
        runBlockIndent = indent;
      } else {
        scanExecutableText(run[1], relativePath, `run command line ${index + 1}`, violations);
      }
    }
    const key = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*:/u)?.[1];
    if (key && NETLIFY_ENV_NAME.test(key)) {
      push(violations, relativePath, `declares Netlify environment key ${key} at line ${index + 1}`);
    }
    if (/\$\{\{\s*secrets\.NETLIFY_[A-Z0-9_]+\s*\}\}/u.test(line)) {
      push(violations, relativePath, `reads a Netlify secret at line ${index + 1}`);
    }
    if (/^\s*(?:url|endpoint|site_url|base_url|api_url)\s*:/iu.test(line) && NETLIFY_ENDPOINT.test(line)) {
      push(violations, relativePath, `declares a Netlify endpoint at line ${index + 1}`);
    }
  }
}

function isBareModuleSpecifier(specifier) {
  return !(
    specifier.startsWith('.')
    || specifier.startsWith('/')
    || specifier.startsWith('file:')
    || specifier.startsWith('node:')
    || /^[A-Za-z]:[\\/]/u.test(specifier)
  );
}

function scanJavaScript(relativePath, content, violations) {
  const importPatterns = [
    /(?:from\s*|import\s*\()\s*['"`]([^'"`]+)['"`]/giu,
    /require\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/giu,
  ];
  for (const pattern of importPatterns) {
    for (const match of content.matchAll(pattern)) {
      const specifier = match[1];
      if (isBareModuleSpecifier(specifier) && NETLIFY_PACKAGE.test(specifier)) {
        push(violations, relativePath, `imports active Netlify package ${JSON.stringify(specifier)}`);
      }
    }
  }
  const envPattern = /process\.env(?:\.NETLIFY_[A-Z0-9_]+|\[['"`]NETLIFY_[A-Z0-9_]+['"`]\])/gu;
  if (envPattern.test(content)) {
    push(violations, relativePath, 'reads Netlify environment configuration');
  }
  const childProcessPatterns = [
    /(?:exec|execSync|execFile|execFileSync|spawn|spawnSync)\s*\(\s*['"`]netlify['"`]/giu,
    /(?:exec|execSync|execFile|execFileSync|spawn|spawnSync)\s*\(\s*['"`](?:npx|pnpm|npm|yarn)['"`][\s\S]{0,240}?['"`]netlify['"`]/giu,
    /(?:exec|execSync)\s*\(\s*['"`][^'"`]*(?:^|[\s;&|])(?:npx\s+|pnpm\s+(?:exec\s+)?|npm\s+exec(?:\s+--)?\s+|yarn\s+)?netlify(?:\s|$)[^'"`]*['"`]/gimu,
  ];
  if (childProcessPatterns.some((pattern) => pattern.test(content))) {
    push(violations, relativePath, 'invokes Netlify CLI through a child process');
  }
  const runtimeEndpoint = /(?:fetch|WebSocket|EventSource|new\s+URL|axios\.(?:get|post|put|patch|delete|request))\s*\(\s*['"`][^'"`]*(?:netlify\.app|(?:api|app)\.netlify\.com)/giu;
  const configuredEndpoint = /(?:baseUrl|baseURL|siteUrl|apiUrl|endpoint|url)\s*[:=]\s*['"`][^'"`]*(?:netlify\.app|(?:api|app)\.netlify\.com)/giu;
  if (runtimeEndpoint.test(content) || configuredEndpoint.test(content)) {
    push(violations, relativePath, 'configures or calls a Netlify runtime endpoint');
  }
}

function scanPython(relativePath, content, violations) {
  if (/^(?:from|import)\s+[^\n]*netlify/imu.test(content)) {
    push(violations, relativePath, 'imports an active Netlify package');
  }
  if (/os\.(?:environ\[['"]NETLIFY_[A-Z0-9_]+['"]\]|getenv\(['"]NETLIFY_[A-Z0-9_]+['"]\))/gu.test(content)) {
    push(violations, relativePath, 'reads Netlify environment configuration');
  }
  if (/subprocess\.(?:run|call|check_call|check_output|Popen)\s*\([\s\S]{0,300}?(?:['"]netlify['"]|['"](?:npx|pnpm|npm|yarn)['"][\s\S]{0,120}?['"]netlify['"])/gu.test(content)) {
    push(violations, relativePath, 'invokes Netlify CLI through subprocess');
  }
  if (/(?:requests|httpx)\.(?:get|post|put|patch|delete|request)\s*\(\s*['"][^'"]*(?:netlify\.app|(?:api|app)\.netlify\.com)/giu.test(content)) {
    push(violations, relativePath, 'calls a Netlify runtime endpoint');
  }
}

function removeShellComment(line) {
  let quote = null;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (quote) {
      if (character === quote && line[index - 1] !== '\\') quote = null;
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
    } else if (character === '#') {
      return line.slice(0, index);
    }
  }
  return line;
}

function scanShell(relativePath, content, violations) {
  const lines = content.split(/\r?\n/u);
  for (let index = 0; index < lines.length; index += 1) {
    const line = removeShellComment(lines[index]).trim();
    if (!line) continue;
    if (/\$(?:\{)?NETLIFY_[A-Z0-9_]+/u.test(line)) {
      push(violations, relativePath, `reads Netlify environment configuration at line ${index + 1}`);
    }
    const commandSegments = line.split(/&&|\|\||;|\|/u).map((segment) => segment.trim());
    for (const segment of commandSegments) {
      const executable = segment.replace(/^(?:[A-Za-z_][A-Za-z0-9_]*=(?:[^\s]+)\s+)*/u, '');
      if (/^(?:sudo\s+)?(?:(?:npx|yarn)\s+|pnpm\s+(?:exec\s+)?|npm\s+exec(?:\s+--)?\s+)?netlify(?:\s|$)/iu.test(executable)) {
        push(violations, relativePath, `executes Netlify CLI at line ${index + 1}`);
      }
      if (/^(?:curl|wget)\b/iu.test(executable) && NETLIFY_ENDPOINT.test(executable)) {
        push(violations, relativePath, `calls a Netlify endpoint at line ${index + 1}`);
      }
    }
  }
}

function scanConfiguration(relativePath, content, violations) {
  const lines = content.split(/\r?\n/u);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (/^\s*NETLIFY_[A-Z0-9_]+\s*[:=]/u.test(line)) {
      push(violations, relativePath, `declares Netlify environment configuration at line ${index + 1}`);
    }
    if (/^\s*(?:image|command|entrypoint|build|deploy)\s*:/iu.test(line) && (EXECUTABLE_CLI.test(line) || /netlify\/|@netlify\//iu.test(line))) {
      push(violations, relativePath, `declares an active Netlify command/image at line ${index + 1}`);
    }
    if (/^\s*(?:url|endpoint|site_url|base_url|api_url)\s*[:=]/iu.test(line) && NETLIFY_ENDPOINT.test(line)) {
      push(violations, relativePath, `declares a Netlify endpoint at line ${index + 1}`);
    }
  }
}

function trackedRepositoryFiles(root) {
  return execFileSync('git', ['ls-files'], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  }).split('\n').filter(Boolean).map(normalizePath);
}

export function scanNetlifyRetirement({
  root = process.cwd(),
  trackedFiles = null,
} = {}) {
  const violations = [];
  for (const relativePath of FORBIDDEN_NETLIFY_PATHS) {
    const absolutePath = path.join(root, relativePath);
    if (existsSync(absolutePath)) {
      push(violations, relativePath, 'forbidden Netlify configuration/state path exists');
    }
  }

  const files = (trackedFiles ?? trackedRepositoryFiles(root))
    .map(normalizePath)
    .filter((relativePath) => {
      const absolutePath = path.join(root, relativePath);
      return existsSync(absolutePath) && statSync(absolutePath).isFile();
    });

  for (const relativePath of files) {
    const content = textAt(root, relativePath);
    if (relativePath === 'package.json' || relativePath.endsWith('/package.json')) {
      scanPackageManifest(relativePath, content, violations);
      continue;
    }
    if (relativePath.startsWith('.github/workflows/') && /\.ya?ml$/iu.test(relativePath)) {
      scanWorkflow(relativePath, content, violations);
      continue;
    }
    const extension = path.extname(relativePath).toLowerCase();
    if (SOURCE_EXTENSIONS.has(extension)) {
      if (['.js', '.cjs', '.mjs', '.jsx', '.ts', '.cts', '.mts', '.tsx'].includes(extension)) {
        scanJavaScript(relativePath, content, violations);
      } else if (extension === '.py') {
        scanPython(relativePath, content, violations);
      } else {
        scanShell(relativePath, content, violations);
      }
      continue;
    }
    if ((relativePath.startsWith('infra/') || relativePath.startsWith('apps/')) && CONFIG_EXTENSIONS.has(extension)) {
      scanConfiguration(relativePath, content, violations);
    }
  }

  return [...new Set(violations)].sort();
}

function main() {
  const violations = scanNetlifyRetirement();
  if (violations.length > 0) {
    console.error('Netlify retirement authority failed:');
    for (const violation of violations) console.error(`- ${violation}`);
    process.exit(1);
  }
  console.log('Netlify retirement authority passed: no active Netlify configuration, dependency, workflow, credential, CLI or runtime endpoint remains.');
}

const invokedUrl = process.argv[1]
  ? pathToFileURL(path.resolve(process.argv[1])).href
  : null;
if (invokedUrl === import.meta.url) main();
