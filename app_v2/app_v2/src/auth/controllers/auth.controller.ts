import {
  Controller,
  Get,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
  Logger,
  HttpStatus,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { AuthService as BetterAuthService } from '@thallesp/nestjs-better-auth';
import { AuthService } from '../services/auth.service';
import { TokenService } from '../services/token.service';
import { AuthGuard } from '../guards/auth.guard';
import { Public } from '../decorators/public.decorator';
import { CurrentUser } from '../decorators/user.decorator';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly authService: AuthService,
    private readonly tokenService: TokenService,
    private readonly configService: ConfigService,
    private readonly betterAuthService: BetterAuthService<typeof import('../auth.config').auth>,
  ) {}

  /**
   * Handle all Better Auth routes
   */
  @Public()
  @Get('*')
  @Post('*')
  @ApiOperation({ summary: 'Handle Better Auth requests' })
  async handleAuth(@Req() req: Request, @Res() res: Response) {
    // Use Better Auth service to handle requests
    // Note: The exact API may vary - this is a placeholder for proper Better Auth integration
    return res.status(501).json({ message: 'Better Auth integration pending' });
  }

  @Public()
  @Get('slack/login')
  @ApiOperation({ summary: 'Initiate Slack OAuth flow' })
  @ApiResponse({ status: 302, description: 'Redirect to Slack OAuth' })
  async slackLogin(@Query('user_id') userId?: string, @Res() res?: Response) {
    try {
      const auth = this.authService.getAuth();
      const state = userId ? this.tokenService.generateStateToken({ userId }) : undefined;
      
      // Generate Slack OAuth URL
      const params = new URLSearchParams({
        client_id: this.configService.get('slack.clientId')!,
        scope: [
          'chat:write',
          'chat:write.public',
          'commands',
          'users:read',
          'users:read.email',
          'team:read',
          'im:history',
          'im:read',
          'im:write',
          'app_mentions:read',
        ].join(','),
        redirect_uri: `${this.configService.get('app.callbackHost')}/api/auth/callback/slack`,
        ...(state && { state }),
      });

      const authUrl = `https://slack.com/oauth/v2/authorize?${params.toString()}`;
      
      return res?.redirect(authUrl);
    } catch (error) {
      this.logger.error('Slack login error:', error);
      throw new InternalServerErrorException('Failed to initiate Slack login');
    }
  }

  @Public()
  @Get('github/login')
  @ApiOperation({ summary: 'Initiate GitHub OAuth flow' })
  @ApiResponse({ status: 302, description: 'Redirect to GitHub OAuth' })
  async githubLogin(
    @Query('user_id') userId: string,
    @Query('reconnect') reconnect?: boolean,
    @Res() res?: Response,
  ) {
    if (!userId) {
      throw new BadRequestException('User ID is required for GitHub login');
    }

    try {
      const state = this.tokenService.generateStateToken({ userId, reconnect });
      
      const params = new URLSearchParams({
        client_id: this.configService.get('github.clientId')!,
        redirect_uri: `${this.configService.get('app.callbackHost')}/api/auth/callback/github`,
        state,
        scope: 'user:email read:user repo read:org',
      });

      const authUrl = `https://github.com/login/oauth/authorize?${params.toString()}`;
      
      return res?.redirect(authUrl);
    } catch (error) {
      this.logger.error('GitHub login error:', error);
      throw new InternalServerErrorException('Failed to initiate GitHub login');
    }
  }

  @Public()
  @Get('callback/slack')
  @ApiOperation({ summary: 'Handle Slack OAuth callback' })
  async slackCallback(
    @Query('code') code: string,
    @Query('state') state?: string,
    @Query('error') error?: string,
    @Res() res?: Response,
  ) {
    if (error) {
      this.logger.error(`Slack OAuth error: ${error}`);
      return res?.redirect(`${this.configService.get('app.frontendUrl')}/auth/error?provider=slack&error=${error}`);
    }

    if (!code) {
      throw new BadRequestException('Authorization code is required');
    }

    try {
      // Exchange code for tokens
      const tokenResponse = await fetch('https://slack.com/api/oauth.v2.access', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: this.configService.get('slack.clientId')!,
          client_secret: this.configService.get('slack.clientSecret')!,
          code,
        }),
      });

      const tokens = await tokenResponse.json();
      
      if (!tokens.ok) {
        throw new Error(tokens.error || 'Failed to exchange code for tokens');
      }

      // Create or update user with Slack OAuth data
      const user = await this.authService.createOrUpdateUser({
        providerId: 'slack',
        accountId: tokens.authed_user.id,
        email: tokens.authed_user.email,
        name: tokens.authed_user.name,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
      });

      // Create JWT token for API access
      const apiToken = this.tokenService.createApiToken({
        userId: user.id,
        provider: 'slack',
      });

      const frontendUrl = `${this.configService.get('app.frontendUrl')}/auth/success?provider=slack&token=${apiToken}`;
      return res?.redirect(frontendUrl);
    } catch (error) {
      this.logger.error('Slack callback error:', error);
      return res?.redirect(
        `${this.configService.get('app.frontendUrl')}/auth/error?provider=slack&error=${encodeURIComponent(error.message)}`
      );
    }
  }

  @Public()
  @Get('callback/github')
  @ApiOperation({ summary: 'Handle GitHub OAuth callback' })
  async githubCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') error?: string,
    @Res() res?: Response,
  ) {
    if (error) {
      this.logger.error(`GitHub OAuth error: ${error}`);
      return res?.redirect(`${this.configService.get('app.frontendUrl')}/auth/error?provider=github&error=${error}`);
    }

    if (!code || !state) {
      throw new BadRequestException('Authorization code and state are required');
    }

    try {
      const stateData = this.tokenService.verifyStateToken(state);
      if (!stateData?.userId) {
        throw new BadRequestException('Invalid state parameter');
      }

      // Exchange code for tokens
      const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: this.configService.get('github.clientId')!,
          client_secret: this.configService.get('github.clientSecret')!,
          code,
        }),
      });

      const tokens = await tokenResponse.json();
      
      if (tokens.error) {
        throw new Error(tokens.error_description || tokens.error);
      }

      // Get user info from GitHub
      const userResponse = await fetch('https://api.github.com/user', {
        headers: {
          'Authorization': `Bearer ${tokens.access_token}`,
          'Accept': 'application/vnd.github.v3+json',
        },
      });

      const githubUser = await userResponse.json();

      // Create or update user with GitHub OAuth data
      const user = await this.authService.createOrUpdateUser({
        providerId: 'github',
        accountId: githubUser.id.toString(),
        email: githubUser.email,
        name: githubUser.name || githubUser.login,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
      });

      // Create JWT token for API access
      const apiToken = this.tokenService.createApiToken({
        userId: user.id,
        provider: 'github',
      });

      const frontendUrl = `${this.configService.get('app.frontendUrl')}/auth/success?provider=github&token=${apiToken}`;
      return res?.redirect(frontendUrl);
    } catch (error) {
      this.logger.error('GitHub callback error:', error);
      return res?.redirect(
        `${this.configService.get('app.frontendUrl')}/auth/error?provider=github&error=${encodeURIComponent(error.message)}`
      );
    }
  }

  @Post('validate')
  @ApiOperation({ summary: 'Validate authentication token' })
  @ApiResponse({ status: 200, description: 'Token is valid' })
  @ApiResponse({ status: 401, description: 'Invalid token' })
  async validateToken(@Req() req: Request) {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      throw new BadRequestException('Token is required');
    }

    const payload = this.tokenService.verifyApiToken(token);
    if (!payload) {
      throw new BadRequestException('Invalid token');
    }

    const user = await this.authService.getUserWithTokens(payload.sub);
    if (!user) {
      throw new BadRequestException('User not found');
    }

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        slackId: user.slackId,
        githubId: user.githubId,
        githubLogin: user.githubLogin,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
      tokenInfo: {
        type: payload.type,
        provider: payload.provider,
        expiresAt: payload.exp,
      },
    };
  }

  @Get('me')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Get current user' })
  @ApiResponse({ status: 200, description: 'Current user information' })
  async getCurrentUser(@CurrentUser() user: any) {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      slackId: user.slackId,
      githubId: user.githubId,
      githubLogin: user.githubLogin,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  @Post('logout')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Sign out user' })
  @ApiResponse({ status: 200, description: 'Successfully signed out' })
  async logout(@CurrentUser() user: any) {
    await this.authService.signOut(user.id);
    return { message: 'Successfully signed out' };
  }
}