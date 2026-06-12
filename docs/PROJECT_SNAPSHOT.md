
========== FILE: prisma/schema.prisma ==========
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
}

model User {
  id        String   @id @default(uuid())
  name      String
  email     String   @unique
  password  String
  role      Role     @default(KASIR)
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())

  journalEntries JournalEntry[]
  expenses       Expense[]
  transactions   Transaction[]
}

model Patient {
  id              String        @id @default(uuid())
  name            String
  medicalRecordNo String        @unique
  phone           String?
  nik             String?       @unique
  address         String?
  jenisKelamin    JenisKelamin?
  noBpjs          String?
  insuranceType   InsuranceType @default(UMUM)
  isActive        Boolean       @default(true)
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt

  transactions Transaction[]
}

model Item {
  id       String   @id @default(uuid())
  name     String
  type     ItemType
  price    Float
  unit     String?
  kodeObat String?

  transactionItems TransactionItem[]
}

model Transaction {
  id              String            @id @default(uuid())
  patientId       String
  userId          String
  status          TransactionStatus @default(DRAFT)
  paymentMethod   PaymentMethod?
  subtotal        Float             @default(0)
  tax             Float             @default(0)
  adminFee        Float             @default(0)
  total           Float             @default(0)
  paidAmount      Float             @default(0)
  bpjsAmount      Float             @default(0)
  nonBpjsAmount   Float             @default(0)
  qrisUrl         String?
  qrisToken       String?
  midtransOrderId String?           @unique
  rmeBillingId    String?
  rekamMedisId    String?
  wmsOrderId      String?
  createdAt       DateTime          @default(now())
  updatedAt       DateTime          @updatedAt
  paidAt          DateTime?

  patient      Patient           @relation(fields: [patientId], references: [id])
  user         User              @relation(fields: [userId], references: [id])
  items        TransactionItem[]
  payments     Payment[]
  syncLogs     SyncLog[]
  journalEntry JournalEntry?
}

model TransactionItem {
  id            String @id @default(uuid())
  transactionId String
  itemId        String
  quantity      Int
  price         Float
  subtotal      Float

  transaction Transaction @relation(fields: [transactionId], references: [id])
  item        Item        @relation(fields: [itemId], references: [id])
}

model Payment {
  id              String        @id @default(uuid())
  transactionId   String
  method          PaymentMethod
  amount          Float
  status          PaymentStatus @default(PENDING)
  midtransOrderId String?       @unique
  reference       String?
  isBpjsCoverage  Boolean       @default(false)
  paidAt          DateTime?
  createdAt       DateTime      @default(now())

  transaction Transaction @relation(fields: [transactionId], references: [id])

  @@map("payments")
}

// ─── SYNC LOG ────────────────────────────────────────────────────

model SyncLog {
  id            String      @id @default(uuid())
  transactionId String
  service       SyncService
  action        String      // create_order, payment_callback, pay_billing, dll
  status        SyncStatus
  requestBody   Json?       // payload yang dikirim ke service eksternal
  responseBody  Json?       // response dari service eksternal
  errorMessage  String?     // pesan error kalau gagal
  httpStatus    Int?        // HTTP status code dari response
  durationMs    Int?        // berapa lama request berlangsung (ms)
  createdAt     DateTime    @default(now())

  transaction Transaction @relation(fields: [transactionId], references: [id])

  @@map("sync_logs")
}

// ─── ENUMS ───────────────────────────────────────────────────────

enum Role {
  SUPER_ADMIN
  MANAGER
  KASIR
  FINANCE_STAFF
}

enum JenisKelamin {
  LAKI_LAKI
  PEREMPUAN
}

enum InsuranceType {
  UMUM
  BPJS
  VOUCHER
}

enum ItemType {
  OBAT
  LAYANAN
}

enum TransactionStatus {
  DRAFT
  PENDING_PAYMENT
  PARTIAL
  LUNAS
  CANCELLED
}

enum PaymentMethod {
  CASH
  QRIS
  DEBIT
  TRANSFER
  BPJS
}

enum PaymentStatus {
  PENDING
  PAID
  CANCELLED
  REFUNDED
}

enum SyncService {
  WMS
  RME
}

enum SyncStatus {
  SUCCESS
  FAILED
  PENDING
}

// ─── ACCOUNTING ENGINE ───────────────────────────────────────────

enum AccountType {
  ASSET
  LIABILITY
  EQUITY
  REVENUE
  EXPENSE
}

enum NormalBalance {
  DEBIT
  CREDIT
}

enum JournalType {
  INCOME
  EXPENSE
  ADJUSTMENT
}

enum ExpenseCategory {
  PAYROLL
  STOCK_PURCHASE
  OPERATIONAL
  MAINTENANCE
  OTHER
}

model ChartOfAccount {
  id            String        @id @default(uuid())
  code          String        @unique
  name          String
  type          AccountType
  normalBalance NormalBalance
  description   String?
  isActive      Boolean       @default(true)
  createdAt     DateTime      @default(now())

  journalLines JournalLine[]
  expenses     Expense[]

  @@map("chart_of_accounts")
}

model JournalEntry {
  id          String      @id @default(uuid())
  entryDate   DateTime    @default(now())
  description String
  type        JournalType
  referenceNo String?

  transactionId String? @unique
  expenseId     String? @unique

  createdBy String
  createdAt DateTime @default(now())

  transaction Transaction?  @relation(fields: [transactionId], references: [id])
  user        User          @relation(fields: [createdBy], references: [id])
  lines       JournalLine[]
  expense     Expense?

  @@map("journal_entries")
}

model JournalLine {
  id             String  @id @default(uuid())
  journalEntryId String
  accountId      String
  debit          Decimal @default(0) @db.Decimal(12, 2)
  credit         Decimal @default(0) @db.Decimal(12, 2)
  description    String?

  journalEntry JournalEntry   @relation(fields: [journalEntryId], references: [id])
  account      ChartOfAccount @relation(fields: [accountId], references: [id])

  @@map("journal_lines")
}

model Expense {
  id          String          @id @default(uuid())
  category    ExpenseCategory
  amount      Decimal         @db.Decimal(12, 2)
  description String
  expenseDate DateTime
  accountId   String
  createdBy   String
  createdAt   DateTime        @default(now())

  journalEntryId String? @unique

  account      ChartOfAccount @relation(fields: [accountId], references: [id])
  user         User           @relation(fields: [createdBy], references: [id])
  journalEntry JournalEntry?  @relation(fields: [journalEntryId], references: [id])

  @@map("expenses")
}

========== FILE: prisma/seed.ts ==========
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';

const connectionString = process.env.DATABASE_URL!;
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter } as any);

async function main() {
  console.log('🌱 Seeding database...\n');

  // ─── 1. USERS (1 per role) ──────────────────────────────

  const defaultPassword = await bcrypt.hash('password123', 12);

  const users = [
    { name: 'Super Admin',    email: 'admin@klinik.com',    role: 'SUPER_ADMIN' as const },
    { name: 'Manager Klinik', email: 'manager@klinik.com',  role: 'MANAGER' as const },
    { name: 'Kasir Satu',     email: 'kasir@klinik.com',    role: 'KASIR' as const },
    { name: 'Staff Finance',  email: 'finance@klinik.com',  role: 'FINANCE_STAFF' as const },
  ];

  for (const u of users) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: { name: u.name, role: u.role },
      create: { name: u.name, email: u.email, password: defaultPassword, role: u.role },
    });
    console.log(`  ✅ User: ${u.email} (${u.role})`);
  }

  // ─── 2. ITEMS (3 obat + 2 layanan) ─────────────────────

  const items = [
    { name: 'Paracetamol 500mg',  type: 'OBAT' as const,    price: 5000,    unit: 'tablet' },
    { name: 'Amoxicillin 500mg',  type: 'OBAT' as const,    price: 8000,    unit: 'kapsul' },
    { name: 'Vitamin C 1000mg',   type: 'OBAT' as const,    price: 15000,   unit: 'tablet' },
    { name: 'Konsultasi Dokter',  type: 'LAYANAN' as const, price: 100000,  unit: 'kunjungan' },
    { name: 'Tindakan Nebulizer', type: 'LAYANAN' as const, price: 75000,   unit: 'tindakan' },
  ];

  for (const item of items) {
    const existing = await prisma.item.findFirst({ where: { name: item.name } });
    if (!existing) {
      await prisma.item.create({ data: item });
      console.log(`  ✅ Item: ${item.name} — Rp ${item.price.toLocaleString('id-ID')}`);
    } else {
      console.log(`  ⏭️  Item: ${item.name} (sudah ada)`);
    }
  }

  // ─── 3. PATIENTS (1 BPJS + 2 UMUM) ────────────────────

  const patients = [
    {
      name: 'Budi Santoso',
      medicalRecordNo: 'RM-202606-0001',
      phone: '08123456789',
      nik: '3404010101900001',
      jenisKelamin: 'LAKI_LAKI' as const,
      noBpjs: '0001234567890',
      insuranceType: 'BPJS' as const,
      address: 'Jl. Merdeka No. 10, Jakarta Pusat',
    },
    {
      name: 'Siti Rahmawati',
      medicalRecordNo: 'RM-202606-0002',
      phone: '08198765432',
      nik: '3404010201950002',
      jenisKelamin: 'PEREMPUAN' as const,
      insuranceType: 'UMUM' as const,
      address: 'Jl. Sudirman No. 25, Jakarta Selatan',
    },
    {
      name: 'Ahmad Kurniawan',
      medicalRecordNo: 'RM-202606-0003',
      phone: '08567891234',
      nik: '3404010301880003',
      jenisKelamin: 'LAKI_LAKI' as const,
      insuranceType: 'UMUM' as const,
      address: 'Jl. Gatot Subroto No. 5, Bandung',
    },
  ];

  for (const p of patients) {
    await prisma.patient.upsert({
      where: { medicalRecordNo: p.medicalRecordNo },
      update: { name: p.name, phone: p.phone, insuranceType: p.insuranceType },
      create: p,
    });
    console.log(`  ✅ Pasien: ${p.name} (${p.medicalRecordNo}) — ${p.insuranceType}`);
  }

  // ─── 4. CHART OF ACCOUNTS (COA) ────────────────────────

  const accounts = [
    // Aset
    { code: '1100', name: 'Kas',               type: 'ASSET' as const,    normalBalance: 'DEBIT' as const,  description: 'Kas tunai klinik' },
    { code: '1200', name: 'Bank',              type: 'ASSET' as const,    normalBalance: 'DEBIT' as const,  description: 'Rekening bank klinik' },
    { code: '1300', name: 'Piutang BPJS',      type: 'ASSET' as const,    normalBalance: 'DEBIT' as const,  description: 'Tagihan ke BPJS' },
    { code: '1400', name: 'Piutang Pasien',    type: 'ASSET' as const,    normalBalance: 'DEBIT' as const,  description: 'Outstanding invoice pasien' },

    // Kewajiban
    { code: '2100', name: 'Hutang Supplier',   type: 'LIABILITY' as const, normalBalance: 'CREDIT' as const, description: 'Hutang pembelian obat ke supplier' },

    // Modal
    { code: '3100', name: 'Modal Pemilik',     type: 'EQUITY' as const,   normalBalance: 'CREDIT' as const, description: 'Modal awal klinik' },

    // Pendapatan
    { code: '4100', name: 'Pendapatan Jasa',   type: 'REVENUE' as const,  normalBalance: 'CREDIT' as const, description: 'Pendapatan dari layanan medis' },
    { code: '4200', name: 'Pendapatan Obat',   type: 'REVENUE' as const,  normalBalance: 'CREDIT' as const, description: 'Pendapatan dari penjualan obat' },

    // Beban
    { code: '5100', name: 'Beban Gaji',        type: 'EXPENSE' as const,  normalBalance: 'DEBIT' as const,  description: 'Gaji karyawan & dokter' },
    { code: '5200', name: 'Beban Obat',        type: 'EXPENSE' as const,  normalBalance: 'DEBIT' as const,  description: 'HPP pembelian obat' },
    { code: '5300', name: 'Beban Operasional', type: 'EXPENSE' as const,  normalBalance: 'DEBIT' as const,  description: 'Listrik, air, internet, dll' },
    { code: '5400', name: 'Beban Perawatan',   type: 'EXPENSE' as const,  normalBalance: 'DEBIT' as const,  description: 'Maintenance peralatan' },
    { code: '5500', name: 'Beban Lain-lain',   type: 'EXPENSE' as const,  normalBalance: 'DEBIT' as const,  description: 'Pengeluaran lainnya' },
  ];

  for (const acc of accounts) {
    await prisma.chartOfAccount.upsert({
      where: { code: acc.code },
      update: { name: acc.name, description: acc.description },
      create: acc,
    });
    console.log(`  ✅ COA: ${acc.code} — ${acc.name}`);
  }

  console.log('\n✅ Seed selesai!\n');
  console.log('📋 Login credentials (semua password: password123):');
  console.log('   admin@klinik.com    → SUPER_ADMIN');
  console.log('   manager@klinik.com  → MANAGER');
  console.log('   kasir@klinik.com    → KASIR');
  console.log('   finance@klinik.com  → FINANCE_STAFF\n');
}

main()
  .catch((e) => {
    console.error('❌ Seed gagal:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

========== FILE: src/accounting/accounting.controller.ts ==========
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

========== FILE: src/accounting/accounting.module.ts ==========
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

========== FILE: src/accounting/accounting.service.ts ==========
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

========== FILE: src/accounting/dto/accounting.dto.ts ==========
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

========== FILE: src/app.controller.ts ==========
import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
}

========== FILE: src/app.module.ts ==========
// src/app.module.ts
// OVERWRITE file yang sudah ada

import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { BillingModule } from './billing/billing.module';
import { PaymentModule } from './payment/payment.module';
import { ItemsModule } from './items/items.module';
import { AccountingModule } from './accounting/accounting.module';
import { PatientsModule } from './patients/patients.module';
import { RmeModule } from './rme/rme.module';
import { WmsModule } from './wms/wms.module';
import { InvoiceModule } from './invoice/invoice.module';
import { SyncLogModule } from './sync-log/sync-log.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    PatientsModule,
    RmeModule,
    WmsModule,
    BillingModule,
    PaymentModule,
    InvoiceModule,
    ItemsModule,
    SyncLogModule,
    AccountingModule, // ← baru
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

========== FILE: src/app.service.ts ==========
import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return 'Hello World!';
  }
}

