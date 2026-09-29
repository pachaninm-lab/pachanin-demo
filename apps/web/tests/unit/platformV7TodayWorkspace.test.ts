import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

function source(path: string): string {
  return readFileSync(join(process.cwd(), path), 'utf8');
}

type DealRef = {
  id: string;
  dealNumber: string | null;
  status: string | null;
  nextAction: string | null;
};

describe('platform-v7 Today workspace scale and cognitive safety', () => {
  const dashboard = source('components/platform-v7/RoleIntentDashboard.tsx');
  const styles = source('components/platform-v7/RoleIntentDashboard.module.css');
  const designSystemStyles = source('../../packages/design-system-v8/src/components.module.css');

  // Execute the current production functions, not a second implementation in the test.
  const ast = ts.createSourceFile('RoleIntentDashboard.tsx', dashboard, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const names = ['prioritizeDeals', 'mergeDeals'];
  const functions = ast.statements.filter((statement): statement is ts.FunctionDeclaration =>
    ts.isFunctionDeclaration(statement) && !!statement.name && names.includes(statement.name.text));
  if (functions.length !== names.length) throw new Error('Today queue functions are missing');
  const context = { exports: {} as { mergeDeals: (current: DealRef[], incoming: DealRef[]) => DealRef[] } };
  runInNewContext(ts.transpileModule(
    `${functions.map((statement) => statement.getText(ast)).join('\n')}\nexports.mergeDeals = mergeDeals;`,
    { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } },
  ).outputText, context, { timeout: 1000 });
  const { mergeDeals } = context.exports;
  const deal = (id: string, nextAction: string | null = null): DealRef => ({
    id, dealNumber: id, status: 'DRAFT', nextAction,
  });

  it('keeps one primary deal while supporting server cursor pagination', () => {
    expect(dashboard).toContain('const PAGE_SIZE = 20');
    expect(dashboard).toContain("params.set('cursor', cursor)");
    expect(dashboard).toContain('nextCursor: string | null');
    expect(dashboard).toContain('mergeDeals(current.deals, page.deals)');
    expect(dashboard).toContain('Показать ещё сделки');
    expect(dashboard).toContain('<CanonicalDealWorkspace role={role} dealId={current.id} />');
  });

  it('deduplicates pages and never replaces an already usable screen with a load-more failure', () => {
    expect(dashboard).toContain('const byId = new Map<string, AccessibleDealRef>()');
    expect(dashboard).toContain("current.kind === 'ready'");
    expect(dashboard).toContain('loadMoreError: message');
    expect(dashboard).toContain("role='alert'");
  });

  it('inherits large touch targets from v8 and keeps mobile-safe scrolling', () => {
    expect(dashboard).toContain("from '@pc/design-system-v8'");
    expect(styles).toContain('.loadMoreButton');
    expect(designSystemStyles).toContain('min-height: var(--ds-control-height)');
    expect(styles).toContain('overscroll-behavior: contain');
    expect(styles).toContain('@media (max-width: 430px)');
    expect(styles).toContain('@media (forced-colors: active)');
  });

  it('does not switch the open Deal when a later page contains an action', () => {
    const opened = deal('opened');
    const incoming = deal('new', 'REVIEW');
    expect(mergeDeals([opened], [incoming])).toEqual([opened, incoming]);
  });

  it('keeps the open Deal identity when a duplicate clears its nextAction', () => {
    const updated = deal('opened');
    const other = deal('other', 'PAY');
    expect(mergeDeals([deal('opened', 'REVIEW'), other], [updated])).toEqual([updated, other]);
  });

  it('uses the latest duplicate without adding a second row', () => {
    const updated = deal('other', 'PAY');
    const result = mergeDeals([deal('opened'), deal('other')], [deal('other', 'REVIEW'), updated]);
    expect(result).toHaveLength(2);
    expect(result.find((row) => row.id === 'other')).toBe(updated);
    expect(result[0].id).toBe('opened');
  });

  it('preserves the existing stable grouping for every remaining Deal', () => {
    const result = mergeDeals(
      [deal('opened'), deal('waiting'), deal('actionable', 'REVIEW')],
      [deal('new-actionable', 'PAY'), deal('new-waiting')],
    );
    expect(result.map((row) => row.id)).toEqual(['opened', 'actionable', 'new-actionable', 'waiting', 'new-waiting']);
  });

  it('retains the open row on an empty next page', () => {
    const opened = deal('opened');
    const result = mergeDeals([opened, deal('other')], []);
    expect(result[0]).toBe(opened);
    expect(result).toHaveLength(2);
  });

  it('retains the existing first-page grouping when no Deal is already open', () => {
    expect(mergeDeals([], [deal('waiting'), deal('actionable', 'REVIEW')]).map((row) => row.id))
      .toEqual(['actionable', 'waiting']);
    expect(mergeDeals([], [])).toEqual([]);
  });

  it('does not mutate either page or its records', () => {
    const opened = Object.freeze(deal('opened'));
    const incoming = Object.freeze(deal('new', 'REVIEW'));
    const currentPage = [opened];
    const incomingPage = [incoming];
    Object.freeze(currentPage);
    Object.freeze(incomingPage);
    expect(mergeDeals(currentPage, incomingPage)).toEqual([opened, incoming]);
    expect(currentPage).toEqual([opened]);
    expect(incomingPage).toEqual([incoming]);
  });

  it('keeps the same workspace through repeated page loads', () => {
    let current = [deal('opened')];
    for (let page = 0; page < 5; page += 1) {
      current = mergeDeals(current, [deal(`next-${page}`, 'REVIEW')]);
      expect(current[0].id).toBe('opened');
      expect(current).toHaveLength(page + 2);
    }
  });
});
