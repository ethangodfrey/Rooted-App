import { createParamDecorator, SetMetadata, type ExecutionContext } from '@nestjs/common';

import type { AppRole, AuthenticatedUser } from './auth.types';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: AppRole[]) => SetMetadata(ROLES_KEY, roles);

/** Injects the authenticated user resolved by SupabaseAuthGuard. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const request = ctx.switchToHttp().getRequest();
    return request.user as AuthenticatedUser;
  },
);
