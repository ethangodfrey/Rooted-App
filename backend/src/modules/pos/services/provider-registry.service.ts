import { BadRequestException, Injectable } from '@nestjs/common';
import type { PosProvider } from '@prisma/client';

import { CloverAdapter } from '../adapters/clover/clover.adapter';
import type { PosProviderAdapter } from '../adapters/provider-adapter.interface';
import { SquareAdapter } from '../adapters/square/square.adapter';
import { ToastAdapter } from '../adapters/toast/toast.adapter';

/** Resolves the correct provider adapter for a given PosProvider. */
@Injectable()
export class ProviderRegistryService {
  private readonly adapters: Map<PosProvider, PosProviderAdapter>;

  constructor(
    square: SquareAdapter,
    toast: ToastAdapter,
    clover: CloverAdapter,
  ) {
    this.adapters = new Map<PosProvider, PosProviderAdapter>([
      [square.provider, square],
      [toast.provider, toast],
      [clover.provider, clover],
    ]);
  }

  get(provider: PosProvider): PosProviderAdapter {
    const adapter = this.adapters.get(provider);
    if (!adapter) {
      throw new BadRequestException(`Unsupported POS provider: ${provider}`);
    }
    return adapter;
  }

  list(): PosProviderAdapter[] {
    return [...this.adapters.values()];
  }
}
