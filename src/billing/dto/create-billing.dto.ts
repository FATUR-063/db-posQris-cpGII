import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString, IsArray, IsEnum, IsOptional,
  ValidateNested, IsInt, IsNumber, Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum PaymentMethod {
  CASH     = 'CASH',
  QRIS     = 'QRIS',
  DEBIT    = 'DEBIT',
  TRANSFER = 'TRANSFER',
  BPJS     = 'BPJS',
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

export class WmsItemDto {
  @ApiPropertyOptional({
    example: 'OBT-K001',
    description: 'Kode obat dari WMS. Isi salah satu: kodeObat atau obatId.',
  })
  @IsOptional()
  @IsString()
  kodeObat?: string;

  @ApiPropertyOptional({
    example: 'uuid-obat-wms',
    description: 'UUID obat dari WMS. Isi salah satu: kodeObat atau obatId.',
  })
  @IsOptional()
  @IsString()
  obatId?: string;

  @ApiProperty({ example: 3, description: 'Jumlah obat yang ditebus' })
  @IsNumber()
  @Min(1)
  qty: number;

  @ApiPropertyOptional({
    example: 'Amoxicillin 500mg dari resep dokter',
    description: 'Nama dari RME, opsional untuk audit mapping.',
  })
  @IsOptional()
  @IsString()
  labelResep?: string;
}

export class CreateBillingDto {
  @ApiProperty({ example: 'uuid-pasien', description: 'ID pasien di sistem POS' })
  @IsString()
  patientId: string;

  @ApiPropertyOptional({
    example: 'RM-202606-0001',
    description:
      'Nomor Rekam Medis dari RME. Jika diisi, sistem otomatis fetch ' +
      'billing dari RME (bpjsAmount, nonBpjsAmount, rmeBillingId).',
  })
  @IsOptional()
  @IsString()
  rekamMedisId?: string;

  @ApiPropertyOptional({
    example: 'uuid-billing-rme',
    description: 'ID billing dari RME. Diisi manual jika sudah dapat dari GET /billing/from-rme.',
  })
  @IsOptional()
  @IsString()
  rmeBillingId?: string;

  @ApiProperty({ type: [CartItemDto], description: 'Item dari katalog POS (obat/layanan)' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CartItemDto)
  items: CartItemDto[];

  @ApiPropertyOptional({
    type: [WmsItemDto],
    description:
      'Item obat untuk ditebus ke WMS/Farmasi. ' +
      'Opsional — kalau tidak diisi, WMS integration di-skip. ' +
      'Saat diisi, POS akan buat pharmacy order di WMS dan totalObat ditambahkan ke total tagihan.',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WmsItemDto)
  wmsItems?: WmsItemDto[];

  @ApiProperty({ enum: PaymentMethod, example: PaymentMethod.QRIS })
  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;

  @ApiPropertyOptional({ example: 'VOUCHER-BPJS-001' })
  @IsString()
  @IsOptional()
  voucherCode?: string;
}
