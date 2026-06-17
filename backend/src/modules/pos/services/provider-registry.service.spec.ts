import { BadRequestException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { PosProvider } from '@prisma/client';

import { CloverAdapter } from '../adapters/clover/clover.adapter';
import { SquareAdapter } from '../adapters/square/square.adapter';
import { ToastAdapter } from '../adapters/toast/toast.adapter';
import { ProviderRegistryService } from './provider-registry.service';

function fakeConfig(): ConfigService {
  return { get: (_key: string, def?: string) => def } as unknown as ConfigService;
}

describe('ProviderRegistryService', () => {
  const config = fakeConfig();
  const square = new SquareAdapter(config);
  const toast = new ToastAdapter(config);
  const clover = new CloverAdapter(config);
  const registry = new ProviderRegistryService(square, toast, clover);

  it('resolves each provider to its adapter', () => {
    expect(registry.get('SQUARE')).toBe(square);
    expect(registry.get('TOAST')).toBe(toast);
    expect(registry.get('CLOVER')).toBe(clover);
  });

  it('exposes the correct auth type per provider', () => {
    expect(registry.get('SQUARE').authType).toBe('OAUTH');
    expect(registry.get('CLOVER').authType).toBe('OAUTH');
    expect(registry.get('TOAST').authType).toBe('API_KEY');
  });

  it('throws on an unknown provider', () => {
    expect(() => registry.get('VENMO' as PosProvider)).toThrow(BadRequestException);
  });

  it('lists all registered adapters', () => {
    expect(registry.list()).toHaveLength(3);
  });
});
