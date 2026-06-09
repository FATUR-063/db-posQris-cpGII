# Panduan Instalasi JWT Guard
# Ikuti urutan ini persis — jangan loncat

## Step 1: Install dependency yang belum ada

npm install @nestjs/passport passport passport-jwt
npm install -D @types/passport-jwt

## Step 2: Buat folder baru

Buat folder ini di dalam src/auth/:
  src/auth/guards/
  src/auth/decorators/

## Step 3: Salin file baru (file yang belum ada sama sekali)

jwt.strategy.ts        → src/auth/jwt.strategy.ts
jwt-auth.guard.ts      → src/auth/guards/jwt-auth.guard.ts
roles.guard.ts         → src/auth/guards/roles.guard.ts
roles.decorator.ts     → src/auth/decorators/roles.decorator.ts

## Step 4: Ganti file yang sudah ada (OVERWRITE)

auth.module.ts         → src/auth/auth.module.ts
billing.controller.ts  → src/billing/billing.controller.ts
billing.module.ts      → src/billing/billing.module.ts
items.controller.ts    → src/items/items.controller.ts
items.module.ts        → src/items/items.module.ts
payment.controller.ts  → src/payment/payment.controller.ts
payment.module.ts      → src/payment/payment.module.ts

## Step 5: Verifikasi — jalankan server

npm run start:dev

Tidak boleh ada error. Kalau ada error "Cannot find module 'passport-jwt'",
berarti Step 1 belum dijalankan.

## Step 6: Test di Swagger (http://localhost:3000/api/docs)

1. POST /api/auth/login → copy access_token
2. Klik tombol "Authorize" di Swagger → paste token
3. Coba GET /api/items → harus 200 OK
4. Coba GET /api/items TANPA token (klik Authorize → logout) → harus 401

## Struktur folder src/auth/ setelah selesai:

src/auth/
├── decorators/
│   └── roles.decorator.ts    ← BARU
├── guards/
│   ├── jwt-auth.guard.ts     ← BARU
│   └── roles.guard.ts        ← BARU
├── dto/
│   ├── login.dto.ts          ← tidak berubah
│   └── register.dto.ts       ← tidak berubah
├── auth.controller.ts        ← tidak berubah
├── auth.module.ts            ← UPDATED
├── auth.service.ts           ← tidak berubah (kecuali bcrypt 10→12)
└── jwt.strategy.ts           ← BARU
