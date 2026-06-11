import { Module } from '@nestjs/common';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { AuthModule } from '../auth/auth.module';
import { RmeModule } from '../rme/rme.module';
import { WmsModule } from '../wms/wms.module';

@Module({
  imports: [AuthModule, RmeModule, WmsModule],
  controllers: [BillingController],
  providers: [BillingService],
})
export class BillingModule {}
