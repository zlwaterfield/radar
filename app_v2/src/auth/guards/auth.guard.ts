import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthService as BetterAuthService } from '@thallesp/nestjs-better-auth';

@Injectable()
export class AuthGuard implements CanActivate {
  private readonly logger = new Logger(AuthGuard.name);

  constructor(
    private readonly betterAuthService: BetterAuthService<
      typeof import('../auth.config').auth
    >,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Check if route is marked as public
    const isPublic = this.reflector.get<boolean>(
      'isPublic',
      context.getHandler(),
    );
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();

    try {
      // Use Better Auth to validate session
      const session = await this.betterAuthService.api.getSession({
        headers: request.headers,
      });

      if (session) {
        request.user = session.user;
        request.session = session.session;
        return true;
      }

      throw new UnauthorizedException('Authentication required');
    } catch (error) {
      this.logger.debug('Authentication failed:', error instanceof Error ? error.message : String(error));
      throw new UnauthorizedException('Invalid authentication');
    }
  }
}
