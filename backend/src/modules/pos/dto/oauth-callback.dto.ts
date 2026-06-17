import { IsOptional, IsString } from 'class-validator';

export class OAuthCallbackDto {
  @IsString()
  state!: string;

  @IsOptional()
  @IsString()
  code?: string;

  /** Square includes this on the redirect; ignored after validation. */
  @IsOptional()
  @IsString()
  response_type?: string;

  /** Present when the provider reports an authorization error. */
  @IsOptional()
  @IsString()
  error?: string;

  @IsOptional()
  @IsString()
  error_description?: string;
}
