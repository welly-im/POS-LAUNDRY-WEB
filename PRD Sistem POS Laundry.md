# PRD: Sistem POS Laundry

**Versi:** 1.0 (MVP) · **Stack:** Astro, aiven (Postgres), Auth, Drizzle ORM · **Platform:** PWA (Android/tablet/laptop, Chrome/Edge)

---

## 1. Ringkasan & Tujuan

Sistem kasir (POS) untuk usaha laundry satu outlet dengan volume 10-20 order/hari dan 1-2 kasir. Fokus MVP: input order cepat (kiloan dan satuan), identifikasi pelanggan agar cucian tidak tertukar, pembayaran bertermin (DP/lunas), pelacakan status, cetak struk thermal, dan rekap kas harian yang memisahkan uang riil dari piutang.

**Tujuan terukur**

- Kasir menyelesaikan input satu order dalam \< 60 detik.
- Selisih kas saat closing terdeteksi otomatis pada 100% shift.
- Owner dapat melihat total piutang dan omzet harian kapan saja tanpa rekap manual.
- Arsitektur data siap multi-tenant (kolom `outlet_id`/`tenant_id`) agar kelak bisa dijual sebagai SaaS, walaupun MVP hanya melayani satu outlet.

**Di luar scope MVP (non-goals)** Mode offline, notifikasi WhatsApp otomatis (API berbayar), integrasi payment gateway/QRIS dinamis, antar-jemput, loyalty/poin, manajemen stok bahan, multi-cabang aktif, aplikasi iOS native.

---

## 2. Persona & Hak Akses

| Persona | Deskripsi |
| --- | --- |
| **Owner** | Pemilik usaha. Mengelola master data, melihat semua laporan, membatalkan order, mengelola akun kasir. |
| **Kasir** | Operator harian. Membuka/menutup shift, input order, menerima pembayaran, mengubah status, mencetak struk. |

| Fitur | Kasir | Owner |
| --- | --- | --- |
| Input order, pelanggan, pembayaran | ✅ | ✅ |
| Ubah status order | ✅ | ✅ |
| Cetak ulang struk / kirim WA | ✅ | ✅ |
| Buka & tutup shift sendiri | ✅ | ✅ |
| Batalkan order (wajib alasan) | Hanya status *Diterima* dan shift yang sama | Semua order yang belum *Sudah Diambil* |
| Kelola kategori, layanan, promo | ❌ | ✅ |
| Kelola akun kasir, profil usaha, template struk | ❌ | ✅ |
| Laporan harian, bulanan, piutang, per kasir | Rekap shift sendiri | Semua |
| Ekspor CSV | ❌ | ✅ |

---

## 3. Alur Utama

1. **Buka shift:** kasir memasukkan kas awal.
2. **Order baru:** pilih/buat pelanggan, tambah item (kiloan/satuan), terapkan promo/diskon, tentukan estimasi selesai, catat pembayaran (opsional), simpan, lalu cetak struk atau kirim WA.
3. **Proses:** operator mengubah status Diterima → Diproses → Selesai.
4. **Pengambilan:** pelanggan datang, kasir menerima pelunasan jika masih ada sisa tagihan, lalu status menjadi *Sudah Diambil*.
5. **Tutup shift:** kasir menghitung uang fisik di laci, sistem menampilkan uang yang seharusnya ada, selisih, rincian tunai vs QRIS, dan piutang berjalan.

---

## 4. Kebutuhan Fungsional

### 4.1 Manajemen Pesanan Multidimensi

- **FR-ORD-01** Satu order bisa berisi banyak item campuran. Setiap item merujuk ke satu layanan dengan tipe unit `kg` atau `pcs`.
- **FR-ORD-02** Item `kg` menerima input desimal (contoh 2,5 atau 3,25) dengan 2 digit di belakang koma, minimum 0,01. Item `pcs` hanya menerima bilangan bulat ≥ 1.
- **FR-ORD-03** Subtotal item = kuantitas × harga satuan **snapshot** saat order dibuat (perubahan harga master tidak mengubah order lama). Nama layanan juga di-snapshot.
- **FR-ORD-04** Setiap item boleh memiliki catatan (contoh: "sepatu putih, noda di sisi kiri", "tas ada resleting rusak").
- **FR-ORD-05** Estimasi selesai otomatis = waktu order + durasi layanan terpanjang di order. Kasir bisa mengubahnya manual.
- **FR-ORD-06** Order berisi satu atau lebih item; total dihitung ulang otomatis saat item/diskon berubah. Order hanya boleh diedit item-nya selama status *Diterima* (setelah itu terkunci; koreksi lewat pembatalan atau diskon oleh owner).
- **FR-ORD-07** Nomor invoice unik dan berurutan per outlet dengan format `LDR-YYMMDD-NNNN` (reset urutan per hari).

