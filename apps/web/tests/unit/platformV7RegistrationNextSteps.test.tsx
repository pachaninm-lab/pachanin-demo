// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { createElement } from 'react';
import { RegisterFormClientPublic } from '@/app/platform-v7/register/RegisterFormClientPublic';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('public registration accepted next step UX-30', () => {
  const next = {
    ru: ['подтвердите почту', 'проверенный статус заявки', 'после проверки и одобрения'],
    en: ['confirm your address', 'verified application status', 'reviewed and approved'],
    zh: ['确认邮箱', '已核实的申请状态', '审核并获批准'],
  } as const;
  for (const locale of ['ru', 'en', 'zh'] as const) {
    it(`${locale}: accepted response explains conditional email, verification, status and support`, async () => {
      vi.stubGlobal('crypto', { randomUUID: () => 'fixture-idempotency-key' });
      const post = vi.fn().mockResolvedValue({
        ok: true, status: 202, json: async () => ({ accepted: true }),
      });
      vi.stubGlobal('fetch', post);
      const { container } = render(createElement(RegisterFormClientPublic, { locale }));
      const form = container.querySelector<HTMLFormElement>('form.p0-register-form')!;
      const fill = (name: string, value: string) =>
        fireEvent.change(form.querySelector<HTMLInputElement>(`[name="${name}"]`)!, { target: { value } });
      fill('orgLegalName', 'Fixture Organisation');
      fill('orgInn', '1234567890');
      fill('region', 'Tambov');
      fill('fullName', 'Fixture Person');
      fill('position', 'Director');
      fill('phone', '+79990000000');
      fill('email', 'fixture@example.invalid');
      fill('password', 'StrongPassword#123');
      fill('confirmPassword', 'StrongPassword#123');
      fireEvent.click(form.querySelector<HTMLInputElement>('[name="acceptTerms"]')!);
      fireEvent.click(form.querySelector<HTMLInputElement>('[name="acceptPrivacy"]')!);
      expect(form.checkValidity()).toBe(true);
      await act(async () => { fireEvent.submit(form); });
      expect(post).toHaveBeenCalledTimes(1);
      const state = container.querySelector('.p0-register-state')!;
      expect(state).toBeTruthy();
      for (const phrase of next[locale]) expect(state.textContent).toContain(phrase);
      expect(state.querySelector(`a[href="/platform-v7/contact?lang=${locale}"]`)).toBeTruthy();
      expect(state.textContent).not.toMatch(/24 hours|48 hours|сутки|小时内/);
    });
  }
});
