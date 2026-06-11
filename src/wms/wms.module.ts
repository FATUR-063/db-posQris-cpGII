import { Module } from '@nestjs/common';
import { WmsService } from './wms.service';

@Module({
  providers: [WmsService],
  exports: [WmsService],
})
export class WmsModule {}
