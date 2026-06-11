// src/rme/rme.service.ts

import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';

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

  // ─── QUEUE PROXY ────────────────────────────────────────────────

  /**
   * Ambil antrian pasien hari ini dari RME.
   * Default status: MENUNGGU. Untuk kasir, pakai status=SELESAI.
   * 
   * @param tanggal  format YYYY-MM-DD, default hari ini
   * @param status   MENUNGGU | HADIR | DIPANGGIL | DIPERIKSA | SELESAI
   */
  async getTodayQueue(tanggal?: string, status?: string): Promise<RmeQueueResponse | null> {
    if (!this.isConfigured()) return null;

    const today = tanggal ?? new Date().toISOString().split('T')[0];
    const queueStatus = status ?? 'MENUNGGU';

    try {
      const token = await this.getValidToken();
      const url = `${this.baseUrl}/api/v1/queues?tanggal=${today}&status=${queueStatus}`;
      const response = await this.fetchWithAuth(url, { method: 'GET' }, token);

      if (!response.ok) {
        this.logger.warn(`RME queue fetch gagal: ${response.status}`);
        return null;
      }

      const data = await response.json();
      return this.parseQueueResponse(data, today, queueStatus);
    } catch (err) {
      this.logger.error('Gagal fetch antrian RME:', err);
      return null;
    }
  }

  /**
   * Ambil riwayat billing pasien dari RME by noRm.
   * Dipakai untuk halaman histori transaksi dan detail billing kasir.
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
   * Ambil semua riwayat billing pasien (bisa lebih dari satu kunjungan).
   * Beberapa RME return array, beberapa return single object.
   */
  async getBillingHistoryByRekamMedis(rekamMedisId: string): Promise<RmeBilling[]> {
    if (!this.isConfigured()) return [];

    try {
      const token = await this.getValidToken();
      const response = await this.fetchWithAuth(
        `${this.baseUrl}/api/v1/billing/by-rm/${rekamMedisId}`,
        { method: 'GET' },
        token,
      );

      if (!response.ok) return [];

      const data = await response.json();
      const payload = data?.data ?? data;

      // Handle kalau response adalah array atau single object
      if (Array.isArray(payload)) {
        return payload.map((item: any) => this.parseBillingResponse({ data: item })).filter(Boolean) as RmeBilling[];
      }

      const single = this.parseBillingResponse(data);
      return single ? [single] : [];
    } catch (err) {
      this.logger.error(`Gagal fetch billing history RME untuk ${rekamMedisId}:`, err);
      return [];
    }
  }

  // ─── PAY BILLING ────────────────────────────────────────────────

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
        this.logger.error(`Gagal update billing RME ${rmeBillingId}: ${response.status} — ${errorBody}`);
        return false;
      }

      this.logger.log(`✅ RME billing ${rmeBillingId} updated → ${metodePembayaran}`);
      return true;
    } catch (err) {
      this.logger.error(`Exception saat payBilling RME ${rmeBillingId}:`, err);
      return false;
    }
  }

  // ─── TOKEN MANAGEMENT ────────────────────────────────────────────

  private async getValidToken(): Promise<string> {
    if (this.accessToken && this.tokenExpiresAt) {
      const bufferMs = 60 * 1000;
      if (new Date().getTime() < this.tokenExpiresAt.getTime() - bufferMs) {
        return this.accessToken;
      }
    }

    if (this.refreshTokenValue) {
      try {
        return await this.doRefreshToken();
      } catch {
        this.logger.warn('Refresh token gagal, login ulang...');
        this.clearTokenCache();
      }
    }

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
      throw new InternalServerErrorException(`Login RME gagal: ${response.status} — ${body}`);
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

  private storeTokens(data: any): void {
    const tokenData = data?.data ?? data;

    this.accessToken =
      tokenData?.accessToken ?? tokenData?.access_token ?? tokenData?.token ?? null;
    this.refreshTokenValue =
      tokenData?.refreshToken ?? tokenData?.refresh_token ?? null;

    const expiresIn = tokenData?.expires_in ?? tokenData?.expiresIn ?? 3600;
    this.tokenExpiresAt = new Date(Date.now() + expiresIn * 1000);

    if (!this.accessToken) {
      throw new InternalServerErrorException('RME login response tidak mengandung access_token');
    }
  }

  private clearTokenCache(): void {
    this.accessToken = null;
    this.refreshTokenValue = null;
    this.tokenExpiresAt = null;
  }

  // ─── HELPERS ────────────────────────────────────────────────────

  private async fetchWithAuth(url: string, options: RequestInit, token: string): Promise<Response> {
    return fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...(options.headers as Record<string, string> ?? {}),
      },
    });
  }

  private parseQueueResponse(data: any, tanggal: string, status: string): RmeQueueResponse {
    const payload = data?.data ?? data;
    const items = payload?.data ?? [];

    return {
      tanggal: payload?.tanggal ?? tanggal,
      status,
      total: payload?.total ?? items.length,
      menunggu: payload?.menunggu ?? 0,
      hadir: payload?.hadir ?? 0,
      data: items.map((q: any) => ({
        id: q.id,
        pasienId: q.pasienId,
        noAntrian: q.noAntrian,
        status: q.status,
        tanggalKunjungan: q.tanggalKunjungan,
        jenisKunjunganBpjs: q.jenisKunjunganBpjs,
        catatan: q.catatan,
        pasien: q.pasien
          ? {
              namaLengkap: q.pasien.namaLengkap,
              noRm: q.pasien.noRm,
              noBpjs: q.pasien.noBpjs ?? null,
              tanggalLahir: q.pasien.tanggalLahir ?? null,
            }
          : null,
        jadwal: q.jadwal
          ? {
              dokter: {
                namaLengkap: q.jadwal.dokter?.namaLengkap ?? null,
                spesialis: q.jadwal.dokter?.spesialis ?? null,
              },
              jamMulai: q.jadwal.jamMulai ?? null,
              jamSelesai: q.jadwal.jamSelesai ?? null,
              sesi: q.jadwal.sesi ?? null,
            }
          : null,
      })),
    };
  }

  private parseBillingResponse(data: any): RmeBilling | null {
    const billing = data?.data ?? data;
    if (!billing?.id) return null;

    return {
      id: billing.id,
      rekamMedisId: billing.rekamMedisId ?? billing.rekam_medis_id ?? billing.noRm,
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

// ─── TYPE DEFINITIONS ────────────────────────────────────────────

export interface RmeQueueItem {
  id: string;
  pasienId: string;
  noAntrian: string;
  status: string;
  tanggalKunjungan: string;
  jenisKunjunganBpjs: string;
  catatan: string | null;
  pasien: {
    namaLengkap: string;
    noRm: string;
    noBpjs: string | null;
    tanggalLahir: string | null;
  } | null;
  jadwal: {
    dokter: { namaLengkap: string | null; spesialis: string | null };
    jamMulai: string | null;
    jamSelesai: string | null;
    sesi: string | null;
  } | null;
}

export interface RmeQueueResponse {
  tanggal: string;
  status: string;
  total: number;
  menunggu: number;
  hadir: number;
  data: RmeQueueItem[];
}

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
