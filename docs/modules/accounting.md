# Dokumentasi Modul — Accounting

> **Di-generate otomatis.** Jangan edit manual — perbarui dengan:
>
> ```bash
> npm run docs:modules
> ```

| | |
|---|---|
| **Modul** | `accounting` |
| **Folder sumber** | `src/accounting` |
| **Diperbarui** | 2026-06-09 15:48:49 |
| **Total file** | 4 |
| **Total baris kode** | 640 |

---

## Struktur file

```
src/accounting/
├── accounting.controller.ts
├── accounting.module.ts
├── accounting.service.ts
├── dto/accounting.dto.ts
```

---

## Daftar isi

- [src/accounting/accounting.controller.ts](#src-accounting-accounting-controller-ts) (108 baris)
- [src/accounting/accounting.module.ts](#src-accounting-accounting-module-ts) (15 baris)
- [src/accounting/accounting.service.ts](#src-accounting-accounting-service-ts) (425 baris)
- [src/accounting/dto/accounting.dto.ts](#src-accounting-dto-accounting-dto-ts) (92 baris)

---

## src/accounting/accounting.controller.ts

```typescript
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

```

---

## src/accounting/accounting.module.ts

```typescript
// src/accounting/accounting.module.ts

import { Module } from '@nestjs/common';
import { AccountingController } from './accounting.controller';
import { AccountingService } from './accounting.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [AccountingController],
  providers: [AccountingService],
  exports: [AccountingService], // di-export agar bisa dipakai PaymentModule
})
export class AccountingModule {}

```

---

## src/accounting/accounting.service.ts

```typescript
// src/accounting/accounting.service.ts
//
// Ini jantung dari Accounting Engine.
// Tiga tanggung jawab utama:
//   1. createJournalFromTransaction() — dipanggil otomatis saat LUNAS
//   2. createExpense()               — pencatatan pengeluaran manual
//   3. Report queries                — cashflow, P&L, general ledger

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateExpenseDto, CashflowQueryDto, ProfitLossQueryDto, GeneralLedgerQueryDto } from './dto/accounting.dto';
import { JournalType } from '@prisma/client';
import Decimal from 'decimal.js';

@Injectable()
export class AccountingService {
  constructor(private prisma: PrismaService) {}

  // ----------------------------------------------------------------
  // 1. AUTO-JOURNAL — dipanggil dari PaymentService saat LUNAS
  // ----------------------------------------------------------------
  // Logic:
  //   CASH/QRIS/DEBIT/TRANSFER → DEBIT akun Kas (1100)
  //   BPJS                     → DEBIT akun Piutang BPJS (1300)
  //   Item LAYANAN             → CREDIT akun Pendapatan Jasa (4100)
  //   Item OBAT                → CREDIT akun Pendapatan Obat (4200)
  //   Mix LAYANAN + OBAT       → CREDIT ke dua akun sesuai proporsi

  async createJournalFromTransaction(transactionId: string, createdBy: string) {
    // Ambil data transaksi lengkap
    const transaction = await this.prisma.db.transaction.findUnique({
      where: { id: transactionId },
      include: {
        items: { include: { item: true } },
      },
    });

    if (!transaction) throw new NotFoundException('Transaksi tidak ditemukan');

    // Cek apakah jurnal sudah pernah dibuat untuk transaksi ini
    const existingJournal = await this.prisma.db.journalEntry.findUnique({
      where: { transactionId },
    });
    if (existingJournal) return existingJournal; // idempotent — tidak buat duplikat

    // Tentukan akun DEBIT berdasarkan metode pembayaran
    const debitAccountCode = transaction.paymentMethod === 'BPJS' ? '1300' : '1100';
    const debitAccount = await this.prisma.db.chartOfAccount.findUnique({
      where: { code: debitAccountCode },
    });
    if (!debitAccount) throw new BadRequestException(`Akun COA ${debitAccountCode} tidak ditemukan. Pastikan seed sudah dijalankan.`);

    // Hitung total per tipe item (LAYANAN vs OBAT)
    let totalLayanan = new Decimal(0);
    let totalObat = new Decimal(0);

    for (const ti of transaction.items) {
      if (ti.item.type === 'LAYANAN') {
        totalLayanan = totalLayanan.plus(ti.subtotal);
      } else {
        totalObat = totalObat.plus(ti.subtotal);
      }
    }

    // Ambil akun CREDIT
    const revenueLayananAccount = await this.prisma.db.chartOfAccount.findUnique({
      where: { code: '4100' },
    });
    const revenueObatAccount = await this.prisma.db.chartOfAccount.findUnique({
      where: { code: '4200' },
    });

    if (!revenueLayananAccount || !revenueObatAccount) {
      throw new BadRequestException('Akun COA pendapatan tidak ditemukan. Pastikan seed sudah dijalankan.');
    }

    // Buat journal lines
    const lines: {
      accountId: string;
      debit: Decimal;
      credit: Decimal;
      description: string;
    }[] = [];

    // Baris 1: DEBIT Kas/Piutang BPJS
    lines.push({
      accountId: debitAccount.id,
      debit: new Decimal(transaction.total.toString()),
      credit: new Decimal(0),
      description: `Penerimaan ${transaction.paymentMethod} - ${transaction.midtransOrderId}`,
    });

    // Baris 2: CREDIT Pendapatan Jasa (jika ada item LAYANAN)
    if (totalLayanan.greaterThan(0)) {
      lines.push({
        accountId: revenueLayananAccount.id,
        debit: new Decimal(0),
        credit: totalLayanan,
        description: 'Pendapatan jasa layanan',
      });
    }

    // Baris 3: CREDIT Pendapatan Obat (jika ada item OBAT)
    if (totalObat.greaterThan(0)) {
      lines.push({
        accountId: revenueObatAccount.id,
        debit: new Decimal(0),
        credit: totalObat,
        description: 'Pendapatan penjualan obat',
      });
    }

    // Buat JournalEntry + JournalLines dalam satu atomic transaction
    const journalEntry = await this.prisma.db.journalEntry.create({
      data: {
        description: `Transaksi LUNAS - ${transaction.midtransOrderId ?? transactionId}`,
        type: JournalType.INCOME,
        referenceNo: transaction.midtransOrderId ?? transactionId,
        transactionId: transaction.id,
        createdBy,
        lines: {
          create: lines,
        },
      },
      include: { lines: { include: { account: true } } },
    });

    console.log(`✅ Journal created for transaction ${transactionId}`);
    return journalEntry;
  }

  // ----------------------------------------------------------------
  // 2. EXPENSE — pencatatan pengeluaran operasional manual
  // ----------------------------------------------------------------

  async createExpense(dto: CreateExpenseDto, createdBy: string) {
    const account = await this.prisma.db.chartOfAccount.findUnique({
      where: { id: dto.accountId },
    });
    if (!account) throw new NotFoundException('Akun COA tidak ditemukan');
    if (account.type !== 'EXPENSE') {
      throw new BadRequestException(
        `Akun ${account.code} bukan akun EXPENSE. Pilih akun kode 5xxx.`
      );
    }
  
    const kasAccount = await this.prisma.db.chartOfAccount.findUnique({
      where: { code: '1100' },
    });
    if (!kasAccount) throw new BadRequestException('Akun Kas (1100) tidak ditemukan');
  
    const amount = new Decimal(dto.amount);
  
    // Step 1: Buat expense dulu
    const expense = await this.prisma.db.expense.create({
      data: {
        category: dto.category as any,
        amount,
        description: dto.description,
        expenseDate: new Date(dto.expenseDate),
        accountId: dto.accountId,
        createdBy,
      },
    });
  
    // Step 2: Buat journal entry terpisah, link ke expense
    const journal = await this.prisma.db.journalEntry.create({
      data: {
        description: `Pengeluaran: ${dto.description}`,
        type: JournalType.EXPENSE,
        referenceNo: `EXP-${Date.now()}`,
        createdBy,
        expenseId: expense.id,
        lines: {
          create: [
            {
              accountId: dto.accountId,
              debit: amount,
              credit: new Decimal(0),
              description: dto.description,
            },
            {
              accountId: kasAccount.id,
              debit: new Decimal(0),
              credit: amount,
              description: `Pembayaran: ${dto.description}`,
            },
          ],
        },
      },
    });
  
    // Step 3: Update expense dengan journalEntryId
    await this.prisma.db.expense.update({
      where: { id: expense.id },
      data: { journalEntryId: journal.id },
    });
  
    return {
      message: 'Pengeluaran berhasil dicatat',
      data: { ...expense, journalEntry: journal },
    };
  }

  async getExpenses(from?: string, to?: string) {
    const where: any = {};
    if (from || to) {
      where.expenseDate = {
        ...(from && { gte: new Date(from) }),
        ...(to && { lte: new Date(to + 'T23:59:59') }),
      };
    }

    const expenses = await this.prisma.db.expense.findMany({
      where,
      include: { account: true, user: { select: { id: true, name: true } } },
      orderBy: { expenseDate: 'desc' },
    });

    return { message: 'Data pengeluaran', total: expenses.length, data: expenses };
  }

  // ----------------------------------------------------------------
  // 3. CHART OF ACCOUNTS
  // ----------------------------------------------------------------

  async getChartOfAccounts() {
    const accounts = await this.prisma.db.chartOfAccount.findMany({
      where: { isActive: true },
      orderBy: { code: 'asc' },
    });
    return { message: 'Chart of Accounts', total: accounts.length, data: accounts };
  }

  async getExpenseAccounts() {
    // Hanya akun EXPENSE — untuk dropdown saat input pengeluaran
    const accounts = await this.prisma.db.chartOfAccount.findMany({
      where: { type: 'EXPENSE', isActive: true },
      orderBy: { code: 'asc' },
    });
    return { message: 'Akun beban tersedia', data: accounts };
  }

  // ----------------------------------------------------------------
  // 4. JOURNAL ENTRIES
  // ----------------------------------------------------------------

  async getJournalEntries(from?: string, to?: string) {
    const where: any = {};
    if (from || to) {
      where.entryDate = {
        ...(from && { gte: new Date(from) }),
        ...(to && { lte: new Date(to + 'T23:59:59') }),
      };
    }

    const entries = await this.prisma.db.journalEntry.findMany({
      where,
      include: {
        lines: { include: { account: true } },
        user: { select: { id: true, name: true } },
      },
      orderBy: { entryDate: 'desc' },
    });

    return { message: 'Journal entries', total: entries.length, data: entries };
  }

  async getJournalEntryById(id: string) {
    const entry = await this.prisma.db.journalEntry.findUnique({
      where: { id },
      include: {
        lines: { include: { account: true } },
        user: { select: { id: true, name: true } },
        transaction: true,
        expense: true,
      },
    });
    if (!entry) throw new NotFoundException('Journal entry tidak ditemukan');
    return { message: 'Detail journal entry', data: entry };
  }

  // ----------------------------------------------------------------
  // 5. REPORTS
  // ----------------------------------------------------------------

  async getCashflow(query: CashflowQueryDto) {
    const from = query.from ? new Date(query.from) : new Date(new Date().setDate(1)); // default: awal bulan ini
    const to = query.to ? new Date(query.to + 'T23:59:59') : new Date();

    // Cash in = semua JournalLine DEBIT di akun Kas (1100) dan Bank (1200)
    const kasAccounts = await this.prisma.db.chartOfAccount.findMany({
      where: { code: { in: ['1100', '1200'] } },
    });
    const kasIds = kasAccounts.map((a) => a.id);

    const cashInLines = await this.prisma.db.journalLine.findMany({
      where: {
        accountId: { in: kasIds },
        debit: { gt: 0 },
        journalEntry: {
          entryDate: { gte: from, lte: to },
          type: JournalType.INCOME,
        },
      },
    });

    const cashOutLines = await this.prisma.db.journalLine.findMany({
      where: {
        accountId: { in: kasIds },
        credit: { gt: 0 },
        journalEntry: {
          entryDate: { gte: from, lte: to },
          type: JournalType.EXPENSE,
        },
      },
    });

    const cashIn = cashInLines.reduce((sum, l) => sum.plus(l.debit), new Decimal(0));
    const cashOut = cashOutLines.reduce((sum, l) => sum.plus(l.credit), new Decimal(0));
    const net = cashIn.minus(cashOut);

    return {
      message: 'Laporan Cashflow',
      data: {
        period: { from: from.toISOString().split('T')[0], to: to.toISOString().split('T')[0] },
        cashIn: cashIn.toNumber(),
        cashOut: cashOut.toNumber(),
        netCashflow: net.toNumber(),
        status: net.greaterThanOrEqualTo(0) ? 'POSITIF' : 'NEGATIF',
      },
    };
  }

  async getProfitLoss(query: ProfitLossQueryDto) {
    const from = query.from ? new Date(query.from) : new Date(new Date().setDate(1));
    const to = query.to ? new Date(query.to + 'T23:59:59') : new Date();

    // Total Revenue = semua JournalLine CREDIT di akun 4xxx
    const revenueAccounts = await this.prisma.db.chartOfAccount.findMany({
      where: { type: 'REVENUE', isActive: true },
    });
    const revenueIds = revenueAccounts.map((a) => a.id);

    const revenueLines = await this.prisma.db.journalLine.findMany({
      where: {
        accountId: { in: revenueIds },
        credit: { gt: 0 },
        journalEntry: { entryDate: { gte: from, lte: to } },
      },
      include: { account: true },
    });

    // Total Expense = semua JournalLine DEBIT di akun 5xxx
    const expenseAccounts = await this.prisma.db.chartOfAccount.findMany({
      where: { type: 'EXPENSE', isActive: true },
    });
    const expenseIds = expenseAccounts.map((a) => a.id);

    const expenseLines = await this.prisma.db.journalLine.findMany({
      where: {
        accountId: { in: expenseIds },
        debit: { gt: 0 },
        journalEntry: { entryDate: { gte: from, lte: to } },
      },
      include: { account: true },
    });

    const totalRevenue = revenueLines.reduce((sum, l) => sum.plus(l.credit), new Decimal(0));
    const totalExpense = expenseLines.reduce((sum, l) => sum.plus(l.debit), new Decimal(0));
    const netProfit = totalRevenue.minus(totalExpense);

    // Breakdown per akun
    const revenueByAccount: Record<string, number> = {};
    for (const l of revenueLines) {
      const key = `${l.account.code} - ${l.account.name}`;
      revenueByAccount[key] = (revenueByAccount[key] ?? 0) + l.credit.toNumber();
    }

    const expenseByAccount: Record<string, number> = {};
    for (const l of expenseLines) {
      const key = `${l.account.code} - ${l.account.name}`;
      expenseByAccount[key] = (expenseByAccount[key] ?? 0) + l.debit.toNumber();
    }

    return {
      message: 'Laporan Profit & Loss',
      data: {
        period: { from: from.toISOString().split('T')[0], to: to.toISOString().split('T')[0] },
        totalRevenue: totalRevenue.toNumber(),
        totalExpense: totalExpense.toNumber(),
        netProfit: netProfit.toNumber(),
        status: netProfit.greaterThanOrEqualTo(0) ? 'LABA' : 'RUGI',
        revenueByAccount,
        expenseByAccount,
      },
    };
  }

  async getGeneralLedger(query: GeneralLedgerQueryDto) {
    const from = query.from ? new Date(query.from) : new Date(new Date().setDate(1));
    const to = query.to ? new Date(query.to + 'T23:59:59') : new Date();

    const where: any = {
      journalEntry: { entryDate: { gte: from, lte: to } },
    };
    if (query.accountId) where.accountId = query.accountId;

    const lines = await this.prisma.db.journalLine.findMany({
      where,
      include: {
        account: true,
        journalEntry: true,
      },
      orderBy: { journalEntry: { entryDate: 'asc' } },
    });

    return {
      message: 'General Ledger',
      total: lines.length,
      data: lines,
    };
  }
}

```

---

## src/accounting/dto/accounting.dto.ts

```typescript
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

```
