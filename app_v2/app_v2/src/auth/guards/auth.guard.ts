import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthService } from '../services/auth.service';
import { TokenService } from '../services/token.service';

@Injectable()
export class AuthGuard implements CanActivate {
  private readonly logger = new Logger(AuthGuard.name);

  constructor(
    private readonly authService: AuthService,
    private readonly tokenService: TokenService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Check if route is marked as public
    const isPublic = this.reflector.get<boolean>('isPublic', context.getHandler());
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    
    try {
      // Try session-based authentication first (Better Auth)
      const sessionId = this.extractSessionFromCookies(request);
      if (sessionId) {
        const session = await this.authService.validateSession(sessionId);
        if (session) {
          request.user = session.user;
          request.session = session;
          return true;
        }
      }

      // Fallback to JWT token authentication
      const token = this.extractTokenFromHeader(request);
      if (token) {
        const payload = this.tokenService.verifyApiToken(token);
        if (payload) {
          const user = await this.authService.getUserWithTokens(payload.sub);
          if (user) {
            request.user = user;
            return true;
          }
        }
      }

      throw new UnauthorizedException('Authentication required');
    } catch (error) {
      this.logger.debug('Authentication failed:', error.message);
      throw new UnauthorizedException('Invalid authentication');
    }
  }

  private extractSessionFromCookies(request: any): string | null {
    const cookies = request.cookies;
    if (!cookies) return null;

    // Look for Better Auth session cookie
    const sessionCookie = cookies['radar-auth.session_token'] || cookies['session_token'];
    return sessionCookie || null;
  }

  private extractTokenFromHeader(request: any): string | null {
    const authorization = request.headers.authorization;
    if (!authorization) return null;

    const [type, token] = authorization.split(' ');
    return type === 'Bearer' ? token : null;
  }
}