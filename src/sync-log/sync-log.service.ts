// src/sync-log/sync-log.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface CreateSyncLogParams {
  transactionId: string;
  service: 'WMS' | 'RME';
  action: string;
  status: 'SUCCESS' | 'FAILED' | 'PENDING';
  requestBody?: any;
  responseBody?: any;
  errorMessage?: string;
  httpStatus?: number;
  durationMs?: number;
}

@Injectable()
export class SyncLogService {
  private readonly logger = new Logger(SyncLogService.name);

  constructor(private prisma: PrismaService) {}

  // ─── CREATE ──────────────────────────────────────────────

  async create(params: CreateSyncLogParams) {
    try {
      return await this.prisma.db.syncLog.create({
        data: {
          transactionId: params.transactionId,
          service: params.service,
          action: params.action,
          status: params.status,
          requestBody: params.requestBody ?? undefined,
          responseBody: params.responseBody ?? undefined,
          errorMessage: params.errorMessage ?? null,
          httpStatus: params.httpStatus ?? null,
          durationMs: params.durationMs ?? null,
        },
      });
    } catch (err) {
      // Jangan crash aplikasi karena gagal log
      this.logger.error('Gagal create SyncLog:', err);
      return null;
    }
  }

  // ─── GET BY TRANSACTION ──────────────────────────────────

  async getByTransaction(transactionId: string) {
    const logs = await this.prisma.db.syncLog.findMany({
      where: { transactionId },
      orderBy: { createdAt: 'desc' },
    });

    const wmsLogs = logs.filter((l) => l.service === 'WMS');
    const rmeLogs = logs.filter((l) => l.service === 'RME');

    return {
      message: 'Sync logs transaksi',
      data: {
        transactionId,
        summary: {
          wms: {
            total: wmsLogs.length,
            success: wmsLogs.filter((l) => l.status === 'SUCCESS').length,
            failed: wmsLogs.filter((l) => l.status === 'FAILED').length,
          },
          rme: {
            total: rmeLogs.length,
            success: rmeLogs.filter((l) => l.status === 'SUCCESS').length,
            failed: rmeLogs.filter((l) => l.status === 'FAILED').length,
          },
        },
        logs: logs.map((l) => ({
          id: l.id,
          service: l.service,
          action: l.action,
          status: l.status,
          httpStatus: l.httpStatus,
          durationMs: l.durationMs,
          errorMessage: l.errorMessage,
          createdAt: l.createdAt,
        })),
      },
    };
  }

  // ─── GET ALL (dengan filter) ─────────────────────────────

  async findAll(query: {
    service?: string;
    status?: string;
    from?: string;
    to?: string;
    page?: number;
    limit?: number;
  }) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.service) where.service = query.service;
    if (query.status) where.status = query.status;
    if (query.from || query.to) {
      where.createdAt = {};
      if (query.from) where.createdAt.gte = new Date(query.from);
      if (query.to) {
        const d = new Date(query.to);
        d.setHours(23, 59, 59, 999);
        where.createdAt.lte = d;
      }
    }

    const [logs, total] = await Promise.all([
      this.prisma.db.syncLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          transaction: {
            select: {
              id: true,
              status: true,
              total: true,
              patient: { select: { name: true } },
            },
          },
        },
      }),
      this.prisma.db.syncLog.count({ where }),
    ]);

    return {
      data: logs.map((l) => ({
        id: l.id,
        service: l.service,
        action: l.action,
        status: l.status,
        httpStatus: l.httpStatus,
        durationMs: l.durationMs,
        errorMessage: l.errorMessage,
        createdAt: l.createdAt,
        transaction: {
          id: l.transaction.id,
          status: l.transaction.status,
          total: l.transaction.total,
          patientName: l.transaction.patient?.name ?? '-',
        },
      })),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  // ─── SUMMARY ─────────────────────────────────────────────

  async getSummary() {
    const [wmsTotal, wmsSuccess, wmsFailed, rmeTotal, rmeSuccess, rmeFailed] =
      await Promise.all([
        this.prisma.db.syncLog.count({ where: { service: 'WMS' } }),
        this.prisma.db.syncLog.count({ where: { service: 'WMS', status: 'SUCCESS' } }),
        this.prisma.db.syncLog.count({ where: { service: 'WMS', status: 'FAILED' } }),
        this.prisma.db.syncLog.count({ where: { service: 'RME' } }),
        this.prisma.db.syncLog.count({ where: { service: 'RME', status: 'SUCCESS' } }),
        this.prisma.db.syncLog.count({ where: { service: 'RME', status: 'FAILED' } }),
      ]);

    return {
      message: 'Ringkasan status sinkronisasi',
      data: {
        wms: {
          total: wmsTotal,
          success: wmsSuccess,
          failed: wmsFailed,
          successRate: wmsTotal > 0 ? Math.round((wmsSuccess / wmsTotal) * 100) : 0,
        },
        rme: {
          total: rmeTotal,
          success: rmeSuccess,
          failed: rmeFailed,
          successRate: rmeTotal > 0 ? Math.round((rmeSuccess / rmeTotal) * 100) : 0,
        },
      },
    };
  }
}