========== FILE: src/auth/auth.controller.ts ==========
import { Controller, Post, Get, Body, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { Roles } from './decorators/roles.decorator';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // ─── PUBLIC ─────────────────────────────────────────────

  @Post('register')
  @ApiOperation({
    summary: 'Register user baru (publik — role otomatis KASIR)',
    description:
      'Endpoint publik untuk self-registration kasir. ' +
      'Untuk membuat user dengan role lain, gunakan POST /auth/create-user (SUPER_ADMIN only).',
  })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @ApiOperation({
    summary: 'Login dan dapatkan JWT token',
    description:
      'Gunakan access_token di response sebagai Bearer token untuk endpoint lain. ' +
      'Token berisi: sub (userId), email, dan role.',
  })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  // ─── PROTECTED ──────────────────────────────────────────

  @Post('create-user')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Buat user dengan role tertentu (SUPER_ADMIN only)',
    description:
      'Hanya SUPER_ADMIN yang boleh membuat user dengan role ' +
      'MANAGER, FINANCE_STAFF, KASIR, atau SUPER_ADMIN. ' +
      'Jika field role tidak diisi, default KASIR.',
  })
  createUser(@Body() dto: CreateUserDto) {
    return this.authService.createUser(dto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Profil user yang sedang login',
    description: 'Mengembalikan data user berdasarkan JWT token yang dikirim.',
  })
  getMe(@Request() req: any) {
    return this.authService.getMe(req.user.userId);
  }
}

========== FILE: src/auth/auth.module.ts ==========
// src/auth/auth.module.ts
//
// PERUBAHAN dari versi sebelumnya:
// + Import PassportModule (wajib untuk strategy)
// + Import ConfigModule untuk env yang aman
// + Daftarkan JwtStrategy sebagai provider
// + Export JwtAuthGuard dan RolesGuard agar bisa dipakai modul lain

import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({
      secret: process.env.JWT_SECRET ?? 'fallback-secret-ganti-di-env',
      signOptions: {
        expiresIn: (process.env.JWT_EXPIRES_IN ?? '1d') as any,
      },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,   // strategy untuk verify token
    JwtAuthGuard,  // guard untuk protect endpoint
    RolesGuard,    // guard untuk cek role
  ],
  exports: [
    JwtModule,
    JwtAuthGuard,  // export agar bisa dipakai di modul lain
    RolesGuard,    // export agar bisa dipakai di modul lain
  ],
})
export class AuthModule {}

========== FILE: src/auth/auth.service.ts ==========
import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { CreateUserDto } from './dto/create-user.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
  ) {}

  // ─── PUBLIC REGISTER (selalu KASIR) ─────────────────────

  async register(dto: RegisterDto) {
    const existing = await this.prisma.db.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) throw new ConflictException('Email sudah terdaftar');

    const hashed = await bcrypt.hash(dto.password, 12);

    const user = await this.prisma.db.user.create({
      data: {
        name: dto.name,
        email: dto.email,
        password: hashed,
        // role tidak diisi → default KASIR dari Prisma schema
      },
    });

    return {
      message: 'Register berhasil',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    };
  }

  // ─── LOGIN ──────────────────────────────────────────────

  async login(dto: LoginDto) {
    const user = await this.prisma.db.user.findUnique({
      where: { email: dto.email },
    });
    if (!user) throw new UnauthorizedException('Email atau password salah');

    // Cek apakah user masih aktif
    if (!user.isActive) {
      throw new UnauthorizedException('Akun tidak aktif. Hubungi admin.');
    }

    const valid = await bcrypt.compare(dto.password, user.password);
    if (!valid) throw new UnauthorizedException('Email atau password salah');

    const token = await this.jwt.signAsync({
      sub: user.id,
      email: user.email,
      role: user.role,
    });

    return {
      message: 'Login berhasil',
      access_token: token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    };
  }

  // ─── CREATE USER (SUPER_ADMIN only) ─────────────────────

  async createUser(dto: CreateUserDto) {
    const existing = await this.prisma.db.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) throw new ConflictException('Email sudah terdaftar');

    const hashed = await bcrypt.hash(dto.password, 12);

    const user = await this.prisma.db.user.create({
      data: {
        name: dto.name,
        email: dto.email,
        password: hashed,
        role: dto.role ?? 'KASIR',
      },
    });

    return {
      message: `User berhasil dibuat dengan role ${user.role}`,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    };
  }

  // ─── GET CURRENT USER ───────────────────────────────────

  async getMe(userId: string) {
    const user = await this.prisma.db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    if (!user) throw new NotFoundException('User tidak ditemukan');

    return { user };
  }
}

========== FILE: src/auth/decorators/roles.decorator.ts ==========
// src/auth/decorators/roles.decorator.ts
//
// FUNGSI: Custom decorator untuk menandai role apa yang boleh akses endpoint.
// Cara pakai: @Roles('SUPER_ADMIN', 'MANAGER') di atas method controller.
//
// Decorator ini hanya MENYIMPAN metadata — yang membaca adalah RolesGuard.
// Tanpa RolesGuard, decorator ini tidak punya efek apapun.

import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

// Contoh pakai:
//   @Roles('SUPER_ADMIN')            → hanya SUPER_ADMIN
//   @Roles('SUPER_ADMIN', 'MANAGER') → SUPER_ADMIN atau MANAGER
//   @Roles('KASIR', 'MANAGER', 'SUPER_ADMIN') → semua role boleh (tapi tetap harus login)
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

========== FILE: src/auth/dto/create-user.dto.ts ==========
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength, IsEnum, IsOptional } from 'class-validator';

/**
 * Enum harus MATCH dengan enum Role di schema.prisma.
 * Dipakai untuk validasi + Swagger dropdown.
 */
export enum RoleEnum {
  KASIR = 'KASIR',
  MANAGER = 'MANAGER',
  FINANCE_STAFF = 'FINANCE_STAFF',
  SUPER_ADMIN = 'SUPER_ADMIN',
}

export class CreateUserDto {
  @ApiProperty({ example: 'Manager Klinik', description: 'Nama lengkap user' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'manager@klinik.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'password123', minLength: 6 })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiPropertyOptional({
    enum: RoleEnum,
    example: RoleEnum.MANAGER,
    description: 'Role user. Default: KASIR jika tidak diisi.',
  })
  @IsOptional()
  @IsEnum(RoleEnum)
  role?: RoleEnum;
}

========== FILE: src/auth/dto/login.dto.ts ==========
import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'kasir@klinik.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'password123' })
  @IsString()
  password: string;
}
========== FILE: src/auth/dto/register.dto.ts ==========
import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'Kasir Satu', description: 'Nama lengkap user' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'kasir@klinik.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'password123', minLength: 6 })
  @IsString()
  @MinLength(6)
  password: string;

  // Role TIDAK ada di sini — register publik selalu KASIR.
  // Untuk buat user dengan role lain → POST /auth/create-user (SUPER_ADMIN only)
}

========== FILE: src/auth/guards/jwt-auth.guard.ts ==========
// src/auth/guards/jwt-auth.guard.ts
//
// FUNGSI: Guard yang dipakai di controller untuk melindungi endpoint.
// Cara pakai: @UseGuards(JwtAuthGuard) di atas controller atau method.
//
// Guard ini otomatis memanggil JwtStrategy.validate() di balik layar.
// Kalau token tidak ada / expired / tidak valid → 401 Unauthorized otomatis.

import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}

========== FILE: src/auth/guards/roles.guard.ts ==========
// src/auth/guards/roles.guard.ts
//
// FUNGSI: Guard kedua yang cek apakah role user sesuai dengan @Roles() di endpoint.
// Selalu dipakai BERSAMA JwtAuthGuard — tidak bisa standalone.
//
// Urutan eksekusi:
//   JwtAuthGuard (cek token valid) → RolesGuard (cek role sesuai)
//
// Jika endpoint tidak punya @Roles() → semua role yang sudah login boleh akses.

import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Ambil role yang dibutuhkan dari metadata @Roles()
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(), // cek di level method dulu
      context.getClass(),   // fallback ke level class
    ]);

    // Kalau tidak ada @Roles() → semua yang sudah login boleh akses
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    // Ambil req.user yang sudah diisi oleh JwtAuthGuard
    const { user } = context.switchToHttp().getRequest();

    // Cek apakah role user ada di list requiredRoles
    const hasRole = requiredRoles.includes(user?.role);

    if (!hasRole) {
      throw new ForbiddenException(
        `Akses ditolak. Endpoint ini membutuhkan role: ${requiredRoles.join(' / ')}`
      );
    }

    return true;
  }
}

========== FILE: src/auth/jwt.strategy.ts ==========
// src/auth/jwt.strategy.ts
//
// FUNGSI: Memberi tahu NestJS cara memvalidasi JWT yang masuk.
// Dipanggil otomatis oleh JwtAuthGuard setiap kali ada request dengan
// header "Authorization: Bearer <token>".
//
// Alurnya:
//   Request masuk → JwtAuthGuard → JwtStrategy.validate()
//   → return payload → disimpan di req.user

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

// Tipe payload yang ada di dalam JWT kita
// Sesuai dengan yang di-sign di auth.service.ts:
//   { sub: user.id, email: user.email, role: user.role }
export interface JwtPayload {
  sub: string;   // user ID
  email: string;
  role: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      // Ambil token dari header "Authorization: Bearer <token>"
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),

      // Tolak token yang sudah expired
      ignoreExpiration: false,

      // Secret harus sama dengan yang dipakai saat sign di auth.service.ts
      secretOrKey: process.env.JWT_SECRET ?? 'fallback-secret-ganti-di-env',
    });
  }

  // Dipanggil setelah token berhasil diverifikasi
  // Return value-nya akan tersimpan di req.user
  async validate(payload: JwtPayload) {
    if (!payload.sub || !payload.email) {
      throw new UnauthorizedException('Token tidak valid');
    }

    // Ini yang bisa diakses via @Request() req → req.user
    return {
      userId: payload.sub,
      email: payload.email,
      role: payload.role,
    };
  }
}

