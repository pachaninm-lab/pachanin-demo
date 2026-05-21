'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { OperatorRadar } from './OperatorRadar';
import type { RadarZone, RadarItem } from './OperatorRadar';
import type { DealStatusEdgeStatus } from './DealStatusEdge';

/**
 * OperatorRadarIsland — client wrapper for OperatorRadar.
 * Accepts serializable zone data from server component,
 * attaches router-based onAction callbacks.
 */

export interface RadarItemData {
  readonly id: string;
  readonly title: string;
  readonly detail?: string;
  readonly money?: string;
  readonly status: DealStatusEdgeStatus;
  readonly href?: string;
  readonly actionLabel?: string;
}

export interface RadarZoneData {
  readonly id: 'money' | 'documents' | 'trips' | 'disputes' | 'risks';
  readonly label: string;
  readonly items: RadarItemData[];
  readonly allClearMessage?: string;
}

export interface OperatorRadarIslandProps {
  readonly zones: RadarZoneData[];
  readonly mode?: 'operator' | 'executive';
}

export function OperatorRadarIsland({ zones, mode = 'operator' }: OperatorRadarIslandProps) {
  const router = useRouter();

  const radarZones: RadarZone[] = zones.map((zone) => ({
    ...zone,
    items: zone.items.map((item): RadarItem => ({
      ...item,
      onAction: item.href ? () => router.push(item.href!) : undefined,
    })),
  }));

  return <OperatorRadar zones={radarZones} mode={mode} />;
}
