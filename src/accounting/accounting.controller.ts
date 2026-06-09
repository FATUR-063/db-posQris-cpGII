// src/accounting/accounting.controller.ts
//
// PERUBAHAN: Ditambahkan @ApiExcludeController() untuk menyembunyikan
// dari Swagger sesuai PRD v3 (scope dikurangi ke alur POS saja).
// Endpoint TETAP bisa diakses via API — hanya tidak tampil di Swagger docs.

import {
  Controller, Get, Post, Body, Param, Query, Request, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiExcludeController } from '@nestjs/swagger';
import { AccountingService } from './accounting.service';
import { CreateExpenseDto, CashflowQueryDto, ProfitLossQueryDto, GeneralLedgerQueryDto } from './dto/accounting.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiExcludeController()  // ← Sembunyikan dari Swagger (endpoint tetap aktif)
@ApiTags('Accounting')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('accounting')
export class AccountingController {
  constructor(private readonly accountingService: AccountingService) {}

  // ----------------------------------------------------------------
  // Chart of Accounts
  // ----------------------------------------------------------------

  @Get('coa')
  @Roles('SUPER_ADMIN', 'MANAGER', 'FINANCE_STAFF')
  @ApiOperation({ summary: 'Daftar semua akun keuangan (COA)' })
  getChartOfAccounts() {
    return this.accountingService.getChartOfAccounts();
  }

  @Get('coa/expense-accounts')
  @Roles('SUPER_ADMIN', 'MANAGER', 'FINANCE_STAFF')
  @ApiOperation({ summary: 'Daftar akun beban — untuk dropdown input pengeluaran' })
  getExpenseAccounts() {
    return this.accountingService.getExpenseAccounts();
  }

  // ----------------------------------------------------------------
  // Journal Entries
  // ----------------------------------------------------------------

  @Get('journal')
  @Roles('SUPER_ADMIN', 'MANAGER', 'FINANCE_STAFF')
  @ApiOperation({ summary: 'Daftar semua jurnal (General Ledger header)' })
  @ApiQuery({ name: 'from', required: false, example: '2026-05-01' })
  @ApiQuery({ name: 'to', required: false, example: '2026-05-31' })
  getJournalEntries(@Query('from') from?: string, @Query('to') to?: string) {
    return this.accountingService.getJournalEntries(from, to);
  }

  @Get('journal/:id')
  @Roles('SUPER_ADMIN', 'MANAGER', 'FINANCE_STAFF')
  @ApiOperation({ summary: 'Detail satu jurnal entry' })
  getJournalEntryById(@Param('id') id: string) {
    return this.accountingService.getJournalEntryById(id);
  }

  // ----------------------------------------------------------------
  // Expense Management
  // ----------------------------------------------------------------

  @Get('expenses')
  @Roles('SUPER_ADMIN', 'MANAGER', 'FINANCE_STAFF')
  @ApiOperation({ summary: 'Daftar pengeluaran operasional' })
  @ApiQuery({ name: 'from', required: false, example: '2026-05-01' })
  @ApiQuery({ name: 'to', required: false, example: '2026-05-31' })
  getExpenses(@Query('from') from?: string, @Query('to') to?: string) {
    return this.accountingService.getExpenses(from, to);
  }

  @Post('expenses')
  @Roles('SUPER_ADMIN', 'FINANCE_STAFF')
  @ApiOperation({ summary: 'Catat pengeluaran baru — otomatis buat jurnal debit/kredit' })
  createExpense(@Body() dto: CreateExpenseDto, @Request() req: any) {
    return this.accountingService.createExpense(dto, req.user.userId);
  }

  // ----------------------------------------------------------------
  // Reports
  // ----------------------------------------------------------------

  @Get('reports/cashflow')
  @Roles('SUPER_ADMIN', 'MANAGER', 'FINANCE_STAFF')
  @ApiOperation({ summary: 'Laporan arus kas masuk & keluar' })
  getCashflow(@Query() query: CashflowQueryDto) {
    return this.accountingService.getCashflow(query);
  }

  @Get('reports/profit-loss')
  @Roles('SUPER_ADMIN', 'MANAGER', 'FINANCE_STAFF')
  @ApiOperation({ summary: 'Laporan laba rugi per periode' })
  getProfitLoss(@Query() query: ProfitLossQueryDto) {
    return this.accountingService.getProfitLoss(query);
  }

  @Get('reports/general-ledger')
  @Roles('SUPER_ADMIN', 'MANAGER', 'FINANCE_STAFF')
  @ApiOperation({ summary: 'Buku besar — histori semua jurnal per akun' })
  getGeneralLedger(@Query() query: GeneralLedgerQueryDto) {
    return this.accountingService.getGeneralLedger(query);
  }
}