========== FILE: src/billing/billing.controller.ts ==========
import {
  Controller, Post, Get, Delete, Body, Param, Query, Request, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { BillingService } from './billing.service';
import { CreateBillingDto } from './dto/create-billing.dto';
import { AddPaymentDto } from './dto/add-payment.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('Billing')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  // ─── CREATE TRANSACTION ──────────────────────────────────

  @Post()
  @Roles('KASIR', 'MANAGER', 'SUPER_ADMIN')
  @ApiOperation({
    summary: 'Buat transaksi baru',
    description:
      'Buat billing POS. Jika `rekamMedisId` diisi, sistem otomatis fetch ' +
      'billing dari RME — dapat `bpjsAmount`, `nonBpjsAmount`, dan `rmeBillingId`. ' +
      'Response berisi `remainingAmount` untuk panduan split bill.',
  })
  create(@Body() dto: CreateBillingDto, @Request() req: any) {
    return this.billingService.createTransaction(dto, req.user.userId);
  }

  // ─── ADD PAYMENT (SPLIT BILL) ────────────────────────────

  @Post(':id/pay')
  @Roles('KASIR', 'MANAGER', 'SUPER_ADMIN')
  @ApiOperation({
    summary: 'Tambah pembayaran ke transaksi (split bill)',
    description:
      'Tambahkan satu metode pembayaran ke transaksi yang sudah ada. ' +
      'Bisa dipanggil beberapa kali untuk split bill (BPJS + QRIS, Cash + QRIS, dll). ' +
      'CASH/DEBIT/TRANSFER/BPJS langsung PAID. ' +
      'QRIS akan return snapToken — tunggu webhook Midtrans untuk konfirmasi. ' +
      'Status otomatis jadi LUNAS saat paidAmount >= total.',
  })
  addPayment(
    @Param('id') id: string,
    @Body() dto: AddPaymentDto,
    @Request() req: any,
  ) {
    return this.billingService.addPayment(id, dto, req.user.userId);
  }

  // ─── GET PAYMENTS (histori split bill) ──────────────────

  @Get(':id/payments')
  @Roles('KASIR', 'MANAGER', 'SUPER_ADMIN', 'FINANCE_STAFF')
  @ApiOperation({
    summary: 'Histori pembayaran per transaksi',
    description:
      'Lihat semua pembayaran yang sudah dilakukan untuk satu transaksi. ' +
      'Include: paidAmount, remainingAmount, breakdown per metode, status masing-masing payment.',
  })
  getPayments(@Param('id') id: string) {
    return this.billingService.getPayments(id);
  }

  @Get(':id/payments/:paymentId/status')
  @Roles('KASIR', 'MANAGER', 'SUPER_ADMIN', 'FINANCE_STAFF')
  @ApiOperation({
    summary: 'Polling status payment QRIS',
    description:
      'Cek status satu payment secara real-time. ' +
      'FE polling endpoint ini setiap 3 detik setelah QR ditampilkan ke pasien. ' +
      'Saat status berubah PENDING → PAID, transaksi otomatis update ke LUNAS. ' +
      'Stop polling saat payment.status = PAID atau CANCELLED.',
  })
  getPaymentStatus(
    @Param('id') id: string,
    @Param('paymentId') paymentId: string,
  ) {
    return this.billingService.getPaymentStatus(id, paymentId);
  }

  // ─── CANCEL PENDING QRIS ────────────────────────────────

  @Delete(':id/payments/:paymentId/cancel-qris')
  @Roles('KASIR', 'MANAGER', 'SUPER_ADMIN')
  @ApiOperation({
    summary: 'Batalkan QRIS yang masih pending',
    description:
      'Batalkan payment QRIS yang belum dibayar agar kasir bisa generate QRIS baru ' +
      'atau beralih ke metode lain.',
  })
  cancelPendingQris(
    @Param('id') id: string,
    @Param('paymentId') paymentId: string,
  ) {
    return this.billingService.cancelPendingQris(id, paymentId);
  }

  // ─── GET BILLING FROM RME ────────────────────────────────

  @Get('from-rme/:rekamMedisId')
  @Roles('KASIR', 'MANAGER', 'SUPER_ADMIN')
  @ApiOperation({
    summary: 'Preview billing dari RME by rekamMedisId',
    description:
      'Ambil data billing RME sebelum transaksi dibuat. ' +
      'Return: rmeBillingId, totalTagihan, bpjsTotal, nonBpjsTotal, items. ' +
      'bpjsTotal = nominal yang ditanggung BPJS, nonBpjsTotal = yang harus dibayar pasien.',
  })
  getBillingFromRme(@Param('rekamMedisId') rekamMedisId: string) {
    return this.billingService.getBillingFromRme(rekamMedisId);
  }

  // ─── LIST ALL ────────────────────────────────────────────

  @Get()
  @Roles('KASIR', 'MANAGER', 'SUPER_ADMIN', 'FINANCE_STAFF')
  @ApiOperation({ summary: 'Daftar semua transaksi + filter' })
  @ApiQuery({ name: 'status', required: false, enum: ['DRAFT', 'PENDING_PAYMENT', 'PARTIAL', 'LUNAS', 'CANCELLED'] })
  @ApiQuery({ name: 'paymentMethod', required: false, enum: ['CASH', 'QRIS', 'DEBIT', 'TRANSFER', 'BPJS'] })
  @ApiQuery({ name: 'patientId', required: false })
  @ApiQuery({ name: 'from', required: false, example: '2026-06-01' })
  @ApiQuery({ name: 'to', required: false, example: '2026-06-30' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  findAll(
    @Query('status') status?: string,
    @Query('paymentMethod') paymentMethod?: string,
    @Query('patientId') patientId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.billingService.findAll({
      status, paymentMethod, patientId, from, to,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  // ─── OUTSTANDING ─────────────────────────────────────────

  @Get('outstanding')
  @Roles('KASIR', 'MANAGER', 'SUPER_ADMIN', 'FINANCE_STAFF')
  @ApiOperation({
    summary: 'Daftar invoice belum lunas (PENDING_PAYMENT + PARTIAL)',
    description: 'Menampilkan transaksi yang belum lunas, termasuk yang sudah bayar sebagian (PARTIAL).',
  })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  findOutstanding(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.billingService.findOutstanding({
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  // ─── SUMMARY ─────────────────────────────────────────────

  @Get('summary')
  @Roles('MANAGER', 'SUPER_ADMIN', 'FINANCE_STAFF')
  @ApiOperation({ summary: 'Ringkasan transaksi & pendapatan (dashboard)' })
  @ApiQuery({ name: 'from', required: false, example: '2026-06-01' })
  @ApiQuery({ name: 'to', required: false, example: '2026-06-30' })
  getSummary(@Query('from') from?: string, @Query('to') to?: string) {
    return this.billingService.getSummary({ from, to });
  }

  // ─── DETAIL ──────────────────────────────────────────────

  @Get(':id')
  @Roles('KASIR', 'MANAGER', 'SUPER_ADMIN', 'FINANCE_STAFF')
  @ApiOperation({
    summary: 'Detail transaksi by ID',
    description: 'Include: items, payments history, paidAmount, remainingAmount.',
  })
  findOne(@Param('id') id: string) {
    return this.billingService.getTransaction(id);
  }
}

========== FILE: src/billing/billing.module.ts ==========
import { Module } from '@nestjs/common';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { AuthModule } from '../auth/auth.module';
import { RmeModule } from '../rme/rme.module';
import { WmsModule } from '../wms/wms.module';

@Module({
  imports: [AuthModule, RmeModule, WmsModule],
  controllers: [BillingController],
  providers: [BillingService],
})
export class BillingModule {}

========== FILE: src/billing/billing.service.ts ==========
import {
  Injectable, NotFoundException, BadRequestException, Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBillingDto } from './dto/create-billing.dto';
import { AddPaymentDto } from './dto/add-payment.dto';
import { RmeService } from '../rme/rme.service';
import { WmsService } from '../wms/wms.service';
import * as midtransClient from 'midtrans-client';

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);
  private snap: midtransClient.Snap;

  constructor(
    private prisma: PrismaService,
    private rmeService: RmeService,
    private wmsService: WmsService,
  ) {
    this.snap = new midtransClient.Snap({
      isProduction: process.env.MIDTRANS_IS_PRODUCTION === 'true',
      serverKey: process.env.MIDTRANS_SERVER_KEY!,
      clientKey: process.env.MIDTRANS_CLIENT_KEY!,
    });
  }

  // ─── GET BILLING FROM RME ────────────────────────────────

  async getBillingFromRme(rekamMedisId: string) {
    const rmeBilling = await this.rmeService.getBillingByRekamMedis(rekamMedisId);

    if (!rmeBilling) {
      return { message: 'Data billing RME tidak tersedia', data: null, rmeAvailable: false };
    }

    const bpjsTotal = rmeBilling.items
      .filter((i) => i.isBpjs)
      .reduce((sum, i) => sum + i.harga * i.jumlah, 0);
    const nonBpjsTotal = rmeBilling.items
      .filter((i) => !i.isBpjs)
      .reduce((sum, i) => sum + i.harga * i.jumlah, 0);

    return {
      message: 'Data billing RME berhasil diambil',
      rmeAvailable: true,
      data: {
        rmeBillingId: rmeBilling.id,
        rekamMedisId: rmeBilling.rekamMedisId,
        status: rmeBilling.status,
        totalTagihan: rmeBilling.total,
        bpjsTotal,
        nonBpjsTotal,
        items: rmeBilling.items,
      },
    };
  }

  // ─── CREATE TRANSACTION ──────────────────────────────────

  async createTransaction(dto: CreateBillingDto, userId: string) {
    // 1. Validasi items POS
    const itemIds = dto.items.map((i) => i.itemId);
    const items = await this.prisma.db.item.findMany({ where: { id: { in: itemIds } } });

    if (items.length !== itemIds.length) {
      throw new NotFoundException('Satu atau lebih item tidak ditemukan');
    }

    // 2. Hitung subtotal POS items
    let subtotal = 0;
    const transactionItems = dto.items.map((cartItem) => {
      const item = items.find((i) => i.id === cartItem.itemId)!;
      const itemSubtotal = item.price * cartItem.quantity;
      subtotal += itemSubtotal;
      return { itemId: cartItem.itemId, quantity: cartItem.quantity, price: item.price, subtotal: itemSubtotal };
    });

    // 3. Resolve RME billing (opsional)
    let rmeBillingId = dto.rmeBillingId ?? null;
    let bpjsAmount = 0;
    let nonBpjsAmount = 0;

    if (dto.rekamMedisId) {
      const rmeBilling = await this.rmeService.getBillingByRekamMedis(dto.rekamMedisId);
      if (rmeBilling) {
        rmeBillingId = rmeBilling.id;
        bpjsAmount = rmeBilling.items.filter((i) => i.isBpjs).reduce((sum, i) => sum + i.harga * i.jumlah, 0);
        nonBpjsAmount = rmeBilling.items.filter((i) => !i.isBpjs).reduce((sum, i) => sum + i.harga * i.jumlah, 0);
      }
    }

    // 4. Hitung total
    const isBpjs = dto.paymentMethod === 'BPJS';
    const hasVoucher = dto.voucherCode && dto.voucherCode.trim().length > 0;
    const isFullyCovered = isBpjs || hasVoucher;
    const posTotal = subtotal;
    const rmeNonBpjsTotal = nonBpjsAmount;
    const total = isFullyCovered ? 0 : posTotal + rmeNonBpjsTotal;

    // 5. Buat transaksi dulu (dapat ID)
    const tempId = `TEMP-${Date.now()}`;

    const transaction = await this.prisma.db.transaction.create({
      data: {
        patientId: dto.patientId,
        userId,
        paymentMethod: dto.paymentMethod as any,
        subtotal,
        tax: 0,
        adminFee: 0,
        total,
        paidAmount: 0,
        bpjsAmount,
        nonBpjsAmount,
        status: 'PENDING_PAYMENT',
        rmeBillingId,
        rekamMedisId: dto.rekamMedisId ?? null,
        items: { create: transactionItems },
      },
      include: { items: { include: { item: true } } },
    });

    // 6. Buat WMS pharmacy order (opsional)
    let wmsOrderId: string | null = null;
    let wmsTotal = 0;

    if (dto.wmsItems && dto.wmsItems.length > 0) {
      const wmsOrder = await this.wmsService.createOrder({
        items: dto.wmsItems.map((i) => ({
          kodeObat: i.kodeObat,
          obatId: i.obatId,
          qty: i.qty,
          labelResep: i.labelResep,
        })),
        posTransactionId: transaction.id,
        rekamMedisId: dto.rekamMedisId,
        idempotencyKey: `trx-${transaction.id}`,
        notes: `Tebus obat untuk transaksi POS ${transaction.id}`,
      });

      if (wmsOrder) {
        wmsOrderId = wmsOrder.id;
        wmsTotal = wmsOrder.totalObat;

        // Update transaction dengan wmsOrderId dan total yang sudah include obat
        const newTotal = isFullyCovered ? 0 : total + wmsTotal;
        await this.prisma.db.transaction.update({
          where: { id: transaction.id },
          data: { wmsOrderId, total: newTotal },
        });

        this.logger.log(`✅ WMS order dibuat: ${wmsOrderId} | totalObat: ${wmsTotal}`);
      } else {
        this.logger.warn('WMS createOrder gagal — transaksi lanjut tanpa WMS');
      }
    }

    const finalTransaction = await this.prisma.db.transaction.findUnique({
      where: { id: transaction.id },
      include: { items: { include: { item: true } } },
    });

    return {
      message: 'Transaksi berhasil dibuat',
      data: {
        id: finalTransaction!.id,
        status: finalTransaction!.status,
        paymentMethod: finalTransaction!.paymentMethod,
        subtotal: finalTransaction!.subtotal,
        total: finalTransaction!.total,
        paidAmount: finalTransaction!.paidAmount,
        remainingAmount: finalTransaction!.total - finalTransaction!.paidAmount,
        bpjsAmount: finalTransaction!.bpjsAmount,
        nonBpjsAmount: finalTransaction!.nonBpjsAmount,
        rmeBillingId: finalTransaction!.rmeBillingId,
        rekamMedisId: finalTransaction!.rekamMedisId,
        wmsOrderId: finalTransaction!.wmsOrderId,
        wmsTotal,
        items: finalTransaction!.items.map((ti) => ({
          name: ti.item.name,
          type: ti.item.type,
          quantity: ti.quantity,
          price: ti.price,
          subtotal: ti.subtotal,
        })),
      },
    };
  }

  // ─── ADD PAYMENT (SPLIT BILL) ────────────────────────────

  async addPayment(transactionId: string, dto: AddPaymentDto, userId: string) {
    const transaction = await this.prisma.db.transaction.findUnique({
      where: { id: transactionId },
      include: { patient: true, payments: true },
    });

    if (!transaction) throw new NotFoundException('Transaksi tidak ditemukan');

    if (['LUNAS', 'CANCELLED'].includes(transaction.status)) {
      throw new BadRequestException(`Tidak bisa menambah pembayaran — status: ${transaction.status}`);
    }

    const pendingQris = transaction.payments.find((p) => p.method === 'QRIS' && p.status === 'PENDING');
    if (pendingQris && dto.method === 'QRIS') {
      throw new BadRequestException('Ada QRIS yang masih pending. Tunggu atau batalkan dulu.');
    }

    const remainingAmount = transaction.total - transaction.paidAmount;
    if (dto.amount > remainingAmount + 0.01) {
      throw new BadRequestException(`Nominal melebihi sisa tagihan. Sisa: Rp ${remainingAmount.toLocaleString('id-ID')}`);
    }

    // ─── CASH / DEBIT / TRANSFER / BPJS ─────────────────────
    if (dto.method !== 'QRIS') {
      const payment = await this.prisma.db.payment.create({
        data: {
          transactionId,
          method: dto.method as any,
          amount: dto.amount,
          status: 'PAID',
          reference: dto.reference,
          isBpjsCoverage: dto.isBpjsCoverage ?? false,
          paidAt: new Date(),
        },
      });

      const newPaidAmount = transaction.paidAmount + dto.amount;
      const newRemaining = transaction.total - newPaidAmount;
      const isFullyPaid = newRemaining <= 0.01;
      const newStatus = isFullyPaid ? 'LUNAS' : 'PARTIAL';

      await this.prisma.db.transaction.update({
        where: { id: transactionId },
        data: {
          paidAmount: newPaidAmount,
          status: newStatus as any,
          paymentMethod: dto.method as any,
          ...(isFullyPaid && { paidAt: new Date() }),
        },
      });

      if (isFullyPaid) {
        this.logger.log(`✅ Transaksi ${transactionId} LUNAS via ${dto.method}`);
        await this.rmeService.payBilling(
          transaction.rmeBillingId!,
          dto.method,
          `Lunas via Smart Clinic POS | TrxID: ${transactionId}`,
        ).catch(() => {});

        const wmsService = this.wmsService;
        if (transaction.wmsOrderId) {
          await wmsService.updatePaymentStatus(transaction.wmsOrderId, 'paid', {
            posTransactionId: transactionId,
            paidAt: new Date(),
            notes: `Lunas via ${dto.method}`,
          }).catch(() => {});
        }
      }

      return {
        message: isFullyPaid ? 'Pembayaran lunas!' : `Pembayaran ${dto.method} berhasil`,
        data: {
          payment: { id: payment.id, method: payment.method, amount: payment.amount, status: payment.status },
          transaction: {
            id: transactionId,
            status: newStatus,
            total: transaction.total,
            paidAmount: newPaidAmount,
            remainingAmount: Math.max(0, newRemaining),
          },
        },
      };
    }

    // ─── QRIS ────────────────────────────────────────────────
    const midtransOrderId = `POS-${transactionId.substring(0, 8)}-PAY-${Date.now()}`;

    const payment = await this.prisma.db.payment.create({
      data: {
        transactionId,
        method: 'QRIS',
        amount: dto.amount,
        status: 'PENDING',
        midtransOrderId,
        reference: dto.reference,
        isBpjsCoverage: false,
      },
    });

    const parameter = {
      transaction_details: { order_id: midtransOrderId, gross_amount: Math.round(dto.amount) },
      customer_details: {
        first_name: transaction.patient?.name ?? 'Pasien',
        phone: transaction.patient?.phone ?? '08000000000',
      },
      payment_type_filter: ['qris'],
    };

    const snapResponse = await this.snap.createTransaction(parameter);

    if (transaction.status === 'PENDING_PAYMENT') {
      await this.prisma.db.transaction.update({ where: { id: transactionId }, data: { status: 'PARTIAL' as any } });
    }

    return {
      message: 'QRIS berhasil di-generate',
      data: {
        payment: { id: payment.id, method: 'QRIS', amount: payment.amount, status: 'PENDING', midtransOrderId },
        snapToken: snapResponse.token,
        snapRedirectUrl: snapResponse.redirect_url,
        transaction: {
          id: transactionId, status: 'PARTIAL',
          total: transaction.total, paidAmount: transaction.paidAmount, remainingAmount,
        },
      },
    };
  }

  // ─── GET PAYMENTS ────────────────────────────────────────

  async getPayments(transactionId: string) {
    const transaction = await this.prisma.db.transaction.findUnique({
      where: { id: transactionId },
      include: {
        payments: { orderBy: { createdAt: 'asc' } },
        patient: { select: { id: true, name: true, insuranceType: true } },
      },
    });

    if (!transaction) throw new NotFoundException('Transaksi tidak ditemukan');

    return {
      message: 'Histori pembayaran',
      data: {
        transactionId,
        status: transaction.status,
        total: transaction.total,
        paidAmount: transaction.paidAmount,
        remainingAmount: Math.max(0, transaction.total - transaction.paidAmount),
        bpjsAmount: transaction.bpjsAmount,
        nonBpjsAmount: transaction.nonBpjsAmount,
        wmsOrderId: transaction.wmsOrderId,
        patient: transaction.patient,
        payments: transaction.payments,
      },
    };
  }

  // ─── CANCEL PENDING QRIS ─────────────────────────────────

  async cancelPendingQris(transactionId: string, paymentId: string) {
    const payment = await this.prisma.db.payment.findFirst({
      where: { id: paymentId, transactionId, method: 'QRIS', status: 'PENDING' },
    });

    if (!payment) throw new NotFoundException('Payment QRIS pending tidak ditemukan');

    await this.prisma.db.payment.update({ where: { id: paymentId }, data: { status: 'CANCELLED' } });

    const transaction = await this.prisma.db.transaction.findUnique({
      where: { id: transactionId },
      include: { payments: true },
    });

    const hasPaidPayment = transaction?.payments.some((p) => p.status === 'PAID');
    if (!hasPaidPayment) {
      await this.prisma.db.transaction.update({ where: { id: transactionId }, data: { status: 'PENDING_PAYMENT' as any } });
    }

    return { message: 'QRIS payment dibatalkan', paymentId };
  }

  async getPaymentStatus(transactionId: string, paymentId: string) {
    const payment = await this.prisma.db.payment.findFirst({
      where: { id: paymentId, transactionId },
      select: {
        id: true,
        method: true,
        amount: true,
        status: true,
        midtransOrderId: true,
        paidAt: true,
        createdAt: true,
      },
    });
  
    if (!payment) {
      throw new NotFoundException('Payment tidak ditemukan');
    }
  
    // Ambil sisa tagihan dari transaksi
    const transaction = await this.prisma.db.transaction.findUnique({
      where: { id: transactionId },
      select: {
        status: true,
        total: true,
        paidAmount: true,
      },
    });
  
    return {
      message: 'Status payment',
      data: {
        payment: {
          id: payment.id,
          method: payment.method,
          amount: payment.amount,
          status: payment.status,   // PENDING | PAID | CANCELLED
          paidAt: payment.paidAt,
          createdAt: payment.createdAt,
        },
        transaction: {
          status: transaction?.status,
          total: transaction?.total,
          paidAmount: transaction?.paidAmount,
          remainingAmount: Math.max(
            0,
            (transaction?.total ?? 0) - (transaction?.paidAmount ?? 0),
          ),
        },
      },
    };
  }

  // ─── GET TRANSACTION ─────────────────────────────────────

  async getTransaction(id: string) {
    const transaction = await this.prisma.db.transaction.findUnique({
      where: { id },
      include: {
        items: { include: { item: true } },
        payments: { orderBy: { createdAt: 'asc' } },
        patient: { select: { id: true, name: true, medicalRecordNo: true, insuranceType: true } },
      },
    });

    if (!transaction) throw new NotFoundException('Transaksi tidak ditemukan');

    return {
      message: 'Data transaksi',
      data: { ...transaction, remainingAmount: Math.max(0, transaction.total - transaction.paidAmount) },
    };
  }

  // ─── LIST ALL ────────────────────────────────────────────

  async findAll(query: { status?: string; paymentMethod?: string; patientId?: string; from?: string; to?: string; page?: number; limit?: number }) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;
    const where: any = {};

    if (query.status) where.status = query.status;
    if (query.paymentMethod) where.paymentMethod = query.paymentMethod;
    if (query.patientId) where.patientId = query.patientId;
    if (query.from || query.to) {
      where.createdAt = {};
      if (query.from) where.createdAt.gte = new Date(query.from);
      if (query.to) { const d = new Date(query.to); d.setHours(23, 59, 59, 999); where.createdAt.lte = d; }
    }

    const [transactions, total] = await Promise.all([
      this.prisma.db.transaction.findMany({
        where, skip, take: limit, orderBy: { createdAt: 'desc' },
        include: {
          patient: { select: { id: true, name: true, medicalRecordNo: true, insuranceType: true } },
          payments: { where: { status: 'PAID' }, select: { method: true, amount: true } },
        },
      }),
      this.prisma.db.transaction.count({ where }),
    ]);

    return {
      data: transactions.map((t) => ({
        id: t.id, status: t.status, paymentMethod: t.paymentMethod,
        subtotal: t.subtotal, total: t.total, paidAmount: t.paidAmount,
        remainingAmount: Math.max(0, t.total - t.paidAmount),
        rmeBillingId: t.rmeBillingId, wmsOrderId: t.wmsOrderId,
        createdAt: t.createdAt, paidAt: t.paidAt, patient: t.patient,
        paidMethods: t.payments.map((p) => p.method),
      })),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  // ─── OUTSTANDING ─────────────────────────────────────────

  async findOutstanding(query: { page?: number; limit?: number }) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;
    const where: any = { status: { in: ['PENDING_PAYMENT', 'PARTIAL'] } };

    const [transactions, total] = await Promise.all([
      this.prisma.db.transaction.findMany({
        where, skip, take: limit, orderBy: { createdAt: 'asc' },
        include: { patient: { select: { id: true, name: true, medicalRecordNo: true, phone: true, insuranceType: true } } },
      }),
      this.prisma.db.transaction.count({ where }),
    ]);

    const now = new Date();
    return {
      data: transactions.map((t) => ({
        id: t.id, status: t.status, total: t.total, paidAmount: t.paidAmount,
        remainingAmount: Math.max(0, t.total - t.paidAmount),
        daysPending: Math.floor((now.getTime() - new Date(t.createdAt).getTime()) / (1000 * 60 * 60 * 24)),
        patient: t.patient,
      })),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  // ─── SUMMARY ─────────────────────────────────────────────

  async getSummary(query: { from?: string; to?: string }) {
    const fromDate = query.from ? new Date(query.from) : new Date(new Date().setHours(0, 0, 0, 0));
    const toDate = query.to ? new Date(query.to) : new Date();
    toDate.setHours(23, 59, 59, 999);
    const dateFilter = { gte: fromDate, lte: toDate };

    const paidTrx = await this.prisma.db.transaction.findMany({
      where: { status: 'LUNAS', paidAt: dateFilter },
      select: { total: true, paymentMethod: true },
    });

    const byPaymentMethod: Record<string, { count: number; amount: number }> = {};
    for (const t of paidTrx) {
      const m = t.paymentMethod ?? 'UNKNOWN';
      if (!byPaymentMethod[m]) byPaymentMethod[m] = { count: 0, amount: 0 };
      byPaymentMethod[m].count++;
      byPaymentMethod[m].amount += t.total;
    }

    const outstanding = await this.prisma.db.transaction.aggregate({
      where: { status: { in: ['PENDING_PAYMENT', 'PARTIAL'] } },
      _count: true, _sum: { total: true },
    });

    const todayStart = new Date(new Date().setHours(0, 0, 0, 0));
    const todayEnd = new Date(new Date().setHours(23, 59, 59, 999));
    const today = await this.prisma.db.transaction.findMany({
      where: { status: 'LUNAS', paidAt: { gte: todayStart, lte: todayEnd } },
      select: { total: true },
    });

    return {
      period: { from: fromDate.toISOString().split('T')[0], to: toDate.toISOString().split('T')[0] },
      totalTransactions: paidTrx.length,
      totalRevenue: paidTrx.reduce((s, t) => s + t.total, 0),
      allTransactionsInPeriod: await this.prisma.db.transaction.count({ where: { createdAt: dateFilter } }),
      outstanding: { count: outstanding._count, amount: outstanding._sum.total ?? 0 },
      today: { transactions: today.length, revenue: today.reduce((s, t) => s + t.total, 0) },
      byPaymentMethod,
    };
  }
}

========== FILE: src/billing/dto/add-payment.dto.ts ==========
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

========== FILE: src/billing/dto/create-billing.dto.ts ==========
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

========== FILE: src/invoice/invoice.controller.ts ==========
// src/invoice/invoice.controller.ts

import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { InvoiceService } from './invoice.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('Invoice')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('invoice')
export class InvoiceController {
  constructor(private readonly invoiceService: InvoiceService) {}

  @Get(':transactionId')
  @Roles('KASIR', 'MANAGER', 'SUPER_ADMIN', 'FINANCE_STAFF')
  @ApiOperation({
    summary: 'Ambil data invoice lengkap untuk generate PDF/WhatsApp',
    description:
      'Return data invoice lengkap: detail pasien (termasuk no. HP), ' +
      'item POS + item RME + item WMS (obat), histori split bill, dan billing summary. ' +
      'Digunakan oleh AI service untuk generate invoice PDF dan kirim ke WhatsApp. ' +
      'Field `meta.phoneAvailable` menunjukkan apakah no. HP tersedia untuk kirim WA.',
  })
  getInvoice(@Param('transactionId') transactionId: string) {
    return this.invoiceService.getInvoice(transactionId);
  }
}

========== FILE: src/invoice/invoice.module.ts ==========
import { Module } from '@nestjs/common';
import { InvoiceController } from './invoice.controller';
import { InvoiceService } from './invoice.service';
import { RmeModule } from '../rme/rme.module';
import { WmsModule } from '../wms/wms.module';

@Module({
  imports: [RmeModule, WmsModule],
  controllers: [InvoiceController],
  providers: [InvoiceService],
  exports: [InvoiceService],
})
export class InvoiceModule {}

========== FILE: src/invoice/invoice.service.ts ==========
// src/invoice/invoice.service.ts

import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RmeService } from '../rme/rme.service';
import { WmsService } from '../wms/wms.service';

@Injectable()
export class InvoiceService {
  private readonly logger = new Logger(InvoiceService.name);

  constructor(
    private prisma: PrismaService,
    private rmeService: RmeService,
    private wmsService: WmsService,
  ) {}

  async getInvoice(transactionId: string) {
    // 1. Ambil data transaksi lengkap dari POS
    const transaction = await this.prisma.db.transaction.findUnique({
      where: { id: transactionId },
      include: {
        patient: true,
        user: { select: { id: true, name: true, email: true, role: true } },
        items: { include: { item: true } },
        payments: {
          where: { status: 'PAID' },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!transaction) throw new NotFoundException('Transaksi tidak ditemukan');

    // 2. Resolve phone — POS dulu, fallback ke RME
    let phone = transaction.patient?.phone ?? null;

    if (!phone && transaction.rekamMedisId) {
      try {
        const token = await (this.rmeService as any).getValidToken();
        const res = await fetch(
          `${process.env.RME_BASE_URL}/api/v1/patients?search=${transaction.rekamMedisId}`,
          { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } },
        );
        if (res.ok) {
          const data = await res.json();
          const patients = data?.data?.data ?? data?.data ?? [];
          const found = patients.find(
            (p: any) => p.noRm === transaction.rekamMedisId || p.id === transaction.rekamMedisId,
          );
          phone = found?.telepon ?? found?.phone ?? null;
        }
      } catch {
        this.logger.warn(`Gagal fetch phone dari RME untuk ${transaction.rekamMedisId}`);
      }
    }

    if (!phone) {
      this.logger.warn(`⚠️ No. HP tidak ditemukan untuk transaksi ${transactionId}`);
    }

    // 3. Ambil detail item RME (opsional)
    let rmeItems: any[] = [];
    if (transaction.rekamMedisId) {
      const rmeBilling = await this.rmeService.getBillingByRekamMedis(transaction.rekamMedisId);
      if (rmeBilling) {
        rmeItems = rmeBilling.items.map((i) => ({
          namaLayanan: i.namaLayanan,
          harga: i.harga,
          jumlah: i.jumlah,
          subtotal: i.harga * i.jumlah,
          isBpjs: i.isBpjs,
          ditanggungBpjs: i.isBpjs,
        }));
      }
    }

    // 4. Ambil detail item WMS (opsional)
    let wmsItems: any[] = [];
    if (transaction.wmsOrderId) {
      const wmsOrder = await this.wmsService.getOrder(transaction.wmsOrderId);
      if (wmsOrder) {
        wmsItems = (wmsOrder.items ?? []).map((i: any) => ({
          namaObat: i.namaObat ?? i.kodeObat,
          kodeObat: i.kodeObat,
          qty: i.qty,
          hargaJual: Number(i.hargaJual ?? 0),
          subtotal: Number(i.subtotal ?? 0),
        }));
      }
    }

    // 5. Generate invoice number
    const invoiceNo = this.generateInvoiceNo(transaction.id, transaction.createdAt);

    // 6. Susun response lengkap
    return {
      message: 'Data invoice berhasil diambil',
      data: {
        invoiceNo,
        issuedAt: transaction.createdAt,
        paidAt: transaction.paidAt ?? null,
        status: transaction.status,

        patient: {
          id: transaction.patient?.id,
          name: transaction.patient?.name ?? 'Pasien',
          medicalRecordNo: transaction.patient?.medicalRecordNo ?? null,
          phone,                                          // ← WAJIB untuk WA
          noBpjs: transaction.patient?.noBpjs ?? null,
          insuranceType: transaction.patient?.insuranceType ?? 'UMUM',
        },

        kasir: {
          id: transaction.user?.id,
          name: transaction.user?.name ?? 'Kasir',
        },

        items: {
          posItems: transaction.items.map((ti) => ({
            name: ti.item.name,
            type: ti.item.type,
            qty: ti.quantity,
            price: ti.price,
            subtotal: ti.subtotal,
          })),
          rmeItems,
          wmsItems,
        },

        billing: {
          subtotal: transaction.subtotal,
          tax: transaction.tax,
          adminFee: transaction.adminFee,
          bpjsAmount: transaction.bpjsAmount,
          nonBpjsAmount: transaction.nonBpjsAmount,
          total: transaction.total,
          paidAmount: transaction.paidAmount,
          remainingAmount: Math.max(0, transaction.total - transaction.paidAmount),
        },

        payments: transaction.payments.map((p) => ({
          method: p.method,
          amount: p.amount,
          isBpjsCoverage: p.isBpjsCoverage,
          reference: p.reference ?? null,
          paidAt: p.paidAt,
        })),

        meta: {
          rmeBillingId: transaction.rmeBillingId ?? null,
          wmsOrderId: transaction.wmsOrderId ?? null,
          rekamMedisId: transaction.rekamMedisId ?? null,
          hasRmeData: rmeItems.length > 0,
          hasWmsData: wmsItems.length > 0,
          phoneAvailable: !!phone,
        },
      },
    };
  }

  private generateInvoiceNo(transactionId: string, createdAt: Date): string {
    const date = new Date(createdAt);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const suffix = transactionId.substring(0, 6).toUpperCase();
    return `INV-${y}${m}${d}-${suffix}`;
  }
}

========== FILE: src/items/dto/create-item.dto.ts ==========
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
========== FILE: src/items/items.controller.ts ==========
// src/items/items.controller.ts
//
// PERUBAHAN dari versi sebelumnya:
// + @UseGuards(JwtAuthGuard, RolesGuard)
// + GET /items → semua role boleh (KASIR butuh lihat item saat billing)
// + POST /items → hanya SUPER_ADMIN dan MANAGER yang boleh tambah item

import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ItemsService } from './items.service';
import { CreateItemDto } from './dto/create-item.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('Items')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('items')
export class ItemsController {
  constructor(private readonly itemsService: ItemsService) {}

  @Get()
  @Roles('KASIR', 'MANAGER', 'SUPER_ADMIN', 'FINANCE_STAFF')
  @ApiOperation({ summary: 'Ambil semua daftar obat & layanan' })
  findAll() {
    return this.itemsService.findAll();
  }

  @Post()
  @Roles('SUPER_ADMIN', 'MANAGER') // kasir tidak boleh tambah/ubah master item
  @ApiOperation({ summary: 'Tambah obat atau layanan baru' })
  create(@Body() dto: CreateItemDto) {
    return this.itemsService.create(dto);
  }
}

========== FILE: src/items/items.module.ts ==========
// src/items/items.module.ts
//
// PERUBAHAN: import AuthModule agar ItemsController bisa pakai guard

import { Module } from '@nestjs/common';
import { ItemsController } from './items.controller';
import { ItemsService } from './items.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [ItemsController],
  providers: [ItemsService],
})
export class ItemsModule {}

========== FILE: src/items/items.service.ts ==========
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateItemDto } from './dto/create-item.dto';

@Injectable()
export class ItemsService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    const items = await this.prisma.db.item.findMany({
      orderBy: { type: 'asc' },
    });
    return {
      message: 'Data items berhasil diambil',
      total: items.length,
      data: items,
    };
  }

  async create(dto: CreateItemDto) {
    const item = await this.prisma.db.item.create({
      data: {
        name: dto.name,
        type: dto.type,
        price: dto.price,
        unit: dto.unit,
      },
    });
    return {
      message: 'Item berhasil ditambahkan',
      data: item,
    };
  }
}
========== FILE: src/main.ts ==========
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Serve static files (payment test page)
  app.useStaticAssets(join(process.cwd(), 'public'));

  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));

  // CORS
  app.enableCors();

  // ─── SWAGGER CONFIG ─────────────────────────────────────
  const config = new DocumentBuilder()
    .setTitle('Smart Clinic POS & Payment QRIS API')
    .setDescription(
      '**REST API untuk Sistem POS & Pembayaran Klinik.**\n\n' +
      'Mendukung billing terintegrasi, pembayaran multi-metode (QRIS, Cash, Debit, Transfer, BPJS), ' +
      'outstanding invoice, dashboard transaksi & pendapatan, serta integrasi RME dan WMS.\n\n' +
      '**Autentikasi:** Bearer JWT Token — login via `POST /api/auth/login`.\n\n' +
      '**RBAC Roles:** `SUPER_ADMIN` · `MANAGER` · `KASIR` · `FINANCE_STAFF`\n\n' +
      '**Akun demo (password: `password123`):**\n' +
      '- `admin@klinik.com` → SUPER_ADMIN\n' +
      '- `manager@klinik.com` → MANAGER\n' +
      '- `kasir@klinik.com` → KASIR\n' +
      '- `finance@klinik.com` → FINANCE_STAFF\n\n' +
      '---\n' +
      '*Smart Clinic POS — PT. GII | Capstone Project 2026*'
    )
    .setVersion('1.0')
    .setContact('Smart Clinic Dev Team', '', 'dev@smartclinic.id')
    .addBearerAuth()
    .addTag('Auth', 'Registrasi, login, dan manajemen user')
    .addTag('Patients', 'CRUD data pasien klinik')
    .addTag('Items', 'Daftar obat & layanan klinik')
    .addTag('Billing', 'Transaksi, outstanding invoice, dan dashboard pendapatan')
    .addTag('Payment', 'Integrasi Midtrans QRIS — generate token, webhook, cek status')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(process.env.PORT ?? 3000);

  console.log(`\n🚀 Server running on http://localhost:${process.env.PORT ?? 3000}`);
  console.log(`📚 Swagger docs: http://localhost:${process.env.PORT ?? 3000}/api/docs`);
  console.log(`💳 Payment test: http://localhost:${process.env.PORT ?? 3000}/payment-test.html\n`);
}
bootstrap();

