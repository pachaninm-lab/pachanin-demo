import {
  DEAL_ACTIONS,
  buildDealSpine,
  getCurrentDealAction,
  isDealActionId,
} from './deal-command.policy';

describe('canonical deal command policy', () => {
  it('forms one contiguous deterministic happy-path sequence', () => {
    expect(DEAL_ACTIONS).toHaveLength(19);
    for (let index = 1; index < DEAL_ACTIONS.length; index += 1) {
      expect(DEAL_ACTIONS[index - 1].to).toBe(DEAL_ACTIONS[index].from);
    }
    expect(DEAL_ACTIONS[0].from).toBe('DRAFT');
    expect(DEAL_ACTIONS.at(-1)?.to).toBe('CLOSED');
  });

  it('accepts command identifiers but never accepts an arbitrary next state', () => {
    expect(isDealActionId('confirm_weight')).toBe(true);
    expect(isDealActionId('CLOSED')).toBe(false);
    expect(isDealActionId('anything_the_client_wants')).toBe(false);
  });

  it('projects the same spine with exactly one active action', () => {
    const active = getCurrentDealAction('IN_TRANSIT');
    expect(active?.id).toBe('confirm_arrival');

    const spine = buildDealSpine('IN_TRANSIT');
    expect(spine.filter((step) => step.state === 'active')).toEqual([
      expect.objectContaining({ id: 'confirm_arrival' }),
    ]);
    expect(spine.find((step) => step.id === 'start_transit')?.state).toBe('done');
    expect(spine.find((step) => step.id === 'confirm_weight')?.state).toBe('pending');
  });

  it('assigns the independent inspection to the first-class surveyor role', () => {
    const inspection = DEAL_ACTIONS.find((action) => action.id === 'confirm_inspection');
    expect(inspection?.roles).toContain('SURVEYOR');
  });

  it('marks the entire line complete only when the deal is closed', () => {
    expect(buildDealSpine('CLOSED').every((step) => step.state === 'done')).toBe(true);
  });
});
