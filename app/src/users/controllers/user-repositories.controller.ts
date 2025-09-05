import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
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
import { UserRepositoriesService } from '../services/user-repositories.service';
import { UsersService } from '../services/users.service';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { GetUser } from '../../auth/decorators/user.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { createPaginatedResponse } from '../../common/utils/pagination.util';
import type { User } from '@prisma/client';

@ApiTags('user-repositories')
@ApiBearerAuth()
@Controller('users')
@UseGuards(AuthGuard)
export class UserRepositoriesController {
  private readonly logger = new Logger(UserRepositoriesController.name);

  constructor(
    private readonly userRepositoriesService: UserRepositoriesService,
    private readonly usersService: UsersService,
  ) {}

  /**
   * Get current user's repositories
   */
  @Get('me/repositories')
  @ApiOperation({ summary: 'Get current user repositories' })
  @ApiResponse({ status: 200, description: 'User repositories' })
  async getUserRepositories(
    @GetUser() user: User,
    @Query() pagination: PaginationQueryDto,
  ) {
    const { repositories, total } =
      await this.userRepositoriesService.getUserRepositoriesPaginated(
        user.id,
        pagination.page || 1,
        pagination.per_page || 20,
      );

    const mappedRepositories = repositories.map((repo) => ({
      id: repo.id,
      githubId: repo.githubId,
      name: repo.name,
      fullName: repo.fullName,
      description: repo.description,
      url: repo.url,
      isPrivate: repo.isPrivate,
      isFork: repo.isFork,
      enabled: repo.enabled,
      isActive: repo.isActive,
      ownerName: repo.ownerName,
      ownerAvatarUrl: repo.ownerAvatarUrl,
      organization: repo.organization,
      createdAt: repo.createdAt,
      updatedAt: repo.updatedAt,
    }));

    return createPaginatedResponse(
      mappedRepositories,
      total,
      pagination.page || 1,
      pagination.per_page || 20,
    );
  }

  /**
   * Get enabled repositories for current user
   */
  @Get('me/repositories/enabled')
  @ApiOperation({ summary: 'Get enabled repositories for current user' })
  @ApiResponse({ status: 200, description: 'Enabled repositories' })
  async getEnabledRepositories(
    @GetUser() user: User,
    @Query() pagination: PaginationQueryDto,
  ) {
    const { repositories, total } =
      await this.userRepositoriesService.getEnabledRepositoriesPaginated(
        user.id,
        pagination.page || 1,
        pagination.per_page || 20,
      );

    const mappedRepositories = repositories.map((repo) => ({
      id: repo.id,
      githubId: repo.githubId,
      name: repo.name,
      fullName: repo.fullName,
      description: repo.description,
      url: repo.url,
      isPrivate: repo.isPrivate,
      enabled: repo.enabled,
      ownerName: repo.ownerName,
      organization: repo.organization,
    }));

    return createPaginatedResponse(
      mappedRepositories,
      total,
      pagination.page || 1,
      pagination.per_page || 20,
    );
  }

  /**
   * Sync repositories from GitHub
   */
  @Post('me/repositories/sync')
  @ApiOperation({ summary: 'Sync repositories from GitHub' })
  @ApiResponse({ status: 200, description: 'Repositories synced' })
  async syncRepositories(@GetUser() user: User) {
    this.logger.log(`Repository sync requested for user ${user.id}`);

    // Check if user has GitHub access token
    const fullUser = await this.usersService.getUserById(user.id);
    if (!fullUser || !fullUser.githubAccessToken) {
      throw new BadRequestException(
        'GitHub account not connected. Please connect your GitHub account first.',
      );
    }

    try {
      const result = await this.userRepositoriesService.syncUserRepositories(
        user.id,
        fullUser.githubAccessToken,
      );

      this.logger.log(
        `Repository sync completed for user ${user.id}: ${result.added} added, ${result.updated} updated`,
      );

      return {
        success: true,
        message: `Successfully synced ${result.total} repositories. ${result.added} new repositories added, ${result.updated} repositories updated.`,
        added: result.added,
        updated: result.updated,
        total: result.total,
      };
    } catch (error) {
      this.logger.error(
        `Repository sync failed for user ${user.id}:`,
        error instanceof Error ? error.message : String(error),
      );

      // Handle specific GitHub API errors
      if (
        error instanceof Error &&
        'status' in error &&
        (error as any).status === 401
      ) {
        throw new BadRequestException(
          'GitHub access token is invalid. Please reconnect your GitHub account.',
        );
      }

      throw new BadRequestException(
        'Failed to sync repositories from GitHub. Please try again later.',
      );
    }
  }