========== FILE: src/patients/dto/create-patient.dto.ts ==========
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

========== FILE: src/patients/dto/update-patient.dto.ts ==========
import { PartialType } from '@nestjs/swagger';
import { CreatePatientDto } from './create-patient.dto';

export class UpdatePatientDto extends PartialType(CreatePatientDto) {}

========== FILE: src/patients/patients.controller.ts ==========
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { PatientsService } from './patients.service';
import { CreatePatientDto } from './dto/create-patient.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('Patients')
@Controller('patients')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class PatientsController {
  constructor(private readonly patientsService: PatientsService) {}

  @Post()
  @Roles('SUPER_ADMIN', 'MANAGER', 'KASIR')
  @ApiOperation({
    summary: 'Daftarkan pasien baru',
    description:
      'Nomor rekam medis di-generate otomatis (format: RM-YYYYMM-XXXX). ' +
      'NIK dan noBpjs opsional — bisa dilengkapi nanti.',
  })
  create(@Body() dto: CreatePatientDto) {
    return this.patientsService.create(dto);
  }

  @Get()
  @Roles('SUPER_ADMIN', 'MANAGER', 'KASIR', 'FINANCE_STAFF')
  @ApiOperation({
    summary: 'Cari & list semua pasien aktif',
    description:
      'Mendukung pencarian by nama, no. RM, NIK, atau telepon. ' +
      'Hasil bisa difilter berdasarkan tipe penjaminan.',
  })
  @ApiQuery({ name: 'search', required: false, example: 'Budi', description: 'Cari nama/noRM/NIK/telp' })
  @ApiQuery({ name: 'insuranceType', required: false, enum: ['UMUM', 'BPJS', 'VOUCHER'] })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  findAll(
    @Query('search') search?: string,
    @Query('insuranceType') insuranceType?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.patientsService.findAll({
      search,
      insuranceType,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get(':id')
  @Roles('SUPER_ADMIN', 'MANAGER', 'KASIR', 'FINANCE_STAFF')
  @ApiOperation({ summary: 'Detail pasien by ID' })
  findOne(@Param('id') id: string) {
    return this.patientsService.findOne(id);
  }

  @Put(':id')
  @Roles('SUPER_ADMIN', 'MANAGER', 'KASIR')
  @ApiOperation({
    summary: 'Update data pasien',
    description: 'Hanya field yang dikirim yang akan diupdate (partial update).',
  })
  update(@Param('id') id: string, @Body() dto: UpdatePatientDto) {
    return this.patientsService.update(id, dto);
  }

  @Delete(':id')
  @Roles('SUPER_ADMIN', 'MANAGER')
  @ApiOperation({
    summary: 'Arsipkan pasien (soft delete)',
    description: 'Pasien tidak dihapus permanen, hanya dinonaktifkan.',
  })
  remove(@Param('id') id: string) {
    return this.patientsService.remove(id);
  }
}

========== FILE: src/patients/patients.module.ts ==========
import { Module } from '@nestjs/common';
import { PatientsController } from './patients.controller';
import { PatientsService } from './patients.service';

@Module({
  controllers: [PatientsController],
  providers: [PatientsService],
  exports: [PatientsService],
})
export class PatientsModule {}

========== FILE: src/patients/patients.service.ts ==========
import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePatientDto } from './dto/create-patient.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';

@Injectable()
export class PatientsService {
  constructor(private prisma: PrismaService) {}

  // ─── CREATE ─────────────────────────────────────────────

  async create(dto: CreatePatientDto) {
    // Cek NIK duplikat jika diisi
    if (dto.nik) {
      const existingNik = await this.prisma.db.patient.findUnique({
        where: { nik: dto.nik },
      });
      if (existingNik) throw new ConflictException('NIK sudah terdaftar');
    }

    // Auto-generate nomor rekam medis: RM-YYYYMM-XXXX
    const medicalRecordNo = await this.generateMedicalRecordNo();

    const patient = await this.prisma.db.patient.create({
      data: {
        name: dto.name,
        medicalRecordNo,
        phone: dto.phone,
        nik: dto.nik,
        address: dto.address,
        jenisKelamin: dto.jenisKelamin,
        noBpjs: dto.noBpjs,
        insuranceType: dto.insuranceType ?? 'UMUM',
      },
    });

    return {
      message: 'Pasien berhasil didaftarkan',
      patient,
    };
  }

  // ─── FIND ALL + SEARCH ──────────────────────────────────

  async findAll(query: {
    search?: string;
    insuranceType?: string;
    page?: number;
    limit?: number;
  }) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: any = { isActive: true };

    // Search by nama, noRM, atau NIK
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { medicalRecordNo: { contains: query.search, mode: 'insensitive' } },
        { nik: { contains: query.search } },
        { phone: { contains: query.search } },
      ];
    }

    if (query.insuranceType) {
      where.insuranceType = query.insuranceType;
    }

    const [patients, total] = await Promise.all([
      this.prisma.db.patient.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.db.patient.count({ where }),
    ]);

    return {
      data: patients,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ─── FIND ONE ───────────────────────────────────────────

  async findOne(id: string) {
    const patient = await this.prisma.db.patient.findUnique({
      where: { id },
    });

    if (!patient || !patient.isActive) {
      throw new NotFoundException('Pasien tidak ditemukan');
    }

    return { patient };
  }

  // ─── UPDATE ─────────────────────────────────────────────

  async update(id: string, dto: UpdatePatientDto) {
    // Pastikan pasien ada
    await this.findOne(id);

    // Cek NIK duplikat jika diupdate
    if (dto.nik) {
      const existingNik = await this.prisma.db.patient.findUnique({
        where: { nik: dto.nik },
      });
      if (existingNik && existingNik.id !== id) {
        throw new ConflictException('NIK sudah terdaftar oleh pasien lain');
      }
    }

    const patient = await this.prisma.db.patient.update({
      where: { id },
      data: dto,
    });

    return {
      message: 'Data pasien berhasil diperbarui',
      patient,
    };
  }

  // ─── SOFT DELETE ────────────────────────────────────────

  async remove(id: string) {
    await this.findOne(id);

    await this.prisma.db.patient.update({
      where: { id },
      data: { isActive: false },
    });

    return { message: 'Pasien berhasil diarsipkan' };
  }

  // ─── HELPER: Auto-generate No. RM ──────────────────────

  private async generateMedicalRecordNo(): Promise<string> {
    const now = new Date();
    const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const prefix = `RM-${yearMonth}-`;

    // Cari nomor terakhir bulan ini
    const last = await this.prisma.db.patient.findFirst({
      where: { medicalRecordNo: { startsWith: prefix } },
      orderBy: { medicalRecordNo: 'desc' },
    });

    let sequence = 1;
    if (last) {
      const lastNum = parseInt(last.medicalRecordNo.replace(prefix, ''), 10);
      sequence = lastNum + 1;
    }

    return `${prefix}${String(sequence).padStart(4, '0')}`;
  }
}

========== FILE: src/payment/dto/create-payment.dto.ts ==========
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
========== FILE: src/payment/payment.controller.ts ==========
// src/payment/payment.controller.ts
//
// PERUBAHAN dari versi sebelumnya:
// + @UseGuards(JwtAuthGuard, RolesGuard) pada tokenizer dan status
// + Webhook TETAP PUBLIC — Midtrans server yang memanggil, tidak punya JWT kita
// + Pisahkan guard per method karena webhook tidak boleh diproteksi

import { Controller, Post, Get, Body, Param, UseGuards, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PaymentService } from './payment.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('Payment')
@Controller('payment')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post('tokenizer')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('KASIR', 'MANAGER', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Generate Snap Token Midtrans untuk transaksi' })
  createSnapToken(@Body() dto: CreatePaymentDto) {
    return this.paymentService.createSnapToken(dto.transactionId);
  }

  // ⚠️ TIDAK ADA @UseGuards di sini — webhook dipanggil oleh Midtrans server
  // Midtrans tidak punya JWT kita, jadi endpoint ini harus tetap public
  @Post('webhook')
  @ApiOperation({ summary: 'Webhook dari Midtrans — PUBLIC, jangan tambah JWT guard' })
  handleWebhook(@Req() req: Request) { 
    
    // 2. Beri penegasan tipe 'any' agar TypeScript tidak protes di baris log
    const notification: any = req.body;

    // Agent log dibiarkan utuh
    fetch('http://127.0.0.1:7326/ingest/975ac0f8-a319-4e73-8855-f0049df4b786',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'999c66'},body:JSON.stringify({sessionId:'999c66',location:'payment.controller.ts:handleWebhook',message:'webhook request received',data:{contentType:req.headers['content-type'],bodyType:typeof req.body,bodyKeys:req.body&&typeof req.body==='object'?Object.keys(req.body):null,notificationType:typeof notification,notificationIsUndefined:notification===undefined,notificationKeys:notification&&typeof notification==='object'?Object.keys(notification):null,hasOrderId:!!notification?.order_id},timestamp:Date.now(),hypothesisId:'A,C'})}).catch(()=>{});

    return this.paymentService.handleWebhook(notification);
  }

  @Get('status/:transactionId')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('KASIR', 'MANAGER', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Cek status transaksi' })
  getStatus(@Param('transactionId') transactionId: string) {
    return this.paymentService.getTransactionStatus(transactionId);
  }
}

