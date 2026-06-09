// src/billing/billing.module.ts
//
// PERUBAHAN: import AuthModule agar BillingController bisa pakai
// JwtAuthGuard dan RolesGuard yang di-export dari AuthModule

import { Module } from '@nestjs/common';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule], // wajib agar guard dari AuthModule tersedia
  controllers: [BillingController],
  providers: [BillingService],
})
export class BillingModule {}
