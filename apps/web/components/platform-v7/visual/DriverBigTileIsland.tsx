'use client';

import * as React from 'react';
import { DriverBigTileMode } from './DriverBigTileMode';

/**
 * DriverBigTileIsland — client wrapper for DriverBigTileMode.
 * Holds local state (arrivalConfirmed) and action stubs.
 * Static trip data: real data comes from FieldDriverRuntime below.
 */
export function DriverBigTileIsland() {
  const [arrivalConfirmed, setArrivalConfirmed] = React.useState(false);

  return (
    <DriverBigTileMode
      tripId='RT-7821'
      destination='Элеватор «Южный», г. Ростов-на-Дону'
      eta='14:30'
      pin='4821'
      offline={false}
      onPhotoUpload={() => {
        const el = document.getElementById('driver-photo-seal');
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }}
      onIncident={() => {
        const el = document.getElementById('driver-offline-events');
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }}
      onConfirmArrival={() => {
        setArrivalConfirmed(true);
        const el = document.getElementById('driver-next-action');
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }}
      arrivalConfirmed={arrivalConfirmed}
    />
  );
}
