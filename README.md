# Smart Clinic POS

Backend API untuk sistem **Point of Sale (POS)** klinik: pendaftaran kasir, katalog obat/layanan, pembuatan transaksi billing, dan pembayaran digital via **Midtrans Snap** (QRIS, transfer bank, kartu kredit).

Dibangun dengan **NestJS**, **PostgreSQL**, **Prisma**, dan **Swagger** untuk dokumentasi interaktif.

---

## Fitur utama

| Modul | Keterangan |
|-------|------------|
| **Auth** | Register & login kasir, JWT token |
| **Items** | Daftar dan tambah obat/layanan |
| **Billing** | Buat transaksi, hitung subtotal/total otomatis |
| **Payment** | Snap token Midtrans, webhook, cek status transaksi |
| **Swagger** | Dokumentasi API interaktif di `/api/docs` |
| **Halaman uji** | Simulasi bayar di `/payment-test.html` |

---

## Persyaratan

- **Node.js** 18+ (disarankan 20+)
- **PostgreSQL** 14+
- Akun **Midtrans Sandbox** (untuk uji pembayaran)

---

## Instalasi cepat

```bash
# 1. Clone & masuk folder proyek
cd smart-clinic-pos

# 2. Install dependensi
npm install

# 3. Salin dan edit environment
cp .env.example .env

# 4. Jalankan migrasi database
npx prisma migrate deploy

# 5. (Opsional) generate Prisma Client jika belum
npx prisma generate

# 6. Jalankan server development
npm run start:dev
```

Server berjalan di:

| URL | Fungsi |
|-----|--------|
| http://localhost:3000/api | Health check (Hello World) |
| http://localhost:3000/api/docs | Swagger UI |
| http://localhost:3000/payment-test.html | Uji pembayaran Midtrans |

---

## Variabel lingkungan

Lihat [.env.example](.env.example) untuk daftar lengkap. Ringkasan:

| Variabel | Wajib | Deskripsi |
|----------|-------|-----------|
| `DATABASE_URL` | Ya | Connection string PostgreSQL |
| `JWT_SECRET` | Ya | Secret untuk menandatangani JWT |
| `JWT_EXPIRES_IN` | Tidak | Masa berlaku token (default: `1d`) |
| `MIDTRANS_SERVER_KEY` | Ya* | Server key Midtrans |
| `MIDTRANS_CLIENT_KEY` | Ya* | Client key Midtrans |
| `MIDTRANS_IS_PRODUCTION` | Tidak | `true` = production, `false` = sandbox |
| `PORT` | Tidak | Port HTTP (default: `3000`) |

\* Wajib jika modul payment dipakai.

---

## Alur kerja singkat

```
Register/Login → Tambah Item → Buat Billing → Generate Snap Token → Bayar (Midtrans) → Webhook → Status LUNAS
```

1. **Register** kasir: `POST /api/auth/register`
2. **Login** dan simpan `access_token`: `POST /api/auth/login`
3. Pastikan ada **pasien** dan **item** di database (saat ini via Prisma Studio / SQL — lihat [dokumentasi lengkap](docs/DOCUMENTATION.md))
4. **Buat transaksi**: `POST /api/billing`
5. **Bayar via Midtrans**: `POST /api/payment/tokenizer` → buka Snap dengan token
6. Midtrans mengirim **webhook** ke `POST /api/payment/webhook`
7. **Cek status**: `GET /api/payment/status/:transactionId`

---

## Perintah npm

| Perintah | Fungsi |
|----------|--------|
| `npm run start:dev` | Development dengan hot-reload |
| `npm run build` | Compile TypeScript ke `dist/` |
| `npm run start:prod` | Jalankan build production |
| `npm run test` | Unit test (Jest) |
| `npm run test:e2e` | End-to-end test |
| `npm run lint` | ESLint |

### Prisma

| Perintah | Fungsi |
|----------|--------|
| `npx prisma studio` | GUI untuk melihat/edit data |
| `npx prisma migrate dev` | Buat & jalankan migrasi (development) |
| `npx prisma migrate deploy` | Jalankan migrasi (production/CI) |

---

## Struktur proyek

```
smart-clinic-pos/
├── docs/
│   └── DOCUMENTATION.md    # Dokumentasi teknis lengkap
├── prisma/
│   ├── schema.prisma       # Model database
│   └── migrations/         # SQL migrasi
├── public/
│   └── payment-test.html   # Halaman uji pembayaran
├── src/
│   ├── auth/               # Register & login
│   ├── billing/            # Transaksi POS
│   ├── items/              # Katalog obat & layanan
│   ├── payment/            # Midtrans Snap & webhook
│   ├── prisma/             # Koneksi database
│   ├── app.module.ts
│   └── main.ts
├── .env.example
└── README.md
```

---

## Dokumentasi lengkap

| Dokumen | Isi |
|---------|-----|
| [docs/DOCUMENTATION.md](docs/DOCUMENTATION.md) | Arsitektur, database, API, Midtrans, troubleshooting |
| [docs/SRC_DOCUMENTATION.md](docs/SRC_DOCUMENTATION.md) | **Salinan lengkap** semua kode di folder `src/` (33 file) |

---

## Batasan yang perlu diketahui

- **JWT Guard** belum diimplementasi — endpoint dengan `@ApiBearerAuth()` saat ini **tidak memverifikasi token** secara otomatis.
- **API Patient** belum ada — data pasien harus dimasukkan manual ke database.
- **`userId` di billing** masih memakai UUID fallback jika token tidak ada.
- **Pajak & admin fee** di billing masih `0` (placeholder).
- File `.env` **tidak** di-commit ke git — gunakan `.env.example` sebagai template.

---

## Lisensi

Proyek private (`UNLICENSED`).
