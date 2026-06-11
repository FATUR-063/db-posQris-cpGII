import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum, IsNumber, IsOptional, IsString, IsBoolean, Min,
} from 'class-validator';

export enum PaymentMethodDto {
  CASH     = 'CASH',
  QRIS     = 'QRIS',
  DEBIT    = 'DEBIT',
  TRANSFER = 'TRANSFER',
  BPJS     = 'BPJS',
}

export class AddPaymentDto {
  @ApiProperty({
    enum: PaymentMethodDto,
    example: PaymentMethodDto.QRIS,
    description: 'Metode pembayaran untuk payment ini',
  })
  @IsEnum(PaymentMethodDto)
  method: PaymentMethodDto;

  @ApiProperty({
    example: 75000,
    description:
      'Nominal pembayaran. Tidak boleh melebihi sisa tagihan (total - paidAmount). ' +
      'Untuk BPJS, isi sesuai tanggungan BPJS dari RME (bpjsAmount).',
  })
  @IsNumber()
  @Min(1)
  amount: number;

  @ApiPropertyOptional({
    example: 'BPJS-KLAIM-001',
    description:
      'Nomor referensi manual — nomor klaim BPJS, nomor struk EDC, atau catatan kasir.',
  })
  @IsOptional()
  @IsString()
  reference?: string;

  @ApiPropertyOptional({
    example: true,
    description:
      'Tandai jika ini adalah pembayaran dari tanggungan BPJS. ' +
      'Default false. Jika true, amount idealnya sesuai bpjsAmount dari RME.',
  })
  @IsOptional()
  @IsBoolean()
  isBpjsCoverage?: boolean;
}