**Acceptance criteria:** input 2,75 kg + 1 pasang sepatu menghasilkan 2 baris item dengan subtotal benar; input desimal pada item `pcs` ditolak dengan pesan jelas.

### 4.2 Identifikasi Pelanggan (Basic CRM)

- **FR-CUS-01** Data pelanggan: nama (wajib) dan nomor telepon/WhatsApp (wajib). Nomor dinormalisasi ke format `62xxxxxxxxxx`.
- **FR-CUS-02** Pencarian pelanggan saat order berdasarkan nama atau nomor; jika tidak ada, kasir membuat pelanggan baru inline tanpa meninggalkan layar order.
- **FR-CUS-03** Setiap order wajib terikat satu pelanggan dan satu nomor invoice. Invoice dan nama pelanggan tercetak jelas di struk dan tag.
- **FR-CUS-04** Riwayat order per pelanggan dapat dilihat (daftar invoice, total, status).
- **FR-CUS-05** Nomor telepon unik per outlet (deteksi duplikat, tawarkan memakai pelanggan yang sudah ada).

### 4.3 Pembayaran Fleksibel (Termin)

- **FR-PAY-01** Status pembayaran **dihitung otomatis**, bukan diinput:
  - *Belum Bayar*: total terbayar = 0
  - *DP*: 0 \< total terbayar \< total tagihan
  - *Lunas*: total terbayar ≥ total tagihan
- **FR-PAY-02** Pembayaran dicatat sebagai transaksi terpisah (jumlah, metode, waktu, kasir, shift, catatan/referensi opsional). Dalam MVP hanya dua jenis: **DP** dan **Pelunasan**; jumlah pelunasan harus sama dengan sisa tagihan.
- **FR-PAY-03** Metode: **Tunai** atau **QRIS (manual)**. Untuk QRIS, kasir menandai metode dan boleh mengisi catatan referensi; tidak ada verifikasi otomatis.
- **FR-PAY-04** Kembalian dihitung untuk pembayaran tunai (input uang diterima → tampil kembalian). Hanya jumlah tagihan yang tercatat sebagai pemasukan.
- **FR-PAY-05** Order dengan sisa tagihan tidak bisa berstatus *Sudah Diambil* sebelum dilunasi, kecuali owner mengizinkan override dengan catatan.
- **FR-PAY-06** Diskon: (a) **promo** dari master (persen atau nominal, periode aktif, minimum belanja opsional), dan (b) **diskon manual** per order (persen/nominal) dengan alasan wajib. Diskon manual di atas ambang tertentu (default 20%) memerlukan akun owner.
- **FR-PAY-07** Pembatalan dijelaskan di 4.4.

### 4.4 Pembatalan Order

- **FR-CAN-01** Pembatalan wajib mencantumkan alasan (teks minimal 5 karakter). Order tidak dihapus; status menjadi *Dibatalkan* dan tercatat siapa/kapan/mengapa.
- **FR-CAN-02** Jika sudah ada pembayaran (DP), sistem mewajibkan keputusan: **dikembalikan** (dicatat sebagai transaksi refund pada shift berjalan, mengurangi kas sesuai metodenya) atau **tidak dikembalikan** (dicatat sebagai pendapatan pembatalan, dengan catatan).
- **FR-CAN-03** Order dibatalkan dikeluarkan dari omzet dan piutang, tetapi tetap tampil di laporan pembatalan.
- **FR-CAN-04** Order berstatus *Sudah Diambil* tidak dapat dibatalkan.

### 4.5 Pelacakan Status Linear

