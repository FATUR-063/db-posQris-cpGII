// src/rme/rme.controller.ts

import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { RmeService } from './rme.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('RME Integration')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('rme')
export class RmeController {
  constructor(private readonly rmeService: RmeService) {}

  // ─── ANTRIAN HARI INI ────────────────────────────────────

  @Get('queue/today')
  @Roles('KASIR', 'MANAGER', 'SUPER_ADMIN')
  @ApiOperation({
    summary: 'Antrian pasien hari ini dari RME',
    description:
      'Proxy ke RME GET /api/v1/queues. ' +
      'Gunakan `status=SELESAI` untuk tampilkan pasien yang siap ditagih di kasir. ' +
      'Gunakan `status=MENUNGGU` untuk monitor antrian aktif. ' +
      'Response include: noRm pasien — dipakai untuk hit GET /rme/billing/:noRm.',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['MENUNGGU', 'HADIR', 'DIPANGGIL', 'DIPERIKSA', 'SELESAI'],
    example: 'SELESAI',
    description: 'Filter status antrian. Default: MENUNGGU',
  })
  @ApiQuery({
    name: 'tanggal',
    required: false,
    example: '2026-06-11',
    description: 'Tanggal antrian (YYYY-MM-DD). Default: hari ini',
  })
  async getTodayQueue(
    @Query('status') status?: string,
    @Query('tanggal') tanggal?: string,
  ) {
    const result = await this.rmeService.getTodayQueue(tanggal, status);

    if (!result) {
      return {
        message: 'Data antrian RME tidak tersedia',
        rmeAvailable: false,
        data: null,
      };
    }

    return {
      message: `Antrian ${result.status} — ${result.tanggal}`,
      rmeAvailable: true,
      data: result,
    };
  }

  // ─── BILLING BY NORM ────────────────────────────────────

  @Get('billing/:noRm')
  @Roles('KASIR', 'MANAGER', 'SUPER_ADMIN', 'FINANCE_STAFF')
  @ApiOperation({
    summary: 'Detail billing aktif pasien dari RME by noRm',
    description:
      'Proxy ke RME GET /api/v1/billing/by-rm/{noRm}. ' +
      'Return billing aktif pasien + items + breakdown BPJS vs non-BPJS. ' +
      'noRm didapat dari response GET /rme/queue/today (field pasien.noRm).',
  })
  async getBillingByNoRm(@Param('noRm') noRm: string) {
    const billing = await this.rmeService.getBillingByRekamMedis(noRm);

    if (!billing) {
      return {
        message: 'Billing RME tidak ditemukan untuk pasien ini',
        rmeAvailable: true,
        data: null,
      };
    }

    // Hitung breakdown BPJS vs non-BPJS
    const bpjsTotal = billing.items
      .filter((i) => i.isBpjs)
      .reduce((sum, i) => sum + i.harga * i.jumlah, 0);

    const nonBpjsTotal = billing.items
      .filter((i) => !i.isBpjs)
      .reduce((sum, i) => sum + i.harga * i.jumlah, 0);

    return {
      message: 'Data billing RME berhasil diambil',
      rmeAvailable: true,
      data: {
        rmeBillingId: billing.id,
        noRm,
        status: billing.status,
        totalTagihan: billing.total,
        bpjsTotal,
        nonBpjsTotal,
        tagihanPasien: nonBpjsTotal,
        items: billing.items,
      },
    };
  }

  // ─── BILLING HISTORY BY NORM ─────────────────────────────

  @Get('billing/:noRm/history')
  @Roles('KASIR', 'MANAGER', 'SUPER_ADMIN', 'FINANCE_STAFF')
  @ApiOperation({
    summary: 'Riwayat semua billing pasien dari RME',
    description:
      'Proxy ke RME untuk ambil semua riwayat billing pasien. ' +
      'Dipakai di halaman histori transaksi FE POS.',
  })
  async getBillingHistoryByNoRm(@Param('noRm') noRm: string) {
    const billings = await this.rmeService.getBillingHistoryByRekamMedis(noRm);

    return {
      message: billings.length > 0
        ? `${billings.length} riwayat billing ditemukan`
        : 'Belum ada riwayat billing',
      rmeAvailable: true,
      data: billings.map((b) => {
        const bpjsTotal = b.items
          .filter((i) => i.isBpjs)
          .reduce((sum, i) => sum + i.harga * i.jumlah, 0);
        const nonBpjsTotal = b.items
          .filter((i) => !i.isBpjs)
          .reduce((sum, i) => sum + i.harga * i.jumlah, 0);

        return {
          rmeBillingId: b.id,
          status: b.status,
          totalTagihan: b.total,
          bpjsTotal,
          nonBpjsTotal,
          items: b.items,
        };
      }),
    };
  }
}
