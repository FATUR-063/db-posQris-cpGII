# Inventory/Farmasi Pharmacy Charge API untuk POS

Dokumen ini menjelaskan API milik Inventory/Farmasi yang disediakan untuk dipanggil oleh tim POS dan Payment dalam proses tagihan tebus obat.

Catatan penting:

- Inventory/Farmasi adalah penyedia API.
- POS adalah client yang memanggil API Inventory/Farmasi.
- POS tidak perlu menyediakan API untuk kebutuhan hitung tagihan obat ini.
- `POS_API_KEY` adalah shared secret yang kita berikan ke tim POS agar hanya POS yang boleh memanggil endpoint ini.

Base URL:

```text
https://<inventory-backend>/api/v1
```

Swagger:

```text
https://<inventory-backend>/docs
```

## Quick Test untuk POS

Untuk cek paling sederhana di Swagger, POS cukup mencoba endpoint daftar order:

```http
GET /pharmacy/orders
```

Isi header:

```text
x-api-key: <shared-secret-yang-diberikan-ke-pos>
```

Kosongkan semua query (`page`, `limit`, `prescriptionId`, `rekamMedisId`, `status`, `paymentStatus`), lalu klik Execute. Response akan berisi daftar charge/order obat yang sudah dibuat, default 20 data terbaru.

Kalau ingin membuat order baru untuk tes, body minimalnya cukup item obat:

```http
POST /pharmacy/orders
```

```json
{
  "items": [
    {
      "kodeObat": "OBT-001",
      "qty": 1
    }
  ]
}
```

Field lain seperti `prescriptionId`, `rekamMedisId`, `patientName`, `posTransactionId`, dan `notes` bersifat opsional untuk tracking.

## Auth

Endpoint integrasi POS diamankan memakai API key service-to-service dari Inventory/Farmasi.

Header wajib:

```text
x-api-key: <shared-secret-yang-diberikan-ke-pos>
```

Environment backend inventory:

```text
POS_API_KEY=<shared-secret-dengan-tim-pos>
```

Nama environment `POS_API_KEY` berarti "API key untuk client POS", bukan API milik POS. Nilai ini disimpan di backend Inventory/Farmasi, lalu nilai yang sama diberikan ke tim POS untuk dikirim lewat header `x-api-key`.

Khusus endpoint dispense memakai JWT apoteker, bukan API key POS, karena stok keluar harus punya audit user apoteker.

## Ringkasan Alur

1. POS atau RME menentukan resep dan item obat yang akan ditebus.
2. POS memanggil API Inventory/Farmasi `POST /pharmacy/quote` untuk menghitung harga obat dan cek stok.
3. POS memanggil API Inventory/Farmasi `POST /pharmacy/orders` untuk membuat charge obat.
4. POS mengambil `totalObat` dari response Inventory/Farmasi, lalu menggabungkannya dengan billing konsultasi/tindakan dari RME.
5. Payment memproses pembayaran dari bill POS.
6. POS/Payment mengirim callback ke API Inventory/Farmasi `PATCH /pharmacy/orders/:id/payment-status`.
7. Setelah paid, apoteker memanggil `POST /pharmacy/orders/:id/dispense` untuk menyerahkan obat dan mengurangi stok.

Inventory/Farmasi menghitung total obat. POS menghitung total bill pasien. Payment hanya memproses pembayaran dan mengirim status bayar.

## Endpoint

### 1. Ambil Daftar Charge/Order Obat

```http
GET /pharmacy/orders
```

Fungsi:

- Cara paling sederhana untuk POS mengecek data order obat.
- Cukup isi header `x-api-key`; request body tidak diperlukan.
- Jika query dikosongkan, API mengembalikan 20 order terbaru.

Query opsional:

```text
page=1
limit=20
prescriptionId=RX-0092
rekamMedisId=RM-2026-0001
status=pending_payment|ready_to_dispense|dispensed|cancelled
paymentStatus=unpaid|paid|cancelled|refunded
```

### 2. Quote Harga Obat

```http
POST /pharmacy/quote
```

Fungsi:

- Dipanggil POS ke Inventory/Farmasi untuk menghitung harga tebus obat dari `obat.hargaJual`.
- Mengecek stok cukup atau tidak.
- Tidak membuat order.
- Tidak mengurangi stok.

Request:

```json
{
  "items": [
    {
      "kodeObat": "OBT-001",
      "qty": 1
    }
  ]
}
```

Response:

```json
{
  "prescriptionId": "RX-0092",
  "rekamMedisId": "RM-2026-0001",
  "patientId": "PAT-001",
  "patientName": "Budi Santoso",
  "items": [
    {
      "obatId": "uuid",
      "kodeObat": "OBT-001",
      "namaObat": "Amoxicillin 500mg",
      "satuan": "Tablet",
      "qty": 10,
      "hargaJual": 2000,
      "subtotal": 20000,
      "stokSaatIni": 120,
      "stokCukup": true
    }
  ],
  "totalObat": 20000,
  "currency": "IDR",
  "canFulfill": true,
  "generatedAt": "2026-06-02T10:30:00.000Z"
}
```

