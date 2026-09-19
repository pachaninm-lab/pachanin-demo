import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { russianConversationCount } from '@/components/gekta/GektaProjectList';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');
const projects = read('components/gekta/GektaProjectList.tsx');
const registration = read('components/gekta/GektaRegistrationClient.tsx');
const message = read('components/gekta/GektaMessage.tsx');

describe('Gekta screenshot regressions', () => {
  it('uses full Russian plural rules for project conversation counts', () => {
    const cases: Array<[number, string]> = [
      [0, '0 диалогов'], [1, '1 диалог'], [2, '2 диалога'], [4, '4 диалога'], [5, '5 диалогов'],
      [11, '11 диалогов'], [12, '12 диалогов'], [14, '14 диалогов'], [21, '21 диалог'], [22, '22 диалога'], [25, '25 диалогов'],
    ];
    for (const [count, expected] of cases) expect(russianConversationCount(count)).toBe(expected);
  });

  it('cannot leak native list bullets into project rows', () => {
    expect(projects).toContain("className='m-0 mt-2 list-none space-y-1 p-0'");
    expect(projects).toContain('group list-none rounded-xl');
  });

  it('keeps registration readable without a gradient and removes internal copy', () => {
    expect(registration).toContain("data-gekta-registration-hero='true'");
    expect(registration).toContain("bg-emerald-950 bg-gradient-to-br");
    expect(registration).toContain("style={{ backgroundColor: '#064e3b' }}");
    expect(registration).toContain('placeholder:text-slate-400');
    expect(registration).not.toContain('DECLARED');
    expect(registration).toContain('номер сохраняется как неподтверждённый');
  });

  it('pins assistant actions to neutral Gekta colors instead of browser link blue', () => {
    expect(message).toContain("text-slate-600 no-underline visited:text-slate-600");
    expect(message).toContain("data-gekta-message-actions='true'");
  });
});
