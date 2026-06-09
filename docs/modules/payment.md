# Dokumentasi Modul — Payment

> **Di-generate otomatis.** Jangan edit manual — perbarui dengan:
>
> ```bash
> npm run docs:modules
> ```

| | |
|---|---|
| **Modul** | `payment` |
| **Folder sumber** | `src/payment` |
| **Diperbarui** | 2026-06-08 14:40:19 |
| **Total file** | 6 |
| **Total baris kode** | 299 |

---

## Struktur file

```
src/payment/
├── dto/create-payment.dto.ts
├── payment.controller.spec.ts
├── payment.controller.ts
├── payment.module.ts
├── payment.service.spec.ts
├── payment.service.ts
```

---

## Daftar isi

- [src/payment/dto/create-payment.dto.ts](#src-payment-dto-create-payment-dto-ts) (11 baris)
- [src/payment/payment.controller.spec.ts](#src-payment-payment-controller-spec-ts) (19 baris)
- [src/payment/payment.controller.ts](#src-payment-payment-controller-ts) (51 baris)
- [src/payment/payment.module.ts](#src-payment-payment-module-ts) (16 baris)
- [src/payment/payment.service.spec.ts](#src-payment-payment-service-spec-ts) (19 baris)
- [src/payment/payment.service.ts](#src-payment-payment-service-ts) (183 baris)

---

## src/payment/dto/create-payment.dto.ts

```typescript
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
```

---

## src/payment/payment.controller.spec.ts

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { PaymentController } from './payment.controller';

describe('PaymentController', () => {
  let controller: PaymentController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PaymentController],
    }).compile();

    controller = module.get<PaymentController>(PaymentController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

```

---

## src/payment/payment.controller.ts

```typescript
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
  handleWebhook(@Body() notification: any, @Req() req: Request) {
    // #region agent log
    fetch('http://127.0.0.1:7326/ingest/975ac0f8-a319-4e73-8855-f0049df4b786',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'999c66'},body:JSON.stringify({sessionId:'999c66',location:'payment.controller.ts:handleWebhook',message:'webhook request received',data:{contentType:req.headers['content-type'],bodyType:typeof req.body,bodyKeys:req.body&&typeof req.body==='object'?Object.keys(req.body):null,notificationType:typeof notification,notificationIsUndefined:notification===undefined,notificationKeys:notification&&typeof notification==='object'?Object.keys(notification):null,hasOrderId:!!notification?.order_id},timestamp:Date.now(),hypothesisId:'A,C'})}).catch(()=>{});
    // #endregion
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

```

---

## src/payment/payment.module.ts

```typescript
// src/payment/payment.module.ts
// OVERWRITE file yang sudah ada

import { Module } from '@nestjs/common';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { AuthModule } from '../auth/auth.module';
import { AccountingModule } from '../accounting/accounting.module';

@Module({
  imports: [AuthModule, AccountingModule],
  controllers: [PaymentController],
  providers: [PaymentService],
})
export class PaymentModule {}

```

---

## src/payment/payment.service.spec.ts

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { PaymentService } from './payment.service';

describe('PaymentService', () => {
  let service: PaymentService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PaymentService],
    }).compile();

    service = module.get<PaymentService>(PaymentService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

```

---

## src/payment/payment.service.ts

```typescript
// src/payment/payment.service.ts
//
// PERUBAHAN dari versi sebelumnya:
// + Inject AccountingService
// + Panggil createJournalFromTransaction() saat status → LUNAS
// + Simpan paidAt timestamp saat LUNAS

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AccountingService } from '../accounting/accounting.service';
import { TransactionStatus } from '@prisma/client';
import * as midtransClient from 'midtrans-client';

// ID system user untuk auto-journal
// Ini dipakai saat jurnal dibuat otomatis oleh sistem (bukan oleh user yang login)
// [CATATAN]: Idealnya ada dedicated system user di DB — untuk sekarang pakai ID admin pertama
const SYSTEM_USER_PLACEHOLDER = 'SYSTEM';

@Injectable()
export class PaymentService {
  private snap: midtransClient.Snap;

  constructor(
    private prisma: PrismaService,
    private accountingService: AccountingService, // inject AccountingService
  ) {
    this.snap = new midtransClient.Snap({
      isProduction: process.env.MIDTRANS_IS_PRODUCTION === 'true',
      serverKey: process.env.MIDTRANS_SERVER_KEY!,
      clientKey: process.env.MIDTRANS_CLIENT_KEY!,
    });
  }

  async createSnapToken(transactionId: string) {
    const transaction = await this.prisma.db.transaction.findUnique({
      where: { id: transactionId },
      include: {
        items: { include: { item: true } },
        patient: true,
      },
    });

    if (!transaction) throw new NotFoundException('Transaksi tidak ditemukan');

    if (transaction.status !== TransactionStatus.PENDING_PAYMENT) {
      throw new BadRequestException(
        `Transaksi tidak bisa dibayar — status saat ini: ${transaction.status}`
      );
    }

    const orderId = `POS-${transaction.id.substring(0, 8)}-${Date.now()}`;

    const itemDetails = transaction.items.map((ti) => ({
      id: ti.itemId,
      name: ti.item.name,
      price: Math.round(Number(ti.price)),
      quantity: ti.quantity,
    }));

    const customerDetails = {
      first_name: transaction.patient?.name ?? 'Pasien',
      phone: transaction.patient?.phone ?? '08000000000',
    };

    const parameter = {
      transaction_details: {
        order_id: orderId,
        gross_amount: Math.round(Number(transaction.total)),
      },
      item_details: itemDetails,
      customer_details: customerDetails,
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
        total: transaction.total,
      },
    };
  }

  async handleWebhook(notification: any) {
    // #region agent log
    fetch('http://127.0.0.1:7326/ingest/975ac0f8-a319-4e73-8855-f0049df4b786',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'999c66'},body:JSON.stringify({sessionId:'999c66',location:'payment.service.ts:handleWebhook',message:'service entry',data:{notificationType:typeof notification,notificationIsUndefined:notification===undefined,notificationIsNull:notification===null,rawNotification:notification?{order_id:notification.order_id,transaction_status:notification.transaction_status,fraud_status:notification.fraud_status}:null},timestamp:Date.now(),hypothesisId:'A,B'})}).catch(()=>{});
    // #endregion
    const orderId = notification.order_id;
    const transactionStatus = notification.transaction_status;
    const fraudStatus = notification.fraud_status;

    const transaction = await this.prisma.db.transaction.findFirst({
      where: { midtransOrderId: orderId },
    });

    if (!transaction) {
      throw new NotFoundException(`Transaksi dengan order_id ${orderId} tidak ditemukan`);
    }

    // Tentukan status baru menggunakan TransactionStatus enum
    let newStatus: TransactionStatus = transaction.status;

    if (transactionStatus === 'settlement') {
      newStatus = TransactionStatus.LUNAS;
    } else if (transactionStatus === 'capture') {
      newStatus = fraudStatus === 'accept'
        ? TransactionStatus.LUNAS
        : TransactionStatus.CANCELLED;
    } else if (['cancel', 'deny', 'expire'].includes(transactionStatus)) {
      newStatus = TransactionStatus.CANCELLED;
    }

    // Update status di DB
    await this.prisma.db.transaction.update({
      where: { id: transaction.id },
      data: {
        status: newStatus,
        // Simpan timestamp saat LUNAS
        ...(newStatus === TransactionStatus.LUNAS && { paidAt: new Date() }),
      },
    });

    // ✅ AUTO-JOURNAL: buat jurnal akuntansi otomatis saat LUNAS
    // Hanya dibuat sekali — AccountingService sudah handle idempotency
    if (newStatus === TransactionStatus.LUNAS) {
      try {
        // Ambil ID user pertama sebagai fallback system user
        // [CATATAN]: Idealnya pakai dedicated system account
        const systemUser = await this.prisma.db.user.findFirst({
          where: { role: 'SUPER_ADMIN' },
        });

        const journalCreatedBy = systemUser?.id ?? transaction.userId;
        await this.accountingService.createJournalFromTransaction(
          transaction.id,
          journalCreatedBy,
        );
      } catch (err) {
        // Jangan gagalkan webhook karena error jurnal
        // Log error tapi tetap return success ke Midtrans
        console.error(`❌ Auto-journal gagal untuk transaksi ${transaction.id}:`, err);
      }
    }

    console.log(`✅ Webhook: Order ${orderId} → status ${newStatus}`);
    return { message: 'Webhook berhasil diproses', status: newStatus };
  }

  async getTransactionStatus(transactionId: string) {
    const transaction = await this.prisma.db.transaction.findUnique({
      where: { id: transactionId },
      include: {
        items: { include: { item: true } },
        patient: true,
      },
    });

    if (!transaction) throw new NotFoundException('Transaksi tidak ditemukan');

    return {
      message: 'Status transaksi',
      data: {
        id: transaction.id,
        status: transaction.status,
        total: transaction.total,
        paymentMethod: transaction.paymentMethod,
        midtransOrderId: transaction.midtransOrderId,
        paidAt: transaction.paidAt,
      },
    };
  }
}

```
