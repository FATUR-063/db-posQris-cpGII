import { Module } from '@nestjs/common';
import { InvoiceController } from './invoice.controller';
import { InvoiceService } from './invoice.service';
import { RmeModule } from '../rme/rme.module';
import { WmsModule } from '../wms/wms.module';

@Module({
  imports: [RmeModule, WmsModule],
  controllers: [InvoiceController],
  providers: [InvoiceService],
  exports: [InvoiceService],
})
export class InvoiceModule {}
