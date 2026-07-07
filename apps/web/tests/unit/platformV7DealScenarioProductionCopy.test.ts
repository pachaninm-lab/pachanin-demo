import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
function read(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

describe('platform-v7 deal scenario production copy', () => {
  it('keeps the compatibility route positioned as an execution circuit', () => {
    const source = read('apps/web/app/platform-v7/demo/DemoCleanClient.tsx');

    expect(source).toContain('Сценарий исполнения показывает путь после цены');
    expect(source).toContain('Внешние интеграции подключаются по договору и ключам доступа');
    expect(source).toContain('DL-EXEC-001');
    expect(source).toContain('The execution scenario shows the path after price agreement');
    expect(source).toContain('外部集成按合同和访问密钥接入');
  });
});