========== FILE: src/payment/payment.module.ts ==========
import { Module } from '@nestjs/common';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { AuthModule } from '../auth/auth.module';
import { AccountingModule } from '../accounting/accounting.module';
import { RmeModule } from '../rme/rme.module';
import { WmsModule } from '../wms/wms.module';
import { SyncLogModule } from '../sync-log/sync-log.module';

@Module({
  imports: [AuthModule, AccountingModule, RmeModule, WmsModule, SyncLogModule],
  controllers: [PaymentController],
  providers: [PaymentService],
})
export class PaymentModule {}

========== FILE: src/payment/payment.service.ts ==========
// src/payment/payment.service.ts
// Update: inject SyncLogService, catat semua WMS & RME callback ke sync_logs

import {
  Injectable, NotFoundException, BadRequestException, Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AccountingService } from '../accounting/accounting.service';
import { RmeService } from '../rme/rme.service';
import { WmsService } from '../wms/wms.service';
import { SyncLogService } from '../sync-log/sync-log.service';
import { TransactionStatus } from '@prisma/client';
import * as midtransClient from 'midtrans-client';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);
  private snap: midtransClient.Snap;

  constructor(
    private prisma: PrismaService,
    private accountingService: AccountingService,
    private rmeService: RmeService,
    private wmsService: WmsService,
    private syncLogService: SyncLogService,
  ) {
    this.snap = new midtransClient.Snap({
      isProduction: process.env.MIDTRANS_IS_PRODUCTION === 'true',
      serverKey: process.env.MIDTRANS_SERVER_KEY!,
      clientKey: process.env.MIDTRANS_CLIENT_KEY!,
    });
  }

  // ─── CREATE SNAP TOKEN ───────────────────────────────────

  async createSnapToken(transactionId: string) {
    const transaction = await this.prisma.db.transaction.findUnique({
      where: { id: transactionId },
      include: { items: { include: { item: true } }, patient: true },
    });

    if (!transaction) throw new NotFoundException('Transaksi tidak ditemukan');

    if (!['PENDING_PAYMENT', 'PARTIAL'].includes(transaction.status)) {
      throw new BadRequestException(`Transaksi tidak bisa dibayar — status: ${transaction.status}`);
    }

    const remainingAmount = transaction.total - transaction.paidAmount;
    if (remainingAmount <= 0) throw new BadRequestException('Transaksi sudah lunas');

    const orderId = `POS-${transaction.id.substring(0, 8)}-${Date.now()}`;

    const parameter = {
      transaction_details: {
        order_id: orderId,
        gross_amount: Math.round(remainingAmount),
      },
      item_details: transaction.items.map((ti) => ({
        id: ti.itemId,
        name: ti.item.name,
        price: Math.round(Number(ti.price)),
        quantity: ti.quantity,
      })),
      customer_details: {
        first_name: transaction.patient?.name ?? 'Pasien',
        phone: transaction.patient?.phone ?? '08000000000',
      },
      payment_type_filter: ['qris', 'bank_transfer', 'credit_card'],
    };

    const snapResponse = await this.snap.createTransaction(parameter);

    await this.prisma.db.transaction.update({
      where: { id: transactionId },
      data: { midtransOrderId: orderId },
    });

    return {
      message: 'Snap token berhasil dibuat',
      data: {
        transactionId: transaction.id,
        orderId,
        snapToken: snapResponse.token,
        snapRedirectUrl: snapResponse.redirect_url,
        total: remainingAmount,
        rmeBillingId: transaction.rmeBillingId,
        wmsOrderId: transaction.wmsOrderId,
      },
    };
  }

  // ─── HANDLE WEBHOOK ──────────────────────────────────────

  async handleWebhook(notification: any) {
    const orderId = notification?.order_id;
    const transactionStatus = notification?.transaction_status;
    const fraudStatus = notification?.fraud_status;

    if (!orderId) {
      this.logger.warn('Webhook diterima tanpa order_id — diabaikan');
      return { message: 'Webhook diabaikan: tidak ada order_id' };
    }

    let isSuccess = false;
    let isCancelled = false;

    if (transactionStatus === 'settlement') isSuccess = true;
    else if (transactionStatus === 'capture' && fraudStatus === 'accept') isSuccess = true;
    else if (['cancel', 'deny', 'expire', 'failure'].includes(transactionStatus)) isCancelled = true;

    // Cek split payment dulu
    const splitPayment = await this.prisma.db.payment.findUnique({
      where: { midtransOrderId: orderId },
      include: { transaction: true },
    });

    if (splitPayment) {
      return await this.handleSplitPaymentWebhook(splitPayment, isSuccess, isCancelled);
    }

    // Fallback single payment
    const transaction = await this.prisma.db.transaction.findFirst({
      where: { midtransOrderId: orderId },
    });

    if (!transaction) {
      throw new NotFoundException(`Transaksi/Payment dengan order_id ${orderId} tidak ditemukan`);
    }

    return await this.handleSinglePaymentWebhook(transaction, isSuccess, isCancelled);
  }

  // ─── HANDLER: Split Bill ─────────────────────────────────

  private async handleSplitPaymentWebhook(payment: any, isSuccess: boolean, isCancelled: boolean) {
    const transaction = payment.transaction;

    if (isSuccess) {
      await this.prisma.db.payment.update({
        where: { id: payment.id },
        data: { status: 'PAID', paidAt: new Date() },
      });

      const newPaidAmount = transaction.paidAmount + payment.amount;
      const isFullyPaid = newPaidAmount >= transaction.total - 0.01;
      const newStatus = isFullyPaid ? 'LUNAS' : 'PARTIAL';

      await this.prisma.db.transaction.update({
        where: { id: transaction.id },
        data: {
          paidAmount: newPaidAmount,
          status: newStatus as any,
          paymentMethod: 'QRIS',
          ...(isFullyPaid && { paidAt: new Date() }),
        },
      });

      if (isFullyPaid) {
        this.logger.log(`✅ Split bill LUNAS: ${transaction.id}`);
        await this.runPostPaymentActions(transaction, 'QRIS');
      }

      return {
        message: isFullyPaid ? 'Transaksi LUNAS' : 'Pembayaran QRIS berhasil, masih ada sisa',
        status: newStatus,
        paidAmount: newPaidAmount,
        remainingAmount: Math.max(0, transaction.total - newPaidAmount),
      };
    }

    if (isCancelled) {
      await this.prisma.db.payment.update({
        where: { id: payment.id },
        data: { status: 'CANCELLED' },
      });
      return { message: 'QRIS payment dibatalkan', status: 'CANCELLED' };
    }

    return { message: 'Webhook diterima, tidak ada perubahan status' };
  }

  // ─── HANDLER: Single Payment ─────────────────────────────

  private async handleSinglePaymentWebhook(transaction: any, isSuccess: boolean, isCancelled: boolean) {
    let newStatus: TransactionStatus = transaction.status;

    if (isSuccess) newStatus = TransactionStatus.LUNAS;
    else if (isCancelled) newStatus = TransactionStatus.CANCELLED;

    await this.prisma.db.transaction.update({
      where: { id: transaction.id },
      data: {
        status: newStatus,
        paidAmount: isSuccess ? transaction.total : transaction.paidAmount,
        ...(newStatus === TransactionStatus.LUNAS && { paidAt: new Date() }),
      },
    });

    if (newStatus === TransactionStatus.LUNAS) {
      await this.runPostPaymentActions(transaction, transaction.paymentMethod);
    }

    this.logger.log(`Webhook: ${transaction.id} → ${newStatus}`);
    return { message: 'Webhook berhasil diproses', status: newStatus };
  }

  // ─── POST-PAYMENT ACTIONS ────────────────────────────────

  private async runPostPaymentActions(transaction: any, paymentMethod: string): Promise<void> {
    await Promise.allSettled([
      this.handleAutoJournal(transaction.id, transaction.userId),
      this.handleRmeCallback(transaction),
      this.handleWmsCallback(transaction, paymentMethod),
    ]);
  }

  private async handleAutoJournal(transactionId: string, userId: string): Promise<void> {
    try {
      const systemUser = await this.prisma.db.user.findFirst({ where: { role: 'SUPER_ADMIN' } });
      await this.accountingService.createJournalFromTransaction(transactionId, systemUser?.id ?? userId);
      this.logger.log(`📒 Auto-journal: ${transactionId}`);
    } catch (err) {
      this.logger.error(`Auto-journal gagal: ${transactionId}`, err);
    }
  }

  private async handleRmeCallback(transaction: any): Promise<void> {
    if (!transaction.rmeBillingId) return;

    const start = Date.now();
    const requestBody = {
      rmeBillingId: transaction.rmeBillingId,
      paymentMethod: transaction.paymentMethod,
    };

    try {
      const success = await this.rmeService.payBilling(
        transaction.rmeBillingId,
        transaction.paymentMethod,
        `Lunas via Smart Clinic POS | TrxID: ${transaction.id}`,
      );

      await this.syncLogService.create({
        transactionId: transaction.id,
        service: 'RME',
        action: 'pay_billing',
        status: success ? 'SUCCESS' : 'FAILED',
        requestBody,
        errorMessage: success ? null : 'RME payBilling return false',
        durationMs: Date.now() - start,
      });

      if (!success) this.logger.warn(`⚠️ RME callback gagal: billing ${transaction.rmeBillingId}`);
    } catch (err: any) {
      await this.syncLogService.create({
        transactionId: transaction.id,
        service: 'RME',
        action: 'pay_billing',
        status: 'FAILED',
        requestBody,
        errorMessage: err?.message ?? 'Unknown error',
        durationMs: Date.now() - start,
      });
    }
  }

  private async handleWmsCallback(transaction: any, paymentMethod: string): Promise<void> {
    if (!transaction.wmsOrderId) {
      this.logger.debug(`Transaksi ${transaction.id} tidak punya wmsOrderId — skip`);
      return;
    }

    const start = Date.now();
    const requestBody = {
      wmsOrderId: transaction.wmsOrderId,
      paymentStatus: 'paid',
      posTransactionId: transaction.id,
      paymentMethod,
    };

    try {
      const success = await this.wmsService.updatePaymentStatus(transaction.wmsOrderId, 'paid', {
        posTransactionId: transaction.id,
        paymentReference: `POS-${transaction.id.substring(0, 8)}`,
        paidAt: new Date(),
        notes: `Lunas via Smart Clinic POS | Metode: ${paymentMethod}`,
      });

      await this.syncLogService.create({
        transactionId: transaction.id,
        service: 'WMS',
        action: 'payment_callback',
        status: success ? 'SUCCESS' : 'FAILED',
        requestBody,
        errorMessage: success ? null : 'WMS updatePaymentStatus return false',
        durationMs: Date.now() - start,
      });

      if (!success) this.logger.warn(`⚠️ WMS callback gagal: order ${transaction.wmsOrderId}`);
    } catch (err: any) {
      await this.syncLogService.create({
        transactionId: transaction.id,
        service: 'WMS',
        action: 'payment_callback',
        status: 'FAILED',
        requestBody,
        errorMessage: err?.message ?? 'Unknown error',
        durationMs: Date.now() - start,
      });
    }
  }

  // ─── GET STATUS ──────────────────────────────────────────

  async getTransactionStatus(transactionId: string) {
    const transaction = await this.prisma.db.transaction.findUnique({
      where: { id: transactionId },
      include: {
        patient: { select: { id: true, name: true, medicalRecordNo: true } },
        payments: { orderBy: { createdAt: 'asc' } },
      },
    });

    if (!transaction) throw new NotFoundException('Transaksi tidak ditemukan');

    return {
      message: 'Status transaksi',
      data: {
        id: transaction.id,
        status: transaction.status,
        total: transaction.total,
        paidAmount: transaction.paidAmount,
        remainingAmount: Math.max(0, transaction.total - transaction.paidAmount),
        paymentMethod: transaction.paymentMethod,
        midtransOrderId: transaction.midtransOrderId,
        rmeBillingId: transaction.rmeBillingId,
        wmsOrderId: transaction.wmsOrderId,
        paidAt: transaction.paidAt,
        patient: transaction.patient,
        payments: transaction.payments,
      },
    };
  }
}

