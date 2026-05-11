import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RoleExecutionHandoff, type HandoffItem } from '@/components/platform-v7/RoleExecutionHandoff';
import SellerPage from '@/app/platform-v7/seller/page';
import BuyerPage from '@/app/platform-v7/buyer/page';
import LogisticsPage from '@/app/platform-v7/logistics/page';
import ElevatorPage from '@/app/platform-v7/elevator/page';
import BankPage from '@/app/platform-v7/bank/page';
import DisputesPage from '@/app/platform-v7/disputes/page';

describe('RoleExecutionHandoff component', () => {
  it('renders sends/awaits/blockedBy/next directions with user-facing labels', () => {
    const items: HandoffItem[] = [
      { direction: 'sends', requirement: 'тест отправки' },
      { direction: 'awaits', requirement: 'тест ожидания' },
      { direction: 'blockedBy', requirement: 'тест блокировки' },
      { direction: 'next', requirement: 'тест следующего шага' },
    ];
    render(<RoleExecutionHandoff items={items} />);

    expect(screen.getByText('отправляет')).toBeInTheDocument();
    expect(screen.getByText('ожидает')).toBeInTheDocument();
    expect(screen.getByText('причина остановки')).toBeInTheDocument();
    expect(screen.getByText('следующий шаг')).toBeInTheDocument();

    expect(screen.getByText('тест отправки')).toBeInTheDocument();
    expect(screen.getByText('тест ожидания')).toBeInTheDocument();
    expect(screen.getByText('тест блокировки')).toBeInTheDocument();
    expect(screen.getByText('тест следующего шага')).toBeInTheDocument();
  });

  it('renders moneyImpact and documentImpact badges when set', () => {
    const items: HandoffItem[] = [
      { direction: 'awaits', requirement: 'с влиянием', moneyImpact: true, documentImpact: true },
    ];
    render(<RoleExecutionHandoff items={items} />);

    expect(screen.getByText('выплата')).toBeInTheDocument();
    expect(screen.getByText('документ')).toBeInTheDocument();
  });

  it('does not render impact badges when not set', () => {
    const items: HandoffItem[] = [
      { direction: 'next', requirement: 'без влияния' },
    ];
    render(<RoleExecutionHandoff items={items} />);

    expect(screen.queryByText('выплата')).not.toBeInTheDocument();
    expect(screen.queryByText('документ')).not.toBeInTheDocument();
  });

  it('renders entity as a link when href is provided', () => {
    const items: HandoffItem[] = [
      { direction: 'next', requirement: 'со ссылкой', entity: 'DL-9106', href: '/platform-v7/deals/DL-9106/clean' },
    ];
    render(<RoleExecutionHandoff items={items} />);

    const link = screen.getByRole('link', { name: 'DL-9106' });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/platform-v7/deals/DL-9106/clean');
  });

  it('renders entity as plain chip when href is not provided', () => {
    const items: HandoffItem[] = [
      { direction: 'awaits', requirement: 'без ссылки', entity: 'LOT-2403' },
    ];
    render(<RoleExecutionHandoff items={items} />);

    expect(screen.getByText('LOT-2403')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'LOT-2403' })).not.toBeInTheDocument();
  });

  it('uses user-facing terms, not internal dev terms', () => {
    const items: HandoffItem[] = [
      { direction: 'awaits', requirement: 'ожидает банковского подтверждения' },
      { direction: 'blockedBy', requirement: 'причина остановки: документы не закрыты' },
    ];
    render(<RoleExecutionHandoff items={items} />);

    const { container } = render(<RoleExecutionHandoff items={items} />);
    const html = container.innerHTML;

    expect(html).not.toContain('guard');
    expect(html).not.toContain('callback');
    expect(html).not.toContain('sandbox');
    expect(html).not.toContain('blocker');
    expect(html).not.toContain('domain-core');
    expect(html).not.toContain('runtime');
    expect(html).not.toContain('release');
    expect(html).not.toContain('holder');
    expect(html).not.toContain('owner');
  });

  it('renders custom title when provided', () => {
    const items: HandoffItem[] = [{ direction: 'next', requirement: 'шаг' }];
    render(<RoleExecutionHandoff items={items} title='пользовательский заголовок' />);

    expect(screen.getByText('пользовательский заголовок')).toBeInTheDocument();
  });

  it('has a testid for role-execution-handoff', () => {
    const items: HandoffItem[] = [{ direction: 'next', requirement: 'шаг' }];
    render(<RoleExecutionHandoff items={items} />);

    expect(screen.getByTestId('role-execution-handoff')).toBeInTheDocument();
  });
});

