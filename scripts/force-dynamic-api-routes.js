const fs = require('fs')
const path = require('path')

const repoRoot = path.resolve(__dirname, '..')
const apiRoot = path.join(repoRoot, 'src', 'app', 'api')

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  const out = []
  for (const ent of entries) {
    const full = path.join(dir, ent.name)
    if (ent.isDirectory()) out.push(...walk(full))
    else out.push(full)
  }
  return out
}

function isRouteFile(filePath) {
  return filePath.endsWith(`${path.sep}route.ts`) || filePath.endsWith(`${path.sep}route.tsx`)
}

function stripUseServerDirective(source) {
  const lines = source.split(/\r?\n/)
  if (lines.length === 0) return null
  const first = lines[0].trim()
  if (first !== "'use server'" && first !== '"use server"') return null
  let i = 1
  while (i < lines.length && lines[i].trim() === '') i++
  return [...lines.slice(i)].join('\n')
}

function insertDynamicExport(source) {
  if (source.includes("export const dynamic = 'force-dynamic'") || source.includes('export const dynamic = "force-dynamic"')) {
    return null
  }
  const lines = source.split(/\r?\n/)
  let insertAt = 0
  while (insertAt < lines.length && (lines[insertAt].startsWith('import ') || lines[insertAt].trim() === '' || lines[insertAt].startsWith("'use ") || lines[insertAt].startsWith('"use '))) {
    insertAt++
  }

  const exportLine = "export const dynamic = 'force-dynamic'"
  const nextLines = [...lines.slice(0, insertAt), exportLine, '', ...lines.slice(insertAt)]
  return nextLines.join('\n')
}

function main() {
  if (!fs.existsSync(apiRoot)) {
    console.error(`API root not found: ${apiRoot}`)
    process.exitCode = 1
    return
  }
  const files = walk(apiRoot).filter(isRouteFile)
  let changed = 0
  for (const f of files) {
    const src0 = fs.readFileSync(f, 'utf8')
    const src1 = stripUseServerDirective(src0) ?? src0
    const next = insertDynamicExport(src1) ?? src1
    if (next !== src0) {
      fs.writeFileSync(f, next, 'utf8')
      changed++
    }
  }
  console.log(`Updated ${changed} route files`)
}

main()
