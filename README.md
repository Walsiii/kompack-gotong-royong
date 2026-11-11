# Kompack! — Gotong Royong Acknowledgment

Kerja bakti jadi misi di peta lingkunganmu. Purwarupa hackathon tim **Batak Intelligence** (Case 2: Stronger Communities and Everyday Services).

| Mulai | Peta ringkas | Periksa bukti |
|---|---|---|
| ![](docs/ui-welcome.png) | ![](docs/ui-map.png) | ![](docs/ui-review.png) |

Tampilan bawaan hitam-putih dengan Public Sans; aksen Hutan/Senja bisa dipilih di **Aku → Pengaturan**. Screenshot peta di atas diambil saat server ubin terblokir oleh jaringan cloud, sehingga jalan belum terlihat. Aplikasi memakai data geografis OpenFreeMap/OpenStreetMap.

## Cara mencoba

**Windows lokal, sekali klik:** unduh [Kompack-Windows.zip](release/Kompack-Windows.zip), ekstrak, lalu klik **Install-Kompack.cmd**. Runtime Node dan setup HTTPS sudah disertakan. Paket memasang aplikasi ke G:\Hackathon\Kompack! dan membuka browser setelah server siap. [Panduan HP dan HTTPS](docs/LOCAL-WINDOWS.md).

| Platform | Cara |
|---|---|
| **Android** | Unduh artifact `kompack-apk` dari workflow Build terbaru, atau jalankan `npm run android:apk`. APK dalam `release/` adalah build sebelumnya. |
| **Web / PC** | Node ≥22.12; `npm ci` lalu `npm run dev` → buka http://localhost:5173 |
| **Desktop (Rust/Tauri)** | `npm run desktop:dev` atau `npm run desktop:build` (butuh Rust; di Linux juga `libwebkit2gtk-4.1-dev`) |

Di PC pilih **"Coba di PC (mode uji)"** saat pendaftaran: posisi dipindah dengan mengetuk peta, foto contoh boleh dipakai bila tak ada webcam, dan waktu tunggu bisa dilewati. Semua setoran mode uji ditandai untuk Ketua RT.

Untuk mencoba sisi Ketua RT: **Aku → Masuk sebagai Ketua RT** (akun demo Pak Hendra). Buka dua jendela browser untuk melihat warga dan RT berjalan bersamaan.

Kamera dan GPS browser butuh `localhost` atau HTTPS.

Foto contoh baru adalah gambar simulasi yang dibuat untuk demo, ditandai di luar foto. Bukti yang sudah tersimpan tetap dipertahankan. Untuk mencoba data contoh baru pada instalasi lama, gunakan profil browser baru; **Aku → Hapus data** juga tersedia jika seluruh data lokal memang ingin dihapus.

## Peta dan navigasi

Cari misi/laporan, pilih kategori atau penanda, lalu tekan **Mulai navigasi**. Jalur jalan kaki mengikuti respons Valhalla, dengan petunjuk belokan, estimasi waktu, posisi GPS, dan pencarian ulang saat keluar jalur. Menekan atau menggeser peta tidak otomatis meminta rute. Tersedia tautan arah jalan kaki di Google Maps saat layanan rute tidak terhubung.

Izinkan HTTPS ke `tiles.openfreemap.org`, `tile.openstreetmap.org`, dan `valhalla1.openstreetmap.de`. Lokasi awal dan tujuan dikirim ke layanan rute hanya setelah navigasi dimulai. GPS simulasi, tidak akurat, atau kedaluwarsa tidak mengonfirmasi kedatangan. Sampai di tujuan tetap harus dilanjutkan dengan check-in misi.

Validasi: `npm run test:routing` menguji parser rute, pembatalan/timeout, dan kualitas GPS dengan respons fixture; `npm run build` memeriksa TypeScript dan menghasilkan web/PWA. Tes fixture tidak membuktikan konektivitas layanan langsung. Pada lingkungan cloud saat revisi ini dibuat, ketiga host peta/rute masih ditolak proxy; draft allowlist perlu disimpan dan diterapkan sebelum pengujian langsung.

