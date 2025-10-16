import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { DatabaseService } from '@/database/database.service';

@Injectable()
export class AdminGuard implements CanActivate {
  private readonly logger = new Logger(AdminGuard.name);

  constructor(private readonly databaseService: DatabaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    // Assume AuthGuard has already validated and attached user to request
    const user = request.user;

    if (!user || !user.id) {
      throw new ForbiddenException('User not authenticated');
    }

    try {
      // Fetch user from database to check admin status
      const dbUser = await this.databaseService.user.findUnique({
        where: { id: user.id },
        select: { isAdmin: true },
      });

      if (!dbUser?.isAdmin) {
        this.logger.warn(`User ${user.id} attempted to access admin endpoint`);
        throw new ForbiddenException('Admin access required');
      }

      return true;
    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw error;
      }
      this.logger.error('Error checking admin status:', error);
      throw new ForbiddenException('Unable to verify admin status');
    }
  }
}
