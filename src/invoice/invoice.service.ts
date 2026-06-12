// src/invoice/invoice.service.ts

import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RmeService } from '../rme/rme.service';
import { WmsService } from '../wms/wms.service';

@Injectable()
export class InvoiceService {
  private readonly logger = new Logger(InvoiceService.name);

  constructor(
    private prisma: PrismaService,
    private rmeService: RmeService,
    private wmsService: WmsService,
  ) {}

  async getInvoice(transactionId: string) {
    // 1. Ambil data transaksi lengkap dari POS
    const transaction = await this.prisma.db.transaction.findUnique({
      where: { id: transactionId },
      include: {
        patient: true,
        user: { select: { id: true, name: true, email: true, role: true } },
        items: { include: { item: true } },
        payments: {
          where: { status: 'PAID' },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!transaction) throw new NotFoundException('Transaksi tidak ditemukan');

    // 2. Resolve phone — POS dulu, fallback ke RME
    let phone = transaction.patient?.phone ?? null;

    if (!phone && transaction.rekamMedisId) {
      try {
        const token = await (this.rmeService as any).getValidToken();
        const res = await fetch(
          `${process.env.RME_BASE_URL}/api/v1/patients?search=${transaction.rekamMedisId}`,
          { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } },
        );
        if (res.ok) {
          const data = await res.json();
          const patients = data?.data?.data ?? data?.data ?? [];
          const found = patients.find(
            (p: any) => p.noRm === transaction.rekamMedisId || p.id === transaction.rekamMedisId,
          );
          phone = found?.telepon ?? found?.phone ?? null;
        }
      } catch {
        this.logger.warn(`Gagal fetch phone dari RME untuk ${transaction.rekamMedisId}`);
      }
    }

    if (!phone) {
      this.logger.warn(`⚠️ No. HP tidak ditemukan untuk transaksi ${transactionId}`);
    }

    // 3. Ambil detail item RME (opsional)
    let rmeItems: any[] = [];
    if (transaction.rekamMedisId) {
      const rmeBilling = await this.rmeService.getBillingByRekamMedis(transaction.rekamMedisId);
      if (rmeBilling) {
        rmeItems = rmeBilling.items.map((i) => ({
          namaLayanan: i.namaLayanan,
          harga: i.harga,
          jumlah: i.jumlah,
          subtotal: i.harga * i.jumlah,
          isBpjs: i.isBpjs,
          ditanggungBpjs: i.isBpjs,
        }));
      }
    }

    // 4. Ambil detail item WMS (opsional)
    let wmsItems: any[] = [];
    if (transaction.wmsOrderId) {
      const wmsOrder = await this.wmsService.getOrder(transaction.wmsOrderId);
      if (wmsOrder) {
        wmsItems = (wmsOrder.items ?? []).map((i: any) => ({
          namaObat: i.namaObat ?? i.kodeObat,
          kodeObat: i.kodeObat,
          qty: i.qty,
          hargaJual: Number(i.hargaJual ?? 0),
          subtotal: Number(i.subtotal ?? 0),
        }));
      }
    }

    // 5. Generate invoice number
    const invoiceNo = this.generateInvoiceNo(transaction.id, transaction.createdAt);

    // 6. Susun response lengkap
    return {
      message: 'Data invoice berhasil diambil',
      data: {
        invoiceNo,
        issuedAt: transaction.createdAt,
        paidAt: transaction.paidAt ?? null,
        status: transaction.status,

        patient: {
          id: transaction.patient?.id,
          name: transaction.patient?.name ?? 'Pasien',
          medicalRecordNo: transaction.patient?.medicalRecordNo ?? null,
          phone,                                          // ← WAJIB untuk WA
          noBpjs: transaction.patient?.noBpjs ?? null,
          insuranceType: transaction.patient?.insuranceType ?? 'UMUM',
        },

        kasir: {
          id: transaction.user?.id,
          name: transaction.user?.name ?? 'Kasir',
        },

        items: {
          posItems: transaction.items.map((ti) => ({
            name: ti.item.name,
            type: ti.item.type,
            qty: ti.quantity,
            price: ti.price,
            subtotal: ti.subtotal,
          })),
          rmeItems,
          wmsItems,
        },

        billing: {
          subtotal: transaction.subtotal,
          tax: transaction.tax,
          adminFee: transaction.adminFee,
          bpjsAmount: transaction.bpjsAmount,
          nonBpjsAmount: transaction.nonBpjsAmount,
          total: transaction.total,
          paidAmount: transaction.paidAmount,
          remainingAmount: Math.max(0, transaction.total - transaction.paidAmount),
        },

        payments: transaction.payments.map((p) => ({
          method: p.method,
          amount: p.amount,
          isBpjsCoverage: p.isBpjsCoverage,
          reference: p.reference ?? null,
          paidAt: p.paidAt,
        })),

        meta: {
          rmeBillingId: transaction.rmeBillingId ?? null,
          wmsOrderId: transaction.wmsOrderId ?? null,
          rekamMedisId: transaction.rekamMedisId ?? null,
          hasRmeData: rmeItems.length > 0,
          hasWmsData: wmsItems.length > 0,
          phoneAvailable: !!phone,
        },
      },
    };
  }

  private generateInvoiceNo(transactionId: string, createdAt: Date): string {
    const date = new Date(createdAt);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const suffix = transactionId.substring(0, 6).toUpperCase();
    return `INV-${y}${m}${d}-${suffix}`;
  }
}
