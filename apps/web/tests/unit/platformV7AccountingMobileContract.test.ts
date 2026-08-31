import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * What makes the accounting screens survive 320, 375, 390 and 430 pixels.
 *
 * This is a contract on the stylesheet, not a proof of rendering, and the
 * difference matters. jsdom does not compute CSS layout: a test that mounted
 * the board at width 320 and asserted nothing overflowed would be asserting
 * against a layout engine that never ran. Claiming those four widths were
 * verified on that basis would be exactly the fictitious evidence this
 * programme is not allowed to produce.
 *
 * What is checkable here is the set of properties that make the narrow widths
 * work, and whether they are still present. A real rendered proof needs a
 * browser and an authenticated session, and is named as missing rather than
 * simulated.
 */

const root = process.cwd();
const stylesheet = fs.readFileSync(
  path.join(root, 'apps/web/app/platform-v7/accounting/accounting.module.css'),
  'utf8',
);

describe('platform-v7 accounting mobile contract', () => {
  it('describes the narrowest viewport first and treats wider ones as exceptions', () => {
    const firstMediaQuery = stylesheet.indexOf('@media');
    const firstRule = stylesheet.indexOf('.page {');
    expect(firstRule).toBeGreaterThan(-1);
    expect(firstMediaQuery).toBeGreaterThan(firstRule);
    // Every breakpoint widens; none narrows. A max-width query would mean the
    // base layout was written for a desktop and patched downwards.
    const queries = [...stylesheet.matchAll(/@media\s*\(([^)]+)\)/g)].map((match) => match[1]);
    for (const query of queries) {
      expect(query.includes('max-width')).toBe(false);
    }
  });

  it('never ties a width to the viewport unit', () => {
    // 100vw includes the scrollbar on desktop and overflows the body by exactly
    // its width, which is how a page that looks fine in a simulator gains a
    // horizontal scrollbar on a real phone.
    expect(stylesheet).not.toContain('vw');
  });

  it('lets grid children shrink below their content', () => {
    // Without minmax(0, …) and min-width: 0 a grid item refuses to go narrower
    // than its longest unbreakable word, and the row overflows instead of
    // wrapping — the single most common cause of a 320px layout breaking.
    expect(stylesheet).toContain('minmax(0, 1fr)');
    expect(stylesheet).toContain('min-width: 0');
  });

  it('wraps long labels rather than truncating them', () => {
    const wraps = stylesheet.match(/overflow-wrap:\s*anywhere/g) ?? [];
    expect(wraps.length).toBeGreaterThanOrEqual(2);
    expect(stylesheet).not.toContain('text-overflow: ellipsis');
  });

  it('keeps every touch target at or above 44px', () => {
    // 2.75rem at a 16px root. Below this a target is smaller than a fingertip,
    // and the person tapping it is standing next to a truck.
    const minHeights = [...stylesheet.matchAll(/min-height:\s*([\d.]+)rem/g)]
      .map((match) => Number(match[1]));
    expect(minHeights.length).toBeGreaterThan(0);
    for (const height of minHeights) {
      expect(height).toBeGreaterThanOrEqual(2.75);
    }
  });

  it('starts the KPI row at two columns and widens it only past the breakpoint', () => {
    const base = stylesheet.slice(0, stylesheet.indexOf('@media'));
    expect(base).toContain('grid-template-columns: repeat(2, minmax(0, 1fr))');
    expect(stylesheet).toContain('@media (min-width: 30rem)');
    expect(stylesheet).toContain('grid-template-columns: repeat(4, minmax(0, 1fr))');
  });

  it('honours a request for reduced motion', () => {
    expect(stylesheet).toContain('prefers-reduced-motion: reduce');
  });
});
