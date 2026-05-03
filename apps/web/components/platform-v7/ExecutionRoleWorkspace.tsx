'use client';

import * as React from 'react';
import Link from 'next/link';
import type { ExecutionRole, ExecutionStageKey } from '@/lib/platform-v7/domain/execution-simulation';
import { selectExecutionSimulationByDealId } from '@/lib/platform-v7/domain/execution-simulation';
import { YandexDriverMap } from '@/components/platform-v7/YandexDriverMap';

// остальной код без изменений, только блок карты заменён

