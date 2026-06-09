import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsEnum, IsOptional } from 'class-validator';

export enum ItemType {
  OBAT = 'OBAT',
  LAYANAN = 'LAYANAN',
}

export class CreateItemDto {
  @ApiProperty({ example: 'Paracetamol 500mg' })
  @IsString()
  name: string;

  @ApiProperty({ enum: ItemType, example: ItemType.OBAT })
  @IsEnum(ItemType)
  type: ItemType;

  @ApiProperty({ example: 5000 })
  @IsNumber()
  price: number;

  @ApiProperty({ example: 'tablet', required: false })
  @IsString()
  @IsOptional()
  unit?: string;
}