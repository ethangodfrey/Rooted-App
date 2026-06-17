import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';

import { PrismaService } from '../../prisma/prisma.service';
import type { AppRole, AuthenticatedUser } from './auth.types';

const APP_ROLES: AppRole[] = ['shopper', 'vendor', 'admin'];

/**
 * Verifies the Supabase access token (Authorization: Bearer <jwt>).
 *
 * Newer Supabase projects sign access tokens ES256 and publish keys at
 * `{SUPABASE_URL}/auth/v1/.well-known/jwks.json`. Legacy projects use HS256
 * with SUPABASE_JWT_SECRET — we still support that as a fallback.
 */
@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  private readonly logger = new Logger(SupabaseAuthGuard.name);
  private readonly secret: Uint8Array;
  private readonly jwks: ReturnType<typeof createRemoteJWKSet> | null;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const secret = this.config.get<string>('SUPABASE_JWT_SECRET', '');
    this.secret = new TextEncoder().encode(secret);

    const supabaseUrl = this.config.get<string>('SUPABASE_URL', '').replace(/\/$/, '');
    this.jwks = supabaseUrl
      ? createRemoteJWKSet(new URL(`${supabaseUrl}/auth/v1/.well-known/jwks.json`))
      : null;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const header: string | undefined = request.headers?.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice(7).trim() : undefined;

    if (!token) {
      throw new UnauthorizedException('Missing bearer token.');
    }

    const payload = await this.verifyToken(token);
    const user = await this.resolveUser(payload);
    if (!user) {
      throw new UnauthorizedException('User not found or has no app role.');
    }

    request.user = user;
    return true;
  }

  private async verifyToken(token: string): Promise<JWTPayload> {
    if (!this.jwks && this.secret.length === 0) {
      throw new UnauthorizedException(
        'SUPABASE_URL or SUPABASE_JWT_SECRET must be configured for auth.',
      );
    }

    const failures: string[] = [];

    if (this.jwks) {
      try {
        const { payload } = await jwtVerify(token, this.jwks);
        return payload;
      } catch (err) {
        failures.push(`jwks: ${(err as Error).message}`);
      }
    }

    if (this.secret.length > 0) {
      try {
        const { payload } = await jwtVerify(token, this.secret, {
          algorithms: ['HS256'],
        });
        return payload;
      } catch (err) {
        failures.push(`hs256: ${(err as Error).message}`);
      }
    }

    this.logger.debug(`JWT verification failed: ${failures.join(' | ')}`);
    throw new UnauthorizedException('Invalid or expired token.');
  }

  private async resolveUser(payload: JWTPayload): Promise<AuthenticatedUser | null> {
    const id = payload.sub;
    if (!id) return null;

    const dbUser = await this.prisma.user.findUnique({
      where: { id },
      select: { role: true, email: true },
    });
    if (!dbUser || !APP_ROLES.includes(dbUser.role as AppRole)) {
      return null;
    }
    const role = dbUser.role as AppRole;

    let vendorId: string | undefined;
    if (role === 'vendor') {
      const vendor = await this.prisma.vendor.findFirst({
        where: { userId: id },
        select: { id: true },
      });
      vendorId = vendor?.id;
    }

    return {
      id,
      role,
      vendorId,
      email: dbUser.email ?? (typeof payload.email === 'string' ? payload.email : undefined),
    };
  }
}
