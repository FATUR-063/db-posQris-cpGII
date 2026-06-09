# Laporan Progres — Smart Clinic POS

**Tanggal laporan:** 3 Juni 2026  
**Sumber data:** isi folder `/root/smart-clinic-pos` (kode, migrasi, dokumen, hasil `npm run build` dan `npm test` pada lingkungan kerja ini).  
**Versi paket:** `0.0.1` (`package.json`)

---

## 1. Ringkasan

Smart Clinic POS adalah **backend REST API** untuk operasional kasir klinik: autentikasi kasir, katalog obat/layanan, transaksi billing, pembayaran digital Midtrans Snap, dan modul akuntansi (jurnal otomatis + laporan). Proyek **bukan** aplikasi frontend penuh; yang ada di sisi klien hanya halaman HTML statis untuk uji pembayaran.

**Kondisi teknis saat ini (terverifikasi):**

| Aspek | Status |
|--------|--------|
| Kompilasi TypeScript (`npm run build`) | Berhasil |
| Unit test Jest (`npm test`) | 2 lulus, 8 gagal (modul testing belum menyediakan dependency mock) |
| Repositori Git | Belum ada commit (`git log` kosong); seluruh file masih untracked |
| Dokumentasi README vs kode | Sebagian usang (lihat §7) |

Perkiraan volume kode aplikasi: **31 file** `.ts` di `src/` (tanpa `.spec.ts`), total baris sumber (termasuk nested) sekitar **1.661 baris** (per `wc`).

---

## 2. Tujuan & ruang lingkup (sesuai kode)

| Dalam ruang lingkup | Di luar ruang lingkup (belum ada di repo) |
|---------------------|-------------------------------------------|
| API NestJS dengan prefix global `/api` | Aplikasi web/mobile kasir |
| PostgreSQL via Prisma 7 + adapter `@prisma/adapter-pg` | Modul CRUD pasien |
| Integrasi Midtrans Snap + webhook | CI/CD, deployment, monitoring |
| Swagger di `/api/docs` | Inventori/stok real-time |
| Seed Chart of Accounts (COA) | User/pasien/item contoh di seed |

---

## 3. Stack teknologi

| Lapisan | Teknologi | Versi (dari `package.json`) |
|---------|-----------|------------------------------|
| Runtime | Node.js | (disarankan 18+, README menyebut 20+) |
| Framework | NestJS | ^11.0.1 |
| Bahasa | TypeScript | ^5.7.3 |
| ORM | Prisma | ^7.8.0 |
| Database | PostgreSQL | provider di `schema.prisma` |
| Auth | JWT (`@nestjs/jwt`), Passport JWT, bcrypt | — |
| Validasi | class-validator, ValidationPipe global | — |
| Pembayaran | `midtrans-client` (Snap) | ^1.4.3 |
| Akuntansi (perhitungan) | `decimal.js` | ^10.6.0 |
| API docs | `@nestjs/swagger` | ^11.4.2 |
| Testing | Jest, supertest (e2e) | Jest ^30 |

