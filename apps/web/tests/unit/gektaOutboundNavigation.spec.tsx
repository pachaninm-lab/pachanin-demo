import { describe, expect, it, vi, afterEach } from 'vitest';
import { fireEvent, render, screen, cleanup } from '@testing-library/react';
import { GektaSourceList } from '../../components/gekta/GektaSourceList';

/**
 * ASVS V3.7.3, at the behaviour rather than at the source text: clicking a
 * citation that leaves this origin must not navigate until the person says so,
 * and must be cancellable.
 */

const citation = (uri: string, sourceId = 's1') => ({
  sourceId,
  uri,
  title: 'Источник',
} as never);

describe('leaving for a citation', () => {
  // The test document's own origin is the page origin the component compares
  // against; there is no need to invent another one.
  const PAGE_ORIGIN = 'http://localhost:3000';
  afterEach(() => { cleanup(); vi.restoreAllMocks(); });

  it('does not navigate on the click, and names the destination instead', () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    render(<GektaSourceList citations={[citation('https://rosstat.gov.ru/r/7')]} label='Источники' />);

    const link = screen.getByRole('link');
    expect(link.getAttribute('data-outbound')).toBe('true');
    // A click the browser would follow: not defaultPrevented means it navigates.
    const followed = fireEvent.click(link);
    expect(followed).toBe(false); // preventDefault was called
    expect(open).not.toHaveBeenCalled();

    const notice = screen.getByTestId('gekta-outbound-notice');
    expect(notice.textContent).toContain('rosstat.gov.ru');
    expect(notice.getAttribute('role')).toBe('alertdialog');
  });

  it('cancelling leaves the person where they were', () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    render(<GektaSourceList citations={[citation('https://rosstat.gov.ru/r/7')]} label='Источники' />);
    fireEvent.click(screen.getByRole('link'));
    fireEvent.click(screen.getByTestId('gekta-outbound-cancel'));
    expect(screen.queryByTestId('gekta-outbound-notice')).toBeNull();
    expect(open).not.toHaveBeenCalled();
  });

  it('confirming navigates, once, to the destination that was named', () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    const onOpen = vi.fn();
    render(<GektaSourceList citations={[citation('https://rosstat.gov.ru/r/7')]} label='Источники' onOpen={onOpen} />);
    fireEvent.click(screen.getByRole('link'));
    fireEvent.click(screen.getByTestId('gekta-outbound-continue'));
    expect(open).toHaveBeenCalledTimes(1);
    expect(open).toHaveBeenCalledWith('https://rosstat.gov.ru/r/7', '_blank', 'noopener,noreferrer');
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('gekta-outbound-notice')).toBeNull();
  });

  it('a same-origin citation is followed without a notice', () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    render(<GektaSourceList citations={[citation(`${PAGE_ORIGIN}/platform-v7/market`)]} label='Источники' />);
    const link = screen.getByRole('link');
    expect(link.getAttribute('data-outbound')).toBe('false');
    const followed = fireEvent.click(link);
    expect(followed).toBe(true); // not prevented: the browser follows it
    expect(screen.queryByTestId('gekta-outbound-notice')).toBeNull();
    expect(open).not.toHaveBeenCalled();
  });

  it('a citation with a scheme that is not a web destination is not offered at all', () => {
    render(<GektaSourceList citations={[citation('javascript:alert(1)')]} label='Источники' />);
    expect(screen.queryByRole('link')).toBeNull();
  });
});
