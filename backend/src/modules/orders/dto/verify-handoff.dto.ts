import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString } from 'class-validator';

/** RT-xxx pickup validation token (6 characters including hyphen). */
export const PICKUP_CODE_REGEX = /^RT-[A-Z0-9]{3}$/;

export class VerifyHandoffDto {
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString()
  @IsNotEmpty()
  code!: string;
}