### 3. Buat Charge/Order Obat

```http
POST /pharmacy/orders
```

Header opsional untuk retry aman:

```text
x-idempotency-key: rx-0092-v1
```

Fungsi:

- Dipanggil POS ke Inventory/Farmasi untuk membuat order/charge obat.
- Membuat order obat yang bisa diambil ulang oleh POS.
- Menyimpan snapshot harga jual, qty, dan stok saat order dibuat.
- Status awal: `pending_payment` dan `unpaid`.
- Tidak mengurangi stok.

Request:

```json
{
  "items": [
    {
      "kodeObat": "OBT-001",
      "qty": 1
    }
  ]
}
```

Response utama:

```json
{
  "id": "uuid",
  "orderNo": "PHR-2026-0001",
  "prescriptionId": "RX-0092",
  "rekamMedisId": "RM-2026-0001",
  "posTransactionId": "POS-TRX-20260602-0001",
  "status": "pending_payment",
  "paymentStatus": "unpaid",
  "totalObat": "20000.00",
  "currency": "IDR",
  "items": [
    {
      "kodeObat": "OBT-001",
      "namaObat": "Amoxicillin 500mg",
      "qty": 10,
      "hargaJual": "2000.00",
      "subtotal": "20000.00",
      "stokSaatOrder": 120
    }
  ]
}
```

Catatan:

- Jika `x-idempotency-key` atau `posTransactionId` yang sama dikirim ulang, API mengembalikan order yang sudah ada.
- Jika stok tidak cukup, API menolak pembuatan order dengan HTTP 400.

### 4. Ambil Charge Berdasarkan Resep

```http
GET /pharmacy/orders/by-prescription/:prescriptionId
```

Dipanggil POS untuk mengambil tagihan obat dari ID resep RME.

### 5. Ambil Charge Berdasarkan Rekam Medis

```http
GET /pharmacy/orders/by-rm/:rekamMedisId
```

Dipanggil POS untuk mengambil semua tagihan obat pada satu konsultasi/rekam medis.

### 6. Detail Order

```http
GET /pharmacy/orders/:id
```

### 7. Callback Status Pembayaran

```http
PATCH /pharmacy/orders/:id/payment-status
```

Fungsi:

- Dipanggil POS/Payment untuk memberi tahu Inventory/Farmasi bahwa charge obat sudah dibayar, dibatalkan, atau refund.
- Jika status menjadi `paid`, order berubah menjadi `ready_to_dispense`.

Request paid:

```json
{
  "paymentStatus": "paid",
  "paymentReference": "PAY-20260602-0001",
  "posTransactionId": "POS-TRX-20260602-0001",
  "paidAt": "2026-06-02T10:30:00.000Z",
  "notes": "Dibayar tunai di kasir"
}
```

Request cancel:

```json
{
  "paymentStatus": "cancelled",
  "notes": "Pasien batal membayar"
}
```

Status payment:

```text
unpaid
paid
cancelled
refunded
```

Status order:

```text
pending_payment
ready_to_dispense
dispensed
cancelled
```

### 8. Cancel Order Sebelum Dispense

```http
POST /pharmacy/orders/:id/cancel
```

Request:

```json
{
  "reason": "Pasien batal menebus obat"
}
```

Catatan:

- Hanya bisa dilakukan sebelum `dispensed`.
- Jika sudah `dispensed`, lakukan retur/koreksi stok melalui proses farmasi, bukan cancel order.

### 9. Dispense Obat

```http
POST /pharmacy/orders/:id/dispense
```

Auth:

```text
Authorization: Bearer <JWT apoteker>
```

Fungsi:

- Hanya bisa dipanggil setelah `paymentStatus = paid`.
- Membuat transaksi `stok-keluar`.
- Mengurangi stok otomatis dengan FEFO.
- Menyimpan `stokKeluarIds` di order.

Endpoint ini sebaiknya dipakai oleh UI farmasi/apoteker, bukan POS.

## Tanggung Jawab Sistem

Inventory/Farmasi:

- Menentukan harga obat dari `hargaJual`.
- Menghitung `subtotal` dan `totalObat`.
- Mengecek stok cukup.
- Mengurangi stok saat obat diserahkan.

POS:

- Mengambil `totalObat` dari Inventory.
- Menggabungkan obat dengan billing RME, tindakan, dan biaya lain.
- Membuat total akhir pasien.

Payment:

- Memproses pembayaran.
- Mengirim callback status pembayaran ke Inventory melalui POS atau service payment.

## Error Penting

`401 Unauthorized`:

- API key tidak dikirim atau tidak valid.

`400 Bad Request`:

- Item tidak punya `obatId` atau `kodeObat`.
- Stok tidak cukup saat membuat order.
- Order belum paid saat dispense.
- Order sudah dispensed tetapi dicancel.

`404 Not Found`:

- Obat atau order tidak ditemukan.

`503 Service Unavailable`:

- `POS_API_KEY` belum dikonfigurasi di backend inventory.
