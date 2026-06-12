// src/invoice/invoice.controller.ts

import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { InvoiceService } from './invoice.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('Invoice')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('invoice')
export class InvoiceController {
  constructor(private readonly invoiceService: InvoiceService) {}

  @Get(':transactionId')
  @Roles('KASIR', 'MANAGER', 'SUPER_ADMIN', 'FINANCE_STAFF')
  @ApiOperation({
    summary: 'Ambil data invoice lengkap untuk generate PDF/WhatsApp',
    description:
      'Return data invoice lengkap: detail pasien (termasuk no. HP), ' +
      'item POS + item RME + item WMS (obat), histori split bill, dan billing summary. ' +
      'Digunakan oleh AI service untuk generate invoice PDF dan kirim ke WhatsApp. ' +
      'Field `meta.phoneAvailable` menunjukkan apakah no. HP tersedia untuk kirim WA.',
  })
  getInvoice(@Param('transactionId') transactionId: string) {
    return this.invoiceService.getInvoice(transactionId);
  }
}