## Alur

1. Warga **melapor** (sampah, selokan, fasilitas rusak) atau **minta tolong**, dengan foto kamera di lokasi, di dalam wilayah RT-nya.
2. Warga lain jadi **saksi**. Ketua RT meninjau lalu **menjadikannya misi** (pelapor +10 poin, dan tidak boleh mengerjakan laporannya sendiri).
3. Warga check-in di lokasi, foto sebelum, bekerja minimal N menit, foto sesudah, lalu kirim.
4. Ketua RT memeriksa dengan panel anti-curang, menyetujui, dan poin masuk. Poin menaikkan pangkat, klasemen RT, dan lomba antar-RT.

**Pos Ronda** menggantikan grup obrolan: tidak ada kolom chat. Warga merespons dengan aksi (saksi, gabung regu, sanggup bawa alat), dan hanya pengurus yang bisa memukul **kentongan** untuk memanggil warga.

## Anti-curang

| Celah | Penangkal |
|---|---|
| GPS palsu | Plugin native Android membaca flag mock location dan menolak check-in; lompatan posisi > 40 m/detik memblokir 3 menit; akurasi > 40 m ditolak |
| Foto lama / dari galeri | Hanya kamera di dalam aplikasi; watermark waktu + koordinat dibakar ke foto; segel SHA-256 |
| Foto sebelum = sesudah | Sidik visual dHash dibandingkan; terlalu mirip → tidak bisa dikirim |
| Foto dipakai ulang | Dicocokkan dengan semua foto lain di RT |
| Setoran kilat | Waktu kerja minimal per misi dengan hitung mundur |
| Lapor lalu kerjakan sendiri | Pelapor diblokir dari misi hasil laporannya |
| Farming | Maks. 4 misi dan 3 laporan per hari, satu misi aktif dalam satu waktu |
| RT menyetujui diri sendiri | Ketua RT tidak ikut misi dan tidak bisa memeriksa setorannya |
| Misi/laporan di luar wilayah | Wilayah RT berupa poligon; area check-in harus muat di dalamnya; batas RT tidak boleh menimpa tetangga |

Aturannya ada di `src/lib/integrity.ts` dan `src/lib/store.ts`.

**Mode lokal bersama:** server PC menyimpan data di `.kompack/world.json`, menjalankan aturan misi dan pemeriksaan bukti, serta mengirim perubahan ke browser anggota lewat Server-Sent Events. Perangkat pertama menjadi pemilik akun demo RT, anggota berikutnya memakai ID warga berbeda. Kuota dan perubahan data diproses berurutan, sehingga slot dan poin tidak dihitung dua kali. Data awal tetap berisi warga/misi contoh.

**Mode standalone:** `npm run dev` tanpa server lokal tetap memakai IndexedDB dan sinkron antartab browser yang sama. Untuk penggunaan publik, mode server lokal perlu dilengkapi autentikasi akun produksi dan pemeriksaan provenance foto/GPS di luar input klien.

## Teknologi

React 19 + Vite + TypeScript · MapLibre GL (peta vektor 3D, ubin OpenFreeMap, cadangan otomatis ke ubin OpenStreetMap) · Zustand + IndexedDB · Motion · Capacitor 8 (Android) · Tauri 2 / Rust (desktop) · PWA.

```
src/lib/         data, aturan, geometri wilayah, anti-curang
src/components/  peta 3D, kamera bukti, tombol tahan, UI
src/screens/     peta, misi, lapor, pos ronda, klasemen, aku, rt/*
android/         proyek Capacitor + IntegrityPlugin.java
src-tauri/       pembungkus desktop Rust
```

Build APK: `npm run android:apk` (butuh Android SDK + JDK 21).
