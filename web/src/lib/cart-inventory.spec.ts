import { beforeEach, describe, expect, it, vi } from 'vitest';

import { validateCartInventory } from './cart-inventory';

const mockIn = vi.fn();
const mockEq = vi.fn();
const mockSelect = vi.fn();
const mockFrom = vi.fn();

function createAwaitableQuery(result: { data: unknown; error: { message: string } | null }) {
  const query = {
    eq: mockEq,
    in: mockIn,
    then(
      onFulfilled: (value: typeof result) => unknown,
      onRejected?: (reason: unknown) => unknown,
    ) {
      return Promise.resolve(result).then(onFulfilled, onRejected);
    },
  };
  mockEq.mockReturnValue(query);
  mockIn.mockReturnValue(query);
  return query;
}

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

describe('validateCartInventory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const query = createAwaitableQuery({ data: [], error: null });
    mockSelect.mockReturnValue({ eq: mockEq });
    mockEq.mockReturnValue({ in: mockIn });
    mockIn.mockReturnValue(query);
    mockFrom.mockReturnValue({ select: mockSelect });
  });

  it('rejects an empty cart', async () => {
    const result = await validateCartInventory('market-1', []);

    expect(result).toEqual({
      valid: false,
      issues: [{ productId: '', error: 'Cart is empty' }],
    });
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('returns valid when all line quantities are within presale caps', async () => {
    mockIn.mockReturnValue(
      createAwaitableQuery({
        data: [
          {
            product_id: 'prod-1',
            available_quantity_presale: 10,
            reserved_quantity: 2,
          },
          {
            product_id: 'prod-2',
            available_quantity_presale: 5,
            reserved_quantity: 0,
          },
        ],
        error: null,
      }),
    );

    const result = await validateCartInventory('market-1', [
      { productId: 'prod-1', quantity: 8, name: 'Eggs' },
      { productId: 'prod-2', quantity: 5, name: 'Honey' },
    ]);

    expect(result).toEqual({ valid: true, issues: [] });
  });

  it('flags products not listed for the selected market', async () => {
    mockIn.mockReturnValue(
      createAwaitableQuery({
        data: [
          {
            product_id: 'prod-1',
            available_quantity_presale: 10,
            reserved_quantity: 0,
          },
        ],
        error: null,
      }),
    );

    const result = await validateCartInventory('market-1', [
      { productId: 'prod-1', quantity: 1, name: 'Eggs' },
      { productId: 'prod-missing', quantity: 1, name: 'Jam' },
    ]);

    expect(result.valid).toBe(false);
    expect(result.issues).toEqual([
      {
        productId: 'prod-missing',
        productName: 'Jam',
        error: 'Not listed for this market',
      },
    ]);
  });

  it('flags quantities above available presale stock', async () => {
    mockIn.mockReturnValue(
      createAwaitableQuery({
        data: [
          {
            product_id: 'prod-1',
            available_quantity_presale: 5,
            reserved_quantity: 3,
          },
        ],
        error: null,
      }),
    );

    const result = await validateCartInventory('market-1', [
      { productId: 'prod-1', quantity: 3, name: 'Eggs' },
    ]);

    expect(result).toEqual({
      valid: false,
      issues: [
        {
          productId: 'prod-1',
          productName: 'Eggs',
          error: 'Only 2 available',
          maxQuantity: 2,
        },
      ],
    });
  });

  it('reports out-of-stock when no presale units remain', async () => {
    mockIn.mockReturnValue(
      createAwaitableQuery({
        data: [
          {
            product_id: 'prod-1',
            available_quantity_presale: 4,
            reserved_quantity: 4,
          },
        ],
        error: null,
      }),
    );

    const result = await validateCartInventory('market-1', [
      { productId: 'prod-1', quantity: 1, name: 'Eggs' },
    ]);

    expect(result.issues[0]).toMatchObject({
      error: 'Out of presale stock',
      maxQuantity: 0,
    });
  });

  it('surfaces Supabase query errors', async () => {
    mockIn.mockReturnValue(
      createAwaitableQuery({
        data: null,
        error: { message: 'permission denied' },
      }),
    );

    const result = await validateCartInventory('market-1', [
      { productId: 'prod-1', quantity: 1 },
    ]);

    expect(result).toEqual({
      valid: false,
      issues: [{ productId: '', error: 'permission denied' }],
    });
  });
});
