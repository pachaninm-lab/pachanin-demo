import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { P7GuardedActionButton } from '@/components/platform-v7/P7GuardedActionButton';
import { platformV7ActionTargetById } from '@/lib/platform-v7/action-targets';

describe('P7GuardedActionButton', () => {
  it('renders a ready action from the action target label', () => {
    const target = platformV7ActionTargetById('deal-release-funds');
    expect(target).not.toBeNull();

    render(<P7GuardedActionButton target={target!} activeActionId={null} />);

    const button = screen.getByRole('button', { name: 'Выпустить деньги' });
    expect(button).toBeEnabled();
    expect(button).toHaveAttribute('data-guard-state', 'ready');
  });

  it('renders loading state from active action id', () => {
    const target = platformV7ActionTargetById('deal-release-funds');

    render(
      <P7GuardedActionButton
        target={target!}
        activeActionId='releaseFunds'
        loadingLabel='Выполняется…'
      />,
    );

    const button = screen.getByRole('button', { name: 'Выполняется…' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(button).toHaveAttribute('data-guard-state', 'busy');
  });

  it('renders guarded state with reason affordance', () => {
    const target = platformV7ActionTargetById('deal-release-funds');

    render(
      <P7GuardedActionButton
        target={target!}
        activeActionId={null}
        blocked
        blockerLabels={['FGISGate', 'EvidenceGate']}
        blockedReason='Не все gates закрыты.'
        blockedLabel='Выпуск заблокирован'
      />,
    );

    const button = screen.getByRole('button', { name: 'Выпуск заблокирован' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('title', 'Не все gates закрыты.');
    expect(button).toHaveAttribute('data-guard-state', 'blocked');
  });
});