Konfigurasi lingkungan: `.env.example` — `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, kunci Midtrans, `PORT`.

---

## 4. Struktur proyek (faktual)

```
smart-clinic-pos/
├── docs/           # Dokumentasi teknis & panduan instalasi modul
├── prisma/         # schema.prisma, migrations/, seed.ts
├── public/         # payment-test.html
├── src/
│   ├── auth/       # register, login, JWT strategy, guards, roles
│   ├── items/      # list & create item
│   ├── billing/    # create & get transaksi
│   ├── payment/    # Snap token, webhook, status
│   ├── accounting/ # COA, jurnal, pengeluaran, laporan
│   └── prisma/     # PrismaService global
├── test/           # app.e2e-spec.ts (belum selaras dengan prefix /api)
└── dist/           # output build (ada di workspace)
```

Modul terdaftar di `AppModule`: `PrismaModule`, `AuthModule`, `BillingModule`, `PaymentModule`, `ItemsModule`, `AccountingModule`.

---

## 5. Progres per modul

### 5.1 Auth — **implementasi inti selesai**

- Endpoint: `POST /api/auth/register`, `POST /api/auth/login`
- Password di-hash (bcrypt) di `AuthService`
- `JwtStrategy`, `JwtAuthGuard`, `RolesGuard`, decorator `@Roles()` ada dan dipakai di controller lain
- Role di database (enum Prisma): `KASIR`, `MANAGER`, `SUPER_ADMIN`

### 5.2 Items — **CRUD terbatas (create + list)**

- `GET /api/items` — role: KASIR, MANAGER, SUPER_ADMIN, **FINANCE_STAFF**
- `POST /api/items` — role: SUPER_ADMIN, MANAGER saja
- Tidak ada endpoint update/delete di controller

### 5.3 Billing — **alur transaksi inti ada**

- `POST /api/billing` — buat transaksi, hitung subtotal/total, status awal `PENDING_PAYMENT`
- `GET /api/billing/:id` — detail transaksi
- `userId` diambil dari JWT (`req.user.userId`), bukan UUID hardcoded
- Pajak dan admin fee masih **0** (placeholder di `billing.service.ts`)
- Logika BPJS/voucher: total bisa **0** jika `paymentMethod === 'BPJS'` atau ada `voucherCode`
- `patientId` wajib di DTO; **tidak ada API** untuk mengelola pasien

### 5.4 Payment — **integrasi Midtrans terhubung ke akuntansi**

- `POST /api/payment/tokenizer` — Snap token (butuh JWT)
- `POST /api/payment/webhook` — **tanpa** JWT (dipanggil Midtrans)
- `GET /api/payment/status/:transactionId` — cek status (butuh JWT)
- Webhook memetakan status Midtrans → `LUNAS` / `CANCELLED`, menyimpan `paidAt` saat lunas
- Saat `LUNAS`: memanggil `AccountingService.createJournalFromTransaction()` (idempotent); error jurnal tidak menggagalkan respons webhook

### 5.5 Accounting — **modul baru, fungsional di kode**

**Skema database** (migrasi `20260521071011_add_accounting_engine`): `ChartOfAccount`, `JournalEntry`, `JournalLine`, `Expense` + enum terkait.

**Seed** (`prisma/seed.ts`): 13 akun COA (1100–5500), upsert by code.

**Endpoint** (semua di bawah `/api/accounting`, dengan `JwtAuthGuard` + `RolesGuard`):

| Method | Path | Fungsi |
|--------|------|--------|
| GET | `coa` | Daftar COA |
| GET | `coa/expense-accounts` | Akun beban untuk dropdown |
| GET | `journal` | Daftar jurnal (filter tanggal opsional) |
| GET | `journal/:id` | Detail jurnal |
| GET | `expenses` | Daftar pengeluaran |
| POST | `expenses` | Catat pengeluaran + jurnal debit/kredit |
| GET | `reports/cashflow` | Arus kas |
| GET | `reports/profit-loss` | Laba rugi |
| GET | `reports/general-ledger` | Buku besar |

**Jurnal otomatis dari transaksi:** debit Kas (1100) atau Piutang BPJS (1300); kredit pendapatan jasa (4100) / obat (4200) sesuai tipe item.

### 5.6 Infrastruktur aplikasi — **selesai untuk dev**

- `main.ts`: prefix `api`, CORS, static `public/`, Swagger Bearer auth
- Health: `GET /api` → Hello World (`AppController`)

---

## 6. Database & migrasi

| Migrasi | Nama | Isi utama |
|---------|------|-----------|
| `20260511145724_init` | init | User, Patient, Item, Transaction, TransactionItem + enum dasar |
| `20260521071011_add_accounting_engine` | add_accounting_engine | Tabel akuntansi, relasi ke Transaction/User, field `paidAt` pada Transaction |

Model inti POS tetap: pasien, item, transaksi, detail transaksi. User memiliki relasi ke transaksi, jurnal, dan pengeluaran.

---

## 7. Dokumentasi di repo

| File | Kondisi |
|------|---------|
| `README.md` | Lengkap untuk setup POS + payment; **belum** mencantumkan modul Accounting; masih menyatakan JWT Guard belum diimplementasi — **tidak sesuai kode saat ini** |
| `docs/DOCUMENTATION.md` | Dokumen teknis panjang untuk POS; **tidak menyebut Accounting**; bagian keamanan menyatakan role belum membatasi akses — **tidak sesuai** setelah penambahan guards |
| `docs/SRC_DOCUMENTATION.md` | Salinan dokumentasi kode `src/` |
| `docs/INSTALL_accountingengine.md` | Panduan migrasi/schema akuntansi |
| `docs/INSTALL_accountingmodule.md` | Panduan wiring modul accounting + payment |
| `docs/INSTALL_accountingengine.md` (JWT) | Panduan JWT guard (sudah diterapkan di kode) |

---

## 8. Pengujian & kualitas

**Build:** `nest build` sukses (exit code 0).

**Unit test:** 10 suite — **8 gagal** karena `Test.createTestingModule` tidak mengimpor/mocking `PrismaService`, `AccountingService`, dll. (contoh: `payment.controller.spec.ts`). Hanya test minimal “should be defined” yang lolos di beberapa file.

**E2E:** `test/app.e2e-spec.ts` memanggil `GET /` dan mengharapkan `Hello World!`, sementara aplikasi memakai `setGlobalPrefix('api')` — **kemungkinan gagal** jika dijalankan tanpa penyesuaian.

**Tidak ada** file spec untuk modul `accounting/`.

---

## 9. Alur bisnis yang sudah bisa dijalankan (end-to-end, manual)

Dengan database terisi manual (pasien + item via Prisma Studio/SQL):

```
Register/Login → JWT → Tambah/list item → POST billing → POST payment/tokenizer
→ Bayar di Midtrans → Webhook → status LUNAS + paidAt + jurnal INCOME
→ (Opsional) GET laporan accounting / POST expenses
```

Halaman uji: `http://localhost:3000/payment-test.html` (file di `public/`).

