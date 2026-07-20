export const FORECAST_LOOKBACK_DAYS = 30;
export const HIGH_VOLUME_MIN_QUANTITY = 10;

export type SkuDemandRow = {
  productId: string;
  productName: string | null;
  totalQuantity: number;
};

export type RollingDemandForecast = {
  productId: string;
  productName: string | null;
  totalQuantity: number;
  rollingAverageDailyDemand: number;
  forecast30DayThreshold: number;
  isHighVolume: boolean;
};

/**
 * Rolling average demand over a lookback window.
 * forecast30DayThreshold = daily average * lookback days (expected 30-day demand).
 */
export function calculateRollingAverageDemand(
  rows: SkuDemandRow[],
  options?: { lookbackDays?: number; highVolumeMinQuantity?: number },
): RollingDemandForecast[] {
  const lookbackDays = options?.lookbackDays ?? FORECAST_LOOKBACK_DAYS;
  const highVolumeMin =
    options?.highVolumeMinQuantity ?? HIGH_VOLUME_MIN_QUANTITY;

  return rows
    .map((row) => {
      const totalQuantity = Math.max(0, row.totalQuantity);
      const rollingAverageDailyDemand = totalQuantity / lookbackDays;
      const forecast30DayThreshold =
        rollingAverageDailyDemand * lookbackDays;

      return {
        productId: row.productId,
        productName: row.productName,
        totalQuantity,
        rollingAverageDailyDemand,
        forecast30DayThreshold,
        isHighVolume: totalQuantity >= highVolumeMin,
      };
    })
    .sort((left, right) => right.totalQuantity - left.totalQuantity);
}
