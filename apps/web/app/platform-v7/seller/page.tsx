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
  const disputeRegistryAvailable = disputeSnapshot.isApiAvailable;
  const disputeCount = disputeRegistryAvailable ? openDisputeCount(disputeSnapshot.disputes) : null;
  const firstDeal = dealRegistryAvailable ? canonicalDeals[0] ?? null : null;
  const dealCount = dealRegistryAvailable ? canonicalDeals.length : null;

  const priority: MoneyPriority = !dealRegistryAvailable
    ? {
        title: 'Проверить доступность серверного реестра сделок',
        description: 'Канонический список сделок сейчас не подтверждён. Кабинет не подставляет демонстрационные лоты, суммы, документы, регуляторные статусы или банковские результаты.',
        state: 'waiting',
        blocker: 'канонический список сделок недоступен или содержит неприемлемые данные',
        owner: 'серверный контур сделки',
        result: 'подтверждённый сервером список сделок',
        primaryAction: <Link className={moneyCockpitClasses.primaryLink} href='/platform-v7/seller'>Обновить данные</Link>,
        secondaryAction: <Link className={moneyCockpitClasses.secondaryLink} href='/platform-v7/seller/lots'>Партии и лоты</Link>,
      }
    : firstDeal
      ? {
          title: `Открыть подтверждённую сервером сделку ${firstDeal.label}`,
          description: 'Кабинет показывает только факты, которые пришли из канонического списка сделок. Статусы документов, ФГИС, банка и движения денег здесь не выводятся без отдельной серверной authority.',
          state: 'ready',
          owner: 'продавец',
          result: 'открыть рабочую поверхность сделки',
          primaryAction: (
            <Link
              className={moneyCockpitClasses.primaryLink}
              href={`/platform-v7/deals/${encodeURIComponent(firstDeal.id)}/clean`}
            >
              Открыть сделку
            </Link>
          ),
          secondaryAction: <Link className={moneyCockpitClasses.secondaryLink} href='/platform-v7/seller/lots'>Партии и лоты</Link>,
        }
      : {
          title: 'Создать партию или перейти к рабочим маршрутам продавца',
          description: 'Серверный реестр доступен и не вернул сделок. Это честное пустое состояние, а не замена демонстрационным LOT/DL, суммам или документным статусам.',
          owner: 'продавец',
          result: 'новая партия или переход к существующим маршрутам',
          primaryAction: <Link className={moneyCockpitClasses.primaryLink} href='/platform-v7/seller/batches/new'>Создать партию</Link>,
          secondaryAction: <Link className={moneyCockpitClasses.secondaryLink} href='/platform-v7/seller/lots'>Партии и лоты</Link>,
        };

  const statusLabel = dealRegistryAvailable
    ? 'Серверный реестр сделок доступен'
    : 'Состояние сделок UNKNOWN';

  const overviewSummary = !dealRegistryAvailable
    ? 'канонические данные недоступны'
    : dealCount === 0
      ? 'канонический реестр пуст'
      : `${dealCount} подтверждённых сервером сделок`;

  return (
    <MoneyObligationCockpit
      testId='platform-v7-seller-cockpit'
      eyebrow='Продавец · серверные факты сделки'
      title={dealRegistryAvailable ? 'Рабочий кабинет продавца без выдуманной finality' : 'Состояние сделок сейчас не подтверждено'}
      description='Первый экран строится только из participant-scoped серверного реестра сделок и серверного реестра споров. Отсутствующая authority остаётся UNKNOWN.'
      statusLabel={statusLabel}
      statusTone={dealRegistryAvailable ? 'success' : 'warning'}
      priority={priority}
      facts={[
        {
          label: 'Сделки',
          value: dealCount === null ? 'UNKNOWN' : String(dealCount),
          hint: dealRegistryAvailable ? 'participant-scoped ответ /deals' : 'серверный ответ не подтверждён',
        },
        {
          label: 'Текущая карточка',
          value: firstDeal?.label ?? (dealRegistryAvailable ? 'Нет сделки' : 'UNKNOWN'),
          hint: firstDeal ? 'идентификатор получен с сервера' : 'локальный идентификатор не подставляется',
        },
        {
          label: 'Статус сделки',
          value: firstDeal?.status ?? (dealRegistryAvailable && dealCount === 0 ? 'Нет сделки' : 'UNKNOWN'),
          hint: firstDeal?.status ? 'канонический статус сделки' : 'статус не выводится без серверного факта',
        },
        {
          label: 'Открытые споры',
          value: disputeCount === null ? 'UNKNOWN' : String(disputeCount),
          hint: disputeRegistryAvailable ? 'participant-scoped реестр споров' : 'реестр споров недоступен',
        },
      ]}
    >
      <MoneyBoundary>
        Кабинет не делает выводов о резерве, выплате, СДИЗ, ЭТрН, применимости ФГИС, провайдере или статусе банка без соответствующей серверной authority. HTTP/ACK сами по себе не являются finality.
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
