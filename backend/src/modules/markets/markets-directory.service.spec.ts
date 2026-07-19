import { MarketsDirectoryService } from './markets-directory.service';

describe('MarketsDirectoryService', () => {
  it('DIRECTORY_HIT prefers directory_slug over region slug', async () => {
    const prisma = {
      market: {
        findFirst: jest
          .fn()
          .mockResolvedValueOnce({
            id: 'm1',
            name: 'Denver Union Station Market',
            slug: 'union-station',
            directorySlug: 'denver-union',
            description: 'Regional produce corridor',
            city: 'Denver',
            state: 'CO',
            locationAddress: '1701 Wynkoop St',
            operatingHours: 'Sat 8:00-13:00',
            themePrimaryColor: '#114433',
            themeAccentColor: '#c48a2a',
            event: { description: 'Event blurb', bannerUrl: 'https://example.com/b.jpg' },
          })
          .mockResolvedValue(null),
      },
    };

    const service = new MarketsDirectoryService(prisma as never);
    const market = await service.findByDirectorySlug('denver-union');

    expect(market?.id).toBe('m1');
    expect(market?.themePrimaryColor).toBe('#114433');
    expect(prisma.market.findFirst).toHaveBeenCalledTimes(1);
  });

  it('DIRECTORY_MISS returns null for unknown slug', async () => {
    const prisma = {
      market: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
    };

    const service = new MarketsDirectoryService(prisma as never);
    await expect(service.findByDirectorySlug('missing-market')).resolves.toBeNull();
    expect(prisma.market.findFirst).toHaveBeenCalledTimes(2);
  });
});
