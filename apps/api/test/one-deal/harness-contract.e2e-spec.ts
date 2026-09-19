import {
  DEAL_ACTIONS,
  type DealActionDefinition,
} from '../../src/modules/deals/deal-command.policy';

function byId(id: string): DealActionDefinition {
  const action = DEAL_ACTIONS.find((item) => item.id === id);
  if (!action) throw new Error(`Missing canonical action ${id}`);
  return action;
}

describe('industrial one-deal harness contract', () => {
  it('covers one continuous 19-command path from DRAFT to CLOSED', () => {
    expect(DEAL_ACTIONS).toHaveLength(19);
    expect(DEAL_ACTIONS[0].from).toBe('DRAFT');
    expect(DEAL_ACTIONS.at(-1)?.to).toBe('CLOSED');

    for (let index = 1; index < DEAL_ACTIONS.length; index += 1) {
      expect(DEAL_ACTIONS[index - 1].to).toBe(DEAL_ACTIONS[index].from);
    }
  });

  it('requires system bank callbacks for reserve and release confirmation', () => {
    expect(byId('confirm_reserve')).toMatchObject({
      source: 'BANK_CALLBACK',
      from: 'RESERVE_REQUESTED',
      to: 'RESERVED',
    });
    expect(byId('confirm_release')).toMatchObject({
      source: 'BANK_CALLBACK',
      from: 'RELEASE_REQUESTED',
      to: 'RELEASED',
    });
  });
});
