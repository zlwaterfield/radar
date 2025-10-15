import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { EntitlementsService } from '../services/entitlements.service';
import { REQUIRED_FEATURE_KEY } from '../decorators/require-feature.decorator';

@Injectable()
export class EntitlementGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private entitlementsService: EntitlementsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredFeature = this.reflector.get<string>(
      REQUIRED_FEATURE_KEY,
      context.getHandler(),
    );

    if (!requiredFeature) {
      return true; // No feature requirement
    }

    const request = context.switchToHttp().getRequest();
    const userId = request.user?.id;

    if (!userId) {
      throw new ForbiddenException('User not authenticated');
    }

    const hasFeature = await this.entitlementsService.hasFeature(
      userId,
      requiredFeature,
    );

    if (!hasFeature) {
      throw new ForbiddenException(
        `Feature '${requiredFeature}' not available on your plan. Please upgrade.`,
      );
    }

    return true;
  }
}
