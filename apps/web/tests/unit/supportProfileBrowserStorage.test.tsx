import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

/**
 * ASVS 5.0 V14.3.3 - browser storage must not contain sensitive data, session
 * tokens excepted.
 *
 * The support widget used to persist a name, a contact and an organization into
 * sessionStorage AND localStorage, and it collected them with a capture-phase
 * listener on the login, registration and contact surfaces rather than from its
 * own form. This suite holds the fix to both halves of the requirement: nothing
 * sensitive is written, and what earlier versions already wrote is removed from
 * the browsers that still hold it.
 *
 * It also holds the line the fix must not cross: the prefill is a real feature
 * and is still expected to work for the life of the page.
 */

const PERSISTED_KEYS = ['pc_v7_support_profile', 'pc_v7_registration_profile', 'pc_v7_profile'];
const NAME = 'Панчанин Максим Владимирович';
const EMAIL = 'maksim.panchanin@example.org';
const PHONE = '+7 916 277 89 89';
const ORGANIZATION = 'ООО «Гекта Агро»';
const UNRELATED_KEY = 'pc_v7_theme';

/**
 * A fresh module instance, which is what a new page load gives the widget. The
 * profile is deliberately module state with a page lifetime, so every test that
 * reasons about that lifetime has to be able to end it.
 */
async function loadWidget() {
  vi.resetModules();
  const module = await import('../../components/platform-v7/ChatSupportWidget');
  return module.ChatSupportWidget;
}

function labelledField(surface: HTMLElement, labelText: string, value: string) {
  const label = document.createElement('label');
  const caption = document.createElement('span');
  caption.textContent = labelText;
  const input = document.createElement('input');
  input.value = value;
  label.append(caption, input);
  surface.append(label);
  return input;
}

/**
 * The registration surface as the widget sees it: a form carrying one of the
 * three class names its capture listener watches, with the labels it reads.
 */
function registrationSurface() {
  const form = document.createElement('form');
  form.className = 'p7-register-page';
  const fields = {
    name: labelledField(form, 'ФИО ответственного', NAME),
    phone: labelledField(form, 'Телефон', PHONE),
    email: labelledField(form, 'Email', EMAIL),
    organization: labelledField(form, 'Название организации', ORGANIZATION),
  };
  document.body.append(form);
  return { form, fields };
}

function fillRegistrationSurface() {
  const { form, fields } = registrationSurface();
  fireEvent.input(fields.name);
  fireEvent.input(fields.email);
  fireEvent.input(fields.organization);
  fireEvent.submit(form);
  return form;
}

function storageEntries() {
  const entries: Array<{ storage: string; key: string; value: string }> = [];
  for (const [label, storage] of [['sessionStorage', window.sessionStorage], ['localStorage', window.localStorage]] as const) {
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (key === null) continue;
      entries.push({ storage: label, key, value: storage.getItem(key) ?? '' });
    }
  }
  return entries;
}

function persistedKeyStates() {
  return PERSISTED_KEYS.flatMap((key) => [
    `sessionStorage/${key}=${window.sessionStorage.getItem(key)}`,
    `localStorage/${key}=${window.localStorage.getItem(key)}`,
  ]);
}

function seedLegacyProfile() {
  const value = JSON.stringify({ name: NAME, contact: EMAIL, organization: ORGANIZATION });
  for (const storage of [window.sessionStorage, window.localStorage]) {
    for (const key of PERSISTED_KEYS) storage.setItem(key, value);
  }
}

async function openSupportPanel() {
  fireEvent.click(await screen.findByRole('button', { name: 'Открыть поддержку' }));
  return screen.findByRole('dialog');
}

/**
 * Everything the open panel is showing the user, text and field values alike.
 *
 * Reading textContent alone is not enough and was not enough: a profile read
 * back out of storage reaches the panel as the value of the name and contact
 * inputs, which textContent does not see at all.
 */
