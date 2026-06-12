import { Module } from '@nestjs/common';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { AuthModule } from '../auth/auth.module';
import { AccountingModule } from '../accounting/accounting.module';
import { RmeModule } from '../rme/rme.module';
import { WmsModule } from '../wms/wms.module';
import { SyncLogModule } from '../sync-log/sync-log.module';

@Module({
  imports: [AuthModule, AccountingModule, RmeModule, WmsModule, SyncLogModule],
  controllers: [PaymentController],
  providers: [PaymentService],
})
export class PaymentModule {}
