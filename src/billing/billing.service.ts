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
