import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ConditionReasonStrip } from '@/components/platform-v7/ConditionReasonStrip';
import SellerPage from '@/app/platform-v7/seller/page';
import BuyerPage from '@/app/platform-v7/buyer/page';
import BankPage from '@/app/platform-v7/bank/page';

function expectNoUnsafeCopy(html: string) {
  expect(html).not.toMatch(/production-ready/i);
  expect(html).not.toMatch(/fully live/i);
  expect(html).not.toMatch(/fully integrated/i);
  expect(html).not.toMatch(/live callback/i);
  expect(html).not.toMatch(/платформа гарантирует оплату/i);
  expect(html).not.toMatch(/платформа выпускает деньги/i);
  expect(html).not.toMatch(/деньги переведены/i);
  expect(html).not.toMatch(/выплата выполнена/i);
  expect(html).not.toMatch(/деньги отправлены/i);
  expect(html).not.toContain('/platform-v7/demo/');
}

describe('ConditionReasonStrip', () => {
  it('renders strip container', () => {
    render(
      <ConditionReasonStrip
        condition='пилотный сценарий'
        responsible='банк'
        documentState='документы в работе'
      />,
    );
    expect(screen.getByTestId('condition-reason-strip')).toBeInTheDocument();
  });

  it('renders condition slot', () => {
    render(
      <ConditionReasonStrip
        condition='пилотный контур'
        responsible='банк'
        documentState='СДИЗ не закрыт'
      />,
    );
    expect(screen.getByTestId('condition-reason-condition')).toHaveTextContent('пилотный контур');
  });

  it('renders responsible slot', () => {
    render(
      <ConditionReasonStrip
        condition='пилотный сценарий'
        responsible='оператор'
        documentState='СДИЗ не закрыт'
      />,
    );
    expect(screen.getByTestId('condition-reason-responsible')).toHaveTextContent('оператор');
  });

  it('renders documentState slot', () => {
    render(
      <ConditionReasonStrip
        condition='пилотный сценарий'
        responsible='банк'
        documentState='ЭТрН не закрыт'
      />,
    );
    expect(screen.getByTestId('condition-reason-document')).toHaveTextContent('ЭТрН не закрыт');
  });

  it('renders stopReason when provided', () => {
    render(
      <ConditionReasonStrip
        condition='пилотный сценарий'
        responsible='банк'
        documentState='СДИЗ не закрыт'
        stopReason='выплата остановлена'
      />,
    );
    expect(screen.getByTestId('condition-reason-stop')).toHaveTextContent('выплата остановлена');
  });

  it('does not render stopReason when absent', () => {
    render(
      <ConditionReasonStrip
        condition='пилотный сценарий'
        responsible='банк'
        documentState='документы в работе'
      />,
    );
    expect(screen.queryByTestId('condition-reason-stop')).toBeNull();
  });

  it('uses controlled-pilot wording labels', () => {
    const { container } = render(
      <ConditionReasonStrip
        condition='пилотный сценарий'
        responsible='оператор'
        documentState='СДИЗ не закрыт'
        stopReason='причина остановки активна'
      />,
    );
    expect(container.innerHTML).toContain('ответственный');
    expect(container.innerHTML).toContain('причина остановки');
    expectNoUnsafeCopy(container.innerHTML);
  });
});

describe('ConditionReasonStrip page placement', () => {
  it('seller page renders condition reason strip with stop reason', () => {
    const { container } = render(<SellerPage />);
    expect(screen.getByTestId('condition-reason-strip')).toBeInTheDocument();
    expect(screen.getByTestId('condition-reason-condition')).toBeInTheDocument();
    expect(screen.getByTestId('condition-reason-responsible')).toBeInTheDocument();
    expect(screen.getByTestId('condition-reason-document')).toBeInTheDocument();
    expect(screen.getByTestId('condition-reason-stop')).toBeInTheDocument();
    expectNoUnsafeCopy(container.innerHTML);
  });

  it('buyer page renders condition reason strip without stop reason', () => {
    const { container } = render(<BuyerPage />);
    expect(screen.getByTestId('condition-reason-strip')).toBeInTheDocument();
    expect(screen.getByTestId('condition-reason-condition')).toBeInTheDocument();
    expect(screen.queryByTestId('condition-reason-stop')).toBeNull();
    expectNoUnsafeCopy(container.innerHTML);
  });

  it('bank page renders condition reason strip with stop reason', () => {
    const { container } = render(<BankPage />);
    expect(screen.getByTestId('condition-reason-strip')).toBeInTheDocument();
    expect(screen.getByTestId('condition-reason-stop')).toBeInTheDocument();
    expectNoUnsafeCopy(container.innerHTML);
  });
});