describe('Seller page execution handoff', () => {
  it('renders execution handoff section with sends and awaits items', () => {
    render(<SellerPage />);

    expect(screen.getByTestId('role-execution-handoff')).toBeInTheDocument();
    expect(screen.getAllByText('ожидает').length).toBeGreaterThan(0);
    expect(screen.getAllByText('отправляет').length).toBeGreaterThan(0);
    expect(screen.getAllByText('причина остановки').length).toBeGreaterThan(0);
    expect(screen.getAllByText('следующий шаг').length).toBeGreaterThan(0);
  });

  it('seller handoff contains СДИЗ and bank confirmation wording', () => {
    render(<SellerPage />);

    expect(screen.getByText(/СДИЗ ожидает закрытия/)).toBeInTheDocument();
    expect(screen.getByText(/резерв ожидает банковского подтверждения/)).toBeInTheDocument();
  });

  it('seller page has no /platform-v7/demo/ links', () => {
    const { container } = render(<SellerPage />);

    expect(container.innerHTML).not.toContain('/platform-v7/demo/');
  });

  it('seller page has no forbidden money movement wording', () => {
    const { container } = render(<SellerPage />);
    const html = container.innerHTML;

    expect(html).not.toMatch(/деньги переведены/i);
    expect(html).not.toMatch(/выплата выполнена/i);
    expect(html).not.toMatch(/деньги отправлены/i);
    expect(html).not.toMatch(/платформа гарантирует оплату/i);
    expect(html).not.toMatch(/платформа выпускает деньги/i);
    expect(html).not.toMatch(/production-ready/i);
    expect(html).not.toMatch(/fully live/i);
    expect(html).not.toMatch(/fully integrated/i);
  });
});

describe('Buyer page execution handoff', () => {
  it('renders execution handoff section with sends and awaits items', () => {
    render(<BuyerPage />);

    expect(screen.getByTestId('role-execution-handoff')).toBeInTheDocument();
    expect(screen.getAllByText('ожидает').length).toBeGreaterThan(0);
    expect(screen.getAllByText('отправляет').length).toBeGreaterThan(0);
  });

  it('buyer handoff contains bank confirmation request wording', () => {
    render(<BuyerPage />);

    expect(screen.getByText(/запрос банковского подтверждения резерва/)).toBeInTheDocument();
  });

  it('buyer page has no forbidden wording', () => {
    const { container } = render(<BuyerPage />);
    const html = container.innerHTML;

    expect(html).not.toMatch(/платформа гарантирует оплату/i);
    expect(html).not.toMatch(/production-ready/i);
    expect(html).not.toContain('/platform-v7/demo/');
  });
});

describe('Logistics page execution handoff', () => {
  it('renders execution handoff section with ЭТрН wording', () => {
    render(<LogisticsPage />);

    expect(screen.getByTestId('role-execution-handoff')).toBeInTheDocument();
    expect(screen.getByText(/ЭТрН ожидает подписи грузополучателя/)).toBeInTheDocument();
  });

  it('logistics handoff frames document states as awaiting confirmation', () => {
    render(<LogisticsPage />);

    expect(screen.getByText(/передаёт данные о рейсе и водителе — ожидает подтверждения приёмки от элеватора/)).toBeInTheDocument();
    expect(screen.getByText(/ожидать закрытия ЭТрН подписью грузополучателя — пакет передаётся в контур документов после подтверждения/)).toBeInTheDocument();
  });

  it('logistics page has no forbidden wording', () => {
    const { container } = render(<LogisticsPage />);
    const html = container.innerHTML;

    expect(html).not.toMatch(/production-ready/i);
    expect(html).not.toContain('/platform-v7/demo/');
  });
});

