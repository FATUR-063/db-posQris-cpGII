# Dokumentasi Modul — App (root)

> **Di-generate otomatis.** Jangan edit manual — perbarui dengan:
>
> ```bash
> npm run docs:modules
> ```

| | |
|---|---|
| **Modul** | `app` |
| **Folder sumber** | `src` |
| **Diperbarui** | 2026-06-12 06:54:15 |
| **Total file** | 5 |
| **Total baris kode** | 139 |

---

## Struktur file

```
src/
├── app.controller.spec.ts
├── app.controller.ts
├── app.module.ts
├── app.service.ts
├── main.ts
```

---

## Daftar isi

- [src/app.controller.spec.ts](#src-app-controller-spec-ts) (23 baris)
- [src/app.controller.ts](#src-app-controller-ts) (13 baris)
- [src/app.module.ts](#src-app-module-ts) (37 baris)
- [src/app.service.ts](#src-app-service-ts) (9 baris)
- [src/main.ts](#src-main-ts) (57 baris)

---

## src/app.controller.spec.ts

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(appController.getHello()).toBe('Hello World!');
    });
  });
});

```

---

## src/app.controller.ts

```typescript
import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
}

```

---

## src/app.module.ts

```typescript
// src/app.module.ts
// OVERWRITE file yang sudah ada

import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { BillingModule } from './billing/billing.module';
import { PaymentModule } from './payment/payment.module';
import { ItemsModule } from './items/items.module';
import { AccountingModule } from './accounting/accounting.module';
import { PatientsModule } from './patients/patients.module';
import { RmeModule } from './rme/rme.module';
import { WmsModule } from './wms/wms.module';
import { InvoiceModule } from './invoice/invoice.module';
import { SyncLogModule } from './sync-log/sync-log.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    PatientsModule,
    RmeModule,
    WmsModule,
    BillingModule,
    PaymentModule,
    InvoiceModule,
    ItemsModule,
    SyncLogModule,
    AccountingModule, // ← baru
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

```

---

## src/app.service.ts

```typescript
import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return 'Hello World!';
  }
}

```

---

## src/main.ts

```typescript
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Serve static files (payment test page)
  app.useStaticAssets(join(process.cwd(), 'public'));

  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));

  // CORS
  app.enableCors();

  // ─── SWAGGER CONFIG ─────────────────────────────────────
  const config = new DocumentBuilder()
    .setTitle('Smart Clinic POS & Payment QRIS API')
    .setDescription(
      '**REST API untuk Sistem POS & Pembayaran Klinik.**\n\n' +
      'Mendukung billing terintegrasi, pembayaran multi-metode (QRIS, Cash, Debit, Transfer, BPJS), ' +
      'outstanding invoice, dashboard transaksi & pendapatan, serta integrasi RME dan WMS.\n\n' +
      '**Autentikasi:** Bearer JWT Token — login via `POST /api/auth/login`.\n\n' +
      '**RBAC Roles:** `SUPER_ADMIN` · `MANAGER` · `KASIR` · `FINANCE_STAFF`\n\n' +
      '**Akun demo (password: `password123`):**\n' +
      '- `admin@klinik.com` → SUPER_ADMIN\n' +
      '- `manager@klinik.com` → MANAGER\n' +
      '- `kasir@klinik.com` → KASIR\n' +
      '- `finance@klinik.com` → FINANCE_STAFF\n\n' +
      '---\n' +
      '*Smart Clinic POS — PT. GII | Capstone Project 2026*'
    )
    .setVersion('1.0')
    .setContact('Smart Clinic Dev Team', '', 'dev@smartclinic.id')
    .addBearerAuth()
    .addTag('Auth', 'Registrasi, login, dan manajemen user')
    .addTag('Patients', 'CRUD data pasien klinik')
    .addTag('Items', 'Daftar obat & layanan klinik')
    .addTag('Billing', 'Transaksi, outstanding invoice, dan dashboard pendapatan')
    .addTag('Payment', 'Integrasi Midtrans QRIS — generate token, webhook, cek status')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(process.env.PORT ?? 3000);

  console.log(`\n🚀 Server running on http://localhost:${process.env.PORT ?? 3000}`);
  console.log(`📚 Swagger docs: http://localhost:${process.env.PORT ?? 3000}/api/docs`);
  console.log(`💳 Payment test: http://localhost:${process.env.PORT ?? 3000}/payment-test.html\n`);
}
bootstrap();

```
