import {
  isUngroundedCropProtectionPrescription,
  platformGroundingVerdict,
  stripUngroundedCropProtectionPrescriptions,
} from './restricted-public-qwen.safety';

describe('restricted public crop-protection prescription boundary', () => {
  it('removes screenshot-shaped active-ingredient prescriptions but keeps stable prevention advice', () => {
    const flags: string[] = [];
    const answer = [
      'Применяйте препараты на основе манкозеба или металаксила.',
      'Проводите санитарную уборку поражённых листьев и следите за длительностью увлажнения кроны.',
    ].join(' ');

    const safe = stripUngroundedCropProtectionPrescriptions(answer, flags);

    expect(safe).not.toContain('манкозеба');
    expect(safe).not.toContain('металаксила');
    expect(safe).toContain('санитарную уборку');
    expect(flags).toContain('UNGROUNDED_CROP_PROTECTION_PRESCRIPTION_REMOVED');
  });

  it('removes product-or-brand dose prescriptions without governed registration inputs', () => {
    for (const text of [
      'Фунгицид «Альто Супер» — 0,4 л/га.',
      'Применяйте Амистар Трио 1 л/га.',
      'Для обработки используйте препарат X 250 мл/га.',
      'Фунгицид X: повтор через 10 дней.',
    ]) {
      expect(isUngroundedCropProtectionPrescription(text)).toBe(true);
    }
  });

  it('does not remove a non-prescriptive registration boundary', () => {
    const text = 'Если химическая защита нужна, выбирайте только зарегистрированный для культуры и региона препарат и действуйте строго по этикетке.';
    expect(isUngroundedCropProtectionPrescription(text)).toBe(false);
    expect(stripUngroundedCropProtectionPrescriptions(text)).toBe(text);
  });
});

describe('restricted public platform authority boundary', () => {
  const authority = 'платформа фиксирует расхождение и доказательства; важное решение принимает уполномоченный участник';

  it('drops autonomous critical-decision or money claims even when other wording overlaps grounding', () => {
    for (const claim of [
      'Платформа автоматически примет решение по спору.',
      'Платформа сама решит спор.',
      'Платформа автоматически спишет деньги.',
    ]) {
      const verdict = platformGroundingVerdict(claim, authority);
      expect(verdict.keep).toBe(false);
      expect(verdict.flags).toContain('UNSUPPORTED_PLATFORM_AUTONOMOUS_DECISION_REMOVED');
    }
  });

  it('keeps an explicit denial of autonomous authority', () => {
    const verdict = platformGroundingVerdict(
      'Платформа не принимает автономных решений; важное решение принимает уполномоченный участник.',
      authority,
    );
    expect(verdict.keep).toBe(true);
    expect(verdict.flags).not.toContain('UNSUPPORTED_PLATFORM_AUTONOMOUS_DECISION_REMOVED');
  });
});
