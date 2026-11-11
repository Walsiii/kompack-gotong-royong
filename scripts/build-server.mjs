import { build } from 'rolldown'
import { readdir } from 'node:fs/promises'
import path from 'node:path'
const files = await readdir('dist/assets')
await build({
  input:'server/domain.ts', platform:'node',
  plugins:[{
    name:'bundled-demo-asset-urls',
    resolveId(source) { if (/demo-(before|after)\.png$/.test(source)) return '\0'+source },
    load(id) {
      if (!id.startsWith('\0')) return
      const prefix = path.basename(id.slice(1),'.png')+'-'
      const file = files.find(name=>name.startsWith(prefix)&&name.endsWith('.png'))
      if (!file) throw new Error(`Missing production image: ${prefix}`)
      return `export default ${JSON.stringify('/assets/'+file)}`
    },
  }],
  output:{file:'dist/server/domain.mjs',format:'es',codeSplitting:false},
})
