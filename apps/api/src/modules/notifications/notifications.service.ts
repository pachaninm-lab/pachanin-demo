import { Injectable } from '@nestjs/common';

export interface Notification {
  id: string;
  to: string;
  message: string;
  type: string;
  title: string;
  dealId?: string;
  read: boolean;
  readAt?: string;
  createdAt: string;
}

const MAX_NOTIFICATIONS = 500;

const TYPE_TEMPLATES: Record<string, { title: string; messageTemplate: string }> = {
  'deal:created': { title: 'Новая сделка', messageTemplate: 'Создана сделка {ref}' },
  'deal:status': { title: 'Статус сделки изменён', messageTemplate: 'Сделка {ref} перешла в статус {status}' },
  'deal:payment_reserved': { title: 'Оплата зарезервирована', messageTemplate: 'Эскроу по сделке {ref} пополнен' },
  'deal:payment_released': { title: 'Оплата получена', messageTemplate: 'Средства по сделке {ref} зачислены на ваш счёт' },
  'deal:dispute_opened': { title: 'Открыт спор', messageTemplate: 'По сделке {ref} открыт спор' },
  'deal:closed': { title: 'Сделка закрыта', messageTemplate: 'Сделка {ref} успешно закрыта' },
  'kyc:approved': { title: 'KYC пройдено', messageTemplate: 'Верификация организации подтверждена' },
  'kyc:rejected': { title: 'KYC отклонено', messageTemplate: 'Верификация организации отклонена: {reason}' },
  'document:signed': { title: 'Документ подписан', messageTemplate: 'Документ "{docName}" подписан' },
  'document:pending_signature': { title: 'Требуется подпись', messageTemplate: 'Документ "{docName}" ожидает вашей подписи' },
  'shipment:assigned': { title: 'Перевозчик назначен', messageTemplate: 'На сделку {ref} назначен перевозчик' },
  'shipment:delivered': { title: 'Груз доставлен', messageTemplate: 'Доставка по сделке {ref} завершена' },
  'factoring:approved': { title: 'Факторинг одобрен', messageTemplate: 'Заявка на факторинг одобрена на сумму {amount}' },
  'factoring:rejected': { title: 'Факторинг отклонён', messageTemplate: 'Заявка на факторинг отклонена' },
  'mfa:enabled': { title: 'MFA включена', messageTemplate: 'Двухфакторная аутентификация активирована' },
  'system:outbox_dead': { title: 'Ошибка доставки события', messageTemplate: 'Событие {ref} не удалось доставить после {retries} попыток' },
  'support:ticket_update': { title: 'Обновление тикета', messageTemplate: 'Тикет {ref} обновлён: {status}' },
  'certificate:expiring_soon': { title: 'Сертификат УКЭП истекает', messageTemplate: 'Сертификат {subjectName} истекает через {days} дн.' },
  'certificate:expired': { title: 'Сертификат УКЭП истёк', messageTemplate: 'Сертификат {subjectName} истёк. Обновите сертификат.' },
};

@Injectable()
export class NotificationsService {
  private readonly notifications: Notification[] = [];

  send(to: string, message: string, type: string, extra?: { title?: string; dealId?: string }) {
    const template = TYPE_TEMPLATES[type];
    const notification: Notification = {
      id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      to,
      message,
      type,
      title: extra?.title ?? template?.title ?? type,
      dealId: extra?.dealId,
      read: false,
      createdAt: new Date().toISOString(),
    };
    this.notifications.push(notification);
    if (this.notifications.length > MAX_NOTIFICATIONS) {
      this.notifications.splice(0, this.notifications.length - MAX_NOTIFICATIONS);
    }
    return notification;
  }

  markRead(id: string, userId: string): Notification | null {
    const n = this.notifications.find(n => n.id === id && n.to === userId);
    if (!n) return null;
    n.read = true;
    n.readAt = new Date().toISOString();
    return n;
  }

  markAllRead(userId: string): number {
    let count = 0;
    for (const n of this.notifications) {
      if (n.to === userId && !n.read) {
        n.read = true;
        n.readAt = new Date().toISOString();
        count++;
      }
    }
    return count;
  }

  getUnreadCount(userId: string): number {
    return this.notifications.filter(n => n.to === userId && !n.read).length;
  }

  list(user: any) {
    const userId = typeof user === 'string' ? user : user?.id || user?.email;
    return this.notifications
      .filter((n) => !userId || n.to === userId)
      .slice()
      .reverse();
  }

  getTemplates(): Record<string, { title: string; messageTemplate: string }> {
    return TYPE_TEMPLATES;
  }
}
