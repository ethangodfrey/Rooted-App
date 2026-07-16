/**
 * Re-export farmers market directory seed helpers.
 * Prefer importing from `./seed-markets` directly; this alias matches docs that
 * refer to `scripts/lib/markets.ts`.
 *
 * Importing this module does NOT run the CLI (`scripts/seed-markets.ts`).
 */

export {
  isValidCoordinate,
  toInsertRow,
  toPointWkt,
  type FarmersMarketInsertRow,
  type FarmersMarketSeedInput,
} from './seed-markets';