function panelContents(panel: HTMLElement) {
  const fields = Array.from(panel.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input,textarea'))
    .map((field) => field.value);
  return [panel.textContent || '', ...fields].join('\n');
}

describe('support profile is not kept in browser storage (ASVS V14.3.3)', () => {
  beforeEach(() => {
    document.documentElement.lang = 'ru';
    window.sessionStorage.clear();
    window.localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    document.body.replaceChildren();
    window.sessionStorage.clear();
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it('writes nothing to sessionStorage or localStorage when it captures a profile', async () => {
    const ChatSupportWidget = await loadWidget();
    render(<ChatSupportWidget />);

    fillRegistrationSurface();

    expect(persistedKeyStates()).toEqual([
      'sessionStorage/pc_v7_support_profile=null',
      'localStorage/pc_v7_support_profile=null',
      'sessionStorage/pc_v7_registration_profile=null',
      'localStorage/pc_v7_registration_profile=null',
      'sessionStorage/pc_v7_profile=null',
      'localStorage/pc_v7_profile=null',
    ]);
  });

  it('leaves no trace of the captured values anywhere in browser storage', async () => {
    const ChatSupportWidget = await loadWidget();
    render(<ChatSupportWidget />);

    fillRegistrationSurface();
    await openSupportPanel();

    // Not key-by-key: the requirement is about what storage holds, so this looks
    // for the values themselves under any name the widget might reach for.
    const leaked = storageEntries().filter((entry) =>
      [NAME, EMAIL, PHONE, ORGANIZATION].some((secret) => entry.value.includes(secret)));
    expect(leaked).toEqual([]);
  });

  it('removes a profile an earlier version persisted, on mount', async () => {
    seedLegacyProfile();
    window.localStorage.setItem(UNRELATED_KEY, 'dark');

    const ChatSupportWidget = await loadWidget();
    render(<ChatSupportWidget />);

    expect(persistedKeyStates()).toEqual([
      'sessionStorage/pc_v7_support_profile=null',
      'localStorage/pc_v7_support_profile=null',
      'sessionStorage/pc_v7_registration_profile=null',
      'localStorage/pc_v7_registration_profile=null',
      'sessionStorage/pc_v7_profile=null',
      'localStorage/pc_v7_profile=null',
    ]);
  });

  it('purges only the profile keys and leaves unrelated preferences alone', async () => {
    seedLegacyProfile();
    window.localStorage.setItem(UNRELATED_KEY, 'dark');
    window.sessionStorage.setItem(UNRELATED_KEY, 'dark');

    const ChatSupportWidget = await loadWidget();
    render(<ChatSupportWidget />);

    expect(window.localStorage.getItem(UNRELATED_KEY)).toBe('dark');
    expect(window.sessionStorage.getItem(UNRELATED_KEY)).toBe('dark');
  });

  it('does not read a persisted profile back before purging it', async () => {
    seedLegacyProfile();

    const ChatSupportWidget = await loadWidget();
    render(<ChatSupportWidget />);
    const panel = await openSupportPanel();

    // A purge that ran after a read would have removed the keys and still put
    // the name in front of the user, which is the same data surviving the fix
    // by another route.
    expect(panelContents(panel)).not.toContain(NAME);
    expect(panelContents(panel)).not.toContain(EMAIL);
  });

  it('still prefills the panel from what was typed on the page', async () => {
    const ChatSupportWidget = await loadWidget();
    render(<ChatSupportWidget />);

    fillRegistrationSurface();
    const panel = await openSupportPanel();

    expect(panelContents(panel)).toContain(NAME);
    expect(panelContents(panel)).toContain(EMAIL);
  });

  it('carries the captured profile no further than the page that captured it', async () => {
    const ChatSupportWidget = await loadWidget();
    const first = render(<ChatSupportWidget />);
    fillRegistrationSurface();
    await openSupportPanel();
    expect(panelContents(await screen.findByRole('dialog'))).toContain(NAME);

    first.unmount();
    document.body.replaceChildren();

    // A new page load: a fresh module instance, with only browser storage able
    // to carry anything across. Nothing should.
    const ReloadedWidget = await loadWidget();
    render(<ReloadedWidget />);
    const panel = await openSupportPanel();

    expect(panelContents(panel)).not.toContain(NAME);
    expect(panelContents(panel)).not.toContain(EMAIL);
    expect(screen.getByPlaceholderText('Как к вам обращаться')).toHaveValue('');
    expect(screen.getByPlaceholderText('Контакт для ответа')).toHaveValue('');
  });
});
