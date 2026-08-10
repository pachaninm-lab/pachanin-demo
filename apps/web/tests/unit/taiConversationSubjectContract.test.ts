import { describe, expect, it } from 'vitest';
import {
  countOccurrences,
  matchedTerms,
  requireSubject,
  requireSubjectDominance,
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore -- plain ESM module shared with the hosted acceptance scripts.
} from '../../../../scripts/tai-conversation-subject-contract.mjs';

/**
 * The rules the live matrix uses to decide whether an answer is about the right
 * subject, exercised without a browser.
 *
 * These matter because the naive version of each is the tempting one and both
 * fail in production rather than in CI. "The superseded subject must not appear
 * at all" reads well and rejects a model that correctly says *"not wheat any
 * more — for potato, do X"*. What actually distinguishes a correction that took
 * from one that did not is which subject the answer is about.
 */

describe('term matching is form-tolerant but not loose', () => {
  it('matches regardless of case and surrounding text', () => {
    expect(matchedTerms('Подкормка КАРТОФЕЛЯ по фазам', ['картоф'])).toEqual(['картоф']);
    expect(matchedTerms('Winter WHEAT yield', ['wheat'])).toEqual(['wheat']);
    expect(matchedTerms('冬小麦产量下降', ['小麦'])).toEqual(['小麦']);
  });

  it('does not invent matches', () => {
    expect(matchedTerms('Подкормка картофеля', ['пшениц', 'коров'])).toEqual([]);
  });

  it('counts every occurrence, not just the first', () => {
    expect(countOccurrences('картофель, картофеля и снова картофель', ['картоф'])).toBe(3);
    expect(countOccurrences('ничего по теме', ['картоф'])).toBe(0);
  });

  it('counts overlapping terms independently', () => {
    // Both terms are legitimate signals for the same subject; each is counted.
    expect(countOccurrences('клубни картофеля', ['картоф', 'клубн'])).toBe(2);
  });
});

describe('a required subject must actually be present', () => {
  it('passes when enough terms appear', () => {
    expect(requireSubject({ id: 'ru', answer: 'Проверьте почву и посев пшеницы', expect: ['пшениц', 'почв'], minimum: 2 }))
      .toEqual(['пшениц', 'почв']);
  });

  it('fails when the answer resolved no subject at all', () => {
    expect(() => requireSubject({ id: 'ru', answer: 'Уточните вопрос.', expect: ['пшениц', 'почв'] }))
      .toThrow('ui_subject_missing:ru:пшениц,почв');
  });

  it('fails when fewer terms appear than required', () => {
    expect(() => requireSubject({ id: 'en', answer: 'Check the soil.', expect: ['wheat', 'soil'], minimum: 2 }))
      .toThrow('ui_subject_missing:en:wheat,soil');
  });
});

describe('the current subject must lead, not merely appear', () => {
  const correction = (answer: string) => requireSubjectDominance({
    id: 'correction',
    answer,
    current: ['картоф', 'клубн'],
    superseded: ['пшениц'],
  });

  it('accepts an answer that acknowledges the correction and then follows it', () => {
    // The naive "superseded must be absent" rule would reject this, and it is
    // exactly what a well-behaved model says.
    const verdict = correction(
      'Уже не пшеница: для картофеля подкормку планируют по фазам, клубни требуют калия, картофель отзывчив на фосфор.',
    );

    expect(verdict.supersededCount).toBe(1);
    expect(verdict.currentCount).toBeGreaterThan(verdict.supersededCount);
  });

  it('rejects an answer still built around the superseded subject', () => {
    expect(() => correction(
      'Для озимой пшеницы подкормка азотом весной, пшеница требует серы, пшеница отзывчива на фосфор. Картофель тоже бывает.',
    )).toThrow(/^ui_superseded_subject_dominant:correction:3:1$/u);
  });

  it('rejects an answer that ignored the correction entirely', () => {
    expect(() => correction('Для озимой пшеницы подкормку планируют по фазам.'))
      .toThrow('ui_current_subject_missing:correction:картоф,клубн');
  });

  it('rejects a tie — the corrected subject must win, not draw', () => {
    expect(() => correction('Картофель и пшеница требуют разного подхода.'))
      .toThrow('ui_superseded_subject_dominant:correction:1:1');
  });

  it('holds the same line for a topic shift', () => {
    const shift = (answer: string) => requireSubjectDominance({
      id: 'topic-shift',
      answer,
      current: ['трактор', 'охлажд', 'радиатор', 'двигател', 'нагруз'],
      superseded: ['удой', 'дойн', 'коров'],
      minimumCurrent: 2,
    });

    expect(shift('Перегрев трактора: проверьте радиатор, охлаждение и нагрузку на двигатель.').currentCount)
      .toBeGreaterThan(0);
    // A recommendation that drags the dairy subject along fails on dominance:
    // the new subject is present twice over, and the old one still outweighs it.
    expect(() => shift('У коров снизился удой, дойное стадо страдает; трактор перегревается, нужно охлаждение.'))
      .toThrow(/^ui_superseded_subject_dominant:topic-shift:3:2$/u);
    // Presence is checked first, so an answer that barely reached the new
    // subject fails on that rather than on the comparison.
    expect(() => shift('Трактор.')).toThrow('ui_current_subject_missing:topic-shift');
  });
});
