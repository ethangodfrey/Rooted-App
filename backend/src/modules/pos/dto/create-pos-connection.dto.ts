import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PosProvider } from '@prisma/client';

export class CreatePosConnectionDto {
  @IsEnum(PosProvider)
  provider!: PosProvider;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  displayName?: string;

  /** Required for API-key providers (e.g. Toast restaurant GUID). */
  @IsOptional()
  @IsString()
  @MaxLength(512)
  apiKey?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  providerLocationId?: string;

  @IsOptional()
  @IsInt()
  @Min(15)
  @Max(1440)
  syncFrequencyMinutes?: number;

  /** Mobile deep link Square bounces to after OAuth (must match openAuthSessionAsync). */
  @IsOptional()
  @IsString()
  @MaxLength(512)
  appReturnUrl?: string;
}
