import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Regression guard for a real production-breaking class of bug.
 *
 * A Server Component (a page/layout WITHOUT a top-level `'use client'`) must not
 * import a *plain value* (a non-component, non-hook function/const) from a module
 * that IS marked `'use client'` and then call it during render. Next.js replaces
 * every export of a `'use client'` module with a client-reference proxy; calling
 * such a proxy on the server throws `TypeError: <name> is not a function`, which
 * surfaces to users as an HTTP 500.
 *
 * This actually happened on `/platform-v7/documents` (buildDemoDocumentTree) and
 * `/platform-v7/seller` (buildDemoPaymentHeatmapData). Both were fixed by moving
 * the data factories into server-safe `*.data.ts` modules. This test keeps the
 * whole app free of the pattern going forward.
 */

const WEB_ROOT = path.join(process.cwd(), 'apps/web');
const APP_DIR = path.join(WEB_ROOT, 'app');

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (/\.(t|j)sx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

function isClientModule(file: string): boolean {
  if (!fs.existsSync(file)) return false;
  // The directive must be one of the first statements (ignore comments/blank lines).
  const head = fs.readFileSync(file, 'utf8').split('\n').slice(0, 8).join('\n');
  return /^\s*(['"])use client\1/m.test(head);
}

function resolveImport(fromFile: string, spec: string): string | null {
  let base: string;
  if (spec.startsWith('@/')) base = path.join(WEB_ROOT, spec.slice(2));
  else if (spec.startsWith('.')) base = path.resolve(path.dirname(fromFile), spec);
  else return null; // package import — not ours
  const candidates = [
    base,
    `${base}.ts`, `${base}.tsx`, `${base}.js`, `${base}.jsx`,
    path.join(base, 'index.ts'), path.join(base, 'index.tsx'),
  ];
  return candidates.find((c) => fs.existsSync(c) && fs.statSync(c).isFile()) ?? null;
}

// Named imports whose local name starts lowercase and is not a hook (`use…`)
// are treated as plain values. Components are Uppercase; hooks (`useX`) would
// also be invalid in a server component but are caught separately by React.
function isPlainValueName(name: string): boolean {
  return /^[a-z]/.test(name) && !/^use[A-Z]/.test(name);
}

const IMPORT_RE = /import\s+(?:type\s+)?(\{[^}]*\}|\*\s+as\s+\w+|\w+)?\s*(?:,\s*(\{[^}]*\}))?\s*from\s*['"]([^'"]+)['"]/g;

function parseNamedImports(clause: string | undefined): { name: string; typeOnly: boolean }[] {
  if (!clause || !clause.startsWith('{')) return [];
  return clause
    .replace(/[{}]/g, '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const typeOnly = /^type\s+/.test(s);
      const cleaned = s.replace(/^type\s+/, '');
      const local = cleaned.split(/\s+as\s+/).pop()!.trim();
      return { name: local, typeOnly };
    });
}

describe('server component → client module import boundary', () => {
  const serverFiles = walk(APP_DIR).filter(
    (f) => /(page|layout|template|default)\.(t|j)sx?$/.test(path.basename(f)) && !isClientModule(f),
  );

  it('has server pages/layouts to check', () => {
    expect(serverFiles.length).toBeGreaterThan(100);
  });

  it('no server component imports a plain value from a "use client" module', () => {
    const violations: string[] = [];

    for (const file of serverFiles) {
      const src = fs.readFileSync(file, 'utf8');
      for (const m of src.matchAll(IMPORT_RE)) {
        const isTypeOnlyImport = /import\s+type\s/.test(m[0]);
        if (isTypeOnlyImport) continue;
        const spec = m[3];
        const resolved = resolveImport(file, spec);
        if (!resolved || !isClientModule(resolved)) continue;

        const named = [...parseNamedImports(m[1]), ...parseNamedImports(m[2])];
        for (const { name, typeOnly } of named) {
          if (typeOnly) continue;
          if (isPlainValueName(name)) {
            violations.push(
              `${path.relative(process.cwd(), file)} imports plain value "${name}" from client module "${spec}"`,
            );
          }
        }
      }
    }

    expect(violations, `Move these into a server-safe (no 'use client') module:\n${violations.join('\n')}`).toEqual([]);
  });
});
