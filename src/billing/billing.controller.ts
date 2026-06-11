import {
  Controller, Post, Get, Delete, Body, Param, Query, Request, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { BillingService } from './billing.service';
import { CreateBillingDto } from './dto/create-billing.dto';
import { AddPaymentDto } from './dto/add-payment.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('Billing')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  // ─── CREATE TRANSACTION ──────────────────────────────────

  @Post()
  @Roles('KASIR', 'MANAGER', 'SUPER_ADMIN')
  @ApiOperation({
    summary: 'Buat transaksi baru',
    description:
      'Buat billing POS. Jika `rekamMedisId` diisi, sistem otomatis fetch ' +
      'billing dari RME — dapat `bpjsAmount`, `nonBpjsAmount`, dan `rmeBillingId`. ' +
      'Response berisi `remainingAmount` untuk panduan split bill.',
  })
  create(@Body() dto: CreateBillingDto, @Request() req: any) {
    return this.billingService.createTransaction(dto, req.user.userId);
  }

  // ─── ADD PAYMENT (SPLIT BILL) ────────────────────────────

  @Post(':id/pay')
  @Roles('KASIR', 'MANAGER', 'SUPER_ADMIN')
  @ApiOperation({
    summary: 'Tambah pembayaran ke transaksi (split bill)',
    description:
      'Tambahkan satu metode pembayaran ke transaksi yang sudah ada. ' +
      'Bisa dipanggil beberapa kali untuk split bill (BPJS + QRIS, Cash + QRIS, dll). ' +
      'CASH/DEBIT/TRANSFER/BPJS langsung PAID. ' +
      'QRIS akan return snapToken — tunggu webhook Midtrans untuk konfirmasi. ' +
      'Status otomatis jadi LUNAS saat paidAmount >= total.',
  })
  addPayment(
    @Param('id') id: string,
    @Body() dto: AddPaymentDto,
    @Request() req: any,
  ) {
    return this.billingService.addPayment(id, dto, req.user.userId);
  }

  // ─── GET PAYMENTS (histori split bill) ──────────────────

  @Get(':id/payments')
  @Roles('KASIR', 'MANAGER', 'SUPER_ADMIN', 'FINANCE_STAFF')
  @ApiOperation({
    summary: 'Histori pembayaran per transaksi',
    description:
      'Lihat semua pembayaran yang sudah dilakukan untuk satu transaksi. ' +
      'Include: paidAmount, remainingAmount, breakdown per metode, status masing-masing payment.',
  })
  getPayments(@Param('id') id: string) {
    return this.billingService.getPayments(id);
  }

  // ─── CANCEL PENDING QRIS ────────────────────────────────

  @Delete(':id/payments/:paymentId/cancel-qris')
  @Roles('KASIR', 'MANAGER', 'SUPER_ADMIN')
  @ApiOperation({
    summary: 'Batalkan QRIS yang masih pending',
    description:
      'Batalkan payment QRIS yang belum dibayar agar kasir bisa generate QRIS baru ' +
      'atau beralih ke metode lain.',
  })
  cancelPendingQris(
    @Param('id') id: string,
    @Param('paymentId') paymentId: string,
  ) {
    return this.billingService.cancelPendingQris(id, paymentId);
  }

  // ─── GET BILLING FROM RME ────────────────────────────────

  @Get('from-rme/:rekamMedisId')
  @Roles('KASIR', 'MANAGER', 'SUPER_ADMIN')
  @ApiOperation({
    summary: 'Preview billing dari RME by rekamMedisId',
    description:
      'Ambil data billing RME sebelum transaksi dibuat. ' +
      'Return: rmeBillingId, totalTagihan, bpjsTotal, nonBpjsTotal, items. ' +
      'bpjsTotal = nominal yang ditanggung BPJS, nonBpjsTotal = yang harus dibayar pasien.',
  })
  getBillingFromRme(@Param('rekamMedisId') rekamMedisId: string) {
    return this.billingService.getBillingFromRme(rekamMedisId);
  }

  // ─── LIST ALL ────────────────────────────────────────────

  @Get()
  @Roles('KASIR', 'MANAGER', 'SUPER_ADMIN', 'FINANCE_STAFF')
  @ApiOperation({ summary: 'Daftar semua transaksi + filter' })
  @ApiQuery({ name: 'status', required: false, enum: ['DRAFT', 'PENDING_PAYMENT', 'PARTIAL', 'LUNAS', 'CANCELLED'] })
  @ApiQuery({ name: 'paymentMethod', required: false, enum: ['CASH', 'QRIS', 'DEBIT', 'TRANSFER', 'BPJS'] })
  @ApiQuery({ name: 'patientId', required: false })
  @ApiQuery({ name: 'from', required: false, example: '2026-06-01' })
  @ApiQuery({ name: 'to', required: false, example: '2026-06-30' })
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
      status, paymentMethod, patientId, from, to,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  // ─── OUTSTANDING ─────────────────────────────────────────

  @Get('outstanding')
  @Roles('KASIR', 'MANAGER', 'SUPER_ADMIN', 'FINANCE_STAFF')
  @ApiOperation({
    summary: 'Daftar invoice belum lunas (PENDING_PAYMENT + PARTIAL)',
    description: 'Menampilkan transaksi yang belum lunas, termasuk yang sudah bayar sebagian (PARTIAL).',
  })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  findOutstanding(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.billingService.findOutstanding({
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  // ─── SUMMARY ─────────────────────────────────────────────

  @Get('summary')
  @Roles('MANAGER', 'SUPER_ADMIN', 'FINANCE_STAFF')
  @ApiOperation({ summary: 'Ringkasan transaksi & pendapatan (dashboard)' })
  @ApiQuery({ name: 'from', required: false, example: '2026-06-01' })
  @ApiQuery({ name: 'to', required: false, example: '2026-06-30' })
  getSummary(@Query('from') from?: string, @Query('to') to?: string) {
    return this.billingService.getSummary({ from, to });
  }

  // ─── DETAIL ──────────────────────────────────────────────

  @Get(':id')
  @Roles('KASIR', 'MANAGER', 'SUPER_ADMIN', 'FINANCE_STAFF')
  @ApiOperation({
    summary: 'Detail transaksi by ID',
    description: 'Include: items, payments history, paidAmount, remainingAmount.',
  })
  findOne(@Param('id') id: string) {
    return this.billingService.getTransaction(id);
  }
}
