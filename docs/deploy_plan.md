# Deploy Plan — Swagger Smart Clinic POS

**Target:** Deploy Swagger besok sore (9 Juni 2026)  
**Baseline:** PRD v3 (5 Juni 2026) — scope dikurangi dari akunting klinik, fokus ke alur POS  
**Total estimasi:** ~3.5 jam kerja efektif

---

## Context & Keputusan Arsitektur

### Perubahan Scope (PRD v2 → v3, arahan Pak Anqi / GII)

- **Dihapus dari deliverable:** Expense tracking (listrik, gaji, supplier), laporan laba rugi, cashflow monitoring, general ledger detail, input pengeluaran manual
- **Tetap di codebase:** Modul accounting engine (COA, jurnal otomatis saat LUNAS) — tidak dihapus, hanya disembunyikan dari Swagger
- **Ditambahkan:** Outstanding invoice tracking, dashboard revenue & transaksi, statistik metode pembayaran, riwayat transaksi pasien, modul BPJS & FORNAS (fase integrasi)

### Temuan Integrasi (Diparkir — Eksekusi Setelah Deploy)

| Sistem | Temuan Kunci | Status |
|--------|-------------|--------|
| **RME** | Billing RME tumpang tindih dengan POS — perlu klarifikasi ownership | ⏳ Pending klarifikasi |
| **RME** | Tidak ada endpoint resep by `patientId` — harus via `rekamMedisId` (multi-step) | ⏳ Noted |
| **RME** | Harga obat tidak ada di payload resep — harus dari WMS | ⏳ Noted |
| **WMS** | Pharmacy API sudah siap untuk POS (`/pharmacy/quote`, `/pharmacy/orders`) | ✅ Documented |
| **WMS** | Auth pakai `x-api-key` — perlu minta key ke tim WMS | ⏳ Pending |
| **WMS** | `obatId` WMS ≠ item RME — perlu resolusi via `kodeObat` atau `obat/search` | ⏳ Noted |

### Pertanyaan untuk Tim (Post-Deploy)

1. **Ke RME:** Siapa yang owns billing — RME atau POS?
2. **Ke WMS:** Minta `x-api-key` untuk environment dev/staging
3. **Ke WMS:** Apakah `/api/v1/rme/*` di WMS adalah proxy aktif ke RME?
4. **Ke RME+WMS:** Konfirmasi mapping `obatId` WMS dari nama obat RME
5. **Ke WMS:** Apakah `dispense` otomatis setelah `payment-status = paid`?

---

## Batch 1 — Malam Ini (Fondasi)

### Task 1: Fix Auth Module ⏱️ 30 menit

**Problem:**
- `RegisterDto` tidak punya field `role` — semua user jadi role default
- `FINANCE_STAFF` dipakai di controller tapi tidak ada di enum Prisma `Role`
- Guard akan crash saat runtime kalau role tidak cocok

**Deliverable:**
- Tambah `role` sebagai field opsional di `RegisterDto` (default: `KASIR`)
- Tambah `FINANCE_STAFF` ke enum `Role` di `schema.prisma`
- Jalankan migrasi database
- Pastikan register endpoint bisa create user dengan role apapun (hanya `SUPER_ADMIN` boleh assign role selain `KASIR`)

**File yang diubah:**
- `prisma/schema.prisma` — enum Role
- `src/auth/dto/register.dto.ts` — tambah field role
- `src/auth/auth.service.ts` — handle role assignment
- `src/auth/auth.controller.ts` — update Swagger decorator jika perlu

---

### Task 2: Patient Module ⏱️ 45 menit

**Problem:**
- Model `Patient` ada di Prisma tapi tidak ada controller/service/DTO
- Billing butuh `patientId` tapi kasir tidak bisa create/search pasien via API
- Swagger terlihat bolong tanpa endpoint pasien

**Deliverable:**
- `POST /api/patients` — daftarkan pasien baru
- `GET /api/patients` — list pasien + search by nama/noRm
- `GET /api/patients/:id` — detail pasien
- `PUT /api/patients/:id` — update data pasien

**File yang dibuat:**
- `src/patients/patients.module.ts`
- `src/patients/patients.controller.ts`
- `src/patients/patients.service.ts`
- `src/patients/dto/create-patient.dto.ts`
- `src/patients/dto/update-patient.dto.ts`

**Catatan schema:** Review model `Patient` di Prisma — pastikan ada field: `name`, `nik`, `phone`, `address`, `noBpjs` (opsional), `jenisKelamin`

---

### Task 3: Seed Data Demo ⏱️ 15 menit

**Problem:**
- Seed saat ini hanya COA (13 akun)
- Swagger tidak bisa di-test tanpa data dasar

**Deliverable update `prisma/seed.ts`:**
- 4 user (1 per role: `SUPER_ADMIN`, `MANAGER`, `KASIR`, `FINANCE_STAFF`)
- 5 item (3 obat + 2 layanan dengan harga realistis)
- 3 pasien (1 BPJS, 2 non-BPJS)

---

## Batch 2 — Besok Pagi (Core POS Flow)

### Task 4: GET /api/billing (List Transaksi) ⏱️ 25 menit

**Problem:**
- Saat ini hanya `POST /api/billing` dan `GET /api/billing/:id`
- Kasir/manager tidak bisa lihat daftar transaksi
- FR-DASH-09 butuh riwayat transaksi

