// src/accounting/accounting.module.ts

import { Module } from '@nestjs/common';
import { AccountingController } from './accounting.controller';
import { AccountingService } from './accounting.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [AccountingController],
  providers: [AccountingService],
  exports: [AccountingService], // di-export agar bisa dipakai PaymentModule
})
export class AccountingModule {}
