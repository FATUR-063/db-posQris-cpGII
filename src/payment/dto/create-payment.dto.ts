import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class CreatePaymentDto {
  @ApiProperty({ 
    example: 'eae78049-cb06-40f7-b93b-8cdca6f484e2',
    description: 'ID transaksi yang mau dibayar'
  })
  @IsString()
  transactionId: string;
}