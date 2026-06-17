import { IsBoolean, IsISO8601, IsOptional } from 'class-validator';

export class TriggerSyncDto {
  /** When true, ignores the stored cursor and reaches back the backfill window. */
  @IsOptional()
  @IsBoolean()
  backfill?: boolean;

  @IsOptional()
  @IsISO8601()
  since?: string;

  @IsOptional()
  @IsISO8601()
  until?: string;
}
