import Link from 'next/link';
import { FirstCustomerWorkspace } from '@/components/platform-v7/FirstCustomerWorkspace';
import { firstCustomerWorkspaceRequired } from '@/lib/first-customer-workspace-server';
import { StatusChip } from '@pc/design-system-v8';
import {
  MoneyBoundary,
  MoneyCockpitSection,
  MoneyObligationCockpit,
  MoneyQueue,
  MoneyQueueLink,
  moneyCockpitClasses,
  type MoneyPriority,
} from '@/components/transaction-ux/MoneyObligationCockpit';
import { getDealsSnapshot } from '@/lib/deals-server';
import { getDisputesSnapshot, openDisputeCount } from '@/lib/disputes-server';
import { CollapsibleSection } from '@/components/platform-v7/CollapsibleSection';

type CanonicalDealSummary = Readonly<{
  id: string;
  label: string;
  status: string | null;
  culture: string | null;
  region: string | null;
}>;

const sellerPaths = [
  { title: 'Создать партию', href: '/platform-v7/seller/batches/new', note: 'открыть форму новой партии без предположений о текущей сделке' },
  { title: 'Партии и лоты', href: '/platform-v7/seller/lots', note: 'перейти к доступной рабочей поверхности продавца' },
  { title: 'Проверить запросы', href: '/platform-v7/seller/matches', note: 'открыть запросы и сопоставления без локального статуса сделки' },
] as const;

function canonicalText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized ? normalized : null;
}

function parseCanonicalDeal(value: unknown): CanonicalDealSummary | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const item = value as Record<string, unknown>;
  const id = canonicalText(item.id);
  if (!id) return null;

  return {
    id,
    label: canonicalText(item.dealNumber) ?? id,
    status: canonicalText(item.status),
    culture: canonicalText(item.culture),
    region: canonicalText(item.region),
  };
}

function dealDetail(deal: CanonicalDealSummary): string {
  return [
    deal.status ? `статус ${deal.status}` : 'статус UNKNOWN',
    deal.culture,
    deal.region,
  ].filter((value): value is string => Boolean(value)).join(' · ');
}

