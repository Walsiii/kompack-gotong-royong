import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createHash, randomUUID } from 'node:crypto'
import { startLocal } from '../server/local.mjs'

test('local server: independent identities, live events, authoritative commands and durable state', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'kompack-api-'))
  let app, stream
  try {
    app = await startLocal({ port:0, directory })
    let base = `http://127.0.0.1:${app.port}`
    const request = async (path, data, cookie) => {
      const res = await fetch(`${base}/api/${path}`, {method:data===undefined?'GET':'POST',headers:{...(data===undefined?{}:{'Content-Type':'application/json'}),...(cookie?{Cookie:cookie}:{})},body:data===undefined?undefined:JSON.stringify(data)})
      return { status:res.status, body:await res.json(), cookie:res.headers.get('set-cookie')?.split(';')[0] }
    }
    const seed = {
      users:[{id:'p_hendra',name:'Pak Hendra',avatar:0,birthYear:1970,role:'rt',groupId:'rt04',basePoints:0,baseWeek:0,baseQuests:0,trust:100}],
      groups:[{id:'rt04',name:'RT 04',rw:'RW 09',kind:'rt',leaderId:'p_hendra',territory:[{lat:-.002,lng:-.002},{lat:.002,lng:-.002},{lat:.002,lng:.002},{lat:-.002,lng:.002}],basePoints:0,member:true}],
      quests:[],posts:[],subs:[],bonuses:[],redemptions:[],
    }
    const profile = name=>({name,birthYear:1990,avatar:0,home:{lat:0,lng:0},testMode:true})
    assert.equal((await request('state')).status,401)
    const a=await request('register',{profile:profile('Pemilik'),seed})
    const b=await request('register',{profile:profile('Warga'),seed:{...seed,users:[]}})
    assert.equal(a.body.canRT,true);assert.equal(b.body.canRT,false)
    assert.notEqual(a.body.meId,b.body.meId)
    assert.equal(b.body.world.users.length,3,'second registration must not replace the world')
    const send = (session,action,args=[],actingRT=false,id=randomUUID())=>request('command',{action,args,actingRT,id},session.cookie)
    assert.equal((await send(b,'createQuest',[{}],true)).body.result.ok,false)
    assert.equal((await send(b,'constructor')).body.result.ok,false)
    stream=(await fetch(`${base}/api/events`,{headers:{Cookie:b.cookie}})).body.getReader()
    assert.match(new TextDecoder().decode((await stream.read()).value),/data: 2/)
    const input={title:'Misi bersama',desc:'Bersihkan lingkungan',place:'Pos ronda',category:'sampah',lat:0,lng:0,radius:40,minMinutes:1,startAt:Date.now()-60000,endAt:Date.now()+3600000,points:50,slots:1}
    const commandId=randomUUID()
    const created=await send(a,'createQuest',[input,'forged-actor'],true,commandId)
    assert.equal(created.body.result.ok,true)
    assert.match(new TextDecoder().decode((await stream.read()).value),/data: 3/)
    const repeated=await send(a,'createQuest',[input,'forged-actor'],true,commandId)
    assert.equal(repeated.body.world.quests.length,1,'retries are idempotent')
    const questId=created.body.result.value
    const fix={lat:0,lng:0,acc:5,at:Date.now(),simulated:true,mock:false,emulator:false}
    const outside=await send(b,'checkIn',[questId,b.body.meId,{...fix,lat:.01},0])
    assert.equal(outside.body.result.ok,false,'client-supplied distance cannot bypass geography')
    const [one,two]=await Promise.all([send(b,'checkIn',[questId,b.body.meId,fix,0]),send(a,'checkIn',[questId,a.body.meId,fix,0])])
    assert.equal([one,two].filter(r=>r.body.result.ok).length,1,'the final slot cannot be taken twice')
    const member=one.body.result.ok?b:a
    const subId=(one.body.result.ok?one:two).body.result.value
    const seal = e=>{
      const sha=s=>createHash('sha256').update(s).digest('hex')
      return sha([member.body.meId,questId,e.at,e.lat.toFixed(6),e.lng.toFixed(6),Math.round(e.acc),e.hash,1,1,sha(e.img)].join('|'))
    }
    const before={img:'fixture:before',lat:0,lng:0,acc:5,at:Date.now()-60000,hash:'0000000000000000',sample:true,simulated:true};before.seal=seal(before)
    const after={...before,img:'fixture:after',at:Date.now(),hash:'00000000000000ff'};after.seal=seal(after)
    assert.equal((await send(member,'setEvidence',[subId,'before',{...before,seal:'tampered-seal'}])).body.result.ok,false)
    assert.equal((await send(member,'setEvidence',[subId,'before',before])).body.result.ok,true)
    assert.equal((await send(member,'setEvidence',[subId,'after',after])).body.result.ok,true)
    const submitted=await send(member,'submit',[subId,'Selesai',[]])
    assert.equal(submitted.body.world.subs[0].checks.length,9,'checks are recomputed on server')
    assert.equal((await send(b,'review',[subId,'p_hendra',true],true)).body.result.ok,false)
    const reviewed=await send(a,'review',[subId,'p_hendra',true],true)
    assert.equal(reviewed.body.world.subs[0].status,'approved')
    assert.equal(reviewed.body.world.subs[0].awarded,50)
    assert.equal((await send(member,'setEvidence',[subId,'after',after])).body.result.ok,false)
    assert.equal((await send(a,'review',[subId,'p_hendra',true],true)).body.result.ok,false,'points cannot be awarded twice')
    const savedRevision=reviewed.body.revision
    await stream.cancel();stream=null
    await app.close();app=null
    app=await startLocal({port:0,directory});base=`http://127.0.0.1:${app.port}`
    const restored=await request('state',undefined,b.cookie)
    assert.equal(restored.body.meId,b.body.meId)
    assert.equal(restored.body.world.subs[0].status,'approved')
    assert.equal(restored.body.revision,savedRevision)
  } finally {
    if (stream) await stream.cancel()
    if (app) await app.close()
    await rm(directory,{recursive:true,force:true})
  }
})
