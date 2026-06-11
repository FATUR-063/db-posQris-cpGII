import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString, IsArray, IsEnum, IsOptional,
  ValidateNested, IsInt, Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum PaymentMethod {
  CASH = 'CASH',
  QRIS = 'QRIS',
  DEBIT = 'DEBIT',
  TRANSFER = 'TRANSFER',
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
  @ApiProperty({ example: 'uuid-pasien', description: 'ID pasien di sistem POS' })
  @IsString()
  patientId: string;

  @ApiPropertyOptional({
    example: 'RM-202606-0001',
    description:
      'Nomor Rekam Medis dari RME. Jika diisi, sistem akan otomatis ' +
      'fetch billing dari RME dan menyimpan rmeBillingId.',
  })
  @IsOptional()
  @IsString()
  rekamMedisId?: string;

  @ApiPropertyOptional({
    example: 'uuid-billing-rme',
    description:
      'ID billing dari sistem RME. Diisi manual jika sudah dapat dari ' +
      'endpoint GET /billing/from-rme/:rekamMedisId.',
  })
  @IsOptional()
  @IsString()
  rmeBillingId?: string;

  @ApiProperty({ type: [CartItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CartItemDto)
  items: CartItemDto[];

  @ApiProperty({ enum: PaymentMethod, example: PaymentMethod.QRIS })
  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;

  @ApiPropertyOptional({ example: 'VOUCHER-BPJS-001' })
  @IsString()
  @IsOptional()
  voucherCode?: string;
}
