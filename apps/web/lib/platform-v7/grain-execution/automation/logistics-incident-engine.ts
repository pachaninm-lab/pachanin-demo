import type { ExecutionBlocker, LogisticsIncident, MoneyAdjustment } from '../types';
import { money } from '../format';

function isOpenIncident(incident: LogisticsIncident): boolean {
  return incident.status === 'open' || incident.status === 'in_progress';
}

function incidentBlocksMoney(incident: LogisticsIncident): boolean {
  return isOpenIncident(incident) && (incident.severity === 'critical' || ['route_deviation', 'gps_lost', 'missing_document', 'sdiz_not_ready', 'etrn_not_signed', 'weight_deviation'].includes(incident.type));
}

export function logisticsIncidentAdjustment(incident: LogisticsIncident): MoneyAdjustment | null {
  if (!isOpenIncident(incident) || !incident.moneyImpact || incident.moneyImpact.value <= 0) return null;

  return {
    id: `MA-${incident.id}`,
    dealId: incident.dealId,
    type: incident.type === 'weight_deviation' ? 'weight_deviation' : 'logistics_penalty',
    title: incident.type === 'route_deviation' ? 'Удержание до проверки маршрута' : 'Удержание по логистическому инциденту',
    amount: incident.moneyImpact,
    sourceEntityType: 'logistics_incident',
    sourceEntityId: incident.id,
    status: incident.severity === 'critical' ? 'disputed' : 'applied',
    blocksFullRelease: incident.severity === 'critical',
    allowsPartialRelease: incident.severity !== 'critical',
    createdAt: incident.createdAt,
  };
}

export function logisticsIncidentBlockers(incidents: readonly LogisticsIncident[]): ExecutionBlocker[] {
  return incidents
    .filter(incidentBlocksMoney)
    .map((incident) => ({
      id: `${incident.id}-money-release-block`,
      type: 'logistics' as const,
      severity: incident.severity === 'critical' ? ('critical' as const) : ('warning' as const),
      title: incident.type === 'route_deviation' ? 'Отклонение маршрута требует проверки' : 'Логистический инцидент блокирует выпуск денег',
      description: incident.moneyImpact && incident.moneyImpact.value > 0
        ? `Инцидент должен быть закрыт или подтверждён оператором до выпуска денег. Потенциальное удержание: ${money(incident.moneyImpact.value).value.toLocaleString('ru-RU')} ₽.`
        : 'Инцидент должен быть закрыт или подтверждён оператором до выпуска денег.',
      blocks: 'money_release' as const,
      responsibleRole: 'logistics' as const,
      relatedEntityType: 'logistics_incident',
      relatedEntityId: incident.id,
      moneyImpact: incident.moneyImpact,
    }));
}
