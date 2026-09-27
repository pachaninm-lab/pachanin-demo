import {
  groundingAuthority,
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

  it('removes the exact live brand-and-dose prescription shapes', () => {
    const flags: string[] = [];
    const answer = [
      'Для фитофтороза используйте препарат «Кумулин-М» в дозе 2,5 л/га.',
      'Для ржавчины — «Ридомил-Голд» в дозе 2,5–3 л/га.',
      'Сначала уточните регион и фазу развития культуры.',
    ].join('\n');

    const safe = stripUngroundedCropProtectionPrescriptions(answer, flags);

    expect(safe).not.toContain('Кумулин-М');
    expect(safe).not.toContain('Ридомил-Голд');
    expect(safe).not.toMatch(/2,5(?:–3)?\s*л\/га/u);
    expect(safe).toContain('уточните регион');
    expect(flags).toContain('UNGROUNDED_CROP_PROTECTION_PRESCRIPTION_REMOVED');
  });

  it('blocks an autonomous platform decision claim unless authority explicitly contains it', () => {
    const grounding = {
      knowledgeVersion: 'test',
      topic: 'quality',
      title: 'Приёмка и качество',
      answer: 'Зафиксируйте расхождение и соберите документы для рассмотрения. Важное решение принимает участник.',
      facts: [],
      maturity: 'public',
      confidence: 'high' as const,
      sources: [],
    };
    const verdict = platformGroundingVerdict(
      'Платформа направит запрос на дополнительную проверку, а затем примет решение на основе фактических данных.',
      groundingAuthority(grounding),
    );
    expect(verdict.keep).toBe(false);
    expect(verdict.flags).toContain('UNSUPPORTED_AUTONOMOUS_DECISION_REMOVED');
  });

  it('does not remove a non-prescriptive registration boundary', () => {
    const text = 'Если химическая защита нужна, выбирайте только зарегистрированный для культуры и региона препарат и действуйте строго по этикетке.';
    expect(isUngroundedCropProtectionPrescription(text)).toBe(false);
    expect(stripUngroundedCropProtectionPrescriptions(text)).toBe(text);
  });
});
