import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { UserRepositoriesService } from '../services/user-repositories.service';
import { AuthGuard } from '@/auth/guards/auth.guard';
import { GetUser } from '@/auth/decorators/user.decorator';
import type { User } from '@prisma/client';

@ApiTags('user-repositories')
@ApiBearerAuth()
@Controller('users/me/repositories')
@UseGuards(AuthGuard)
export class UserRepositoriesController {
  private readonly logger = new Logger(UserRepositoriesController.name);

  constructor(private readonly userRepositoriesService: UserRepositoriesService) {}

  /**
   * Get current user's repositories
   */
  @Get()
  @ApiOperation({ summary: 'Get current user repositories' })
  @ApiResponse({ status: 200, description: 'User repositories' })
  async getUserRepositories(@GetUser() user: User) {
    const repositories = await this.userRepositoriesService.getUserRepositories(user.id);

    return {
      repositories: repositories.map(repo => ({
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
      })),
      count: repositories.length,
    };
  }

  /**
   * Get enabled repositories for current user
   */
  @Get('enabled')
  @ApiOperation({ summary: 'Get enabled repositories for current user' })
  @ApiResponse({ status: 200, description: 'Enabled repositories' })
  async getEnabledRepositories(@GetUser() user: User) {
    const repositories = await this.userRepositoriesService.getEnabledRepositories(user.id);

    return {
      repositories: repositories.map(repo => ({
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
      })),
      count: repositories.length,
    };
  }

  /**
   * Sync repositories from GitHub
   */
  @Post('sync')
  @ApiOperation({ summary: 'Sync repositories from GitHub' })
  @ApiResponse({ status: 200, description: 'Repositories synced' })
  async syncRepositories(@GetUser() user: User) {
    // Note: In a real implementation, you'd need to get the user's GitHub access token
    // For now, we'll return a placeholder response
    this.logger.log(`Repository sync requested for user ${user.id}`);

    return {
      success: false,
      message: 'Repository sync requires GitHub access token integration',
      added: 0,
      updated: 0,
      total: 0,
    };
  }

  /**
   * Update repository settings
   */
  @Put(':repositoryId')
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
  @Put(':repositoryId/toggle')
  @ApiOperation({ summary: 'Toggle repository notifications' })
  @ApiResponse({ status: 200, description: 'Repository notifications toggled' })
  async toggleRepositoryNotifications(
    @GetUser() user: User,
    @Param('repositoryId') repositoryId: string,
    @Body() body: { enabled: boolean },
  ) {
    try {
      const repository = await this.userRepositoriesService.toggleRepositoryNotifications(
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
      throw new BadRequestException('Failed to toggle repository notifications');
    }
  }

  /**
   * Remove repository
   */
  @Delete(':repositoryId')
  @ApiOperation({ summary: 'Remove repository from tracking' })
  @ApiResponse({ status: 200, description: 'Repository removed' })
  async removeRepository(
    @GetUser() user: User,
    @Param('repositoryId') repositoryId: string,
  ) {
    const success = await this.userRepositoriesService.removeRepository(user.id, repositoryId);

    if (!success) {
      throw new BadRequestException('Failed to remove repository');
    }

    return {
      message: 'Repository removed successfully',
    };
  }

  /**
   * Get repository statistics
   */
  @Get('stats')
  @ApiOperation({ summary: 'Get repository statistics for current user' })
  @ApiResponse({ status: 200, description: 'Repository statistics' })
  async getRepositoryStats(@GetUser() user: User) {
    const stats = await this.userRepositoriesService.getRepositoryStats(user.id);

    return {
      ...stats,
      message: 'Repository statistics retrieved successfully',
    };
  }
}