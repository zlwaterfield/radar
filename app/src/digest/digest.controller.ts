import { Controller, Post, Get, Param, UseGuards, Request } from '@nestjs/common';
import { DigestService } from './digest.service';
import { AuthGuard } from '../auth/guards/auth.guard';
import { DatabaseService } from '../database/database.service';

@Controller('digest')
@UseGuards(AuthGuard)
export class DigestController {
  constructor(
    private readonly digestService: DigestService,
    private readonly databaseService: DatabaseService
  ) {}

  /**
   * Test digest generation for a specific user
   * POST /digest/test/:userId
   */
  @Post('test/:userId')
  async testUserDigest(@Param('userId') userId: string) {
    try {
      // Get user data
      const users = await this.digestService.getUsersWithDigestEnabled();
      const userData = users.find(u => u.userId === userId);
      
      if (!userData) {
        return {
          success: false,
          error: `User ${userId} not found or digest not enabled`
        };
      }

      // Generate digest content
      const digest = await this.digestService.generateDigestForUser(userData);

      return {
        success: true,
        user: {
          id: userData.userId,
          githubLogin: userData.userGithubLogin,
          digestTime: userData.digestTime,
          repositoriesCount: userData.repositories.length
        },
        digest: {
          waitingOnUser: digest.waitingOnUser.length,
          approvedReadyToMerge: digest.approvedReadyToMerge.length,
          userOpenPRs: digest.userOpenPRs.length,
          details: {
            waitingOnUser: digest.waitingOnUser.map(pr => ({
              title: pr.title,
              url: pr.html_url,
              repo: pr.base.repo.full_name
            })),
            approvedReadyToMerge: digest.approvedReadyToMerge.map(pr => ({
              title: pr.title,
              url: pr.html_url,
              repo: pr.base.repo.full_name
            })),
            userOpenPRs: digest.userOpenPRs.map(pr => ({
              title: pr.title,
              url: pr.html_url,
              repo: pr.base.repo.full_name
            }))
          }
        }
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Send test digest to a specific user
   * POST /digest/send/:userId
   */
  @Post('send/:userId')
  async sendTestDigest(@Param('userId') userId: string) {
    try {
      // Get user data
      const users = await this.digestService.getUsersWithDigestEnabled();
      const userData = users.find(u => u.userId === userId);
      
      if (!userData) {
        return {
          success: false,
          error: `User ${userId} not found or digest not enabled`
        };
      }

      // Generate and send digest
      const digest = await this.digestService.generateDigestForUser(userData);
      const sent = await this.digestService.sendDigestToUser(userData, digest);

      return {
        success: sent,
        message: sent ? 'Test digest sent successfully' : 'Failed to send test digest',
        digest: {
          waitingOnUser: digest.waitingOnUser.length,
          approvedReadyToMerge: digest.approvedReadyToMerge.length,
          userOpenPRs: digest.userOpenPRs.length
        }
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get all users with digest enabled
   * POST /digest/users
   */
  @Post('users')
  async getDigestUsers() {
    try {
      const users = await this.digestService.getUsersWithDigestEnabled();
      
      return {
        success: true,
        count: users.length,
        users: users.map(user => ({
          id: user.userId,
          githubLogin: user.userGithubLogin,
          digestTime: user.digestTime,
          repositoriesCount: user.repositories.length,
          hasSlack: !!(user.slackId && user.slackAccessToken)
        }))
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

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
          error: 'User not found'
        };
      }

      const history = await this.databaseService.userDigest.findMany({
        where: { userId },
        orderBy: { sentAt: 'desc' },
        take: 30, // Last 30 digests
      });

      return {
        success: true,
        history: history.map(digest => ({
          id: digest.id,
          sentAt: digest.sentAt.toISOString(),
          pullRequestCount: digest.pullRequestCount,
          issueCount: digest.issueCount
        }))
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}