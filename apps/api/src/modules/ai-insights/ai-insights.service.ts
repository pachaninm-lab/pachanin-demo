import { BadRequestException, Injectable } from '@nestjs/common';
import type { RequestUser } from '../../common/types/request-user';

export interface InsightRequest {
  scope: 'hint' | 'summary' | 'next_action' | 'blocker_explanation' | 'triage';
  /** Kept for compatibility only. Runtime role always comes from RequestUser. */
  role?: string;
  dealId?: string;
  context?: Record<string, unknown>;
}

export interface InsightResponse {
  result: string;
  confidence: number;
  scope: string;
  role: string;
  maturity: 'pre-integration' | 'live';
  limitations: string[];
  generatedAt: string;
  responseContract: 'legacy_insight_v1';
  canonicalAssistantRoute: '/ai-assistant/chat';
}

const LIMITATIONS = Object.freeze([
  'Предварительная подсказка — требует проверки человеком',
  'Не переопределяет банковские события, документы, результаты качества или решения по спору',
  'Не выполняет внешние действия и не меняет состояние сделки',
  'Для диалога, доказательств и структурированного следующего шага используется /ai-assistant/chat',
]);

const ROLE_GUIDANCE: Record<string, Record<InsightRequest['scope'], string>> = {
  FARMER: {
    hint: 'Проверьте доступные партии, документы и следующий шаг в ролевом реестре сделок.',
    summary: 'Сводка продавца формируется только из доступных серверу сделок; числовые показатели без подтверждённого источника не создаются.',
    next_action: 'Откройте сделку с наивысшим приоритетом и выполните серверно подтверждённое следующее действие.',
    blocker_explanation: 'Проверьте документные, логистические, качественные и денежные основания в рабочем пространстве сделки.',
    triage: 'Сначала обработайте просроченные действия, затем денежные блокеры и сделки без движения.',
  },
  BUYER: {
    hint: 'Проверьте условия, документную полноту, приёмку и банковское основание доступной сделки.',
    summary: 'Сводка покупателя строится только по подтверждённому ролевому контуру.',
    next_action: 'Выполните ближайшее действие, указанное серверной state machine сделки.',
    blocker_explanation: 'Расчёт может быть заблокирован документами, приёмкой, качеством, спором или отсутствием банковского события.',
    triage: 'Сначала сделки с денежным влиянием и сроком, затем остальные требующие действия.',
  },
  DRIVER: {
    hint: 'Проверьте назначенный рейс, документы, маршрут и доступные полевые действия.',
    summary: 'Водитель видит только назначенные ему рейсы и разрешённые факты исполнения.',
    next_action: 'Выполните ближайшее разрешённое полевое действие и приложите требуемое доказательство.',
    blocker_explanation: 'Проверьте назначение рейса, геособытие, документы и доступность связи.',
    triage: 'Сначала активный рейс и просроченные полевые действия.',
  },
  LAB: {
    hint: 'Проверьте назначенную пробу, обязательные показатели и статус протокола.',
    summary: 'Лабораторная сводка не заменяет подписанный протокол и содержит только разрешённые назначения.',
    next_action: 'Выполните действие, указанное для назначенной пробы или протокола.',
    blocker_explanation: 'Следующий этап может ожидать полный и подтверждённый лабораторный результат.',
    triage: 'Сначала пробы с ближайшим сроком и сделки, где качество блокирует исполнение.',
  },
  ELEVATOR: {
    hint: 'Проверьте прибытие, вес, приёмку, документы и расхождения по назначенной сделке.',
    summary: 'Сводка элеватора строится только по доступным операциям приёмки.',
    next_action: 'Подтвердите ближайший разрешённый факт приёмки через доменную команду.',
    blocker_explanation: 'Исполнение может ожидать прибытие, вес, акт, качество или документное основание.',
    triage: 'Сначала прибывшие рейсы и операции с истекающим сроком.',
  },
  BANK_CALLBACK: {
    hint: 'Банковское подтверждение принимается только через проверенный callback-контур.',
    summary: 'Модель не формирует и не подтверждает банковские события.',
    next_action: 'Используйте только проверенную банковскую операцию и доменную идемпотентную команду.',
    blocker_explanation: 'Проверьте подпись callback, идемпотентность, reconciliation и документное основание.',
    triage: 'Сначала неподтверждённые reconciliation-события и операции с конфликтом состояния.',
  },
  ARBITRATOR: {
    hint: 'Проверьте доступный evidence pack, сроки и полномочия до любого решения.',
    summary: 'Сводка спора не заменяет решение арбитра и не создаёт отсутствующие доказательства.',
    next_action: 'Выполните следующий разрешённый шаг спора после проверки доказательств.',
    blocker_explanation: 'Решение может ожидать полный evidence pack, позицию сторон или обязательное согласование.',
    triage: 'Сначала споры с денежной заморозкой и ближайшим SLA.',
  },
  COMPLIANCE_OFFICER: {
    hint: 'Используйте только подтверждённые compliance-источники и серверные полномочия.',
    summary: 'Помощник не раскрывает скрытые compliance-сигналы другим ролям.',
    next_action: 'Откройте назначенную проверку и выполните разрешённое действие с аудитом.',
    blocker_explanation: 'Доступ или сделка могут ожидать завершённую проверку и подтверждённое основание.',
    triage: 'Сначала критические и просроченные проверки, затем остальные назначения.',
  },
  EXECUTIVE: {
    hint: 'Запрашивайте показатели только из подтверждённой аналитической проекции.',
    summary: 'Помощник не выдумывает GMV, dispute rate или другие метрики при отсутствии источника.',
    next_action: 'Откройте приоритетную сделку или подтверждённый управленческий отчёт.',
    blocker_explanation: 'Для вывода нужны актуальные серверные данные, определения метрик и период анализа.',
    triage: 'Сначала денежные, сроковые и системные отклонения с подтверждённым влиянием.',
  },
};

const GENERIC_GUIDANCE: Record<InsightRequest['scope'], string> = {
  hint: 'Проверьте текущий статус, доступные факты и ближайшее действие в серверном контуре.',
  summary: 'Сводка формируется только из данных, разрешённых текущей роли.',
  next_action: 'Выполните ближайшее действие, подтверждённое серверной state machine.',
  blocker_explanation: 'Проверьте сроки, документы, физическое исполнение, деньги и открытые споры.',
  triage: 'Сначала просроченные и денежно значимые действия, затем остальные.',
};

@Injectable()
export class AiInsightsService {
  getInsight(req: InsightRequest, user: RequestUser): InsightResponse {
    if (!req || !['hint', 'summary', 'next_action', 'blocker_explanation', 'triage'].includes(req.scope)) {
      throw new BadRequestException({ code: 'INVALID_AI_INSIGHT_SCOPE' });
    }

    const role = user.role;
    const roleGuidance = ROLE_GUIDANCE[role] || GENERIC_GUIDANCE;
    return {
      result: roleGuidance[req.scope] || GENERIC_GUIDANCE[req.scope],
      confidence: 0.5,
      scope: req.scope,
      role,
      maturity: 'pre-integration',
      limitations: [...LIMITATIONS],
      generatedAt: new Date().toISOString(),
      responseContract: 'legacy_insight_v1',
      canonicalAssistantRoute: '/ai-assistant/chat',
    };
  }
}