- **FR-TRK-01** Status baku berurutan: **Diterima ➔ Diproses ➔ Selesai (Siap Diambil) ➔ Sudah Diambil**. Perubahan dilakukan manual oleh kasir/owner.
- **FR-TRK-02** Hanya maju satu langkah. Mundur satu langkah diperbolehkan untuk koreksi salah klik, dengan konfirmasi dan tercatat di log.
- **FR-TRK-03** Setiap perubahan status tercatat (status lama, baru, user, waktu) di `order_status_logs`.
- **FR-TRK-04** Daftar order dapat difilter per status, pembayaran, dan tanggal; order lewat estimasi selesai diberi penanda visual.
- **FR-TRK-05** Saat status menjadi *Selesai*, UI menawarkan tombol "Kabari via WhatsApp" yang membuka `wa.me` dengan pesan siap kirim (manual).

### 4.6 Generator Struk

- **FR-RCP-01** Cetak ke printer thermal Bluetooth **58 mm** berstandar ESC/POS (Web Bluetooth). Isi: nama & alamat usaha, invoice, tanggal, kasir, pelanggan, daftar item (kuantitas + unit), diskon, total, terbayar, sisa, status pembayaran, estimasi selesai, catatan kaki.
- **FR-RCP-02** **Tag nomor invoice**: cetak potongan kecil berisi invoice, nama pelanggan, dan jumlah item untuk ditempel pada cucian (opsional per order).
- **FR-RCP-03** Bagikan ke WhatsApp: (a) teks rincian tagihan lewat tautan `https://wa.me/<nomor>?text=...`, (b) PDF lewat Web Share API (di perangkat yang mendukung) atau unduh PDF lalu lampirkan manual.
- **FR-RCP-04** Cetak ulang struk dari detail order (ditandai "SALINAN").
- **FR-RCP-05** Fallback jika Bluetooth tidak tersedia (mis. iOS Safari): `window.print()` dan opsi PDF.
- **FR-RCP-06** Owner dapat mengatur header/footer struk (nama usaha, alamat, telepon, catatan kaki).

### 4.7 Rekapitulasi Kas Harian (Shift Closing)

- **FR-SHF-01** Kasir membuka shift dengan **kas awal**. Hanya satu shift terbuka per kasir; pembayaran selalu terikat ke shift yang sedang terbuka.
- **FR-SHF-02** Saat tutup shift, sistem menampilkan:
  - Kas awal
  - - Pembayaran **tunai** masuk (DP + pelunasan)
  - − Refund tunai
  - = **Kas seharusnya di laci**
  - Pembayaran **QRIS** (terpisah, tidak masuk laci)
  - Total pendapatan riil (tunai + QRIS)
  - **Piutang** (total sisa tagihan order aktif belum lunas, per tanggal tutup)
- **FR-SHF-03** Kasir memasukkan **uang fisik** hasil hitung; sistem menghitung **selisih** (fisik − seharusnya) dan mewajibkan catatan bila selisih ≠ 0.
- **FR-SHF-04** Shift yang sudah ditutup bersifat read-only; koreksi hanya lewat owner dengan catatan (audit log).
- **FR-SHF-05** Rekap dapat dicetak (struk 58 mm) dan dibagikan sebagai PDF untuk serah terima shift.
- **FR-SHF-06** Pembayaran pelunasan atas order lama masuk ke shift saat uang diterima (bukan shift saat order dibuat); ini menjaga akurasi kas.

### 4.8 Laporan (Owner)

- **FR-RPT-01** Rekap harian: omzet (nilai order dibuat), pendapatan riil (tunai vs QRIS), jumlah order, piutang baru.
- **FR-RPT-02** Laporan bulanan sederhana: total omzet, pendapatan riil, tunai vs QRIS, jumlah order, rata-rata per order, pembatalan, ringkasan per layanan dan per kasir.
- **FR-RPT-03** Daftar piutang: invoice, pelanggan, telepon, total, terbayar, sisa, umur piutang (hari); tombol "Tagih via WhatsApp" (`wa.me`).
- **FR-RPT-04** Ekspor CSV untuk laporan harian/bulanan/piutang.
- **FR-RPT-05** Filter rentang tanggal dan kasir; laporan menggunakan zona waktu **Asia/Jakarta** (atau sesuai pengaturan outlet).

### 4.9 Master Data (Owner)

