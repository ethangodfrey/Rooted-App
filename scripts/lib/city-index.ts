import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { parseMarketsCsv } from './market-csv';
import { METRO_CITIES } from './metro-priority';

export interface CityPoint {
  city: string;
  state: string;
  latitude: number;
  longitude: number;
}

const CACHE = new Map<string, CityPoint[]>();

function lookupCoords(
  rows: { city: string; state: string; latitude: number; longitude: number }[],
  stateAbbr: string,
  cityName: string,
): CityPoint | null {
  const exact = rows.find(
    (r) => r.state === stateAbbr && r.city.toLowerCase() === cityName.toLowerCase(),
  );
  if (exact) {
    return {
      city: exact.city,
      state: exact.state,
      latitude: exact.latitude,
      longitude: exact.longitude,
    };
  }
  return null;
}

/** Major metros first, then more cities from data/markets-cities.csv. */
export function citiesForState(stateAbbr: string, maxCities: number): CityPoint[] {
  const key = `${stateAbbr}:${maxCities}`;
  if (CACHE.has(key)) return CACHE.get(key)!;

  const path = resolve(process.cwd(), 'data/markets-cities.csv');
  const rows = existsSync(path) ? parseMarketsCsv(readFileSync(path, 'utf8')) : [];

  const seen = new Set<string>();
  const cities: CityPoint[] = [];

  for (const metro of METRO_CITIES[stateAbbr] ?? []) {
    const keyName = metro.toLowerCase();
    if (seen.has(keyName)) continue;
    const point = lookupCoords(rows, stateAbbr, metro);
    if (point) {
      seen.add(keyName);
      cities.push(point);
    }
  }

  for (const row of rows) {
    if (row.state !== stateAbbr) continue;
    const dedupeKey = row.city.toLowerCase();
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    cities.push({
      city: row.city,
      state: row.state,
      latitude: row.latitude,
      longitude: row.longitude,
    });
    if (cities.length >= maxCities) break;
  }

  CACHE.set(key, cities);
  return cities;
}
