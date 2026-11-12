# Melanjutkan pengembangan Kompack!

Catatan serah terima untuk sesi Claude Code (atau pengembang) berikutnya.

## Keadaan sekarang

- Branch kerja: `claude/hackathon-multiplatform-app-qhsbtv`.
- Aturan desain yang mengikat ada di `design.md` (tema bawaan hitam-putih, Public Sans, peta ala Google Maps). Baca sebelum mengubah tampilan.
- Aplikasi web/PWA (React 19 + Vite + TypeScript), APK Android lewat Capacitor (`android/`), desktop lewat Tauri (`src-tauri/`), paket Windows lewat `npm run build:portable`.
- Data: mode standalone memakai IndexedDB; mode lokal bersama memakai server Node di `server/local.mjs` (lihat README).

## Peta & navigasi (bagian yang paling sering diubah)

| Berkas | Isi |
|---|---|
| `src/components/Map3D.tsx` | Peta MapLibre: penanda sebagai lapisan GPU, animasi, kamera ikut, panah navigasi, rute & progres |
| `src/components/mapStyle.ts` | Gaya peta vektor (OpenFreeMap) dan cadangan ubin OSM |
| `src/screens/MapHome.tsx` | Layar peta: pencarian, kategori, lembar detail, mode navigasi, simulasi jalan di mode uji |
| `src/components/NavigationMode.tsx` | UI navigasi: banner belokan, panel waktu tiba, daftar langkah, suara |
| `src/lib/routing.ts` | Rute Valhalla, proyeksi GPS, jarak ke belokan, cadangan rute perangkat |
| `src/lib/localRoute.ts` | Router di perangkat (Dijkstra di atas jalan OSM dari ubin peta) |

## Perintah

```bash
npm ci
npm run dev             # http://localhost:5173 — pilih "Coba di PC (mode uji)"
npm run test:routing    # tes rute & navigasi
npm run build           # cek TypeScript + build web/PWA
npm run android:apk     # butuh Android SDK + JDK 21
```

## Yang belum terbukti

- Peta dan rute dengan jaringan asli: sesi cloud sebelumnya tidak bisa menjangkau `tiles.openfreemap.org` dan `valhalla1.openstreetmap.de`, jadi pengujian memakai data peta sintetis. Uji di jaringan biasa dan di HP sungguhan.
- APK belum pernah dipasang di HP. Belum ada backend produksi (autentikasi, verifikasi bukti di server).
