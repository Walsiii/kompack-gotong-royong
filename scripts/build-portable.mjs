import { mkdir, cp, readFile, readdir, writeFile, rm, copyFile, access } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import path from 'node:path'

const work = path.resolve('.portable-build')
const stage = path.join(work,'Kompack-Windows')
await rm(stage,{recursive:true,force:true})
for (const dir of ['runtime','server','scripts']) await mkdir(path.join(stage,dir),{recursive:true})
await mkdir('release',{recursive:true})
await cp('dist',path.join(stage,'dist'),{recursive:true})
for (const file of ['local.mjs','static.mjs','enroll.mjs']) await copyFile(`server/${file}`,path.join(stage,'server',file))
for (const file of ['Start-Kompack.ps1','Setup-Https.ps1','Install-Portable.ps1']) await copyFile(`scripts/${file}`,path.join(stage,'scripts',file))
for (const file of ['Start-Kompack.cmd','Install-Kompack.cmd']) await copyFile(file,path.join(stage,file))
const nodeVersion = process.version
if (process.platform==='win32') {
  await copyFile(process.execPath,path.join(stage,'runtime','node.exe'))
  execFileSync('curl.exe',['--fail','--silent','--show-error','--location',`https://raw.githubusercontent.com/nodejs/node/${nodeVersion}/LICENSE`,'-o',path.join(stage,'runtime','NODE-LICENSE.txt')],{stdio:'inherit'})
} else {
  const name=`node-${nodeVersion}-win-x64`, zip=path.join(work,`${name}.zip`), sums=path.join(work,'SHASUMS256.txt')
  const curl=process.platform==='win32'?'curl.exe':'curl'
  let cached=false
  try { await access(zip); cached=true } catch { /* Download the official runtime below. */ }
  if (!cached) execFileSync(curl,['--fail','--silent','--show-error','--location','--retry','2',`https://nodejs.org/dist/${nodeVersion}/${name}.zip`,'-o',zip],{stdio:'inherit'})
  execFileSync(curl,['--fail','--silent','--show-error','--location',`https://nodejs.org/dist/${nodeVersion}/SHASUMS256.txt`,'-o',sums],{stdio:'inherit'})
  const actual=createHash('sha256').update(await readFile(zip)).digest('hex')
  const expected=(await readFile(sums,'utf8')).split('\n').find(line=>line.endsWith(` ${name}.zip`))?.split(/\s+/)[0]
  if (!expected || actual!==expected) throw new Error('Official Node.js ZIP checksum mismatch')
  execFileSync('python3',['-c',"import zipfile,pathlib,sys\nz=zipfile.ZipFile(sys.argv[1]);out=pathlib.Path(sys.argv[3]);out.joinpath('node.exe').write_bytes(z.read(sys.argv[2]+'/node.exe'));out.joinpath('NODE-LICENSE.txt').write_bytes(z.read(sys.argv[2]+'/LICENSE'))",zip,name,path.join(stage,'runtime')])
}
await writeFile(path.join(stage,'BACA-DULU.txt'),`KOMPACK WINDOWS — PAKET SEKALI KLIK\n\n1. Ekstrak seluruh ZIP ke folder biasa (jangan jalankan dari dalam ZIP).\n2. Klik Install-Kompack.cmd. Paket ditempatkan di G:\\Hackathon\\Kompack!; jika berisi proyek lama, paket memakai subfolder Kompack-Local.\n3. Izinkan CA lokal Kompack jika Windows meminta. Browser membuka HTTPS otomatis.\n\nTidak perlu memasang Git, Node, atau menjalankan npm.\nUntuk membuka lagi, klik Start-Kompack.cmd di folder pemasangan.\nBiarkan terminal terbuka; tutup dengan Ctrl+C.\n\nHP: gunakan Wi-Fi yang sama. Terminal PC menampilkan alamat panduan pemasangan sertifikat. Pasang sertifikat CA sekali lewat Pengaturan HP, lalu buka alamat HTTPS aplikasi. Sidik SHA-256 CA ada di terminal untuk dibandingkan. Persetujuan sertifikat HP merupakan langkah pengaturan perangkat yang dilakukan pemiliknya.\n\nData dan kunci HTTPS disimpan hanya di .kompack pada PC, tidak disertakan dalam ZIP. Jangan hapus folder .kompack saat update.\n\nNode.js ${nodeVersion} (Windows x64) disertakan; lisensi ada di runtime/NODE-LICENSE.txt. Peta dan navigasi memerlukan internet.\n`)
const licenses=[]
async function collectLicenses(dir) {
  for (const entry of await readdir(dir,{withFileTypes:true})) {
    if (entry.name.startsWith('.')) continue
    const full=path.join(dir,entry.name)
    if (entry.isDirectory()) {
      if (entry.name.startsWith('@') || entry.name==='node_modules') await collectLicenses(full)
      else {
        for (const file of await readdir(full,{withFileTypes:true})) {
          if (file.isFile() && /^(licen[cs]e|notice|copying)(\.|$)/i.test(file.name)) licenses.push(`\n=== ${path.relative('node_modules',full)}/${file.name} ===\n`+await readFile(path.join(full,file.name),'utf8'))
          if (file.isDirectory() && file.name==='node_modules') await collectLicenses(path.join(full,file.name))
        }
      }
    }
  }
}
await collectLicenses('node_modules')
await writeFile(path.join(stage,'THIRD-PARTY-LICENSES.txt'),licenses.join('\n'))
async function walk(dir,base=dir) {
  const result=[]
  for (const entry of await readdir(dir,{withFileTypes:true})) {
    const full=path.join(dir,entry.name)
    if (entry.isDirectory()) result.push(...await walk(full,base))
    else result.push({path:path.relative(base,full).replaceAll(path.sep,'/'),sha256:createHash('sha256').update(await readFile(full)).digest('hex')})
  }
  return result
}
await writeFile(path.join(stage,'portable.json'),JSON.stringify({formatVersion:1,builtAt:new Date().toISOString(),nodeVersion,files:await walk(stage)},null,2))
const output=path.resolve('release/Kompack-Windows.zip')
if (process.platform==='win32') execFileSync('powershell.exe',['-NoProfile','-File',path.resolve('scripts/archive-portable.ps1'),'-SourceDir',stage,'-OutputZip',output],{stdio:'inherit'})
else execFileSync('python3',['-c',"import pathlib,zipfile,sys\nroot=pathlib.Path(sys.argv[1]);z=zipfile.ZipFile(sys.argv[2],'w',compression=zipfile.ZIP_DEFLATED,compresslevel=6)\nfor p in root.rglob('*'):\n if p.is_file():z.write(p,p.relative_to(root.parent))\nz.close()",stage,output],{stdio:'inherit'})
console.log(`Portable Windows: ${output}`)
