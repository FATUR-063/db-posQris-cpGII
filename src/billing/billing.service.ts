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
