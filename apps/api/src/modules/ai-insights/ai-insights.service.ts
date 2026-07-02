/**
 * AI Insights Service — role-scoped deal analysis and recommendations.
 * Uses Claude API when ANTHROPIC_API_KEY is set, otherwise heuristic fallback.
 * Per ТЗ §37: non-binding advice, human-reviewed, pre-integration.
 */

import { Injectable, Logger } from '@nestjs/common';
import { RequestUser } from '../../common/types/request-user';

const INSIGHTS_TIMEOUT_MS = 10_000;

export interface InsightRequest {
  scope: 'hint' | 'summary' | 'next_action' | 'blocker_explanation' | 'triage';
  role: string;
  dealId?: string;
  context: Record<string, unknown>;
}

export interface InsightResponse {
  result: string;
  confidence: number;
  scope: string;
  role: string;
  maturity: 'pre-integration' | 'live';
  limitations: string[];
  generatedAt: string;
}

const LIMITATIONS = [
  'Предварительный совет — требует проверки человеком',
  'Не может переопределить банковские события, документы или решения по качеству',
  'Не принимает обязывающих решений и не инициирует внешние действия',
] as const;

const HEURISTIC_HINTS: Record<string, Record<string, string>> = {
  FARMER: {
    hint: 'Проверьте статус KYC и наличие активных лотов. Заполните качественные показатели перед подачей в торги.',
    next_action: 'Убедитесь, что документы к сделке подписаны УКЭП. Следующее безопасное действие — подтвердить отгрузку.',
    summary: 'Продавец: активные лоты и статус сделок в норме. Ожидает подтверждения оплаты.',
  },
  BUYER: {
    hint: 'Проверьте резервирование оплаты и статус документов. Убедитесь в соответствии показателей качества требованиям.',
    next_action: 'После получения акта приёмки подпишите документы УКЭП для завершения расчётов.',
    summary: 'Покупатель: оплата зарезервирована, ожидает результатов лабораторного анализа.',
  },
  BANK: {
    hint: 'Проверьте соответствие суммы резерва и условий оплаты. Убедитесь в отсутствии активных споров.',
    next_action: 'Подтвердите выход из эскроу после получения всех подписанных документов и результатов QC.',
    triage: 'Приоритет: сделки с просроченным резервом > активные споры > ожидающие подписания.',
  },
  DRIVER: {
    hint: 'Проверьте маршрут и геозоны. Убедитесь в наличии ТТН и CMR перед выездом.',
    next_action: 'Обновите GPS позицию при прибытии на элеватор. Зафиксируйте время прибытия.',
    summary: 'Водитель: маршрут активен, документы в порядке.',
  },
  LAB: {
    hint: 'Внесите результаты анализа по всем показателям ГОСТ. Укажите номер аттестата лаборатории.',
    next_action: 'После ввода результатов подпишите протокол УКЭП. Заключение блокирует оплату до подписания.',
    summary: 'Лаборатория: анализ завершён, ожидает подписания протокола.',
  },
  ELEVATOR: {
    hint: 'Проверьте весовые данные и расхождения с заявленным объёмом. Зафиксируйте акт приёмки.',
    next_action: 'Подтвердите вес и качество. Подпишите акт приёмки для разблокировки следующего этапа.',
    summary: 'Элеватор: взвешивание выполнено, акт приёмки ожидает подписания.',
  },
  ARBITRATOR: {
    triage: 'Приоритет: споры с заморозкой платежа > доказательная база неполная > новые жалобы.',
    hint: 'Изучите пакет доказательств полностью. Проверьте цепочку хешей аудита.',
    summary: 'Арбитр: 2 активных спора, 1 требует решения в течение 24 часов.',
  },
  COMPLIANCE_OFFICER: {
    triage: 'Приоритет: AML-алерты > санкционные хиты > высокий fraud-score > KYC-пробелы.',
    hint: 'Проверьте AML-статус участников и наличие санкционных совпадений перед одобрением.',
    summary: 'Compliance: 3 организации ожидают KYC-одобрения.',
  },
  EXECUTIVE: {
    summary: 'Платформа: GMV за 30 дней в норме. Dispute rate 4.2%. Ожидает 5 сделок в стадии QC.',
    hint: 'Обратите внимание на сделки без движения более 48 часов — возможные блокеры.',
  },
};

@Injectable()
export class AiInsightsService {
  private readonly logger = new Logger(AiInsightsService.name);
  private readonly apiKey = process.env.ANTHROPIC_API_KEY;

  async getInsight(req: InsightRequest, user: RequestUser): Promise<InsightResponse> {
    if (this.apiKey) {
      try {
        return await this.callClaude(req, user);
      } catch (err) {
        this.logger.warn(`Claude API call failed: ${err} — falling back to heuristics`);
      }
    }
    return this.heuristicInsight(req, user);
  }

  private async callClaude(req: InsightRequest, user: RequestUser): Promise<InsightResponse> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), INSIGHTS_TIMEOUT_MS);

    const systemPrompt = `Ты AI-советник для участника зерновой торговой платформы GrainFlow.
Роль пользователя: ${req.role}. Сделка: ${req.dealId ?? 'не указана'}.
Тип запроса: ${req.scope}.
Правила: давай краткие (1-3 предложения), не-обязывающие советы.
Не принимай решений за людей. Всегда добавляй: «Требует проверки человеком».
Отвечай на русском языке.`;

    const userMessage = `Контекст: ${JSON.stringify(req.context, null, 2)}\n\nДай совет типа "${req.scope}" для роли "${req.role}".`;

    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 256,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!resp.ok) {
      throw new Error(`Claude API returned ${resp.status}`);
    }

    const data = await resp.json() as { content: Array<{ text: string }> };
    const text = data.content?.[0]?.text ?? '';

    return {
      result: text,
      confidence: 0.75,
      scope: req.scope,
      role: req.role,
      maturity: 'pre-integration',
      limitations: [...LIMITATIONS],
      generatedAt: new Date().toISOString(),
    };
  }

  private heuristicInsight(req: InsightRequest, user: RequestUser): InsightResponse {
    const roleHints = HEURISTIC_HINTS[req.role] ?? HEURISTIC_HINTS['FARMER'];
    const result = roleHints[req.scope] ?? roleHints['hint'] ?? 'Проверьте текущий статус сделки и ближайшие действия.';

    return {
      result,
      confidence: 0.42,
      scope: req.scope,
      role: req.role,
      maturity: 'pre-integration',
      limitations: [...LIMITATIONS],
      generatedAt: new Date().toISOString(),
    };
  }
}
