import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PlatformV7LeadCapture } from '../PlatformV7LeadCapture';

const pathnameMock = vi.fn(() => '/platform-v7/request');

vi.mock('next/navigation', () => ({
  usePathname: () => pathnameMock(),
}));

describe('PlatformV7LeadCapture', () => {
  it('renders the request page form with official public copy', () => {
    pathnameMock.mockReturnValue('/platform-v7/request');

    render(<PlatformV7LeadCapture />);

    expect(screen.getByRole('heading', { name: /Заявка на демонстрацию и разбор сделки/i })).toBeInTheDocument();
    const form = screen.getByRole('button', { name: /Отправить заявку/i }).closest('form');
    expect(form).toHaveAttribute('action', '/api/platform-v7/leads');
    expect(form).toHaveAttribute('method', 'post');
    expect(screen.getByDisplayValue('request_page_lead_form')).toHaveAttribute('name', 'source');
    expect(screen.getByDisplayValue('demo')).toHaveAttribute('name', 'interest');
    expect(screen.getByLabelText('Email')).toHaveAttribute('name', 'email');
    expect(screen.getByLabelText('Телефон')).toHaveAttribute('name', 'phone');
    expect(screen.queryByText(/CRM-контур/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/controlled pilot/i)).not.toBeInTheDocument();
  });

  it('does not render on the public platform homepage anymore', () => {
    pathnameMock.mockReturnValue('/platform-v7');

    const { container } = render(<PlatformV7LeadCapture />);

    expect(container).toBeEmptyDOMElement();
  });
});
