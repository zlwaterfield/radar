import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  BadRequestException,
} from '@nestjs/common';
import { AuthGuard } from '../auth/guards/auth.guard';
import { DigestConfigService } from './digest-config.service';
import { DigestService } from './digest.service';
import {
  CreateDigestConfigDto,
  UpdateDigestConfigDto,
} from '../common/dtos/digest-config.dto';

@Controller('digest-configs')
@UseGuards(AuthGuard)
export class DigestConfigController {
  constructor(
    private readonly digestConfigService: DigestConfigService,
    private readonly digestService: DigestService,
  ) {}

  /**
   * Get all digest configurations for the current user
   */
  @Get()
  async getUserDigestConfigs(@Request() req: any) {
    return this.digestConfigService.getUserDigestConfigs(req.user.id);
  }

  /**
   * Get a specific digest configuration
   */
  @Get(':configId')
  async getDigestConfig(
    @Param('configId') configId: string,
    @Request() req: any,
  ) {
    return this.digestConfigService.getDigestConfig(configId, req.user.id);
  }

  /**
   * Create a new digest configuration
   */
  @Post()
  async createDigestConfig(
    @Body() createDigestConfigDto: CreateDigestConfigDto,
    @Request() req: any,
  ) {
    return this.digestConfigService.createDigestConfig(
      req.user.id,
      createDigestConfigDto,
    );
  }

  /**
   * Update a digest configuration
   */
  @Put(':configId')
  async updateDigestConfig(
    @Param('configId') configId: string,
    @Body() updateDigestConfigDto: UpdateDigestConfigDto,
    @Request() req: any,
  ) {
    return this.digestConfigService.updateDigestConfig(
      configId,
      req.user.id,
      updateDigestConfigDto,
    );
  }

  /**
   * Delete a digest configuration
   */
  @Delete(':configId')
  async deleteDigestConfig(
    @Param('configId') configId: string,
    @Request() req: any,
  ) {
    await this.digestConfigService.deleteDigestConfig(configId, req.user.id);
    return {
      success: true,
      message: 'Digest configuration deleted successfully',
    };
  }

  /**
   * Preview what a digest would look like for a specific configuration
   */
  @Post(':configId/preview')
  async previewDigest(
    @Param('configId') configId: string,
    @Request() req: any,
  ) {
    try {
      const executionData =
        await this.digestConfigService.getDigestExecutionData(configId);

      // Verify this config belongs to the current user
      if (executionData.userId !== req.user.id) {
        throw new BadRequestException('Access denied');
      }

      const digest =
        await this.digestService.generateDigestForConfig(executionData);

      return {
        success: true,
        digest: {
          waitingOnUser: digest.waitingOnUser.length,
          approvedReadyToMerge: digest.approvedReadyToMerge.length,
          userOpenPRs: digest.userOpenPRs.length,
          details: {
            waitingOnUser: digest.waitingOnUser.slice(0, 3).map((pr) => ({
              title: pr.title,
              url: pr.html_url,
              repo: pr.base.repo.full_name,
            })),
            approvedReadyToMerge: digest.approvedReadyToMerge
              .slice(0, 3)
              .map((pr) => ({
                title: pr.title,
                url: pr.html_url,
                repo: pr.base.repo.full_name,
              })),
            userOpenPRs: digest.userOpenPRs.slice(0, 3).map((pr) => ({
              title: pr.title,
              url: pr.html_url,
              repo: pr.base.repo.full_name,
            })),
          },
        },
      };
    } catch (error) {
      if (error.message === 'GITHUB_TOKEN_INVALID') {
        return {
          success: false,
          error:
            'GitHub token expired. Please reconnect your GitHub account in settings.',
          requiresReauth: true,
        };
      }

      return {
        success: false,
        error: error.message || 'Failed to generate digest preview',
      };
    }
  }

  /**
   * Send a test digest for a specific configuration
   */
  @Post(':configId/test')
  async sendTestDigest(
    @Param('configId') configId: string,
    @Request() req: any,
  ) {
    try {
      const executionData =
        await this.digestConfigService.getDigestExecutionData(configId);

      // Verify this config belongs to the current user
      if (executionData.userId !== req.user.id) {
        throw new BadRequestException('Access denied');
      }

      const digest =
        await this.digestService.generateDigestForConfig(executionData);
      const sent = await this.digestService.sendDigestForConfig(
        executionData,
        digest,
      );

      return {
        success: sent,
        message: sent
          ? 'Test digest sent successfully'
          : 'Failed to send test digest',
        digest: {
          waitingOnUser: digest.waitingOnUser.length,
          approvedReadyToMerge: digest.approvedReadyToMerge.length,
          userOpenPRs: digest.userOpenPRs.length,
        },
      };
    } catch (error) {
      if (error.message === 'GITHUB_TOKEN_INVALID') {
        return {
          success: false,
          error:
            'GitHub token expired. Please reconnect your GitHub account in settings.',
          requiresReauth: true,
        };
      }

      return {
        success: false,
        error: error.message || 'Failed to send test digest',
      };
    }
  }
}
