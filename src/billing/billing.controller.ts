import { Controller, Post, Get, Body, Param, Query, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { BillingService } from './billing.service';
import { CreateBillingDto } from './dto/create-billing.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('Billing')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  // ─── CREATE ─────────────────────────────────────────────

  @Post()
  @Roles('KASIR', 'MANAGER', 'SUPER_ADMIN')
  @ApiOperation({
    summary: 'Buat transaksi baru + hitung total otomatis',
    description: 'Kasir membuat transaksi billing. Total dihitung dari harga item × qty.',
  })
  create(@Body() dto: CreateBillingDto, @Request() req: any) {
    const userId = req.user.userId;
    return this.billingService.createTransaction(dto, userId);
  }

  // ─── LIST ALL ───────────────────────────────────────────

  @Get()
  @Roles('KASIR', 'MANAGER', 'SUPER_ADMIN', 'FINANCE_STAFF')
  @ApiOperation({
    summary: 'Daftar semua transaksi + filter',
    description:
      'List transaksi dengan filter status, tanggal, pasien, dan metode pembayaran. ' +
      'Mendukung pagination. Default: 20 transaksi terbaru.',
  })
  @ApiQuery({ name: 'status', required: false, enum: ['DRAFT', 'PENDING_PAYMENT', 'LUNAS', 'CANCELLED'] })
  @ApiQuery({ name: 'paymentMethod', required: false, enum: ['CASH', 'QRIS', 'DEBIT', 'TRANSFER', 'BPJS'] })
  @ApiQuery({ name: 'patientId', required: false, description: 'Filter by pasien' })
  @ApiQuery({ name: 'from', required: false, example: '2026-06-01', description: 'Tanggal mulai' })
  @ApiQuery({ name: 'to', required: false, example: '2026-06-30', description: 'Tanggal akhir' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  findAll(
    @Query('status') status?: string,
    @Query('paymentMethod') paymentMethod?: string,
    @Query('patientId') patientId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.billingService.findAll({
      status,
      paymentMethod,
      patientId,
      from,
      to,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  // ─── OUTSTANDING ────────────────────────────────────────

  @Get('outstanding')
  @Roles('KASIR', 'MANAGER', 'SUPER_ADMIN', 'FINANCE_STAFF')
  @ApiOperation({
    summary: 'Daftar invoice belum lunas (outstanding)',
    description:
      'Menampilkan transaksi PENDING_PAYMENT, diurutkan dari yang terlama. ' +
      'Termasuk info berapa hari tagihan belum dibayar.',
  })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  findOutstanding(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.billingService.findOutstanding({
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  // ─── SUMMARY / DASHBOARD ───────────────────────────────

  @Get('summary')
  @Roles('MANAGER', 'SUPER_ADMIN', 'FINANCE_STAFF')
  @ApiOperation({
    summary: 'Ringkasan transaksi & pendapatan (dashboard)',
    description:
      'Total transaksi, total pendapatan, outstanding, dan breakdown per metode pembayaran. ' +
      'Bisa difilter berdasarkan periode tanggal. Default: hari ini.',
  })
  @ApiQuery({ name: 'from', required: false, example: '2026-06-01', description: 'Tanggal mulai' })
  @ApiQuery({ name: 'to', required: false, example: '2026-06-30', description: 'Tanggal akhir' })
  getSummary(
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.billingService.getSummary({ from, to });
  }

  // ─── DETAIL ─────────────────────────────────────────────

  @Get(':id')
  @Roles('KASIR', 'MANAGER', 'SUPER_ADMIN', 'FINANCE_STAFF')
  @ApiOperation({
    summary: 'Detail transaksi by ID',
    description: 'Menampilkan detail transaksi lengkap dengan rincian item.',
  })
  findOne(@Param('id') id: string) {
    return this.billingService.getTransaction(id);
  }
}
