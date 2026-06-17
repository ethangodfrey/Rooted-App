/** USDA Local Food Directories — https://www.usdalocalfoodportal.com/fe/datasharing/ */
export type UsdaDirectorySlug =
  | 'farmersmarket'
  | 'csa'
  | 'agritourism'
  | 'foodhub'
  | 'onfarmmarket';

export interface UsdaDirectoryConfig {
  slug: UsdaDirectorySlug;
  label: string;
  marketType: string;
  listingInfoType: UsdaDirectorySlug;
}

export const USDA_DIRECTORIES: UsdaDirectoryConfig[] = [
  {
    slug: 'farmersmarket',
    label: 'Farmers Market',
    marketType: 'farmers_market',
    listingInfoType: 'farmersmarket',
  },
  {
    slug: 'csa',
    label: 'CSA',
    marketType: 'csa',
    listingInfoType: 'csa',
  },
  {
    slug: 'onfarmmarket',
    label: 'On-Farm Market',
    marketType: 'on_farm_market',
    listingInfoType: 'onfarmmarket',
  },
  {
    slug: 'foodhub',
    label: 'Food Hub',
    marketType: 'food_hub',
    listingInfoType: 'foodhub',
  },
  {
    slug: 'agritourism',
    label: 'Agritourism',
    marketType: 'agritourism',
    listingInfoType: 'agritourism',
  },
];

export function usdaCompositeId(directory: UsdaDirectorySlug, listingId: string): string {
  return `${directory}:${listingId}`;
}

export function marketTypeForDirectory(directory: UsdaDirectorySlug): string {
  return USDA_DIRECTORIES.find((item) => item.slug === directory)?.marketType ?? 'farmers_market';
}

export function directoryLabel(directory: UsdaDirectorySlug): string {
  return USDA_DIRECTORIES.find((item) => item.slug === directory)?.label ?? 'Local food listing';
}
