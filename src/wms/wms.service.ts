// src/wms/wms.service.ts

import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class WmsService {
  private readonly logger = new Logger(WmsService.name);
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor() {
    this.baseUrl = process.env.WMS_BASE_URL ?? '';
    this.apiKey = process.env.WMS_API_KEY ?? '';

    if (!this.baseUrl || !this.apiKey) {
      this.logger.warn('⚠️  WMS_BASE_URL atau WMS_API_KEY tidak di-set — WMS integration tidak aktif');
    }
  }

  // ─── QUOTE (cek harga + stok, tidak buat order) ──────────

  /**
   * Hitung harga obat dari WMS tanpa membuat order.
   * Dipanggil saat kasir preview total tagihan sebelum konfirmasi.
   */
  async getQuote(params: WmsQuoteParams): Promise<WmsQuoteResponse | null> {
    if (!this.isConfigured()) return null;

    try {
      const response = await this.fetchWms('/api/v1/pharmacy/quote', {
        method: 'POST',
        body: JSON.stringify({
          rekamMedisId: params.rekamMedisId,
          patientId: params.patientId,
          patientName: params.patientName,
          items: params.items,
        }),
      });

      if (!response.ok) {
        this.logger.warn(`WMS quote gagal: ${response.status}`);
        return null;
      }

      const data = await response.json();
      return this.parseQuoteResponse(data);
    } catch (err) {
      this.logger.error('Exception saat WMS quote:', err);
      return null;
    }
  }

  // ─── CREATE ORDER ─────────────────────────────────────────

  /**
   * Buat pharmacy order di WMS.
   * Dipanggil saat kasir konfirmasi billing → dapat wmsOrderId.
   * wmsOrderId disimpan di Transaction untuk callback setelah LUNAS.
   */
  async createOrder(params: WmsCreateOrderParams): Promise<WmsOrderResponse | null> {
    if (!this.isConfigured()) return null;

    try {
      const headers: Record<string, string> = {};
      if (params.idempotencyKey) {
        headers['x-idempotency-key'] = params.idempotencyKey;
      }

      const response = await this.fetchWms('/api/v1/pharmacy/orders', {
        method: 'POST',
        body: JSON.stringify({
          rekamMedisId: params.rekamMedisId,
          patientId: params.patientId,
          patientName: params.patientName,
          posTransactionId: params.posTransactionId,
          idempotencyKey: params.idempotencyKey,
          notes: params.notes,
          items: params.items,
        }),
        headers,
      });

      if (!response.ok) {
        const errBody = await response.text();
        this.logger.error(`WMS createOrder gagal: ${response.status} — ${errBody}`);
        return null;
      }

      const data = await response.json();
      return this.parseOrderResponse(data);
    } catch (err) {
      this.logger.error('Exception saat WMS createOrder:', err);
      return null;
    }
  }

  // ─── UPDATE PAYMENT STATUS ────────────────────────────────

  /**
   * Callback ke WMS setelah transaksi LUNAS.
   * WMS akan ubah order status → ready_to_dispense.
   * Dipanggil dari payment webhook handler.
   */
  async updatePaymentStatus(
    wmsOrderId: string,
    status: 'paid' | 'cancelled' | 'refunded',
    params?: {
      posTransactionId?: string;
      paymentReference?: string;
      paidAt?: Date;
      notes?: string;
    },
  ): Promise<boolean> {
    if (!this.isConfigured()) {
      this.logger.warn('WMS tidak dikonfigurasi — skip updatePaymentStatus');
      return false;
    }

    try {
      const body: any = { paymentStatus: status };

      if (params?.posTransactionId) body.posTransactionId = params.posTransactionId;
      if (params?.paymentReference) body.paymentReference = params.paymentReference;
      if (params?.paidAt) body.paidAt = params.paidAt.toISOString();
      if (params?.notes) body.notes = params.notes;

      const response = await this.fetchWms(
        `/api/v1/pharmacy/orders/${wmsOrderId}/payment-status`,
        { method: 'PATCH', body: JSON.stringify(body) },
      );

      if (!response.ok) {
        const errBody = await response.text();
        this.logger.error(`WMS updatePaymentStatus gagal: ${response.status} — ${errBody}`);
        return false;
      }

      this.logger.log(`✅ WMS order ${wmsOrderId} → ${status}`);
      return true;
    } catch (err) {
      this.logger.error(`Exception saat WMS updatePaymentStatus ${wmsOrderId}:`, err);
      return false;
    }
  }

  // ─── CANCEL ORDER ─────────────────────────────────────────

  /**
   * Batalkan pharmacy order sebelum dispense.
   * Dipanggil saat transaksi POS di-cancel.
   */
  async cancelOrder(wmsOrderId: string, reason?: string): Promise<boolean> {
    if (!this.isConfigured()) return false;

    try {
      const response = await this.fetchWms(
        `/api/v1/pharmacy/orders/${wmsOrderId}/cancel`,
        {
          method: 'POST',
          body: JSON.stringify({ reason: reason ?? 'Transaksi dibatalkan dari POS' }),
        },
      );

      if (!response.ok) {
        this.logger.warn(`WMS cancelOrder gagal: ${response.status}`);
        return false;
      }

      this.logger.log(`🚫 WMS order ${wmsOrderId} dibatalkan`);
      return true;
    } catch (err) {
      this.logger.error(`Exception saat WMS cancelOrder ${wmsOrderId}:`, err);
      return false;
    }
  }

  // ─── GET ORDER (untuk cek status) ────────────────────────

  async getOrder(wmsOrderId: string): Promise<WmsOrderResponse | null> {
    if (!this.isConfigured()) return null;

    try {
      const response = await this.fetchWms(
        `/api/v1/pharmacy/orders/${wmsOrderId}`,
        { method: 'GET' },
      );

      if (!response.ok) return null;

      const data = await response.json();
      return this.parseOrderResponse(data);
    } catch (err) {
      this.logger.error(`Exception saat WMS getOrder ${wmsOrderId}:`, err);
      return null;
    }
  }

  // ─── PRIVATE HELPERS ─────────────────────────────────────

  private async fetchWms(path: string, options: RequestInit & { headers?: Record<string, string> }): Promise<Response> {
    return fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        ...(options.headers ?? {}),
      },
    });
  }

  private parseQuoteResponse(data: any): WmsQuoteResponse {
    const payload = data?.data ?? data;
    return {
      canFulfill: payload?.canFulfill ?? false,
      totalObat: Number(payload?.totalObat ?? 0),
      currency: payload?.currency ?? 'IDR',
      items: (payload?.items ?? []).map((i: any) => ({
        obatId: i.obatId,
        kodeObat: i.kodeObat,
        namaObat: i.namaObat,
        qty: i.qty,
        hargaJual: Number(i.hargaJual ?? 0),
        subtotal: Number(i.subtotal ?? 0),
        stokSaatIni: i.stokSaatIni,
        stokCukup: i.stokCukup ?? false,
      })),
    };
  }

  private parseOrderResponse(data: any): WmsOrderResponse {
    const payload = data?.data ?? data;
    return {
      id: payload?.id,
      orderNo: payload?.orderNo,
      status: payload?.status,
      paymentStatus: payload?.paymentStatus,
      totalObat: Number(payload?.totalObat ?? 0),
      currency: payload?.currency ?? 'IDR',
      items: payload?.items ?? [],
    };
  }

  private isConfigured(): boolean {
    return !!(this.baseUrl && this.apiKey);
  }
}

// ─── TYPE DEFINITIONS ─────────────────────────────────────────

export interface WmsItem {
  kodeObat?: string;
  obatId?: string;
  qty: number;
  labelResep?: string;  // nama dari RME, untuk audit mapping
}

export interface WmsQuoteParams {
  items: WmsItem[];
  rekamMedisId?: string;
  patientId?: string;
  patientName?: string;
}

export interface WmsCreateOrderParams {
  items: WmsItem[];
  posTransactionId: string;
  rekamMedisId?: string;
  patientId?: string;
  patientName?: string;
  idempotencyKey?: string;
  notes?: string;
}

export interface WmsQuoteResponse {
  canFulfill: boolean;
  totalObat: number;
  currency: string;
  items: {
    obatId: string;
    kodeObat: string;
    namaObat: string;
    qty: number;
    hargaJual: number;
    subtotal: number;
    stokSaatIni: number;
    stokCukup: boolean;
  }[];
}

export interface WmsOrderResponse {
  id: string;
  orderNo: string;
  status: string;
  paymentStatus: string;
  totalObat: number;
  currency: string;
  items: any[];
}