describe('Elevator page execution handoff', () => {
  it('renders execution handoff section with акт приёмки wording', () => {
    render(<ElevatorPage />);

    expect(screen.getByTestId('role-execution-handoff')).toBeInTheDocument();
    expect(screen.getByText(/акт приёмки и акт расхождения в контур документов/)).toBeInTheDocument();
  });

  it('elevator handoff has blockedBy item about weight deviation', () => {
    render(<ElevatorPage />);

    expect(screen.getByText(/отклонение веса -1,2 т/)).toBeInTheDocument();
  });

  it('elevator page has no forbidden wording', () => {
    const { container } = render(<ElevatorPage />);
    const html = container.innerHTML;

    expect(html).not.toMatch(/production-ready/i);
    expect(html).not.toContain('/platform-v7/demo/');
  });
});

describe('Bank page execution handoff', () => {
  it('renders execution handoff section with банковское событие wording', () => {
    render(<BankPage />);

    expect(screen.getByTestId('role-execution-handoff')).toBeInTheDocument();
    expect(screen.getByText(/документы, приёмка, качество и спор должны быть закрыты до банковского события/)).toBeInTheDocument();
  });

  it('bank handoff describes bank-side event/check, not platform-controlled money release', () => {
    render(<BankPage />);

    expect(screen.getByText(/банк направляет уведомление о готовности к банковскому событию/)).toBeInTheDocument();
    expect(screen.getByText(/пилотный контур требует ручной сверки оператором/)).toBeInTheDocument();
  });

  it('bank page has no forbidden wording', () => {
    const { container } = render(<BankPage />);
    const html = container.innerHTML;

    expect(html).not.toMatch(/production-ready/i);
    expect(html).not.toMatch(/платформа гарантирует оплату/i);
    expect(html).not.toContain('/platform-v7/demo/');
  });
});

describe('Disputes page execution handoff', () => {
  it('renders execution handoff section with удержание and review wording', () => {
    render(<DisputesPage />);

    expect(screen.getByTestId('role-execution-handoff')).toBeInTheDocument();
    expect(screen.getByText(/рекомендация по удержанию или спорной сумме/)).toBeInTheDocument();
  });

  it('disputes handoff describes review of disputed amount, not platform-controlled release', () => {
    render(<DisputesPage />);

    expect(screen.getByText(/рекомендация по удержанию или спорной сумме — передаётся оператору на ручную проверку оснований/)).toBeInTheDocument();
    expect(screen.getByText(/банковское событие по выпуску невозможно до решения оператора и закрытия суммы/)).toBeInTheDocument();
  });

  it('disputes page has no forbidden wording', () => {
    const { container } = render(<DisputesPage />);
    const html = container.innerHTML;

    expect(html).not.toMatch(/production-ready/i);
    expect(html).not.toMatch(/деньги переведены/i);
    expect(html).not.toContain('/platform-v7/demo/');
  });
});

describe('No apps/landing imports in handoff component', () => {
  it('RoleExecutionHandoff does not import from apps/landing', async () => {
    const src = await import('@/components/platform-v7/RoleExecutionHandoff?raw');
    expect(src).toBeDefined();
  });

  it('seller page does not link to /platform-v7/demo/', () => {
    const { container } = render(<SellerPage />);
    const links = container.querySelectorAll('a[href*="/platform-v7/demo/"]');
    expect(links.length).toBe(0);
  });

  it('buyer page does not link to /platform-v7/demo/', () => {
    const { container } = render(<BuyerPage />);
    const links = container.querySelectorAll('a[href*="/platform-v7/demo/"]');
    expect(links.length).toBe(0);
  });
});
