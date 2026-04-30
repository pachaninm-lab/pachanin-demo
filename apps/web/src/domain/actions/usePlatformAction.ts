'use client';

import { useCallback } from 'react';
import { usePlatformDomainStore } from '../store/platformDomainStore';
import type { PlatformActionId } from './actionEngine';

export function usePlatformAction(dealId: string, actorUserId = 'u-operator') {
  const runDealAction = usePlatformDomainStore(state => state.runDealAction);
  const lastAction = usePlatformDomainStore(state => state.lastAction);

  const execute = useCallback(
    (actionId: PlatformActionId, idempotencyKey?: string) => runDealAction(dealId, actionId, actorUserId, idempotencyKey),
    [actorUserId, dealId, runDealAction]
  );

  return { execute, lastAction };
}
