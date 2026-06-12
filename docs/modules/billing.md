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
| **Diperbarui** | 2026-06-12 06:54:15 |
| **Total file** | 7 |
| **Total baris kode** | 962 |

---

## Struktur file

```
src/billing/
├── billing.controller.spec.ts
├── billing.controller.ts
├── billing.module.ts
├── billing.service.spec.ts
├── billing.service.ts
├── dto/add-payment.dto.ts
├── dto/create-billing.dto.ts
```

---

## Daftar isi

- [src/billing/billing.controller.spec.ts](#src-billing-billing-controller-spec-ts) (19 baris)
- [src/billing/billing.controller.ts](#src-billing-billing-controller-ts) (189 baris)
- [src/billing/billing.module.ts](#src-billing-billing-module-ts) (14 baris)
- [src/billing/billing.service.spec.ts](#src-billing-billing-service-spec-ts) (19 baris)
- [src/billing/billing.service.ts](#src-billing-billing-service-ts) (560 baris)
- [src/billing/dto/add-payment.dto.ts](#src-billing-dto-add-payment-dto-ts) (52 baris)
- [src/billing/dto/create-billing.dto.ts](#src-billing-dto-create-billing-dto-ts) (109 baris)

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

```

---

## src/billing/billing.module.ts

```typescript
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

```

---

## src/billing/dto/add-payment.dto.ts

```typescript
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

```

---

## src/billing/dto/create-billing.dto.ts

```typescript
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

```
