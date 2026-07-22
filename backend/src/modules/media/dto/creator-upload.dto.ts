import { IsIn, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreatorUploadDto {
  @IsIn(['image', 'video'])
  mediaType!: 'image' | 'video';

  @IsString()
  contentType!: string;

  @IsInt()
  @Min(1)
  sizeBytes!: number;

  @IsOptional()
  @IsString()
  fileName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  caption?: string;

  /**
   * Optional: client already uploaded bytes to the signed URL and returns the
   * final public/stream URL. When omitted, LOCAL_STUB stream URL is persisted.
   */
  @IsOptional()
  @IsString()
  assetUrl?: string;
}
