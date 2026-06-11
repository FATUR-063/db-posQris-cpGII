# Dokumentasi Modul — Billing

> **Di-generate otomatis.** Jangan edit manual — perbarui dengan:
>
> ```bash
> npm run docs:modules
> ```

| | |
|---|---|
| **Modul** | `billing` |
| **Folder sumber** | `src/billing` |
| **Diperbarui** | 2026-06-09 15:48:49 |
| **Total file** | 6 |
| **Total baris kode** | 526 |

---

## Struktur file

```
src/billing/
├── billing.controller.spec.ts
├── billing.controller.ts
├── billing.module.ts
├── billing.service.spec.ts
├── billing.service.ts
├── dto/create-billing.dto.ts
```

---

## Daftar isi

- [src/billing/billing.controller.spec.ts](#src-billing-billing-controller-spec-ts) (19 baris)
- [src/billing/billing.controller.ts](#src-billing-billing-controller-ts) (119 baris)
- [src/billing/billing.module.ts](#src-billing-billing-module-ts) (17 baris)
- [src/billing/billing.service.spec.ts](#src-billing-billing-service-spec-ts) (19 baris)
- [src/billing/billing.service.ts](#src-billing-billing-service-ts) (310 baris)
- [src/billing/dto/create-billing.dto.ts](#src-billing-dto-create-billing-dto-ts) (42 baris)

---

## src/billing/billing.controller.spec.ts

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { BillingController } from './billing.controller';

describe('BillingController', () => {
  let controller: BillingController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BillingController],
    }).compile();

    controller = module.get<BillingController>(BillingController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

```

---

## src/billing/billing.controller.ts

```typescript
import { Controller, Post, Get, Body, Param, Query, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { BillingService } from './billing.service';
import { CreateBillingDto } from './dto/create-billing.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('Billing')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  // ─── CREATE ─────────────────────────────────────────────

  @Post()
  @Roles('KASIR', 'MANAGER', 'SUPER_ADMIN')
  @ApiOperation({
    summary: 'Buat transaksi baru + hitung total otomatis',
    description: 'Kasir membuat transaksi billing. Total dihitung dari harga item × qty.',
  })
  create(@Body() dto: CreateBillingDto, @Request() req: any) {
    const userId = req.user.userId;
    return this.billingService.createTransaction(dto, userId);
  }

  // ─── LIST ALL ───────────────────────────────────────────

  @Get()
  @Roles('KASIR', 'MANAGER', 'SUPER_ADMIN', 'FINANCE_STAFF')
  @ApiOperation({
    summary: 'Daftar semua transaksi + filter',
    description:
      'List transaksi dengan filter status, tanggal, pasien, dan metode pembayaran. ' +
      'Mendukung pagination. Default: 20 transaksi terbaru.',
  })
  @ApiQuery({ name: 'status', required: false, enum: ['DRAFT', 'PENDING_PAYMENT', 'LUNAS', 'CANCELLED'] })
  @ApiQuery({ name: 'paymentMethod', required: false, enum: ['CASH', 'QRIS', 'DEBIT', 'TRANSFER', 'BPJS'] })
  @ApiQuery({ name: 'patientId', required: false, description: 'Filter by pasien' })
  @ApiQuery({ name: 'from', required: false, example: '2026-06-01', description: 'Tanggal mulai' })
  @ApiQuery({ name: 'to', required: false, example: '2026-06-30', description: 'Tanggal akhir' })
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
      status,
      paymentMethod,
      patientId,
      from,
      to,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  // ─── OUTSTANDING ────────────────────────────────────────

  @Get('outstanding')
  @Roles('KASIR', 'MANAGER', 'SUPER_ADMIN', 'FINANCE_STAFF')
  @ApiOperation({
    summary: 'Daftar invoice belum lunas (outstanding)',
    description:
      'Menampilkan transaksi PENDING_PAYMENT, diurutkan dari yang terlama. ' +
      'Termasuk info berapa hari tagihan belum dibayar.',
  })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  findOutstanding(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.billingService.findOutstanding({
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  // ─── SUMMARY / DASHBOARD ───────────────────────────────

  @Get('summary')
  @Roles('MANAGER', 'SUPER_ADMIN', 'FINANCE_STAFF')
  @ApiOperation({
    summary: 'Ringkasan transaksi & pendapatan (dashboard)',
    description:
      'Total transaksi, total pendapatan, outstanding, dan breakdown per metode pembayaran. ' +
      'Bisa difilter berdasarkan periode tanggal. Default: hari ini.',
  })
  @ApiQuery({ name: 'from', required: false, example: '2026-06-01', description: 'Tanggal mulai' })
  @ApiQuery({ name: 'to', required: false, example: '2026-06-30', description: 'Tanggal akhir' })
  getSummary(
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.billingService.getSummary({ from, to });
  }

  // ─── DETAIL ─────────────────────────────────────────────

  @Get(':id')
  @Roles('KASIR', 'MANAGER', 'SUPER_ADMIN', 'FINANCE_STAFF')
  @ApiOperation({
    summary: 'Detail transaksi by ID',
    description: 'Menampilkan detail transaksi lengkap dengan rincian item.',
  })
  findOne(@Param('id') id: string) {
    return this.billingService.getTransaction(id);
  }
}

```

---

## src/billing/billing.module.ts

```typescript
// src/billing/billing.module.ts
//
// PERUBAHAN: import AuthModule agar BillingController bisa pakai
// JwtAuthGuard dan RolesGuard yang di-export dari AuthModule

import { Module } from '@nestjs/common';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule], // wajib agar guard dari AuthModule tersedia
  controllers: [BillingController],
  providers: [BillingService],
})
export class BillingModule {}

```

---

## src/billing/billing.service.spec.ts

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { BillingService } from './billing.service';

describe('BillingService', () => {
  let service: BillingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [BillingService],
    }).compile();

    service = module.get<BillingService>(BillingService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

```

---

## src/billing/billing.service.ts

```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBillingDto } from './dto/create-billing.dto';

@Injectable()
export class BillingService {
  constructor(private prisma: PrismaService) {}

  // ─── CREATE TRANSACTION (existing) ──────────────────────

  async createTransaction(dto: CreateBillingDto, userId: string) {
    // 1. Validasi semua item ada di database
    const itemIds = dto.items.map((i) => i.itemId);
    const items = await this.prisma.db.item.findMany({
      where: { id: { in: itemIds } },
    });

    if (items.length !== itemIds.length) {
      throw new NotFoundException('Satu atau lebih item tidak ditemukan');
    }

    // 2. Hitung subtotal per item
    let subtotal = 0;
    const transactionItems = dto.items.map((cartItem) => {
      const item = items.find((i) => i.id === cartItem.itemId)!;
      const itemSubtotal = item.price * cartItem.quantity;
      subtotal += itemSubtotal;
      return {
        itemId: cartItem.itemId,
        quantity: cartItem.quantity,
        price: item.price,
        subtotal: itemSubtotal,
      };
    });

    // 3. Hitung pajak & admin fee
    const isBpjs = dto.paymentMethod === 'BPJS' || dto.voucherCode;
    const tax = isBpjs ? 0 : 0;
    const adminFee = isBpjs ? 0 : 0;
    const total = isBpjs ? 0 : subtotal + tax + adminFee;

    // 4. Buat transaksi + detail sekaligus (atomic)
    const transaction = await this.prisma.db.transaction.create({
      data: {
        patientId: dto.patientId,
        userId: userId,
        paymentMethod: dto.paymentMethod,
        subtotal,
        tax,
        adminFee,
        total,
        status: 'PENDING_PAYMENT',
        items: {
          create: transactionItems,
        },
      },
      include: {
        items: { include: { item: true } },
      },
    });

    return {
      message: 'Transaksi berhasil dibuat',
      data: {
        id: transaction.id,
        status: transaction.status,
        paymentMethod: transaction.paymentMethod,
        subtotal: transaction.subtotal,
        tax: transaction.tax,
        adminFee: transaction.adminFee,
        total: transaction.total,
        items: transaction.items.map((ti) => ({
          name: ti.item.name,
          type: ti.item.type,
          quantity: ti.quantity,
          price: ti.price,
          subtotal: ti.subtotal,
        })),
      },
    };
  }

  // ─── GET TRANSACTION DETAIL (existing) ──────────────────

  async getTransaction(id: string) {
    const transaction = await this.prisma.db.transaction.findUnique({
      where: { id },
      include: {
        items: { include: { item: true } },
        patient: { select: { id: true, name: true, medicalRecordNo: true, insuranceType: true } },
      },
    });

    if (!transaction) throw new NotFoundException('Transaksi tidak ditemukan');

    return { message: 'Data transaksi', data: transaction };
  }

  // ─── LIST ALL TRANSACTIONS ─────────────────────────────

  async findAll(query: {
    status?: string;
    paymentMethod?: string;
    patientId?: string;
    from?: string;
    to?: string;
    page?: number;
    limit?: number;
  }) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (query.status) {
      where.status = query.status;
    }

    if (query.paymentMethod) {
      where.paymentMethod = query.paymentMethod;
    }

    if (query.patientId) {
      where.patientId = query.patientId;
    }

    // Filter tanggal
    if (query.from || query.to) {
      where.createdAt = {};
      if (query.from) where.createdAt.gte = new Date(query.from);
      if (query.to) {
        const toDate = new Date(query.to);
        toDate.setHours(23, 59, 59, 999);
        where.createdAt.lte = toDate;
      }
    }

    const [transactions, total] = await Promise.all([
      this.prisma.db.transaction.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          patient: { select: { id: true, name: true, medicalRecordNo: true, insuranceType: true } },
          items: { include: { item: { select: { name: true, type: true } } } },
        },
      }),
      this.prisma.db.transaction.count({ where }),
    ]);

    return {
      data: transactions.map((t) => ({
        id: t.id,
        status: t.status,
        paymentMethod: t.paymentMethod,
        subtotal: t.subtotal,
        tax: t.tax,
        total: t.total,
        createdAt: t.createdAt,
        paidAt: t.paidAt,
        patient: t.patient,
        itemCount: t.items.length,
        items: t.items.map((ti) => ({
          name: ti.item.name,
          type: ti.item.type,
          quantity: ti.quantity,
          price: ti.price,
          subtotal: ti.subtotal,
        })),
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ─── OUTSTANDING INVOICES ──────────────────────────────

  async findOutstanding(query: { page?: number; limit?: number }) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where = { status: 'PENDING_PAYMENT' as const };

    const [transactions, total] = await Promise.all([
      this.prisma.db.transaction.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'asc' }, // terlama di atas
        include: {
          patient: { select: { id: true, name: true, medicalRecordNo: true, phone: true, insuranceType: true } },
          items: { include: { item: { select: { name: true, type: true } } } },
        },
      }),
      this.prisma.db.transaction.count({ where }),
    ]);

    const now = new Date();

    return {
      data: transactions.map((t) => {
        const diffMs = now.getTime() - new Date(t.createdAt).getTime();
        const daysPending = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        return {
          id: t.id,
          total: t.total,
          paymentMethod: t.paymentMethod,
          createdAt: t.createdAt,
          daysPending,
          patient: t.patient,
          items: t.items.map((ti) => ({
            name: ti.item.name,
            type: ti.item.type,
            quantity: ti.quantity,
            subtotal: ti.subtotal,
          })),
        };
      }),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ─── SUMMARY / DASHBOARD ──────────────────────────────

  async getSummary(query: { from?: string; to?: string }) {
    // Default: hari ini
    const fromDate = query.from
      ? new Date(query.from)
      : new Date(new Date().setHours(0, 0, 0, 0));

    const toDate = query.to ? new Date(query.to) : new Date();
    toDate.setHours(23, 59, 59, 999);

    const dateFilter = { gte: fromDate, lte: toDate };

    // 1. Transaksi LUNAS dalam periode
    const paidTransactions = await this.prisma.db.transaction.findMany({
      where: { status: 'LUNAS', paidAt: dateFilter },
      select: { total: true, paymentMethod: true },
    });

    const totalTransactions = paidTransactions.length;
    const totalRevenue = paidTransactions.reduce((sum, t) => sum + t.total, 0);

    // 2. Breakdown per metode pembayaran
    const byPaymentMethod: Record<string, { count: number; amount: number }> = {};
    for (const t of paidTransactions) {
      const method = t.paymentMethod ?? 'UNKNOWN';
      if (!byPaymentMethod[method]) {
        byPaymentMethod[method] = { count: 0, amount: 0 };
      }
      byPaymentMethod[method].count++;
      byPaymentMethod[method].amount += t.total;
    }

    // 3. Outstanding invoice (semua, bukan hanya dalam periode)
    const outstandingData = await this.prisma.db.transaction.aggregate({
      where: { status: 'PENDING_PAYMENT' },
      _count: true,
      _sum: { total: true },
    });

    // 4. Transaksi hari ini (always included regardless of filter)
    const todayStart = new Date(new Date().setHours(0, 0, 0, 0));
    const todayEnd = new Date(new Date().setHours(23, 59, 59, 999));

    const todayData = await this.prisma.db.transaction.findMany({
      where: { status: 'LUNAS', paidAt: { gte: todayStart, lte: todayEnd } },
      select: { total: true },
    });

    // 5. Total semua transaksi dalam periode (termasuk pending/cancelled)
    const allInPeriod = await this.prisma.db.transaction.count({
      where: { createdAt: dateFilter },
    });

    return {
      period: {
        from: fromDate.toISOString().split('T')[0],
        to: toDate.toISOString().split('T')[0],
      },
      totalTransactions,
      totalRevenue,
      allTransactionsInPeriod: allInPeriod,
      outstanding: {
        count: outstandingData._count,
        amount: outstandingData._sum.total ?? 0,
      },
      today: {
        transactions: todayData.length,
        revenue: todayData.reduce((sum, t) => sum + t.total, 0),
      },
      byPaymentMethod,
    };
  }
}

```

---

## src/billing/dto/create-billing.dto.ts

```typescript
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsArray, IsEnum, IsOptional, ValidateNested, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export enum PaymentMethod {
  CASH = 'CASH',
  QRIS = 'QRIS',
  DEBIT = 'DEBIT',
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
  @ApiProperty({ example: 'dummy-patient-id' })
  @IsString()
  patientId: string;

  @ApiProperty({ type: [CartItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CartItemDto)
  items: CartItemDto[];

  @ApiProperty({ enum: PaymentMethod, example: PaymentMethod.QRIS })
  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;

  @ApiProperty({ example: 'VOUCHER-BPJS-001', required: false })
  @IsString()
  @IsOptional()
  voucherCode?: string;
}
```
