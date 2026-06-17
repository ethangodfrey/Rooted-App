import { UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { createRemoteJWKSet, jwtVerify } from 'jose';

import type { PrismaService } from '../../prisma/prisma.service';
import { SupabaseAuthGuard } from './supabase-auth.guard';

jest.mock('jose', () => ({
  jwtVerify: jest.fn(),
  createRemoteJWKSet: jest.fn(() => 'mock-jwks'),
}));

const mockedVerify = jwtVerify as jest.MockedFunction<typeof jwtVerify>;
const mockedJwks = createRemoteJWKSet as jest.MockedFunction<typeof createRemoteJWKSet>;

function config(values: Record<string, string> = { SUPABASE_JWT_SECRET: 'super-secret' }): ConfigService {
  return {
    get: (k: string, def?: string) => (k in values ? values[k] : def),
  } as unknown as ConfigService;
}

function contextWithAuth(authorization?: string): { ctx: ExecutionContext; req: any } {
  const req: any = { headers: authorization ? { authorization } : {} };
  const ctx = {
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
  return { ctx, req };
}

describe('SupabaseAuthGuard', () => {
  beforeEach(() => {
    mockedVerify.mockReset();
    mockedJwks.mockClear();
  });

  it('verifies the JWT and resolves a vendor user with vendorId', async () => {
    mockedVerify.mockResolvedValue({ payload: { sub: 'user-1', email: 'v@shop.com' } } as never);
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue({ role: 'vendor', email: 'v@shop.com' }) },
      vendor: { findFirst: jest.fn().mockResolvedValue({ id: 'vendor-9' }) },
    } as unknown as PrismaService;

    const guard = new SupabaseAuthGuard(config(), prisma);
    const { ctx, req } = contextWithAuth('Bearer good.jwt.token');

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(req.user).toEqual({
      id: 'user-1',
      role: 'vendor',
      vendorId: 'vendor-9',
      email: 'v@shop.com',
    });
  });

  it('uses JWKS when SUPABASE_URL is configured', async () => {
    mockedVerify.mockResolvedValue({ payload: { sub: 'user-1' } } as never);
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue({ role: 'vendor', email: null }) },
      vendor: { findFirst: jest.fn().mockResolvedValue({ id: 'vendor-9' }) },
    } as unknown as PrismaService;

    const guard = new SupabaseAuthGuard(
      config({ SUPABASE_URL: 'https://proj.supabase.co', SUPABASE_JWT_SECRET: '' }),
      prisma,
    );
    const { ctx } = contextWithAuth('Bearer es256.jwt.token');

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(mockedJwks).toHaveBeenCalled();
    expect(mockedVerify).toHaveBeenCalledWith('es256.jwt.token', 'mock-jwks');
  });

  it('rejects a missing bearer token', async () => {
    const guard = new SupabaseAuthGuard(config(), {} as unknown as PrismaService);
    const { ctx } = contextWithAuth();
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(mockedVerify).not.toHaveBeenCalled();
  });

  it('falls back to HS256 when JWKS verification fails', async () => {
    mockedVerify
      .mockRejectedValueOnce(new Error('"alg" (Algorithm) Header Parameter value not allowed'))
      .mockResolvedValueOnce({ payload: { sub: 'user-1' } } as never);
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue({ role: 'vendor', email: null }) },
      vendor: { findFirst: jest.fn().mockResolvedValue({ id: 'vendor-9' }) },
    } as unknown as PrismaService;

    const guard = new SupabaseAuthGuard(
      config({ SUPABASE_URL: 'https://proj.supabase.co', SUPABASE_JWT_SECRET: 'super-secret' }),
      prisma,
    );
    const { ctx } = contextWithAuth('Bearer hs256.jwt.token');

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(mockedVerify).toHaveBeenCalledTimes(2);
  });

  it('rejects an invalid/expired token', async () => {
    mockedVerify.mockRejectedValue(new Error('signature verification failed'));
    const guard = new SupabaseAuthGuard(config(), {} as unknown as PrismaService);
    const { ctx } = contextWithAuth('Bearer bad.jwt.token');
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects when the user has no recognized app role', async () => {
    mockedVerify.mockResolvedValue({ payload: { sub: 'user-3' } } as never);
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue({ role: 'banned', email: null }) },
      vendor: { findFirst: jest.fn() },
    } as unknown as PrismaService;
    const guard = new SupabaseAuthGuard(config(), prisma);
    const { ctx } = contextWithAuth('Bearer good.jwt.token');
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects when neither SUPABASE_URL nor SUPABASE_JWT_SECRET is configured', async () => {
    const guard = new SupabaseAuthGuard(config({ SUPABASE_JWT_SECRET: '' }), {} as unknown as PrismaService);
    const { ctx } = contextWithAuth('Bearer good.jwt.token');
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(mockedVerify).not.toHaveBeenCalled();
  });
});
