import { readFileSync, writeFileSync } from 'node:fs';

const path = 'apps/api/test/regulatory/fgis-grain-commodity-authority.e2e-spec.ts';
let source = readFileSync(path, 'utf8');

const before = `    const accepted = settled
      .filter((entry): entry is PromiseFulfilledResult<Record<string, unknown>> => entry.status === 'fulfilled')
      .map((entry) => entry.value)
      .filter((receipt) => receipt.ok === true);
    expect(accepted.length).toBeGreaterThanOrEqual(1);
`;
const after = `    const accepted = settled.flatMap((entry, index) =>
      entry.status === 'fulfilled' && entry.value.ok === true
        ? [{ receipt: entry.value, input: requests[index]! }]
        : [],
    );
    expect(accepted.length).toBeGreaterThanOrEqual(1);
`;

if (!source.includes(after)) {
  if (!source.includes(before)) {
    throw new Error('FGIS_RESERVATION_RACE_ACCEPTED_BLOCK_NOT_FOUND');
  }
  source = source.replace(before, after);
}

const replayBefore = `    const firstAccepted = accepted[0];
    acceptedReservationId = String(firstAccepted.reservationId);
    acceptedReservationVersion = '1';
    const originalInput = requests.find(
      (candidate) => candidate.idempotencyKey === firstAccepted.idempotencyKey,
    ) ?? requests[0];
    const replay = await service.reserveVolume(FARMER_A, originalInput);
`;
const replayAfter = `    const first = accepted[0];
    if (!first) throw new Error('FGIS_RESERVATION_RACE_ACCEPTED_RESULT_MISSING');
    const firstAccepted = first.receipt;
    const originalInput = first.input;
    acceptedReservationId = String(firstAccepted.reservationId);
    acceptedReservationVersion = '1';
    const replay = await service.reserveVolume(FARMER_A, originalInput);
`;

if (!source.includes(replayAfter)) {
  if (!source.includes(replayBefore)) {
    throw new Error('FGIS_RESERVATION_RACE_REPLAY_BLOCK_NOT_FOUND');
  }
  source = source.replace(replayBefore, replayAfter);
}

writeFileSync(path, source);
