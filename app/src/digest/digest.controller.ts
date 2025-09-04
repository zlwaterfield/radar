import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '../auth/guards/auth.guard';
import { DatabaseService } from '../database/database.service';

@Controller('digest')
@UseGuards(AuthGuard)
export class DigestController {
  constructor(private readonly databaseService: DatabaseService) {}

  /**
   * Get digest history for current user
   * GET /digest/history
   */
  @Get('history')
  async getDigestHistory(@Request() req: any) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return {
          success: false,
          error: 'User not found',
        };
      }

      const history = await this.databaseService.userDigest.findMany({
        where: { userId },
        include: {
          digestConfig: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: { sentAt: 'desc' },
        take: 30, // Last 30 digests
      });

      return {
        success: true,
        history: history.map((digest) => ({
          id: digest.id,
          sentAt: digest.sentAt.toISOString(),
          pullRequestCount: digest.pullRequestCount,
          issueCount: digest.issueCount,
          deliveryType: digest.deliveryType,
          deliveryTarget: digest.deliveryTarget,
          digestConfig: digest.digestConfig,
        })),
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }
}
