// src/sync-log/sync-log.controller.ts

import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { SyncLogService } from './sync-log.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('Sync Logs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('sync-logs')
export class SyncLogController {
  constructor(private readonly syncLogService: SyncLogService) {}

  @Get('summary')
  @Roles('SUPER_ADMIN', 'MANAGER')
  @ApiOperation({
    summary: 'Ringkasan status sinkronisasi WMS & RME',
    description: 'Success rate dan jumlah total/sukses/gagal per service.',
  })
  getSummary() {
    return this.syncLogService.getSummary();
  }

  @Get()
  @Roles('SUPER_ADMIN', 'MANAGER')
  @ApiOperation({
    summary: 'List semua sync log + filter',
    description: 'Monitor semua attempt sinkronisasi ke WMS dan RME.',
  })
  @ApiQuery({ name: 'service', required: false, enum: ['WMS', 'RME'] })
  @ApiQuery({ name: 'status', required: false, enum: ['SUCCESS', 'FAILED', 'PENDING'] })
  @ApiQuery({ name: 'from', required: false, example: '2026-06-01' })
  @ApiQuery({ name: 'to', required: false, example: '2026-06-30' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  findAll(
    @Query('service') service?: string,
    @Query('status') status?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.syncLogService.findAll({
      service, status, from, to,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get('transaction/:transactionId')
  @Roles('SUPER_ADMIN', 'MANAGER', 'KASIR', 'FINANCE_STAFF')
  @ApiOperation({
    summary: 'Sync log per transaksi',
    description:
      'Lihat status sinkronisasi WMS dan RME untuk satu transaksi. ' +
      'Include summary (berhasil/gagal) dan detail semua attempt.',
  })
  getByTransaction(@Param('transactionId') transactionId: string) {
    return this.syncLogService.getByTransaction(transactionId);
  }
}