export default async function PlatformV7SellerPage() {
  if (firstCustomerWorkspaceRequired()) {
    return <FirstCustomerWorkspace surface='seller' />;
  }

  const [dealSnapshot, disputeSnapshot] = await Promise.all([
    getDealsSnapshot(),
    getDisputesSnapshot(),
  ]);

  const canonicalDeals = dealSnapshot.deals
    .map(parseCanonicalDeal)
    .filter((deal): deal is CanonicalDealSummary => deal !== null);
  const dealPayloadValid = canonicalDeals.length === dealSnapshot.deals.length;
  const dealRegistryAvailable = dealSnapshot.isApiAvailable && dealPayloadValid;
  const dealRegistryComplete = dealRegistryAvailable && dealSnapshot.isComplete;
  const disputeRegistryAvailable = disputeSnapshot.isApiAvailable;
  const disputeCount = disputeRegistryAvailable ? openDisputeCount(disputeSnapshot.disputes) : null;
  const dealCount = dealRegistryAvailable ? canonicalDeals.length : null;
  const dealCountLabel = dealCount === null
    ? 'UNKNOWN'
    : dealRegistryComplete
      ? String(dealCount)
      : `${dealCount}+`;

  const priority: MoneyPriority = !dealRegistryAvailable
    ? {
        eyebrow: 'Техническое восстановление данных',
        title: 'Проверить доступность серверного реестра сделок',
        description: 'Канонический список сделок сейчас не подтверждён. Это техническое восстановление данных, а не назначенное бизнес-действие. Кабинет не подставляет демонстрационные лоты, суммы, документы, регуляторные статусы или банковские результаты.',
        state: 'waiting',
        blocker: 'канонический список сделок недоступен или содержит неприемлемые данные',
        owner: 'серверный контур сделки',
        result: 'подтверждённый сервером список сделок',
        primaryAction: <Link className={moneyCockpitClasses.primaryLink} href='/platform-v7/seller'>Обновить данные</Link>,
        secondaryAction: <Link className={moneyCockpitClasses.secondaryLink} href='/platform-v7/seller/lots'>Партии и лоты</Link>,
      }
    : {
        eyebrow: 'Серверный приоритет действия',
        title: 'Приоритет бизнес-действия не опубликован',
        description: dealCount === 0
          ? 'Серверный реестр доступен и пуст, но отдельный приоритет следующего действия сервер не опубликовал. Кабинет не назначает создание партии как обязательный следующий шаг без серверной state/policy/permission authority.'
          : 'Сервер подтвердил список сделок, но не опубликовал приоритет следующего действия. Порядок записей в ответе не превращается в бизнес-приоритет; сделки ниже остаются обычной навигацией.',
        state: 'waiting',
        primaryAction: (
          <a className={moneyCockpitClasses.primaryLink} href={dealCount === 0 ? '#routes' : '#overview'}>
            {dealCount === 0 ? 'Рабочие маршруты' : 'Список сделок'}
          </a>
        ),
        secondaryAction: <Link className={moneyCockpitClasses.secondaryLink} href='/platform-v7/seller/lots'>Партии и лоты</Link>,
      };

  const statusLabel = !dealRegistryAvailable
    ? 'Состояние сделок не подтверждено'
    : dealRegistryComplete
      ? 'Серверный реестр сделок доступен'
      : 'Серверный реестр доступен · итоговое число UNKNOWN';

  const overviewSummary = !dealRegistryAvailable
    ? 'канонические данные недоступны'
    : dealCount === 0
      ? 'канонический реестр пуст'
      : dealRegistryComplete
        ? `${dealCount} подтверждённых сервером сделок`
        : `в текущем ответе: ${dealCount}+ · итоговое число сделок UNKNOWN`;

  return (
    <MoneyObligationCockpit
      testId='platform-v7-seller-cockpit'
      eyebrow='Продавец · серверные факты сделки'
      title={dealRegistryAvailable ? 'Рабочий кабинет продавца по подтверждённым данным' : 'Состояние сделок сейчас не подтверждено'}
      description='Первый экран строится только из серверного реестра сделок и серверного реестра споров, уже ограниченных правами текущего участника. Данные без подтверждения остаются UNKNOWN.'
      statusLabel={statusLabel}
      statusTone={dealRegistryComplete ? 'success' : 'warning'}
      priority={priority}
      facts={[
        {
          label: dealRegistryComplete ? 'Сделки' : 'Сделки в ответе',
          value: dealCountLabel,
          hint: !dealRegistryAvailable
            ? 'серверный ответ не подтверждён'
            : dealRegistryComplete
              ? 'данные получены из серверного списка сделок'
              : 'достигнут предел серверного ответа; итоговое число не выводится как факт',
        },
        {
          label: 'Серверный приоритет',
          value: 'UNKNOWN',
          hint: dealRegistryAvailable
            ? 'контракт списка сделок не публикует next-best-action; порядок ответа не используется как authority'
            : 'нет валидного серверного ответа, из которого можно определить приоритет',
        },
        {
          label: 'Открытые споры',
          value: disputeCount === null ? 'UNKNOWN' : String(disputeCount),
          hint: disputeRegistryAvailable ? 'данные получены из серверного реестра споров' : 'реестр споров недоступен',
        },
      ]}
    >
      <MoneyBoundary>
        Кабинет не делает выводов о резерве, выплате, СДИЗ, ЭТрН, применимости ФГИС, провайдере или статусе банка без подтверждённых серверных данных. Технический ответ внешнего сервиса сам по себе не означает завершение операции.
      </MoneyBoundary>

      <MoneyCockpitSection id='overview'>
        <CollapsibleSection title='Серверные данные сделок' summary={overviewSummary} defaultOpen>
          <div className={moneyCockpitClasses.sectionStack}>
            {!dealRegistryAvailable ? (
              <p className={moneyCockpitClasses.muted}>
                Канонический список сделок недоступен или некорректен. Деловые факты скрыты до получения валидного серверного ответа.
              </p>
            ) : canonicalDeals.length === 0 ? (
              <p className={moneyCockpitClasses.muted}>
                Сервер подтвердил пустой список сделок для текущего участника. Демонстрационные сделки не подставляются.
              </p>
            ) : (
              <>
                <p className={moneyCockpitClasses.muted}>
                  Список — навигация по подтверждённым сделкам, а не ранжирование следующего действия.
                </p>
                <MoneyQueue>
                  {canonicalDeals.slice(0, 5).map((deal) => (
                    <MoneyQueueLink
                      key={deal.id}
                      href={`/platform-v7/deals/${encodeURIComponent(deal.id)}/clean`}
                      title={deal.label}
                      detail={dealDetail(deal)}
                      status={<StatusChip tone='information'>{deal.status ?? 'UNKNOWN'}</StatusChip>}
                    />
                  ))}
                </MoneyQueue>
              </>
            )}
          </div>
        </CollapsibleSection>
      </MoneyCockpitSection>

      <MoneyCockpitSection id='routes'>
        <CollapsibleSection title='Рабочие маршруты продавца' summary='навигация без выдуманного состояния' defaultOpen={false}>
          <MoneyQueue>
            {sellerPaths.map((path) => (
              <MoneyQueueLink
                key={path.href}
                href={path.href}
                title={path.title}
                detail={path.note}
                status={<StatusChip tone='information'>Открыть</StatusChip>}
              />
            ))}
          </MoneyQueue>
        </CollapsibleSection>
      </MoneyCockpitSection>
    </MoneyObligationCockpit>
  );
}
