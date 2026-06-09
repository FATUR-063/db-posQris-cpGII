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