- **FR-MST-01** **Kategori layanan** (contoh: Kiloan, Sepatu, Tas, Bedcover) dibuat sendiri oleh owner.
- **FR-MST-02** **Layanan**: nama, kategori, tipe unit (`kg`/`pcs`), harga per unit (rupiah, integer), durasi pengerjaan (jam), status aktif/nonaktif. Layanan tidak dihapus jika pernah dipakai; hanya dinonaktifkan.
- **FR-MST-03** **Promo**: nama, tipe (persen/nominal), nilai, periode mulai-selesai, minimum belanja, status aktif.
- **FR-MST-04** **Akun**: owner membuat/menonaktifkan akun kasir (email + password awal atau undangan).

---

## 5. Aturan Bisnis Penting

1. Semua nilai uang disimpan sebagai **integer rupiah** (tanpa desimal).
2. Berat disimpan `numeric(8,2)`; kuantitas pcs `integer`. Subtotal dihitung dengan pembulatan ke rupiah terdekat.
3. Total order = Σ subtotal item − diskon promo − diskon manual (tidak boleh \< 0).
4. Sisa tagihan = total − Σ pembayaran bersih (pembayaran − refund).
5. Piutang hanya mencakup order aktif (tidak *Dibatalkan*) dengan sisa > 0, termasuk yang sudah *Selesai* tapi belum diambil.
6. Data transaksi tidak pernah dihapus (soft state); semua perubahan penting dicatat di audit log.

---

## 6. Model Data (Drizzle, Postgres)

Skema ringkas; semua tabel memiliki `id uuid pk`, `outlet_id`, `created_at`, `updated_at`.

