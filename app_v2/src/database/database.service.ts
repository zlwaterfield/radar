import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class DatabaseService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(DatabaseService.name);

  constructor() {
    super({
      log: [
        { emit: 'event', level: 'query' },
        { emit: 'event', level: 'error' },
        { emit: 'event', level: 'info' },
        { emit: 'event', level: 'warn' },
      ],
    });
  }

  async onModuleInit() {
    // Setup logging
    this.$on('query' as never, (e: any) => {
      this.logger.debug(
        `Query: ${e.query} - Params: ${e.params} - Duration: ${e.duration}ms`,
      );
    });

    this.$on('error' as never, (e: any) => {
      this.logger.error(`Database Error: ${e.message}`, e);
    });

    this.$on('info' as never, (e: any) => {
      this.logger.log(`Database Info: ${e.message}`);
    });

    this.$on('warn' as never, (e: any) => {
      this.logger.warn(`Database Warning: ${e.message}`);
    });

    try {
      await this.$connect();
      this.logger.log('Successfully connected to database');
    } catch (error) {
      this.logger.error('Failed to connect to database', error);
      throw error;
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('Disconnected from database');
  }

  /**
   * Check if the database connection is healthy
   */
  async isHealthy(): Promise<boolean> {
    try {
      await this.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get database metrics for monitoring
   */
  async getMetrics() {
    const userCount = await this.user.count();
    const eventCount = await this.event.count();
    const notificationCount = await this.notification.count();

    return {
      users: userCount,
      events: eventCount,
      notifications: notificationCount,
      timestamp: new Date(),
    };
  }
}
