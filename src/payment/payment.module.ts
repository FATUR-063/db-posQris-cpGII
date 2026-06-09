// src/payment/payment.module.ts
// OVERWRITE file yang sudah ada

import { Module } from '@nestjs/common';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { AuthModule } from '../auth/auth.module';
import { AccountingModule } from '../accounting/accounting.module';

@Module({
  imports: [AuthModule, AccountingModule],
  controllers: [PaymentController],
  providers: [PaymentService],
})
export class PaymentModule {}