```ts
// db/schema.ts (sketsa)
import { pgTable, uuid, text, integer, numeric, boolean, timestamp, pgEnum, uniqueIndex, index } from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("role", ["owner", "kasir"]);
export const unitEnum = pgEnum("unit_type", ["kg", "pcs"]);
export const orderStatusEnum = pgEnum("order_status", ["diterima", "diproses", "selesai", "sudah_diambil", "dibatalkan"]);
export const payKindEnum = pgEnum("payment_kind", ["dp", "pelunasan", "refund"]);
export const payMethodEnum = pgEnum("payment_method", ["tunai", "qris"]);
export const discountTypeEnum = pgEnum("discount_type", ["persen", "nominal"]);

export const outlets = pgTable("outlets", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(), address: text("address"), phone: text("phone"),
  receiptFooter: text("receipt_footer"), timezone: text("timezone").notNull().default("Asia/Jakarta"),
});

export const profiles = pgTable("profiles", {           // 1:1 dengan auth.users
  id: uuid("id").primaryKey(),                           // = auth.users.id
  outletId: uuid("outlet_id").notNull().references(() => outlets.id),
  fullName: text("full_name").notNull(),
  role: roleEnum("role").notNull(), isActive: boolean("is_active").notNull().default(true),
});

export const customers = pgTable("customers", {
  id: uuid("id").primaryKey().defaultRandom(),
  outletId: uuid("outlet_id").notNull(),
  name: text("name").notNull(), phone: text("phone").notNull(),
}, (t) => [uniqueIndex("customers_outlet_phone_uq").on(t.outletId, t.phone)]);

export const serviceCategories = pgTable("service_categories", {
  id: uuid("id").primaryKey().defaultRandom(), outletId: uuid("outlet_id").notNull(),
  name: text("name").notNull(), isActive: boolean("is_active").notNull().default(true),
});

export const services = pgTable("services", {
  id: uuid("id").primaryKey().defaultRandom(), outletId: uuid("outlet_id").notNull(),
  categoryId: uuid("category_id").notNull().references(() => serviceCategories.id),
  name: text("name").notNull(), unitType: unitEnum("unit_type").notNull(),
  price: integer("price").notNull(), durationHours: integer("duration_hours").notNull(),
  isActive: boolean("is_active").notNull().default(true),
});

export const promos = pgTable("promos", {
  id: uuid("id").primaryKey().defaultRandom(), outletId: uuid("outlet_id").notNull(),
  name: text("name").notNull(), type: discountTypeEnum("type").notNull(), value: integer("value").notNull(),
  minSpend: integer("min_spend").default(0), startsAt: timestamp("starts_at"), endsAt: timestamp("ends_at"),
  isActive: boolean("is_active").notNull().default(true),
});

export const shifts = pgTable("shifts", {
  id: uuid("id").primaryKey().defaultRandom(), outletId: uuid("outlet_id").notNull(),
  cashierId: uuid("cashier_id").notNull().references(() => profiles.id),
  openedAt: timestamp("opened_at").notNull().defaultNow(), openingCash: integer("opening_cash").notNull(),
  closedAt: timestamp("closed_at"), countedCash: integer("counted_cash"), expectedCash: integer("expected_cash"),
  cashDifference: integer("cash_difference"), closingNote: text("closing_note"),
});

export const orders = pgTable("orders", {
  id: uuid("id").primaryKey().defaultRandom(), outletId: uuid("outlet_id").notNull(),
  invoiceNo: text("invoice_no").notNull(), customerId: uuid("customer_id").notNull().references(() => customers.id),
  status: orderStatusEnum("status").notNull().default("diterima"),
  subtotal: integer("subtotal").notNull(), promoId: uuid("promo_id"), promoDiscount: integer("promo_discount").notNull().default(0),
  manualDiscount: integer("manual_discount").notNull().default(0), manualDiscountReason: text("manual_discount_reason"),
  total: integer("total").notNull(), paidAmount: integer("paid_amount").notNull().default(0), // denormalisasi, dijaga via transaksi
  estimatedDoneAt: timestamp("estimated_done_at"), note: text("note"),
  createdBy: uuid("created_by").notNull(), cancelledAt: timestamp("cancelled_at"), cancelledBy: uuid("cancelled_by"),
  cancelReason: text("cancel_reason"), pickedUpAt: timestamp("picked_up_at"),
}, (t) => [uniqueIndex("orders_outlet_invoice_uq").on(t.outletId, t.invoiceNo), index("orders_status_idx").on(t.outletId, t.status)]);

export const orderItems = pgTable("order_items", {
  id: uuid("id").primaryKey().defaultRandom(), orderId: uuid("order_id").notNull().references(() => orders.id),
  serviceId: uuid("service_id").notNull(), serviceName: text("service_name").notNull(),      // snapshot
  unitType: unitEnum("unit_type").notNull(), unitPrice: integer("unit_price").notNull(),     // snapshot
  quantity: numeric("quantity", { precision: 8, scale: 2 }).notNull(), subtotal: integer("subtotal").notNull(), note: text("note"),
});

export const payments = pgTable("payments", {
  id: uuid("id").primaryKey().defaultRandom(), orderId: uuid("order_id").notNull().references(() => orders.id),
  shiftId: uuid("shift_id").notNull().references(() => shifts.id),
  kind: payKindEnum("kind").notNull(), method: payMethodEnum("method").notNull(),
  amount: integer("amount").notNull(), reference: text("reference"), note: text("note"),
  createdBy: uuid("created_by").notNull(), createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const orderStatusLogs = pgTable("order_status_logs", {
  id: uuid("id").primaryKey().defaultRandom(), orderId: uuid("order_id").notNull(),
  fromStatus: orderStatusEnum("from_status"), toStatus: orderStatusEnum("to_status").notNull(),
  changedBy: uuid("changed_by").notNull(), changedAt: timestamp("changed_at").notNull().defaultNow(),
});

export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(), outletId: uuid("outlet_id").notNull(),
  actorId: uuid("actor_id").notNull(), action: text("action").notNull(),
  entity: text("entity").notNull(), entityId: uuid("entity_id"), detail: text("detail"), createdAt: timestamp("created_at").notNull().defaultNow(),
});
```

**Catatan:** nomor invoice dibuat di dalam transaksi database dengan tabel counter harian (`invoice_counters(outlet_id, date, last_seq)`) atau sequence, agar tidak ada duplikasi saat dua kasir menyimpan bersamaan.

---

## 7. Arsitektur & Catatan Teknis

