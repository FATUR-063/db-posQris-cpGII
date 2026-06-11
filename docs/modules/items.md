# Dokumentasi Modul — Items

> **Di-generate otomatis.** Jangan edit manual — perbarui dengan:
>
> ```bash
> npm run docs:modules
> ```

| | |
|---|---|
| **Modul** | `items` |
| **Folder sumber** | `src/items` |
| **Diperbarui** | 2026-06-11 09:49:17 |
| **Total file** | 6 |
| **Total baris kode** | 151 |

---

## Struktur file

```
src/items/
├── dto/create-item.dto.ts
├── items.controller.spec.ts
├── items.controller.ts
├── items.module.ts
├── items.service.spec.ts
├── items.service.ts
```

---

## Daftar isi

- [src/items/dto/create-item.dto.ts](#src-items-dto-create-item-dto-ts) (26 baris)
- [src/items/items.controller.spec.ts](#src-items-items-controller-spec-ts) (19 baris)
- [src/items/items.controller.ts](#src-items-items-controller-ts) (37 baris)
- [src/items/items.module.ts](#src-items-items-module-ts) (16 baris)
- [src/items/items.service.spec.ts](#src-items-items-service-spec-ts) (19 baris)
- [src/items/items.service.ts](#src-items-items-service-ts) (34 baris)

---

## src/items/dto/create-item.dto.ts

```typescript
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsEnum, IsOptional } from 'class-validator';

export enum ItemType {
  OBAT = 'OBAT',
  LAYANAN = 'LAYANAN',
}

export class CreateItemDto {
  @ApiProperty({ example: 'Paracetamol 500mg' })
  @IsString()
  name: string;

  @ApiProperty({ enum: ItemType, example: ItemType.OBAT })
  @IsEnum(ItemType)
  type: ItemType;

  @ApiProperty({ example: 5000 })
  @IsNumber()
  price: number;

  @ApiProperty({ example: 'tablet', required: false })
  @IsString()
  @IsOptional()
  unit?: string;
}
```

---

## src/items/items.controller.spec.ts

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { ItemsController } from './items.controller';

describe('ItemsController', () => {
  let controller: ItemsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ItemsController],
    }).compile();

    controller = module.get<ItemsController>(ItemsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

```

---

## src/items/items.controller.ts

```typescript
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

```

---

## src/items/items.module.ts

```typescript
// src/items/items.module.ts
//
// PERUBAHAN: import AuthModule agar ItemsController bisa pakai guard

import { Module } from '@nestjs/common';
import { ItemsController } from './items.controller';
import { ItemsService } from './items.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [ItemsController],
  providers: [ItemsService],
})
export class ItemsModule {}

```

---

## src/items/items.service.spec.ts

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { ItemsService } from './items.service';

describe('ItemsService', () => {
  let service: ItemsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ItemsService],
    }).compile();

    service = module.get<ItemsService>(ItemsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

```

---

## src/items/items.service.ts

```typescript
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
```
