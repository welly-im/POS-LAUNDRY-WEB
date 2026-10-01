# POS Laundry Web - Sistem Kasir & Manajemen Laundry

Aplikasi Point of Sale (POS) modern, cepat, dan responsif untuk usaha laundry, dibangun sesuai dengan spesifikasi PRD.

---

## 🚀 Tech Stack

- **Framework & SSR**: Astro v5 SSR (`@astrojs/node` standalone)
- **Interactive UI Islands**: React 19 + Tailwind CSS v4 + Lucide Icons
- **Database & ORM**: PostgreSQL (Aiven Cloud) + Drizzle ORM + Drizzle Kit
- **Autentikasi**: Session-based database auth dengan HTTP-Only Cookies & `bcryptjs`
- **Platform**: PWA (Progressive Web App) dengan manifest & service worker
- **Struk & Tag**: 58mm ESC/POS Thermal Layout via Browser Print (`window.print()`), WhatsApp Direct Share (`wa.me`)

---

## 🔑 Akun Bawaan (Default Seed Credentials)

| Peran (Role) | Username / Email | Password | PIN Otorisasi |
| :--- | :--- | :--- | :--- |
| **Owner (Pemilik)** | `admin` | `123456` | `1234` |
| **Kasir** | `kasir` | `123456` | `0000` |

> 💡 *Catatan: Data outlet, nama usaha, akun, password, dan PIN otorisasi dapat diubah kapan saja melalui menu **Pengaturan Usaha** di dashboard Owner.*

---

## 📦 Fitur Utama Sesuai PRD

1. **Shift Kasir & Rekap Laci (Shift Closing)**
   - Buka shift dengan modal kas awal.
   - Perhitungan otomatis kas seharusnya di laci: `Kas Awal + Tunai Masuk - Refund Tunai`.
   - Deteksi selisih kas fisik laci vs sistem secara presisi. Wajib isi catatan jika ada selisih.
   - Pemisahan pembayaran Tunai vs QRIS (rekening bank) vs Piutang.
   - Cetak struk rekapitulasi shift 58mm untuk serah terima kasir.

2. **Kasir / POS & Order Cepat**
   - Input order \< 60 detik.
   - CRM Pelanggan inline: pencarian instan nama / nomor WhatsApp (normalisasi format `62...`) atau tambah pelanggan baru langsung tanpa meninggalkan layar kasir.
   - Item kiloan (`kg`) dengan desimal 2 digit (contoh: 2.75 kg) & preset timbangan cepat.
   - Item satuan (`pcs`) dengan bilangan bulat & catatan per item (contoh: noda di kerah, sepatu putih).
   - Snapshot harga dan nama layanan saat transaksi dibuat.
   - Estimasi selesai otomatis berdasarkan durasi pengerjaan layanan terpanjang.
   - Diskon promo master & diskon manual (jika > 20% otomatis mewajibkan otorisasi PIN Owner).
   - Pembayaran termin fleksibel: Belum Bayar, Uang Muka (DP), atau Lunas.
   - Hitung kembalian tunai otomatis dengan preset uang pecahan.
   - Format invoice atomik dan unik: `LDR-YYMMDD-NNNN`.

3. **Status Pelacakan & Pengambilan Cucian**
   - Alur status linear: `Diterima` ➔ `Diproses` ➔ `Selesai (Siap Diambil)` ➔ `Sudah Diambil`.
   - Fitur koreksi mundur 1 langkah dengan konfirmasi & audit log.
   - Tombol "Kabari via WhatsApp" saat cucian selesai yang langsung membuka pesan `wa.me`.
   - Validasi pengambilan: cucian belum lunas wajib diselesaikan sisa tagihannya sebelum berstatus `Sudah Diambil` (atau override Owner).

4. **Pembatalan Order & Refund**
   - Kasir hanya boleh membatalkan order status `Diterima` pada shift berjalan.
   - Owner dapat membatalkan order sebelum status `Sudah Diambil`.
   - Alasan pembatalan wajib minimal 5 karakter.
   - Pilihan keputusan DP: dikembalikan (dicatat refund di shift kasir) atau hangus (pendapatan pembatalan).

5. **Struk Thermal 58mm & Tag Label**
   - Layout thermal 58mm presisi tinggi.
   - Tag label cucian ringkas untuk disteples/ditempel ke kantong baju/sepatu.
   - Cetak ulang struk bertanda `SALINAN`.
   - Kirim rincian nota tagihan lengkap langsung ke WhatsApp pelanggan.

6. **Dashboard Owner & Laporan**
   - Executive metrics: Omzet hari ini, Pendapatan riil (Tunai vs QRIS), Total piutang aktif, Jumlah pesanan aktif.
   - Laporan Harian & Bulanan dengan performa per layanan dan per kasir.
   - Daftar Piutang lengkap dengan umur piutang (hari) dan tombol "Tagih via WhatsApp".
   - Ekspor laporan ke format CSV.
   - Master data: Kategori Layanan, Layanan, Promo, Akun Karyawan, dan Pengaturan Usaha.

---

## 🛠️ Menjalankan Aplikasi

### 1. Menjalankan Server Development
```bash
pnpm dev
```
Akses di browser: `http://localhost:4321`

### 2. Membangun & Menjalankan Production
```bash
pnpm build
node ./dist/server/entry.mjs
```

### 3. Database Migration & Seed
- Push skema Drizzle ke PostgreSQL:
  ```bash
  pnpm db:push
  ```
- Seed data awal (Outlet, User Owner/Kasir, Layanan, Promo, Pelanggan):
  ```bash
  pnpm db:seed
  ```
- Drizzle Studio (Database GUI Viewer):
  ```bash
  pnpm db:studio
  ```

---