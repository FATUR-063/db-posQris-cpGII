# Dokumentasi Teknis — Smart Clinic POS

Dokumen ini menjelaskan arsitektur, database, konfigurasi, API, alur pembayaran, dan batasan implementasi proyek **Smart Clinic POS** berdasarkan kode yang ada di repository.

**Versi API (Swagger):** 1.0  
**Base URL:** `http://localhost:{PORT}/api` (default port `3000`)

---

## Daftar isi

1. [Gambaran umum](#1-gambaran-umum)
2. [Arsitektur](#2-arsitektur)
3. [Stack teknologi](#3-stack-teknologi)
4. [Skema database](#4-skema-database)
5. [Konfigurasi lingkungan](#5-konfigurasi-lingkungan)
6. [Setup & menjalankan aplikasi](#6-setup--menjalankan-aplikasi)
7. [Struktur kode](#7-struktur-kode)
8. [Referensi API](#8-referensi-api)
9. [Alur bisnis](#9-alur-bisnis)
10. [Integrasi Midtrans](#10-integrasi-midtrans)
11. [Halaman uji pembayaran](#11-halaman-uji-pembayaran)
12. [Keamanan & batasan](#12-keamanan--batasan)
13. [Testing](#13-testing)
14. [Troubleshooting](#14-troubleshooting)
15. [Rencana pengembangan](#15-rencana-pengembangan)

---

## 1. Gambaran umum

**Smart Clinic POS** adalah REST API backend untuk operasional kasir di klinik:

- Mengelola **katalog** obat (`OBAT`) dan layanan (`LAYANAN`)
- Membuat **transaksi** penjualan terkait pasien
- Memproses **pembayaran digital** melalui Midtrans Snap (sandbox/production)
- Menyediakan **autentikasi** kasir dengan JWT

Aplikasi ini **bukan** frontend lengkap — hanya API + satu halaman HTML statis untuk uji pembayaran.

### Peran pengguna (enum `Role`)

| Role | Deskripsi (rencana) |
|------|---------------------|
| `KASIR` | Default saat register — operator kasir |
| `MANAGER` | Manajemen (belum dipakai di logic) |
| `SUPER_ADMIN` | Administrasi penuh (belum dipakai di logic) |

Saat ini role disimpan di database dan dimasukkan ke payload JWT, tetapi **belum ada pembatasan akses per role**.

---

## 2. Arsitektur

```
┌─────────────────┐     HTTP/JSON      ┌──────────────────────────────┐
│  Client / HTML  │ ◄────────────────► │  NestJS (Express)            │
│  payment-test   │                    │  Prefix: /api                │
└─────────────────┘                    │  ValidationPipe (global)     │
                                       │  CORS enabled                │
                                       └──────────────┬───────────────┘
                                                      │
                    ┌─────────────────────────────────┼─────────────────────────┐
                    │                                 │                         │
                    ▼                                 ▼                         ▼
            ┌───────────────┐                ┌────────────────┐        ┌──────────────┐
            │  AuthModule   │                │ BillingModule  │        │ PaymentModule│
            │  JWT + bcrypt │                │ ItemsModule    │        │ midtrans-cli │
            └───────┬───────┘                └────────┬───────┘        └──────┬───────┘
                    │                                 │                         │
                    └─────────────────────────────────┼─────────────────────────┘
                                                      │
                                                      ▼
                                            ┌──────────────────┐
                                            │  PrismaService   │
                                            │  (Global Module) │
                                            │  adapter: pg     │
                                            └────────┬─────────┘
                                                     │
                                                     ▼
                                            ┌──────────────────┐
                                            │   PostgreSQL     │
                                            └──────────────────┘

Midtrans ──webhook──► POST /api/payment/webhook
```

### Modul NestJS

| Modul | File utama | Tanggung jawab |
|-------|------------|----------------|
| `PrismaModule` | `src/prisma/` | Koneksi global ke PostgreSQL |
| `AuthModule` | `src/auth/` | Register, login, JWT |
| `ItemsModule` | `src/items/` | CRUD item (create + list) |
| `BillingModule` | `src/billing/` | Buat & baca transaksi |
| `PaymentModule` | `src/payment/` | Snap token, webhook, status |
| `AppModule` | `src/app.module.ts` | Root, mengimpor semua modul |

---

## 3. Stack teknologi

| Komponen | Paket / Versi | Fungsi |
|----------|---------------|--------|
| Runtime | Node.js | Menjalankan server |
| Framework | NestJS 11 | Struktur modul, DI, controller |
| Bahasa | TypeScript 5.7 | Type safety |
| ORM | Prisma 7 + `@prisma/adapter-pg` | Akses PostgreSQL |
| Database | PostgreSQL | Penyimpanan persisten |
| Auth | `@nestjs/jwt`, `bcrypt` | Token & hash password |
| Validasi | `class-validator`, `class-transformer` | DTO validation |
| Payment | `midtrans-client` 1.4 | Snap API |
| API Docs | `@nestjs/swagger` | OpenAPI / Swagger UI |
| Testing | Jest, Supertest | Unit & e2e |

---

## 4. Skema database

Definisi lengkap: `prisma/schema.prisma`  
Migrasi awal: `prisma/migrations/20260511145724_init/`

### Diagram relasi

```
User ──────────────< Transaction >────────────── Patient
                         │
                         │ 1:N
                         ▼
                  TransactionItem >──── Item
```

### Model `User`

| Kolom | Tipe | Keterangan |
|-------|------|------------|
| `id` | UUID | Primary key |
| `name` | String | Nama kasir |
| `email` | String | Unique |
| `password` | String | Hash bcrypt |
| `role` | `Role` | Default `KASIR` |
| `createdAt` | DateTime | Auto |

### Model `Patient`

| Kolom | Tipe | Keterangan |
|-------|------|------------|
| `id` | UUID | Primary key |
| `name` | String | Nama pasien |
| `medicalRecordNo` | String | Unique — No. RM |
| `phone` | String? | Opsional |
| `insuranceType` | `InsuranceType` | `UMUM`, `BPJS`, `VOUCHER` |
| `createdAt` | DateTime | Auto |

> **Catatan:** Belum ada endpoint REST untuk CRUD pasien. Data harus diisi via Prisma Studio, SQL, atau seed manual.

### Model `Item`

| Kolom | Tipe | Keterangan |
|-------|------|------------|
| `id` | UUID | Primary key |
| `name` | String | Nama obat/layanan |
| `type` | `ItemType` | `OBAT` atau `LAYANAN` |
| `price` | Float | Harga satuan |
| `unit` | String? | Contoh: `tablet`, `kali` |

### Model `Transaction`

| Kolom | Tipe | Keterangan |
|-------|------|------------|
| `id` | UUID | Primary key |
| `patientId` | UUID | FK → Patient |
| `userId` | UUID | FK → User (kasir) |
| `status` | `TransactionStatus` | Lihat tabel status di bawah |
| `paymentMethod` | `PaymentMethod?` | Metode yang dipilih saat billing |
| `subtotal`, `tax`, `adminFee`, `total` | Float | Nilai keuangan |
| `qrisUrl`, `qrisToken` | String? | Reserved (belum dipakai di service) |
| `midtransOrderId` | String? | Unique — ID order ke Midtrans |
| `createdAt`, `updatedAt` | DateTime | Timestamp |

### Model `TransactionItem`

Baris detail per item dalam satu transaksi (snapshot harga saat transaksi dibuat).

| Kolom | Tipe |
|-------|------|
| `transactionId`, `itemId` | UUID (FK) |
| `quantity` | Int |
| `price` | Float (harga satuan saat transaksi) |
| `subtotal` | Float (`price × quantity`) |

### Enum

**`TransactionStatus`**

| Nilai | Arti |
|-------|------|
| `DRAFT` | Default schema; billing langsung set `PENDING_PAYMENT` |
| `PENDING_PAYMENT` | Menunggu pembayaran |
| `LUNAS` | Sudah dibayar (via webhook Midtrans) |
| `CANCELLED` | Dibatalkan / gagal |

**`PaymentMethod`** (database): `CASH`, `QRIS`, `DEBIT`, `TRANSFER`, `BPJS`

**`PaymentMethod`** (DTO billing saat ini): `CASH`, `QRIS`, `DEBIT`, `BPJS` — `TRANSFER` ada di DB tetapi belum di DTO.

**`InsuranceType`:** `UMUM`, `BPJS`, `VOUCHER`

---

## 5. Konfigurasi lingkungan

Salin `.env.example` ke `.env`.

```bash
cp .env.example .env
```

### Daftar variabel

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/smart_clinic_pos?schema=public"
JWT_SECRET="string-rahasia-panjang"
JWT_EXPIRES_IN="1d"
MIDTRANS_SERVER_KEY="SB-Mid-server-..."
MIDTRANS_CLIENT_KEY="SB-Mid-client-..."
MIDTRANS_IS_PRODUCTION=false
PORT=3000
```

### Format `DATABASE_URL`

```
postgresql://[user]:[password]@[host]:[port]/[database]?schema=public
```

Contoh dari development lokal (port DB kustom):

```
postgresql://pos_user:pos_password@localhost:5433/smart_clinic_pos?schema=public
```

### Midtrans

- **Sandbox:** `MIDTRANS_IS_PRODUCTION=false`, gunakan key dari [Midtrans Dashboard](https://dashboard.midtrans.com) (mode Sandbox).
- **Production:** `MIDTRANS_IS_PRODUCTION=true` + key production.

Webhook URL di dashboard Midtrans harus mengarah ke:

```
https://<domain-anda>/api/payment/webhook
```

Untuk development lokal, gunakan tunnel (ngrok, Cloudflare Tunnel, dll.) karena Midtrans harus bisa POST ke server Anda.

---

## 6. Setup & menjalankan aplikasi

### 6.1 Instalasi

```bash
npm install
cp .env.example .env
# Edit .env sesuai environment Anda
```

### 6.2 Database

Pastikan PostgreSQL berjalan dan database `smart_clinic_pos` sudah dibuat.

```bash
# Jalankan migrasi yang sudah ada
npx prisma migrate deploy

# Generate client (jika perlu)
npx prisma generate
```

### 6.3 Data awal (manual)

Karena belum ada seed script, siapkan minimal:

1. **User** — via `POST /api/auth/register` atau insert manual
2. **Patient** — via Prisma Studio:

```bash
npx prisma studio
```

Contoh insert pasien (SQL):

```sql
INSERT INTO "Patient" (id, name, "medicalRecordNo", phone, "insuranceType")
VALUES (
  gen_random_uuid(),
  'Budi Santoso',
  'RM-001',
  '081234567890',
  'UMUM'
);
```

3. **Item** — via `POST /api/items`

### 6.4 Menjalankan server

```bash
# Development (watch mode)
npm run start:dev

# Production
npm run build
npm run start:prod
```

### 6.5 Verifikasi

- `GET http://localhost:3000/api` → `Hello World!`
- Buka `http://localhost:3000/api/docs` → Swagger UI
- Buka `http://localhost:3000/payment-test.html` → halaman uji bayar

---

## 7. Struktur kode

```
src/
├── main.ts                 # Bootstrap, CORS, Swagger, static files
├── app.module.ts           # Root module
├── app.controller.ts       # GET /api
│
├── auth/
│   ├── auth.controller.ts  # POST register, login
│   ├── auth.service.ts     # bcrypt + JWT
│   ├── auth.module.ts
│   └── dto/
│       ├── register.dto.ts
│       └── login.dto.ts
│
├── items/
│   ├── items.controller.ts # GET, POST
│   ├── items.service.ts
│   └── dto/create-item.dto.ts
│
├── billing/
│   ├── billing.controller.ts
│   ├── billing.service.ts
│   └── dto/create-billing.dto.ts
│
├── payment/
│   ├── payment.controller.ts
│   ├── payment.service.ts  # Midtrans Snap + webhook
│   └── dto/create-payment.dto.ts
│
└── prisma/
    ├── prisma.module.ts    # @Global()
    └── prisma.service.ts   # PrismaClient + adapter pg
```

### Bootstrap (`main.ts`)

- Prefix global: **`api`**
- `ValidationPipe({ whitelist: true })` — field tidak terdaftar di DTO dibuang
- **CORS** diaktifkan (agar halaman HTML bisa memanggil API)
- Static files dari folder **`public/`**
- Swagger di **`/api/docs`**

---

## 8. Referensi API

Semua path di bawah ini relatif terhadap base URL `http://localhost:3000/api`.

### Format respons umum

Kebanyakan endpoint sukses mengembalikan JSON:

```json
{
  "message": "Pesan human-readable",
  "data": { }
}
```

Error NestJS standar:

```json
{
  "statusCode": 400,
  "message": "Deskripsi error",
  "error": "Bad Request"
}
```

---

### 8.1 Health check

#### `GET /`

| | |
|---|---|
| **Auth** | Tidak perlu |
| **Response** | `Hello World!` (plain text) |

---

### 8.2 Auth

#### `POST /auth/register`

Mendaftarkan kasir baru. Role default: `KASIR`.

**Body:**

```json
{
  "name": "Kasir Satu",
  "email": "kasir@klinik.com",
  "password": "password123"
}
```

| Field | Validasi |
|-------|----------|
| `name` | String |
| `email` | Email valid |
| `password` | Min 6 karakter |

**Response sukses (201):**

```json
{
  "message": "Register berhasil",
  "user": {
    "id": "uuid",
    "name": "Kasir Satu",
    "email": "kasir@klinik.com",
    "role": "KASIR"
  }
}
```

**Error:** `409 Conflict` jika email sudah terdaftar.

---

#### `POST /auth/login`

**Body:**

```json
{
  "email": "kasir@klinik.com",
  "password": "password123"
}
```

**Response sukses:**

```json
{
  "message": "Login berhasil",
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "uuid",
    "name": "Kasir Satu",
    "email": "kasir@klinik.com",
    "role": "KASIR"
  }
}
```

**Payload JWT** (internal): `sub` (user id), `email`, `role`.

**Error:** `401 Unauthorized` jika email/password salah.

> **Penting:** Token belum diverifikasi otomatis di endpoint lain (lihat [Keamanan](#12-keamanan--batasan)).

---

### 8.3 Items

Swagger menandai `@ApiBearerAuth()`, tetapi guard belum aktif.

#### `GET /items`

Mengambil semua item, diurutkan `type` ascending.

**Response:**

```json
{
  "message": "Data items berhasil diambil",
  "total": 2,
  "data": [
    {
      "id": "uuid",
      "name": "Paracetamol 500mg",
      "type": "OBAT",
      "price": 5000,
      "unit": "tablet"
    }
  ]
}
```

---

#### `POST /items`

**Body:**

```json
{
  "name": "Paracetamol 500mg",
  "type": "OBAT",
  "price": 5000,
  "unit": "tablet"
}
```

| Field | Validasi |
|-------|----------|
| `type` | `OBAT` \| `LAYANAN` |
| `price` | Number |
| `unit` | Opsional |

---

### 8.4 Billing

#### `POST /billing`

Membuat transaksi baru dengan status **`PENDING_PAYMENT`**.

**Body:**

```json
{
  "patientId": "uuid-pasien",
  "items": [
    { "itemId": "uuid-item-1", "quantity": 2 },
    { "itemId": "uuid-item-2", "quantity": 1 }
  ],
  "paymentMethod": "QRIS",
  "voucherCode": "VOUCHER-BPJS-001"
}
```

| Field | Keterangan |
|-------|------------|
| `patientId` | Harus ada di tabel `Patient` |
| `items` | Minimal 1 baris; semua `itemId` harus valid |
| `paymentMethod` | `CASH`, `QRIS`, `DEBIT`, `BPJS` |
| `voucherCode` | Opsional; jika diisi, total = 0 (sama seperti BPJS) |

**Logika perhitungan:**

```
subtotal = Σ (harga item × quantity)
tax = 0        (placeholder)
adminFee = 0   (placeholder)
total = 0      jika paymentMethod = BPJS ATAU voucherCode terisi
total = subtotal + tax + adminFee   selain itu
```

**`userId`:** Diambil dari `req.user.sub` jika ada; jika tidak, fallback ke UUID hardcoded di controller (sementara).

**Response sukses:**

```json
{
  "message": "Transaksi berhasil dibuat",
  "data": {
    "id": "uuid-transaksi",
    "status": "PENDING_PAYMENT",
    "paymentMethod": "QRIS",
    "subtotal": 15000,
    "tax": 0,
    "adminFee": 0,
    "total": 15000,
    "items": [
      {
        "name": "Paracetamol 500mg",
        "type": "OBAT",
        "quantity": 2,
        "price": 5000,
        "subtotal": 10000
      }
    ]
  }
}
```

**Error:** `404` jika item tidak ditemukan.

---

#### `GET /billing/:id`

Detail transaksi lengkap termasuk relasi `items` → `item`.

**Response:**

```json
{
  "message": "Data transaksi",
  "data": { }
}
```

---

### 8.5 Payment

#### `POST /payment/tokenizer`

Membuat **Snap Token** Midtrans untuk transaksi yang statusnya `PENDING_PAYMENT`.

**Body:**

```json
{
  "transactionId": "uuid-transaksi"
}
```

**Proses internal:**

1. Load transaksi + items + patient
2. Validasi status = `PENDING_PAYMENT`
3. Generate `orderId` format: `POS-{8 char id}-{timestamp}`
4. Panggil `snap.createTransaction()` dengan filter: `qris`, `bank_transfer`, `credit_card`
5. Simpan `midtransOrderId` ke database

**Response sukses:**

```json
{
  "message": "Snap token berhasil dibuat",
  "data": {
    "transactionId": "uuid",
    "orderId": "POS-eae78049-1715432100000",
    "snapToken": "token-dari-midtrans",
    "snapRedirectUrl": "https://app.sandbox.midtrans.com/snap/v4/...",
    "total": 15000
  }
}
```

**Error:**

- `404` — transaksi tidak ada
- `400` — status bukan `PENDING_PAYMENT`

---

#### `POST /payment/webhook`

Endpoint untuk notifikasi Midtrans. **Jangan diproteksi JWT** (Midtrans server yang memanggil).

**Body:** Payload notifikasi Midtrans (struktur bervariasi; contoh field):

```json
{
  "order_id": "POS-eae78049-1715432100000",
  "transaction_status": "settlement",
  "fraud_status": "accept"
}
```

**Mapping status:**

| `transaction_status` | Status baru |
|----------------------|-------------|
| `settlement` | `LUNAS` |
| `capture` + `fraud_status=accept` | `LUNAS` |
| `capture` + fraud lain | `CANCELLED` |
| `cancel`, `deny`, `expire` | `CANCELLED` |

**Response:**

```json
{
  "message": "Webhook berhasil diproses",
  "status": "LUNAS"
}
```

---

#### `GET /payment/status/:transactionId`

Cek status transaksi (ringkas).

**Response:**

```json
{
  "message": "Status transaksi",
  "data": {
    "id": "uuid",
    "status": "PENDING_PAYMENT",
    "total": 15000,
    "paymentMethod": "QRIS",
    "midtransOrderId": "POS-..."
  }
}
```

---

## 9. Alur bisnis

### 9.1 Alur transaksi umum (QRIS / Midtrans)

```mermaid
sequenceDiagram
    participant K as Kasir / Client
    participant API as Smart Clinic API
    participant DB as PostgreSQL
    participant MT as Midtrans

    K->>API: POST /auth/login
    API-->>K: access_token

    K->>API: POST /items (jika belum ada)
    K->>API: POST /billing
    API->>DB: Insert Transaction (PENDING_PAYMENT)
    API-->>K: transactionId

    K->>API: POST /payment/tokenizer
    API->>MT: createTransaction (Snap)
    API->>DB: Update midtransOrderId
    API-->>K: snapToken

    K->>MT: snap.pay(snapToken)
    MT->>API: POST /payment/webhook
    API->>DB: Update status → LUNAS

    K->>API: GET /payment/status/:id
    API-->>K: status LUNAS
```

### 9.2 Alur BPJS / Voucher

Jika `paymentMethod = BPJS` atau `voucherCode` diisi:

- `total`, `tax`, `adminFee` diset **0**
- Transaksi tetap dibuat dengan status `PENDING_PAYMENT`
- Validasi voucher ke sistem eksternal **belum** ada

### 9.3 Alur CASH

Metode `CASH` tercatat di transaksi, tetapi **belum ada endpoint** untuk menandai `LUNAS` tanpa Midtrans. Perlu pengembangan lanjutan (mis. `PATCH /billing/:id/complete`).

---

## 10. Integrasi Midtrans

### Dependensi

```json
"midtrans-client": "^1.4.3"
```

### Inisialisasi (`PaymentService`)

```typescript
this.snap = new midtransClient.Snap({
  isProduction: process.env.MIDTRANS_IS_PRODUCTION === 'true',
  serverKey: process.env.MIDTRANS_SERVER_KEY!,
  clientKey: process.env.MIDTRANS_CLIENT_KEY!,
});
```

### Order ID

Format: `POS-{8 karakter pertama transaction.id}-{Date.now()}`

Disimpan di kolom `Transaction.midtransOrderId` untuk lookup webhook.

### Konfigurasi webhook (Midtrans Dashboard)

1. Masuk Sandbox/Production settings
2. Set **Payment Notification URL** ke URL publik: `https://<host>/api/payment/webhook`
3. Untuk lokal, gunakan tunnel HTTPS

### Verifikasi signature webhook

Implementasi saat ini **belum memverifikasi** signature Midtrans — disarankan ditambahkan di production.

---

## 11. Halaman uji pembayaran

**File:** `public/payment-test.html`  
**URL:** `http://localhost:3000/payment-test.html`

Fungsi:

1. Input **Transaction ID**
2. **Cek Status** → `GET /api/payment/status/:id`
3. **Bayar Sekarang** → `POST /api/payment/tokenizer` → `window.snap.pay(token)`

Script Midtrans Sandbox di-load dari CDN. **Client key** di HTML harus disesuaikan dengan `MIDTRANS_CLIENT_KEY` di `.env` Anda (nilai di file saat ini mungkin contoh hardcoded).

---

## 12. Keamanan & batasan

### Yang sudah ada

- Password di-hash dengan **bcrypt** (salt rounds: 10)
- JWT ditandatangani dengan `JWT_SECRET`
- `ValidationPipe` dengan `whitelist: true` mengurangi mass assignment
- CORS diaktifkan untuk development frontend

### Batasan / risiko (perlu perhatian)

| Isu | Dampak | Rekomendasi |
|-----|--------|-------------|
| JWT Guard belum ada | Siapa saja bisa panggil API billing/items/payment | Implementasi `JwtAuthGuard` + `@UseGuards()` |
| `userId` fallback hardcoded | Transaksi bisa tercatat ke user salah | Wajibkan auth di `POST /billing` |
| Log `DATABASE_URL` di console | Kebocoran kredensial DB | Hapus `console.log` di `PrismaService` |
| Webhook tanpa verifikasi signature | Risiko webhook palsu | Validasi signature Midtrans |
| Tidak ada rate limiting | Brute force login | Tambah throttler NestJS |
| `.env` di gitignore | Baik — jangan commit secret | Gunakan `.env.example` |
| Role tidak dipakai | Semua user setara | Role guard per endpoint |
| API Patient tidak ada | `patientId` harus manual | Buat `PatientsModule` |

### Header Authorization (rencana)

Setelah JWT Guard diimplementasi:

```
Authorization: Bearer <access_token>
```

---

## 13. Testing

### Unit test

```bash
npm run test
```

File spec ada di setiap modul (`*.spec.ts`). Coverage:

```bash
npm run test:cov
```

### E2E

```bash
npm run test:e2e
```

**Catatan:** Test default `test/app.e2e-spec.ts` memanggil `GET /` tanpa prefix `api` — kemungkinan **gagal** terhadap konfigurasi `main.ts` saat ini. Perlu disesuaikan ke `GET /api` jika ingin lulus.

### Uji manual via Swagger

1. Buka `/api/docs`
2. Register → Login → copy token
3. (Setelah guard ada) klik **Authorize** dan paste token
4. Uji endpoint berurutan

### Uji manual via cURL

```bash
# Login
curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"kasir@klinik.com","password":"password123"}'

# List items
curl -s http://localhost:3000/api/items

# Buat billing
curl -s -X POST http://localhost:3000/api/billing \
  -H "Content-Type: application/json" \
  -d '{
    "patientId": "UUID_PASIEN",
    "items": [{"itemId": "UUID_ITEM", "quantity": 1}],
    "paymentMethod": "QRIS"
  }'
```

---

## 14. Troubleshooting

| Gejala | Kemungkinan penyebab | Solusi |
|--------|---------------------|--------|
| `Can't reach database` | PostgreSQL mati / URL salah | Cek `DATABASE_URL`, pastikan DB jalan |
| `Prisma migrate` gagal | DB belum dibuat | Buat database `smart_clinic_pos` |
| `Transaksi tidak ditemukan` | ID salah / belum dibuat billing | Buat billing dulu, copy `id` dari response |
| `Transaksi tidak bisa dibayar` | Status bukan `PENDING_PAYMENT` | Cek status; mungkin sudah `LUNAS` |
| Snap token gagal | Key Midtrans salah / total 0 | Cek env; BPJS total 0 tidak bisa Snap |
| Webhook tidak update status | URL tidak publik / order_id tidak match | Tunnel HTTPS; cek `midtransOrderId` di DB |
| CORS error dari browser | Origin diblokir | `enableCors()` sudah ada — cek URL API di HTML |
| Foreign key patient | `patientId` tidak ada | Insert pasien dulu |

### Prisma Studio

```bash
npx prisma studio
```

Buka GUI di browser untuk inspect/edit `User`, `Patient`, `Item`, `Transaction`.

---

## 15. Rencana pengembangan

Fitur yang **belum** ada di kode tetapi relevan untuk POS klinik lengkap:

- [ ] Modul **Patient** (CRUD + pencarian RM)
- [ ] **JWT Auth Guard** + Passport strategy
- [ ] **Role-based access control**
- [ ] Endpoint **selesaikan transaksi CASH** tanpa Midtrans
- [ ] Perhitungan **pajak & admin fee** yang configurable
- [ ] Validasi **voucher** ke sistem eksternal
- [ ] Verifikasi **signature webhook** Midtrans
- [ ] Seed script (`prisma/seed.ts`)
- [ ] Hapus log sensitif di `PrismaService`
- [ ] Perbaiki test E2E agar selaras dengan prefix `/api`
- [ ] Update `payment-test.html` agar client key dari env/config

---

## Lampiran: Kode error HTTP umum

| Kode | Arti di NestJS |
|------|----------------|
| 400 | Bad Request — validasi gagal / business rule |
| 401 | Unauthorized — login gagal |
| 404 | Not Found — resource tidak ada |
| 409 | Conflict — email duplikat |

---

*Dokumen ini dibuat berdasarkan kode di repository `smart-clinic-pos`. Jika ada perubahan kode, perbarui dokumen ini agar tetap selaras.*
