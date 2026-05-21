import { Injectable, Optional } from '@nestjs/common';
import { TelegramService } from '../telegram/telegram.service';

export interface Notification {
  id: string;
  to: string;
  message: string;
  type: string;
  read: boolean;
  createdAt: string;
}

const MAX_NOTIFICATIONS = 200;

const TYPE_EMOJI: Record<string, string> = {
  DEAL: '🤝',
  LOT: '📦',
  DOCUMENT: '📄',
  DISPUTE: '⚖️',
  PAYMENT: '💳',
};

@Injectable()
export class NotificationsService {
  private readonly notifications: Notification[] = [];

  constructor(@Optional() private readonly telegram?: TelegramService) {}

  send(to: string, message: string, type: string) {
    const notification: Notification = {
      id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      to,
      message,
      type,
      read: false,
      createdAt: new Date().toISOString(),
    };
    this.notifications.push(notification);
    if (this.notifications.length > MAX_NOTIFICATIONS) {
      this.notifications.splice(0, this.notifications.length - MAX_NOTIFICATIONS);
    }

    const emoji = TYPE_EMOJI[type] ?? '🔔';
    void this.telegram?.broadcast(`${emoji} <b>${type}</b>\n\n${message}`);

    return notification;
  }

  list(user: any) {
    const userId = typeof user === 'string' ? user : user?.id || user?.email;
    return this.notifications
      .filter((n) => !userId || n.to === userId)
      .slice()
      .reverse();
  }
}
