import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { UserTeamsService } from '../services/user-teams.service';
import { UsersService } from '../services/users.service';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { GetUser } from '../../auth/decorators/user.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { createPaginatedResponse } from '../../common/utils/pagination.util';
import type { User } from '@prisma/client';

@ApiTags('user-teams')
@ApiBearerAuth()
@Controller('users')
@UseGuards(AuthGuard)
export class UserTeamsController {
  private readonly logger = new Logger(UserTeamsController.name);

  constructor(
    private readonly userTeamsService: UserTeamsService,
    private readonly usersService: UsersService,
  ) {}

  /**
   * Get current user's teams
   */
  @Get('me/teams')
  @ApiOperation({ summary: 'Get current user teams' })
  @ApiResponse({ status: 200, description: 'User teams' })
  async getUserTeams(
    @GetUser() user: User,
    @Query() pagination: PaginationQueryDto,
  ) {
    const { teams, total } = await this.userTeamsService.getUserTeamsPaginated(
      user.id,
      pagination.page || 1,
      pagination.per_page || 20,
    );

    const mappedTeams = teams.map((team) => ({
      id: team.id,
      teamId: team.teamId,
      teamSlug: team.teamSlug,
      teamName: team.teamName,
      organization: team.organization,
      permission: team.permission,
      enabled: team.enabled,
      createdAt: team.createdAt,
      updatedAt: team.updatedAt,
    }));

    return createPaginatedResponse(
      mappedTeams,
      total,
      pagination.page || 1,
      pagination.per_page || 20,
    );
  }

  /**
   * Get enabled teams for current user
   */
  @Get('me/teams/enabled')
  @ApiOperation({ summary: 'Get enabled teams for current user' })
  @ApiResponse({ status: 200, description: 'Enabled teams' })
  async getEnabledTeams(
    @GetUser() user: User,
    @Query() pagination: PaginationQueryDto,
  ) {
    const { teams, total } =
      await this.userTeamsService.getEnabledTeamsPaginated(
        user.id,
        pagination.page || 1,
        pagination.per_page || 20,
      );

    const mappedTeams = teams.map((team) => ({
      id: team.id,
      teamId: team.teamId,
      teamSlug: team.teamSlug,
      teamName: team.teamName,
      organization: team.organization,
      permission: team.permission,
      enabled: team.enabled,
    }));

    return createPaginatedResponse(
      mappedTeams,
      total,
      pagination.page || 1,
      pagination.per_page || 20,
    );
  }

  /**
   * Sync teams from GitHub
   */
  @Post('me/teams/sync')
  @ApiOperation({ summary: 'Sync teams from GitHub' })
  @ApiResponse({ status: 200, description: 'Teams synced' })
  async syncTeams(@GetUser() user: User) {
    this.logger.log(`Team sync requested for user ${user.id}`);

    // Check if user has GitHub access token
    const fullUser = await this.usersService.getUserById(user.id);
    if (!fullUser || !fullUser.githubAccessToken) {
      throw new BadRequestException(
        'GitHub account not connected. Please connect your GitHub account first.',
      );
    }

    try {
      const result = await this.userTeamsService.syncUserTeams(
        user.id,
        fullUser.githubAccessToken,
      );

      this.logger.log(
        `Team sync completed for user ${user.id}: ${result.added} added, ${result.updated} updated`,
      );

      return {
        success: true,
        message: `Successfully synced ${result.total} teams. ${result.added} new teams added, ${result.updated} teams updated.`,
        added: result.added,
        updated: result.updated,
        total: result.total,
      };
    } catch (error) {
      this.logger.error(
        `Team sync failed for user ${user.id}:`,
        error instanceof Error ? error.message : String(error),
      );

      // Handle specific GitHub API errors
      if (
        error instanceof Error &&
        'status' in error &&
        (error as { status: number }).status === 401
      ) {
        throw new BadRequestException(
          'GitHub access token is invalid. Please reconnect your GitHub account.',
        );
      }

      throw new BadRequestException(
        'Failed to sync teams from GitHub. Please try again later.',
      );
    }
  }

  /**
   * Toggle team notifications
   */
  @Patch('me/teams/:teamId/toggle')
  @ApiOperation({ summary: 'Toggle team notifications' })
  @ApiResponse({ status: 200, description: 'Team notifications toggled' })
  async toggleTeamNotifications(
    @GetUser() user: User,
    @Param('teamId') teamId: string,
    @Body() body: { enabled: boolean },
  ) {
    try {
      const team = await this.userTeamsService.toggleTeamNotifications(
        user.id,
        teamId,
        body.enabled,
      );

      return {
        team: {
          id: team.id,
          teamSlug: team.teamSlug,
          teamName: team.teamName,
          organization: team.organization,
          enabled: team.enabled,
        },
        message: `Notifications ${body.enabled ? 'enabled' : 'disabled'} for team ${team.teamName}`,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException('Failed to toggle team notifications');
    }
  }

  /**
   * Toggle all teams for current user
   */
  @Patch('me/teams/toggle-all')
  @ApiOperation({
    summary: 'Toggle all teams notifications for current user',
  })
  @ApiResponse({ status: 200, description: 'All teams toggled' })
  async toggleAllTeamsForMe(
    @GetUser() user: User,
    @Body() body: { enabled: boolean },
  ) {
    // Get all teams and toggle them
    const teams = await this.userTeamsService.getUserTeams(user.id);
    const updatePromises = teams.map((team) =>
      this.userTeamsService.toggleTeamNotifications(
        user.id,
        team.id,
        body.enabled,
      ),
    );

    await Promise.all(updatePromises);

    return {
      message: `Notifications ${body.enabled ? 'enabled' : 'disabled'} for all teams`,
      count: teams.length,
    };
  }

  /**
   * Get team statistics
   */
  @Get('me/teams/stats')
  @ApiOperation({ summary: 'Get team statistics for current user' })
  @ApiResponse({ status: 200, description: 'Team statistics' })
  async getTeamStats(@GetUser() user: User) {
    const stats = await this.userTeamsService.getTeamStats(user.id);

    return {
      ...stats,
      message: 'Team statistics retrieved successfully',
    };
  }
}
