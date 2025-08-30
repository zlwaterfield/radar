import {
  Controller,
  Get,
  Post,
  UseGuards,
  Logger,
  Param,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { NotificationsService } from '../services/notifications.service';
import { NotificationDistributionService } from '../services/notification-distribution.service';
import { AuthGuard } from '@/auth/guards/auth.guard';
import { GetUser } from '@/auth/decorators/user.decorator';
import type { User } from '@prisma/client';

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
@UseGuards(AuthGuard)
export class NotificationsController {
  private readonly logger = new Logger(NotificationsController.name);

  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly distributionService: NotificationDistributionService,
  ) {}

  /**
   * Get current user's pending notifications
   */
  @Get('pending')
  @ApiOperation({ summary: 'Get pending notifications for current user' })
  @ApiResponse({ status: 200, description: 'Pending notifications' })
  async getPendingNotifications(@GetUser() user: User) {
    const notifications = await this.notificationsService.getPendingNotifications(user.id);

    return {
      notifications: notifications.map(n => ({
        id: n.id,
        type: n.messageType,
        payload: n.payload,
        createdAt: n.createdAt,
        event: n.event ? {
          eventType: n.event.eventType,
          action: n.event.action,
          repositoryName: n.event.repositoryName,
          senderLogin: n.event.senderLogin,
        } : null,
      })),
      count: notifications.length,
    };
  }

  /**
   * Manually trigger notification processing for current user
   */
  @Post('process')
  @ApiOperation({ summary: 'Manually trigger notification processing for current user' })
  @ApiResponse({ status: 200, description: 'Notifications processed' })
  async processNotifications(@GetUser() user: User) {
    this.logger.log(`Manual notification processing triggered for user ${user.id}`);
    
    const result = await this.distributionService.processUserNotificationsManually(user.id);
    
    return {
      success: result.success,
      processedCount: result.processedCount,
      message: result.success 
        ? `Processed ${result.processedCount} notifications`
        : `Failed to process notifications: ${result.error}`,
    };
  }

  /**
   * Get notification statistics
   */
  @Get('stats')
  @ApiOperation({ summary: 'Get notification statistics' })
  @ApiResponse({ status: 200, description: 'Notification statistics' })
  async getNotificationStats() {
    const stats = await this.distributionService.getNotificationStats();
    
    return {
      ...stats,
      message: 'Notification statistics retrieved successfully',
    };
  }

  /**
   * Get recent notifications for current user
   */
  @Get('recent')
  @ApiOperation({ summary: 'Get recent notifications for current user' })
  @ApiResponse({ status: 200, description: 'Recent notifications' })
  async getRecentNotifications(@GetUser() user: User) {
    // Get both sent and pending notifications
    const [pending, sent] = await Promise.all([
      this.notificationsService.getPendingNotifications(user.id, 25),
      this.getRecentSentNotifications(user.id, 25),
    ]);

    const allNotifications = [...pending, ...sent]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 50);

    return {
      notifications: allNotifications.map(n => ({
        id: n.id,
        type: n.messageType,
        payload: n.payload,
        createdAt: n.createdAt,
        sent: !!n.messageTs,
        channel: n.channel,
        event: n.event ? {
          eventType: n.event.eventType,
          action: n.event.action,
          repositoryName: n.event.repositoryName,
          senderLogin: n.event.senderLogin,
        } : null,
      })),
      count: allNotifications.length,
      pending: pending.length,
      sent: sent.length,
    };
  }

  /**
   * Get recent sent notifications for a user
   */
  private async getRecentSentNotifications(userId: string, limit = 25): Promise<any[]> {
    try {
      return await this.distributionService['databaseService'].notification.findMany({
        where: {
          userId,
          messageTs: { not: null },
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: limit,
        include: {
          event: true,
        },
      });
    } catch (error) {
      this.logger.error(`Error getting recent sent notifications for user ${userId}:`, error);
      return [];
    }
  }

  /**
   * Health check for notification service
   */
  @Get('health')
  @ApiOperation({ summary: 'Notification service health check' })
  @ApiResponse({ status: 200, description: 'Service health status' })
  async healthCheck() {
    const stats = await this.distributionService.getNotificationStats();
    
    return {
      status: 'healthy',
      service: 'notifications',
      timestamp: new Date().toISOString(),
      stats: {
        total: stats.totalNotifications,
        pending: stats.pendingNotifications,
        recent: stats.recentNotifications,
      },
    };
  }
}