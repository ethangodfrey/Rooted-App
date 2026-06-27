import { IsOptional, IsUrl } from 'class-validator';

export class CreateConnectLinkDto {
  @IsOptional()
  @IsUrl({ require_tld: false })
  returnUrl?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  refreshUrl?: string;
}
