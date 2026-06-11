import { Module } from '@nestjs/common';
import { RmeService } from './rme.service';

@Module({
  providers: [RmeService],
  exports: [RmeService],  // export agar bisa dipakai PaymentModule & BillingModule
})
export class RmeModule {}
