import { Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { NotificationsService } from './notifications.service';

@Controller('api/notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(@CurrentUser() user: any) {
    return { items: this.notifications.list(user) };
  }

  @Get('unread-count')
  unreadCount(@CurrentUser() user: any) {
    const userId = user?.id || user?.email;
    return { count: this.notifications.getUnreadCount(userId) };
  }

  @Patch(':id/read')
  markRead(@Param('id') id: string, @CurrentUser() user: any) {
    const userId = user?.id || user?.email;
    return this.notifications.markRead(id, userId) ?? { message: 'Not found' };
  }

  @Patch('read-all')
  markAllRead(@CurrentUser() user: any) {
    const userId = user?.id || user?.email;
    const count = this.notifications.markAllRead(userId);
    return { markedRead: count };
  }

  @Get('templates')
  getTemplates() {
    return this.notifications.getTemplates();
  }
}
