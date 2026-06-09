// src/accounting/dto/accounting.dto.ts

import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  IsEnum,
  IsOptional,
  IsDateString,
  Min,
} from 'class-validator';

// ----------------------------------------------------------------
// Expense DTOs
// ----------------------------------------------------------------

export enum ExpenseCategoryDto {
  PAYROLL        = 'PAYROLL',
  STOCK_PURCHASE = 'STOCK_PURCHASE',
  OPERATIONAL    = 'OPERATIONAL',
  MAINTENANCE    = 'MAINTENANCE',
  OTHER          = 'OTHER',
}

export class CreateExpenseDto {
  @ApiProperty({ enum: ExpenseCategoryDto, example: ExpenseCategoryDto.OPERATIONAL })
  @IsEnum(ExpenseCategoryDto)
  category: ExpenseCategoryDto;

  @ApiProperty({ example: 500000 })
  @IsNumber()
  @Min(1)
  amount: number;

  @ApiProperty({ example: 'Tagihan listrik bulan Mei' })
  @IsString()
  description: string;

  @ApiProperty({ example: '2026-05-21' })
  @IsDateString()
  expenseDate: string;

  @ApiProperty({ example: 'uuid-chart-of-account-id', description: 'ID akun beban dari COA' })
  @IsString()
  accountId: string;
}

// ----------------------------------------------------------------
// Report DTOs (query params)
// ----------------------------------------------------------------

export class CashflowQueryDto {
  @ApiProperty({ example: '2026-05-01', required: false })
  @IsDateString()
  @IsOptional()
  from?: string;

  @ApiProperty({ example: '2026-05-31', required: false })
  @IsDateString()
  @IsOptional()
  to?: string;
}

export class ProfitLossQueryDto {
  @ApiProperty({ example: '2026-05-01', required: false })
  @IsDateString()
  @IsOptional()
  from?: string;

  @ApiProperty({ example: '2026-05-31', required: false })
  @IsDateString()
  @IsOptional()
  to?: string;
}

export class GeneralLedgerQueryDto {
  @ApiProperty({ example: 'uuid-coa-id', description: 'Filter by akun COA', required: false })
  @IsString()
  @IsOptional()
  accountId?: string;

  @ApiProperty({ example: '2026-05-01', required: false })
  @IsDateString()
  @IsOptional()
  from?: string;

  @ApiProperty({ example: '2026-05-31', required: false })
  @IsDateString()
  @IsOptional()
  to?: string;
}
