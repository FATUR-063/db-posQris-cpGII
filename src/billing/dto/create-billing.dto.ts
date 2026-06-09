import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsArray, IsEnum, IsOptional, ValidateNested, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export enum PaymentMethod {
  CASH = 'CASH',
  QRIS = 'QRIS',
  DEBIT = 'DEBIT',
  BPJS = 'BPJS',
}

export class CartItemDto {
  @ApiProperty({ example: '3e1d7e69-f88a-4b89-a021-7c8f2010ee60' })
  @IsString()
  itemId: string;

  @ApiProperty({ example: 2 })
  @IsInt()
  @Min(1)
  quantity: number;
}

export class CreateBillingDto {
  @ApiProperty({ example: 'dummy-patient-id' })
  @IsString()
  patientId: string;

  @ApiProperty({ type: [CartItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CartItemDto)
  items: CartItemDto[];

  @ApiProperty({ enum: PaymentMethod, example: PaymentMethod.QRIS })
  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;

  @ApiProperty({ example: 'VOUCHER-BPJS-001', required: false })
  @IsString()
  @IsOptional()
  voucherCode?: string;
}