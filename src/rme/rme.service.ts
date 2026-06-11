// src/rme/rme.service.ts
//
// Service untuk komunikasi POS → RME API
// Menghandle:
// - Token management (login + auto-refresh, tidak perlu login setiap request)
// - GET billing by rekamMedisId
// - POST update status bayar ke RME setelah transaksi LUNAS

import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';

// Mapping metode pembayaran POS → enum RME
// QRIS → TRANSFER (konfirmasi dari tim RME)
// CASH → TUNAI
// DEBIT → KARTU
// TRANSFER → TRANSFER
// BPJS → BPJS
const PAYMENT_METHOD_MAP: Record<string, string> = {
  QRIS: 'TRANSFER',
  CASH: 'TUNAI',
  DEBIT: 'KARTU',
  TRANSFER: 'TRANSFER',
  BPJS: 'BPJS',
};

@Injectable()
export class RmeService {
  private readonly logger = new Logger(RmeService.name);
  private readonly baseUrl: string;
  private readonly adminIdentifier: string;
  private readonly adminPassword: string;

  // ─── Token cache (in-memory singleton) ──────────────────
  private accessToken: string | null = null;
  private refreshTokenValue: string | null = null;
  private tokenExpiresAt: Date | null = null;

  constructor() {
    this.baseUrl = process.env.RME_BASE_URL ?? '';
    this.adminIdentifier = process.env.RME_ADMIN_IDENTIFIER ?? '';
    this.adminPassword = process.env.RME_ADMIN_PASSWORD ?? '';

    if (!this.baseUrl) {
      this.logger.warn('⚠️  RME_BASE_URL tidak di-set — integrasi RME tidak aktif');
    }
  }

  // ─── PUBLIC METHODS ──────────────────────────────────────

  /**
   * Ambil data billing dari RME berdasarkan rekamMedisId.
   * Return null jika RME tidak tersedia (graceful degradation).
   */
  async getBillingByRekamMedis(rekamMedisId: string): Promise<RmeBilling | null> {
    if (!this.isConfigured()) return null;

    try {
      const token = await this.getValidToken();
      const response = await this.fetchWithAuth(
        `${this.baseUrl}/api/v1/billing/by-rm/${rekamMedisId}`,
        { method: 'GET' },
        token,
      );

      if (!response.ok) {
        this.logger.warn(`RME billing not found for rekamMedisId=${rekamMedisId}: ${response.status}`);
        return null;
      }

      const data = await response.json();
      return this.parseBillingResponse(data);
    } catch (err) {
      this.logger.error(`Gagal fetch billing RME untuk ${rekamMedisId}:`, err);
      return null;
    }
  }

  /**
   * Update status billing di RME menjadi lunas.
   * Dipanggil setelah webhook Midtrans konfirmasi pembayaran.
   * 
   * @param rmeBillingId  - ID billing di sistem RME
   * @param posPaymentMethod - metode bayar dari POS (QRIS/CASH/DEBIT/dll)
   * @param catatan - catatan opsional (ex: "Dibayar via QRIS Midtrans")
   */
  async payBilling(
    rmeBillingId: string,
    posPaymentMethod: string,
    catatan?: string,
  ): Promise<boolean> {
    if (!this.isConfigured()) {
      this.logger.warn('RME tidak dikonfigurasi — skip payBilling');
      return false;
    }

    const metodePembayaran = PAYMENT_METHOD_MAP[posPaymentMethod] ?? 'TUNAI';

    try {
      const token = await this.getValidToken();
      const response = await this.fetchWithAuth(
        `${this.baseUrl}/api/v1/billing/${rmeBillingId}/pay`,
        {
          method: 'POST',
          body: JSON.stringify({
            metodePembayaran,
            catatan: catatan ?? `Dibayar via ${posPaymentMethod} - Smart Clinic POS`,
          }),
        },
        token,
      );

      if (!response.ok) {
        const errorBody = await response.text();
        this.logger.error(
          `Gagal update billing RME ${rmeBillingId}: ${response.status} — ${errorBody}`,
        );
        return false;
      }

      this.logger.log(
        `✅ RME billing ${rmeBillingId} updated → ${metodePembayaran}`,
      );
      return true;
    } catch (err) {
      this.logger.error(`Exception saat payBilling RME ${rmeBillingId}:`, err);
      return false;
    }
  }

