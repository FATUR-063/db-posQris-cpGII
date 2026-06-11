import {
  Injectable, NotFoundException, BadRequestException, Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBillingDto } from './dto/create-billing.dto';
import { AddPaymentDto } from './dto/add-payment.dto';
import { RmeService } from '../rme/rme.service';
import * as midtransClient from 'midtrans-client';

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);
  private snap: midtransClient.Snap;

  constructor(
    private prisma: PrismaService,
    private rmeService: RmeService,
  ) {
    this.snap = new midtransClient.Snap({
      isProduction: process.env.MIDTRANS_IS_PRODUCTION === 'true',
      serverKey: process.env.MIDTRANS_SERVER_KEY!,
      clientKey: process.env.MIDTRANS_CLIENT_KEY!,
    });
  }

  // ─── GET BILLING FROM RME (Preview) ─────────────────────

  async getBillingFromRme(rekamMedisId: string) {
    const rmeBilling = await this.rmeService.getBillingByRekamMedis(rekamMedisId);

    if (!rmeBilling) {
      return {
        message: 'Data billing RME tidak tersedia',
        data: null,
        rmeAvailable: false,
      };
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
    const itemIds = dto.items.map((i) => i.itemId);
    const items = await this.prisma.db.item.findMany({
      where: { id: { in: itemIds } },
    });

    if (items.length !== itemIds.length) {
      throw new NotFoundException('Satu atau lebih item tidak ditemukan');
    }

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

    // Resolve rmeBillingId + bpjsAmount dari RME
    let rmeBillingId = dto.rmeBillingId ?? null;
    let bpjsAmount = 0;
    let nonBpjsAmount = 0;

    if (dto.rekamMedisId) {
      const rmeBilling = await this.rmeService.getBillingByRekamMedis(dto.rekamMedisId);
      if (rmeBilling) {
        rmeBillingId = rmeBilling.id;
        bpjsAmount = rmeBilling.items
          .filter((i) => i.isBpjs)
          .reduce((sum, i) => sum + i.harga * i.jumlah, 0);
        nonBpjsAmount = rmeBilling.items
          .filter((i) => !i.isBpjs)
          .reduce((sum, i) => sum + i.harga * i.jumlah, 0);
      }
    }

    const tax = 0;
    const adminFee = 0;
    const isBpjs = dto.paymentMethod === 'BPJS';
    const hasVoucher = dto.voucherCode && dto.voucherCode.trim().length > 0;
    const isFullyCovered = isBpjs || hasVoucher;

    const posTotal = subtotal + tax + adminFee;
    const rmeTotal = bpjsAmount + nonBpjsAmount;
    const total = isFullyCovered ? 0 : posTotal + (rmeTotal > 0 ? nonBpjsAmount : 0);

    const transaction = await this.prisma.db.transaction.create({
      data: {
        patientId: dto.patientId,
        userId,
        paymentMethod: dto.paymentMethod as any,
        subtotal,
        tax,
        adminFee,
        total,
        paidAmount: 0,
        bpjsAmount,
        nonBpjsAmount,
        status: 'PENDING_PAYMENT',
        rmeBillingId,
        rekamMedisId: dto.rekamMedisId ?? null,
        items: { create: transactionItems },
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
        total: transaction.total,
        paidAmount: transaction.paidAmount,
        remainingAmount: transaction.total - transaction.paidAmount,
        bpjsAmount: transaction.bpjsAmount,
        nonBpjsAmount: transaction.nonBpjsAmount,
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

  // ─── ADD PAYMENT (SPLIT BILL) ────────────────────────────

  async addPayment(transactionId: string, dto: AddPaymentDto, userId: string) {
    const transaction = await this.prisma.db.transaction.findUnique({
      where: { id: transactionId },
      include: { patient: true, payments: true },
    });

    if (!transaction) throw new NotFoundException('Transaksi tidak ditemukan');

    // Validasi status
    if (['LUNAS', 'CANCELLED'].includes(transaction.status)) {
      throw new BadRequestException(
        `Tidak bisa menambah pembayaran — status transaksi: ${transaction.status}`,
      );
    }

    // Cek ada QRIS yang masih PENDING
    const pendingQris = transaction.payments.find(
      (p) => p.method === 'QRIS' && p.status === 'PENDING',
    );
    if (pendingQris && dto.method === 'QRIS') {
      throw new BadRequestException(
        'Ada pembayaran QRIS yang masih menunggu konfirmasi. ' +
        'Tunggu atau batalkan dulu sebelum generate QRIS baru.',
      );
    }

    // Validasi amount
    const remainingAmount = transaction.total - transaction.paidAmount;
    if (dto.amount > remainingAmount + 0.01) {
      throw new BadRequestException(
        `Nominal melebihi sisa tagihan. Sisa: Rp ${remainingAmount.toLocaleString('id-ID')}`,
      );
    }

    // ─── CASH / DEBIT / TRANSFER / BPJS — langsung PAID ────
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

      // Trigger post-payment jika LUNAS
      if (isFullyPaid) {
        this.logger.log(`✅ Transaksi ${transactionId} LUNAS via ${dto.method}`);
        await this.triggerPostPaymentActions(transactionId, transaction.rmeBillingId, dto.method, userId);
      }

      return {
        message: isFullyPaid ? 'Pembayaran lunas!' : `Pembayaran ${dto.method} berhasil dicatat`,
        data: {
          payment: {
            id: payment.id,
            method: payment.method,
            amount: payment.amount,
            status: payment.status,
          },
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

    // ─── QRIS — generate Midtrans Snap token ────────────────
    const midtransOrderId = `POS-${transactionId.substring(0, 8)}-PAY-${Date.now()}`;

    // Buat Payment record PENDING dulu
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

    // Generate Snap token untuk amount parsial
    const parameter = {
      transaction_details: {
        order_id: midtransOrderId,
        gross_amount: Math.round(dto.amount),
      },
      customer_details: {
        first_name: transaction.patient?.name ?? 'Pasien',
        phone: transaction.patient?.phone ?? '08000000000',
      },
      payment_type_filter: ['qris'],
    };

    const snapResponse = await this.snap.createTransaction(parameter);

    // Update status transaksi ke PARTIAL (kalau belum)
    if (transaction.status === 'PENDING_PAYMENT') {
      await this.prisma.db.transaction.update({
        where: { id: transactionId },
        data: { status: 'PARTIAL' as any },
      });
    }

    return {
      message: 'QRIS berhasil di-generate, tunggu pembayaran dari pasien',
      data: {
        payment: {
          id: payment.id,
          method: 'QRIS',
          amount: payment.amount,
          status: 'PENDING',
          midtransOrderId,
        },
        snapToken: snapResponse.token,
        snapRedirectUrl: snapResponse.redirect_url,
        transaction: {
          id: transactionId,
          status: 'PARTIAL',
          total: transaction.total,
          paidAmount: transaction.paidAmount,
          remainingAmount: remainingAmount,
        },
      },
    };
  }

  // ─── GET PAYMENTS (histori pembayaran) ──────────────────

  async getPayments(transactionId: string) {
    const transaction = await this.prisma.db.transaction.findUnique({
      where: { id: transactionId },
      include: {
        payments: { orderBy: { createdAt: 'asc' } },
        patient: { select: { id: true, name: true, insuranceType: true } },
      },
    });

    if (!transaction) throw new NotFoundException('Transaksi tidak ditemukan');

    const remainingAmount = transaction.total - transaction.paidAmount;

    return {
      message: 'Histori pembayaran',
      data: {
        transactionId,
        status: transaction.status,
        total: transaction.total,
        paidAmount: transaction.paidAmount,
        remainingAmount: Math.max(0, remainingAmount),
        bpjsAmount: transaction.bpjsAmount,
        nonBpjsAmount: transaction.nonBpjsAmount,
        patient: transaction.patient,
        payments: transaction.payments.map((p) => ({
          id: p.id,
          method: p.method,
          amount: p.amount,
          status: p.status,
          isBpjsCoverage: p.isBpjsCoverage,
          reference: p.reference,
          paidAt: p.paidAt,
          createdAt: p.createdAt,
        })),
      },
    };
  }

  // ─── CANCEL PENDING QRIS PAYMENT ────────────────────────

  async cancelPendingQris(transactionId: string, paymentId: string) {
    const payment = await this.prisma.db.payment.findFirst({
      where: { id: paymentId, transactionId, method: 'QRIS', status: 'PENDING' },
    });

    if (!payment) {
      throw new NotFoundException('Payment QRIS pending tidak ditemukan');
    }

    await this.prisma.db.payment.update({
      where: { id: paymentId },
      data: { status: 'CANCELLED' },
    });

    // Kembalikan status transaksi ke PENDING_PAYMENT kalau tidak ada payment lain yang PAID
    const transaction = await this.prisma.db.transaction.findUnique({
      where: { id: transactionId },
      include: { payments: true },
    });

    const hasPaidPayment = transaction?.payments.some((p) => p.status === 'PAID');
    if (!hasPaidPayment) {
      await this.prisma.db.transaction.update({
        where: { id: transactionId },
        data: { status: 'PENDING_PAYMENT' as any },
      });
    }

    return { message: 'QRIS payment dibatalkan', paymentId };
  }

  // ─── POST-PAYMENT ACTIONS (dipanggil saat LUNAS) ────────

  async triggerPostPaymentActions(
    transactionId: string,
    rmeBillingId: string | null,
    paymentMethod: string,
    userId: string,
  ): Promise<void> {
    // Ini akan dipanggil oleh BillingService (cash) dan PaymentService (webhook QRIS)
    // Dibuat public agar PaymentService bisa reuse
    // Note: AccountingService di-inject via PaymentService untuk webhook
    // Untuk cash payment, kita emit event atau panggil langsung
    // Untuk sekarang: log saja, PaymentService yang handle accounting
    this.logger.log(`Post-payment actions untuk ${transactionId}: RME=${rmeBillingId}, method=${paymentMethod}`);

    // RME pay callback
    if (rmeBillingId) {
      await this.rmeService.payBilling(
        rmeBillingId,
        paymentMethod,
        `Lunas via Smart Clinic POS | TrxID: ${transactionId}`,
      );
    }
  }

  // ─── GET TRANSACTION DETAIL ──────────────────────────────

  async getTransaction(id: string) {
    const transaction = await this.prisma.db.transaction.findUnique({
      where: { id },
      include: {
        items: { include: { item: true } },
        payments: { orderBy: { createdAt: 'asc' } },
        patient: {
          select: { id: true, name: true, medicalRecordNo: true, insuranceType: true },
        },
      },
    });

    if (!transaction) throw new NotFoundException('Transaksi tidak ditemukan');

    return {
      message: 'Data transaksi',
      data: {
        ...transaction,
        remainingAmount: Math.max(0, transaction.total - transaction.paidAmount),
      },
    };
  }

  // ─── LIST ALL ────────────────────────────────────────────

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
          patient: { select: { id: true, name: true, medicalRecordNo: true, insuranceType: true } },
          items: { include: { item: { select: { name: true, type: true } } } },
          payments: { where: { status: 'PAID' }, select: { method: true, amount: true } },
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
        paidAmount: t.paidAmount,
        remainingAmount: Math.max(0, t.total - t.paidAmount),
        rmeBillingId: t.rmeBillingId,
        createdAt: t.createdAt,
        paidAt: t.paidAt,
        patient: t.patient,
        itemCount: t.items.length,
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

    // Outstanding = PENDING_PAYMENT atau PARTIAL
    const where: any = { status: { in: ['PENDING_PAYMENT', 'PARTIAL'] } };

    const [transactions, total] = await Promise.all([
      this.prisma.db.transaction.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'asc' },
        include: {
          patient: {
            select: { id: true, name: true, medicalRecordNo: true, phone: true, insuranceType: true },
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
          status: t.status,
          total: t.total,
          paidAmount: t.paidAmount,
          remainingAmount: Math.max(0, t.total - t.paidAmount),
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

  // ─── SUMMARY ─────────────────────────────────────────────

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

    const byPaymentMethod: Record<string, { count: number; amount: number }> = {};
    for (const t of paidTransactions) {
      const method = t.paymentMethod ?? 'UNKNOWN';
      if (!byPaymentMethod[method]) byPaymentMethod[method] = { count: 0, amount: 0 };
      byPaymentMethod[method].count++;
      byPaymentMethod[method].amount += t.total;
    }

    const outstandingData = await this.prisma.db.transaction.aggregate({
      where: { status: { in: ['PENDING_PAYMENT', 'PARTIAL'] } },
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
      totalTransactions: paidTransactions.length,
      totalRevenue: paidTransactions.reduce((sum, t) => sum + t.total, 0),
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
