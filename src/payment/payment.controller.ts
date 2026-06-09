// src/payment/payment.controller.ts
//
// PERUBAHAN dari versi sebelumnya:
// + @UseGuards(JwtAuthGuard, RolesGuard) pada tokenizer dan status
// + Webhook TETAP PUBLIC — Midtrans server yang memanggil, tidak punya JWT kita
// + Pisahkan guard per method karena webhook tidak boleh diproteksi

import { Controller, Post, Get, Body, Param, UseGuards, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PaymentService } from './payment.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('Payment')
@Controller('payment')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post('tokenizer')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('KASIR', 'MANAGER', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Generate Snap Token Midtrans untuk transaksi' })
  createSnapToken(@Body() dto: CreatePaymentDto) {
    return this.paymentService.createSnapToken(dto.transactionId);
  }

  // ⚠️ TIDAK ADA @UseGuards di sini — webhook dipanggil oleh Midtrans server
  // Midtrans tidak punya JWT kita, jadi endpoint ini harus tetap public
  @Post('webhook')
  @ApiOperation({ summary: 'Webhook dari Midtrans — PUBLIC, jangan tambah JWT guard' })
  handleWebhook(@Req() req: Request) { 
    
    // 2. Beri penegasan tipe 'any' agar TypeScript tidak protes di baris log
    const notification: any = req.body;

    // Agent log dibiarkan utuh
    fetch('http://127.0.0.1:7326/ingest/975ac0f8-a319-4e73-8855-f0049df4b786',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'999c66'},body:JSON.stringify({sessionId:'999c66',location:'payment.controller.ts:handleWebhook',message:'webhook request received',data:{contentType:req.headers['content-type'],bodyType:typeof req.body,bodyKeys:req.body&&typeof req.body==='object'?Object.keys(req.body):null,notificationType:typeof notification,notificationIsUndefined:notification===undefined,notificationKeys:notification&&typeof notification==='object'?Object.keys(notification):null,hasOrderId:!!notification?.order_id},timestamp:Date.now(),hypothesisId:'A,C'})}).catch(()=>{});

    return this.paymentService.handleWebhook(notification);
  }

  @Get('status/:transactionId')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('KASIR', 'MANAGER', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Cek status transaksi' })
  getStatus(@Param('transactionId') transactionId: string) {
    return this.paymentService.getTransactionStatus(transactionId);
  }
}
