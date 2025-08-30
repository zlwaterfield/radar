import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const { method, url, ip } = request;
    const userAgent = request.get('User-Agent') || '';
    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        next: (data) => {
          const { statusCode } = response;
          const contentLength = response.get('content-length') || 0;
          const responseTime = Date.now() - startTime;

          // Only log successful requests in production, all requests in development
          if (statusCode < 400 || process.env.NODE_ENV === 'development') {
            this.logger.log(
              `${method} ${url} ${statusCode} ${contentLength} - ${userAgent} ${ip} +${responseTime}ms`
            );
          }
        },
        error: (error) => {
          const responseTime = Date.now() - startTime;
          this.logger.error(
            `${method} ${url} ${error?.status || 500} - ${userAgent} ${ip} +${responseTime}ms`,
            error?.stack
          );
        },
      })
    );
  }
}