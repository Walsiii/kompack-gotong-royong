import http from 'node:http'
import { readFile } from 'node:fs/promises'
const cert = await readFile(process.env.KOMPACK_CA_CER)
const appPort = Number(process.env.PORT || 5173)
const certPort = Number(process.env.KOMPACK_ENROLL_PORT || 5172)
const page = `<!doctype html><html lang="id"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Buka Kompack di HP</title><style>:root{--ink:#171717;--paper:#fff;--line:#ddd;--font:system-ui,sans-serif}html,body{overflow-x:clip}body{margin:32px auto;padding:0 20px;max-width:540px;font-family:var(--font);background:var(--paper);color:var(--ink);line-height:1.55}h1{font-size:28px;line-height:1.2;overflow-wrap:break-word}a{display:inline-block;padding:12px 16px;border:1px solid var(--line);border-radius:12px;color:var(--ink)}a:focus-visible{outline:3px solid var(--ink);outline-offset:3px}li{margin:16px 0}details{margin:24px 0}code{overflow-wrap:anywhere}</style><h1>Kompack di HP kamu.</h1><p>Hubungkan HP ke Wi-Fi PC, lalu lakukan sekali:</p><ol><li><a href="/Kompack-CA.cer">Unduh sertifikat Kompack</a></li><li>Pasang sertifikat di pengaturan HP. Sertifikat membuat sambungan ke PC ini dipercaya browser.</li><li><a id="app">Buka Kompack dengan HTTPS</a></li></ol><details><summary>Cara di Android</summary><p>Buka Setelan → Keamanan → Enkripsi & kredensial → Pasang sertifikat → Sertifikat CA. Nama menu dapat berbeda menurut merek HP. Pilih berkas Kompack-CA.cer.</p></details><details><summary>Cara di iPhone</summary><p>Buka berkas yang diunduh, pasang profil melalui Pengaturan → Umum → VPN & Manajemen Perangkat. Lalu aktifkan Kompack Local HTTPS CA di Umum → Mengenai → Pengaturan Kepercayaan Sertifikat.</p></details><p>Bandingkan sidik SHA-256 dengan yang tampil di terminal PC:</p><code>${process.env.KOMPACK_CA_FINGERPRINT || ''}</code><script>document.querySelector('#app').href='https://'+location.hostname+':${appPort}/'</script></html>`
const server = http.createServer((req,res)=>{
  if (!['GET','HEAD'].includes(req.method)) {res.writeHead(405);res.end();return}
  if (req.url==='/Kompack-CA.cer') {res.writeHead(200,{'Content-Type':'application/x-x509-ca-cert','Content-Disposition':'attachment; filename="Kompack-CA.cer"'});res.end(cert);return}
  res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});res.end(page)
})
server.listen(certPort,'0.0.0.0',()=>console.log(`Sertifikat HP: http://IP-PC:${certPort}/`))
for (const signal of ['SIGINT','SIGTERM']) process.once(signal,()=>server.close(()=>process.exit()))