========== FILE: src/prisma/prisma.module.ts ==========
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}

========== FILE: src/prisma/prisma.service.ts ==========
import 'dotenv/config';
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private client: PrismaClient;

  constructor() {
    const connectionString = process.env.DATABASE_URL!;
    
    const adapter = new PrismaPg({ connectionString });

    this.client = new PrismaClient({ adapter } as any);
  }

  get db(): PrismaClient {
    return this.client;
  }

  async onModuleInit() {
    await this.client.$connect();
  }

  async onModuleDestroy() {
    await this.client.$disconnect();
  }
}

========== FILE: src/rme/rme.controller.ts ==========
// src/rme/rme.controller.ts

import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { RmeService } from './rme.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('RME Integration')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('rme')
export class RmeController {
  constructor(private readonly rmeService: RmeService) {}

  // ─── ANTRIAN HARI INI ────────────────────────────────────

  @Get('queue/today')
  @Roles('KASIR', 'MANAGER', 'SUPER_ADMIN')
  @ApiOperation({
    summary: 'Antrian pasien hari ini dari RME',
    description:
      'Proxy ke RME GET /api/v1/queues. ' +
      'Gunakan `status=SELESAI` untuk tampilkan pasien yang siap ditagih di kasir. ' +
      'Gunakan `status=MENUNGGU` untuk monitor antrian aktif. ' +
      'Response include: noRm pasien — dipakai untuk hit GET /rme/billing/:noRm.',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['MENUNGGU', 'HADIR', 'DIPANGGIL', 'DIPERIKSA', 'SELESAI'],
    example: 'SELESAI',
    description: 'Filter status antrian. Default: MENUNGGU',
  })
  @ApiQuery({
    name: 'tanggal',
    required: false,
    example: '2026-06-11',
    description: 'Tanggal antrian (YYYY-MM-DD). Default: hari ini',
  })
  async getTodayQueue(
    @Query('status') status?: string,
    @Query('tanggal') tanggal?: string,
  ) {
    const result = await this.rmeService.getTodayQueue(tanggal, status);

    if (!result) {
      return {
        message: 'Data antrian RME tidak tersedia',
        rmeAvailable: false,
        data: null,
      };
    }

    return {
      message: `Antrian ${result.status} — ${result.tanggal}`,
      rmeAvailable: true,
      data: result,
    };
  }

  // ─── BILLING BY NORM ────────────────────────────────────

  @Get('billing/:noRm')
  @Roles('KASIR', 'MANAGER', 'SUPER_ADMIN', 'FINANCE_STAFF')
  @ApiOperation({
    summary: 'Detail billing aktif pasien dari RME by noRm',
    description:
      'Proxy ke RME GET /api/v1/billing/by-rm/{noRm}. ' +
      'Return billing aktif pasien + items + breakdown BPJS vs non-BPJS. ' +
      'noRm didapat dari response GET /rme/queue/today (field pasien.noRm).',
  })
  async getBillingByNoRm(@Param('noRm') noRm: string) {
    const billing = await this.rmeService.getBillingByRekamMedis(noRm);

    if (!billing) {
      return {
        message: 'Billing RME tidak ditemukan untuk pasien ini',
        rmeAvailable: true,
        data: null,
      };
    }

    // Hitung breakdown BPJS vs non-BPJS
    const bpjsTotal = billing.items
      .filter((i) => i.isBpjs)
      .reduce((sum, i) => sum + i.harga * i.jumlah, 0);

    const nonBpjsTotal = billing.items
      .filter((i) => !i.isBpjs)
      .reduce((sum, i) => sum + i.harga * i.jumlah, 0);

    return {
      message: 'Data billing RME berhasil diambil',
      rmeAvailable: true,
      data: {
        rmeBillingId: billing.id,
        noRm,
        status: billing.status,
        totalTagihan: billing.total,
        bpjsTotal,
        nonBpjsTotal,
        tagihanPasien: nonBpjsTotal,
        items: billing.items,
      },
    };
  }

