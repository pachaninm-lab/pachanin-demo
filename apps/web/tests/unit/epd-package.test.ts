import { describe, expect, it } from 'vitest';
import {
  isTransportPackBlockingBankBasis,
  selectDealExecutionCase,
  selectDealTransportDocumentPack,
} from '@/lib/platform-v7/deal-execution-source-of-truth';

describe('epd-package', () => {
  it('keeps ETRN titles, signatures, EPD operator and GIS EPD status in one package', () => {
    const executionCase = selectDealExecutionCase('DL-9106');
    const pack = selectDealTransportDocumentPack('DL-9106');

    expect(pack).toBeDefined();
    expect(pack?.etrnId).toBe('ETRN-DL-9106-001');
    expect(pack?.epdOperator).toContain('требуется договор и доступ');
    expect(pack?.titles.map((title) => title.role)).toEqual(['грузоотправитель', 'перевозчик', 'водитель', 'грузополучатель']);
    expect(executionCase?.logistics.trips[0]?.tripId).toBe('TRIP-SIM-001');
  });

  it('shows exactly which signatures and GIS EPD transfer block the bank basis', () => {
    const pack = selectDealTransportDocumentPack('DL-9106');

    expect(pack?.shipperSignatureStatus).toBe('черновик');
    expect(pack?.carrierSignatureStatus).toBe('ожидает подписи');
    expect(pack?.driverSignatureStatus).toBe('ожидает рейса');
    expect(pack?.consigneeSignatureStatus).toBe('ожидает приёмки');
    expect(pack?.gisEpdTransferStatus).toBe('ожидает закрытия ЭТрН');
    expect(isTransportPackBlockingBankBasis(pack)).toBe(true);
  });
});