  /**
   * Update repository settings
   */
  @Put('me/repositories/:repositoryId')
  @ApiOperation({ summary: 'Update repository settings' })
  @ApiResponse({ status: 200, description: 'Repository updated' })
  async updateRepository(
    @GetUser() user: User,
    @Param('repositoryId') repositoryId: string,
    @Body() updateData: { enabled?: boolean; isActive?: boolean },
  ) {
    try {
      const repository = await this.userRepositoriesService.updateRepository(
        user.id,
        repositoryId,
        updateData,
      );

      return {
        repository: {
          id: repository.id,
          githubId: repository.githubId,
          name: repository.name,
          fullName: repository.fullName,
          enabled: repository.enabled,
          isActive: repository.isActive,
          updatedAt: repository.updatedAt,
        },
        message: 'Repository updated successfully',
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException('Failed to update repository');
    }
  }

  /**
   * Toggle repository notifications
   */
  @Patch('me/repositories/:repoId/toggle')
  @ApiOperation({ summary: 'Toggle repository notifications' })
  @ApiResponse({ status: 200, description: 'Repository notifications toggled' })
  async toggleRepositoryNotifications(
    @GetUser() user: User,
    @Param('repoId') repositoryId: string,
    @Body() body: { enabled: boolean },
  ) {
    try {
      const repository =
        await this.userRepositoriesService.toggleRepositoryNotifications(
          user.id,
          repositoryId,
          body.enabled,
        );

      return {
        repository: {
          id: repository.id,
          name: repository.name,
          fullName: repository.fullName,
          enabled: repository.enabled,
        },
        message: `Notifications ${body.enabled ? 'enabled' : 'disabled'} for ${repository.fullName}`,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(
        'Failed to toggle repository notifications',
      );
    }
  }

  /**
   * Remove repository
   */
  @Delete('me/repositories/:repositoryId')
  @ApiOperation({ summary: 'Remove repository from tracking' })
  @ApiResponse({ status: 200, description: 'Repository removed' })
  async removeRepository(
    @GetUser() user: User,
    @Param('repositoryId') repositoryId: string,
  ) {
    const success = await this.userRepositoriesService.removeRepository(
      user.id,
      repositoryId,
    );

    if (!success) {
      throw new BadRequestException('Failed to remove repository');
    }

    return {
      message: 'Repository removed successfully',
    };
  }

  /**
   * Toggle all repositories for current user
   */
  @Patch('me/repositories/toggle-all')
  @ApiOperation({
    summary: 'Toggle all repositories notifications for current user',
  })
  @ApiResponse({ status: 200, description: 'All repositories toggled' })
  async toggleAllRepositoriesForMe(
    @GetUser() user: User,
    @Body() body: { enabled: boolean },
  ) {
    // Get all repositories and toggle them
    const repositories = await this.userRepositoriesService.getUserRepositories(
      user.id,
    );
    const updatePromises = repositories.map((repo) =>
      this.userRepositoriesService.toggleRepositoryNotifications(
        user.id,
        repo.id,
        body.enabled,
      ),
    );

    await Promise.all(updatePromises);

    return {
      message: `Notifications ${body.enabled ? 'enabled' : 'disabled'} for all repositories`,
      count: repositories.length,
    };
  }

  /**
   * Get repository statistics
   */
  @Get('me/repositories/stats')
  @ApiOperation({ summary: 'Get repository statistics for current user' })
  @ApiResponse({ status: 200, description: 'Repository statistics' })
  async getRepositoryStats(@GetUser() user: User) {
    const stats = await this.userRepositoriesService.getRepositoryStats(
      user.id,
    );

    return {
      ...stats,
      message: 'Repository statistics retrieved successfully',
    };
  }
}