  // ─── BILLING HISTORY BY NORM ─────────────────────────────

  @Get('billing/:noRm/history')
  @Roles('KASIR', 'MANAGER', 'SUPER_ADMIN', 'FINANCE_STAFF')
  @ApiOperation({
    summary: 'Riwayat semua billing pasien dari RME',
    description:
      'Proxy ke RME untuk ambil semua riwayat billing pasien. ' +
      'Dipakai di halaman histori transaksi FE POS.',
  })
  async getBillingHistoryByNoRm(@Param('noRm') noRm: string) {
    const billings = await this.rmeService.getBillingHistoryByRekamMedis(noRm);

    return {
      message: billings.length > 0
        ? `${billings.length} riwayat billing ditemukan`
        : 'Belum ada riwayat billing',
      rmeAvailable: true,
      data: billings.map((b) => {
        const bpjsTotal = b.items
          .filter((i) => i.isBpjs)
          .reduce((sum, i) => sum + i.harga * i.jumlah, 0);
        const nonBpjsTotal = b.items
          .filter((i) => !i.isBpjs)
          .reduce((sum, i) => sum + i.harga * i.jumlah, 0);

        return {
          rmeBillingId: b.id,
          status: b.status,
          totalTagihan: b.total,
          bpjsTotal,
          nonBpjsTotal,
          items: b.items,
        };
      }),
    };
  }
}

========== FILE: src/rme/rme.module.ts ==========
import { Module } from '@nestjs/common';
import { RmeService } from './rme.service';
import { RmeController } from './rme.controller';

@Module({
  controllers: [RmeController],
  providers: [RmeService],
  exports: [RmeService],
})
export class RmeModule {}

========== FILE: src/rme/rme.service.ts ==========
// src/rme/rme.service.ts

import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';

const PAYMENT_METHOD_MAP: Record<string, string> = {
  QRIS: 'TRANSFER',
  CASH: 'TUNAI',
  DEBIT: 'KARTU',
  TRANSFER: 'TRANSFER',
  BPJS: 'BPJS',
};

@Injectable()
export class RmeService {
  private readonly logger = new Logger(RmeService.name);
  private readonly baseUrl: string;
  private readonly adminIdentifier: string;
  private readonly adminPassword: string;

  private accessToken: string | null = null;
  private refreshTokenValue: string | null = null;
  private tokenExpiresAt: Date | null = null;

  constructor() {
    this.baseUrl = process.env.RME_BASE_URL ?? '';
    this.adminIdentifier = process.env.RME_ADMIN_IDENTIFIER ?? '';
    this.adminPassword = process.env.RME_ADMIN_PASSWORD ?? '';

    if (!this.baseUrl) {
      this.logger.warn('⚠️  RME_BASE_URL tidak di-set — integrasi RME tidak aktif');
    }
  }

  // ─── QUEUE PROXY ────────────────────────────────────────────────

  /**
   * Ambil antrian pasien hari ini dari RME.
   * Default status: MENUNGGU. Untuk kasir, pakai status=SELESAI.
   * 
   * @param tanggal  format YYYY-MM-DD, default hari ini
   * @param status   MENUNGGU | HADIR | DIPANGGIL | DIPERIKSA | SELESAI
   */
  async getTodayQueue(tanggal?: string, status?: string): Promise<RmeQueueResponse | null> {
    if (!this.isConfigured()) return null;

    const today = tanggal ?? new Date().toISOString().split('T')[0];
    const queueStatus = status ?? 'MENUNGGU';

    try {
      const token = await this.getValidToken();
      const url = `${this.baseUrl}/api/v1/queues?tanggal=${today}&status=${queueStatus}`;
      const response = await this.fetchWithAuth(url, { method: 'GET' }, token);

      if (!response.ok) {
        this.logger.warn(`RME queue fetch gagal: ${response.status}`);
        return null;
      }

      const data = await response.json();
      return this.parseQueueResponse(data, today, queueStatus);
    } catch (err) {
      this.logger.error('Gagal fetch antrian RME:', err);
      return null;
    }
  }

  /**
   * Ambil riwayat billing pasien dari RME by noRm.
   * Dipakai untuk halaman histori transaksi dan detail billing kasir.
   */
  async getBillingByRekamMedis(rekamMedisId: string): Promise<RmeBilling | null> {
    if (!this.isConfigured()) return null;

    try {
      const token = await this.getValidToken();
      const response = await this.fetchWithAuth(
        `${this.baseUrl}/api/v1/billing/by-rm/${rekamMedisId}`,
        { method: 'GET' },
        token,
      );

      if (!response.ok) {
        this.logger.warn(`RME billing not found for rekamMedisId=${rekamMedisId}: ${response.status}`);
        return null;
      }

      const data = await response.json();
      return this.parseBillingResponse(data);
    } catch (err) {
      this.logger.error(`Gagal fetch billing RME untuk ${rekamMedisId}:`, err);
      return null;
    }
  }

  /**
   * Ambil semua riwayat billing pasien (bisa lebih dari satu kunjungan).
   * Beberapa RME return array, beberapa return single object.
   */
  async getBillingHistoryByRekamMedis(rekamMedisId: string): Promise<RmeBilling[]> {
    if (!this.isConfigured()) return [];

    try {
      const token = await this.getValidToken();
      const response = await this.fetchWithAuth(
        `${this.baseUrl}/api/v1/billing/by-rm/${rekamMedisId}`,
        { method: 'GET' },
        token,
      );

      if (!response.ok) return [];

      const data = await response.json();
      const payload = data?.data ?? data;

      // Handle kalau response adalah array atau single object
      if (Array.isArray(payload)) {
        return payload.map((item: any) => this.parseBillingResponse({ data: item })).filter(Boolean) as RmeBilling[];
      }

      const single = this.parseBillingResponse(data);
      return single ? [single] : [];
    } catch (err) {
      this.logger.error(`Gagal fetch billing history RME untuk ${rekamMedisId}:`, err);
      return [];
    }
  }

  // ─── PAY BILLING ────────────────────────────────────────────────

  async payBilling(
    rmeBillingId: string,
    posPaymentMethod: string,
    catatan?: string,
  ): Promise<boolean> {
    if (!this.isConfigured()) {
      this.logger.warn('RME tidak dikonfigurasi — skip payBilling');
      return false;
    }

    const metodePembayaran = PAYMENT_METHOD_MAP[posPaymentMethod] ?? 'TUNAI';

    try {
      const token = await this.getValidToken();
      const response = await this.fetchWithAuth(
        `${this.baseUrl}/api/v1/billing/${rmeBillingId}/pay`,
        {
          method: 'POST',
          body: JSON.stringify({
            metodePembayaran,
            catatan: catatan ?? `Dibayar via ${posPaymentMethod} - Smart Clinic POS`,
          }),
        },
        token,
      );

      if (!response.ok) {
        const errorBody = await response.text();
        this.logger.error(`Gagal update billing RME ${rmeBillingId}: ${response.status} — ${errorBody}`);
        return false;
      }

      this.logger.log(`✅ RME billing ${rmeBillingId} updated → ${metodePembayaran}`);
      return true;
    } catch (err) {
      this.logger.error(`Exception saat payBilling RME ${rmeBillingId}:`, err);
      return false;
    }
  }

  // ─── TOKEN MANAGEMENT ────────────────────────────────────────────

  private async getValidToken(): Promise<string> {
    if (this.accessToken && this.tokenExpiresAt) {
      const bufferMs = 60 * 1000;
      if (new Date().getTime() < this.tokenExpiresAt.getTime() - bufferMs) {
        return this.accessToken;
      }
    }

    if (this.refreshTokenValue) {
      try {
        return await this.doRefreshToken();
      } catch {
        this.logger.warn('Refresh token gagal, login ulang...');
        this.clearTokenCache();
      }
    }

    return await this.doLogin();
  }

  private async doLogin(): Promise<string> {
    this.logger.log('🔐 Login ke RME API...');

    const response = await fetch(`${this.baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: this.adminIdentifier,
        password: this.adminPassword,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new InternalServerErrorException(`Login RME gagal: ${response.status} — ${body}`);
    }

    const data = await response.json();
    this.storeTokens(data);
    this.logger.log('✅ Login RME berhasil');
    return this.accessToken!;
  }

  private async doRefreshToken(): Promise<string> {
    const response = await fetch(`${this.baseUrl}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: this.refreshTokenValue }),
    });

    if (!response.ok) throw new Error(`Refresh token failed: ${response.status}`);

    const data = await response.json();
    this.storeTokens(data);
    this.logger.log('🔄 RME token refreshed');
    return this.accessToken!;
  }

  private storeTokens(data: any): void {
    const tokenData = data?.data ?? data;

    this.accessToken =
      tokenData?.accessToken ?? tokenData?.access_token ?? tokenData?.token ?? null;
    this.refreshTokenValue =
      tokenData?.refreshToken ?? tokenData?.refresh_token ?? null;

    const expiresIn = tokenData?.expires_in ?? tokenData?.expiresIn ?? 3600;
    this.tokenExpiresAt = new Date(Date.now() + expiresIn * 1000);

    if (!this.accessToken) {
      throw new InternalServerErrorException('RME login response tidak mengandung access_token');
    }
  }

  private clearTokenCache(): void {
    this.accessToken = null;
    this.refreshTokenValue = null;
    this.tokenExpiresAt = null;
  }

  // ─── HELPERS ────────────────────────────────────────────────────

  private async fetchWithAuth(url: string, options: RequestInit, token: string): Promise<Response> {
    return fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...(options.headers as Record<string, string> ?? {}),
      },
    });
  }

  private parseQueueResponse(data: any, tanggal: string, status: string): RmeQueueResponse {
    const payload = data?.data ?? data;
    const items = payload?.data ?? [];

    return {
      tanggal: payload?.tanggal ?? tanggal,
      status,
      total: payload?.total ?? items.length,
      menunggu: payload?.menunggu ?? 0,
      hadir: payload?.hadir ?? 0,
      data: items.map((q: any) => ({
        id: q.id,
        pasienId: q.pasienId,
        noAntrian: q.noAntrian,
        status: q.status,
        tanggalKunjungan: q.tanggalKunjungan,
        jenisKunjunganBpjs: q.jenisKunjunganBpjs,
        catatan: q.catatan,
        pasien: q.pasien
          ? {
              namaLengkap: q.pasien.namaLengkap,
              noRm: q.pasien.noRm,
              noBpjs: q.pasien.noBpjs ?? null,
              tanggalLahir: q.pasien.tanggalLahir ?? null,
            }
          : null,
        jadwal: q.jadwal
          ? {
              dokter: {
                namaLengkap: q.jadwal.dokter?.namaLengkap ?? null,
                spesialis: q.jadwal.dokter?.spesialis ?? null,
              },
              jamMulai: q.jadwal.jamMulai ?? null,
              jamSelesai: q.jadwal.jamSelesai ?? null,
              sesi: q.jadwal.sesi ?? null,
            }
          : null,
      })),
    };
  }

  private parseBillingResponse(data: any): RmeBilling | null {
    const billing = data?.data ?? data;
    if (!billing?.id) return null;

    return {
      id: billing.id,
      rekamMedisId: billing.rekamMedisId ?? billing.rekam_medis_id ?? billing.noRm,
      status: billing.status,
      total: Number(billing.total ?? billing.totalTagihan ?? 0),
      items: (billing.items ?? billing.detail ?? []).map((item: any) => ({
        namaLayanan: item.namaLayanan ?? item.nama_layanan ?? item.name,
        harga: Number(item.harga ?? item.price ?? 0),
        jumlah: Number(item.jumlah ?? item.qty ?? item.quantity ?? 1),
        isBpjs: item.isBpjs ?? item.is_bpjs ?? false,
      })),
    };
  }

  private isConfigured(): boolean {
    return !!(this.baseUrl && this.adminIdentifier && this.adminPassword);
  }
}

// ─── TYPE DEFINITIONS ────────────────────────────────────────────

export interface RmeQueueItem {
  id: string;
  pasienId: string;
  noAntrian: string;
  status: string;
  tanggalKunjungan: string;
  jenisKunjunganBpjs: string;
  catatan: string | null;
  pasien: {
    namaLengkap: string;
    noRm: string;
    noBpjs: string | null;
    tanggalLahir: string | null;
  } | null;
  jadwal: {
    dokter: { namaLengkap: string | null; spesialis: string | null };
    jamMulai: string | null;
    jamSelesai: string | null;
    sesi: string | null;
  } | null;
}

export interface RmeQueueResponse {
  tanggal: string;
  status: string;
  total: number;
  menunggu: number;
  hadir: number;
  data: RmeQueueItem[];
}

export interface RmeBillingItem {
  namaLayanan: string;
  harga: number;
  jumlah: number;
  isBpjs: boolean;
}

export interface RmeBilling {
  id: string;
  rekamMedisId: string;
  status: string;
  total: number;
  items: RmeBillingItem[];
}

========== FILE: src/sync-log/sync-log.controller.ts ==========
// src/sync-log/sync-log.controller.ts

import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { SyncLogService } from './sync-log.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('Sync Logs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('sync-logs')
export class SyncLogController {
  constructor(private readonly syncLogService: SyncLogService) {}

  @Get('summary')
  @Roles('SUPER_ADMIN', 'MANAGER')
  @ApiOperation({
    summary: 'Ringkasan status sinkronisasi WMS & RME',
    description: 'Success rate dan jumlah total/sukses/gagal per service.',
  })
  getSummary() {
    return this.syncLogService.getSummary();
  }

