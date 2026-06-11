import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsEnum, Length } from 'class-validator';

export enum JenisKelaminEnum {
  LAKI_LAKI = 'LAKI_LAKI',
  PEREMPUAN = 'PEREMPUAN',
}

export enum InsuranceTypeEnum {
  UMUM = 'UMUM',
  BPJS = 'BPJS',
  VOUCHER = 'VOUCHER',
}

export class CreatePatientDto {
  @ApiProperty({ example: 'Budi Santoso', description: 'Nama lengkap pasien' })
  @IsString()
  name: string;

  @ApiPropertyOptional({
    example: '08123456789',
    description: 'Nomor telepon / WhatsApp pasien',
  })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({
    example: '3404010101900001',
    description: 'NIK 16 digit — untuk integrasi RME',
  })

  @IsOptional()
  @IsString()
  @Length(16, 16, { message: 'NIK harus 16 digit' })
  nik?: string;
  
  @ApiPropertyOptional({ example: 'Jl. Merdeka No. 10, Jakarta' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({
    enum: JenisKelaminEnum,
    example: JenisKelaminEnum.LAKI_LAKI,
  })
  @IsOptional()
  @IsEnum(JenisKelaminEnum)
  jenisKelamin?: JenisKelaminEnum;

  @ApiPropertyOptional({
    example: '0001234567890',
    description: 'Nomor BPJS 13 digit',
  })
  @IsOptional()
  @IsString()
  @Length(13, 13, { message: 'Nomor BPJS harus 13 digit' })
  noBpjs?: string;

  @ApiPropertyOptional({
    enum: InsuranceTypeEnum,
    example: InsuranceTypeEnum.UMUM,
    description: 'Tipe penjaminan. Default: UMUM',
  })
  @IsOptional()
  @IsEnum(InsuranceTypeEnum)
  insuranceType?: InsuranceTypeEnum;
}
