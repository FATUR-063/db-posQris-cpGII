import {
  Injectable, NotFoundException, BadRequestException, Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AccountingService } from '../accounting/accounting.service';
import { RmeService } from '../rme/rme.service';
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
      include: {
        items: { include: { item: true } },
        patient: true,
      },
    });

    if (!transaction) throw new NotFoundException('Transaksi tidak ditemukan');

    if (transaction.status !== TransactionStatus.PENDING_PAYMENT) {
      throw new BadRequestException(
        `Transaksi tidak bisa dibayar — status saat ini: ${transaction.status}`,
      );
    }

    const orderId = `POS-${transaction.id.substring(0, 8)}-${Date.now()}`;

    const itemDetails = transaction.items.map((ti) => ({
      id: ti.itemId,
      name: ti.item.name,
      price: Math.round(Number(ti.price)),
      quantity: ti.quantity,
    }));

    const parameter = {
      transaction_details: {
        order_id: orderId,
        gross_amount: Math.round(Number(transaction.total)),
      },
      item_details: itemDetails,
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
        total: transaction.total,
        rmeBillingId: transaction.rmeBillingId,
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

    const transaction = await this.prisma.db.transaction.findFirst({
      where: { midtransOrderId: orderId },
    });

    if (!transaction) {
      throw new NotFoundException(`Transaksi dengan order_id ${orderId} tidak ditemukan`);
    }

    // Tentukan status baru
    let newStatus: TransactionStatus = transaction.status;

    if (transactionStatus === 'settlement') {
      newStatus = TransactionStatus.LUNAS;
    } else if (transactionStatus === 'capture') {
      newStatus = fraudStatus === 'accept'
        ? TransactionStatus.LUNAS
        : TransactionStatus.CANCELLED;
    } else if (['cancel', 'deny', 'expire', 'failure'].includes(transactionStatus)) {
      newStatus = TransactionStatus.CANCELLED;
    }

    // Update status di DB POS
    await this.prisma.db.transaction.update({
      where: { id: transaction.id },
      data: {
        status: newStatus,
        ...(newStatus === TransactionStatus.LUNAS && { paidAt: new Date() }),
      },
    });

    // ─── Post-LUNAS actions (paralel, tidak boleh gagalkan webhook) ───
    if (newStatus === TransactionStatus.LUNAS) {
      this.logger.log(`✅ Transaksi ${transaction.id} LUNAS — jalankan post-payment actions`);

      // Jalankan semua aksi post-payment secara paralel
      await Promise.allSettled([
        this.handleAutoJournal(transaction.id, transaction.userId),
        this.handleRmePayCallback(
          transaction.rmeBillingId,
          transaction.paymentMethod as string,
          transaction.id,
        ),
        // TODO: handleWmsCallback() — WMS integration (sprint berikutnya)
      ]);
    }

    this.logger.log(`Webhook: Order ${orderId} → status ${newStatus}`);
    return { message: 'Webhook berhasil diproses', status: newStatus };
  }

  // ─── GET TRANSACTION STATUS ──────────────────────────────

  async getTransactionStatus(transactionId: string) {
    const transaction = await this.prisma.db.transaction.findUnique({
      where: { id: transactionId },
      include: {
        patient: { select: { id: true, name: true, medicalRecordNo: true } },
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
        rmeBillingId: transaction.rmeBillingId,
        paidAt: transaction.paidAt,
        patient: transaction.patient,
      },
    };
  }

  // ─── PRIVATE: Post-payment handlers ──────────────────────

  private async handleAutoJournal(
    transactionId: string,
    userId: string,
  ): Promise<void> {
    try {
      const systemUser = await this.prisma.db.user.findFirst({
        where: { role: 'SUPER_ADMIN' },
      });
      const createdBy = systemUser?.id ?? userId;
      await this.accountingService.createJournalFromTransaction(transactionId, createdBy);
      this.logger.log(`📒 Auto-journal created for transaction ${transactionId}`);
    } catch (err) {
      this.logger.error(`Auto-journal gagal untuk ${transactionId}:`, err);
    }
  }

  private async handleRmePayCallback(
    rmeBillingId: string | null,
    paymentMethod: string,
    posTransactionId: string,
  ): Promise<void> {
    if (!rmeBillingId) {
      this.logger.debug(
        `Transaksi ${posTransactionId} tidak punya rmeBillingId — skip RME callback`,
      );
      return;
    }

    const catatan = `Lunas via Smart Clinic POS | TrxID: ${posTransactionId}`;
    const success = await this.rmeService.payBilling(rmeBillingId, paymentMethod, catatan);

    if (!success) {
      this.logger.warn(
        `⚠️  RME pay callback gagal untuk billing ${rmeBillingId} — perlu manual follow-up`,
      );
      // TODO: simpan ke retry queue atau alert table untuk follow-up manual
    }
  }
}
