import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

import type { AuthenticatedUser } from './auth.types';

/**
 * Ensures the authenticated principal has role `admin`.
 * Use after SupabaseAuthGuard so `request.user` is populated.
 * Telemetry contract: ADMIN_ROLE_REQUIRED on reject.
 */
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUser | undefined;
    if (!isAdminUser(user)) {
      throw new ForbiddenException('ADMIN_ROLE_REQUIRED');
    }
    return true;
  }
}

/** Pure helper for guards + verify scripts. */
export function isAdminUser(
  user: Pick<AuthenticatedUser, 'role'> | null | undefined,
): boolean {
  return (user?.role ?? '').toLowerCase() === 'admin';
}
