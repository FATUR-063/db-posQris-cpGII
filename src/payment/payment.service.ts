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
