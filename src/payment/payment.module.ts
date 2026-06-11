import { Module } from '@nestjs/common';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { AuthModule } from '../auth/auth.module';
import { AccountingModule } from '../accounting/accounting.module';
import { RmeModule } from '../rme/rme.module';
import { WmsModule } from '../wms/wms.module';

@Module({
  imports: [AuthModule, AccountingModule, RmeModule, WmsModule],
  controllers: [PaymentController],
  providers: [PaymentService],
})
export class PaymentModule {}
