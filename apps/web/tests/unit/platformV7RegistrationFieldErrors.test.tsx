// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { createElement } from 'react';
import { RegisterFormClientPublic } from '@/app/platform-v7/register/RegisterFormClientPublic';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('public registration confirmation error UX-13', () => {
  for (const locale of ['ru', 'en', 'zh'] as const) {
    it(`${locale}: focuses the mismatched field, explains it and keeps all entries`, async () => {
      const post = vi.fn(() => { throw new Error('No registration POST on a client mismatch'); });
      vi.stubGlobal('fetch', post);
      const { container } = render(createElement(RegisterFormClientPublic, { locale }));
      const form = container.querySelector<HTMLFormElement>('form.p0-register-form')!;
      const fill = (name: string, value: string) => {
        const input = form.querySelector<HTMLInputElement>(`[name="${name}"]`)!;
        fireEvent.change(input, { target: { value } });
        return input;
      };
      fill('orgLegalName', 'Fixture Organisation');
      fill('orgInn', '1234567890');
      fill('region', 'Tambov');
      fill('fullName', 'Fixture Person');
      fill('position', 'Director');
      fill('phone', '+79990000000');
      fill('email', 'fixture@example.invalid');
      const password = fill('password', 'StrongPassword#123');
      const confirm = fill('confirmPassword', 'DifferentPassword#123');
      fireEvent.click(form.querySelector<HTMLInputElement>('[name="acceptTerms"]')!);
      fireEvent.click(form.querySelector<HTMLInputElement>('[name="acceptPrivacy"]')!);
      expect(form.checkValidity()).toBe(true);
      await act(async () => { fireEvent.submit(form); });
      expect(document.activeElement).toBe(confirm);
      expect(confirm.getAttribute('aria-invalid')).toBe('true');
      const hintId = confirm.getAttribute('aria-describedby');
      expect(hintId).toBe('p0-register-confirm-error');
      expect(container.querySelector(`#${hintId}`)?.textContent).toBeTruthy();
      expect(form.querySelector('[role="alert"]')?.textContent).toBeTruthy();
      expect(password.value).toBe('StrongPassword#123');
      expect(confirm.value).toBe('DifferentPassword#123');
      expect(post).not.toHaveBeenCalled();

      fireEvent.change(confirm, { target: { value: 'StrongPassword#123' } });
      expect(confirm.getAttribute('aria-invalid')).toBe('false');
      expect(password.value).toBe('StrongPassword#123');
      expect(form.querySelector('#p0-register-confirm-error')).toBeNull();
    });
  }
});
