import { Module } from '@nestjs/common';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { AuthModule } from '../auth/auth.module';
import { RmeModule } from '../rme/rme.module';

@Module({
  imports: [AuthModule, RmeModule],
  controllers: [BillingController],
  providers: [BillingService],
})
export class BillingModule {}
