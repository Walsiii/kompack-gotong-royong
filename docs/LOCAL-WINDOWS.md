# Kompack lokal di Windows

Folder tujuan: `G:\Hackathon\Kompack!`. Aplikasi dan server data berjalan di PC ini; peta geografis dan pencarian jalur memakai koneksi internet ke OpenFreeMap/OpenStreetMap dan Valhalla.

## Pasang dan buka

Pasang Git for Windows dan Node.js 24 LTS jika belum tersedia. Jalankan di **PowerShell Windows**:

```powershell
$installer = Join-Path $env:TEMP 'Install-Kompack.ps1'
Invoke-WebRequest 'https://raw.githubusercontent.com/Walsiii/gotong-royong-/refs/heads/claude/hackathon-multiplatform-app-qhsbtv/scripts/Install-Kompack.ps1' -UseBasicParsing -OutFile $installer
powershell.exe -NoProfile -ExecutionPolicy Bypass -File $installer
```

Installer mengambil branch aplikasi, memasang dependensi, menjalankan tes/build, lalu membuka `http://localhost:5173` setelah server siap. Jika folder tujuan sudah berisi file, origin berbeda, atau ada perubahan lokal, installer berhenti dan mempertahankan file tersebut. Perubahan kebijakan eksekusi hanya berlaku untuk proses PowerShell itu.

Berikutnya, klik dua kali **Start-Kompack.cmd** di folder tersebut. Biarkan jendela terminal terbuka selama aplikasi digunakan. Tutup dengan Ctrl+C. Untuk port lain:

```powershell
& 'G:\Hackathon\Kompack!\scripts\Start-Kompack.ps1' -Port 5174
```

## Peta, GPS, dan data realtime

- Daftar pertama di browser PC pemilik. Profil ini mendapat tombol akun demo Ketua RT. Pertahankan profil browser ini agar akses pemilik tetap tersedia.
- Perangkat/browser lain mendaftar sebagai warga dengan ID berbeda, mengikuti wilayah yang dibuat pemilik pertama.
- Laporan, misi, peserta, bukti, keputusan RT, hadiah, dan poin tersinkron melalui server lokal tanpa reload. Server menerapkan aturan misi, batas kuota, kepemilikan bukti, segel, dan penilaian bukti; browser tidak mengirim keseluruhan database untuk menimpa data bersama.
- Untuk GPS bergerak, pilih pendaftaran dengan lokasi perangkat atau matikan **Aku → Mode uji**, lalu izinkan lokasi. Klik **Mulai navigasi** pada misi. Posisi dan progres rute mengikuti pembaruan GPS; rute dicari ulang ketika pengguna keluar jalur. Ketepatan lokasi mengikuti kemampuan perangkat. Laptop dapat lebih kasar daripada GPS ponsel.
- Peta jalan memakai data geografis penyedia ubin. Pembaruan ruas jalan mengikuti jadwal penyedia. Marker misi/laporan diperbarui segera ketika data server berubah.
- Status sambungan ada di **Aku**. Saat sambungan putus, perubahan tidak diklaim berhasil. Sambungan event mencoba pulih dan memuat keadaan terbaru.

Untuk mencoba dua akun di satu PC, gunakan dua profil browser atau browser biasa + incognito. Tab di profil browser yang sama memakai identitas yang sama.

## Perangkat lain di Wi-Fi yang sama

```powershell
& 'G:\Hackathon\Kompack!\scripts\Start-Kompack.ps1' -Lan
```

Launcher menampilkan alamat IP PC. Buka alamat itu di perangkat lain. Jika Windows meminta akses firewall, izinkan untuk jaringan **Private** yang digunakan bersama. Mode ini ditujukan untuk percobaan pada jaringan tepercaya; sesi pemilik lokal belum menggantikan sistem akun produksi untuk akses publik.

Sinkronisasi data bekerja melalui HTTP LAN. Kamera dan GPS browser HP memerlukan **HTTPS dengan sertifikat yang dipercaya perangkat**, sedangkan `localhost` pada PC sudah dianggap konteks aman. Server mendukung sertifikat lokal milikmu:

```powershell
$env:KOMPACK_TLS_CERT = 'G:\Hackathon\certs\kompack.pem'
$env:KOMPACK_TLS_KEY = 'G:\Hackathon\certs\kompack-key.pem'
& 'G:\Hackathon\Kompack!\scripts\Start-Kompack.ps1' -Lan
```

Gunakan sertifikat yang mencakup localhost dan alamat IP PC, serta pasang CA penerbitnya pada perangkat pengujian. Launcher tidak mematikan verifikasi sertifikat. Untuk HTTP LAN, gunakan mode uji untuk mencoba alur foto/lokasi.

## Penyimpanan dan pengujian

Data server ada di **.kompack/world.json**, termasuk foto dan sesi anggota. Folder `.kompack` diabaikan Git dan dipertahankan saat update. Untuk mencadangkan, hentikan server dan salin file tersebut. Server menyimpan perubahan secara atomik. Menghapus profil browser tidak menghapus data bersama di PC.

Saat profil standalone lama bergabung, snapshot lamanya dicadangkan ke IndexedDB dengan nama `kompack-offline-backup-*`; bukti lama tidak ditulis ulang. Semua anggota server memakai data bersama milik server. Versi standalone masih tersedia lewat `npm run dev` pada origin browser yang belum terhubung ke server lokal.

```powershell
npm run test:routing
npm run test:realtime
npm run build
```

Tes realtime menjalankan dua identitas, event perubahan, pembatasan RT, percobaan pemalsuan jarak, perebutan slot terakhir, segel bukti, pemeriksaan server, pencegahan poin ganda, dan pemulihan setelah restart. Walkthrough browser diuji dengan profil terpisah di Linux; launcher Windows belum dieksekusi pada PC Windows pengguna.
