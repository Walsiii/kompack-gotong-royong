# Kompack Windows — sekali klik

Unduh [Kompack-Windows.zip](../release/Kompack-Windows.zip). Paket menyertakan runtime Node.js Windows x64, aplikasi yang sudah dibuild, server data bersama, dan setup HTTPS. Tidak memerlukan pemasangan Git/Node atau menjalankan npm.

1. Ekstrak seluruh ZIP ke folder biasa.
2. Klik **Install-Kompack.cmd**. Paket dipasang ke **G:\Hackathon\Kompack!**. Jika folder tersebut berisi proyek lama, installer mempertahankannya dan menggunakan subfolder **Kompack-Local**.
3. Browser terbuka ke **https://localhost:5173** setelah HTTPS, halaman aplikasi, dan berkas JavaScript berhasil diperiksa.

Untuk membuka lagi, klik **Start-Kompack.cmd** di folder pemasangan. Biarkan terminal terbuka selama digunakan; tutup dengan Ctrl+C. Jalankan aplikasi melalui launcher agar halaman dilayani server bersama API realtime.

## HTTPS otomatis

Launcher membuat CA lokal Kompack pada akun Windows saat ini, memasang sertifikat publiknya ke trust store akun itu, lalu membuat sertifikat server untuk localhost dan IP jaringan PC. Kunci root CA tidak diekspor. Kunci sertifikat server disimpan dalam PFX di folder `.kompack/tls` yang dibatasi untuk akun Windows tersebut. Root dan kunci dibuat di PC pemasangan; ZIP tidak membawa kunci atau CA milik mesin pembuat paket.

Bila IP PC berubah, launcher memperbarui sertifikat saat dibuka lagi. CA tetap sama, sehingga HP yang sudah mempercayainya tidak perlu memasangnya ulang. Launcher memeriksa HTTPS dengan verifikasi sertifikat aktif.

## Buka di HP

Hubungkan HP dan PC ke Wi-Fi yang sama. Jika Windows menampilkan dialog firewall Node, izinkan pada jaringan **Private** yang digunakan bersama.

Terminal PC menampilkan dua alamat:

- **http://IP-PC:5172/** — halaman panduan sertifikat HP.
- **https://IP-PC:5173/** — aplikasi Kompack.

Buka alamat panduan terlebih dahulu, unduh sertifikat, lalu pasang **sekali** melalui pengaturan HP. Halaman tersebut menyediakan langkah Android/iPhone dan sidik SHA-256 yang dapat dibandingkan dengan terminal PC. Setelah itu buka tautan HTTPS di halaman yang sama.

Pemasangan sertifikat HP memerlukan persetujuan pemilik perangkat melalui Android/iOS; aplikasi tidak dapat memberikan persetujuan tersebut sendiri. Setelah sertifikat dipercaya, browser dapat meminta izin kamera dan GPS pada origin HTTPS Kompack.

## Data dan realtime

Perangkat pertama yang mendaftar mendapat akses akun demo Ketua RT. Daftarkan perangkat pemilik terlebih dahulu dan pertahankan profil browsernya. Perangkat berikutnya mendapat identitas warga berbeda di wilayah yang sama. Dua akun di satu PC dapat dicoba memakai profil browser terpisah atau incognito.

Laporan, misi, peserta, bukti, keputusan RT, hadiah, dan poin tersinkron melalui server tanpa reload. Server memproses perubahan secara berurutan, menjalankan aturan kuota/kepemilikan dan penilaian bukti, serta mencegah poin ganda. Data awal berisi contoh warga/misi.

Untuk GPS bergerak, pilih **Pakai lokasiku (GPS)** ketika mendaftar, atau matikan **Aku → Mode uji**. Izinkan lokasi dan tekan **Mulai navigasi** pada misi. Ketepatan lokasi mengikuti perangkat; laptop dapat lebih kasar daripada ponsel. Ubin geografis dan rute jalan kaki memakai koneksi internet ke OpenFreeMap/OpenStreetMap dan Valhalla.

Data bersama tersimpan di **.kompack/world.json** pada PC. Installer mempertahankan `.kompack` saat update. Untuk mencadangkan, hentikan server dan salin folder `.kompack`. Mode ini ditujukan untuk percobaan pada Wi-Fi tepercaya; sesi pemilik lokal belum menggantikan autentikasi produksi untuk akses publik.

## Pengujian paket

`npm run build:portable` membangun web, membundel aturan server tanpa Vite saat runtime, menyertakan Node Windows, dan menghasilkan ZIP dengan checksum berkas. Distribusi Node untuk build lintas platform diverifikasi terhadap SHA-256 resmi Node.js.

Workflow **windows-portable** menguji installer dan launcher pada Windows, jalur dengan spasi/tanda seru dan drive G, HTTPS tepercaya, pemuatan JavaScript, registrasi, API kamera/GPS, serta pengiriman laporan melalui Microsoft Edge. Kamera dan GPS pada pengujian browser memakai perangkat simulasi Chromium, bukan klaim pengujian hardware HP. Hasil workflow dicatat pada Git notes `kompack-windows` untuk commit sumber dan artifact workflow.

Source checkout tetap dapat digunakan dengan Node.js 24 LTS:

```powershell
npm ci
npm run build
.\scripts\Start-Kompack.ps1 -Lan
```
