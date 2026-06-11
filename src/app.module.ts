// src/app.module.ts
// OVERWRITE file yang sudah ada

import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { BillingModule } from './billing/billing.module';
import { PaymentModule } from './payment/payment.module';
import { ItemsModule } from './items/items.module';
import { AccountingModule } from './accounting/accounting.module';
import { PatientsModule } from './patients/patients.module';
import { RmeModule } from './rme/rme.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    PatientsModule,
    RmeModule,
    BillingModule,
    PaymentModule,
    ItemsModule,
    AccountingModule, // ← baru
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
