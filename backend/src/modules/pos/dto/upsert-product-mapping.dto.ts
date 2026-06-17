import { IsBoolean, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class UpsertProductMappingDto {
  @IsUUID()
  connectionId!: string;

  @IsString()
  @MaxLength(128)
  providerCatalogObjectId!: string;

  /** Rooted product to attribute this provider item to; null to clear. */
  @IsOptional()
  @IsUUID()
  productId?: string | null;

  /** When true, sales of this provider item are excluded from analytics. */
  @IsOptional()
  @IsBoolean()
  ignored?: boolean;
}
