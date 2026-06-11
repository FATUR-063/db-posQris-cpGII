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
| **Diperbarui** | 2026-06-11 09:49:17 |
| **Total file** | 6 |
| **Total baris kode** | 586 |

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
- [src/billing/billing.controller.ts](#src-billing-billing-controller-ts) (112 baris)
- [src/billing/billing.module.ts](#src-billing-billing-module-ts) (13 baris)
- [src/billing/billing.service.spec.ts](#src-billing-billing-service-spec-ts) (19 baris)
- [src/billing/billing.service.ts](#src-billing-billing-service-ts) (356 baris)
- [src/billing/dto/create-billing.dto.ts](#src-billing-dto-create-billing-dto-ts) (67 baris)

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
import {
  Controller, Post, Get, Body, Param, Query, Request, UseGuards,
} from '@nestjs/common';
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
    summary: 'Buat transaksi baru',
    description:
      'Buat billing POS. Jika `rekamMedisId` diisi, sistem otomatis fetch ' +
      'billing dari RME dan menyimpan `rmeBillingId` untuk update status setelah LUNAS.',
  })
  create(@Body() dto: CreateBillingDto, @Request() req: any) {
    return this.billingService.createTransaction(dto, req.user.userId);
  }

  // ─── GET BILLING FROM RME (Preview) ─────────────────────

  @Get('from-rme/:rekamMedisId')
  @Roles('KASIR', 'MANAGER', 'SUPER_ADMIN')
  @ApiOperation({
    summary: 'Preview billing dari RME by rekamMedisId',
    description:
      'Ambil data billing yang sudah dibuat RME untuk pasien ini. ' +
      'Tidak membuat record di POS — hanya untuk preview sebelum transaksi dibuat. ' +
      'Response berisi rmeBillingId, total, breakdown BPJS vs non-BPJS.',
  })
  getBillingFromRme(@Param('rekamMedisId') rekamMedisId: string) {
    return this.billingService.getBillingFromRme(rekamMedisId);
  }

  // ─── LIST ALL ────────────────────────────────────────────

  @Get()
  @Roles('KASIR', 'MANAGER', 'SUPER_ADMIN', 'FINANCE_STAFF')
  @ApiOperation({ summary: 'Daftar semua transaksi + filter' })
  @ApiQuery({ name: 'status', required: false, enum: ['DRAFT', 'PENDING_PAYMENT', 'LUNAS', 'CANCELLED'] })
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
  @ApiOperation({ summary: 'Daftar invoice belum lunas (outstanding)' })
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
  @ApiOperation({ summary: 'Detail transaksi by ID' })
  findOne(@Param('id') id: string) {
    return this.billingService.getTransaction(id);
  }
}

```

---

## src/billing/billing.module.ts

```typescript
import { Module } from '@nestjs/common';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { AuthModule } from '../auth/auth.module';
import { RmeModule } from '../rme/rme.module';

@Module({
  imports: [AuthModule, RmeModule],
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
import { RmeService } from '../rme/rme.service';

@Injectable()
export class BillingService {
  constructor(
    private prisma: PrismaService,
    private rmeService: RmeService,
  ) {}

  // ─── GET BILLING FROM RME (Preview) ─────────────────────

  /**
   * Ambil data billing dari RME berdasarkan rekamMedisId.
   * Digunakan FE untuk preview billing sebelum transaksi dibuat.
   * Tidak membuat record apapun di database POS.
   */
  async getBillingFromRme(rekamMedisId: string) {
    const rmeBilling = await this.rmeService.getBillingByRekamMedis(rekamMedisId);

    if (!rmeBilling) {
      return {
        message: 'Data billing RME tidak tersedia',
        data: null,
        rmeAvailable: false,
      };
    }

    // Hitung total BPJS dan non-BPJS untuk split billing
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
    // 1. Validasi semua item ada di database POS
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

    // 3. Resolve rmeBillingId
    // Prioritas: dari dto.rmeBillingId → fetch dari RME jika ada rekamMedisId
    let rmeBillingId = dto.rmeBillingId ?? null;
    let rmeBillingTotal = 0;

    if (!rmeBillingId && dto.rekamMedisId) {
      const rmeBilling = await this.rmeService.getBillingByRekamMedis(dto.rekamMedisId);
      if (rmeBilling) {
        rmeBillingId = rmeBilling.id;
        rmeBillingTotal = rmeBilling.total;
      }
    }

    // 4. Hitung total
    const isBpjs = dto.paymentMethod === 'BPJS';
    const hasVoucher = dto.voucherCode && dto.voucherCode.trim().length > 0;
    const isFullyCovered = isBpjs || hasVoucher;

    const tax = 0;
    const adminFee = 0;
    const posItemsTotal = subtotal + tax + adminFee;

    // Total akhir = item POS + billing RME (kalau ada)
    // Kalau BPJS/voucher, total = 0
    const total = isFullyCovered ? 0 : posItemsTotal + rmeBillingTotal;

    // 5. Buat transaksi + detail (atomic)
    const transaction = await this.prisma.db.transaction.create({
      data: {
        patientId: dto.patientId,
        userId,
        paymentMethod: dto.paymentMethod as any,
        subtotal,
        tax,
        adminFee,
        total,
        status: 'PENDING_PAYMENT',
        rmeBillingId,              // simpan ID billing RME
        rekamMedisId: dto.rekamMedisId ?? null,
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
        total: transaction.total,
        rmeBillingId: transaction.rmeBillingId,
        rekamMedisId: transaction.rekamMedisId,
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

  // ─── GET TRANSACTION DETAIL ──────────────────────────────

  async getTransaction(id: string) {
    const transaction = await this.prisma.db.transaction.findUnique({
      where: { id },
      include: {
        items: { include: { item: true } },
        patient: {
          select: {
            id: true,
            name: true,
            medicalRecordNo: true,
            insuranceType: true,
          },
        },
      },
    });

    if (!transaction) throw new NotFoundException('Transaksi tidak ditemukan');

    return { message: 'Data transaksi', data: transaction };
  }

  // ─── LIST ALL TRANSACTIONS ───────────────────────────────

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

    if (query.status) where.status = query.status;
    if (query.paymentMethod) where.paymentMethod = query.paymentMethod;
    if (query.patientId) where.patientId = query.patientId;

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
          patient: {
            select: { id: true, name: true, medicalRecordNo: true, insuranceType: true },
          },
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
        total: t.total,
        rmeBillingId: t.rmeBillingId,
        createdAt: t.createdAt,
        paidAt: t.paidAt,
        patient: t.patient,
        itemCount: t.items.length,
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ─── OUTSTANDING INVOICES ────────────────────────────────

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
        orderBy: { createdAt: 'asc' },
        include: {
          patient: {
            select: {
              id: true, name: true,
              medicalRecordNo: true, phone: true, insuranceType: true,
            },
          },
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
          rmeBillingId: t.rmeBillingId,
          createdAt: t.createdAt,
          daysPending,
          patient: t.patient,
        };
      }),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  // ─── SUMMARY / DASHBOARD ────────────────────────────────

  async getSummary(query: { from?: string; to?: string }) {
    const fromDate = query.from
      ? new Date(query.from)
      : new Date(new Date().setHours(0, 0, 0, 0));
    const toDate = query.to ? new Date(query.to) : new Date();
    toDate.setHours(23, 59, 59, 999);

    const dateFilter = { gte: fromDate, lte: toDate };

    const paidTransactions = await this.prisma.db.transaction.findMany({
      where: { status: 'LUNAS', paidAt: dateFilter },
      select: { total: true, paymentMethod: true },
    });

    const totalTransactions = paidTransactions.length;
    const totalRevenue = paidTransactions.reduce((sum, t) => sum + t.total, 0);

    const byPaymentMethod: Record<string, { count: number; amount: number }> = {};
    for (const t of paidTransactions) {
      const method = t.paymentMethod ?? 'UNKNOWN';
      if (!byPaymentMethod[method]) byPaymentMethod[method] = { count: 0, amount: 0 };
      byPaymentMethod[method].count++;
      byPaymentMethod[method].amount += t.total;
    }

    const outstandingData = await this.prisma.db.transaction.aggregate({
      where: { status: 'PENDING_PAYMENT' },
      _count: true,
      _sum: { total: true },
    });

    const todayStart = new Date(new Date().setHours(0, 0, 0, 0));
    const todayEnd = new Date(new Date().setHours(23, 59, 59, 999));

    const todayData = await this.prisma.db.transaction.findMany({
      where: { status: 'LUNAS', paidAt: { gte: todayStart, lte: todayEnd } },
      select: { total: true },
    });

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
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString, IsArray, IsEnum, IsOptional,
  ValidateNested, IsInt, Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum PaymentMethod {
  CASH = 'CASH',
  QRIS = 'QRIS',
  DEBIT = 'DEBIT',
  TRANSFER = 'TRANSFER',
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
  @ApiProperty({ example: 'uuid-pasien', description: 'ID pasien di sistem POS' })
  @IsString()
  patientId: string;

  @ApiPropertyOptional({
    example: 'RM-202606-0001',
    description:
      'Nomor Rekam Medis dari RME. Jika diisi, sistem akan otomatis ' +
      'fetch billing dari RME dan menyimpan rmeBillingId.',
  })
  @IsOptional()
  @IsString()
  rekamMedisId?: string;

  @ApiPropertyOptional({
    example: 'uuid-billing-rme',
    description:
      'ID billing dari sistem RME. Diisi manual jika sudah dapat dari ' +
      'endpoint GET /billing/from-rme/:rekamMedisId.',
  })
  @IsOptional()
  @IsString()
  rmeBillingId?: string;

  @ApiProperty({ type: [CartItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CartItemDto)
  items: CartItemDto[];

  @ApiProperty({ enum: PaymentMethod, example: PaymentMethod.QRIS })
  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;

  @ApiPropertyOptional({ example: 'VOUCHER-BPJS-001' })
  @IsString()
  @IsOptional()
  voucherCode?: string;
}

```
