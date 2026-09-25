import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(process.cwd(), '../..');
const source = fs.readFileSync(path.join(root, 'apps/web/components/platform-v7/FirstCustomerWorkspace.tsx'), 'utf8');
const css = fs.readFileSync(path.join(root, 'apps/web/components/platform-v7/FirstCustomerWorkspace.module.css'), 'utf8');

describe('buyer first-customer home', () => {
  it('explains server facts and navigation without inventing priority in RU, EN and ZH', () => {
    for (const phrase of [
      'подтверждённой серверной сессии покупателя',
      "buyer’s confirmed server session",
      '买方已确认的服务器会话',
      'банковское подтверждение',
      'bank confirmation',
      '银行确认',
    ]) expect(source).toContain(phrase);
    expect(source).toContain("surface === 'buyer' ? copy.buyerDescription : copy.description");
    expect(source).toContain("surface === 'buyer' && !workspace.ownerControlled && state === 'ready'");
    expect(source).toContain("state === 'ready' && !workspace.ownerControlled");
    expect(source).toContain("result: priorityUnknown ? copy.priorityUnknownResult");
  });

  it('keeps queue guidance readable without visual-only status semantics', () => {
    expect(css).toContain('line-height: 1.5');
    expect(css).not.toMatch(/#[0-9a-f]{3,8}\b|!important/i);
    expect(source).toContain("<p className={styles.buyerQueueNote}>{copy.buyerQueueNote}</p>");
  });
});
