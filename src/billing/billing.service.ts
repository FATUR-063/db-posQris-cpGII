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