  @Get()
  @Roles('SUPER_ADMIN', 'MANAGER')
  @ApiOperation({
    summary: 'List semua sync log + filter',
    description: 'Monitor semua attempt sinkronisasi ke WMS dan RME.',
  })
  @ApiQuery({ name: 'service', required: false, enum: ['WMS', 'RME'] })
  @ApiQuery({ name: 'status', required: false, enum: ['SUCCESS', 'FAILED', 'PENDING'] })
  @ApiQuery({ name: 'from', required: false, example: '2026-06-01' })
  @ApiQuery({ name: 'to', required: false, example: '2026-06-30' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  findAll(
    @Query('service') service?: string,
    @Query('status') status?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.syncLogService.findAll({
      service, status, from, to,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get('transaction/:transactionId')
  @Roles('SUPER_ADMIN', 'MANAGER', 'KASIR', 'FINANCE_STAFF')
  @ApiOperation({
    summary: 'Sync log per transaksi',
    description:
      'Lihat status sinkronisasi WMS dan RME untuk satu transaksi. ' +
      'Include summary (berhasil/gagal) dan detail semua attempt.',
  })
  getByTransaction(@Param('transactionId') transactionId: string) {
    return this.syncLogService.getByTransaction(transactionId);
  }
}

========== FILE: src/sync-log/sync-log.module.ts ==========
import { Module } from '@nestjs/common';
import { SyncLogController } from './sync-log.controller';
import { SyncLogService } from './sync-log.service';

@Module({
  controllers: [SyncLogController],
  providers: [SyncLogService],
  exports: [SyncLogService],  // export agar bisa dipakai PaymentService + WmsService
})
export class SyncLogModule {}

========== FILE: src/sync-log/sync-log.service.ts ==========
// src/sync-log/sync-log.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface CreateSyncLogParams {
  transactionId: string;
  service: 'WMS' | 'RME';
  action: string;
  status: 'SUCCESS' | 'FAILED' | 'PENDING';
  requestBody?: any;
  responseBody?: any;
  errorMessage?: string | null;
  httpStatus?: number;
  durationMs?: number;
}

@Injectable()
export class SyncLogService {
  private readonly logger = new Logger(SyncLogService.name);

  constructor(private prisma: PrismaService) {}

  // ─── CREATE ──────────────────────────────────────────────

  async create(params: CreateSyncLogParams) {
    try {
      return await this.prisma.db.syncLog.create({
        data: {
          transactionId: params.transactionId,
          service: params.service,
          action: params.action,
          status: params.status,
          requestBody: params.requestBody ?? undefined,
          responseBody: params.responseBody ?? undefined,
          errorMessage: params.errorMessage ?? null,
          httpStatus: params.httpStatus ?? null,
          durationMs: params.durationMs ?? null,
        },
      });
    } catch (err) {
      // Jangan crash aplikasi karena gagal log
      this.logger.error('Gagal create SyncLog:', err);
      return null;
    }
  }

  // ─── GET BY TRANSACTION ──────────────────────────────────

  async getByTransaction(transactionId: string) {
    const logs = await this.prisma.db.syncLog.findMany({
      where: { transactionId },
      orderBy: { createdAt: 'desc' },
    });

    const wmsLogs = logs.filter((l) => l.service === 'WMS');
    const rmeLogs = logs.filter((l) => l.service === 'RME');

    return {
      message: 'Sync logs transaksi',
      data: {
        transactionId,
        summary: {
          wms: {
            total: wmsLogs.length,
            success: wmsLogs.filter((l) => l.status === 'SUCCESS').length,
            failed: wmsLogs.filter((l) => l.status === 'FAILED').length,
          },
          rme: {
            total: rmeLogs.length,
            success: rmeLogs.filter((l) => l.status === 'SUCCESS').length,
            failed: rmeLogs.filter((l) => l.status === 'FAILED').length,
          },
        },
        logs: logs.map((l) => ({
          id: l.id,
          service: l.service,
          action: l.action,
          status: l.status,
          httpStatus: l.httpStatus,
          durationMs: l.durationMs,
          errorMessage: l.errorMessage,
          createdAt: l.createdAt,
        })),
      },
    };
  }

  // ─── GET ALL (dengan filter) ─────────────────────────────

  async findAll(query: {
    service?: string;
    status?: string;
    from?: string;
    to?: string;
    page?: number;
    limit?: number;
  }) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.service) where.service = query.service;
    if (query.status) where.status = query.status;
    if (query.from || query.to) {
      where.createdAt = {};
      if (query.from) where.createdAt.gte = new Date(query.from);
      if (query.to) {
        const d = new Date(query.to);
        d.setHours(23, 59, 59, 999);
        where.createdAt.lte = d;
      }
    }

    const [logs, total] = await Promise.all([
      this.prisma.db.syncLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          transaction: {
            select: {
              id: true,
              status: true,
              total: true,
              patient: { select: { name: true } },
            },
          },
        },
      }),
      this.prisma.db.syncLog.count({ where }),
    ]);

    return {
      data: logs.map((l) => ({
        id: l.id,
        service: l.service,
        action: l.action,
        status: l.status,
        httpStatus: l.httpStatus,
        durationMs: l.durationMs,
        errorMessage: l.errorMessage,
        createdAt: l.createdAt,
        transaction: {
          id: l.transaction.id,
          status: l.transaction.status,
          total: l.transaction.total,
          patientName: l.transaction.patient?.name ?? '-',
        },
      })),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  // ─── SUMMARY ─────────────────────────────────────────────

  async getSummary() {
    const [wmsTotal, wmsSuccess, wmsFailed, rmeTotal, rmeSuccess, rmeFailed] =
      await Promise.all([
        this.prisma.db.syncLog.count({ where: { service: 'WMS' } }),
        this.prisma.db.syncLog.count({ where: { service: 'WMS', status: 'SUCCESS' } }),
        this.prisma.db.syncLog.count({ where: { service: 'WMS', status: 'FAILED' } }),
        this.prisma.db.syncLog.count({ where: { service: 'RME' } }),
        this.prisma.db.syncLog.count({ where: { service: 'RME', status: 'SUCCESS' } }),
        this.prisma.db.syncLog.count({ where: { service: 'RME', status: 'FAILED' } }),
      ]);

    return {
      message: 'Ringkasan status sinkronisasi',
      data: {
        wms: {
          total: wmsTotal,
          success: wmsSuccess,
          failed: wmsFailed,
          successRate: wmsTotal > 0 ? Math.round((wmsSuccess / wmsTotal) * 100) : 0,
        },
        rme: {
          total: rmeTotal,
          success: rmeSuccess,
          failed: rmeFailed,
          successRate: rmeTotal > 0 ? Math.round((rmeSuccess / rmeTotal) * 100) : 0,
        },
      },
    };
  }
}

========== FILE: src/wms/wms.module.ts ==========
import { Module } from '@nestjs/common';
import { WmsService } from './wms.service';

@Module({
  providers: [WmsService],
  exports: [WmsService],
})
export class WmsModule {}

========== FILE: src/wms/wms.service.ts ==========
// src/wms/wms.service.ts

import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class WmsService {
  private readonly logger = new Logger(WmsService.name);
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor() {
    this.baseUrl = process.env.WMS_BASE_URL ?? '';
    this.apiKey = process.env.WMS_API_KEY ?? '';

    if (!this.baseUrl || !this.apiKey) {
      this.logger.warn('⚠️  WMS_BASE_URL atau WMS_API_KEY tidak di-set — WMS integration tidak aktif');
    }
  }

  // ─── QUOTE (cek harga + stok, tidak buat order) ──────────

  /**
   * Hitung harga obat dari WMS tanpa membuat order.
   * Dipanggil saat kasir preview total tagihan sebelum konfirmasi.
   */
  async getQuote(params: WmsQuoteParams): Promise<WmsQuoteResponse | null> {
    if (!this.isConfigured()) return null;

    try {
      const response = await this.fetchWms('/api/v1/pharmacy/quote', {
        method: 'POST',
        body: JSON.stringify({
          rekamMedisId: params.rekamMedisId,
          patientId: params.patientId,
          patientName: params.patientName,
          items: params.items,
        }),
      });

      if (!response.ok) {
        this.logger.warn(`WMS quote gagal: ${response.status}`);
        return null;
      }

      const data = await response.json();
      return this.parseQuoteResponse(data);
    } catch (err) {
      this.logger.error('Exception saat WMS quote:', err);
      return null;
    }
  }

  // ─── CREATE ORDER ─────────────────────────────────────────

  /**
   * Buat pharmacy order di WMS.
   * Dipanggil saat kasir konfirmasi billing → dapat wmsOrderId.
   * wmsOrderId disimpan di Transaction untuk callback setelah LUNAS.
   */
  async createOrder(params: WmsCreateOrderParams): Promise<WmsOrderResponse | null> {
    if (!this.isConfigured()) return null;

    try {
      const headers: Record<string, string> = {};
      if (params.idempotencyKey) {
        headers['x-idempotency-key'] = params.idempotencyKey;
      }

      const response = await this.fetchWms('/api/v1/pharmacy/orders', {
        method: 'POST',
        body: JSON.stringify({
          rekamMedisId: params.rekamMedisId,
          patientId: params.patientId,
          patientName: params.patientName,
          posTransactionId: params.posTransactionId,
          idempotencyKey: params.idempotencyKey,
          notes: params.notes,
          items: params.items,
        }),
        headers,
      });

      if (!response.ok) {
        const errBody = await response.text();
        this.logger.error(`WMS createOrder gagal: ${response.status} — ${errBody}`);
        return null;
      }

      const data = await response.json();
      return this.parseOrderResponse(data);
    } catch (err) {
      this.logger.error('Exception saat WMS createOrder:', err);
      return null;
    }
  }

  // ─── UPDATE PAYMENT STATUS ────────────────────────────────

  /**
   * Callback ke WMS setelah transaksi LUNAS.
   * WMS akan ubah order status → ready_to_dispense.
   * Dipanggil dari payment webhook handler.
   */
  async updatePaymentStatus(
    wmsOrderId: string,
    status: 'paid' | 'cancelled' | 'refunded',
    params?: {
      posTransactionId?: string;
      paymentReference?: string;
      paidAt?: Date;
      notes?: string;
    },
  ): Promise<boolean> {
    if (!this.isConfigured()) {
      this.logger.warn('WMS tidak dikonfigurasi — skip updatePaymentStatus');
      return false;
    }

    try {
      const body: any = { paymentStatus: status };

      if (params?.posTransactionId) body.posTransactionId = params.posTransactionId;
      if (params?.paymentReference) body.paymentReference = params.paymentReference;
      if (params?.paidAt) body.paidAt = params.paidAt.toISOString();
      if (params?.notes) body.notes = params.notes;

      const response = await this.fetchWms(
        `/api/v1/pharmacy/orders/${wmsOrderId}/payment-status`,
        { method: 'PATCH', body: JSON.stringify(body) },
      );

      if (!response.ok) {
        const errBody = await response.text();
        this.logger.error(`WMS updatePaymentStatus gagal: ${response.status} — ${errBody}`);
        return false;
      }

      this.logger.log(`✅ WMS order ${wmsOrderId} → ${status}`);
      return true;
    } catch (err) {
      this.logger.error(`Exception saat WMS updatePaymentStatus ${wmsOrderId}:`, err);
      return false;
    }
  }

  // ─── CANCEL ORDER ─────────────────────────────────────────

  /**
   * Batalkan pharmacy order sebelum dispense.
   * Dipanggil saat transaksi POS di-cancel.
   */
  async cancelOrder(wmsOrderId: string, reason?: string): Promise<boolean> {
    if (!this.isConfigured()) return false;

    try {
      const response = await this.fetchWms(
        `/api/v1/pharmacy/orders/${wmsOrderId}/cancel`,
        {
          method: 'POST',
          body: JSON.stringify({ reason: reason ?? 'Transaksi dibatalkan dari POS' }),
        },
      );

      if (!response.ok) {
        this.logger.warn(`WMS cancelOrder gagal: ${response.status}`);
        return false;
      }

      this.logger.log(`🚫 WMS order ${wmsOrderId} dibatalkan`);
      return true;
    } catch (err) {
      this.logger.error(`Exception saat WMS cancelOrder ${wmsOrderId}:`, err);
      return false;
    }
  }

  // ─── GET ORDER (untuk cek status) ────────────────────────

  async getOrder(wmsOrderId: string): Promise<WmsOrderResponse | null> {
    if (!this.isConfigured()) return null;

    try {
      const response = await this.fetchWms(
        `/api/v1/pharmacy/orders/${wmsOrderId}`,
        { method: 'GET' },
      );

      if (!response.ok) return null;

      const data = await response.json();
      return this.parseOrderResponse(data);
    } catch (err) {
      this.logger.error(`Exception saat WMS getOrder ${wmsOrderId}:`, err);
      return null;
    }
  }

  // ─── PRIVATE HELPERS ─────────────────────────────────────

  private async fetchWms(path: string, options: RequestInit & { headers?: Record<string, string> }): Promise<Response> {
    return fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        ...(options.headers ?? {}),
      },
    });
  }

  private parseQuoteResponse(data: any): WmsQuoteResponse {
    const payload = data?.data ?? data;
    return {
      canFulfill: payload?.canFulfill ?? false,
      totalObat: Number(payload?.totalObat ?? 0),
      currency: payload?.currency ?? 'IDR',
      items: (payload?.items ?? []).map((i: any) => ({
        obatId: i.obatId,
        kodeObat: i.kodeObat,
        namaObat: i.namaObat,
        qty: i.qty,
        hargaJual: Number(i.hargaJual ?? 0),
        subtotal: Number(i.subtotal ?? 0),
        stokSaatIni: i.stokSaatIni,
        stokCukup: i.stokCukup ?? false,
      })),
    };
  }

  private parseOrderResponse(data: any): WmsOrderResponse {
    const payload = data?.data ?? data;
    return {
      id: payload?.id,
      orderNo: payload?.orderNo,
      status: payload?.status,
      paymentStatus: payload?.paymentStatus,
      totalObat: Number(payload?.totalObat ?? 0),
      currency: payload?.currency ?? 'IDR',
      items: payload?.items ?? [],
    };
  }

  private isConfigured(): boolean {
    return !!(this.baseUrl && this.apiKey);
  }
}

// ─── TYPE DEFINITIONS ─────────────────────────────────────────

export interface WmsItem {
  kodeObat?: string;
  obatId?: string;
  qty: number;
  labelResep?: string;  // nama dari RME, untuk audit mapping
}

export interface WmsQuoteParams {
  items: WmsItem[];
  rekamMedisId?: string;
  patientId?: string;
  patientName?: string;
}

export interface WmsCreateOrderParams {
  items: WmsItem[];
  posTransactionId: string;
  rekamMedisId?: string;
  patientId?: string;
  patientName?: string;
  idempotencyKey?: string;
  notes?: string;
}

export interface WmsQuoteResponse {
  canFulfill: boolean;
  totalObat: number;
  currency: string;
  items: {
    obatId: string;
    kodeObat: string;
    namaObat: string;
    qty: number;
    hargaJual: number;
    subtotal: number;
    stokSaatIni: number;
    stokCukup: boolean;
  }[];
}

export interface WmsOrderResponse {
  id: string;
  orderNo: string;
  status: string;
  paymentStatus: string;
  totalObat: number;
  currency: string;
  items: any[];
}
