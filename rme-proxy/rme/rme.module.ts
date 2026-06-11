import { Module } from '@nestjs/common';
import { RmeService } from './rme.service';
import { RmeController } from './rme.controller';

@Module({
  controllers: [RmeController],
  providers: [RmeService],
  exports: [RmeService],
})
export class RmeModule {}
