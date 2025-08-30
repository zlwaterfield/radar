import {
  Controller,
  Get,
  Post,
  All,
  Req,
  Res,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { AuthService as BetterAuthService } from '@thallesp/nestjs-better-auth';
import { AuthService } from '../services/auth.service';
import { AuthGuard } from '../guards/auth.guard';
import { Public } from '../decorators/public.decorator';
import { CurrentUser } from '../decorators/user.decorator';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly authService: AuthService,
    private readonly betterAuthService: BetterAuthService<
      typeof import('../auth.config').auth
    >,
  ) {}

  /**
   * Handle all Better Auth routes
   */
  @Public()
  @All('*')
  @ApiOperation({ summary: 'Handle Better Auth requests' })
  async handleAuth(@Req() req: Request, @Res() res: Response) {
    // The Better Auth NestJS plugin should handle this routing automatically
    // For now, return a placeholder response
    return res.status(404).json({ message: 'Better Auth route not found' });
  }

  @Get('session')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Get current user session' })
  @ApiResponse({ status: 200, description: 'Current user session information' })
  async getCurrentUser(@CurrentUser() user: any) {
    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        emailVerified: user.emailVerified,
        image: user.image,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    };
  }
}
