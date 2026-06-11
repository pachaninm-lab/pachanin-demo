import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import BankCleanPage from '@/app/platform-v7/bank/clean/page';

describe('platform-v7 bank clean room', () => {
  it('renders money gate ring and payment basis table from deal360 source of truth', () => {
    const { container } = render(<BankCleanPage />);

    expect(screen.getByTestId('money-gate-ring')).toBeInTheDocument();
    expect(screen.getAllByText(/Основание выплаты/).length).toBeGreaterThan(0);
    expect(screen.getByText((_, el) => el?.textContent === '7 из 9 документов блокируют выплату' && el.tagName === 'SPAN')).toBeInTheDocument();
    expect(container.querySelectorAll('table tbody tr')).toHaveLength(9);
    expect(screen.getAllByText('блокирует выплату')).toHaveLength(7);
  });

  it('does not claim platform releases money and keeps zero released honest', () => {
    render(<BankCleanPage />);

    expect(screen.getByText(/Платформа деньги не выпускает/)).toBeInTheDocument();
    expect(screen.getByText('Банк подтвердил выплату')).toBeInTheDocument();
    expect(screen.getAllByText('0 ₽').length).toBeGreaterThan(0);
  });

  it('shows disputed hold from DL-9102 with stop styling duplicated by text', () => {
    render(<BankCleanPage />);

    expect(screen.getByText(/Удержание по спору · DL-9102/)).toBeInTheDocument();
    expect(screen.getAllByText('624 тыс. ₽').length).toBeGreaterThan(0);
    expect(screen.getByText(/DSP-9102-WEIGHT/)).toBeInTheDocument();
  });
});
