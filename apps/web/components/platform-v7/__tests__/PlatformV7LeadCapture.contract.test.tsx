import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PlatformV7LeadCapture } from '../PlatformV7LeadCapture';

const pathnameMock = vi.fn(() => '/platform-v7/request');

vi.mock('next/navigation', () => ({
  usePathname: () => pathnameMock(),
}));

describe('PlatformV7LeadCapture', () => {
  it('renders the request page lead form with CRM-ready fields', () => {
    pathnameMock.mockReturnValue('/platform-v7/request');

    render(<PlatformV7LeadCapture />);

    expect(screen.getByRole('heading', { name: /Оставить заявку/i })).toBeInTheDocument();
    const form = screen.getByRole('button', { name: /Оставить заявку/i }).closest('form');
    expect(form).toHaveAttribute('action', '/api/platform-v7/leads');
    expect(form).toHaveAttribute('method', 'post');
    expect(screen.getByDisplayValue('request_page_lead_form')).toHaveAttribute('name', 'source');
    expect(screen.getByDisplayValue('demo')).toHaveAttribute('name', 'interest');
    expect(screen.getByLabelText('Email')).toHaveAttribute('name', 'email');
    expect(screen.getByLabelText('Телефон')).toHaveAttribute('name', 'phone');
  });

  it('does not render on the public platform homepage anymore', () => {
    pathnameMock.mockReturnValue('/platform-v7');

    const { container } = render(<PlatformV7LeadCapture />);

    expect(container).toBeEmptyDOMElement();
  });
});
