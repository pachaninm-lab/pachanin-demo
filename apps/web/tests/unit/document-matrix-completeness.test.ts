import { describe, expect, it } from 'vitest';
import {
  selectBlockingDealDocuments,
  selectDealDocumentMatrix,
} from '@/lib/platform-v7/deal-execution-source-of-truth';

const REQUIRED_DOCUMENT_TITLES = [
  'Договор',
  'СДИЗ оформлен',
  'УПД',
  'СДИЗ погашен покупателем',
  'ЭТрН',
  'ГИС ЭПД статус',
  'КЭП/МЧД',
  'Акт приёмки',
  'Акт расхождения',
  'Протокол качества',
  'ТР ТС 015/2011 / документ соответствия',
  'Отчёт сюрвейера',
  'Банковое основание',
  'Решение по спору',
  'Акт зачётного веса',
  'Согласие/основание ПДн',
  'Договор присоединения / правила платформы',
] as const;

describe('document-matrix-completeness', () => {
  it('contains every required controlled-pilot document for DL-9106', () => {
    const matrix = selectDealDocumentMatrix('DL-9106');

    expect(matrix.map((document) => document.title)).toEqual(REQUIRED_DOCUMENT_TITLES);
  });

  it('makes every document actionable with owner, signer, external contour, blocker and money impact', () => {
    const matrix = selectDealDocumentMatrix('DL-9106');

    for (const document of matrix) {
      expect(document.documentId).toBeTruthy();
      expect(document.status).toBeTruthy();
      expect(document.source).toBeTruthy();
      expect(document.responsibleRole).toBeTruthy();
      expect(document.signerRole).toBeTruthy();
      expect(document.signatureType).toBeTruthy();
      expect(document.externalSystem).toBeTruthy();
      expect(document.blocksStage).toBeTruthy();
      expect(document.moneyImpact).toBeTruthy();
      expect(document.nextAction).toBeTruthy();
    }
  });

  it('keeps money-blocking documents visible to the bank basis gate', () => {
    const blocking = selectBlockingDealDocuments('DL-9106');
    const blockingTitles = blocking.map((document) => document.title);

    expect(blockingTitles).toContain('СДИЗ оформлен');
    expect(blockingTitles).toContain('СДИЗ погашен покупателем');
    expect(blockingTitles).toContain('ЭТрН');
    expect(blockingTitles).toContain('ГИС ЭПД статус');
    expect(blockingTitles).toContain('Банковое основание');
  });
});
