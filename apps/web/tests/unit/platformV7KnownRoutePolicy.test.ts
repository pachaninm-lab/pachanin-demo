import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  isKnownPlatformV7Route,
  PLATFORM_V7_ROUTE_MANIFEST,
} from '../../lib/platform-v7/known-route-policy';

const appRoot = path.resolve(process.cwd(), 'apps/web/app/platform-v7');

function walkPages(directory: string, output: string[] = []): string[] {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) walkPages(absolute, output);
    else if (entry.isFile() && entry.name === 'page.tsx') output.push(absolute);
  }
  return output;
}

function routeFromPage(pagePath: string): string {
  const segments = path.relative(appRoot, pagePath).split(path.sep);
  segments.pop();
  const routeSegments = segments.filter((segment) => {
    if (/^\(.+\)$/.test(segment)) return false;
    if (segment.startsWith('@')) return false;
    return true;
  });
  return ['/platform-v7', ...routeSegments].join('/').replace(/\/$/, '') || '/platform-v7';
}

function sampleRoute(route: string): string {
  return route.replace(/\[[^/]+\]/g, 'sample-id');
}

describe('platform-v7 known route policy', () => {
  it('covers every concrete page route and stays synchronized with the app tree', () => {
    const routes = walkPages(appRoot).map(routeFromPage).sort();
    const manifestCount = PLATFORM_V7_ROUTE_MANIFEST.static.length + PLATFORM_V7_ROUTE_MANIFEST.dynamic.length;
    expect(manifestCount).toBe(routes.length);
    for (const route of routes) expect(isKnownPlatformV7Route(sampleRoute(route)), route).toBe(true);
  });

  it('rejects unknown and prefix-confusable paths before auth shell creation', () => {
    expect(isKnownPlatformV7Route('/platform-v7/unknown-route')).toBe(false);
    expect(isKnownPlatformV7Route('/platform-v7/deals')).toBe(true);
    expect(isKnownPlatformV7Route('/platform-v7/deals/DL-100/execution')).toBe(true);
    expect(isKnownPlatformV7Route('/platform-v7/deals/DL-100/execution/extra')).toBe(false);
    expect(isKnownPlatformV7Route('/platform-v7/staff-impersonation')).toBe(false);
  });
});
