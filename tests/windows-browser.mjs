import assert from 'node:assert/strict'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { writeFile } from 'node:fs/promises'
import { chromium } from 'playwright-core'

if (!process.env.KOMPACK_ALLOW_NON_WINDOWS_TEST) assert.equal(process.platform,'win32','This check must run on Windows')
const root=path.resolve(process.argv[2])
const {startLocal}=await import(pathToFileURL(path.join(root,'server/local.mjs')).href)
const app=await startLocal({port:0,directory:'.kompack/browser-validation'})
let browser
try {
  browser=await chromium.launch({...(process.env.KOMPACK_BROWSER_EXECUTABLE?{executablePath:process.env.KOMPACK_BROWSER_EXECUTABLE}:{channel:'msedge'}),headless:true,args:['--no-sandbox','--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream','--enable-unsafe-swiftshader']})
  const tls=!!(process.env.KOMPACK_TLS_PFX||process.env.KOMPACK_TLS_CERT)
  const base=`${tls?'https':'http'}://localhost:${app.port}`
  const context=await browser.newContext({permissions:['geolocation','camera'],geolocation:{latitude:-6.9,longitude:107.6,accuracy:5},viewport:{width:390,height:844},reducedMotion:'reduce'})
  const page=await context.newPage(),errors=[]
  page.on('pageerror',e=>errors.push(e.message))
  await page.goto(base)
  await page.getByRole('button',{name:'Mulai',exact:true}).waitFor()
  assert.equal(await page.evaluate(()=>isSecureContext),true)
  const devices=await page.evaluate(async()=>{
    const stream=await navigator.mediaDevices.getUserMedia({video:true,audio:false})
    const live=stream.getVideoTracks().some(t=>t.readyState==='live')
    stream.getTracks().forEach(t=>t.stop())
    const fix=await new Promise((resolve,reject)=>navigator.geolocation.getCurrentPosition(p=>resolve({lat:p.coords.latitude,lng:p.coords.longitude}),reject,{timeout:10000}))
    return{live,fix}
  })
  assert.equal(devices.live,true)
  assert.equal(devices.fix.lat,-6.9)
  await page.getByRole('button',{name:'Mulai',exact:true}).click()
  await page.getByLabel('Nama panggilan').fill('Windows HTTPS Tester')
  await page.getByLabel('Tahun lahir').selectOption('1990')
  await page.getByRole('button',{name:'Lanjut',exact:true}).click()
  await page.getByRole('button',{name:'Pakai lokasiku (GPS)',exact:true}).click()
  await page.getByRole('navigation',{name:'Navigasi utama'}).waitFor()
  await page.goto(`${base}/#/lapor`)
  await page.getByRole('button',{name:/Buka kamera/}).click()
  await page.waitForFunction(()=>{const video=document.querySelector('video');return video && video.readyState>=2})
  await page.getByRole('button',{name:'Ambil foto',exact:true}).click()
  await page.getByRole('img',{name:'Hasil foto'}).waitFor()
  await page.getByRole('button',{name:'Pakai foto ini',exact:true}).click()
  await page.getByLabel('Apa masalahnya?').fill('Uji kamera pada HTTPS lokal Windows')
  await page.getByLabel(/Patokan tempat/).fill('Pos ronda pengujian')
  await page.getByRole('button',{name:/^Kirim ke grup/}).click()
  await page.waitForURL(/grup/)
  assert.deepEqual(errors,[])
  const report={sourceSha:process.env.GITHUB_SHA,platform:process.platform,node:process.version,https:tls,ignoreHTTPSErrors:false,secureContext:true,cameraStream:true,geolocation:true,registration:true,appCamera:true,reportSubmitted:true,deviceFixtures:'Chromium simulated camera and geolocation; no physical device claimed',project:root,errors}
  await writeFile(path.join(root,'.kompack','windows-browser-report.json'),JSON.stringify(report,null,2))
  console.log(JSON.stringify(report))
} finally {if(browser)await browser.close();await app.close()}
