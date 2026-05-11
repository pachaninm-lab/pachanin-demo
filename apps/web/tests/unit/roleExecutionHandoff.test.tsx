import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RoleExecutionHandoff, type HandoffItem } from '@/components/platform-v7/RoleExecutionHandoff';
import SellerPage from '@/app/platform-v7/seller/page';
import BuyerPage from '@/app/platform-v7/buyer/page';
import LogisticsPage from '@/app/platform-v7/logistics/page';
import ElevatorPage from '@/app/platform-v7/elevator/page';
import BankPage from '@/app/platform-v7/bank/page';
import DisputesPage from '@/app/platform-v7/disputes/page';

const forbiddenCopy = [
  /production-ready/i,
  /fully live/i,
  /fully integrated/i,
  /live callback/i,
  /платформа гарантирует оплату/i,
  /платформа выпускает деньги/i,
  /деньги переведены/i,
  /выплата выполнена/i,
  /деньги отправлены/i,
  /ФГБУ ЦОК АПК/i,
  /СДИЗ не подтверждён/i,
  /выпуск денег/i,
  /банковское событие по выпуску/i,
];

function expectNoForbiddenCopy(html: string) {
  for (const pattern of forbiddenCopy) {
    expect(html).not.toMatch(pattern);
  }
  expect(html).not.toContain('/platform-v7/demo/');
}

function readSourceFile(...pathParts: string[]): string {
  const candidates = [
    join(process.cwd(), ...pathParts),
    join(process.cwd(), 'apps/web', ...pathParts),
  ];
  const sourcePath = candidates.find((candidate) => existsSync(candidate));
  if (!sourcePath) throw new Error(`Missing source file: ${pathParts.join('/')}`);
  return readFileSync(sourcePath, 'utf8');
}

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

  it('seller handoff contains SDIZ and bank confirmation wording', () => {
    render(<SellerPage />);

    expect(screen.getByText(/СДИЗ ожидает закрытия/)).toBeInTheDocument();
    expect(screen.getByText(/резерв ожидает банковского подтверждения/)).toBeInTheDocument();
  });

  it('seller page has no forbidden copy', () => {
    const { container } = render(<SellerPage />);
    expectNoForbiddenCopy(container.innerHTML);
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

  it('buyer page has no forbidden copy', () => {
    const { container } = render(<BuyerPage />);
    expectNoForbiddenCopy(container.innerHTML);
  });
});

describe('Logistics page execution handoff', () => {
  it('renders execution handoff section with ETRN wording', () => {
    render(<LogisticsPage />);

    expect(screen.getByTestId('role-execution-handoff')).toBeInTheDocument();
    expect(screen.getByText(/ЭТрН ожидает подписи грузополучателя/)).toBeInTheDocument();
  });

  it('logistics handoff frames document states as awaiting confirmation', () => {
    render(<LogisticsPage />);

    expect(screen.getByText(/передаёт данные о рейсе и водителе — ожидает подтверждения приёмки от элеватора/)).toBeInTheDocument();
    expect(screen.getByText(/СДИЗ ожидает закрытия/)).toBeInTheDocument();
  });

  it('logistics page has no forbidden copy', () => {
    const { container } = render(<LogisticsPage />);
    expectNoForbiddenCopy(container.innerHTML);
  });
});

describe('Elevator page execution handoff', () => {
  it('renders execution handoff section with acceptance act wording', () => {
    render(<ElevatorPage />);

    expect(screen.getByTestId('role-execution-handoff')).toBeInTheDocument();
    expect(screen.getByText(/акт приёмки и акт расхождения в контур документов/)).toBeInTheDocument();
  });

  it('elevator handoff has blockedBy item about weight deviation', () => {
    render(<ElevatorPage />);

    expect(screen.getByText(/отклонение веса -1,2 т/)).toBeInTheDocument();
  });

  it('elevator page has no forbidden copy', () => {
    const { container } = render(<ElevatorPage />);
    expectNoForbiddenCopy(container.innerHTML);
  });
});

describe('Bank page execution handoff', () => {
  it('renders execution handoff section with bank event wording', () => {
    render(<BankPage />);

    expect(screen.getByTestId('role-execution-handoff')).toBeInTheDocument();
    expect(screen.getByText(/документы, приёмка, качество и спор должны быть закрыты до банковского события/)).toBeInTheDocument();
  });

  it('bank handoff describes bank-side event/check, not platform-controlled money release', () => {
    render(<BankPage />);

    expect(screen.getByText(/банк направляет уведомление о готовности к банковскому событию/)).toBeInTheDocument();
    expect(screen.getByText(/пилотный контур требует ручной сверки оператором/)).toBeInTheDocument();
    expect(screen.getByText(/банковская проверка выплаты не продолжается/)).toBeInTheDocument();
  });

  it('bank page has no forbidden copy', () => {
    const { container } = render(<BankPage />);
    expectNoForbiddenCopy(container.innerHTML);
  });
});

describe('Disputes page execution handoff', () => {
  it('renders execution handoff section with retention and review wording', () => {
    render(<DisputesPage />);

    expect(screen.getByTestId('role-execution-handoff')).toBeInTheDocument();
    expect(screen.getByText(/рекомендация по удержанию или спорной сумме/)).toBeInTheDocument();
  });

  it('disputes handoff describes review of disputed amount, not platform-controlled release', () => {
    render(<DisputesPage />);

    expect(screen.getByText(/рекомендация по удержанию или спорной сумме — передаётся оператору на ручную проверку оснований/)).toBeInTheDocument();
    expect(screen.getByText(/спорная сумма остаётся на ручной проверке до решения оператора/)).toBeInTheDocument();
  });

  it('disputes page has no forbidden copy', () => {
    const { container } = render(<DisputesPage />);
    expectNoForbiddenCopy(container.innerHTML);
  });
});

describe('No apps/landing imports in handoff component', () => {
  it('RoleExecutionHandoff does not import from apps/landing', () => {
    const src = readSourceFile('components/platform-v7/RoleExecutionHandoff.tsx');
    expect(src).not.toContain('apps/landing');
    expect(src).not.toContain('@/app/landing');
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
