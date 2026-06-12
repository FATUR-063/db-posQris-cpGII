# Dokumentasi Modul — Prisma

> **Di-generate otomatis.** Jangan edit manual — perbarui dengan:
>
> ```bash
> npm run docs:modules
> ```

| | |
|---|---|
| **Modul** | `prisma` |
| **Folder sumber** | `src/prisma` |
| **Diperbarui** | 2026-06-12 06:54:15 |
| **Total file** | 3 |
| **Total baris kode** | 59 |

---

## Struktur file

```
src/prisma/
├── prisma.module.ts
├── prisma.service.spec.ts
├── prisma.service.ts
```

---

## Daftar isi

- [src/prisma/prisma.module.ts](#src-prisma-prisma-module-ts) (10 baris)
- [src/prisma/prisma.service.spec.ts](#src-prisma-prisma-service-spec-ts) (19 baris)
- [src/prisma/prisma.service.ts](#src-prisma-prisma-service-ts) (30 baris)

---

## src/prisma/prisma.module.ts

```typescript
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}

```

---

## src/prisma/prisma.service.spec.ts

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from './prisma.service';

describe('PrismaService', () => {
  let service: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PrismaService],
    }).compile();

    service = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

```

---

## src/prisma/prisma.service.ts

```typescript
import 'dotenv/config';
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private client: PrismaClient;

  constructor() {
    const connectionString = process.env.DATABASE_URL!;
    
    const adapter = new PrismaPg({ connectionString });

    this.client = new PrismaClient({ adapter } as any);
  }

  get db(): PrismaClient {
    return this.client;
  }

  async onModuleInit() {
    await this.client.$connect();
  }

  async onModuleDestroy() {
    await this.client.$disconnect();
  }
}

```