---

## 10. Gap, inkonsistensi, dan pekerjaan tersisa (berbasis kode)

| Item | Bukti |
|------|--------|
| Tidak ada API Patient | Hanya model `Patient` di Prisma; billing membutuhkan `patientId` |
| Role `FINANCE_STAFF` di `@Roles()` | Dipakai di `accounting.controller.ts` dan `items.controller.ts`, **tidak ada** di enum `Role` Prisma |
| README/DOCUMENTATION usang | Klaim JWT/role belum aktif; Accounting tidak didokumentasikan di DOCUMENTATION.md |
| Pajak & admin fee | Tetap 0 di `billing.service.ts` |
| System user untuk jurnal webhook | Fallback: user `SUPER_ADMIN` pertama atau `transaction.userId` |
| Konstanta `SYSTEM_USER_PLACEHOLDER` | Dideklarasikan di `payment.service.ts` tetapi tidak dipakai |
| Seed hanya COA | Tidak men-seed user demo, pasien, atau item |
| Unit & e2e test | Tidak mengikuti evolusi modul dan prefix API |
| Git | Belum ada riwayat commit — progres tidak ter-versioning di VCS |
| File `*:Zone.Identifier` | Artefak Windows di beberapa path; tidak mempengaruhi runtime |

---

## 11. Kesimpulan progres

Proyek berada pada tahap **backend MVP yang dapat dijalankan untuk alur kasir + pembayaran Midtrans**, dengan perluasan **accounting engine** (skema DB, seed COA, API laporan, jurnal otomatis saat lunas) yang sudah terintegrasi di kode dan migrasi. Kompilasi production build berhasil.

Yang belum mencapai “siap produksi” berdasarkan isi repo: pengujian otomatis yang hijau, dokumentasi selaras dengan kode, API pasien, perapihan role `FINANCE_STAFF`, penghitungan pajak/fee nyata, dan version control Git. Tidak ada frontend operasional kasir di dalam repositori ini.

---

*Laporan ini hanya mencatat apa yang dapat diverifikasi dari file dan perintah build/test di workspace; tidak memuat estimasi timeline atau fitur yang tidak tampak di kode.*
