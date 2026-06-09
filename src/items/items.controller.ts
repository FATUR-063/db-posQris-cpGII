// src/items/items.controller.ts
//
// PERUBAHAN dari versi sebelumnya:
// + @UseGuards(JwtAuthGuard, RolesGuard)
// + GET /items → semua role boleh (KASIR butuh lihat item saat billing)
// + POST /items → hanya SUPER_ADMIN dan MANAGER yang boleh tambah item

import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ItemsService } from './items.service';
import { CreateItemDto } from './dto/create-item.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('Items')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('items')
export class ItemsController {
  constructor(private readonly itemsService: ItemsService) {}

  @Get()
  @Roles('KASIR', 'MANAGER', 'SUPER_ADMIN', 'FINANCE_STAFF')
  @ApiOperation({ summary: 'Ambil semua daftar obat & layanan' })
  findAll() {
    return this.itemsService.findAll();
  }

  @Post()
  @Roles('SUPER_ADMIN', 'MANAGER') // kasir tidak boleh tambah/ubah master item
  @ApiOperation({ summary: 'Tambah obat atau layanan baru' })
  create(@Body() dto: CreateItemDto) {
    return this.itemsService.create(dto);
  }
}
