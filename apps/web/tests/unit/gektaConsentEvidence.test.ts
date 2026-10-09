import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { currentGektaLegalEvidence, committedGektaDocumentHref, registrationConsentPresentation } from '@/lib/gekta/consent-evidence-server';
import { GEKTA_LEGAL_VERSION, getGektaLegalDocument, renderLegalDocument } from '@/lib/gekta/legal';
import { getMerchantProfile } from '@/lib/gekta/merchant';
import GektaLegalDocumentPage from '@/app/legal/[slug]/page';
import GektaRegisterPage from '@/app/gekta/register/page';
import { GEKTA_CONSENT_SNAPSHOT_TTL_MS, canonicalLegalJson, isGektaLegalEvidence, legalContentHash,
  renderedLegalDocumentHash, sealGektaConsentSnapshot, verifyGektaConsentSnapshot } from '../../../../packages/domain-core/src/gekta-consent-evidence';

const TEST_KEY = 'gekta-public-document-commitment-fixture-32-chars';
const now = new Date('2026-10-08T00:00:00.000Z');
const original = { name: process.env.GEKTA_MERCHANT_LEGAL_NAME, profile: process.env.GEKTA_MERCHANT_PROFILE_ID,
  deliveryKey: process.env.REGISTRATION_DELIVERY_KEY };
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  for (const [key, value] of Object.entries({ GEKTA_MERCHANT_LEGAL_NAME: original.name,
    GEKTA_MERCHANT_PROFILE_ID: original.profile, REGISTRATION_DELIVERY_KEY: original.deliveryKey })) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
});

