# Panduan Install — Accounting Module

## Step 1: Buat folder baru
src/accounting/
src/accounting/dto/

## Step 2: File BARU — copy ke lokasi berikut
accounting.dto.ts       → src/accounting/dto/accounting.dto.ts
accounting.service.ts   → src/accounting/accounting.service.ts
accounting.controller.ts → src/accounting/accounting.controller.ts
accounting.module.ts    → src/accounting/accounting.module.ts

## Step 3: File OVERWRITE — ganti yang sudah ada
payment.service.ts      → src/payment/payment.service.ts
payment.module.ts       → src/payment/payment.module.ts
app.module.ts           → src/app.module.ts

## Step 4: Tambah field paidAt ke Transaction di schema.prisma
Buka prisma/schema.prisma, cari model Transaction, tambah:
  paidAt DateTime?

Lalu jalankan:
  npx prisma migrate dev --name add-paidat-transaction
  npx prisma generate

## Step 5: Jalankan server
npm run start:dev

## Step 6: Verifikasi di Swagger
Harus muncul section "Accounting" dengan endpoint:
- GET  /api/accounting/coa
- GET  /api/accounting/coa/expense-accounts
- GET  /api/accounting/journal
- GET  /api/accounting/journal/:id
- GET  /api/accounting/expenses
- POST /api/accounting/expenses
- GET  /api/accounting/reports/cashflow
- GET  /api/accounting/reports/profit-loss
- GET  /api/accounting/reports/general-ledger
