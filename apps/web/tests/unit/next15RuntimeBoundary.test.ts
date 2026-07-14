import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const webRoot = path.resolve(__dirname, '../..');
const packageJson = JSON.parse(fs.readFileSync(path.join(webRoot, 'package.json'), 'utf8')) as {
  dependencies?: Record<string, string>;
};

describe('Next.js 15 runtime boundary', () => {
  it('pins the minimum security-qualified Next.js release', () => {
    expect(packageJson.dependencies?.next).toBe('15.5.16');
  });

  it('does not couple the framework security patch to a React major migration', () => {
    expect(packageJson.dependencies?.react).toBe('18.3.1');
    expect(packageJson.dependencies?.['react-dom']).toBe('18.3.1');
  });

  it('retains the existing next-intl line that declares Next.js 15 and React 18 compatibility', () => {
    expect(packageJson.dependencies?.['next-intl']).toBe('^3.26.5');
  });
});
