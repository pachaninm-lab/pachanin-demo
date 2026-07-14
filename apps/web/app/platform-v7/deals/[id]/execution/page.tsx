'use client';;
import { use } from "react";

import { CanonicalDealWorkspace } from '@/components/platform-v7/CanonicalDealWorkspace';
import { usePlatformV7RStore } from '@/stores/usePlatformV7RStore';

/**
 * Исполнительное рабочее место конкретной сделки.
 *
 * Любая сделка, в которой пользователь назначен активным участником,
 * открывается по /platform-v7/deals/<id>/execution. Состояние и права
 * подтверждает только сервер (fail-closed membership в API); роль из
 * client-store используется исключительно для отображения.
 */
export default function PlatformV7DealExecutionPage(props: { params: Promise<{ id: string }> }) {
 const params = use(props.params);
 const role = usePlatformV7RStore((state) => state.role);
 return <CanonicalDealWorkspace role={role} dealId={params.id} />;
}
