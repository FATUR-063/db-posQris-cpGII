import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateItemDto } from './dto/create-item.dto';

@Injectable()
export class ItemsService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    const items = await this.prisma.db.item.findMany({
      orderBy: { type: 'asc' },
    });
    return {
      message: 'Data items berhasil diambil',
      total: items.length,
      data: items,
    };
  }

  async create(dto: CreateItemDto) {
    const item = await this.prisma.db.item.create({
      data: {
        name: dto.name,
        type: dto.type,
        price: dto.price,
        unit: dto.unit,
      },
    });
    return {
      message: 'Item berhasil ditambahkan',
      data: item,
    };
  }
}