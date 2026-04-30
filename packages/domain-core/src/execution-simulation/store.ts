import { createExecutionSimulationState } from './fixtures';
import { runPlatformAction } from './action-engine';
import type { DomainExecutionState, PlatformActionCommand, PlatformActionResult } from './types';

export interface ExecutionDomainStore {
  getState(): DomainExecutionState;
  setState(nextState: DomainExecutionState): DomainExecutionState;
  dispatch(command: PlatformActionCommand): PlatformActionResult;
  subscribe(listener: (state: DomainExecutionState) => void): () => void;
  serialize(): string;
  hydrate(serializedState: string): DomainExecutionState;
}

function cloneState(state: DomainExecutionState): DomainExecutionState {
  return JSON.parse(JSON.stringify(state)) as DomainExecutionState;
}

export function createExecutionDomainStore(initialState: DomainExecutionState = createExecutionSimulationState()): ExecutionDomainStore {
  let state = cloneState(initialState);
  const listeners = new Set<(state: DomainExecutionState) => void>();

  function notify() {
    const snapshot = cloneState(state);
    listeners.forEach((listener) => listener(snapshot));
  }

  return {
    getState() {
      return cloneState(state);
    },

    setState(nextState: DomainExecutionState) {
      state = cloneState(nextState);
      notify();
      return cloneState(state);
    },

    dispatch(command: PlatformActionCommand) {
      const result = runPlatformAction(state, command);
      state = cloneState(result.state);
      notify();
      return { ...result, state: cloneState(result.state) };
    },

    subscribe(listener: (state: DomainExecutionState) => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    serialize() {
      return JSON.stringify(state);
    },

    hydrate(serializedState: string) {
      state = JSON.parse(serializedState) as DomainExecutionState;
      notify();
      return cloneState(state);
    }
  };
}