describe('Gekta displayed legal evidence', () => {
  it.each(['new-document-presentation', 'new-interface-locale'] as const)(
    'requires two fresh choices after %s on the same mounted registration client', async (change) => {
      vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 404 })));
      process.env.REGISTRATION_DELIVERY_KEY = TEST_KEY;
      process.env.GEKTA_MERCHANT_LEGAL_NAME = 'Local review fixture operator before';
      const firstPage = await GektaRegisterPage({ searchParams: Promise.resolve({ lang: 'ru' }) });
      const view = render(firstPage);
      fireEvent.change(screen.getByLabelText('Имя'), { target: { value: 'Иван Агроном' } });
      for (const box of screen.getAllByRole('checkbox')) fireEvent.click(box);
      expect(screen.getAllByRole('checkbox').map((box) => (box as HTMLInputElement).checked)).toEqual([true, true]);
      if (change === 'new-document-presentation') process.env.GEKTA_MERCHANT_LEGAL_NAME = 'Local review fixture operator after';
      const nextPage = await GektaRegisterPage({ searchParams: Promise.resolve({ lang: change === 'new-interface-locale' ? 'en' : 'ru' }) });
      expect(nextPage.props.consentPresentation.snapshot).not.toBe(firstPage.props.consentPresentation.snapshot);
      if (change === 'new-document-presentation') expect(nextPage.props.consentPresentation.termsHref).not.toBe(firstPage.props.consentPresentation.termsHref);
      view.rerender(nextPage);
      expect(screen.getAllByRole('checkbox').map((box) => (box as HTMLInputElement).checked)).toEqual([false, false]);
      expect(screen.getByLabelText(change === 'new-interface-locale' ? 'Name' : 'Имя')).toHaveValue('Иван Агроном');
      view.rerender(firstPage);
      expect(screen.getAllByRole('checkbox').map((box) => (box as HTMLInputElement).checked)).toEqual([false, false]);
    },
  );

  it('keeps both choices for a renewed proof of the same displayed documents', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 404 })));
    process.env.REGISTRATION_DELIVERY_KEY = TEST_KEY;
    const firstPage = await GektaRegisterPage({ searchParams: Promise.resolve({ lang: 'ru' }) });
    const view = render(firstPage);
    for (const box of screen.getAllByRole('checkbox')) fireEvent.click(box);
    const nextPage = await GektaRegisterPage({ searchParams: Promise.resolve({ lang: 'ru' }) });
    expect(nextPage.props.consentPresentation.snapshot).not.toBe(firstPage.props.consentPresentation.snapshot);
    expect(nextPage.props.consentPresentation.termsHref).toBe(firstPage.props.consentPresentation.termsHref);
    expect(nextPage.props.consentPresentation.privacyHref).toBe(firstPage.props.consentPresentation.privacyHref);
    view.rerender(nextPage);
    expect(screen.getAllByRole('checkbox').map((box) => (box as HTMLInputElement).checked)).toEqual([true, true]);
  });

  it.each(['neither', 'terms-only', 'privacy-only'] as const)(
    'blocks a direct submit with %s selected before any registration request', async (selected) => {
      const fetchMock = vi.fn(async (_input: string | URL | Request) => new Response('{}', { status: 404 }));
      vi.stubGlobal('fetch', fetchMock);
      process.env.REGISTRATION_DELIVERY_KEY = TEST_KEY;
      const page = await GektaRegisterPage({ searchParams: Promise.resolve({ lang: 'ru' }) });
      render(page);
      const boxes = screen.getAllByRole('checkbox');
      if (selected === 'terms-only') fireEvent.click(boxes[0]!);
      if (selected === 'privacy-only') fireEvent.click(boxes[1]!);
      fireEvent.submit(boxes[0]!.closest('form')!);
      expect(fetchMock.mock.calls.some(([input]) => String(input).endsWith('/api/gekta/auth/register'))).toBe(false);
    },
  );

  it('submits the new proof only after both independent choices are made again', async () => {
    const fetchMock = vi.fn(async (_input: string | URL | Request) => new Response('{}', { status: 404 }));
    vi.stubGlobal('fetch', fetchMock);
    process.env.REGISTRATION_DELIVERY_KEY = TEST_KEY;
    const firstPage = await GektaRegisterPage({ searchParams: Promise.resolve({ lang: 'ru' }) });
    const view = render(firstPage);
    for (const box of screen.getAllByRole('checkbox')) fireEvent.click(box);
    const nextPage = await GektaRegisterPage({ searchParams: Promise.resolve({ lang: 'en' }) });
    view.rerender(nextPage);
    const boxes = screen.getAllByRole('checkbox');
    fireEvent.submit(boxes[0]!.closest('form')!);
    expect(fetchMock.mock.calls.some(([input]) => String(input).endsWith('/api/gekta/auth/register'))).toBe(false);
    fireEvent.click(boxes[0]!);
    fireEvent.submit(boxes[0]!.closest('form')!);
    expect(fetchMock.mock.calls.some(([input]) => String(input).endsWith('/api/gekta/auth/register'))).toBe(false);
    fireEvent.click(boxes[1]!);
    fireEvent.submit(boxes[0]!.closest('form')!);
    const registrationCall = fetchMock.mock.calls.find(([input]) => String(input).endsWith('/api/gekta/auth/register'));
    expect(registrationCall).toBeDefined();
    const sent = JSON.parse(String((registrationCall as unknown as [string, RequestInit])[1].body));
    expect(sent).toMatchObject({ acceptedServiceTerms: true, acceptedPersonalData: true, locale: 'en',
      consentSnapshot: nextPage.props.consentPresentation.snapshot });
    await screen.findByRole('alert');
  });

  it('preserves an active MFA challenge and typed code across a locale transition', async () => {
    const fetchMock = vi.fn(async () => Response.json({ enrollmentRequired: false }));
    vi.stubGlobal('fetch', fetchMock);
    process.env.REGISTRATION_DELIVERY_KEY = TEST_KEY;
    const firstPage = await GektaRegisterPage({ searchParams: Promise.resolve({ lang: 'ru' }) });
    const view = render(firstPage);
    await screen.findByText('Введите второй фактор');
    fireEvent.change(screen.getByLabelText('Код MFA'), { target: { value: '123456' } });
    const nextPage = await GektaRegisterPage({ searchParams: Promise.resolve({ lang: 'en' }) });
    view.rerender(nextPage);
    expect(screen.getByText('Enter the second factor')).toBeInTheDocument();
    expect(screen.getByLabelText('MFA code')).toHaveValue('123456');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it.each(['ru', 'en', 'zh'] as const)('binds the actual rendered Russian documents and %s interface', (locale) => {
    const evidence = currentGektaLegalEvidence(locale, 'GEKTA_REGISTRATION');
    const profile = getMerchantProfile();
    expect(isGektaLegalEvidence(evidence)).toBe(true);
    expect(evidence).toMatchObject({ version: GEKTA_LEGAL_VERSION, surfaceLocale: locale, documentLocale: 'ru',
      profile: { id: profile.id, effectiveFrom: profile.effectiveFrom, contentHash: legalContentHash(profile) } });
    for (const kind of ['terms', 'privacy'] as const) {
      const expected = renderLegalDocument(getGektaLegalDocument(evidence[kind].document.slug)!, profile);
      expect(evidence[kind].document).toEqual(expected);
      expect(evidence[kind].contentHash).toBe(renderedLegalDocumentHash(GEKTA_LEGAL_VERSION, legalContentHash(profile), expected));
      expect(evidence[kind].source).not.toContain('/platform-v7/');
      if (kind === 'terms') expect(expected.sections.at(-1)?.heading).toBe('Исполнитель');
    }
    const token = sealGektaConsentSnapshot(evidence, TEST_KEY, now);
    expect(verifyGektaConsentSnapshot(token, evidence, TEST_KEY, now)).toEqual({ issuedAt: now.getTime(), evidenceHash: legalContentHash(evidence) });
  });

  it('keeps separate registration purposes distinct from the combined anonymous notice', () => {
    const anonymous = currentGektaLegalEvidence('ru', 'GEKTA_ANONYMOUS_NOTICE');
    expect(isGektaLegalEvidence(anonymous)).toBe(true);
    expect(anonymous.terms.purpose).toBe('TERMS_NOTICE');
    expect(anonymous.privacy.purpose).toBe('PRIVACY_NOTICE');
    expect(sealGektaConsentSnapshot(anonymous, TEST_KEY, now)).toBeNull();
  });

  it('is stable for object-key order, sensitive to document order/content and operator profile', () => {
    expect(canonicalLegalJson({ z: 1, a: { b: 2, a: 3 } })).toBe(canonicalLegalJson({ a: { a: 3, b: 2 }, z: 1 }));
    const first = currentGektaLegalEvidence('ru', 'GEKTA_REGISTRATION');
    process.env.GEKTA_MERCHANT_LEGAL_NAME = 'Test operator';
    process.env.GEKTA_MERCHANT_PROFILE_ID = 'new-operator-profile';
    const changed = currentGektaLegalEvidence('ru', 'GEKTA_REGISTRATION');
    expect(changed.profile.contentHash).not.toBe(first.profile.contentHash);
    expect(changed.terms.contentHash).not.toBe(first.terms.contentHash);
    const token = sealGektaConsentSnapshot(first, TEST_KEY, now);
    expect(verifyGektaConsentSnapshot(token, changed, TEST_KEY, now)).toBeNull();
    expect(legalContentHash(['a', 'b'])).not.toBe(legalContentHash(['b', 'a']));
  });

  it('rejects signature/key/locale/content changes, future/expired/invalid clocks and malformed inputs', () => {
    const evidence = currentGektaLegalEvidence('ru', 'GEKTA_REGISTRATION');
    const token = sealGektaConsentSnapshot(evidence, TEST_KEY, now)!;
    expect(verifyGektaConsentSnapshot(`${token}x`, evidence, TEST_KEY, now)).toBeNull();
    expect(verifyGektaConsentSnapshot(token, evidence, `${TEST_KEY}x`, now)).toBeNull();
    expect(verifyGektaConsentSnapshot(token, { ...evidence, surfaceLocale: 'zh' }, TEST_KEY, now)).toBeNull();
    expect(verifyGektaConsentSnapshot(token, evidence, TEST_KEY, new Date(now.getTime() - 1))).toBeNull();
    expect(verifyGektaConsentSnapshot(token, evidence, TEST_KEY, new Date(now.getTime() + GEKTA_CONSENT_SNAPSHOT_TTL_MS))).toBeNull();
    expect(verifyGektaConsentSnapshot(token, evidence, TEST_KEY, new Date(NaN))).toBeNull();
    for (const malformed of [null, [], {}, { ...evidence, extra: 'unsigned' }, { ...evidence, terms: { ...evidence.terms, extra: 'unsigned' } },
      { ...evidence, terms: { ...evidence.terms, document: { ...evidence.terms.document, summary: 'changed' } } }]) {
      expect(isGektaLegalEvidence(malformed)).toBe(false);
      expect(verifyGektaConsentSnapshot(token, malformed, TEST_KEY, now)).toBeNull();
    }
    expect(sealGektaConsentSnapshot(evidence, 'short', now)).toBeNull();
    expect(token).not.toContain(TEST_KEY);
  });

  it('renders the exact committed document and rejects an incomplete/stale commitment link', async () => {
    const evidence = currentGektaLegalEvidence('ru', 'GEKTA_REGISTRATION');
    const href = new URL(committedGektaDocumentHref(evidence, 'terms'), 'https://example.test');
    const params = Promise.resolve({ slug: evidence.terms.document.slug });
    const commitment = Object.fromEntries(href.searchParams.entries());
    const html = renderToStaticMarkup(await GektaLegalDocumentPage({ params, searchParams: Promise.resolve(commitment) }));
    expect(html).toContain('Исполнитель');
    expect(html).toContain(GEKTA_LEGAL_VERSION);
    await expect(GektaLegalDocumentPage({ params, searchParams: Promise.resolve({ ...commitment, h: '0'.repeat(64) }) })).rejects.toThrow();
    await expect(GektaLegalDocumentPage({ params, searchParams: Promise.resolve({ v: evidence.version }) })).rejects.toThrow();
    process.env.GEKTA_MERCHANT_LEGAL_NAME = 'Changed after form render';
    await expect(GektaLegalDocumentPage({ params, searchParams: Promise.resolve(commitment) })).rejects.toThrow();
    // The ordinary public document route continues to display the actual current profile.
    expect(renderToStaticMarkup(await GektaLegalDocumentPage({ params }))).toContain('Changed after form render');
  });

  it('builds the actual registration form with its locale-bound commitment and no server key', async () => {
    process.env.REGISTRATION_DELIVERY_KEY = TEST_KEY;
    const page = await GektaRegisterPage({ searchParams: Promise.resolve({ lang: 'en' }) });
    const shown = page.props.consentPresentation;
    expect(verifyGektaConsentSnapshot(shown.snapshot, currentGektaLegalEvidence('en', 'GEKTA_REGISTRATION'), TEST_KEY)).not.toBeNull();
    expect(shown.termsHref).toContain('v=2026-08-12.2');
    expect(JSON.stringify(page.props)).not.toContain(TEST_KEY);
    expect(registrationConsentPresentation('en', 'short').snapshot).toBeNull();
  });
});