- **Astro** dalam mode SSR (adapter Node/Vercel/Cloudflare sesuai hosting), halaman interaktif dengan *islands* (React atau Svelte) untuk form order, keranjang item, dan cetak. Aplikasi dipasang sebagai **PWA** (manifest + service worker untuk cache aset; tanpa fitur offline data di MVP).
- **Drizzle** dengan `postgres-js`, terhubung lewat connection pooler aiven (mode transaction). Migrasi dikelola `drizzle-kit`.
- **Otorisasi:** koneksi Drizzle server-side biasanya memakai role yang melewati RLS, sehingga **aturan role wajib ditegakkan di lapisan server** (guard per endpoint/action: `requireRole('owner')`, dsb.). Tetap aktifkan **RLS** pada semua tabel (filter `outlet_id`, tolak akses langsung dari klien/anon key) sebagai lapis pertahanan kedua dan agar siap multi-tenant.
- **Cetak ESC/POS:** pustaka encoder ESC/POS (mis. `esc-pos-encoder`) + Web Bluetooth ke printer BLE. Perlu HTTPS, interaksi pengguna untuk pairing, dan hanya didukung Chrome/Edge (Android & desktop). Printer thermal yang hanya mendukung Bluetooth Classic (SPP) mungkin tidak terdeteksi Web Bluetooth; ini harus diuji dengan model printer yang akan dipakai sebelum pengembangan modul cetak.
- **Transaksi atomik:** pembuatan order (+ item + pembayaran awal + log) dan penutupan shift dijalankan dalam satu transaksi database.
- **Audit & keamanan:** password hashing, rate limit login, audit log untuk pembatalan, override, koreksi shift, perubahan harga.
- **Zona waktu:** simpan `timestamptz` (UTC), tampilkan sesuai zona outlet.

---

## 8. Kebutuhan Non-Fungsional

| Aspek | Target |
| --- | --- |
| Performa | Halaman order termuat \< 2 detik pada 4G; simpan order \< 1 detik |
| Ketersediaan | Online-only; tampilkan status koneksi jelas dan cegah kehilangan data form saat koneksi putus (pertahankan draft di memori/session) |
| Kompatibilitas | Chrome/Edge terbaru di Android, tablet, dan laptop; layar ≥ 360 px |
| Keamanan | HTTPS, RLS aktif |
| Usability | Tombol besar untuk layar sentuh, input angka memakai keypad numerik, bahasa Indonesia |
| Auditability | Semua perubahan status, pembayaran, pembatalan, dan koreksi shift dapat ditelusuri |

---

## 9. Metrik Keberhasilan

- Waktu rata-rata input order ≤ 60 detik.
- Selisih kas harian \< Rp 5.000 pada 90% shift setelah 1 bulan pemakaian.
- 0 insiden cucian tertukar akibat identifikasi (invoice dan tag terpasang).
- Owner tidak lagi melakukan rekap piutang manual.

---

## 10. Roadmap

| Fase | Cakupan |
| --- | --- |
| **M0 – Fondasi (1 minggu)** | Setup Astro + aiven + Drizzle, auth & role, skema database, uji printer Bluetooth (spike teknis) |
| **M1 – Inti transaksi (2 minggu)** | Master data, pelanggan, order kiloan/satuan, pembayaran DP/lunas, status tracking |
| **M2 – Struk & kas (1-2 minggu)** | Cetak ESC/POS 58 mm, tag invoice, share WhatsApp, shift opening/closing, pembatalan |
| **M3 – Laporan & rilis (1 minggu)** | Laporan harian/bulanan/piutang, ekspor CSV, PWA, UAT bersama kasir, rilis |
| **Pasca-MVP** | Mode offline, notifikasi WhatsApp otomatis, multi-cabang, QRIS dinamis, loyalty |

---

## 11. Risiko & Pertanyaan Terbuka

| # | Risiko / Pertanyaan | Mitigasi / Default sementara |
| --- | --- | --- |
| 1 | Printer thermal yang dipakai mungkin tidak kompatibel dengan Web Bluetooth (BLE vs Classic) | Uji model printer di M0; siapkan fallback cetak lewat PDF/`window.print()` |
| 2 | iOS Safari tidak mendukung Web Bluetooth | Targetkan Android/Chrome; iOS hanya PDF/share |
| 3 | Siapa yang boleh membatalkan order | Default: kasir hanya order *Diterima* di shift yang sama, owner semua. **Mohon konfirmasi.** |
| 4 | Perlakuan DP pada order yang dibatalkan | Default: kasir wajib memilih dikembalikan atau tidak; bisa disederhanakan jika tidak diperlukan |
| 5 | Pengaturan ambang diskon manual yang butuh persetujuan owner | Default 20%, bisa diubah owner |
| 6 | Apakah omzet dihitung per tanggal order dibuat atau per tanggal uang masuk | Default: laporan menampilkan **keduanya** (omzet = tanggal order; pendapatan riil = tanggal pembayaran) |
| 7 | Kebutuhan multi-tenant SaaS di masa depan | Skema sudah memiliki `outlet_id`; pendaftaran tenant, billing, dan isolasi lanjutan di luar MVP |