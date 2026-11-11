import http from 'node:http'
import https from 'node:https'
import { randomUUID } from 'node:crypto'
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer as createViteServer } from 'vite'

export async function startLocal({ port = Number(process.env.PORT || 5173), host = '127.0.0.1', directory = process.env.KOMPACK_DATA_DIR || '.kompack' } = {}) {
  const root = fileURLToPath(new URL('../', import.meta.url))
  const file = path.resolve(root, directory, 'world.json')
  await mkdir(path.dirname(file), { recursive: true })
  const tls = process.env.KOMPACK_TLS_CERT && process.env.KOMPACK_TLS_KEY
    ? { cert: await readFile(process.env.KOMPACK_TLS_CERT), key: await readFile(process.env.KOMPACK_TLS_KEY) } : null
  const server = tls ? https.createServer(tls) : http.createServer()
  const vite = await createViteServer({ root, cacheDir: path.resolve(path.dirname(file), 'vite-cache'), server: { middlewareMode: true, hmr: { server }, watch: null }, appType: 'spa' })
  const { createWorldActions, EMPTY, ME } = await vite.ssrLoadModule('/src/lib/world.ts')
  const { LEADER, MY_GROUP } = await vite.ssrLoadModule('/src/lib/seed.ts')
  const { validateFix, assessSubmission, verifySeal } = await vite.ssrLoadModule('/src/lib/integrity.ts')
  const keys = ['users', 'groups', 'quests', 'posts', 'subs', 'bonuses', 'redemptions']
  let saved
  try { saved = JSON.parse(await readFile(file, 'utf8')) } catch (error) { if (error.code !== 'ENOENT') throw error }
  let state = { ...EMPTY, ...saved?.world }
  let revision = saved?.revision ?? 0
  let sessions = saved?.sessions ?? {}
  let receipts = saved?.receipts ?? {}
  const streams = new Set()
  let changed = false
  const actions = createWorldActions(update => { state = { ...state, ...(typeof update === 'function' ? update(state) : update) }; changed = true }, () => state)
  const world = () => Object.fromEntries([...keys, 'home'].map(k => [k, state[k]]))
  const snapshot = session => ({ revision, world: world(), ...(session ? { meId: session.userId, home: state.home, canRT: session.canRT } : {}) })
  const json = (res, code, value) => { res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(value)) }
  const reject = message => { throw new Error(message) }
  const text = (v, min = 1, max = 500) => typeof v === 'string' && v.trim().length >= min && v.length <= max
  const number = (v, min, max) => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max
  const position = v => v && number(v.lat, -90, 90) && number(v.lng, -180, 180)
  const evidence = v => position(v) && text(v.img, 1, 2_000_000) && number(v.at, 0, Date.now() + 60000) && number(v.acc, 0, 100000) && /^[0-9a-f]{16}$/i.test(v.hash) && text(v.seal, 8, 100)
  const quest = q => position(q) && text(q.title, 4, 160) && text(q.place, 3, 200) && text(q.desc, 0, 3000) && ['sampah','got','rusak','taman','bantu'].includes(q.category) && number(q.points, 1, 500) && number(q.slots, 1, 100) && Number.isInteger(q.slots) && number(q.radius, 5, 500) && number(q.minMinutes, 1, 240) && number(q.startAt, 0, q.endAt - 1) && q.endAt > Date.now()
  const save = async () => {
    const next = `${file}.tmp`
    await writeFile(next, JSON.stringify({ revision, world: world(), sessions, receipts }), { mode: 0o600 })
    await rename(next, file)
  }
  let queue = Promise.resolve()
  const transaction = task => {
    const operation = queue.then(async () => {
      const old = { state, revision, sessions: { ...sessions }, receipts: { ...receipts } }
      changed = false
      try {
        const value = await task()
        if (changed) revision++
        await save()
        if (changed) for (const stream of streams) stream.write(`data: ${revision}\n\n`)
        return value
      } catch (error) { ({ state, revision, sessions, receipts } = old); throw error }
    })
    queue = operation.catch(() => {})
    return operation
  }
  const body = async req => {
    let value = '', size = 0
    for await (const chunk of req) { size += chunk.length; if (size > 16_000_000) reject('Data terlalu besar.'); value += chunk }
    return JSON.parse(value)
  }
  const readSession = req => sessions[(req.headers.cookie || '').split(';').map(x => x.trim()).find(x => x.startsWith('kompack-session='))?.slice(16)]
  const cookie = token => `kompack-session=${token}; HttpOnly; SameSite=Strict; Path=/api; Max-Age=31536000${tls ? '; Secure' : ''}`
  async function command(input, session) {
    const { action, args: a } = input
    if (!Array.isArray(a) || !text(input.id, 10, 100)) reject('Perintah tidak valid.')
    const actor = input.actingRT ? (session.canRT ? LEADER : reject('Akun ini bukan pengurus RT.')) : session.userId
    const rt = actor === LEADER
    const own = id => state.subs.find(s => s.id === id && s.userId === actor)
    const rtOnly = () => { if (!rt) reject('Hanya Ketua RT yang bisa melakukan ini.') }
    switch (action) {
      case 'broadcast': rtOnly(); if (!text(a[2],8,240)) reject('Isi panggilan tidak valid.'); return actions.broadcast(a[0], actor, a[2])
      case 'createReport': {
        const p = a[0]
        if (rt || !p || !evidence(p.photo) || !text(p.text,10,3000) || !text(p.place,0,200) || !['laporan','tolong'].includes(p.kind) || !['sampah','got','rusak','taman','bantu'].includes(p.category)) reject('Laporan tidak valid.')
        return actions.createReport({ ...p, authorId: actor })
      }
      case 'toggleWitness': return actions.toggleWitness(a[0], actor)
      case 'toggleReaction': if (!['siap','ikut','bawa','alat','karung','sapu','cangkul','gerobak','angkut','sarung'].includes(a[1]) && !text(a[1],1,32)) reject('Reaksi tidak valid.'); return actions.toggleReaction(a[0], a[1], actor)
      case 'acceptReport': rtOnly(); if (!quest(a[2])) reject('Data misi tidak valid.'); return actions.acceptReport(a[0], actor, a[2])
      case 'dismissReport': rtOnly(); if (!text(a[2],1,500)) reject('Isi alasan penolakan.'); return actions.dismissReport(a[0], actor, a[2])
      case 'createQuest': rtOnly(); if (!quest(a[0])) reject('Data misi tidak valid.'); return actions.createQuest(a[0], actor)
      case 'closeQuest': {
        rtOnly(); const q=state.quests.find(q=>q.id===a[0])
        if (!q || !state.groups.some(g=>g.id===q.groupId && g.leaderId===actor)) reject('Misi ini di luar wilayahmu.')
        return actions.closeQuest(a[0])
      }
      case 'saveTerritory': rtOnly(); if (!state.groups.some(g=>g.id===a[0] && g.leaderId===actor) || !Array.isArray(a[1]) || a[1].length > 100 || !a[1].every(position)) reject('Batas wilayah tidak valid.'); return actions.saveTerritory(a[0], a[1])
      case 'checkIn': {
        if (rt || !position(a[2]) || !number(a[2].acc,0,100000) || !number(a[2].at,Date.now()-30000,Date.now()+10000)) reject('Lokasi tidak valid atau kedaluwarsa.')
        const q = state.quests.find(q => q.id === a[0]); if (!q) reject('Misi tidak ditemukan.')
        const fix = validateFix(a[2], q, null); if (!fix.ok) reject(fix.reason)
        return actions.checkIn(q.id, actor, a[2], fix.dist)
      }
      case 'setEvidence': {
        const sub = own(a[0]); if (!sub || sub.status !== 'checked_in' || !['before','after'].includes(a[1]) || !evidence(a[2])) reject('Bukti tidak dapat diubah.')
        if (!/^[0-9a-f]{64}$/i.test(a[2].seal) || !await verifySeal(a[2], actor, sub.questId)) reject('Segel foto tidak cocok.')
        if (a[1] === 'after' && !sub.before) reject('Ambil foto sebelum terlebih dahulu.')
        return actions.setEvidence(a[0], a[1], a[2])
      }
      case 'submit': {
        const sub = own(a[0]), q = state.quests.find(q => q.id === sub?.questId), user = state.users.find(u => u.id === actor)
        if (!sub || !q || !user || sub.status !== 'checked_in' || !sub.before || !sub.after || !text(a[1],0,3000)) reject('Bukti belum lengkap.')
        const others = state.subs.filter(s=>s.id!==sub.id).flatMap(s=>[s.before,s.after].filter(Boolean).map(ev=>({ref:s.id,label:'setoran warga',ev})))
        for (const p of state.posts) if (p.photo) others.push({ref:p.id,label:'laporan warga',ev:p.photo})
        const assessment = await assessSubmission(sub,q,user,others)
        if (assessment.block) reject(assessment.block)
        if (assessment.checks.some(c=>c.id==='segel' && c.status==='bad')) reject('Segel bukti berubah.')
        return actions.submit(sub.id,a[1],assessment.checks)
      }
      case 'review': rtOnly(); if (typeof a[2] !== 'boolean') reject('Keputusan tidak valid.'); return actions.review(a[0],actor,a[2],a[3])
      case 'markCelebrated': if (!Array.isArray(a[0])) reject('Setoran tidak valid.'); return actions.markCelebrated(a[0].filter(id=>own(id)))
      case 'redeem': return actions.redeem(a[0],actor)
      case 'fulfill': {
        rtOnly(); const red=state.redemptions.find(r=>r.id===a[0]),user=state.users.find(u=>u.id===red?.userId)
        if (!user || !state.groups.some(g=>g.id===user.groupId && g.leaderId===actor)) reject('Hadiah ini di luar wilayahmu.')
        return actions.fulfill(a[0])
      }
      case 'rollDemo': return actions.rollDemo()
      default: reject('Perintah tidak dikenal.')
    }
  }
  server.on('request', async (req,res) => {
    const url = new URL(req.url, `${tls?'https':'http'}://${req.headers.host}`)
    if (!url.pathname.startsWith('/api/')) { vite.middlewares(req,res); return }
    // Same-origin requests only, including on the optional trusted-LAN listener.
    if (req.headers.origin && req.headers.origin !== url.origin) { json(res,403,{error:'Origin tidak diizinkan.'}); return }
    try {
      if (req.method==='GET' && url.pathname==='/api/config') return json(res,200,{service:'kompack-local'})
      let session = readSession(req)
      if (req.method==='GET' && url.pathname==='/api/session') return json(res,200,session?snapshot(session):{meId:null})
      if (req.method==='POST' && url.pathname==='/api/register') {
        if (session) return json(res,200,snapshot(session))
        const input = await body(req), p=input.profile
        if (!p || !text(p.name,2,80) || !position(p.home) || !number(p.birthYear,1900,new Date().getFullYear()-10) || !number(p.avatar,0,100) || typeof p.testMode!=='boolean') reject('Profil tidak valid.')
        const token=randomUUID()+randomUUID()
        await transaction(async()=>{
          if (!state.users.length) {
            if (!input.seed || !keys.every(k=>Array.isArray(input.seed[k])) || !input.seed.groups.length || input.seed.users.length>100) reject('Data awal belum lengkap.')
            // Only the owner bootstraps the local demo. Subsequent members cannot replace it.
            state={...state,...Object.fromEntries(keys.map(k=>[k,input.seed[k]])),home:p.home}
            state.users=state.users.filter(u=>u.id!==ME)
          }
          const id=`w_${randomUUID()}`
          state={...state,users:[...state.users,{id,name:p.name.trim(),birthYear:p.birthYear,avatar:p.avatar,groupId:MY_GROUP,role:'warga',basePoints:0,baseWeek:0,baseQuests:0,trust:100}]}
          session={userId:id,canRT:Object.keys(sessions).length===0}
          sessions[token]=session; changed=true
        })
        res.setHeader('Set-Cookie',cookie(token)); return json(res,200,snapshot(session))
      }
      if (!session) return json(res,401,{error:'Daftar terlebih dahulu.'})
      if (req.method==='GET' && url.pathname==='/api/state') return json(res,200,snapshot(session))
      if (req.method==='GET' && url.pathname==='/api/events') {
        res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-store','Connection':'keep-alive','X-Accel-Buffering':'no'})
        res.write(`data: ${revision}\n\n`); streams.add(res)
        const heartbeat=setInterval(()=>res.write(': heartbeat\n\n'),15000)
        req.on('close',()=>{clearInterval(heartbeat);streams.delete(res)}); return
      }
      if (req.method==='POST' && url.pathname==='/api/logout') {res.setHeader('Set-Cookie','kompack-session=; HttpOnly; SameSite=Strict; Path=/api; Max-Age=0');return json(res,200,{ok:true})}
      if (req.method==='POST' && url.pathname==='/api/command') {
        const input=await body(req)
        const receiptKey=`${session.userId}:${input.id}`
        const result=await transaction(async()=>{
          if (Object.hasOwn(receipts,receiptKey)) return receipts[receiptKey]
          let value
          try { value=await command(input,session) } catch(error) { value={ok:false,error:error.message} }
          receipts[receiptKey]=value??{ok:true,value:true}
          receipts=Object.fromEntries(Object.entries(receipts).slice(-500))
          return receipts[receiptKey]
        })
        return json(res,200,{...snapshot(session),result})
      }
      return json(res,404,{error:'Endpoint tidak ditemukan.'})
    } catch(error) { json(res,400,{error:error.message}) }
  })
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,host,resolve)})
  const actualPort=server.address().port
  console.log(`Kompack lokal: ${tls?'https':'http'}://localhost:${actualPort}\nData bersama: ${file}`)
  const close=async()=>{for(const stream of streams)stream.end();await vite.close();await new Promise(resolve=>server.close(resolve))}
  return { server, port:actualPort, close }
}

if (process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const app=await startLocal({host:process.argv.includes('--lan')?'0.0.0.0':'127.0.0.1'})
  for (const signal of ['SIGINT','SIGTERM']) process.once(signal,()=>void app.close().then(()=>process.exit()))
}
