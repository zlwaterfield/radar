import {
  Controller,
  Get,
  Post,
  Query,
  Param,
  UseGuards,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { GitHubService } from '../services/github.service';
import { AuthGuard } from '@/auth/guards/auth.guard';
import { CurrentUser } from '@/auth/decorators/user.decorator';
import { DatabaseService } from '@/database/database.service';
import { parseRepositoryFullName } from '@/common/utils/validation.utils';

@ApiTags('GitHub Integration')
@Controller('github')
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class GitHubController {
  private readonly logger = new Logger(GitHubController.name);

  constructor(
    private readonly githubService: GitHubService,
    private readonly databaseService: DatabaseService,
  ) {}

  @Get('user')
  @ApiOperation({ summary: 'Get authenticated GitHub user info' })
  @ApiResponse({ status: 200, description: 'GitHub user information' })
  @ApiResponse({ status: 400, description: 'User not connected to GitHub' })
  async getGitHubUser(@CurrentUser() user: any) {
    if (!user.githubAccessToken) {
      throw new BadRequestException('User not connected to GitHub');
    }

    return this.githubService.getAuthenticatedUser(user.githubAccessToken);
  }

  @Get('repositories')
  @ApiOperation({ summary: 'Get user repositories from GitHub' })
  @ApiQuery({ name: 'include_private', required: false, type: Boolean })
  @ApiResponse({ status: 200, description: 'List of repositories' })
  async getRepositories(
    @CurrentUser() user: any,
    @Query('include_private') includePrivate?: boolean,
  ) {
    return this.githubService.getUserRepositories(
      user.id,
      includePrivate !== false,
    );
  }

  @Get('installations')
  @ApiOperation({ summary: 'Get GitHub App installations for user' })
  @ApiResponse({ status: 200, description: 'List of GitHub App installations' })
  async getInstallations(@CurrentUser() user: any) {
    if (!user.githubAccessToken) {
      throw new BadRequestException('User not connected to GitHub');
    }

    return this.githubService.getUserInstallations(user.githubAccessToken);
  }

  @Get('installations/:installationId/repositories')
  @ApiOperation({ summary: 'Get repositories for a GitHub App installation' })
  @ApiResponse({
    status: 200,
    description: 'List of installation repositories',
  })
  async getInstallationRepositories(
    @Param('installationId') installationId: string,
  ) {
    const installationIdNum = parseInt(installationId, 10);
    if (isNaN(installationIdNum)) {
      throw new BadRequestException('Invalid installation ID');
    }

    return this.githubService.getInstallationRepositories(installationIdNum);
  }

  @Post('repositories/connect')
  @ApiOperation({ summary: 'Connect user to repositories' })
  @ApiQuery({
    name: 'repositories',
    description: 'Comma-separated list of repository full names',
  })
  @ApiResponse({
    status: 200,
    description: 'Repositories connected successfully',
  })
  async connectRepositories(
    @CurrentUser() user: any,
    @Query('repositories') repositoriesParam: string,
  ) {
    if (!repositoriesParam) {
      throw new BadRequestException('Repositories parameter is required');
    }

    const repositoryNames = repositoriesParam
      .split(',')
      .map((name) => name.trim());
    const results = [];

    for (const fullName of repositoryNames) {
      const parsed = parseRepositoryFullName(fullName);
      if (!parsed) {
        this.logger.warn(`Invalid repository name format: ${fullName}`);
        continue;
      }

      try {
        // Get repository details from GitHub
        const repo = await this.githubService.getRepository(
          parsed.owner,
          parsed.repo,
          user.githubAccessToken,
        );

        // Check if already connected
        const existing = await this.databaseService.userRepository.findUnique({
          where: {
            userId_githubId: {
              userId: user.id,
              githubId: repo.id.toString(),
            },
          },
        });

        if (existing) {
          // Update existing connection
          const updated = await this.databaseService.userRepository.update({
            where: { id: existing.id },
            data: {
              name: repo.name,
              fullName: repo.full_name,
              description: repo.description || '',
              url: repo.html_url,
              isPrivate: repo.private,
              isFork: repo.fork,
              ownerName: repo.owner.login,
              ownerAvatarUrl: repo.owner.avatar_url,
              ownerUrl: repo.owner.html_url,
              enabled: true,
              isActive: true,
              updatedAt: new Date(),
            },
          });

          results.push({
            repository: fullName,
            status: 'updated',
            id: updated.id,
          });
        } else {
          // Create new connection
          const created = await this.databaseService.userRepository.create({
            data: {
              userId: user.id,
              githubId: repo.id.toString(),
              name: repo.name,
              fullName: repo.full_name,
              description: repo.description || '',
              url: repo.html_url,
              isPrivate: repo.private,
              isFork: repo.fork,
              ownerName: repo.owner.login,
              ownerAvatarUrl: repo.owner.avatar_url,
              ownerUrl: repo.owner.html_url,
              enabled: true,
              isActive: true,
            },
          });

          results.push({
            repository: fullName,
            status: 'connected',
            id: created.id,
          });
        }

        this.logger.log(`Repository ${fullName} connected for user ${user.id}`);
      } catch (error) {
        this.logger.error(`Failed to connect repository ${fullName}:`, error);
        results.push({
          repository: fullName,
          status: 'error',
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return {
      message: `Processed ${repositoryNames.length} repositories`,
      results,
    };
  }

  @Get('repositories/connected')
  @ApiOperation({ summary: 'Get user connected repositories' })
  @ApiResponse({ status: 200, description: 'List of connected repositories' })
  async getConnectedRepositories(@CurrentUser() user: any) {
    const repositories = await this.databaseService.userRepository.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: 'desc' },
    });

    return repositories;
  }

  @Post('repositories/:repositoryId/toggle')
  @ApiOperation({ summary: 'Toggle repository enabled status' })
  @ApiResponse({ status: 200, description: 'Repository status updated' })
  async toggleRepository(
    @CurrentUser() user: any,
    @Param('repositoryId') repositoryId: string,
  ) {
    const repository = await this.databaseService.userRepository.findFirst({
      where: {
        id: repositoryId,
        userId: user.id,
      },
    });

    if (!repository) {
      throw new BadRequestException(
        'Repository not found or not owned by user',
      );
    }

    const updated = await this.databaseService.userRepository.update({
      where: { id: repositoryId },
      data: {
        enabled: !repository.enabled,
        updatedAt: new Date(),
      },
    });

    return {
      message: `Repository ${updated.enabled ? 'enabled' : 'disabled'}`,
      repository: updated,
    };
  }

  @Get('repository/:owner/:repo/pulls')
  @ApiOperation({ summary: 'Get pull requests for a repository' })
  @ApiQuery({ name: 'state', required: false, enum: ['open', 'closed', 'all'] })
  @ApiResponse({ status: 200, description: 'List of pull requests' })
  async getPullRequests(
    @CurrentUser() user: any,
    @Param('owner') owner: string,
    @Param('repo') repo: string,
    @Query('state') state?: 'open' | 'closed' | 'all',
  ) {
    return this.githubService.getPullRequests(
      owner,
      repo,
      state || 'all',
      user.githubAccessToken,
    );
  }

  @Get('repository/:owner/:repo/issues')
  @ApiOperation({ summary: 'Get issues for a repository' })
  @ApiQuery({ name: 'state', required: false, enum: ['open', 'closed', 'all'] })
  @ApiResponse({ status: 200, description: 'List of issues' })
  async getIssues(
    @CurrentUser() user: any,
    @Param('owner') owner: string,
    @Param('repo') repo: string,
    @Query('state') state?: 'open' | 'closed' | 'all',
  ) {
    return this.githubService.getIssues(
      owner,
      repo,
      state || 'all',
      user.githubAccessToken,
    );
  }

  @Get('test-connection')
  @ApiOperation({ summary: 'Test GitHub API connection' })
  @ApiResponse({ status: 200, description: 'Connection test result' })
  async testConnection(@CurrentUser() user: any) {
    if (!user.githubAccessToken) {
      return { connected: false, message: 'User not connected to GitHub' };
    }

    const isConnected = await this.githubService.testConnection(
      user.githubAccessToken,
    );

    return {
      connected: isConnected,
      message: isConnected
        ? 'GitHub connection successful'
        : 'GitHub connection failed',
    };
  }
}
