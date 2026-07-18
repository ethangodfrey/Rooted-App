import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

const PAYMENT_METHODS = ['PAY_AT_HANDOFF', 'STRIPE_ONLINE'] as const;

export class CreateOrderDto {
  @IsUUID()
  @IsNotEmpty()
  product_id!: string;

  @IsUUID()
  @IsNotEmpty()
  vendor_user_id!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity!: number;

  @IsOptional()
  @IsString()
  @IsIn(PAYMENT_METHODS)
  payment_method?: (typeof PAYMENT_METHODS)[number];

  @IsOptional()
  @IsUUID()
  event_id?: string;

  @IsOptional()
  @IsString()
  fulfillment_label?: string;
}
