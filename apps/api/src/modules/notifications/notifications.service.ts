import { Injectable } from '@nestjs/common';

export interface Notification {
  id: string;
  to: string;
  message: string;
  type: string;
  read: boolean;
  createdAt: string;
}

const MAX_NOTIFICATIONS = 200;

@Injectable()
export class NotificationsService {
  private readonly notifications: Notification[] = [];

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
