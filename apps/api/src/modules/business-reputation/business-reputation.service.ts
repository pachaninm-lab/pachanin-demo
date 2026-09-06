import { BadRequestException, ForbiddenException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { RequestUser } from '../../common/types/request-user';
import { REPUTATION_BATCH_MAX } from './dto/reputation-batch.dto';

export interface ReputationScore {
  orgId: string;
  score: number;
  tier: 'AAA' | 'AA' | 'A' | 'B' | 'C' | 'D' | 'UNRATED';
  components: {
    dealHistory: number;
    disputeRate: number;
    paymentPunctuality: number;
    kycStatus: number;
    amlStatus: number;
    age: number;
  };
  dealsCompleted: number;
  dealsTotal: number;
  disputeCount: number;
  averageDealRub: number;
  lastUpdated: string;
  recommendation: string;
}

/**
 * Форма строки сделки, которая нужна для оценки.
 *
 * `id` объявлен и выбирается явно. Раньше `select` просил только `status` и
 * `totalRub`, а код ниже читал `d.id` через `as any`. Замерено настоящим
 * Prisma на живой базе, а не выведено из чтения: при таком `select` строка
 * приходит как `{"status":"ACTIVE","totalRub":null}`, `d.id` равен `undefined`,
 * и `d.id ?? ''` даёт пустую строку. То есть весь компонент споров считался по
 * фильтру `dealId IN ('')` и был тождественно нулевым. Приведение `as any`
 * прятало это от компилятора.
 */
type ReputationDealRow = { id: string; status: string; totalRub: number | null };

@Injectable()
export class BusinessReputationService {
  private readonly scoreCache = new Map<string, { score: ReputationScore; expiresAt: number }>();
  private static readonly CACHE_TTL_MS = 15 * 60 * 1000;

  constructor(@Optional() private readonly prisma?: PrismaService) {}

  /**
   * Тенант вызывающего обязателен.
   *
   * Контроллер получал `@CurrentUser()` и отбрасывал его как `_user`, поэтому
   * `orgId` из пути никак не соотносился с тем, кто спрашивает. Репутация —
   * это оценка контрагента: число сделок, оборот, споры, статусы KYC и AML
   * названного юридического лица.
   */
  private assertTenantScope(user: RequestUser): string {
    const tenantId = user.tenantId;
    if (typeof tenantId !== 'string' || tenantId.length === 0) {
      throw new ForbiddenException('Reputation tenant scope unavailable');
    }
    return tenantId;
  }

  /**
   * Ключ кэша включает тенант.
   *
   * Кэш жил на одном `orgId` и на пятнадцать минут. Оставить его таким после
   * добавления предиката означало бы отдать посчитанную для одного тенанта
   * оценку другому и снова открыть ту же границу — уже за спиной у правки.
   * Разделитель — NUL: он не встречается в идентификаторах, поэтому пара
   * («a», «b\u0000c») и («a\u0000b», «c») не могут схлопнуться в один ключ.
   */
  private static cacheKey(tenantId: string, orgId: string): string {
    return `${tenantId}\u0000${orgId}`;
  }

  async getScore(orgId: string, user: RequestUser): Promise<ReputationScore> {
    const tenantId = this.assertTenantScope(user);
    const key = BusinessReputationService.cacheKey(tenantId, orgId);
    const cached = this.scoreCache.get(key);
    if (cached && cached.expiresAt > Date.now()) return cached.score;

    const score = await this.computeScore(orgId, tenantId);
    this.scoreCache.set(key, { score, expiresAt: Date.now() + BusinessReputationService.CACHE_TTL_MS });
    return score;
  }

  /**
   * Пакетный запрос остаётся в пределах тенанта вызывающего.
   *
   * Организация вне тенанта не попадает в ответ. Отказывать всему пакету
   * из-за одного постороннего идентификатора нельзя — это само по себе
   * сообщало бы, что такая организация где-то существует; а оценивать её
   * нельзя тем более. Пропуск ключа неотличим от несуществующей организации.
   */
  async getScoreBatch(orgIds: string[], user: RequestUser): Promise<Record<string, ReputationScore>> {
    const tenantId = this.assertTenantScope(user);
    if (!Array.isArray(orgIds)) {
      throw new BadRequestException('orgIds должен быть массивом идентификаторов.');
    }
    if (orgIds.length > REPUTATION_BATCH_MAX) {
      // Замерено: 20 000 идентификаторов давали 40 000 одновременных обращений
      // к базе из ОДНОГО запроса. Граница стоит и здесь, а не только в DTO.
      throw new BadRequestException(`Пакет оценок ограничен ${REPUTATION_BATCH_MAX} организациями.`);
    }
    // Накопитель — Map, а не объектный литерал: ключ приходит из запроса, и
    // `results['__proto__'] = score` не создаёт собственного свойства, а
    // ПОДМЕНЯЕТ прототип ответа — замерено. Object.fromEntries на выходе
    // создаёт собственное свойство даже для '__proto__', поэтому форма ответа
    // не меняется, а запись перестаёт теряться.
    const results = new Map<string, ReputationScore>();
    await Promise.all(
      orgIds.map(async (id) => {
        if (typeof id !== 'string') {
          throw new BadRequestException('Каждый элемент orgIds должен быть строкой.');
        }
        try {
          results.set(id, await this.getScore(id, user));
        } catch (error) {
          // Только «нет такой организации в этом тенанте» превращается в
          // пропуск. Отказ базы обязан дойти до вызывающего, иначе пакет
          // молча выродится в пустой ответ, неотличимый от «никого нет».
          if (!(error instanceof NotFoundException)) throw error;
        }
      }),
    );
    return Object.fromEntries(results);
  }

  invalidate(orgId: string, tenantId: string): void {
    this.scoreCache.delete(BusinessReputationService.cacheKey(tenantId, orgId));
  }

  private async computeScore(orgId: string, tenantId: string): Promise<ReputationScore> {
    let dealsTotal = 0;
    let dealsCompleted = 0;
    let disputeCount = 0;
    let totalRub = 0;
    let kycOk = false;
    let amlClear = false;
    let orgAgeMonths = 0;

    if (this.prisma) {
      // Предиката тенанта не было ни у одного из трёх чтений. Любой
      // аутентифицированный пользователь получал по названному
      // `organizationId` число сделок, оборот, споры и статусы KYC/AML
      // организации другого тенанта — а пакетный маршрут принимал произвольный
      // массив идентификаторов и потому работал как средство перебора.
      const [sellerDeals, buyerDeals, org] = await Promise.all([
        this.prisma.deal.findMany({
          where: { sellerOrgId: orgId, tenantId },
          select: { id: true, status: true, totalRub: true },
        }),
        this.prisma.deal.findMany({
          where: { buyerOrgId: orgId, tenantId },
          select: { id: true, status: true, totalRub: true },
        }),
        // findFirst по паре id+тенант, а не findUnique по одному id: чужая
        // организация обязана быть неотличима от несуществующей.
        this.prisma.organization.findFirst({
          where: { id: orgId, tenantId },
          select: { kycStatus: true, amlStatus: true, createdAt: true },
        }),
      ]);

      // Организации нет в тенанте вызывающего — это отказ, а не оценка по
      // нулям. Прежний путь молча возвращал балл около 30 с формулировкой
      // «повышенный риск» о юридическом лице, которого он не читал: тот же
      // выдуманный финансовый вывод, что был закрыт в факторинге (#4984).
      if (!org) throw new NotFoundException(`Organization ${orgId} not found`);

      const allDeals: ReputationDealRow[] = [...sellerDeals, ...buyerDeals];
      // Споры считаются ровно по выбранным сделкам. Обёртка OR с единственным
      // условием ничего не добавляла и убрана.
      disputeCount = await this.prisma.dispute.count({
        where: { dealId: { in: allDeals.map((deal) => deal.id) } },
      });

      dealsTotal = allDeals.length;
      dealsCompleted = allDeals.filter((d) => d.status === 'CLOSED' || d.status === 'SETTLED').length;
      totalRub = allDeals.reduce((sum: number, d) => sum + (d.totalRub ?? 0), 0);
      kycOk = org.kycStatus === 'VERIFIED';
      amlClear = org.amlStatus === 'CLEAR';
      orgAgeMonths = Math.floor((Date.now() - new Date(org.createdAt).getTime()) / (30 * 86_400_000));
    } else {
      dealsTotal = 12;
      dealsCompleted = 10;
      disputeCount = 1;
      totalRub = 5_000_000;
      kycOk = true;
      amlClear = true;
      orgAgeMonths = 24;
    }

    const disputeRate = dealsTotal > 0 ? disputeCount / dealsTotal : 0;
    const successRate = dealsTotal > 0 ? dealsCompleted / dealsTotal : 0;

    const dealHistoryScore = Math.min(100, dealsCompleted * 5 + (dealsTotal > 5 ? 20 : 0));
    const disputeScore = Math.max(0, 100 - disputeRate * 300);
    const paymentScore = successRate * 100;
    const kycScore = kycOk ? 100 : 30;
    const amlScore = amlClear ? 100 : 0;
    const ageScore = Math.min(100, orgAgeMonths * 4);

    const totalScore = Math.round(
      dealHistoryScore * 0.25 +
      disputeScore * 0.25 +
      paymentScore * 0.20 +
      kycScore * 0.15 +
      amlScore * 0.10 +
      ageScore * 0.05,
    );

    const tier = this.scoreTier(totalScore);

    return {
      orgId,
      score: totalScore,
      tier,
      components: {
        dealHistory: Math.round(dealHistoryScore),
        disputeRate: Math.round(disputeScore),
        paymentPunctuality: Math.round(paymentScore),
        kycStatus: kycScore,
        amlStatus: amlScore,
        age: Math.round(ageScore),
      },
      dealsCompleted,
      dealsTotal,
      disputeCount,
      averageDealRub: dealsTotal > 0 ? Math.round(totalRub / dealsTotal) : 0,
      lastUpdated: new Date().toISOString(),
      recommendation: this.scoreRecommendation(tier),
    };
  }

  private scoreTier(score: number): ReputationScore['tier'] {
    if (score >= 90) return 'AAA';
    if (score >= 80) return 'AA';
    if (score >= 70) return 'A';
    if (score >= 55) return 'B';
    if (score >= 35) return 'C';
    if (score > 0) return 'D';
    return 'UNRATED';
  }

  private scoreRecommendation(tier: ReputationScore['tier']): string {
    const map: Record<string, string> = {
      AAA: 'Надёжный контрагент. Рекомендуется без ограничений.',
      AA: 'Высокая надёжность. Сделки до 50 млн ₽ без дополнительных проверок.',
      A: 'Хорошая репутация. Стандартные условия сделки.',
      B: 'Приемлемая репутация. Рекомендуется усиленная проверка документов.',
      C: 'Повышенный риск. Требуется дополнительный KYC и поручительство.',
      D: 'Высокий риск. Сделки не рекомендуются без залога.',
      UNRATED: 'Нет данных для оценки. Пройдите верификацию.',
    };
    return map[tier] ?? '';
  }
}
