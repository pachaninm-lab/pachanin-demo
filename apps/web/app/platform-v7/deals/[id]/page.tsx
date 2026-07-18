import { redirect } from 'next/navigation';

/**
 * Каноническая карточка сделки открывается на живом исполнительном рабочем
 * месте (реальные данные из execution-workspace API, доступ подтверждает
 * сервер). Прежде вела на /clean с доменной витриной-заглушкой; живой конвейер
 * доказан сквозным прогоном до CLOSED и должен быть первым, что видит участник.
 */
export default async function PlatformV7DealDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  redirect(`/platform-v7/deals/${params.id}/execution`);
}