**Deliverable:**
- `GET /api/billing` — list semua transaksi
- Query params: `?status=LUNAS|PENDING_PAYMENT|CANCELLED`, `?from=2026-06-01`, `?to=2026-06-09`, `?patientId=uuid`
- Pagination: `?page=1&limit=20`
- Sort: terbaru dulu (default)
- Response include: id, patient name, total, status, paymentMethod, createdAt, paidAt

---

### Task 5: GET /api/billing/outstanding (Invoice Belum Lunas) ⏱️ 20 menit

**Problem:**
- FR-DASH-05: Sistem harus menampilkan daftar outstanding invoice
- Belum ada endpoint khusus

**Deliverable:**
- `GET /api/billing/outstanding` — list transaksi dengan status `PENDING_PAYMENT`
- Sorted by oldest first (tagihan terlama di atas)
- Response include: id, patient name, total, createdAt, daysPending (berapa hari belum lunas)

---

### Task 6: GET /api/billing/summary (Dashboard Ringkasan) ⏱️ 25 menit

**Problem:**
- FR-DASH-01: Total transaksi harian/bulanan
- FR-DASH-02: Total pendapatan harian/bulanan
- FR-DASH-03: Statistik metode pembayaran
- Belum ada endpoint dashboard

**Deliverable:**
- `GET /api/billing/summary?from=2026-06-01&to=2026-06-09`
- Response:

```json
{
  "totalTransactions": 45,
  "totalRevenue": 15750000,
  "totalOutstanding": 3,
  "outstandingAmount": 2500000,
  "byPaymentMethod": {
    "QRIS": { "count": 20, "amount": 8000000 },
    "CASH": { "count": 15, "amount": 5000000 },
    "BPJS": { "count": 8, "amount": 2000000 },
    "DEBIT": { "count": 2, "amount": 750000 }
  },
  "todayTransactions": 5,
  "todayRevenue": 1250000
}
```

---

## Batch 3 — Besok Siang (Polish & Deploy)

### Task 7: Sembunyikan Endpoint Accounting dari Swagger ⏱️ 15 menit

**Problem:**
- Endpoint accounting (COA, journal, expenses, reports) tidak sesuai scope PRD v3
- Tapi code tetap dipertahankan di codebase

**Deliverable:**
- Tambah `@ApiExcludeController()` atau hapus `@ApiTags('Accounting')` dari Swagger
- Endpoint tetap accessible via API, hanya tidak muncul di Swagger docs
- Alternatif: pindahkan ke tag "Internal / Legacy" yang collapsed

---

### Task 8: Swagger Metadata Cleanup ⏱️ 15 menit

**Deliverable:**
- Update title: "Smart Clinic POS & Payment QRIS API"
- Update description sesuai PRD v3
- Tag grouping yang rapi: `Auth`, `Patients`, `Billing`, `Payment`
- Setiap endpoint punya summary dan description
- Contoh request/response di DTO decorators

---

### Task 9: Test End-to-End Manual ⏱️ 20 menit

**Flow yang harus jalan:**

```
1. POST /api/auth/register  → buat user KASIR
2. POST /api/auth/login     → dapat JWT token
3. POST /api/patients       → daftarkan pasien baru
4. GET  /api/patients       → cari pasien
5. POST /api/items          → tambah obat (pakai SUPER_ADMIN token)
6. GET  /api/items          → list obat
7. POST /api/billing        → buat transaksi untuk pasien
8. GET  /api/billing        → list transaksi
9. GET  /api/billing/:id    → detail transaksi
10. POST /api/payment/tokenizer → generate Snap token
11. (Midtrans callback)     → webhook update status LUNAS
12. GET  /api/billing/summary    → cek dashboard
13. GET  /api/billing/outstanding → cek outstanding
```

---

### Task 10: Deploy ⏱️ 15 menit

- Build production: `npm run build`
- Pastikan environment variables lengkap
- Deploy ke hosting (Render / Railway / VPS)
- Test Swagger UI live: `https://<domain>/api/docs`
- Test health check: `GET /api`

---

## Explicitly NOT in This Deploy

| Item | Alasan | Kapan |
|------|--------|-------|
| Split Bill | Butuh redesign billing schema (multi-payment per invoice) | Sprint berikutnya |
| RME Integration | Menunggu klarifikasi billing ownership | Setelah deploy + diskusi tim |
| WMS Pharmacy Integration | Menunggu `x-api-key` dari tim WMS | Setelah deploy + key diterima |
| WhatsApp Integration | Dependency ke Meta API setup | Sprint berikutnya |
| BPJS & FORNAS Sync | Dependency ke RME integration dulu | Sprint berikutnya |
| AI Dashboard | Scope tim AI Engineer | Paralel, bukan blocker POS |

---

## Checklist Pre-Deploy

- [ ] Enum `Role` di Prisma sudah include `FINANCE_STAFF`
- [ ] Register endpoint support role opsional
- [ ] Patient CRUD 4 endpoint berfungsi
- [ ] Seed data: 4 user, 5 item, 3 pasien
- [ ] GET /api/billing list + filter berfungsi
- [ ] GET /api/billing/outstanding berfungsi
- [ ] GET /api/billing/summary berfungsi
- [ ] Endpoint accounting disembunyikan dari Swagger
- [ ] Swagger metadata rapi dan deskriptif
- [ ] Full flow manual test passed
- [ ] Build production sukses tanpa error
- [ ] Environment variables lengkap di hosting
- [ ] Swagger UI accessible di URL publik
