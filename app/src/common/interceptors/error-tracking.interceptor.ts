import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  HttpException,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { AnalyticsService } from '../../analytics/analytics.service';

@Injectable()
export class ErrorTrackingInterceptor implements NestInterceptor {
  constructor(private readonly analyticsService: AnalyticsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const userId = this.extractUserId(request);

    return next.handle().pipe(
      catchError((error) => {
        this.analyticsService.trackError(userId || 'anonymous', error, {
          method: request.method,
          url: request.url,
          userAgent: request.headers['user-agent'],
          ip: request.ip,
          timestamp: new Date().toISOString(),
        });

        // Re-throw the error to maintain normal error handling flow
        return throwError(() => error);
      }),
    );
  }

  private extractUserId(request: any): string | null {
    // Try to extract user ID from various sources
    if (request.user?.id) {
      return request.user.id;
    }

    if (request.headers['x-user-id']) {
      return request.headers['x-user-id'];
    }

    // Could also extract from JWT token if available
    return null;
  }
}
