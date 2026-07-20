import { Injectable, Logger } from '@nestjs/common';

import { US_COUNTRY_CODE, isUsCountryCode } from '../search/us-geo.util';

export type RegionalFreightEstimate = {
  carrierCode: string;
  carrierName: string;
  serviceLevel: string;
  countryCode: typeof US_COUNTRY_CODE;
  distanceMiles: number;
  weightLbs: number;
  freightCents: number;
  estimatedTransitDays: number;
};

type UsRegionalCarrierProfile = {
  code: string;
  name: string;
  serviceLevel: string;
  baseRatePerMileCents: number;
  minChargeCents: number;
  maxDistanceMiles: number | null;
};

/** Mock regional freight carriers operating within the United States. */
const US_REGIONAL_CARRIER_PROFILES: UsRegionalCarrierProfile[] = [
  {
    code: 'NORTHEAST_REGIONAL_LTL',
    name: 'Northeast Regional LTL',
    serviceLevel: 'REGIONAL_LTL',
    baseRatePerMileCents: 92,
    minChargeCents: 4800,
    maxDistanceMiles: 500,
  },
  {
    code: 'MIDWEST_REGIONAL_LTL',
    name: 'Midwest Regional LTL',
    serviceLevel: 'REGIONAL_LTL',
    baseRatePerMileCents: 85,
    minChargeCents: 4500,
    maxDistanceMiles: 800,
  },
  {
    code: 'SOUTHEAST_REGIONAL_LTL',
    name: 'Southeast Regional LTL',
    serviceLevel: 'REGIONAL_LTL',
    baseRatePerMileCents: 88,
    minChargeCents: 4600,
    maxDistanceMiles: 600,
  },
  {
    code: 'WEST_COAST_REGIONAL_LTL',
    name: 'West Coast Regional LTL',
    serviceLevel: 'REGIONAL_LTL',
    baseRatePerMileCents: 95,
    minChargeCents: 5200,
    maxDistanceMiles: 900,
  },
  {
    code: 'NATIONAL_US_LTL',
    name: 'National US LTL',
    serviceLevel: 'NATIONAL_LTL',
    baseRatePerMileCents: 110,
    minChargeCents: 6500,
    maxDistanceMiles: null,
  },
];

function estimateTransitDays(distanceMiles: number): number {
  return Math.max(1, Math.ceil(distanceMiles / 250) + 1);
}

function estimateFreightCents(
  profile: UsRegionalCarrierProfile,
  distanceMiles: number,
  weightLbs: number,
): number {
  const weightFactor = 1 + weightLbs / 1000;
  const variable = Math.round(
    distanceMiles * profile.baseRatePerMileCents * weightFactor,
  );
  return Math.max(profile.minChargeCents, variable);
}

/**
 * Mock regional freight carrier API client.
 * Returns US-only shipping estimates keyed off haversine distance + weight.
 */
@Injectable()
export class RegionalFreightCarrierClient {
  private readonly logger = new Logger(RegionalFreightCarrierClient.name);

  async fetchShippingEstimates(input: {
    distanceMiles: number;
    weightLbs: number;
    originCountry: string | null | undefined;
    destinationCountry: string | null | undefined;
  }): Promise<RegionalFreightEstimate[]> {
    if (
      !isUsCountryCode(input.originCountry) ||
      !isUsCountryCode(input.destinationCountry)
    ) {
      this.logger.warn(
        'CARRIER_API_SYNC_COMPLETED COUNTRY_FILTER=US ROUTES=0 REASON=NON_US_ENDPOINT',
      );
      return [];
    }

    const distanceMiles = Math.max(0, input.distanceMiles);
    const weightLbs = Math.max(1, input.weightLbs);

    const estimates = US_REGIONAL_CARRIER_PROFILES.filter(
      (profile) =>
        profile.maxDistanceMiles == null ||
        distanceMiles <= profile.maxDistanceMiles,
    ).map((profile) => ({
      carrierCode: profile.code,
      carrierName: profile.name,
      serviceLevel: profile.serviceLevel,
      countryCode: US_COUNTRY_CODE,
      distanceMiles,
      weightLbs,
      freightCents: estimateFreightCents(profile, distanceMiles, weightLbs),
      estimatedTransitDays: estimateTransitDays(distanceMiles),
    }));

    estimates.sort(
      (left, right) =>
        left.freightCents - right.freightCents ||
        left.estimatedTransitDays - right.estimatedTransitDays,
    );

    this.logger.log(
      `CARRIER_API_SYNC_COMPLETED COUNTRY_CODE=US DISTANCE_MI=${distanceMiles.toFixed(1)} WEIGHT_LBS=${weightLbs.toFixed(1)} ROUTES=${estimates.length}`,
    );

    return estimates;
  }
}
