import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateVendorUploadDto {
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
}