  // ─── TOKEN MANAGEMENT ────────────────────────────────────

  /**
   * Mengembalikan access token yang valid.
   * Urutan prioritas: cache valid → refresh → login ulang
   */
  private async getValidToken(): Promise<string> {
    // Token masih valid (dengan buffer 60 detik sebelum expired)
    if (this.accessToken && this.tokenExpiresAt) {
      const bufferMs = 60 * 1000;
      if (new Date().getTime() < this.tokenExpiresAt.getTime() - bufferMs) {
        return this.accessToken;
      }
    }

    // Coba refresh dulu kalau ada refresh token
    if (this.refreshTokenValue) {
      try {
        return await this.doRefreshToken();
      } catch {
        this.logger.warn('Refresh token gagal, login ulang...');
        this.clearTokenCache();
      }
    }

    // Login dari awal
    return await this.doLogin();
  }

  private async doLogin(): Promise<string> {
    this.logger.log('🔐 Login ke RME API...');

    const response = await fetch(`${this.baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: this.adminIdentifier,
        password: this.adminPassword,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new InternalServerErrorException(
        `Login RME gagal: ${response.status} — ${body}`,
      );
    }

    const data = await response.json();
    this.storeTokens(data);

    this.logger.log('✅ Login RME berhasil');
    return this.accessToken!;
  }

  private async doRefreshToken(): Promise<string> {
    const response = await fetch(`${this.baseUrl}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: this.refreshTokenValue }),
    });

    if (!response.ok) throw new Error(`Refresh token failed: ${response.status}`);

    const data = await response.json();
    this.storeTokens(data);

    this.logger.log('🔄 RME token refreshed');
    return this.accessToken!;
  }

  /**
   * Simpan tokens dari response login/refresh.
   * Handle berbagai format response yang mungkin berbeda.
   */
  private storeTokens(data: any): void {
    // Handle berbagai struktur response — sesuaikan kalau format RME berbeda
    this.accessToken =
      data?.access_token ?? data?.accessToken ?? data?.token ?? null;
    this.refreshTokenValue =
      data?.refresh_token ?? data?.refreshToken ?? null;

    // Set expiry — default 1 jam kalau tidak ada info dari response
    const expiresIn = data?.expires_in ?? data?.expiresIn ?? 3600;
    this.tokenExpiresAt = new Date(Date.now() + expiresIn * 1000);

    if (!this.accessToken) {
      throw new InternalServerErrorException(
        'RME login response tidak mengandung access_token',
      );
    }
  }

  private clearTokenCache(): void {
    this.accessToken = null;
    this.refreshTokenValue = null;
    this.tokenExpiresAt = null;
  }

  // ─── HELPER METHODS ──────────────────────────────────────

  private async fetchWithAuth(
    url: string,
    options: RequestInit,
    token: string,
  ): Promise<Response> {
    return fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...(options.headers as Record<string, string> ?? {}),
      },
    });
  }

  private parseBillingResponse(data: any): RmeBilling {
    // Parse response RME — handle berbagai kemungkinan struktur
    // Update ini kalau tim RME memberikan schema lengkap
    const billing = data?.data ?? data;

    return {
      id: billing.id,
      rekamMedisId: billing.rekamMedisId ?? billing.rekam_medis_id,
      status: billing.status,
      total: Number(billing.total ?? billing.totalTagihan ?? 0),
      items: (billing.items ?? billing.detail ?? []).map((item: any) => ({
        namaLayanan: item.namaLayanan ?? item.nama_layanan ?? item.name,
        harga: Number(item.harga ?? item.price ?? 0),
        jumlah: Number(item.jumlah ?? item.qty ?? item.quantity ?? 1),
        isBpjs: item.isBpjs ?? item.is_bpjs ?? false,
      })),
    };
  }

  private isConfigured(): boolean {
    return !!(this.baseUrl && this.adminIdentifier && this.adminPassword);
  }
}

// ─── TYPE DEFINITIONS ────────────────────────────────────────

export interface RmeBillingItem {
  namaLayanan: string;
  harga: number;
  jumlah: number;
  isBpjs: boolean;
}

export interface RmeBilling {
  id: string;
  rekamMedisId: string;
  status: string;
  total: number;
  items: RmeBillingItem[];
}
