import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/route-auth'
import { formatIdCurrency, formatIdNumber } from '@/lib/utils'
import { createWIBDate, getCurrentWIBDateParts } from '@/lib/wib-date'
import fs from 'fs'
import path from 'path'

export const dynamic = 'force-dynamic'
export const revalidate = 0

function clipText(s: string, maxLen: number) {
  const v = String(s || '')
  if (v.length <= maxLen) return v
  return `${v.slice(0, Math.max(0, maxLen - 1))}…`
}

function parsePrismaSchemaModels(schema: string) {
  const lines = String(schema || '')
    .split(/\r?\n/)
    .map((l) => l.replace(/\/\/.*$/, '').trim())
    .filter((l) => Boolean(l))
  const models: Array<{ name: string; fieldLines: string[] }> = []
  for (let i = 0; i < lines.length; i += 1) {
    const m = lines[i].match(/^model\s+([A-Za-z_][A-Za-z0-9_]*)\s*\{$/)
    if (!m) continue
    const name = m[1]
    const fieldLines: string[] = []
    for (let j = i + 1; j < lines.length; j += 1) {
      if (lines[j] === '}') {
        i = j
        break
      }
      fieldLines.push(lines[j])
    }
    models.push({ name, fieldLines })
  }
  return models
}

function buildPrismaSchemaBriefFromFile() {
  try {
    const schemaPath = path.join(process.cwd(), 'prisma', 'schema.prisma')
    const raw = fs.readFileSync(schemaPath, 'utf8')
    const models = parsePrismaSchemaModels(raw)
    const modelSet = new Set(models.map((m) => m.name))
    const scalar = new Set(['String', 'Int', 'Float', 'Boolean', 'DateTime', 'Decimal', 'Json', 'Bytes', 'BigInt'])
    const maxModels = 80
    const lines: string[] = [`Model ${models.length}. Format: Model: scalar[...] relation[...]`]
    for (const m of models.slice(0, maxModels)) {
      const scalarFields: string[] = []
      const relationFields: string[] = []
      for (const fl of m.fieldLines) {
        if (!fl || fl.startsWith('@@') || fl.startsWith('@')) continue
        const tok = fl.split(/\s+/)
        if (tok.length < 2) continue
        const field = tok[0]
        const typeTok = tok[1]
        if (!field || field.startsWith('@')) continue
        const base = typeTok.replace(/\?$/, '').replace(/\[\]$/, '')
        const isList = typeTok.endsWith('[]')
        if (scalar.has(base) || base === 'Unsupported') {
          scalarFields.push(field)
          continue
        }
        if (modelSet.has(base)) {
          relationFields.push(`${field}${isList ? '[]' : ''}->${base}`)
          continue
        }
        scalarFields.push(field)
      }
      const scalars = scalarFields.slice(0, 10).join(', ')
      const rels = relationFields.slice(0, 10).join(', ')
      lines.push(`- ${m.name}: scalar[${scalars}] relation[${rels}]`)
    }
    if (models.length > maxModels) lines.push(`… +${models.length - maxModels} model lain`)
    return clipText(lines.join('\n'), 4500)
  } catch {
    return ''
  }
}

const PRISMA_SCHEMA_BRIEF = buildPrismaSchemaBriefFromFile()

function safeReadFileText(filePath: string, maxBytes: number) {
  try {
    const st = fs.statSync(filePath)
    if (!st.isFile()) return ''
    if (st.size > maxBytes) return fs.readFileSync(filePath, 'utf8').slice(0, maxBytes)
    return fs.readFileSync(filePath, 'utf8')
  } catch {
    return ''
  }
}

function walkFiles(dir: string, maxDepth: number, out: string[]) {
  if (maxDepth < 0) return
  let items: fs.Dirent[] = []
  try {
    items = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return
  }
  for (const it of items) {
    const full = path.join(dir, it.name)
    if (it.isDirectory()) {
      if (it.name === 'node_modules' || it.name === '.next' || it.name === '.git') continue
      walkFiles(full, maxDepth - 1, out)
      continue
    }
    out.push(full)
  }
}

function listMainPagesBrief() {
  try {
    const mainDir = path.join(process.cwd(), 'src', 'app', '(main)')
    if (!fs.existsSync(mainDir)) return []
    const files: string[] = []
    walkFiles(mainDir, 4, files)
    const pages = files.filter((p) => p.endsWith(`${path.sep}page.tsx`) || p.endsWith(`${path.sep}page.ts`))
    const routes = pages
      .map((p) => {
        const rel = path.relative(mainDir, p).replace(/\\/g, '/')
        const dirRel = rel.replace(/\/page\.tsx?$/, '')
        const segs = dirRel.split('/').filter((s) => Boolean(s) && !s.startsWith('('))
        const url = `/${segs.join('/')}`.replace(/\/+$/, '') || '/'
        return url
      })
      .filter((r) => r !== '/')
      .sort()
    return Array.from(new Set(routes))
  } catch {
    return []
  }
}

function parseNavLinksBrief(raw: string) {
  const out: Array<{ name: string; href: string }> = []
  const re = /name:\s*'([^']+)'\s*,\s*href:\s*'([^']+)'/g
  let m: RegExpExecArray | null
  while ((m = re.exec(String(raw || '')))) {
    const name = String(m[1] || '').trim()
    const href = String(m[2] || '').trim()
    if (!name || !href) continue
    out.push({ name, href })
    if (out.length >= 60) break
  }
  return out
}

function listApiRoutesBrief() {
  try {
    const apiDir = path.join(process.cwd(), 'src', 'app', 'api')
    if (!fs.existsSync(apiDir)) return []
    const files: string[] = []
    walkFiles(apiDir, 6, files)
    const routes = files.filter((p) => p.endsWith(`${path.sep}route.ts`) || p.endsWith(`${path.sep}route.js`))
    const out: string[] = []
    for (const filePath of routes) {
      const rel = path.relative(apiDir, filePath).replace(/\\/g, '/')
      const url = `/api/${rel.replace(/\/route\.(ts|js)$/, '')}`
      const txt = safeReadFileText(filePath, 120_000)
      const methods = new Set<string>()
      const re = /export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE)\b/g
      let m: RegExpExecArray | null
      while ((m = re.exec(txt))) methods.add(m[1])
      const meth = Array.from(methods).sort().join(',')
      out.push(`${url}${meth ? `: ${meth}` : ''}`)
      if (out.length >= 120) break
    }
    return out.sort()
  } catch {
    return []
  }
}

function buildAppKnowledgeBriefFromRepo() {
  try {
    const navPath = path.join(process.cwd(), 'src', 'components', 'nav-links.tsx')
    const navRaw = safeReadFileText(navPath, 120_000)
    const nav = parseNavLinksBrief(navRaw)
    const pages = listMainPagesBrief()
    const apis = listApiRoutesBrief()
    const lines: string[] = []
    if (nav.length > 0) {
      lines.push('Nav links (name -> href):')
      for (const it of nav) lines.push(`- ${it.name} -> ${it.href}`)
    }
    if (pages.length > 0) {
      lines.push('Main pages (src/app/(main)):')
      for (const r of pages.slice(0, 80)) lines.push(`- ${r}`)
      if (pages.length > 80) lines.push(`… +${pages.length - 80} page lain`)
    }
    if (apis.length > 0) {
      lines.push('API routes (src/app/api):')
      for (const r of apis.slice(0, 120)) lines.push(`- ${r}`)
      if (apis.length > 120) lines.push(`… +${apis.length - 120} api route lain`)
    }
    return clipText(lines.join('\n'), 4500)
  } catch {
    return ''
  }
}

const APP_KNOWLEDGE_BRIEF = buildAppKnowledgeBriefFromRepo()

type KnowledgeChunk = { id: string; text: string; tokens: string[] }

function tokenizeForRag(text: string) {
  const s = String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
  if (!s) return []
  const parts = s.split(/\s+/g).filter(Boolean)
  const out: string[] = []
  for (const p of parts) {
    if (p.length < 3) continue
    if (p.length > 32) continue
    out.push(p)
    if (out.length >= 60) break
  }
  return out
}

function buildKnowledgeBaseChunks() {
  const chunks: KnowledgeChunk[] = []

  try {
    const schemaPath = path.join(process.cwd(), 'prisma', 'schema.prisma')
    const raw = safeReadFileText(schemaPath, 600_000)
    const models = parsePrismaSchemaModels(raw)
    const modelSet = new Set(models.map((m) => m.name))
    const scalar = new Set(['String', 'Int', 'Float', 'Boolean', 'DateTime', 'Decimal', 'Json', 'Bytes', 'BigInt'])
    for (const m of models.slice(0, 160)) {
      const scalarFields: string[] = []
      const relationFields: string[] = []
      for (const fl of m.fieldLines) {
        if (!fl || fl.startsWith('@@') || fl.startsWith('@')) continue
        const tok = fl.split(/\s+/)
        if (tok.length < 2) continue
        const field = tok[0]
        const typeTok = tok[1]
        if (!field || field.startsWith('@')) continue
        const base = typeTok.replace(/\?$/, '').replace(/\[\]$/, '')
        const isList = typeTok.endsWith('[]')
        if (scalar.has(base) || base === 'Unsupported') {
          scalarFields.push(field)
          continue
        }
        if (modelSet.has(base)) {
          relationFields.push(`${field}${isList ? '[]' : ''}->${base}`)
          continue
        }
        scalarFields.push(field)
      }
      const text =
        `Schema ${m.name}\n` +
        `scalar: ${scalarFields.slice(0, 24).join(', ')}\n` +
        `relation: ${relationFields.slice(0, 24).join(', ')}`
      chunks.push({ id: `schema:${m.name}`, text, tokens: tokenizeForRag(text) })
    }
  } catch {}

  if (PRISMA_SCHEMA_BRIEF) chunks.push({ id: 'schema:brief', text: PRISMA_SCHEMA_BRIEF, tokens: tokenizeForRag(PRISMA_SCHEMA_BRIEF) })
  if (APP_KNOWLEDGE_BRIEF) chunks.push({ id: 'app:brief', text: APP_KNOWLEDGE_BRIEF, tokens: tokenizeForRag(APP_KNOWLEDGE_BRIEF) })

  const toolsText =
    'Tools ringkas:\n' +
    '- nota_sawit_detail: detail nota sawit by id\n' +
    '- nota_sawit_search: list/cari nota sawit\n' +
    '- nota_sawit_kendaraan_used: kendaraan dipakai nota sawit per range\n' +
    '- kas_transaksi_search: list/cari kas transaksi\n' +
    '- kas_transaksi_detail: detail kas transaksi\n' +
    '- kebun_detail: ringkas kebun + data terbaru\n' +
    '- db_find_many/db_find_unique/db_count/db_compare/db_compare_any/db_raw_select: query generic read-only'
  chunks.push({ id: 'tools:brief', text: toolsText, tokens: tokenizeForRag(toolsText) })

  return chunks
}

const RAG_KB = buildKnowledgeBaseChunks()

function retrieveKnowledgeForQuestion(question: string, maxChars: number, maxChunks: number) {
  const qTokens = tokenizeForRag(question)
  if (qTokens.length === 0) return ''
  const scored = RAG_KB.map((c) => {
    let s = 0
    for (const t of qTokens) {
      if (c.id.toLowerCase().includes(t)) s += 4
      if (c.tokens.includes(t)) s += 2
      else if (c.text.toLowerCase().includes(t)) s += 1
    }
    return { c, s }
  })
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, maxChunks)
    .map((x) => x.c)

  const parts: string[] = []
  let used = 0
  for (const c of scored) {
    const block = clipText(String(c.text || '').trim(), 900)
    if (!block) continue
    const next = `${block}\n`
    if (used + next.length > maxChars) break
    parts.push(next)
    used += next.length
  }
  return parts.join('\n').trim()
}

type TablePayload = {
  title: string
  columns: string[]
  rows: Array<Array<string | number | null>>
}

type ChatResponse = {
  answer: string
  tables: TablePayload[]
  reasoning?: string[]
}

type ToolRangePreset = 'year_to_date' | 'this_month' | 'prev_month' | 'custom'
type ProfitSortBy = 'ratio' | 'beban' | 'pendapatan'

type ProfitabilityArgs = {
  rangePreset?: ToolRangePreset
  startDate?: string
  endDate?: string
  kebunId?: number
  kebunName?: string
  sortBy?: ProfitSortBy
}

type CostChangeArgs = {
  kebunId?: number
  kebunName?: string
  aStartDate?: string
  aEndDate?: string
  bStartDate?: string
  bEndDate?: string
}

type KebunKinerjaAnalisisArgs = {
  rangePreset?: 'today' | 'this_month' | 'prev_month' | 'year_to_date' | 'custom'
  startDate?: string
  endDate?: string
  kebunId?: number
  kebunName?: string
  includeKeywords?: string[]
  excludeKeywords?: string[]
  topN?: number
}

type KebunBiayaNaikAnalisisArgs = {
  kebunId?: number
  kebunName?: string
  includeKeywords?: string[]
  excludeKeywords?: string[]
  topN?: number
}

type KendaraanBiayaAnalisisArgs = {
  rangePreset?: 'today' | 'this_month' | 'prev_month' | 'year_to_date' | 'custom'
  startDate?: string
  endDate?: string
  kendaraanPlatNomor?: string
  includeKeywords?: string[]
  excludeKeywords?: string[]
  topN?: number
}

type KaryawanGajiAnalisisArgs = {
  rangePreset?: 'today' | 'this_month' | 'prev_month' | 'year_to_date' | 'custom'
  startDate?: string
  endDate?: string
  kebunId?: number
  kebunName?: string
  karyawanId?: number
  karyawanName?: string
  includeKeywords?: string[]
  excludeKeywords?: string[]
  topN?: number
}

type NotaSawitCountArgs = {
  rangePreset?: 'today' | 'this_month' | 'year_to_date' | 'custom'
  startDate?: string
  endDate?: string
  kebunId?: number
  kebunName?: string
}

type NotaSawitKendaraanUsedArgs = {
  rangePreset?: 'today' | 'this_month' | 'year_to_date' | 'custom'
  startDate?: string
  endDate?: string
  limit?: number
}

type NotaSawitBeratAkhirArgs = {
  rangePreset?: 'today' | 'this_month' | 'year_to_date' | 'custom'
  startDate?: string
  endDate?: string
  kebunId?: number
  kebunName?: string
  limit?: number
}

type AktivitasHarianArgs = {
  rangePreset?: 'today' | 'custom'
  startDate?: string
  endDate?: string
  kebunId?: number
  kebunName?: string
}

type KasTransaksiSearchArgs = {
  query?: string
  rangePreset?: 'today' | 'this_month' | 'year_to_date' | 'custom'
  startDate?: string
  endDate?: string
  tipe?: 'all' | 'PEMASUKAN' | 'PENGELUARAN'
  kategori?: string
  kebunId?: number
  kebunName?: string
  karyawanId?: number
  karyawanName?: string
  kendaraanPlatNomor?: string
  limit?: number
}

type KasTransaksiSummaryArgs = {
  rangePreset?: 'today' | 'this_month' | 'year_to_date' | 'custom'
  startDate?: string
  endDate?: string
  kebunId?: number
  kebunName?: string
  groupByKategori?: boolean
}

type UangJalanSessionsArgs = {
  rangePreset?: 'today' | 'this_month' | 'year_to_date' | 'custom'
  startDate?: string
  endDate?: string
  status?: string
  supirId?: number
  supirName?: string
  kendaraanPlatNomor?: string
  limit?: number
}

type UangJalanSessionDetailArgs = { sesiId: number }

type GajianSearchArgs = {
  rangePreset?: 'this_month' | 'year_to_date' | 'custom'
  startDate?: string
  endDate?: string
  kebunId?: number
  kebunName?: string
  status?: string
  tipe?: string
  limit?: number
}

type GajianDetailArgs = { gajianId: number; karyawanLimit?: number }

type KaryawanSearchArgs = {
  query?: string
  role?: string
  jobType?: string
  status?: string
  kebunId?: number
  kebunName?: string
  limit?: number
}

type KendaraanSearchArgs = { query?: string; jenis?: string; limit?: number }

type KendaraanExpiringArgs = { days?: number; type?: 'all' | 'stnk' | 'pajak' | 'speksi' | 'trayek' }

type KebunOverviewArgs = {
  rangePreset?: 'this_month' | 'year_to_date' | 'custom'
  startDate?: string
  endDate?: string
  kebunId?: number
  kebunName?: string
}

type KebunListArgs = { query?: string; limit?: number }

type NotaSawitDetailArgs = { notaSawitId: number }
type KasTransaksiDetailArgs = { kasTransaksiId: number }
type KebunDetailArgs = { kebunId?: number; kebunName?: string; recentLimit?: number }

type NotaSawitSearchArgs = {
  query?: string
  rangePreset?: 'today' | 'this_month' | 'year_to_date' | 'custom'
  startDate?: string
  endDate?: string
  kebunId?: number
  kebunName?: string
  supirId?: number
  supirName?: string
  statusPembayaran?: string
  limit?: number
}

function normalizeText(v: string) {
  return String(v || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

function safeNumber(v: unknown) {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : 0
}

function fmtPct(v: number) {
  const n = Number.isFinite(v) ? v : 0
  return `${(n * 100).toFixed(1)}%`
}

function parseIsoDate(v: unknown) {
  const s = String(v || '').trim()
  if (!s) return null
  const d = new Date(s)
  return Number.isFinite(d.getTime()) ? d : null
}

function coerceDateTimeValue(v: unknown): unknown {
  if (v instanceof Date) return v
  if (typeof v !== 'string') return v
  const s = v.trim()
  if (!s) return v
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const d = new Date(`${s}T00:00:00.000Z`)
    return Number.isFinite(d.getTime()) ? d : v
  }
  const d = parseIsoDate(s)
  return d || v
}

function coerceWhereDateTimes(where: any, depth: number): any {
  if (depth <= 0) return where
  if (Array.isArray(where)) return where.map((x) => coerceWhereDateTimes(x, depth - 1))
  if (!where || typeof where !== 'object') return where

  const out: any = {}
  for (const [k, v] of Object.entries(where)) {
    if (k === 'equals' || k === 'lt' || k === 'lte' || k === 'gt' || k === 'gte' || k === 'not') {
      out[k] = coerceDateTimeValue(v)
      continue
    }
    if (k === 'in' || k === 'notIn') {
      out[k] = Array.isArray(v) ? v.map(coerceDateTimeValue) : v
      continue
    }
    out[k] = coerceWhereDateTimes(v, depth - 1)
  }
  return out
}

async function resolveKebunIds(args: { kebunId?: number; kebunName?: string }) {
  const kebunRows = await prisma.kebun.findMany({ select: { id: true, name: true } })
  const byId = new Map<number, string>()
  for (const k of kebunRows) byId.set(k.id, k.name)

  if (args.kebunId && byId.has(Number(args.kebunId))) {
    return { kebunIds: [Number(args.kebunId)], kebunNameById: byId }
  }

  const nameNorm = normalizeText(String(args.kebunName || ''))
  if (nameNorm) {
    const hit = kebunRows
      .map((k) => ({ id: k.id, nameNorm: normalizeText(k.name) }))
      .find((k) => k.nameNorm === nameNorm || k.nameNorm.includes(nameNorm) || nameNorm.includes(k.nameNorm))
    if (hit) return { kebunIds: [hit.id], kebunNameById: byId }
  }

  return { kebunIds: null as number[] | null, kebunNameById: byId }
}

async function findKebunScope(message: string) {
  const norm = normalizeText(message)
  const idMatch = norm.match(/\bkebun\s*#?\s*(\d+)\b/)
  const kebunId = idMatch?.[1] ? Number(idMatch[1]) : null
  const kebunRows = await prisma.kebun.findMany({ select: { id: true, name: true } })
  const byId = new Map<number, string>()
  for (const k of kebunRows) byId.set(k.id, k.name)
  if (kebunId && byId.has(kebunId)) return { kebunIds: [kebunId], kebunNameById: byId }

  const matched = kebunRows
    .map((k) => ({ id: k.id, name: k.name, nameNorm: normalizeText(k.name) }))
    .filter((k) => k.nameNorm && norm.includes(k.nameNorm))
    .slice(0, 1)
  if (matched.length > 0) return { kebunIds: [matched[0].id], kebunNameById: byId }
  return { kebunIds: null as number[] | null, kebunNameById: byId }
}

function yearToDateRangeUtc() {
  const { year, month, day } = getCurrentWIBDateParts()
  const start = createWIBDate(year, 0, 1)
  const end = createWIBDate(year, month, day, true)
  return { start, end, label: `Tahun ${year} (s.d hari ini)` }
}

function monthRangeUtc(year: number, monthIndex: number) {
  const start = createWIBDate(year, monthIndex, 1)
  const end = createWIBDate(year, monthIndex + 1, 0, true)
  return { start, end }
}

function thisMonthVsPrevMonthUtc() {
  const { year, month } = getCurrentWIBDateParts()
  const a = monthRangeUtc(year, month)
  const prevMonth = month - 1
  const prevYear = prevMonth < 0 ? year - 1 : year
  const prevMonthIdx = (prevMonth + 12) % 12
  const b = monthRangeUtc(prevYear, prevMonthIdx)
  return { thisMonth: { ...a, label: 'Bulan ini' }, prevMonth: { ...b, label: 'Bulan lalu' } }
}

function todayRangeUtc() {
  const { year, month, day } = getCurrentWIBDateParts()
  const start = createWIBDate(year, month, day)
  const end = createWIBDate(year, month, day, true)
  return { start, end, label: 'Hari ini' }
}

function resolveRange(preset: string | undefined, startDate?: string, endDate?: string) {
  const p = String(preset || '').trim()
  const today = todayRangeUtc()
  const { thisMonth, prevMonth } = thisMonthVsPrevMonthUtc()
  const ytd = yearToDateRangeUtc()
  const customStart = parseIsoDate(startDate)
  const customEnd = parseIsoDate(endDate)

  if (p === 'custom' && customStart && customEnd) return { start: customStart, end: customEnd, label: 'Custom' }
  if (p === 'this_month') return { start: thisMonth.start, end: thisMonth.end, label: thisMonth.label }
  if (p === 'prev_month') return { start: prevMonth.start, end: prevMonth.end, label: prevMonth.label }
  if (p === 'year_to_date') return ytd
  if (p === 'today') return today
  return ytd
}

function normalizeKeywordList(v: unknown) {
  if (Array.isArray(v)) {
    return v
      .map((x) => String(x || '').trim())
      .filter(Boolean)
      .slice(0, 8)
  }
  const s = String(v || '').trim()
  if (!s) return []
  return s
    .split(/[;,|]/g)
    .map((x) => String(x || '').trim())
    .filter(Boolean)
    .slice(0, 8)
}

function sqlIlikeAny(fields: Prisma.Sql[], keywords: string[]) {
  const ks = normalizeKeywordList(keywords)
  if (ks.length === 0) return Prisma.empty
  const ors: Prisma.Sql[] = []
  for (const kw of ks) {
    const pat = `%${kw}%`
    for (const f of fields) {
      ors.push(Prisma.sql`${f} ILIKE ${pat}`)
    }
  }
  if (ors.length === 0) return Prisma.empty
  return Prisma.sql`(${Prisma.join(ors, ' OR ')})`
}

function sqlNotIlikeAny(fields: Prisma.Sql[], keywords: string[]) {
  const ks = normalizeKeywordList(keywords)
  if (ks.length === 0) return Prisma.empty
  const expr = sqlIlikeAny(fields, ks)
  if (expr === Prisma.empty) return Prisma.empty
  return Prisma.sql`NOT ${expr}`
}

function inferRangeFromQuestion(message: string) {
  const norm = normalizeText(message)
  const today = todayRangeUtc()
  const { thisMonth, prevMonth } = thisMonthVsPrevMonthUtc()
  const ytd = yearToDateRangeUtc()
  if (norm.includes('hari ini')) return { start: today.start, end: today.end, label: today.label }
  if (norm.includes('kemarin')) {
    const d = new Date(today.start.getTime() - 24 * 60 * 60 * 1000)
    const start = new Date(d)
    start.setUTCHours(0, 0, 0, 0)
    const end = new Date(d)
    end.setUTCHours(23, 59, 59, 999)
    return { start, end, label: 'Kemarin' }
  }
  if (norm.includes('bulan lalu')) return { start: prevMonth.start, end: prevMonth.end, label: prevMonth.label }
  if (norm.includes('bulan ini')) return { start: thisMonth.start, end: thisMonth.end, label: thisMonth.label }
  if (norm.includes('tahun ini') || norm.includes('year to date') || norm.includes('ytd')) return ytd
  const m = norm.match(/\b(\d{4}-\d{2}-\d{2})\b/)
  if (m?.[1]) {
    const d = parseIsoDate(`${m[1]}T00:00:00.000Z`)
    if (d) {
      const start = new Date(d)
      const end = new Date(d)
      end.setUTCHours(23, 59, 59, 999)
      return { start, end, label: m[1] }
    }
  }
  return null
}

async function resolveUserIds(args: { userId?: number; userName?: string; role?: string }) {
  const userId = args.userId ? Number(args.userId) : null
  if (userId && userId > 0) return { userIds: [userId] }
  const nameNorm = String(args.userName || '').trim()
  if (!nameNorm) return { userIds: null as number[] | null }
  const where: any = { name: { contains: nameNorm, mode: 'insensitive' } }
  if (args.role) where.role = String(args.role)
  const rows = await prisma.user.findMany({ where, take: 10, select: { id: true } })
  const ids = rows.map((r) => Number(r.id)).filter((n) => Number.isFinite(n) && n > 0)
  if (ids.length === 0) return { userIds: null as number[] | null }
  return { userIds: ids }
}

async function getRevenueByKebun(range: { start: Date; end: Date }, kebunIds: number[] | null) {
  const where: any = {
    deletedAt: null,
    kebunId: { not: null },
    OR: [{ tanggalBongkar: { gte: range.start, lte: range.end } }, { tanggalBongkar: null, createdAt: { gte: range.start, lte: range.end } }],
  }
  if (kebunIds) where.kebunId = { in: kebunIds }
  const rows = await prisma.notaSawit.groupBy({
    by: ['kebunId'],
    where,
    _sum: { pembayaranSetelahPph: true },
  })
  return rows.map((r) => ({ kebunId: Number(r.kebunId || 0), revenue: safeNumber(r._sum.pembayaranSetelahPph) }))
}

async function getPekerjaanCostByKebun(range: { start: Date; end: Date }, kebunIds: number[] | null) {
  const where: any = { date: { gte: range.start, lte: range.end } }
  if (kebunIds) where.kebunId = { in: kebunIds }
  const rows = await prisma.pekerjaanKebun.groupBy({
    by: ['kebunId'],
    where,
    _sum: { biaya: true },
  })
  return rows.map((r) => ({ kebunId: Number(r.kebunId || 0), cost: safeNumber(r._sum.biaya) }))
}

async function getGajianCostByKebun(range: { start: Date; end: Date }, kebunIds: number[] | null) {
  const where: any = { tanggalMulai: { lte: range.end }, tanggalSelesai: { gte: range.start } }
  if (kebunIds) where.kebunId = { in: kebunIds }
  const rows = await prisma.gajian.groupBy({
    by: ['kebunId'],
    where,
    _sum: { totalGaji: true, totalBiayaLain: true },
  })
  return rows.map((r) => ({
    kebunId: Number(r.kebunId || 0),
    cost: safeNumber(r._sum.totalGaji) + safeNumber(r._sum.totalBiayaLain),
  }))
}

async function getKasCostResolvedByKebun(range: { start: Date; end: Date }, kebunIds: number[] | null) {
  const kebunFilterSql =
    kebunIds && kebunIds.length > 0
      ? Prisma.sql`AND COALESCE(t."kebunId", NULLIF((regexp_match(COALESCE(t."keterangan", ''), '\\[KEBUN:(\\d+)\\]'))[1], '')::int) IN (${Prisma.join(kebunIds)})`
      : Prisma.empty

  const rows = await prisma.$queryRaw<Array<{ kebunId: number; total: number }>>(
    Prisma.sql`
      SELECT
        COALESCE(t."kebunId", NULLIF((regexp_match(COALESCE(t."keterangan", ''), '\\[KEBUN:(\\d+)\\]'))[1], '')::int) AS "kebunId",
        COALESCE(SUM(t."jumlah"), 0) AS "total"
      FROM "KasTransaksi" t
      WHERE t."deletedAt" IS NULL
        AND UPPER(COALESCE(t."tipe", '')) = 'PENGELUARAN'
        AND t."date" >= ${range.start}
        AND t."date" <= ${range.end}
        AND (
          t."kebunId" IS NOT NULL
          OR UPPER(COALESCE(t."kategori", '')) = 'KEBUN'
          OR COALESCE(t."keterangan", '') ~ '\\[KEBUN:(\\d+)\\]'
        )
        ${kebunFilterSql}
      GROUP BY 1
    `,
  )
  return (rows || [])
    .filter((r) => Number.isFinite(Number((r as any).kebunId)) && Number((r as any).kebunId) > 0)
    .map((r) => ({ kebunId: Number((r as any).kebunId), cost: safeNumber((r as any).total) }))
}

function mergeByKebun(...lists: Array<Array<{ kebunId: number } & Record<string, any>>>) {
  const map = new Map<number, any>()
  for (const list of lists) {
    for (const r of list) {
      const id = Number(r.kebunId || 0)
      if (!id) continue
      const prev = map.get(id) || { kebunId: id }
      map.set(id, { ...prev, ...r })
    }
  }
  return Array.from(map.values()) as Array<any>
}

async function reportProfitability(message: string): Promise<ChatResponse> {
  const scope = await findKebunScope(message)
  const range = yearToDateRangeUtc()

  const [rev, pekerjaan, gajian, kas] = await Promise.all([
    getRevenueByKebun(range, scope.kebunIds),
    getPekerjaanCostByKebun(range, scope.kebunIds),
    getGajianCostByKebun(range, scope.kebunIds),
    getKasCostResolvedByKebun(range, scope.kebunIds),
  ])

  const merged = mergeByKebun(
    rev.map((r) => ({ kebunId: r.kebunId, pendapatan: r.revenue })),
    pekerjaan.map((r) => ({ kebunId: r.kebunId, biayaBorongan: r.cost })),
    gajian.map((r) => ({ kebunId: r.kebunId, gajianHarian: r.cost })),
    kas.map((r) => ({ kebunId: r.kebunId, kasPengeluaran: r.cost })),
  )

  const rows = merged
    .map((r) => {
      const pendapatan = safeNumber(r.pendapatan)
      const biayaBorongan = safeNumber(r.biayaBorongan)
      const gajianHarian = safeNumber(r.gajianHarian)
      const kasPengeluaran = safeNumber(r.kasPengeluaran)
      const beban = biayaBorongan + gajianHarian + kasPengeluaran
      const ratio = pendapatan > 0 ? beban / pendapatan : 0
      const margin = pendapatan - beban
      return {
        kebunId: Number(r.kebunId),
        kebun: scope.kebunNameById.get(Number(r.kebunId)) || `#${r.kebunId}`,
        pendapatan,
        beban,
        ratio,
        margin,
      }
    })
    .sort((a, b) => b.ratio - a.ratio)

  const totalPendapatan = rows.reduce((s, r) => s + r.pendapatan, 0)
  const totalBeban = rows.reduce((s, r) => s + r.beban, 0)
  const totalMargin = totalPendapatan - totalBeban
  const totalRatio = totalPendapatan > 0 ? totalBeban / totalPendapatan : 0

  const table: TablePayload = {
    title: `Beban Produksi vs Pendapatan Kebun (${range.label})`,
    columns: ['Kebun', 'Pendapatan (setelah PPh)', 'Beban Produksi', 'Rasio Beban', 'Margin'],
    rows: rows.map((r) => [r.kebun, formatIdCurrency(r.pendapatan), formatIdCurrency(r.beban), fmtPct(r.ratio), formatIdCurrency(r.margin)]),
  }

  return {
    answer: `Total ${range.label}: Pendapatan ${formatIdCurrency(totalPendapatan)}, Beban ${formatIdCurrency(totalBeban)}, Rasio ${fmtPct(totalRatio)}, Margin ${formatIdCurrency(totalMargin)}.`,
    tables: [table],
  }
}

async function reportProfitabilityByArgs(args: ProfitabilityArgs): Promise<ChatResponse> {
  const scope = await resolveKebunIds({ kebunId: args.kebunId, kebunName: args.kebunName })
  const sortBy: ProfitSortBy = args.sortBy || 'ratio'
  const preset: ToolRangePreset = args.rangePreset || 'year_to_date'

  const yearRange = yearToDateRangeUtc()
  const customStart = parseIsoDate(args.startDate)
  const customEnd = parseIsoDate(args.endDate)
  const { thisMonth, prevMonth } = thisMonthVsPrevMonthUtc()

  const range =
    preset === 'custom' && customStart && customEnd
      ? { start: customStart, end: customEnd, label: 'Custom' }
      : preset === 'this_month'
        ? { start: thisMonth.start, end: thisMonth.end, label: 'Bulan ini' }
        : preset === 'prev_month'
          ? { start: prevMonth.start, end: prevMonth.end, label: 'Bulan lalu' }
          : yearRange

  const [rev, pekerjaan, gajian, kas] = await Promise.all([
    getRevenueByKebun(range, scope.kebunIds),
    getPekerjaanCostByKebun(range, scope.kebunIds),
    getGajianCostByKebun(range, scope.kebunIds),
    getKasCostResolvedByKebun(range, scope.kebunIds),
  ])

  const merged = mergeByKebun(
    rev.map((r) => ({ kebunId: r.kebunId, pendapatan: r.revenue })),
    pekerjaan.map((r) => ({ kebunId: r.kebunId, biayaBorongan: r.cost })),
    gajian.map((r) => ({ kebunId: r.kebunId, gajianHarian: r.cost })),
    kas.map((r) => ({ kebunId: r.kebunId, kasPengeluaran: r.cost })),
  )

  const rows = merged.map((r) => {
    const pendapatan = safeNumber(r.pendapatan)
    const biayaBorongan = safeNumber(r.biayaBorongan)
    const gajianHarian = safeNumber(r.gajianHarian)
    const kasPengeluaran = safeNumber(r.kasPengeluaran)
    const beban = biayaBorongan + gajianHarian + kasPengeluaran
    const ratio = pendapatan > 0 ? beban / pendapatan : 0
    const margin = pendapatan - beban
    return {
      kebunId: Number(r.kebunId),
      kebun: scope.kebunNameById.get(Number(r.kebunId)) || `#${r.kebunId}`,
      pendapatan,
      beban,
      ratio,
      margin,
    }
  })

  rows.sort((a, b) => {
    if (sortBy === 'beban') return b.beban - a.beban
    if (sortBy === 'pendapatan') return b.pendapatan - a.pendapatan
    return b.ratio - a.ratio
  })

  const totalPendapatan = rows.reduce((s, r) => s + r.pendapatan, 0)
  const totalBeban = rows.reduce((s, r) => s + r.beban, 0)
  const totalMargin = totalPendapatan - totalBeban
  const totalRatio = totalPendapatan > 0 ? totalBeban / totalPendapatan : 0

  const table: TablePayload = {
    title: `Beban Produksi vs Pendapatan Kebun (${range.label})`,
    columns: ['Kebun', 'Pendapatan (setelah PPh)', 'Beban Produksi', 'Rasio Beban', 'Margin'],
    rows: rows.map((r) => [r.kebun, formatIdCurrency(r.pendapatan), formatIdCurrency(r.beban), fmtPct(r.ratio), formatIdCurrency(r.margin)]),
  }

  return {
    answer: `Total ${range.label}: Pendapatan ${formatIdCurrency(totalPendapatan)}, Beban ${formatIdCurrency(totalBeban)}, Rasio ${fmtPct(totalRatio)}, Margin ${formatIdCurrency(totalMargin)}.`,
    tables: [table],
  }
}

async function kasKategoriTotals(range: { start: Date; end: Date }, kebunIds: number[] | null) {
  const kebunFilterSql =
    kebunIds && kebunIds.length > 0
      ? Prisma.sql`AND COALESCE(t."kebunId", NULLIF((regexp_match(COALESCE(t."keterangan", ''), '\\[KEBUN:(\\d+)\\]'))[1], '')::int) IN (${Prisma.join(kebunIds)})`
      : Prisma.empty
  const rows = await prisma.$queryRaw<Array<{ kategori: string | null; total: number }>>(
    Prisma.sql`
      SELECT
        UPPER(COALESCE(t."kategori", 'UMUM')) AS kategori,
        COALESCE(SUM(t."jumlah"), 0) AS total
      FROM "KasTransaksi" t
      WHERE t."deletedAt" IS NULL
        AND UPPER(COALESCE(t."tipe", '')) = 'PENGELUARAN'
        AND t."date" >= ${range.start}
        AND t."date" <= ${range.end}
        AND (
          t."kebunId" IS NOT NULL
          OR COALESCE(t."keterangan", '') ~ '\\[KEBUN:(\\d+)\\]'
        )
        ${kebunFilterSql}
      GROUP BY 1
    `,
  )
  return (rows || []).map((r) => ({ key: String((r as any).kategori || 'UMUM'), total: safeNumber((r as any).total) }))
}

async function kasKategoriTotalsFiltered(
  range: { start: Date; end: Date },
  kebunIds: number[] | null,
  includeKeywords: string[],
  excludeKeywords: string[],
) {
  const kebunFilterSql =
    kebunIds && kebunIds.length > 0
      ? Prisma.sql`AND COALESCE(t."kebunId", NULLIF((regexp_match(COALESCE(t."keterangan", ''), '\\[KEBUN:(\\d+)\\]'))[1], '')::int) IN (${Prisma.join(kebunIds)})`
      : Prisma.empty

  const fields = [
    Prisma.sql`COALESCE(t."kategori", '')`,
    Prisma.sql`COALESCE(t."keterangan", '')`,
    Prisma.sql`COALESCE(t."deskripsi", '')`,
  ]
  const inc = sqlIlikeAny(fields, includeKeywords)
  const exc = sqlNotIlikeAny(fields, excludeKeywords)
  const incSql = inc === Prisma.empty ? Prisma.empty : Prisma.sql`AND ${inc}`
  const excSql = exc === Prisma.empty ? Prisma.empty : Prisma.sql`AND ${exc}`

  const rows = await prisma.$queryRaw<Array<{ kategori: string | null; total: number }>>(
    Prisma.sql`
      SELECT
        UPPER(COALESCE(t."kategori", 'UMUM')) AS kategori,
        COALESCE(SUM(t."jumlah"), 0) AS total
      FROM "KasTransaksi" t
      WHERE t."deletedAt" IS NULL
        AND UPPER(COALESCE(t."tipe", '')) = 'PENGELUARAN'
        AND t."date" >= ${range.start}
        AND t."date" <= ${range.end}
        AND (
          t."kebunId" IS NOT NULL
          OR UPPER(COALESCE(t."kategori", '')) = 'KEBUN'
          OR COALESCE(t."keterangan", '') ~ '\\[KEBUN:(\\d+)\\]'
        )
        ${kebunFilterSql}
        ${incSql}
        ${excSql}
      GROUP BY 1
    `,
  )
  return (rows || []).map((r) => ({ key: String((r as any).kategori || 'UMUM'), total: safeNumber((r as any).total) }))
}

async function pekerjaanJenisTotals(range: { start: Date; end: Date }, kebunIds: number[] | null) {
  const where: any = { date: { gte: range.start, lte: range.end } }
  if (kebunIds) where.kebunId = { in: kebunIds }
  const rows = await prisma.pekerjaanKebun.groupBy({
    by: ['jenisPekerjaan'],
    where,
    _sum: { biaya: true },
  })
  return rows.map((r) => ({ key: String(r.jenisPekerjaan || '-'), total: safeNumber(r._sum.biaya) }))
}

async function pekerjaanJenisTotalsFiltered(
  range: { start: Date; end: Date },
  kebunIds: number[] | null,
  includeKeywords: string[],
  excludeKeywords: string[],
) {
  const where: any = { date: { gte: range.start, lte: range.end } }
  if (kebunIds) where.kebunId = { in: kebunIds }
  const inc = normalizeKeywordList(includeKeywords)
  const exc = normalizeKeywordList(excludeKeywords)
  if (inc.length > 0) {
    where.OR = inc.map((k) => ({
      OR: [
        { jenisPekerjaan: { contains: k, mode: 'insensitive' } },
        { kategoriBorongan: { contains: k, mode: 'insensitive' } },
      ],
    }))
  }
  if (exc.length > 0) {
    where.AND = (where.AND || []).concat([
      {
        NOT: exc.map((k) => ({
          OR: [
            { jenisPekerjaan: { contains: k, mode: 'insensitive' } },
            { kategoriBorongan: { contains: k, mode: 'insensitive' } },
          ],
        })),
      },
    ])
  }
  const rows = await prisma.pekerjaanKebun.groupBy({
    by: ['jenisPekerjaan'],
    where,
    _sum: { biaya: true },
  })
  return rows.map((r) => ({ key: String(r.jenisPekerjaan || '-'), total: safeNumber(r._sum.biaya) }))
}

async function gajianTotals(range: { start: Date; end: Date }, kebunIds: number[] | null) {
  const where: any = { tanggalMulai: { lte: range.end }, tanggalSelesai: { gte: range.start } }
  if (kebunIds) where.kebunId = { in: kebunIds }
  const agg = await prisma.gajian.aggregate({
    where,
    _sum: { totalGaji: true, totalBiayaLain: true },
  })
  const total = safeNumber(agg._sum.totalGaji) + safeNumber(agg._sum.totalBiayaLain)
  return total
}

async function gajianTipeTotalsFiltered(
  range: { start: Date; end: Date },
  kebunIds: number[] | null,
  includeKeywords: string[],
  excludeKeywords: string[],
) {
  const where: any = { tanggalMulai: { lte: range.end }, tanggalSelesai: { gte: range.start } }
  if (kebunIds) where.kebunId = { in: kebunIds }
  const inc = normalizeKeywordList(includeKeywords)
  const exc = normalizeKeywordList(excludeKeywords)
  if (inc.length > 0) where.OR = inc.map((k) => ({ tipe: { contains: k, mode: 'insensitive' } }))
  if (exc.length > 0) where.AND = (where.AND || []).concat([{ NOT: exc.map((k) => ({ tipe: { contains: k, mode: 'insensitive' } })) }])

  const rows = await prisma.gajian.groupBy({
    by: ['tipe'],
    where,
    _sum: { totalGaji: true, totalBiayaLain: true },
    _count: { _all: true },
  })
  return (rows || []).map((r: any) => ({
    key: String(r.tipe || '-'),
    count: safeNumber(r._count?._all),
    total: safeNumber(r._sum?.totalGaji) + safeNumber(r._sum?.totalBiayaLain),
  }))
}

async function reportCostChangeExplain(message: string): Promise<ChatResponse> {
  const scope = await findKebunScope(message)
  const { thisMonth, prevMonth } = thisMonthVsPrevMonthUtc()

  const [kasA, kasB, pekA, pekB, gA, gB] = await Promise.all([
    kasKategoriTotals(thisMonth, scope.kebunIds),
    kasKategoriTotals(prevMonth, scope.kebunIds),
    pekerjaanJenisTotals(thisMonth, scope.kebunIds),
    pekerjaanJenisTotals(prevMonth, scope.kebunIds),
    gajianTotals(thisMonth, scope.kebunIds),
    gajianTotals(prevMonth, scope.kebunIds),
  ])

  const sumKasA = kasA.reduce((s, r) => s + r.total, 0)
  const sumKasB = kasB.reduce((s, r) => s + r.total, 0)
  const sumPekA = pekA.reduce((s, r) => s + r.total, 0)
  const sumPekB = pekB.reduce((s, r) => s + r.total, 0)

  const totalA = sumKasA + sumPekA + gA
  const totalB = sumKasB + sumPekB + gB
  const delta = totalA - totalB
  const absDelta = Math.abs(delta)

  const drivers: Array<{ sebab: string; a: number; b: number; d: number }> = []
  drivers.push({ sebab: 'Gajian Harian', a: gA, b: gB, d: gA - gB })

  const kasKeys = Array.from(new Set([...kasA.map((x) => x.key), ...kasB.map((x) => x.key)]))
  for (const k of kasKeys) {
    const a = kasA.find((x) => x.key === k)?.total ?? 0
    const b = kasB.find((x) => x.key === k)?.total ?? 0
    drivers.push({ sebab: `Kas: ${k}`, a, b, d: a - b })
  }

  const pekKeys = Array.from(new Set([...pekA.map((x) => x.key), ...pekB.map((x) => x.key)]))
  for (const k of pekKeys) {
    const a = pekA.find((x) => x.key === k)?.total ?? 0
    const b = pekB.find((x) => x.key === k)?.total ?? 0
    drivers.push({ sebab: `Borongan: ${k}`, a, b, d: a - b })
  }

  drivers.sort((x, y) => Math.abs(y.d) - Math.abs(x.d))
  const top = drivers.slice(0, 12).filter((x) => x.a !== 0 || x.b !== 0)

  const table: TablePayload = {
    title: `Kenapa biaya berubah (${thisMonth.label} vs ${prevMonth.label})`,
    columns: ['Penyebab', thisMonth.label, prevMonth.label, 'Selisih', 'Kontribusi'],
    rows: top.map((r) => {
      const contrib = absDelta > 0 ? Math.abs(r.d) / absDelta : 0
      const sign = r.d >= 0 ? '+' : '-'
      return [r.sebab, formatIdCurrency(r.a), formatIdCurrency(r.b), `${sign}${formatIdCurrency(Math.abs(r.d))}`, fmtPct(contrib)]
    }),
  }

  const scopeLabel =
    scope.kebunIds && scope.kebunIds.length === 1
      ? `Kebun ${scope.kebunNameById.get(scope.kebunIds[0]) || `#${scope.kebunIds[0]}`}`
      : 'Semua kebun'

  return {
    answer: `${scopeLabel}. Total beban ${thisMonth.label}: ${formatIdCurrency(totalA)}. ${prevMonth.label}: ${formatIdCurrency(totalB)}. Selisih: ${(delta >= 0 ? '+' : '-') + formatIdCurrency(absDelta)}.`,
    tables: [table],
  }
}

async function notaSawitRevenueTotals(range: { start: Date; end: Date }, kebunIds: number[] | null) {
  const where: any = {
    deletedAt: null,
    kebunId: { not: null },
    OR: [{ tanggalBongkar: { gte: range.start, lte: range.end } }, { tanggalBongkar: null, createdAt: { gte: range.start, lte: range.end } }],
  }
  if (kebunIds) where.kebunId = { in: kebunIds }
  const [count, agg] = await Promise.all([
    prisma.notaSawit.count({ where }),
    prisma.notaSawit.aggregate({ where, _sum: { pembayaranSetelahPph: true, netto: true } }),
  ])
  return { count, setelahPph: safeNumber(agg._sum.pembayaranSetelahPph), nettoKg: safeNumber(agg._sum.netto) }
}

async function reportKebunKinerjaAnalisisByArgs(args: KebunKinerjaAnalisisArgs): Promise<ChatResponse> {
  const range = resolveRange(args.rangePreset || 'this_month', args.startDate, args.endDate)
  const scope = await resolveKebunIds({ kebunId: args.kebunId, kebunName: args.kebunName })
  const inc = normalizeKeywordList(args.includeKeywords)
  const exc = normalizeKeywordList(args.excludeKeywords)
  const topN = Math.min(30, Math.max(5, Number(args.topN || 12)))

  const [rev, kasRows, pekRows, gajRows] = await Promise.all([
    notaSawitRevenueTotals(range, scope.kebunIds),
    kasKategoriTotalsFiltered(range, scope.kebunIds, inc, exc),
    pekerjaanJenisTotalsFiltered(range, scope.kebunIds, inc, exc),
    gajianTipeTotalsFiltered(range, scope.kebunIds, inc, exc),
  ])

  const kasTotal = kasRows.reduce((s, r) => s + safeNumber(r.total), 0)
  const pekTotal = pekRows.reduce((s, r) => s + safeNumber(r.total), 0)
  const gajTotal = gajRows.reduce((s, r) => s + safeNumber((r as any).total), 0)
  const beban = kasTotal + pekTotal + gajTotal
  const pendapatan = safeNumber(rev.setelahPph)
  const margin = pendapatan - beban
  const ratio = pendapatan > 0 ? beban / pendapatan : 0

  const scopeLabel =
    scope.kebunIds && scope.kebunIds.length === 1
      ? `Kebun ${scope.kebunNameById.get(scope.kebunIds[0]) || `#${scope.kebunIds[0]}`}`
      : 'Semua kebun'
  const filterLabel = inc.length > 0 || exc.length > 0 ? `Filter biaya: include(${inc.join(', ') || '-'}) exclude(${exc.join(', ') || '-'})` : 'Filter biaya: (tanpa filter)'

  const summary: TablePayload = {
    title: 'Data',
    columns: ['Item', range.label],
    rows: [
      ['Pendapatan (setelah PPh)', formatIdCurrency(pendapatan)],
      ['Beban Operasional (filter)', formatIdCurrency(beban)],
      ['Rasio Beban', fmtPct(ratio)],
      ['Margin', formatIdCurrency(margin)],
      ['Produksi (netto kg)', formatIdNumber(rev.nettoKg)],
      ['Jumlah Nota', safeNumber(rev.count)],
    ],
  }

  const breakdownRows: Array<[string, number]> = []
  for (const r of kasRows) breakdownRows.push([`Kas: ${r.key}`, safeNumber(r.total)])
  for (const r of pekRows) breakdownRows.push([`Borongan: ${r.key}`, safeNumber(r.total)])
  for (const r of gajRows as any[]) breakdownRows.push([`Gajian: ${String(r.key || '-')}`, safeNumber(r.total)])
  breakdownRows.sort((a, b) => b[1] - a[1])
  const breakdown: TablePayload = {
    title: 'Data',
    columns: ['Komponen', range.label],
    rows: breakdownRows.filter((r) => r[1] !== 0).slice(0, topN).map((r) => [r[0], formatIdCurrency(r[1])]),
  }

  return {
    answer: `${scopeLabel}. ${range.label}: pendapatan ${formatIdCurrency(pendapatan)}, beban operasional ${formatIdCurrency(beban)}, rasio ${fmtPct(ratio)}, margin ${formatIdCurrency(margin)}. ${filterLabel}.`,
    tables: [summary, breakdown],
  }
}

async function reportKebunBiayaNaikAnalisisByArgs(args: KebunBiayaNaikAnalisisArgs): Promise<ChatResponse> {
  const scope = await resolveKebunIds({ kebunId: args.kebunId, kebunName: args.kebunName })
  const { thisMonth, prevMonth } = thisMonthVsPrevMonthUtc()
  const inc = normalizeKeywordList(args.includeKeywords)
  const exc = normalizeKeywordList(args.excludeKeywords)
  const topN = Math.min(30, Math.max(6, Number(args.topN || 12)))

  const [revA, revB, kasA, kasB, pekA, pekB, gA, gB] = await Promise.all([
    notaSawitRevenueTotals(thisMonth, scope.kebunIds),
    notaSawitRevenueTotals(prevMonth, scope.kebunIds),
    kasKategoriTotalsFiltered(thisMonth, scope.kebunIds, inc, exc),
    kasKategoriTotalsFiltered(prevMonth, scope.kebunIds, inc, exc),
    pekerjaanJenisTotalsFiltered(thisMonth, scope.kebunIds, inc, exc),
    pekerjaanJenisTotalsFiltered(prevMonth, scope.kebunIds, inc, exc),
    gajianTipeTotalsFiltered(thisMonth, scope.kebunIds, inc, exc),
    gajianTipeTotalsFiltered(prevMonth, scope.kebunIds, inc, exc),
  ])

  const sumKasA = kasA.reduce((s, r) => s + r.total, 0)
  const sumKasB = kasB.reduce((s, r) => s + r.total, 0)
  const sumPekA = pekA.reduce((s, r) => s + r.total, 0)
  const sumPekB = pekB.reduce((s, r) => s + r.total, 0)
  const sumGajA = (gA as any[]).reduce((s, r) => s + safeNumber(r.total), 0)
  const sumGajB = (gB as any[]).reduce((s, r) => s + safeNumber(r.total), 0)

  const totalA = sumKasA + sumPekA + sumGajA
  const totalB = sumKasB + sumPekB + sumGajB
  const delta = totalA - totalB
  const absDelta = Math.abs(delta)

  const drivers: Array<{ sebab: string; a: number; b: number; d: number }> = []
  const kasKeys = Array.from(new Set([...kasA.map((x) => x.key), ...kasB.map((x) => x.key)]))
  for (const k of kasKeys) {
    const a = kasA.find((x) => x.key === k)?.total ?? 0
    const b = kasB.find((x) => x.key === k)?.total ?? 0
    drivers.push({ sebab: `Kas: ${k}`, a, b, d: a - b })
  }
  const pekKeys = Array.from(new Set([...pekA.map((x) => x.key), ...pekB.map((x) => x.key)]))
  for (const k of pekKeys) {
    const a = pekA.find((x) => x.key === k)?.total ?? 0
    const b = pekB.find((x) => x.key === k)?.total ?? 0
    drivers.push({ sebab: `Borongan: ${k}`, a, b, d: a - b })
  }
  const gKeys = Array.from(new Set([...(gA as any[]).map((x) => String(x.key || '-')), ...(gB as any[]).map((x) => String(x.key || '-'))]))
  for (const k of gKeys) {
    const a = (gA as any[]).find((x) => String(x.key || '-') === k)?.total ?? 0
    const b = (gB as any[]).find((x) => String(x.key || '-') === k)?.total ?? 0
    drivers.push({ sebab: `Gajian: ${k}`, a: safeNumber(a), b: safeNumber(b), d: safeNumber(a) - safeNumber(b) })
  }

  drivers.sort((x, y) => Math.abs(y.d) - Math.abs(x.d))
  const top = drivers.slice(0, topN).filter((x) => x.a !== 0 || x.b !== 0)

  const table: TablePayload = {
    title: 'Data',
    columns: ['Komponen', thisMonth.label, prevMonth.label, 'Selisih', 'Kontribusi'],
    rows: top.map((r) => {
      const contrib = absDelta > 0 ? Math.abs(r.d) / absDelta : 0
      const sign = r.d >= 0 ? '+' : '-'
      return [r.sebab, formatIdCurrency(r.a), formatIdCurrency(r.b), `${sign}${formatIdCurrency(Math.abs(r.d))}`, fmtPct(contrib)]
    }),
  }

  const scopeLabel =
    scope.kebunIds && scope.kebunIds.length === 1
      ? `Kebun ${scope.kebunNameById.get(scope.kebunIds[0]) || `#${scope.kebunIds[0]}`}`
      : 'Semua kebun'
  const filterLabel = inc.length > 0 || exc.length > 0 ? `Filter biaya: include(${inc.join(', ') || '-'}) exclude(${exc.join(', ') || '-'})` : 'Filter biaya: (tanpa filter)'
  const revDelta = safeNumber(revA.setelahPph) - safeNumber(revB.setelahPph)

  return {
    answer: `${scopeLabel}. Beban ${thisMonth.label} ${formatIdCurrency(totalA)} vs ${prevMonth.label} ${formatIdCurrency(totalB)} (selisih ${(delta >= 0 ? '+' : '-') + formatIdCurrency(absDelta)}). Pendapatan setelah PPh selisih ${(revDelta >= 0 ? '+' : '-') + formatIdCurrency(Math.abs(revDelta))}. ${filterLabel}.`,
    tables: [table],
  }
}

function normalizePlatNomor(v: unknown) {
  return compactSpaces(String(v || '').trim()).toUpperCase()
}

function normalizePlatNoSpace(v: unknown) {
  return normalizePlatNomor(v).replace(/\s+/g, '')
}

async function kasKendaraanTotalsFiltered(
  range: { start: Date; end: Date },
  kendaraanPlatNomor: string,
  includeKeywords: string[],
  excludeKeywords: string[],
) {
  const platNoSpace = normalizePlatNoSpace(kendaraanPlatNomor)
  const platFilterSql = platNoSpace
    ? Prisma.sql`AND regexp_replace(UPPER(COALESCE(t."kendaraanPlatNomor", NULLIF((regexp_match(COALESCE(t."keterangan", ''), '\\[KENDARAAN:([^\\]]+)\\]'))[1], ''))), '\\s+', '', 'g') = ${platNoSpace}`
    : Prisma.empty

  const fields = [Prisma.sql`COALESCE(t."kategori", '')`, Prisma.sql`COALESCE(t."keterangan", '')`, Prisma.sql`COALESCE(t."deskripsi", '')`]
  const inc = sqlIlikeAny(fields, includeKeywords)
  const exc = sqlNotIlikeAny(fields, excludeKeywords)
  const incSql = inc === Prisma.empty ? Prisma.empty : Prisma.sql`AND ${inc}`
  const excSql = exc === Prisma.empty ? Prisma.empty : Prisma.sql`AND ${exc}`

  const rows = await prisma.$queryRaw<Array<{ kategori: string | null; total: number }>>(
    Prisma.sql`
      SELECT
        UPPER(COALESCE(t."kategori", 'UMUM')) AS kategori,
        COALESCE(SUM(t."jumlah"), 0) AS total
      FROM "KasTransaksi" t
      WHERE t."deletedAt" IS NULL
        AND UPPER(COALESCE(t."tipe", '')) = 'PENGELUARAN'
        AND t."date" >= ${range.start}
        AND t."date" <= ${range.end}
        AND (
          t."kendaraanPlatNomor" IS NOT NULL
          OR UPPER(COALESCE(t."kategori", '')) = 'KENDARAAN'
          OR COALESCE(t."keterangan", '') ~ '\\[KENDARAAN:([^\\]]+)\\]'
        )
        ${platFilterSql}
        ${incSql}
        ${excSql}
      GROUP BY 1
    `,
  )
  return (rows || []).map((r) => ({ key: String((r as any).kategori || 'UMUM'), total: safeNumber((r as any).total) }))
}

async function kasKendaraanTotalsByPlat(range: { start: Date; end: Date }, topN: number) {
  const rows = await prisma.$queryRaw<Array<{ plat: string | null; total: number }>>(
    Prisma.sql`
      SELECT
        COALESCE(NULLIF(UPPER(COALESCE(t."kendaraanPlatNomor", NULLIF((regexp_match(COALESCE(t."keterangan", ''), '\\[KENDARAAN:([^\\]]+)\\]'))[1], ''))), ''), '-') AS plat,
        COALESCE(SUM(t."jumlah"), 0) AS total
      FROM "KasTransaksi" t
      WHERE t."deletedAt" IS NULL
        AND UPPER(COALESCE(t."tipe", '')) = 'PENGELUARAN'
        AND t."date" >= ${range.start}
        AND t."date" <= ${range.end}
        AND (
          t."kendaraanPlatNomor" IS NOT NULL
          OR UPPER(COALESCE(t."kategori", '')) = 'KENDARAAN'
          OR COALESCE(t."keterangan", '') ~ '\\[KENDARAAN:([^\\]]+)\\]'
        )
      GROUP BY 1
      ORDER BY 2 DESC
      LIMIT ${Math.min(50, Math.max(5, topN))}
    `,
  )
  return (rows || []).map((r) => ({ key: String((r as any).plat || '-'), total: safeNumber((r as any).total) }))
}

async function reportKendaraanBiayaAnalisisByArgs(args: KendaraanBiayaAnalisisArgs): Promise<ChatResponse> {
  const range = resolveRange(args.rangePreset || 'this_month', args.startDate, args.endDate)
  const plat = normalizePlatNomor(args.kendaraanPlatNomor)
  const inc = normalizeKeywordList(args.includeKeywords)
  const exc = normalizeKeywordList(args.excludeKeywords)
  const topN = Math.min(30, Math.max(6, Number(args.topN || 12)))

  if (!plat) {
    const kasByPlat = await kasKendaraanTotalsByPlat(range, topN)
    const kasTotal = kasByPlat.reduce((s, r) => s + safeNumber(r.total), 0)
    const table: TablePayload = {
      title: 'Data',
      columns: ['Kendaraan (tag)', range.label],
      rows: kasByPlat.filter((r) => r.total !== 0).map((r) => [r.key, formatIdCurrency(r.total)]),
    }
    return {
      answer: `${range.label}. Biaya kendaraan dari transaksi kas (tag kendaraan): ${formatIdCurrency(kasTotal)}. Pilih 1 kendaraan untuk rincian (contoh: "plat BK 1234 AA").`,
      tables: [table],
    }
  }

  const [kasRows, uangJalanAgg, serviceAgg] = await Promise.all([
    kasKendaraanTotalsFiltered(range, plat, inc, exc),
    prisma.uangJalan.aggregate({
      where: {
        deletedAt: null,
        tipe: 'PENGELUARAN',
        date: { gte: range.start, lte: range.end },
        sesiUangJalan: { kendaraanPlatNomor: plat },
      },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    prisma.serviceLog.aggregate({
      where: { date: { gte: range.start, lte: range.end }, kendaraanPlat: plat },
      _sum: { cost: true },
      _count: { _all: true },
    }),
  ])

  const kasTotal = kasRows.reduce((s, r) => s + safeNumber(r.total), 0)
  const ujTotal = safeNumber((uangJalanAgg as any)?._sum?.amount)
  const ujCount = safeNumber((uangJalanAgg as any)?._count?._all)
  const svcTotal = safeNumber((serviceAgg as any)?._sum?.cost)
  const svcCount = safeNumber((serviceAgg as any)?._count?._all)
  const total = kasTotal + ujTotal + svcTotal

  const filterLabel = inc.length > 0 || exc.length > 0 ? `Filter kas: include(${inc.join(', ') || '-'}) exclude(${exc.join(', ') || '-'})` : 'Filter kas: (tanpa filter)'

  const summary: TablePayload = {
    title: 'Data',
    columns: ['Komponen', range.label],
    rows: [
      ['Kas (tag kendaraan)', formatIdCurrency(kasTotal)],
      ['Uang Jalan (pengeluaran)', formatIdCurrency(ujTotal)],
      ['Service Log', formatIdCurrency(svcTotal)],
      ['Total', formatIdCurrency(total)],
      ['Jumlah transaksi uang jalan', ujCount],
      ['Jumlah service log', svcCount],
    ],
  }

  const kasTop = [...kasRows].sort((a, b) => b.total - a.total).filter((r) => r.total !== 0).slice(0, topN)
  const breakdown: TablePayload = {
    title: 'Data',
    columns: ['Kas Kategori', range.label],
    rows: kasTop.map((r) => [r.key, formatIdCurrency(r.total)]),
  }

  return {
    answer: `Kendaraan ${plat}. ${range.label}: total ${formatIdCurrency(total)} (kas ${formatIdCurrency(kasTotal)}, uang jalan ${formatIdCurrency(ujTotal)}, service ${formatIdCurrency(svcTotal)}). ${filterLabel}.`,
    tables: [summary, breakdown],
  }
}

async function gajianKaryawanTotals(range: { start: Date; end: Date }, kebunIds: number[] | null, userIds: number[] | null) {
  const kebunFilterSql = kebunIds && kebunIds.length > 0 ? Prisma.sql`AND g."kebunId" IN (${Prisma.join(kebunIds)})` : Prisma.empty
  const userFilterSql = userIds && userIds.length > 0 ? Prisma.sql`AND dk."userId" IN (${Prisma.join(userIds)})` : Prisma.empty

  const rows = await prisma.$queryRaw<Array<{ userId: number; name: string | null; total: number }>>(
    Prisma.sql`
      SELECT
        dk."userId" AS "userId",
        u."name" AS "name",
        COALESCE(SUM(dk."total"), 0) AS total
      FROM "DetailGajianKaryawan" dk
      JOIN "Gajian" g ON g."id" = dk."gajianId"
      LEFT JOIN "User" u ON u."id" = dk."userId"
      WHERE g."tanggalMulai" <= ${range.end}
        AND g."tanggalSelesai" >= ${range.start}
        ${kebunFilterSql}
        ${userFilterSql}
      GROUP BY 1, 2
    `,
  )
  return (rows || []).map((r) => ({ userId: safeNumber((r as any).userId), name: String((r as any).name || '').trim(), total: safeNumber((r as any).total) }))
}

async function kasGajiKaryawanTotalsFiltered(
  range: { start: Date; end: Date },
  kebunIds: number[] | null,
  userIds: number[] | null,
  includeKeywords: string[],
  excludeKeywords: string[],
) {
  const kebunFilterSql =
    kebunIds && kebunIds.length > 0
      ? Prisma.sql`AND COALESCE(t."kebunId", NULLIF((regexp_match(COALESCE(t."keterangan", ''), '\\[KEBUN:(\\d+)\\]'))[1], '')::int) IN (${Prisma.join(kebunIds)})`
      : Prisma.empty
  const userFilterSql =
    userIds && userIds.length > 0
      ? Prisma.sql`AND COALESCE(t."karyawanId", NULLIF((regexp_match(COALESCE(t."keterangan", ''), '\\[KARYAWAN:(\\d+)\\]'))[1], '')::int) IN (${Prisma.join(userIds)})`
      : Prisma.empty

  const fields = [Prisma.sql`COALESCE(t."kategori", '')`, Prisma.sql`COALESCE(t."keterangan", '')`, Prisma.sql`COALESCE(t."deskripsi", '')`]
  const inc = sqlIlikeAny(fields, includeKeywords)
  const exc = sqlNotIlikeAny(fields, excludeKeywords)
  const incSql = inc === Prisma.empty ? Prisma.empty : Prisma.sql`AND ${inc}`
  const excSql = exc === Prisma.empty ? Prisma.empty : Prisma.sql`AND ${exc}`

  const rows = await prisma.$queryRaw<Array<{ userId: number | null; name: string | null; total: number }>>(
    Prisma.sql`
      SELECT
        COALESCE(t."karyawanId", NULLIF((regexp_match(COALESCE(t."keterangan", ''), '\\[KARYAWAN:(\\d+)\\]'))[1], '')::int) AS "userId",
        u."name" AS "name",
        COALESCE(SUM(t."jumlah"), 0) AS total
      FROM "KasTransaksi" t
      LEFT JOIN "User" u ON u."id" = COALESCE(t."karyawanId", NULLIF((regexp_match(COALESCE(t."keterangan", ''), '\\[KARYAWAN:(\\d+)\\]'))[1], '')::int)
      WHERE t."deletedAt" IS NULL
        AND UPPER(COALESCE(t."tipe", '')) = 'PENGELUARAN'
        AND t."date" >= ${range.start}
        AND t."date" <= ${range.end}
        AND (
          UPPER(COALESCE(t."kategori", '')) = 'GAJI'
          OR t."gajianId" IS NOT NULL
          OR t."karyawanId" IS NOT NULL
          OR COALESCE(t."keterangan", '') ~ '\\[KARYAWAN:(\\d+)\\]'
        )
        ${kebunFilterSql}
        ${userFilterSql}
        ${incSql}
        ${excSql}
      GROUP BY 1, 2
    `,
  )

  return (rows || []).map((r) => ({
    userId: (r as any).userId === null ? 0 : safeNumber((r as any).userId),
    name: String((r as any).name || '').trim(),
    total: safeNumber((r as any).total),
  }))
}

async function reportKaryawanGajiAnalisisByArgs(args: KaryawanGajiAnalisisArgs): Promise<ChatResponse> {
  const range = resolveRange(args.rangePreset || 'this_month', args.startDate, args.endDate)
  const scopeKebun = await resolveKebunIds({ kebunId: args.kebunId, kebunName: args.kebunName })
  const scopeUser = await resolveUserIds({ userId: args.karyawanId, userName: args.karyawanName })
  const inc = normalizeKeywordList(args.includeKeywords)
  const exc = normalizeKeywordList(args.excludeKeywords)
  const topN = Math.min(30, Math.max(6, Number(args.topN || 12)))

  const [gajRows, kasRows] = await Promise.all([
    gajianKaryawanTotals(range, scopeKebun.kebunIds, scopeUser.userIds || null),
    kasGajiKaryawanTotalsFiltered(range, scopeKebun.kebunIds, scopeUser.userIds || null, inc, exc),
  ])

  const byUser = new Map<number, { name: string; gajian: number; kas: number }>()
  for (const r of gajRows) {
    const id = safeNumber((r as any).userId)
    const prev = byUser.get(id) || { name: String((r as any).name || '').trim(), gajian: 0, kas: 0 }
    prev.gajian += safeNumber((r as any).total)
    if (!prev.name) prev.name = String((r as any).name || '').trim()
    byUser.set(id, prev)
  }
  for (const r of kasRows) {
    const id = safeNumber((r as any).userId)
    const prev = byUser.get(id) || { name: String((r as any).name || '').trim(), gajian: 0, kas: 0 }
    prev.kas += safeNumber((r as any).total)
    if (!prev.name) prev.name = String((r as any).name || '').trim()
    byUser.set(id, prev)
  }

  const rows = Array.from(byUser.entries())
    .map(([userId, v]) => ({ userId, name: v.name || `#${userId}`, gajian: v.gajian, kas: v.kas, total: v.gajian + v.kas }))
    .filter((r) => r.total !== 0)
    .sort((a, b) => b.total - a.total)

  const kebunLabel =
    scopeKebun.kebunIds && scopeKebun.kebunIds.length === 1
      ? `Kebun ${scopeKebun.kebunNameById.get(scopeKebun.kebunIds[0]) || `#${scopeKebun.kebunIds[0]}`}`
      : 'Semua kebun'

  const filterLabel = inc.length > 0 || exc.length > 0 ? `Filter kas: include(${inc.join(', ') || '-'}) exclude(${exc.join(', ') || '-'})` : 'Filter kas: (tanpa filter)'

  if (scopeUser.userIds && scopeUser.userIds.length === 1) {
    const id = scopeUser.userIds[0]
    const r = rows.find((x) => x.userId === id) || { userId: id, name: `#${id}`, gajian: 0, kas: 0, total: 0 }
    const table: TablePayload = {
      title: 'Data',
      columns: ['Komponen', range.label],
      rows: [
        ['Gaji (menu gajian)', formatIdCurrency(r.gajian)],
        ['Kas keluar (tag karyawan/gaji)', formatIdCurrency(r.kas)],
        ['Total', formatIdCurrency(r.total)],
      ],
    }
    return {
      answer: `${kebunLabel}. Karyawan ${r.name}. ${range.label}: total gaji ${formatIdCurrency(r.total)} (gajian ${formatIdCurrency(r.gajian)}, kas ${formatIdCurrency(r.kas)}). ${filterLabel}.`,
      tables: [table],
    }
  }

  const top = rows.slice(0, topN)
  const totalAll = rows.reduce((s, r) => s + r.total, 0)
  const table: TablePayload = {
    title: 'Data',
    columns: ['Karyawan', 'Gaji (menu gajian)', 'Kas keluar (tag)', 'Total'],
    rows: top.map((r) => [r.name, formatIdCurrency(r.gajian), formatIdCurrency(r.kas), formatIdCurrency(r.total)]),
  }

  return {
    answer: `${kebunLabel}. ${range.label}: total gaji (gabungan gajian + kas tag karyawan/gaji) ${formatIdCurrency(totalAll)}. Top ${top.length} karyawan. ${filterLabel}.`,
    tables: [table],
  }
}

function resolveBiayaRangeFromMessage(message: string) {
  const norm = normalizeText(message)
  const today = todayRangeUtc()
  const { thisMonth, prevMonth } = thisMonthVsPrevMonthUtc()
  const ytd = yearToDateRangeUtc()
  if (norm.includes('hari ini') || norm.includes('today')) return today
  if (norm.includes('bulan lalu') || norm.includes('bulan kemarin')) return { start: prevMonth.start, end: prevMonth.end, label: prevMonth.label }
  if (norm.includes('bulan ini')) return { start: thisMonth.start, end: thisMonth.end, label: thisMonth.label }
  if (norm.includes('tahun') || norm.includes('year') || norm.includes('ytd') || norm.includes('year to date')) return ytd
  return { start: thisMonth.start, end: thisMonth.end, label: thisMonth.label }
}

async function reportKebunBiayaSummary(message: string): Promise<ChatResponse> {
  const scope = await findKebunScope(message)
  const range = resolveBiayaRangeFromMessage(message)
  const [kasRows, pekerjaanRows, gajianTotal] = await Promise.all([
    kasKategoriTotals(range, scope.kebunIds),
    pekerjaanJenisTotals(range, scope.kebunIds),
    gajianTotals(range, scope.kebunIds),
  ])

  const kasTotal = kasRows.reduce((s, r) => s + safeNumber(r.total), 0)
  const pekerjaanTotal = pekerjaanRows.reduce((s, r) => s + safeNumber(r.total), 0)
  const gajian = safeNumber(gajianTotal)
  const total = kasTotal + pekerjaanTotal + gajian

  const scopeLabel =
    scope.kebunIds && scope.kebunIds.length === 1
      ? `Kebun ${scope.kebunNameById.get(scope.kebunIds[0]) || `#${scope.kebunIds[0]}`}`
      : 'Semua kebun'

  const kasTop = [...kasRows].sort((a, b) => b.total - a.total).filter((r) => r.total !== 0).slice(0, 20)
  const pekTop = [...pekerjaanRows].sort((a, b) => b.total - a.total).filter((r) => r.total !== 0).slice(0, 20)

  const tables: TablePayload[] = [
    {
      title: `Biaya Kebun (${range.label})`,
      columns: ['Komponen', range.label],
      rows: [
        ['Kas', formatIdCurrency(kasTotal)],
        ['Borongan', formatIdCurrency(pekerjaanTotal)],
        ['Gajian', formatIdCurrency(gajian)],
        ['Total', formatIdCurrency(total)],
      ],
    },
    {
      title: `Breakdown Kas (${range.label})`,
      columns: ['Kategori', range.label],
      rows: kasTop.map((r) => [r.key, formatIdCurrency(r.total)]),
    },
    {
      title: `Breakdown Borongan (${range.label})`,
      columns: ['Jenis', range.label],
      rows: pekTop.map((r) => [r.key, formatIdCurrency(r.total)]),
    },
  ]

  return { answer: `${scopeLabel}. ${range.label}. Total biaya: ${formatIdCurrency(total)} (kas ${formatIdCurrency(kasTotal)}, borongan ${formatIdCurrency(pekerjaanTotal)}, gajian ${formatIdCurrency(gajian)}).`, tables }
}

async function reportKebunBiayaPanen(message: string): Promise<ChatResponse> {
  const scope = await findKebunScope(message)
  const range = resolveBiayaRangeFromMessage(message)

  const gWhere: any = { tanggalMulai: { lte: range.end }, tanggalSelesai: { gte: range.start }, tipe: 'PANEN' }
  if (scope.kebunIds) gWhere.kebunId = { in: scope.kebunIds }

  const pWhere: any = {
    date: { gte: range.start, lte: range.end },
    gajianId: null,
    OR: [{ jenisPekerjaan: { contains: 'panen', mode: 'insensitive' } }, { kategoriBorongan: { contains: 'panen', mode: 'insensitive' } }],
  }
  if (scope.kebunIds) pWhere.kebunId = { in: scope.kebunIds }

  const kWhere: any = {
    deletedAt: null,
    tipe: 'PENGELUARAN',
    date: { gte: range.start, lte: range.end },
    OR: [
      { kategori: { contains: 'panen', mode: 'insensitive' } },
      { deskripsi: { contains: 'panen', mode: 'insensitive' } },
      { keterangan: { contains: 'panen', mode: 'insensitive' } },
    ],
  }
  if (scope.kebunIds) kWhere.kebunId = { in: scope.kebunIds }

  const [gajianRows, pekerjaanByJenis, kasByKategori] = await Promise.all([
    prisma.gajian.findMany({
      where: gWhere,
      orderBy: { tanggalSelesai: 'desc' },
      take: 50,
      select: { id: true, kebunId: true, tanggalMulai: true, tanggalSelesai: true, totalGaji: true, totalBiayaLain: true, totalPotongan: true },
    }),
    prisma.pekerjaanKebun.groupBy({ by: ['jenisPekerjaan'], where: pWhere, _sum: { biaya: true } }),
    prisma.kasTransaksi.groupBy({ by: ['kategori'], where: kWhere, _sum: { jumlah: true } }),
  ])

  const gGross = gajianRows.reduce((s, r) => s + safeNumber(r.totalGaji) + safeNumber(r.totalBiayaLain), 0)
  const gPot = gajianRows.reduce((s, r) => s + safeNumber(r.totalPotongan), 0)
  const gNet = gGross - gPot

  const pekerjaanRows = pekerjaanByJenis.map((r) => ({ key: String(r.jenisPekerjaan || '-'), total: safeNumber(r._sum.biaya) }))
  const pekerjaanTotal = pekerjaanRows.reduce((s, r) => s + r.total, 0)

  const kasRows = kasByKategori.map((r) => ({ key: String(r.kategori || 'UMUM'), total: safeNumber(r._sum.jumlah) }))
  const kasTotal = kasRows.reduce((s, r) => s + r.total, 0)

  const total = gNet + pekerjaanTotal + kasTotal

  const scopeLabel =
    scope.kebunIds && scope.kebunIds.length === 1
      ? `Kebun ${scope.kebunNameById.get(scope.kebunIds[0]) || `#${scope.kebunIds[0]}`}`
      : 'Semua kebun'

  const gTable: TablePayload = {
    title: `Gajian Panen (${range.label})`,
    columns: ['ID', 'Kebun', 'Periode', 'Total Gaji', 'Biaya Lain', 'Potongan', 'Net'],
    rows: gajianRows.map((r) => {
      const net = safeNumber(r.totalGaji) + safeNumber(r.totalBiayaLain) - safeNumber(r.totalPotongan)
      return [
        r.id,
        scope.kebunNameById.get(r.kebunId) ? `${r.kebunId} - ${scope.kebunNameById.get(r.kebunId)}` : String(r.kebunId),
        `${r.tanggalMulai.toLocaleDateString('id-ID')} s/d ${r.tanggalSelesai.toLocaleDateString('id-ID')}`,
        formatIdCurrency(safeNumber(r.totalGaji)),
        formatIdCurrency(safeNumber(r.totalBiayaLain)),
        formatIdCurrency(safeNumber(r.totalPotongan)),
        formatIdCurrency(net),
      ]
    }),
  }

  const pekTop = [...pekerjaanRows].sort((a, b) => b.total - a.total).filter((r) => r.total !== 0).slice(0, 20)
  const kasTop = [...kasRows].sort((a, b) => b.total - a.total).filter((r) => r.total !== 0).slice(0, 20)

  const tables: TablePayload[] = [
    {
      title: `Biaya Panen (${range.label})`,
      columns: ['Komponen', range.label],
      rows: [
        ['Gajian PANEN (gross)', formatIdCurrency(gGross)],
        ['Gajian PANEN (potongan)', formatIdCurrency(gPot)],
        ['Gajian PANEN (net)', formatIdCurrency(gNet)],
        ['Borongan Panen (tanpa gajianId)', formatIdCurrency(pekerjaanTotal)],
        ['Kas Panen (filter kata panen)', formatIdCurrency(kasTotal)],
        ['Total', formatIdCurrency(total)],
      ],
    },
    {
      title: `Breakdown Borongan Panen (${range.label})`,
      columns: ['Jenis', range.label],
      rows: pekTop.map((r) => [r.key, formatIdCurrency(r.total)]),
    },
    {
      title: `Breakdown Kas Panen (${range.label})`,
      columns: ['Kategori', range.label],
      rows: kasTop.map((r) => [r.key, formatIdCurrency(r.total)]),
    },
    gTable,
  ]

  return { answer: `${scopeLabel}. ${range.label}. Total biaya panen: ${formatIdCurrency(total)}.`, tables }
}

async function reportCostChangeExplainByArgs(args: CostChangeArgs): Promise<ChatResponse> {
  const scope = await resolveKebunIds({ kebunId: args.kebunId, kebunName: args.kebunName })
  const { thisMonth, prevMonth } = thisMonthVsPrevMonthUtc()

  const aStart = parseIsoDate(args.aStartDate) || thisMonth.start
  const aEnd = parseIsoDate(args.aEndDate) || thisMonth.end
  const bStart = parseIsoDate(args.bStartDate) || prevMonth.start
  const bEnd = parseIsoDate(args.bEndDate) || prevMonth.end

  const rangeA = { start: aStart, end: aEnd, label: 'Bulan ini' }
  const rangeB = { start: bStart, end: bEnd, label: 'Bulan lalu' }

  const [kasA, kasB, pekA, pekB, gA, gB] = await Promise.all([
    kasKategoriTotals(rangeA, scope.kebunIds),
    kasKategoriTotals(rangeB, scope.kebunIds),
    pekerjaanJenisTotals(rangeA, scope.kebunIds),
    pekerjaanJenisTotals(rangeB, scope.kebunIds),
    gajianTotals(rangeA, scope.kebunIds),
    gajianTotals(rangeB, scope.kebunIds),
  ])

  const sumKasA = kasA.reduce((s, r) => s + r.total, 0)
  const sumKasB = kasB.reduce((s, r) => s + r.total, 0)
  const sumPekA = pekA.reduce((s, r) => s + r.total, 0)
  const sumPekB = pekB.reduce((s, r) => s + r.total, 0)

  const totalA = sumKasA + sumPekA + gA
  const totalB = sumKasB + sumPekB + gB
  const delta = totalA - totalB
  const absDelta = Math.abs(delta)

  const drivers: Array<{ sebab: string; a: number; b: number; d: number }> = []
  drivers.push({ sebab: 'Gajian Harian', a: gA, b: gB, d: gA - gB })

  const kasKeys = Array.from(new Set([...kasA.map((x) => x.key), ...kasB.map((x) => x.key)]))
  for (const k of kasKeys) {
    const a = kasA.find((x) => x.key === k)?.total ?? 0
    const b = kasB.find((x) => x.key === k)?.total ?? 0
    drivers.push({ sebab: `Kas: ${k}`, a, b, d: a - b })
  }

  const pekKeys = Array.from(new Set([...pekA.map((x) => x.key), ...pekB.map((x) => x.key)]))
  for (const k of pekKeys) {
    const a = pekA.find((x) => x.key === k)?.total ?? 0
    const b = pekB.find((x) => x.key === k)?.total ?? 0
    drivers.push({ sebab: `Borongan: ${k}`, a, b, d: a - b })
  }

  drivers.sort((x, y) => Math.abs(y.d) - Math.abs(x.d))
  const top = drivers.slice(0, 12).filter((x) => x.a !== 0 || x.b !== 0)

  const table: TablePayload = {
    title: `Kenapa biaya berubah (${rangeA.label} vs ${rangeB.label})`,
    columns: ['Penyebab', rangeA.label, rangeB.label, 'Selisih', 'Kontribusi'],
    rows: top.map((r) => {
      const contrib = absDelta > 0 ? Math.abs(r.d) / absDelta : 0
      const sign = r.d >= 0 ? '+' : '-'
      return [r.sebab, formatIdCurrency(r.a), formatIdCurrency(r.b), `${sign}${formatIdCurrency(Math.abs(r.d))}`, fmtPct(contrib)]
    }),
  }

  const scopeLabel =
    scope.kebunIds && scope.kebunIds.length === 1
      ? `Kebun ${scope.kebunNameById.get(scope.kebunIds[0]) || `#${scope.kebunIds[0]}`}`
      : 'Semua kebun'

  return {
    answer: `${scopeLabel}. Total beban ${rangeA.label}: ${formatIdCurrency(totalA)}. ${rangeB.label}: ${formatIdCurrency(totalB)}. Selisih: ${(delta >= 0 ? '+' : '-') + formatIdCurrency(absDelta)}.`,
    tables: [table],
  }
}

async function reportNotaSawitCountByArgs(args: NotaSawitCountArgs): Promise<ChatResponse> {
  const scope = await resolveKebunIds({ kebunId: args.kebunId, kebunName: args.kebunName })
  const preset = args.rangePreset || 'today'
  const customStart = parseIsoDate(args.startDate)
  const customEnd = parseIsoDate(args.endDate)
  const today = todayRangeUtc()
  const { thisMonth } = thisMonthVsPrevMonthUtc()
  const ytd = yearToDateRangeUtc()

  const range =
    preset === 'custom' && customStart && customEnd
      ? { start: customStart, end: customEnd, label: 'Custom' }
      : preset === 'this_month'
        ? { start: thisMonth.start, end: thisMonth.end, label: 'Bulan ini' }
        : preset === 'year_to_date'
          ? ytd
          : today

  const where: any = {
    deletedAt: null,
    OR: [
      { tanggalBongkar: { gte: range.start, lte: range.end } },
      { tanggalBongkar: null, createdAt: { gte: range.start, lte: range.end } },
    ],
  }
  if (scope.kebunIds) where.kebunId = { in: scope.kebunIds }

  const [count, sums] = await Promise.all([
    prisma.notaSawit.count({ where }),
    prisma.notaSawit.aggregate({
      where,
      _sum: { pembayaranSetelahPph: true, netto: true, totalPembayaran: true },
    }),
  ])

  const totalSetelahPph = safeNumber(sums._sum.pembayaranSetelahPph)
  const totalNetto = safeNumber(sums._sum.netto)
  const totalPembayaran = safeNumber(sums._sum.totalPembayaran)
  const scopeLabel =
    scope.kebunIds && scope.kebunIds.length === 1
      ? `Kebun ${scope.kebunNameById.get(scope.kebunIds[0]) || `#${scope.kebunIds[0]}`}`
      : 'Semua kebun'

  const table: TablePayload = {
    title: `Ringkas Nota Sawit (${range.label})`,
    columns: ['Scope', 'Jumlah Nota', 'Total Netto', 'Total (setelah PPh)', 'Total Pembayaran'],
    rows: [[scopeLabel, count, formatIdCurrency(totalNetto), formatIdCurrency(totalSetelahPph), formatIdCurrency(totalPembayaran)]],
  }

  return {
    answer: `${scopeLabel}. ${range.label}: jumlah nota ${count}, total setelah PPh ${formatIdCurrency(totalSetelahPph)}.`,
    tables: [table],
  }
}

async function reportNotaSawitKendaraanUsed(args: NotaSawitKendaraanUsedArgs): Promise<ChatResponse> {
  const preset = args.rangePreset || 'today'
  const customStart = parseIsoDate(args.startDate)
  const customEnd = parseIsoDate(args.endDate)
  const today = todayRangeUtc()
  const { thisMonth } = thisMonthVsPrevMonthUtc()
  const ytd = yearToDateRangeUtc()
  const range =
    preset === 'custom' && customStart && customEnd
      ? { start: customStart, end: customEnd, label: 'Custom' }
      : preset === 'this_month'
        ? { start: thisMonth.start, end: thisMonth.end, label: 'Bulan ini' }
        : preset === 'year_to_date'
          ? ytd
          : today

  const limit = Math.min(50, Math.max(1, Number(args.limit || 15)))
  const where: any = {
    deletedAt: null,
    kendaraanPlatNomor: { not: null },
    OR: [
      { tanggalBongkar: { gte: range.start, lte: range.end } },
      { tanggalBongkar: null, createdAt: { gte: range.start, lte: range.end } },
    ],
  }

  const rows = (await (prisma as any).notaSawit.groupBy({
    by: ['kendaraanPlatNomor'],
    where,
    _count: { _all: true },
    orderBy: { _count: { _all: 'desc' } },
    take: limit,
  })) as Array<{ kendaraanPlatNomor: string | null; _count: { _all: number } }>

  const list = rows.map((r) => ({ plat: String(r.kendaraanPlatNomor || '').trim(), n: safeNumber(r._count?._all) })).filter((r) => Boolean(r.plat))

  const table: TablePayload = {
    title: 'Kendaraan dipakai',
    columns: ['Plat', 'Jumlah Nota'],
    rows: list.map((r) => [r.plat, r.n]),
  }

  return { answer: `${range.label}. Kendaraan terpakai: ${list.length}.`, tables: [table] }
}

async function reportNotaSawitBeratAkhir(args: NotaSawitBeratAkhirArgs): Promise<ChatResponse> {
  const scope = await resolveKebunIds({ kebunId: args.kebunId, kebunName: args.kebunName })
  const preset = args.rangePreset || 'today'
  const customStart = parseIsoDate(args.startDate)
  const customEnd = parseIsoDate(args.endDate)
  const today = todayRangeUtc()
  const { thisMonth } = thisMonthVsPrevMonthUtc()
  const ytd = yearToDateRangeUtc()
  const range =
    preset === 'custom' && customStart && customEnd
      ? { start: customStart, end: customEnd, label: 'Custom' }
      : preset === 'this_month'
        ? { start: thisMonth.start, end: thisMonth.end, label: 'Bulan ini' }
        : preset === 'year_to_date'
          ? ytd
          : today

  const limit = Math.min(50, Math.max(1, Number(args.limit || 50)))
  const where: any = {
    deletedAt: null,
    OR: [
      { tanggalBongkar: { gte: range.start, lte: range.end } },
      { tanggalBongkar: null, createdAt: { gte: range.start, lte: range.end } },
    ],
  }
  if (scope.kebunIds) where.kebunId = { in: scope.kebunIds }

  const rows = await prisma.notaSawit.findMany({
    where,
    take: limit,
    orderBy: [{ tanggalBongkar: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
    select: { id: true, tanggalBongkar: true, createdAt: true, beratAkhir: true },
  })

  const table: TablePayload = {
    title: 'Data',
    columns: ['ID', 'Tanggal', 'Berat Akhir'],
    rows: rows.map((r) => {
      const t = r.tanggalBongkar || r.createdAt
      const berat = (r as any).beratAkhir
      return [r.id, t ? new Date(t as any).toLocaleString('id-ID') : '-', berat ?? '-']
    }),
  }

  const scopeLabel =
    scope.kebunIds && scope.kebunIds.length === 1
      ? `Kebun ${scope.kebunNameById.get(scope.kebunIds[0]) || `#${scope.kebunIds[0]}`}`
      : 'Semua kebun'
  return {
    answer: `${scopeLabel}. ${range.label}: ${rows.length} nota.`,
    tables: [table],
  }
}

async function reportKasTransaksiSearch(args: KasTransaksiSearchArgs): Promise<ChatResponse> {
  const range = resolveRange(args.rangePreset, args.startDate, args.endDate)
  const scope = await resolveKebunIds({ kebunId: args.kebunId, kebunName: args.kebunName })
  const karyawanIds = await resolveUserIds({ userId: args.karyawanId, userName: args.karyawanName })
  const platFilter = String(args.kendaraanPlatNomor || '').trim()
  const tipe = String(args.tipe || 'all').toUpperCase()
  const kategori = String(args.kategori || '').trim()
  const q = String(args.query || '').trim()
  const limit = Math.min(50, Math.max(1, Number(args.limit || 20)))

  const where: any = { deletedAt: null, date: { gte: range.start, lte: range.end } }
  if (scope.kebunIds) where.kebunId = { in: scope.kebunIds }
  if (karyawanIds.userIds) where.karyawanId = { in: karyawanIds.userIds }
  if (platFilter) where.kendaraanPlatNomor = { contains: platFilter, mode: 'insensitive' }
  if (tipe !== 'ALL') where.tipe = tipe
  if (kategori) where.kategori = { equals: kategori, mode: 'insensitive' }
  if (q) {
    where.OR = [
      { deskripsi: { contains: q, mode: 'insensitive' } },
      { keterangan: { contains: q, mode: 'insensitive' } },
    ]
  }

  const rows = await prisma.kasTransaksi.findMany({
    where,
    orderBy: { date: 'desc' },
    take: limit,
    select: {
      id: true,
      date: true,
      tipe: true,
      kategori: true,
      deskripsi: true,
      jumlah: true,
      kebun: { select: { id: true, name: true } },
      karyawan: { select: { id: true, name: true } },
      kendaraan: { select: { platNomor: true } },
    },
  })

  const table: TablePayload = {
    title: `Kasir - Kas Transaksi (${range.label})`,
    columns: ['ID', 'Tanggal', 'Tipe', 'Kategori', 'Deskripsi', 'Jumlah', 'Kebun', 'Karyawan', 'Kendaraan'],
    rows: rows.map((r) => [
      r.id,
      (r.date instanceof Date ? r.date.toLocaleDateString('id-ID') : String(r.date || '')),
      String(r.tipe || ''),
      String(r.kategori || ''),
      String(r.deskripsi || ''),
      formatIdCurrency(safeNumber(r.jumlah)),
      r.kebun ? `${r.kebun.id} - ${r.kebun.name}` : '-',
      r.karyawan ? `${r.karyawan.id} - ${r.karyawan.name}` : '-',
      r.kendaraan?.platNomor ? String(r.kendaraan.platNomor) : '-',
    ]),
  }

  return { answer: `Ditemukan ${rows.length} transaksi.`, tables: [table] }
}

async function reportKasTransaksiSummary(args: KasTransaksiSummaryArgs): Promise<ChatResponse> {
  const range = resolveRange(args.rangePreset, args.startDate, args.endDate)
  const scope = await resolveKebunIds({ kebunId: args.kebunId, kebunName: args.kebunName })
  const groupByKategori = Boolean(args.groupByKategori)

  const where: any = { deletedAt: null, date: { gte: range.start, lte: range.end } }
  if (scope.kebunIds) where.kebunId = { in: scope.kebunIds }

  const rows = await prisma.kasTransaksi.groupBy({
    by: groupByKategori ? (['tipe', 'kategori'] as any) : (['tipe'] as any),
    where,
    _sum: { jumlah: true },
    _count: { _all: true },
  })

  const mapped = (rows || []).map((r: any) => ({
    tipe: String(r.tipe || ''),
    kategori: groupByKategori ? String(r.kategori || 'UMUM') : '',
    count: safeNumber(r._count?._all),
    total: safeNumber(r._sum?.jumlah),
  }))

  const masuk = mapped.filter((x) => x.tipe === 'PEMASUKAN').reduce((s, x) => s + x.total, 0)
  const keluar = mapped.filter((x) => x.tipe === 'PENGELUARAN').reduce((s, x) => s + x.total, 0)
  const net = masuk - keluar

  const table: TablePayload = {
    title: `Kasir - Ringkasan Kas (${range.label})`,
    columns: groupByKategori ? ['Tipe', 'Kategori', 'Jumlah Trx', 'Total'] : ['Tipe', 'Jumlah Trx', 'Total'],
    rows: mapped
      .sort((a, b) => String(a.tipe).localeCompare(String(b.tipe)))
      .map((r) => (groupByKategori ? [r.tipe, r.kategori, r.count, formatIdCurrency(r.total)] : [r.tipe, r.count, formatIdCurrency(r.total)])),
  }

  const scopeLabel =
    scope.kebunIds && scope.kebunIds.length === 1
      ? `Kebun ${scope.kebunNameById.get(scope.kebunIds[0]) || `#${scope.kebunIds[0]}`}`
      : 'Semua kebun'

  return { answer: `${scopeLabel}. Masuk ${formatIdCurrency(masuk)}, Keluar ${formatIdCurrency(keluar)}, Net ${formatIdCurrency(net)}.`, tables: [table] }
}

async function reportUangJalanSessions(args: UangJalanSessionsArgs): Promise<ChatResponse> {
  const range = resolveRange(args.rangePreset, args.startDate, args.endDate)
  const supirIds = await resolveUserIds({ userId: args.supirId, userName: args.supirName, role: 'SUPIR' })
  const plat = String(args.kendaraanPlatNomor || '').trim()
  const status = String(args.status || '').trim()
  const limit = Math.min(50, Math.max(1, Number(args.limit || 20)))

  const where: any = { deletedAt: null, tanggalMulai: { gte: range.start, lte: range.end } }
  if (supirIds.userIds) where.supirId = { in: supirIds.userIds }
  if (plat) where.kendaraanPlatNomor = { contains: plat, mode: 'insensitive' }
  if (status) where.status = { contains: status, mode: 'insensitive' }

  const rows = await prisma.sesiUangJalan.findMany({
    where,
    orderBy: { tanggalMulai: 'desc' },
    take: limit,
    select: {
      id: true,
      tanggalMulai: true,
      status: true,
      keterangan: true,
      kendaraanPlatNomor: true,
      supir: { select: { id: true, name: true } },
    },
  })

  const table: TablePayload = {
    title: `Uang Jalan - Sesi (${range.label})`,
    columns: ['ID', 'Tanggal', 'Supir', 'Kendaraan', 'Status', 'Keterangan'],
    rows: rows.map((r) => [
      r.id,
      (r.tanggalMulai instanceof Date ? r.tanggalMulai.toLocaleDateString('id-ID') : String(r.tanggalMulai || '')),
      `${r.supir.id} - ${r.supir.name}`,
      String(r.kendaraanPlatNomor || '-'),
      String(r.status || ''),
      String(r.keterangan || ''),
    ]),
  }

  return { answer: `Ditemukan ${rows.length} sesi.`, tables: [table] }
}

async function reportUangJalanSessionDetail(args: UangJalanSessionDetailArgs): Promise<ChatResponse> {
  const id = Number((args as any).sesiId)
  if (!Number.isFinite(id) || id <= 0) return { answer: 'sesiId tidak valid.', tables: [] }
  const sesi = await prisma.sesiUangJalan.findFirst({
    where: { id, deletedAt: null },
    select: {
      id: true,
      tanggalMulai: true,
      status: true,
      keterangan: true,
      kendaraanPlatNomor: true,
      supir: { select: { id: true, name: true } },
      rincian: {
        where: { deletedAt: null },
        orderBy: { date: 'asc' },
        select: { id: true, tipe: true, amount: true, date: true, description: true },
      },
    },
  })
  if (!sesi) return { answer: 'Sesi tidak ditemukan.', tables: [] }

  const totalMasuk = (sesi.rincian || []).filter((r) => String(r.tipe).toUpperCase() === 'MASUK').reduce((s, r) => s + safeNumber(r.amount), 0)
  const totalKeluar = (sesi.rincian || []).filter((r) => String(r.tipe).toUpperCase() !== 'MASUK').reduce((s, r) => s + safeNumber(r.amount), 0)
  const saldo = totalMasuk - totalKeluar

  const table: TablePayload = {
    title: `Uang Jalan - Detail Sesi #${sesi.id}`,
    columns: ['ID', 'Tanggal', 'Tipe', 'Jumlah', 'Deskripsi'],
    rows: (sesi.rincian || []).map((r) => [
      r.id,
      (r.date instanceof Date ? r.date.toLocaleDateString('id-ID') : String(r.date || '')),
      String(r.tipe || ''),
      formatIdCurrency(safeNumber(r.amount)),
      String(r.description || ''),
    ]),
  }

  return {
    answer: `Sesi #${sesi.id}. Supir ${sesi.supir.name}. Masuk ${formatIdCurrency(totalMasuk)}, Keluar ${formatIdCurrency(totalKeluar)}, Saldo ${formatIdCurrency(saldo)}.`,
    tables: [table],
  }
}

async function reportGajianSearch(args: GajianSearchArgs): Promise<ChatResponse> {
  const range = resolveRange(args.rangePreset, args.startDate, args.endDate)
  const scope = await resolveKebunIds({ kebunId: args.kebunId, kebunName: args.kebunName })
  const status = String(args.status || '').trim()
  const tipe = String(args.tipe || '').trim()
  const limit = Math.min(50, Math.max(1, Number(args.limit || 20)))

  const where: any = { tanggalMulai: { lte: range.end }, tanggalSelesai: { gte: range.start } }
  if (scope.kebunIds) where.kebunId = { in: scope.kebunIds }
  if (status) where.status = { equals: status, mode: 'insensitive' }
  if (tipe) where.tipe = { equals: tipe, mode: 'insensitive' }

  const rows = await prisma.gajian.findMany({
    where,
    orderBy: { tanggalSelesai: 'desc' },
    take: limit,
    select: {
      id: true,
      kebunId: true,
      tanggalMulai: true,
      tanggalSelesai: true,
      status: true,
      tipe: true,
      totalGaji: true,
      totalBiayaLain: true,
      totalPotongan: true,
      totalNota: true,
      kebun: { select: { name: true } },
    },
  })

  const table: TablePayload = {
    title: `Gajian (${range.label})`,
    columns: ['ID', 'Kebun', 'Periode', 'Status', 'Tipe', 'Total Nota', 'Total Gaji', 'Biaya Lain', 'Potongan'],
    rows: rows.map((r) => [
      r.id,
      `${r.kebunId} - ${r.kebun?.name || '-'}`,
      `${r.tanggalMulai.toLocaleDateString('id-ID')} s/d ${r.tanggalSelesai.toLocaleDateString('id-ID')}`,
      String(r.status || ''),
      String(r.tipe || ''),
      safeNumber(r.totalNota),
      formatIdCurrency(safeNumber(r.totalGaji)),
      formatIdCurrency(safeNumber(r.totalBiayaLain)),
      formatIdCurrency(safeNumber(r.totalPotongan)),
    ]),
  }

  return { answer: `Ditemukan ${rows.length} gajian.`, tables: [table] }
}

async function reportGajianDetail(args: GajianDetailArgs): Promise<ChatResponse> {
  const id = Number((args as any).gajianId)
  const karyawanLimit = Math.min(100, Math.max(1, Number((args as any).karyawanLimit || 30)))
  if (!Number.isFinite(id) || id <= 0) return { answer: 'gajianId tidak valid.', tables: [] }

  const g = await prisma.gajian.findFirst({
    where: { id },
    select: {
      id: true,
      kebunId: true,
      tanggalMulai: true,
      tanggalSelesai: true,
      status: true,
      tipe: true,
      totalNota: true,
      totalGaji: true,
      totalBiayaLain: true,
      totalPotongan: true,
      kebun: { select: { name: true } },
      detailKaryawan: {
        orderBy: { total: 'desc' },
        take: karyawanLimit,
        select: {
          userId: true,
          hariKerja: true,
          total: true,
          user: { select: { name: true, role: true } },
        },
      },
    },
  })

  if (!g) return { answer: 'Gajian tidak ditemukan.', tables: [] }

  const table: TablePayload = {
    title: `Gajian Detail #${g.id}`,
    columns: ['User', 'Role', 'HK', 'Total'],
    rows: (g.detailKaryawan || []).map((d) => [ `${d.userId} - ${d.user.name}`, String(d.user.role || ''), safeNumber(d.hariKerja), formatIdCurrency(safeNumber(d.total)) ]),
  }

  return {
    answer: `Gajian #${g.id}. Kebun ${g.kebunId} - ${g.kebun?.name || '-'}. Total Gaji ${formatIdCurrency(safeNumber(g.totalGaji))}, Biaya Lain ${formatIdCurrency(safeNumber(g.totalBiayaLain))}, Potongan ${formatIdCurrency(safeNumber(g.totalPotongan))}.`,
    tables: [table],
  }
}

async function reportKaryawanSearch(args: KaryawanSearchArgs): Promise<ChatResponse> {
  const q = String(args.query || '').trim()
  const role = String(args.role || '').trim()
  const jobType = String(args.jobType || '').trim()
  const status = String(args.status || '').trim()
  const limit = Math.min(50, Math.max(1, Number(args.limit || 20)))
  const scope = await resolveKebunIds({ kebunId: args.kebunId, kebunName: args.kebunName })

  const and: any[] = []
  if (q) {
    const isNumeric = /^\d+$/.test(q)
    const or: any[] = [{ name: { contains: q, mode: 'insensitive' } }, { email: { contains: q, mode: 'insensitive' } }]
    if (isNumeric) or.push({ id: Number(q) })
    and.push({ OR: or })
  }
  if (role) and.push({ role: { equals: role, mode: 'insensitive' } })
  if (jobType) and.push({ jobType: { equals: jobType, mode: 'insensitive' } })
  if (status) and.push({ status: { equals: status, mode: 'insensitive' } })
  if (scope.kebunIds) and.push({ kebunId: { in: scope.kebunIds } })

  const users = await prisma.user.findMany({
    where: and.length ? { AND: and } : undefined,
    take: limit,
    orderBy: { name: 'asc' },
    select: { id: true, name: true, email: true, role: true, jobType: true, status: true, kebunId: true, kebun: { select: { name: true } } },
  })

  const table: TablePayload = {
    title: `Karyawan / User (limit ${limit})`,
    columns: ['ID', 'Nama', 'Email', 'Role', 'JobType', 'Status', 'Kebun'],
    rows: users.map((u) => [
      u.id,
      u.name,
      u.email,
      String(u.role || ''),
      String(u.jobType || ''),
      String(u.status || ''),
      u.kebunId ? `${u.kebunId} - ${u.kebun?.name || '-'}` : '-',
    ]),
  }

  return { answer: `Ditemukan ${users.length} user.`, tables: [table] }
}

async function reportKendaraanSearch(args: KendaraanSearchArgs): Promise<ChatResponse> {
  const q = String(args.query || '').trim()
  const jenis = String(args.jenis || '').trim()
  const limit = Math.min(50, Math.max(1, Number(args.limit || 20)))
  const where: any = {}
  const and: any[] = []
  if (q) and.push({ OR: [{ platNomor: { contains: q, mode: 'insensitive' } }, { merk: { contains: q, mode: 'insensitive' } }, { jenis: { contains: q, mode: 'insensitive' } }] })
  if (jenis && jenis !== 'all') and.push({ jenis: { equals: jenis, mode: 'insensitive' } })
  if (and.length) where.AND = and

  const rows = await prisma.kendaraan.findMany({
    where: and.length ? where : undefined,
    orderBy: { platNomor: 'asc' },
    take: limit,
    select: { platNomor: true, merk: true, jenis: true, tanggalMatiStnk: true, tanggalPajakTahunan: true, speksi: true, tanggalIzinTrayek: true },
  })

  const table: TablePayload = {
    title: `Kendaraan (limit ${limit})`,
    columns: ['Plat', 'Merk', 'Jenis', 'STNK', 'Pajak', 'Speksi', 'Trayek'],
    rows: rows.map((r) => [
      r.platNomor,
      r.merk,
      r.jenis,
      r.tanggalMatiStnk instanceof Date ? r.tanggalMatiStnk.toLocaleDateString('id-ID') : '',
      r.tanggalPajakTahunan instanceof Date ? r.tanggalPajakTahunan.toLocaleDateString('id-ID') : '',
      r.speksi instanceof Date ? r.speksi.toLocaleDateString('id-ID') : '',
      r.tanggalIzinTrayek instanceof Date ? r.tanggalIzinTrayek.toLocaleDateString('id-ID') : '',
    ]),
  }

  return { answer: `Ditemukan ${rows.length} kendaraan.`, tables: [table] }
}

async function reportKendaraanExpiring(args: KendaraanExpiringArgs): Promise<ChatResponse> {
  const days = Math.min(365, Math.max(0, Number(args.days ?? 30)))
  const type = (args.type || 'all') as any
  const now = new Date()
  const due = new Date(now.getTime() + days * 24 * 60 * 60 * 1000)

  const or: any[] = []
  if (type === 'all' || type === 'stnk') or.push({ tanggalMatiStnk: { lte: due } })
  if (type === 'all' || type === 'pajak') or.push({ tanggalPajakTahunan: { lte: due } })
  if (type === 'all' || type === 'speksi') or.push({ speksi: { lte: due } })
  if (type === 'all' || type === 'trayek') or.push({ tanggalIzinTrayek: { lte: due } })

  const rows = await prisma.kendaraan.findMany({
    where: { OR: or },
    orderBy: { platNomor: 'asc' },
    take: 50,
    select: { platNomor: true, merk: true, jenis: true, tanggalMatiStnk: true, tanggalPajakTahunan: true, speksi: true, tanggalIzinTrayek: true },
  })

  const table: TablePayload = {
    title: `Kendaraan jatuh tempo <= ${days} hari`,
    columns: ['Plat', 'Merk', 'Jenis', 'STNK', 'Pajak', 'Speksi', 'Trayek'],
    rows: rows.map((r) => [
      r.platNomor,
      r.merk,
      r.jenis,
      r.tanggalMatiStnk instanceof Date ? r.tanggalMatiStnk.toLocaleDateString('id-ID') : '',
      r.tanggalPajakTahunan instanceof Date ? r.tanggalPajakTahunan.toLocaleDateString('id-ID') : '',
      r.speksi instanceof Date ? r.speksi.toLocaleDateString('id-ID') : '',
      r.tanggalIzinTrayek instanceof Date ? r.tanggalIzinTrayek.toLocaleDateString('id-ID') : '',
    ]),
  }

  return { answer: `Ditemukan ${rows.length} kendaraan mendekati jatuh tempo.`, tables: [table] }
}

async function reportKebunOverview(args: KebunOverviewArgs): Promise<ChatResponse> {
  const range = resolveRange(args.rangePreset, args.startDate, args.endDate)
  const scope = await resolveKebunIds({ kebunId: args.kebunId, kebunName: args.kebunName })
  if (!scope.kebunIds || scope.kebunIds.length !== 1) return reportProfitabilityByArgs({ rangePreset: range.label === 'Custom' ? 'custom' : 'year_to_date', startDate: args.startDate, endDate: args.endDate })
  const kebunId = scope.kebunIds[0]

  const [revRows, pekerjaanRows, gajianRows, kasRows, notaCount, pekerjaanCount, kasCount, timbanganAgg] = await Promise.all([
    getRevenueByKebun(range, [kebunId]),
    getPekerjaanCostByKebun(range, [kebunId]),
    getGajianCostByKebun(range, [kebunId]),
    getKasCostResolvedByKebun(range, [kebunId]),
    prisma.notaSawit.count({
      where: {
        deletedAt: null,
        kebunId,
        OR: [
          { tanggalBongkar: { gte: range.start, lte: range.end } },
          { tanggalBongkar: null, createdAt: { gte: range.start, lte: range.end } },
        ],
      },
    }),
    prisma.pekerjaanKebun.count({ where: { kebunId, date: { gte: range.start, lte: range.end } } }),
    prisma.kasTransaksi.count({ where: { deletedAt: null, date: { gte: range.start, lte: range.end }, OR: [{ kebunId }, { keterangan: { contains: `[KEBUN:${kebunId}]` } }] } }),
    prisma.timbangan.aggregate({ where: { kebunId, date: { gte: range.start, lte: range.end } }, _sum: { netKg: true } }),
  ])

  const pendapatan = revRows.reduce((s, r) => s + safeNumber(r.revenue), 0)
  const biayaBorongan = pekerjaanRows.reduce((s, r) => s + safeNumber(r.cost), 0)
  const gajian = gajianRows.reduce((s, r) => s + safeNumber(r.cost), 0)
  const kas = kasRows.reduce((s, r) => s + safeNumber(r.cost), 0)
  const beban = biayaBorongan + gajian + kas
  const ratio = pendapatan > 0 ? beban / pendapatan : 0
  const margin = pendapatan - beban
  const produksiKg = safeNumber(timbanganAgg?._sum?.netKg)

  const table: TablePayload = {
    title: `Kebun ${kebunId} - Ringkasan (${range.label})`,
    columns: ['Pendapatan (setelah PPh)', 'Beban (Kas+Borongan+Gajian)', 'Rasio Beban', 'Margin', 'Nota', 'Pekerjaan', 'Kas Trx', 'Produksi (kg)'],
    rows: [[formatIdCurrency(pendapatan), formatIdCurrency(beban), fmtPct(ratio), formatIdCurrency(margin), notaCount, pekerjaanCount, kasCount, formatIdNumber(produksiKg)]],
  }

  return { answer: `Kebun ${scope.kebunNameById.get(kebunId) || `#${kebunId}`}. ${range.label}: pendapatan ${formatIdCurrency(pendapatan)}, beban ${formatIdCurrency(beban)}, margin ${formatIdCurrency(margin)}.`, tables: [table] }
}

async function reportKebunList(args: KebunListArgs): Promise<ChatResponse> {
  const q = String(args.query || '').trim()
  const limit = Math.min(100, Math.max(1, Number(args.limit || 50)))
  const where: any = q
    ? {
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { location: { contains: q, mode: 'insensitive' } },
          ...( /^\d+$/.test(q) ? [{ id: Number(q) }] : [] ),
        ],
      }
    : undefined

  const rows = await prisma.kebun.findMany({
    where,
    orderBy: { id: 'desc' },
    take: limit,
    select: { id: true, name: true, location: true, createdAt: true },
  })

  const table: TablePayload = {
    title: `Daftar Kebun (limit ${limit})`,
    columns: ['ID', 'Nama', 'Lokasi', 'Dibuat'],
    rows: rows.map((r) => [r.id, r.name, String(r.location || '-'), r.createdAt.toLocaleDateString('id-ID')]),
  }

  return { answer: `Ditemukan ${rows.length} kebun.`, tables: [table] }
}

function getPrismaModelDelegates() {
  const keys = Object.keys(prisma as any)
  const out: string[] = []
  for (const k of keys) {
    if (k.startsWith('$')) continue
    const d = (prisma as any)[k]
    if (!d) continue
    if (typeof d.findMany !== 'function') continue
    out.push(k)
  }
  out.sort((a, b) => a.localeCompare(b))
  return out
}

function resolveModelDelegateName(input: unknown) {
  const raw = String(input || '').trim()
  if (!raw) return null
  const norm = raw
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
  const delegates = getPrismaModelDelegates()
  const hit = delegates.find((d) => d.toLowerCase().replace(/[^a-z0-9]/g, '') === norm)
  return hit || null
}

function suggestModelDelegates(input: unknown, limit: number) {
  const raw = String(input || '').trim()
  const norm = raw.toLowerCase().replace(/[^a-z0-9]/g, '')
  const delegates = getPrismaModelDelegates()
  if (!norm) return delegates.slice(0, limit)
  const scored = delegates
    .map((d) => {
      const dn = d.toLowerCase().replace(/[^a-z0-9]/g, '')
      const score = dn === norm ? 0 : dn.startsWith(norm) ? 1 : dn.includes(norm) ? 2 : norm.includes(dn) ? 3 : 9
      return { d, dn, score }
    })
    .filter((x) => x.score < 9)
    .sort((a, b) => a.score - b.score || a.d.localeCompare(b.d))
    .map((x) => x.d)
  const uniq = Array.from(new Set(scored))
  if (uniq.length > 0) return uniq.slice(0, limit)
  return delegates.slice(0, limit)
}

function invalidModelResponse(input: unknown): ChatResponse {
  const wanted = String(input || '').trim()
  const suggestions = suggestModelDelegates(wanted, 30)
  const table: TablePayload = {
    title: 'Model tersedia (contoh)',
    columns: ['Model'],
    rows: suggestions.map((m) => [m]),
  }
  return {
    answer: wanted
      ? `model tidak valid: "${wanted}". Pakai salah satu model di tabel (atau panggil db_models_list).`
      : 'model wajib. Pakai db_models_list dulu.',
    tables: [table],
  }
}

function isPlainObject(v: unknown): v is Record<string, any> {
  if (!v || typeof v !== 'object') return false
  const proto = Object.getPrototypeOf(v)
  return proto === Object.prototype || proto === null
}

function pruneNestedObject(v: any, maxDepth: number): any {
  if (maxDepth < 0) return undefined
  if (v === null || v === undefined) return undefined
  if (v === true || v === false) return v
  if (Array.isArray(v)) return v.map((x) => pruneNestedObject(x, maxDepth - 1)).filter((x) => x !== undefined)
  if (!isPlainObject(v)) return undefined
  const out: any = {}
  for (const [k, val] of Object.entries(v)) {
    const pv = pruneNestedObject(val, maxDepth - 1)
    if (pv === undefined) continue
    out[k] = pv
  }
  return out
}

const SENSITIVE_KEYS = new Set([
  'passwordHash',
  'tokenHash',
  'p256dh',
  'auth',
  'endpoint',
  'vapidPrivateKey',
  'secret',
])

function stripSensitiveDeep(v: any): any {
  if (Array.isArray(v)) return v.map(stripSensitiveDeep)
  if (!v || typeof v !== 'object') return v
  const out: any = {}
  for (const [k, val] of Object.entries(v)) {
    if (SENSITIVE_KEYS.has(k)) continue
    out[k] = stripSensitiveDeep(val)
  }
  return out
}

function valueToCell(v: any): string | number | null {
  if (v === null || v === undefined) return null
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  if (typeof v === 'string') return v
  if (typeof v === 'boolean') return v ? 'true' : 'false'
  if (v instanceof Date) return v.toISOString()
  try {
    return JSON.stringify(v)
  } catch {
    return String(v)
  }
}

function toKvTable(title: string, entries: Array<[string, any]>): TablePayload {
  return {
    title,
    columns: ['Field', 'Value'],
    rows: entries.map(([k, v]) => [k, valueToCell(v)]),
  }
}

async function reportDbModelsList(): Promise<ChatResponse> {
  const models = getPrismaModelDelegates()
  const table: TablePayload = {
    title: 'Daftar entitas (internal)',
    columns: ['Entitas'],
    rows: models.map((m) => [m]),
  }
  return { answer: `Tersedia ${models.length} entitas.`, tables: [table] }
}

async function reportNotaSawitDetail(args: NotaSawitDetailArgs): Promise<ChatResponse> {
  const id = Number(args?.notaSawitId || 0)
  if (!Number.isFinite(id) || id <= 0) return { answer: 'notaSawitId wajib.', tables: [] }

  const row = await prisma.notaSawit.findUnique({
    where: { id },
    include: {
      kebun: { select: { id: true, name: true, location: true } },
      supir: { select: { id: true, name: true, role: true } },
      kendaraan: { select: { platNomor: true, merk: true, jenis: true } },
      pabrikSawit: { select: { id: true, name: true, address: true } },
      timbangan: {
        select: {
          id: true,
          date: true,
          grossKg: true,
          tareKg: true,
          netKg: true,
          kendaraanPlatNomor: true,
          kebun: { select: { id: true, name: true } },
          supir: { select: { id: true, name: true } },
          kendaraan: { select: { platNomor: true, merk: true } },
        },
      },
      kasTransaksi: {
        where: { deletedAt: null },
        orderBy: { date: 'desc' },
        take: 20,
        select: { id: true, date: true, tipe: true, kategori: true, jumlah: true, deskripsi: true, kebunId: true },
      },
      invoiceItems: { take: 20, select: { id: true, invoiceId: true, bulanLabel: true, jumlahKg: true, jumlahRp: true } },
      pembayaranBatchItems: {
        take: 20,
        select: { id: true, batchId: true, notaSawitId: true, tagihanNet: true, adminAllocated: true, pembayaranAktual: true, createdAt: true },
      },
    },
  })

  if (!row) return { answer: `NotaSawit #${id} tidak ditemukan.`, tables: [] }

  const header = toKvTable(`Nota Sawit #${row.id}`, [
    ['Tanggal Bongkar', row.tanggalBongkar],
    ['Kebun', row.kebun ? `${row.kebun.id} - ${row.kebun.name}` : null],
    ['Supir', row.supir ? `${row.supir.id} - ${row.supir.name}` : null],
    ['Kendaraan', row.kendaraanPlatNomor || row.kendaraan?.platNomor || null],
    ['Pabrik', row.pabrikSawit ? `${row.pabrikSawit.id} - ${row.pabrikSawit.name}` : null],
    ['Status Pembayaran', row.statusPembayaran],
    ['Bruto', row.bruto],
    ['Tara', row.tara],
    ['Netto', row.netto],
    ['Buah Balik', (row as any).buahBalik],
    ['Potongan', row.potongan],
    ['Harga/Kg', row.hargaPerKg],
    ['Total Pembayaran', row.totalPembayaran],
    ['PPh', row.pph],
    ['Setelah PPh', row.pembayaranSetelahPph],
    ['Pembayaran Aktual', row.pembayaranAktual],
    ['Keterangan', row.keterangan],
    ['CreatedAt', row.createdAt],
  ])

  const kasTable: TablePayload = {
    title: `Kas terkait Nota #${row.id} (max 20)`,
    columns: ['ID', 'Tanggal', 'Tipe', 'Kategori', 'Jumlah', 'Deskripsi'],
    rows: (row.kasTransaksi || []).map((k) => [
      k.id,
      k.date?.toLocaleDateString('id-ID'),
      k.tipe,
      k.kategori,
      formatIdCurrency(safeNumber(k.jumlah)),
      k.deskripsi,
    ]),
  }

  const invoiceItemsTable: TablePayload = {
    title: `Invoice Items terkait (max 20)`,
    columns: ['ID', 'InvoiceID', 'Bulan', 'Kg', 'Rp'],
    rows: (row.invoiceItems || []).map((it) => [
      it.id,
      it.invoiceId,
      it.bulanLabel,
      safeNumber(it.jumlahKg),
      formatIdCurrency(safeNumber(it.jumlahRp)),
    ]),
  }

  const batchItemsTable: TablePayload = {
    title: `Pembayaran Batch Items (max 20)`,
    columns: ['ID', 'BatchID', 'Tagihan Net', 'Admin', 'Bayar Aktual', 'CreatedAt'],
    rows: (row.pembayaranBatchItems || []).map((it) => [
      it.id,
      it.batchId,
      formatIdCurrency(safeNumber(it.tagihanNet)),
      formatIdCurrency(safeNumber(it.adminAllocated)),
      formatIdCurrency(safeNumber(it.pembayaranAktual)),
      it.createdAt?.toLocaleString('id-ID'),
    ]),
  }

  const timbanganTable = row.timbangan
    ? toKvTable(`Timbangan terkait #${row.timbangan.id}`, [
        ['Tanggal', row.timbangan.date],
        ['GrossKg', row.timbangan.grossKg],
        ['TareKg', row.timbangan.tareKg],
        ['NetKg', row.timbangan.netKg],
        ['Kebun', row.timbangan.kebun ? `${row.timbangan.kebun.id} - ${row.timbangan.kebun.name}` : null],
        ['Supir', row.timbangan.supir ? `${row.timbangan.supir.id} - ${row.timbangan.supir.name}` : null],
        ['Kendaraan', row.timbangan.kendaraanPlatNomor || row.timbangan.kendaraan?.platNomor || null],
      ])
    : null

  const tables = [header, timbanganTable, kasTable, invoiceItemsTable, batchItemsTable].filter(Boolean) as TablePayload[]
  return { answer: `Detail NotaSawit #${row.id}.`, tables }
}

async function reportKasTransaksiDetail(args: KasTransaksiDetailArgs): Promise<ChatResponse> {
  const id = Number(args?.kasTransaksiId || 0)
  if (!Number.isFinite(id) || id <= 0) return { answer: 'kasTransaksiId wajib.', tables: [] }

  const row = await prisma.kasTransaksi.findUnique({
    where: { id },
    include: {
      kebun: { select: { id: true, name: true } },
      karyawan: { select: { id: true, name: true, role: true } },
      kendaraan: { select: { platNomor: true, merk: true, jenis: true } },
      user: { select: { id: true, name: true, role: true } },
      hutangBank: { select: { id: true, namaBank: true, status: true } },
      gajian: { select: { id: true, kebunId: true, tipe: true, status: true, tanggalMulai: true, tanggalSelesai: true } },
      notaSawit: { select: { id: true, tanggalBongkar: true, kebunId: true, supirId: true, pembayaranSetelahPph: true, statusPembayaran: true } },
      notaSawitPembayaranBatch: { select: { id: true, tanggal: true, pabrikSawitId: true, jumlahMasuk: true, adminBank: true } },
    },
  })

  if (!row) return { answer: `KasTransaksi #${id} tidak ditemukan.`, tables: [] }

  const header = toKvTable(`Kas Transaksi #${row.id}`, [
    ['Tanggal', row.date],
    ['Tipe', row.tipe],
    ['Kategori', row.kategori],
    ['Jumlah', formatIdCurrency(safeNumber(row.jumlah))],
    ['Deskripsi', row.deskripsi],
    ['Keterangan', row.keterangan],
    ['Kebun', row.kebun ? `${row.kebun.id} - ${row.kebun.name}` : row.kebunId],
    ['Karyawan', row.karyawan ? `${row.karyawan.id} - ${row.karyawan.name}` : row.karyawanId],
    ['Kendaraan', row.kendaraanPlatNomor || row.kendaraan?.platNomor || null],
    ['Created By', row.user ? `${row.user.id} - ${row.user.name}` : row.userId],
    ['DeletedAt', row.deletedAt],
    ['CreatedAt', row.createdAt],
  ])

  const rel = toKvTable('Relasi', [
    ['HutangBank', row.hutangBank ? `${row.hutangBank.id} - ${row.hutangBank.namaBank} (${row.hutangBank.status})` : null],
    ['Gajian', row.gajian ? `#${row.gajian.id} kebunId=${row.gajian.kebunId} tipe=${row.gajian.tipe} status=${row.gajian.status}` : null],
    ['NotaSawit', row.notaSawit ? `#${row.notaSawit.id} status=${row.notaSawit.statusPembayaran}` : null],
    ['PembayaranBatch', row.notaSawitPembayaranBatch ? `#${row.notaSawitPembayaranBatch.id} jumlahMasuk=${formatIdCurrency(safeNumber(row.notaSawitPembayaranBatch.jumlahMasuk))}` : null],
  ])

  return { answer: `Detail KasTransaksi #${row.id}.`, tables: [header, rel] }
}

async function reportKebunDetail(args: KebunDetailArgs): Promise<ChatResponse> {
  const scope = await resolveKebunIds({ kebunId: args.kebunId, kebunName: args.kebunName })
  const kebunId = scope.kebunIds && scope.kebunIds.length === 1 ? scope.kebunIds[0] : null
  if (!kebunId) return { answer: 'kebunId/kebunName wajib (harus 1 kebun spesifik).', tables: [] }
  const limit = Math.min(50, Math.max(5, Number(args.recentLimit || 20)))

  const kebun = await prisma.kebun.findUnique({
    where: { id: kebunId },
    select: { id: true, name: true, location: true, createdAt: true, updatedAt: true },
  })
  if (!kebun) return { answer: `Kebun #${kebunId} tidak ditemukan.`, tables: [] }

  const [notaRows, kasRows, pekRows, gajianRows] = await Promise.all([
    prisma.notaSawit.findMany({
      where: { kebunId: kebunId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: { id: true, tanggalBongkar: true, createdAt: true, statusPembayaran: true, netto: true, pembayaranSetelahPph: true, supir: { select: { name: true } } },
    }),
    prisma.kasTransaksi.findMany({
      where: { kebunId: kebunId, deletedAt: null },
      orderBy: { date: 'desc' },
      take: limit,
      select: { id: true, date: true, tipe: true, kategori: true, jumlah: true, deskripsi: true },
    }),
    prisma.pekerjaanKebun.findMany({
      where: { kebunId: kebunId },
      orderBy: { date: 'desc' },
      take: limit,
      select: { id: true, date: true, jenisPekerjaan: true, kategoriBorongan: true, biaya: true, upahBorongan: true, user: { select: { name: true } } },
    }),
    prisma.gajian.findMany({
      where: { kebunId: kebunId },
      orderBy: { tanggalSelesai: 'desc' },
      take: Math.min(20, limit),
      select: { id: true, tanggalMulai: true, tanggalSelesai: true, tipe: true, status: true, totalGaji: true, totalBiayaLain: true, totalPotongan: true },
    }),
  ])

  const header = toKvTable(`Kebun #${kebun.id}`, [
    ['Nama', kebun.name],
    ['Lokasi', kebun.location],
    ['CreatedAt', kebun.createdAt],
    ['UpdatedAt', kebun.updatedAt],
  ])

  const notaTable: TablePayload = {
    title: `Nota Sawit terbaru (max ${limit})`,
    columns: ['ID', 'Tanggal', 'Supir', 'Status', 'Netto', 'Setelah PPh'],
    rows: notaRows.map((r) => [
      r.id,
      (r.tanggalBongkar || r.createdAt).toLocaleDateString('id-ID'),
      String(r.supir?.name || '-'),
      r.statusPembayaran,
      formatIdCurrency(safeNumber(r.netto)),
      formatIdCurrency(safeNumber(r.pembayaranSetelahPph)),
    ]),
  }

  const kasTable: TablePayload = {
    title: `Kas terbaru (max ${limit})`,
    columns: ['ID', 'Tanggal', 'Tipe', 'Kategori', 'Jumlah', 'Deskripsi'],
    rows: kasRows.map((r) => [r.id, r.date.toLocaleDateString('id-ID'), r.tipe, r.kategori, formatIdCurrency(safeNumber(r.jumlah)), r.deskripsi]),
  }

  const pekTable: TablePayload = {
    title: `Pekerjaan terbaru (max ${limit})`,
    columns: ['ID', 'Tanggal', 'Jenis', 'Kategori', 'UpahBorongan', 'Biaya', 'User'],
    rows: pekRows.map((r) => [
      r.id,
      r.date.toLocaleDateString('id-ID'),
      r.jenisPekerjaan,
      r.kategoriBorongan || '-',
      r.upahBorongan ? 'true' : 'false',
      formatIdCurrency(safeNumber(r.biaya)),
      String(r.user?.name || '-'),
    ]),
  }

  const gajianTable: TablePayload = {
    title: `Gajian terbaru (max ${Math.min(20, limit)})`,
    columns: ['ID', 'Periode', 'Tipe', 'Status', 'Total Gaji', 'Biaya Lain', 'Potongan'],
    rows: gajianRows.map((r) => [
      r.id,
      `${r.tanggalMulai.toLocaleDateString('id-ID')} s/d ${r.tanggalSelesai.toLocaleDateString('id-ID')}`,
      r.tipe,
      r.status,
      formatIdCurrency(safeNumber(r.totalGaji)),
      formatIdCurrency(safeNumber(r.totalBiayaLain)),
      formatIdCurrency(safeNumber(r.totalPotongan)),
    ]),
  }

  return { answer: `Detail Kebun #${kebun.id} (ringkas + data terbaru).`, tables: [header, notaTable, kasTable, pekTable, gajianTable] }
}

async function reportDbFindMany(args: any): Promise<ChatResponse> {
  const model = resolveModelDelegateName(args?.model)
  if (!model) return invalidModelResponse(args?.model)
  const take = Math.min(100, Math.max(1, Number(args?.take ?? 20)))
  const skip = Math.max(0, Number(args?.skip ?? 0))
  const whereRaw = isPlainObject(args?.where) ? stripSensitiveDeep(args.where) : undefined
  const where = whereRaw ? coerceWhereDateTimes(whereRaw, 8) : undefined
  const selectRaw = isPlainObject(args?.select) ? stripSensitiveDeep(args.select) : undefined
  const includeRaw = isPlainObject(args?.include) ? stripSensitiveDeep(args.include) : undefined
  const select = selectRaw ? pruneNestedObject(selectRaw, 2) : undefined
  const include = includeRaw ? pruneNestedObject(includeRaw, 2) : undefined
  const orderByRaw = args?.orderBy
  const orderByInput =
    isPlainObject(orderByRaw) || Array.isArray(orderByRaw) ? stripSensitiveDeep(orderByRaw) : undefined
  const allowed = getModelFieldNameSet(model)
  const aliasMap: Record<string, string> = { nama: 'name', lokasi: 'location', dibuat: 'createdAt', diubah: 'updatedAt' }
  const orderBy = orderByInput ? sanitizeOrderBy(orderByInput, allowed, aliasMap).out : undefined

  const rows = await (prisma as any)[model].findMany({ where, select, include, orderBy, take, skip })
  const cleaned = Array.isArray(rows) ? rows.map(stripSensitiveDeep) : []
  const first = cleaned[0]
  const cols = first && typeof first === 'object' ? Object.keys(first).slice(0, 20) : ['value']
  const table: TablePayload = {
    title: `Data (list)`,
    columns: cols,
    rows: cleaned.slice(0, 50).map((r: any) => cols.map((c) => valueToCell(r?.[c]))),
  }
  return { answer: `Ditemukan ${cleaned.length} baris (ditampilkan max 50).`, tables: [table] }
}

async function reportDbFindUnique(args: any): Promise<ChatResponse> {
  const model = resolveModelDelegateName(args?.model)
  if (!model) return invalidModelResponse(args?.model)
  const whereRaw = isPlainObject(args?.where) ? stripSensitiveDeep(args.where) : null
  const where = whereRaw ? coerceWhereDateTimes(whereRaw, 8) : null
  if (!where) return { answer: 'where wajib (object). Contoh: { id: 1 }', tables: [] }
  const selectRaw = isPlainObject(args?.select) ? stripSensitiveDeep(args.select) : undefined
  const includeRaw = isPlainObject(args?.include) ? stripSensitiveDeep(args.include) : undefined
  const select = selectRaw ? pruneNestedObject(selectRaw, 2) : undefined
  const include = includeRaw ? pruneNestedObject(includeRaw, 2) : undefined
  const row = await (prisma as any)[model].findUnique({ where, select, include })
  const cleaned = row ? stripSensitiveDeep(row) : null
  const cols = cleaned && typeof cleaned === 'object' ? Object.keys(cleaned).slice(0, 20) : ['value']
  const table: TablePayload = {
    title: `Data (detail)`,
    columns: cols,
    rows: [cols.map((c) => valueToCell((cleaned as any)?.[c]))],
  }
  return { answer: cleaned ? `1 baris ditemukan.` : `Data tidak ditemukan.`, tables: [table] }
}

async function reportDbCount(args: any): Promise<ChatResponse> {
  const model = resolveModelDelegateName(args?.model)
  if (!model) return invalidModelResponse(args?.model)
  const whereRaw = isPlainObject(args?.where) ? stripSensitiveDeep(args.where) : undefined
  const where = whereRaw ? coerceWhereDateTimes(whereRaw, 8) : undefined
  const n = await (prisma as any)[model].count({ where })
  const table: TablePayload = { title: `Ringkasan`, columns: ['count'], rows: [[n]] }
  return { answer: `count = ${n}.`, tables: [table] }
}

async function reportDbCompare(args: any): Promise<ChatResponse> {
  const model = resolveModelDelegateName(args?.model)
  if (!model) return invalidModelResponse(args?.model)
  const metric = String(args?.metric || 'count').trim().toLowerCase()
  const labelA = String(args?.labelA || 'A').trim() || 'A'
  const labelB = String(args?.labelB || 'B').trim() || 'B'
  const whereARaw = isPlainObject(args?.whereA) ? stripSensitiveDeep(args.whereA) : undefined
  const whereBRaw = isPlainObject(args?.whereB) ? stripSensitiveDeep(args.whereB) : undefined
  const whereA = whereARaw ? coerceWhereDateTimes(whereARaw, 8) : undefined
  const whereB = whereBRaw ? coerceWhereDateTimes(whereBRaw, 8) : undefined

  let a = 0
  let b = 0
  let metricLabel = 'count'

  if (metric === 'sum') {
    const field = String(args?.field || '').trim()
    if (!field) return { answer: 'field wajib untuk metric=sum.', tables: [] }
    if (SENSITIVE_KEYS.has(field)) return { answer: 'field sensitif tidak diizinkan.', tables: [] }
    const [ra, rb] = await Promise.all([
      (prisma as any)[model].aggregate({ where: whereA, _sum: { [field]: true } }),
      (prisma as any)[model].aggregate({ where: whereB, _sum: { [field]: true } }),
    ])
    a = safeNumber(ra?._sum?.[field])
    b = safeNumber(rb?._sum?.[field])
    metricLabel = `sum(${field})`
  } else {
    const [ca, cb] = await Promise.all([
      (prisma as any)[model].count({ where: whereA }),
      (prisma as any)[model].count({ where: whereB }),
    ])
    a = safeNumber(ca)
    b = safeNumber(cb)
    metricLabel = 'count'
  }

  const diff = b - a
  const pct = a !== 0 ? diff / a : null

  const table: TablePayload = {
    title: `Perbandingan`,
    columns: ['Label', 'Nilai'],
    rows: [
      [labelA, a],
      [labelB, b],
      ['Selisih (B-A)', diff],
      ['Perubahan %', pct === null ? null : `${(pct * 100).toFixed(1)}%`],
    ],
  }

  const pctText = pct === null ? 'n/a' : `${(pct * 100).toFixed(1)}%`
  return {
    answer: `Perbandingan (${metricLabel}): ${labelA}=${a}, ${labelB}=${b}, selisih=${diff}, perubahan=${pctText}.`,
    tables: [table],
  }
}

function getDmmfDatamodel() {
  try {
    const d = (Prisma as any)?.dmmf?.datamodel
    if (d && typeof d === 'object') return d
  } catch {}
  return null
}

function normKey(v: unknown) {
  return String(v || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

function getDmmfModelForDelegate(delegateName: string) {
  const dm = getDmmfDatamodel()
  const models = Array.isArray((dm as any)?.models) ? ((dm as any).models as any[]) : []
  const target = normKey(delegateName)
  return models.find((m) => normKey(m?.name) === target) || null
}

function getModelFieldNameSet(delegateName: string) {
  const hit = getDmmfModelForDelegate(delegateName)
  const fields = Array.isArray(hit?.fields) ? (hit.fields as any[]) : []
  const set = new Set<string>()
  for (const f of fields) {
    const n = String(f?.name || '').trim()
    if (n) set.add(n)
  }
  return set
}

function pickRawModelByQuestion(message: string) {
  const norm = normalizeText(message)
  if (norm.includes('nota') || norm.includes('tbs') || norm.includes('sawit')) return 'notaSawit'
  if (norm.includes('kas') || norm.includes('kasir') || norm.includes('pengeluaran') || norm.includes('pemasukan')) return 'kasTransaksi'
  if (norm.includes('gajian') || norm.includes('gaji')) return 'gajian'
  if (norm.includes('pekerjaan') || norm.includes('borongan')) return 'pekerjaanKebun'
  if (norm.includes('timbangan')) return 'timbangan'
  if (norm.includes('kebun')) return 'kebun'
  if (norm.includes('kendaraan') || norm.includes('plat')) return 'kendaraan'
  if (norm.includes('supir') || norm.includes('karyawan') || norm.includes('user')) return 'user'
  if (norm.includes('absensi')) return 'absensiHarian'
  if (norm.includes('audit')) return 'auditTrail'
  if (norm.includes('inventory')) return 'inventoryTransaction'
  return null
}

function pickModelDateField(delegateName: string) {
  const hit = getDmmfModelForDelegate(delegateName)
  const fields = Array.isArray(hit?.fields) ? (hit.fields as any[]) : []
  const dateFields = fields
    .filter((f) => String(f?.kind) === 'scalar' && String(f?.type) === 'DateTime')
    .map((f) => String(f?.name || '').trim())
    .filter(Boolean)
  if (dateFields.includes('date')) return 'date'
  if (dateFields.includes('tanggalBongkar')) return 'tanggalBongkar'
  if (dateFields.includes('tanggalMulai')) return 'tanggalMulai'
  if (dateFields.includes('createdAt')) return 'createdAt'
  if (dateFields.includes('updatedAt')) return 'updatedAt'
  return dateFields[0] || ''
}

function pickScalarSelect(delegateName: string, maxFields: number) {
  const hit = getDmmfModelForDelegate(delegateName)
  const fields = Array.isArray(hit?.fields) ? (hit.fields as any[]) : []
  const pick: string[] = []
  const prefer = ['id', 'name', 'date', 'createdAt', 'updatedAt', 'tanggalBongkar', 'jumlah', 'netto', 'bruto', 'tara', 'kategori', 'tipe', 'status', 'keterangan', 'deskripsi', 'kendaraanPlatNomor']
  const scalarFields = fields
    .filter((f) => String(f?.kind) === 'scalar')
    .map((f) => String(f?.name || '').trim())
    .filter(Boolean)
  for (const p of prefer) if (scalarFields.includes(p) && !pick.includes(p)) pick.push(p)
  for (const f of scalarFields) {
    if (pick.length >= maxFields) break
    if (!pick.includes(f)) pick.push(f)
  }
  const select: any = {}
  for (const f of pick.slice(0, maxFields)) select[f] = true
  return select
}

async function rawFallbackFromDb(message: string, apiKey: string, model: string): Promise<ChatResponse | null> {
  const delegate = pickRawModelByQuestion(message)
  if (!delegate) return null
  const resolved = resolveModelDelegateName(delegate)
  if (!resolved) return null
  const dateField = pickModelDateField(resolved)
  const range = inferRangeFromQuestion(message)
  const allowed = getModelFieldNameSet(resolved)
  const where: any = {}
  if (allowed.has('deletedAt')) where.deletedAt = null
  if (range && dateField) where[dateField] = { gte: range.start, lte: range.end }
  const select = pickScalarSelect(resolved, 18)
  const orderBy = dateField ? ({ [dateField]: 'desc' } as any) : ({ id: 'desc' } as any)
  const rows = await (prisma as any)[resolved].findMany({ where, select, orderBy, take: 200, skip: 0 })
  const cleaned = Array.isArray(rows) ? rows.map(stripSensitiveDeep) : []
  const first = cleaned[0]
  const cols = first && typeof first === 'object' ? Object.keys(first).slice(0, 18) : ['value']
  const table: TablePayload = {
    title: 'Data mentah (sample)',
    columns: cols,
    rows: cleaned.slice(0, 50).map((r: any) => cols.map((c) => valueToCell(r?.[c]))),
  }
  const draft = range ? `${range.label}. Sample ${cleaned.length} baris (ditampilkan max 50).` : `Sample ${cleaned.length} baris (ditampilkan max 50).`
  const resp: ChatResponse = { answer: draft, tables: [table], reasoning: ['Raw fallback: ambil sample data mentah lalu AI rangkum.'] }
  return postProcessAgentResponse({ apiKey, model, question: message, resp })
}

function sanitizeFieldKeyObject(
  obj: any,
  allowed: Set<string>,
  aliasMap: Record<string, string>,
  label: string
): { out: any; notes: string[] } {
  const notes: string[] = []
  if (!isPlainObject(obj)) return { out: obj, notes }
  const out: any = {}
  for (const [kRaw, v] of Object.entries(obj)) {
    const k = String(kRaw || '').trim()
    if (!k) continue
    const mapped = aliasMap[k] || k
    if (!allowed.has(mapped)) {
      notes.push(`${label}: drop key "${k}"`)
      continue
    }
    if (mapped !== k) notes.push(`${label}: map "${k}" -> "${mapped}"`)
    out[mapped] = v
  }
  return { out, notes }
}

function sanitizeWhereRoot(where: any, allowed: Set<string>, aliasMap: Record<string, string>) {
  const notes: string[] = []
  if (!isPlainObject(where)) return { out: where, notes }
  const out: any = {}
  for (const [kRaw, v] of Object.entries(where)) {
    const k = String(kRaw || '').trim()
    if (!k) continue
    const isLogic = k === 'AND' || k === 'OR' || k === 'NOT'
    const mapped = aliasMap[k] || k
    if (!isLogic && !allowed.has(mapped)) {
      notes.push(`where: drop key "${k}"`)
      continue
    }
    if (mapped !== k) notes.push(`where: map "${k}" -> "${mapped}"`)
    out[mapped] = v
  }
  return { out, notes }
}

function sanitizeOrderBy(orderBy: any, allowed: Set<string>, aliasMap: Record<string, string>) {
  const notes: string[] = []
  if (!orderBy) return { out: orderBy, notes }
  const cleanOne = (obj: any) => {
    if (!isPlainObject(obj)) return { out: obj, notes: [] as string[] }
    const out: any = {}
    const local: string[] = []
    for (const [kRaw, v] of Object.entries(obj)) {
      const k = String(kRaw || '').trim()
      if (!k) continue
      const mapped = aliasMap[k] || k
      if (!allowed.has(mapped)) {
        local.push(`orderBy: drop key "${k}"`)
        continue
      }
      if (mapped !== k) local.push(`orderBy: map "${k}" -> "${mapped}"`)
      out[mapped] = v
    }
    return { out, notes: local }
  }

  if (Array.isArray(orderBy)) {
    const list: any[] = []
    for (const it of orderBy) {
      const c = cleanOne(it)
      notes.push(...c.notes)
      if (isPlainObject(c.out) && Object.keys(c.out).length === 0) continue
      list.push(c.out)
    }
    return { out: list.length > 0 ? list : undefined, notes }
  }

  const c = cleanOne(orderBy)
  notes.push(...c.notes)
  if (isPlainObject(c.out) && Object.keys(c.out).length === 0) return { out: undefined, notes }
  return { out: c.out, notes }
}

function redactDbNamesFromText(text: string) {
  const s = String(text || '')
  return s
    .replace(/\bprisma\.[A-Za-z0-9_]+\./g, 'prisma.[entitas].')
    .replace(/\bModel\s+[A-Za-z0-9_]+\b/g, 'Model [entitas]')
}

async function reportDbModelInfo(args: any): Promise<ChatResponse> {
  const model = resolveModelDelegateName(args?.model)
  if (!model) return invalidModelResponse(args?.model)
  const dm = getDmmfDatamodel()
  const models = Array.isArray((dm as any)?.models) ? ((dm as any).models as any[]) : []
  const hit = models.find((m) => String(m?.name || '').toLowerCase() === model.toLowerCase()) || null
  const fields = Array.isArray(hit?.fields) ? hit!.fields : []
  const table: TablePayload = {
    title: `Schema (internal)`,
    columns: ['Field', 'Kind', 'Type', 'Optional', 'IsId', 'IsList', 'Relation', 'FromFields', 'ToFields'],
    rows: fields.map((f: any) => [
      String(f?.name || ''),
      String(f?.kind || ''),
      String(f?.type || ''),
      Boolean(f?.isRequired) ? 'false' : 'true',
      Boolean(f?.isId) ? 'true' : 'false',
      Boolean(f?.isList) ? 'true' : 'false',
      String(f?.relationName || ''),
      Array.isArray(f?.relationFromFields) ? (f.relationFromFields as any[]).join(',') : '',
      Array.isArray(f?.relationToFields) ? (f.relationToFields as any[]).join(',') : '',
    ]),
  }
  return { answer: `Schema. Field ${fields.length}.`, tables: [table] }
}

function normalizeSql(sql: string) {
  return String(sql || '').replace(/\s+/g, ' ').trim()
}

function ensureSqlLimit(sql: string, maxLimit: number) {
  const m = sql.match(/\blimit\s+(\d+)\b/i)
  if (!m) return `${sql} LIMIT ${Math.min(50, maxLimit)}`
  const n = Number(m[1])
  if (!Number.isFinite(n)) return sql
  if (n <= maxLimit) return sql
  return sql.replace(/\blimit\s+\d+\b/i, `LIMIT ${maxLimit}`)
}

type SqlValidation = { ok: false; error: string } | { ok: true; sql: string }

function validateReadOnlySql(sql: string): SqlValidation {
  const s = normalizeSql(sql)
  if (!s) return { ok: false, error: 'sql kosong' }
  const start = s.slice(0, 10).toLowerCase()
  if (!(start.startsWith('select') || start.startsWith('with'))) return { ok: false, error: 'hanya SELECT/WITH diizinkan' }
  if (s.includes(';')) return { ok: false, error: 'semicolon tidak diizinkan' }
  if (s.includes('--') || s.includes('/*') || s.includes('*/')) return { ok: false, error: 'comment tidak diizinkan' }
  const bad = /\b(insert|update|delete|drop|alter|create|truncate|grant|revoke|vacuum|analyze|refresh|call|execute|do)\b/i
  if (bad.test(s)) return { ok: false, error: 'statement non-readonly tidak diizinkan' }
  return { ok: true, sql: s }
}

async function reportDbRawSelect(args: any): Promise<ChatResponse> {
  const rawSql = String(args?.sql || '').trim()
  const v = validateReadOnlySql(rawSql)
  if (!v.ok) return { answer: `sql ditolak: ${v.error}`, tables: [] }
  // SECURITY: raw SQL execution disabled to prevent SQL injection via LLM-generated queries
  return { answer: 'Eksekusi SQL raw tidak diizinkan untuk alasan keamanan. Gunakan query builder Prisma.', tables: [] }
}

type DbMetric = 'count' | 'sum' | 'avg' | 'min' | 'max'
type DbCompareSpec = {
  label?: string
  model?: string
  where?: any
  metric?: DbMetric
  field?: string
  sql?: string
}

function extractFirstNumericCell(rows: any) {
  const list = Array.isArray(rows) ? rows : []
  const first = list[0]
  if (!first || typeof first !== 'object') return null
  for (const v of Object.values(first)) {
    const n = typeof v === 'number' ? v : Number(v)
    if (Number.isFinite(n)) return n
  }
  return null
}

async function evalCompareSpec(spec: DbCompareSpec) {
  const label = String(spec?.label || '').trim() || 'Item'
  const metric = (String(spec?.metric || 'count').trim().toLowerCase() as DbMetric) || 'count'

  if (spec?.sql) {
    const v = validateReadOnlySql(String(spec.sql))
    if (!v.ok) return { ok: false as const, label, error: `sql ditolak: ${v.error}` }
    // SECURITY: raw SQL execution disabled to prevent SQL injection via LLM-generated queries
    return { ok: false as const, label, error: 'sql ditolak: eksekusi SQL raw tidak diizinkan untuk alasan keamanan' }
  }

  const model = resolveModelDelegateName(spec?.model)
  if (!model) return { ok: false as const, label, error: 'entitas tidak valid.' }
  const where = isPlainObject(spec?.where) ? stripSensitiveDeep(spec.where) : undefined

  if (metric === 'count') {
    const n = await (prisma as any)[model].count({ where })
    return { ok: true as const, label, metric: `${model}.count`, value: safeNumber(n) }
  }

  const field = String(spec?.field || '').trim()
  if (!field) return { ok: false as const, label, error: `field wajib untuk metric=${metric}` }
  if (SENSITIVE_KEYS.has(field)) return { ok: false as const, label, error: 'field sensitif tidak diizinkan' }

  const aggArg: any = { where }
  if (metric === 'sum') aggArg._sum = { [field]: true }
  else if (metric === 'avg') aggArg._avg = { [field]: true }
  else if (metric === 'min') aggArg._min = { [field]: true }
  else if (metric === 'max') aggArg._max = { [field]: true }

  const res = await (prisma as any)[model].aggregate(aggArg)
  const bucket = metric === 'sum' ? res?._sum : metric === 'avg' ? res?._avg : metric === 'min' ? res?._min : res?._max
  const value = safeNumber(bucket?.[field])
  return { ok: true as const, label, metric: `${model}.${metric}(${field})`, value }
}

async function reportDbCompareAny(args: any): Promise<ChatResponse> {
  const aAny = (args as any)?.a
  const bAny = (args as any)?.b
  if (!aAny || !bAny) return { answer: 'a dan b wajib.', tables: [] }

  const isToolInvoke = (v: any) => v && typeof v === 'object' && typeof v.name === 'string' && v.name.trim() && 'args' in v
  if (isToolInvoke(aAny) || isToolInvoke(bAny)) {
    if (!isToolInvoke(aAny) || !isToolInvoke(bAny)) return { answer: 'Format salah. a dan b harus sama-sama tool invoke.', tables: [] }
    const aName = String(aAny.name || '').trim()
    const bName = String(bAny.name || '').trim()
    if (!aName || !bName) return { answer: 'name tool wajib.', tables: [] }
    if (aName === 'db_compare_any' || bName === 'db_compare_any') return { answer: 'Tool db_compare_any tidak boleh dipanggil nested.', tables: [] }

    const [aExec, bExec] = await Promise.all([executeTool(aName, aAny.args || {}), executeTool(bName, bAny.args || {})])
    if (!aExec.result) return { answer: `A error: tool "${aName}" gagal dieksekusi.`, tables: [] }
    if (!bExec.result) return { answer: `B error: tool "${bName}" gagal dieksekusi.`, tables: [] }

    const pickKv = (tables: TablePayload[]) => {
      for (const t of tables || []) {
        const cols = Array.isArray(t?.columns) ? t.columns : []
        if (cols.length !== 2) continue
        const c0 = String(cols[0] || '').trim().toLowerCase()
        const c1 = String(cols[1] || '').trim().toLowerCase()
        if (c0 === 'field' && c1 === 'value') return t
      }
      return null
    }

    const aKv = pickKv(aExec.result.tables || [])
    const bKv = pickKv(bExec.result.tables || [])
    if (aKv && bKv) {
      const aMap = new Map<string, string | number | null>()
      const bMap = new Map<string, string | number | null>()
      const order: string[] = []
      for (const r of aKv.rows || []) {
        const k = String(r?.[0] ?? '').trim()
        if (!k) continue
        if (!aMap.has(k)) order.push(k)
        aMap.set(k, (r?.[1] ?? null) as any)
      }
      for (const r of bKv.rows || []) {
        const k = String(r?.[0] ?? '').trim()
        if (!k) continue
        if (!aMap.has(k) && !order.includes(k)) order.push(k)
        bMap.set(k, (r?.[1] ?? null) as any)
      }

      let same = 0
      let diff = 0
      const rows: Array<Array<string | number | null>> = []
      for (const k of order) {
        const av = aMap.has(k) ? (aMap.get(k) as any) : null
        const bv = bMap.has(k) ? (bMap.get(k) as any) : null
        const avStr = av == null ? '' : String(av)
        const bvStr = bv == null ? '' : String(bv)
        if (avStr === bvStr) same += 1
        else diff += 1
        const aNum = typeof av === 'number' ? av : Number.NaN
        const bNum = typeof bv === 'number' ? bv : Number.NaN
        const delta = Number.isFinite(aNum) && Number.isFinite(bNum) ? bNum - aNum : null
        rows.push([k, av == null ? null : (av as any), bv == null ? null : (bv as any), delta])
      }

      const table: TablePayload = {
        title: 'Perbandingan',
        columns: ['Field', 'A', 'B', 'Selisih(B-A)'],
        rows,
      }
      return {
        answer: `Perbandingan data: field sama ${same}, beda ${diff}.`,
        tables: [table],
        reasoning: [
          `Compare mode: 2 tool.\nA: ${aName}. args: ${safeShortJson(aExec.args, 420)}\nB: ${bName}. args: ${safeShortJson(bExec.args, 420)}`,
        ],
      }
    }

    const tables = [...(aExec.result.tables || []), ...(bExec.result.tables || [])]
    return {
      answer: `Perbandingan data A vs B.\nA: ${String(aExec.result.answer || '').trim()}\nB: ${String(bExec.result.answer || '').trim()}`,
      tables,
      reasoning: [
        `Compare mode: 2 tool.\nA: ${aName}. args: ${safeShortJson(aExec.args, 420)}\nB: ${bName}. args: ${safeShortJson(bExec.args, 420)}`,
      ],
    }
  }

  const aSpec = aAny as DbCompareSpec
  const bSpec = bAny as DbCompareSpec

  const [a, b] = await Promise.all([evalCompareSpec(aSpec), evalCompareSpec(bSpec)])
  if (!a.ok) return { answer: `A error: ${a.error}`, tables: [] }
  if (!b.ok) return { answer: `B error: ${b.error}`, tables: [] }

  const diff = b.value - a.value
  const pct = a.value !== 0 ? diff / a.value : null

  const table: TablePayload = {
    title: 'Perbandingan',
    columns: ['Item', 'Metric', 'Nilai'],
    rows: [
      [a.label, a.metric, a.value],
      [b.label, b.metric, b.value],
      ['Selisih (B-A)', '', diff],
      ['Perubahan %', '', pct === null ? null : `${(pct * 100).toFixed(1)}%`],
    ],
  }

  const pctText = pct === null ? 'n/a' : `${(pct * 100).toFixed(1)}%`
  return { answer: `A=${a.value}, B=${b.value}, selisih=${diff}, perubahan=${pctText}.`, tables: [table] }
}

async function reportNotaSawitSearch(args: NotaSawitSearchArgs): Promise<ChatResponse> {
  const range = resolveRange(args.rangePreset, args.startDate, args.endDate)
  const scope = await resolveKebunIds({ kebunId: args.kebunId, kebunName: args.kebunName })
  const qRaw = String(args.query || '').trim()
  const supirNameArg = String(args.supirName || '').trim()
  const supirIdArg = Number(args.supirId || 0)
  const q = qRaw.replace(/\bsupir\b/gi, ' ').replace(/\s+/g, ' ').trim()
  const status = String(args.statusPembayaran || '').trim()
  const limit = Math.min(50, Math.max(1, Number(args.limit || 20)))

  const where: any = {
    deletedAt: null,
    OR: [
      { tanggalBongkar: { gte: range.start, lte: range.end } },
      { tanggalBongkar: null, createdAt: { gte: range.start, lte: range.end } },
    ],
  }
  if (scope.kebunIds) where.kebunId = { in: scope.kebunIds }
  if (status) where.statusPembayaran = { equals: status, mode: 'insensitive' }

  const tablesPrefix: TablePayload[] = []
  if (supirIdArg > 0 || supirNameArg) {
    if (supirIdArg > 0) {
      where.supirId = supirIdArg
    } else {
      const supirRows = await prisma.user.findMany({
        where: { role: 'SUPIR', name: { contains: supirNameArg, mode: 'insensitive' } },
        take: 10,
        select: { id: true, name: true },
      })
      const ids = supirRows.map((r) => Number(r.id)).filter((n) => Number.isFinite(n) && n > 0)
      if (ids.length === 0) {
        const table: TablePayload = { title: `Supir cocok "${supirNameArg}"`, columns: ['ID', 'Nama'], rows: [] }
        return { answer: `Supir "${supirNameArg}" tidak ditemukan di database.`, tables: [table] }
      }
      where.supirId = { in: ids }
      const table: TablePayload = {
        title: `Supir cocok "${supirNameArg}"`,
        columns: ['ID', 'Nama'],
        rows: supirRows.map((r) => [r.id, r.name]),
      }
      tablesPrefix.push(table)
    }
  }

  if (q) {
    const isNumeric = /^\d+$/.test(q)
    where.AND = [
      {
        OR: [
          { keterangan: { contains: q, mode: 'insensitive' } },
          { kendaraanPlatNomor: { contains: q, mode: 'insensitive' } },
          ...(isNumeric ? [{ id: Number(q) }] : []),
        ],
      },
    ]
  }

  const rows = await prisma.notaSawit.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true,
      tanggalBongkar: true,
      createdAt: true,
      statusPembayaran: true,
      pembayaranSetelahPph: true,
      netto: true,
      supir: { select: { id: true, name: true } },
      kebun: { select: { id: true, name: true } },
      kendaraanPlatNomor: true,
    },
  })
  const agg = await prisma.notaSawit.aggregate({
    where,
    _count: { _all: true },
    _sum: { pembayaranSetelahPph: true, netto: true },
  })
  const totalCount = safeNumber((agg as any)?._count?._all)
  const totalNetto = safeNumber((agg as any)?._sum?.netto)
  const totalSetelahPph = safeNumber((agg as any)?._sum?.pembayaranSetelahPph)

  const table: TablePayload = {
    title: `Nota Sawit (${range.label})`,
    columns: ['ID', 'Tanggal', 'Kebun', 'Supir', 'Kendaraan', 'Status', 'Netto', 'Setelah PPh'],
    rows: rows.map((r) => [
      r.id,
      (r.tanggalBongkar || r.createdAt).toLocaleDateString('id-ID'),
      r.kebun ? `${r.kebun.id} - ${r.kebun.name}` : '-',
      `${r.supir.id} - ${r.supir.name}`,
      String(r.kendaraanPlatNomor || '-'),
      String(r.statusPembayaran || ''),
      formatIdCurrency(safeNumber(r.netto)),
      formatIdCurrency(safeNumber(r.pembayaranSetelahPph)),
    ]),
  }

  const emptyExplain =
    totalCount === 0
      ? `Inti: 0 nota ${range.label}. Analisa: belum ada bongkar/input di periode ini, atau filter kebun/supir/status terlalu ketat. Cek: coba "kemarin" / "bulan ini", atau hilangkan filter (kebun/supir/status).`
      : ''
  const summary =
    totalCount > 0
      ? `Inti: ${totalCount} nota ${range.label}. Total netto ${formatIdNumber(totalNetto)} kg. Total setelah PPh ${formatIdCurrency(totalSetelahPph)}.`
      : ''
  const noteList = totalCount > 0 ? `List: tampilkan max ${limit} item terbaru.` : ''
  const answer = [summary || emptyExplain, noteList].filter(Boolean).join(' ')
  return { answer: answer || `Inti: 0 nota ${range.label}.`, tables: [...tablesPrefix, table] }
}

function safeJsonParse(v: unknown) {
  try {
    return JSON.parse(String(v))
  } catch {
    return null
  }
}

async function pollinationsChat(params: {
  apiKey: string
  model: string
  messages: any[]
  tools?: any[]
}) {
  const baseUrl = String(process.env.POLLINATIONS_BASE_URL || 'https://gen.pollinations.ai').trim() || 'https://gen.pollinations.ai'
  const tools = Array.isArray(params.tools) ? params.tools : []
  const res = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${params.apiKey}`,
    },
    body: JSON.stringify({
      model: params.model,
      messages: params.messages,
      ...(tools.length > 0 ? { tools, tool_choice: 'auto' } : {}),
      temperature: 0.2,
      max_tokens: 900,
    }),
  })
  const json = await res.json().catch(() => ({} as any))
  const errMsg = String(json?.error?.message || json?.message || 'Pollinations error')
  if (!res.ok) throw new Error(errMsg)
  return json
}

function extractPollinationsText(json: any) {
  const msg = json?.choices?.[0]?.message
  const text = typeof msg?.content === 'string' ? msg.content : ''
  return String(text || '').trim()
}

function extractPollinationsToolCalls(json: any): Array<{ id: string; name: string; args: any }> {
  const calls = json?.choices?.[0]?.message?.tool_calls
  if (!Array.isArray(calls)) return []
  const out: Array<{ id: string; name: string; args: any }> = []
  for (const c of calls) {
    const id = String(c?.id || '').trim()
    const fn = c?.function
    const name = String(fn?.name || '').trim()
    if (!id || !name) continue
    const argsRaw = fn?.arguments
    const argsParsed = typeof argsRaw === 'string' ? safeJsonParse(argsRaw) : argsRaw
    out.push({ id, name, args: argsParsed ?? {} })
  }
  return out
}

type ChatHistoryItem = { role: 'user' | 'assistant'; content: string }

function normalizeMemoryList(v: unknown) {
  if (!Array.isArray(v)) return []
  const out: string[] = []
  for (const raw of v.slice(0, 20)) {
    const s = String(raw || '').trim()
    if (!s) continue
    if (s.length > 240) out.push(s.slice(0, 240))
    else out.push(s)
  }
  return out
}

function formatMemoryBlock(memories: string[]) {
  const lines = (memories || [])
    .map((m) => String(m || '').trim())
    .filter(Boolean)
    .slice(0, 20)
  if (lines.length === 0) return ''
  return `\n\nCatatan permanen (dipakai untuk konteks jawaban):\n- ${lines.join('\n- ')}`
}

function pickLastUserPrompts(history: ChatHistoryItem[] | undefined, limit: number) {
  if (!Array.isArray(history) || history.length === 0) return []
  const out: string[] = []
  for (let i = history.length - 1; i >= 0; i -= 1) {
    const h = history[i]
    if (!h || h.role !== 'user') continue
    const s = String(h.content || '').trim()
    if (!s) continue
    out.push(s)
    if (out.length >= limit) break
  }
  return out.reverse()
}

function extractJsonObject(text: string) {
  const s = String(text || '').trim()
  const start = s.indexOf('{')
  const end = s.lastIndexOf('}')
  if (start < 0 || end < 0 || end <= start) return null
  const raw = s.slice(start, end + 1)
  return safeJsonParse(raw)
}

function safeShortJson(v: unknown, maxLen: number) {
  try {
    const stripDbNamesDeep = (x: any): any => {
      if (Array.isArray(x)) return x.map(stripDbNamesDeep)
      if (!x || typeof x !== 'object') return x
      const out: any = {}
      for (const [k, val] of Object.entries(x)) {
        if (k === 'model') {
          out[k] = '[db_model]'
          continue
        }
        out[k] = stripDbNamesDeep(val)
      }
      return out
    }
    const s = JSON.stringify(stripDbNamesDeep(stripSensitiveDeep(v)))
    if (!s) return ''
    return s.length > maxLen ? `${s.slice(0, maxLen)}…` : s
  } catch {
    return ''
  }
}

function mergeReasoning(resp: ChatResponse, items: string[]) {
  const next = Array.isArray(resp.reasoning) ? resp.reasoning.slice(0, 40) : []
  for (const it of items) {
    const s = String(it || '').trim()
    if (!s) continue
    next.push(s.length > 240 ? `${s.slice(0, 240)}…` : s)
    if (next.length >= 40) break
  }
  return { ...resp, reasoning: next }
}

function hasFollowUps(answer: string) {
  return /\bsaran pertanyaan lanjutan\s*:/i.test(String(answer || ''))
}

function appendFollowUps(answer: string, followUps: string[]) {
  const a = String(answer || '').trim()
  if (!a) return a
  if (hasFollowUps(a)) return a
  const list = (Array.isArray(followUps) ? followUps : [])
    .map((x) => String(x || '').trim())
    .filter(Boolean)
    .slice(0, 2)
  if (list.length === 0) return a
  return `${a}\n\nSaran pertanyaan lanjutan: ${list.join(' | ')}`
}

function extractFirstIdFromText(text: string) {
  const m = String(text || '').match(/\b(?:id|#)\s*(\d+)\b/i) || String(text || '').match(/\b(\d+)\b/)
  const n = m?.[1] ? Number(m[1]) : 0
  return Number.isFinite(n) && n > 0 ? n : 0
}

function heuristicFollowUps(question: string) {
  const norm = normalizeText(question)
  const id = extractFirstIdFromText(question)
  const idText = id > 0 ? ` ${id}` : ''
  if (norm.includes('nota') || norm.includes('sawit') || norm.includes('tbs')) {
    return [
      id > 0 ? `Detail nota sawit id${idText}` : 'Tampilkan daftar nota sawit hari ini',
      'Kendaraan dipakai untuk nota sawit hari ini',
      'Top supir berdasarkan jumlah nota sawit bulan ini',
    ]
  }
  if (norm.includes('kebun')) {
    return [
      id > 0 ? `Detail kebun id${idText}` : 'Ringkas biaya kebun bulan ini',
      'Biaya panen kebun bulan ini (top penyebab)',
      'Bandingkan biaya kebun bulan ini vs bulan lalu',
    ]
  }
  if (norm.includes('kas') || norm.includes('kasir')) {
    return [
      id > 0 ? `Detail transaksi kas id${idText}` : 'Rekap kas per kategori bulan ini',
      'Transaksi kas pengeluaran terbesar bulan ini',
      'Bandingkan kas pengeluaran bulan ini vs bulan lalu',
    ]
  }
  if (norm.includes('gaji') || norm.includes('gajian')) {
    return ['Tampilkan gajian bulan ini yang belum lunas', 'Total gajian bulan ini per kebun', 'Detail gajian id 1']
  }
  if (norm.includes('kendaraan') || norm.includes('plat')) {
    return ['Kendaraan dipakai untuk nota sawit hari ini', 'Daftar kendaraan dokumen hampir jatuh tempo', 'Cari nota sawit berdasarkan plat tertentu']
  }
  return ['Ringkas aktivitas hari ini (nota/kas/gajian)', 'Bandingkan bulan ini vs bulan lalu untuk biaya kebun', 'Tampilkan 10 transaksi terbaru hari ini']
}

async function suggestFollowUpsViaModel(params: {
  apiKey: string
  model: string
  question: string
  answer: string
  tables: TablePayload[]
}) {
  const sys =
    'Tugas: buat 2-3 pertanyaan lanjutan yang relevan dan spesifik untuk aplikasi.\n' +
    'Gunakan konteks pertanyaan+jawaban+data.\n' +
    'Jangan sebut nama tabel/model Prisma.\n' +
    'Keluaran JSON saja:\n' +
    '{ "followUps": ["...","..."] }'
  const payload = {
    question: String(params.question || '').trim(),
    answer: String(params.answer || '').trim(),
    tables: summarizeTablesForFinalizer(params.tables || []),
  }
  let json: any
  try {
    json = await pollinationsChat({
      apiKey: params.apiKey,
      model: params.model,
      messages: [
        { role: 'system', content: sys },
        { role: 'user', content: JSON.stringify(payload) },
      ],
      tools: [],
    })
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e || '')
    if (/thought_signature/i.test(errMsg)) {
      json = await pollinationsChat({
        apiKey: params.apiKey,
        model: params.model,
        messages: [
          { role: 'system', content: sys },
          { role: 'user', content: JSON.stringify(payload) },
        ],
        tools: [],
      })
    } else {
      return null
    }
  }
  const text = extractPollinationsText(json)
  const parsed = extractJsonObject(text)
  const list = Array.isArray(parsed?.followUps) ? (parsed.followUps as any[]) : []
  const out = list.map((x: any) => String(x || '').trim()).filter(Boolean).slice(0, 3)
  return out.length > 0 ? out : null
}

function summarizeTablesForFinalizer(tables: TablePayload[]) {
  const out: any[] = []
  const list = Array.isArray(tables) ? tables : []
  for (let i = 0; i < list.length; i += 1) {
    const t = list[i]
    if (!t) continue
    const cols = Array.isArray(t.columns) ? t.columns.map((c) => String(c || '').slice(0, 60)) : []
    const rows = Array.isArray(t.rows) ? t.rows.slice(0, 6) : []
    out.push({
      i,
      title: String(t.title || '').slice(0, 120),
      columns: cols.slice(0, 14),
      rows: rows.map((r) => (Array.isArray(r) ? r.slice(0, 14).map((c) => (c == null ? null : String(c).slice(0, 80))) : [])),
    })
    if (out.length >= 10) break
  }
  return out
}

async function finalizeAnswerFromData(params: {
  apiKey: string
  model: string
  question: string
  draftAnswer: string
  tables: TablePayload[]
  maxKeep: number
}) {
  const sys =
    'Tugas: buat jawaban akhir Indonesia: bukan hanya data, tapi analisa singkat seperti konsultan.\n' +
    'Format jawaban:\n' +
    '- 2-6 kalimat.\n' +
    '- Wajib ada: (1) inti angka/hasil, (2) analisa penyebab/pola/anomali dari data, (3) 1-2 langkah cek/aksi berikutnya.\n' +
    '- Boleh pakai label singkat di awal kalimat: "Inti:", "Analisa:", "Cek:".\n' +
    '- Jika perlu, tambah 1 kalimat "Asumsi: ...".\n\n' +
    'Teknik CoT:\n- Pikirkan jawaban selangkah demi selangkah secara internal.\n- Jangan tampilkan chain-of-thought rinci. Tampilkan hanya "Proses" level tinggi + hasil.\n\n' +
    'Sumber hanya data yang diberikan (tables + draft). Jangan tebak.\n' +
    'Jika data tidak cukup untuk jawab, tulis: "Maaf, saya tidak tahu berdasarkan data yang tersedia." lalu minta 1-3 klarifikasi.\n' +
    'Jangan sebut nama tabel/model Prisma.\n' +
    'Fokus hanya konteks pertanyaan. Jangan keluarkan data tidak diminta.\n' +
    'Pilih tabel paling relevan saja.\n' +
    'Jika tabel tidak perlu untuk jawab, keepTables = [].\n\n' +
    'Keluaran JSON saja:\n' +
    '{ "answer": "<jawaban>", "keepTables": [0,2], "followUps": ["..."] }\n\n' +
    `Aturan keepTables:\n- Integer index dari daftar tables.\n- Max ${params.maxKeep} tabel.\n- Kalau tidak perlu tabel: []`

  const payload = {
    question: String(params.question || '').trim(),
    draftAnswer: String(params.draftAnswer || '').trim(),
    tables: summarizeTablesForFinalizer(params.tables || []),
  }

  let json: any
  try {
    json = await pollinationsChat({
      apiKey: params.apiKey,
      model: params.model,
      messages: [
        { role: 'system', content: sys },
        { role: 'user', content: JSON.stringify(payload) },
      ],
      tools: [],
    })
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e || '')
    if (/thought_signature/i.test(errMsg)) {
      json = await pollinationsChat({
        apiKey: params.apiKey,
        model: params.model,
        messages: [
          { role: 'system', content: sys },
          { role: 'user', content: JSON.stringify(payload) },
        ],
        tools: [],
      })
    } else {
      return null
    }
  }

  const text = extractPollinationsText(json)
  const parsed = extractJsonObject(text)
  const answer = String(parsed?.answer || '').trim()
  const keep = Array.isArray(parsed?.keepTables) ? (parsed.keepTables as any[]).map((n: any) => Number(n)).filter((n) => Number.isFinite(n)) : []
  const followUps = Array.isArray(parsed?.followUps) ? (parsed.followUps as any[]).map((x: any) => String(x || '').trim()).filter(Boolean) : []
  return { answer, keepTables: keep, followUps }
}

function parseIdNumberFromCell(v: unknown) {
  const s = String(v ?? '').trim()
  if (!s) return null
  const cleaned = s
    .replace(/rp/gi, '')
    .replace(/[^\d,.\-]/g, '')
    .trim()
  if (!cleaned) return null
  let norm = cleaned
  if (norm.includes(',') && norm.includes('.')) norm = norm.replace(/\./g, '').replace(',', '.')
  else if (norm.includes('.')) norm = norm.replace(/\./g, '')
  else if (norm.includes(',')) norm = norm.replace(',', '.')
  const n = Number(norm)
  return Number.isFinite(n) ? n : null
}

function parsePctFromCell(v: unknown) {
  const s = String(v ?? '').trim()
  const m = s.match(/-?\d+(?:[.,]\d+)?/)
  if (!m?.[0]) return null
  const n = parseIdNumberFromCell(m[0])
  if (n === null) return null
  return n > 1.5 ? n / 100 : n
}

function deriveInsightSummaryFromTables(question: string, tables: TablePayload[]) {
  const list = Array.isArray(tables) ? tables : []
  if (list.length === 0) return ''

  const normQ = normalizeText(question)
  const wantsWhy = normQ.includes('kenapa') || normQ.includes('mengapa') || normQ.includes('naik') || normQ.includes('turun') || normQ.includes('selisih')

  for (const t of list) {
    const cols = Array.isArray(t?.columns) ? t.columns.map((c) => normalizeText(String(c || ''))) : []
    const rows = Array.isArray(t?.rows) ? (t.rows as any[]) : []
    const idxSelisih = cols.findIndex((c) => c.includes('selisih'))
    const idxKontrib = cols.findIndex((c) => c.includes('kontribusi'))
    if (idxSelisih >= 0 && idxKontrib >= 0 && rows.length > 0) {
      const scored = rows
        .map((r) => {
          const arr = Array.isArray(r) ? r : []
          const sebab = String(arr[0] ?? '').trim()
          const sel = String(arr[idxSelisih] ?? '').trim()
          const pct = parsePctFromCell(arr[idxKontrib])
          return { sebab, sel, pct: pct ?? 0 }
        })
        .filter((x) => Boolean(x.sebab))
        .sort((a, b) => b.pct - a.pct)
      if (scored.length > 0) {
        const top = scored[0]
        const second = scored[1]
        const secText = second ? ` Berikutnya ${second.sebab} (${second.sel}, ${fmtPct(second.pct)}).` : ''
        return `Analisa: pendorong terbesar ${top.sebab} (${top.sel}, kontribusi ${fmtPct(top.pct)}).${secText}`.trim()
      }
    }
  }

  for (const t of list) {
    const cols = Array.isArray(t?.columns) ? t.columns.map((c) => normalizeText(String(c || ''))) : []
    if (cols.length !== 2) continue
    const rows = Array.isArray(t?.rows) ? (t.rows as any[]) : []
    const map = new Map<string, string>()
    for (const r of rows) {
      const arr = Array.isArray(r) ? r : []
      const k = normalizeText(String(arr[0] ?? ''))
      const v = String(arr[1] ?? '').trim()
      if (!k) continue
      map.set(k, v)
    }
    const ratioText = map.get(normalizeText('Rasio Beban')) || map.get('rasio beban') || ''
    const marginText = map.get(normalizeText('Margin')) || map.get('margin') || ''
    if (ratioText || marginText) {
      const ratio = parsePctFromCell(ratioText)
      const margin = parseIdNumberFromCell(marginText)
      if (ratio !== null) {
        const tag = ratio >= 1 ? 'beban >= pendapatan (rugi/impas)' : ratio >= 0.85 ? 'beban berat' : ratio >= 0.6 ? 'beban sedang' : 'beban ringan'
        const marginTag = margin === null ? '' : margin < 0 ? 'margin negatif' : 'margin positif'
        return `Analisa: rasio beban ${ratioText} → ${tag}${marginTag ? `, ${marginTag}` : ''}.`
      }
    }
  }

  if (wantsWhy) return 'Analisa: data ringkas sudah ada; penyebab utama biasanya muncul dari 1-2 komponen terbesar di breakdown.'
  return ''
}

async function postProcessAgentResponse(params: { apiKey: string; model: string; question: string; resp: ChatResponse }) {
  const base = params.resp
  const tables = Array.isArray(base.tables) ? base.tables : []
  if (tables.length === 0) return base

  const norm = normalizeText(params.question)
  const wantsAll = norm.includes('semua') || norm.includes('lengkap') || norm.includes('full') || norm.includes('detail lengkap')
  const maxKeep = wantsAll ? 6 : 3

  const fin = await finalizeAnswerFromData({
    apiKey: params.apiKey,
    model: params.model,
    question: params.question,
    draftAnswer: base.answer,
    tables,
    maxKeep,
  })
  if (!fin || !fin.answer) return base

  const uniq = Array.from(new Set(fin.keepTables)).filter((i) => Number.isInteger(i) && i >= 0 && i < tables.length)
  const clipped = uniq.slice(0, maxKeep)
  const keepIdx = clipped
  let nextTables = keepIdx.map((i) => tables[i]).filter(Boolean)

  if (!wantsAll && nextTables.length > 0) {
    const phrases = extractFocusPhrases(params.question)
    if (phrases.length > 0) {
      const hit = nextTables.filter((t) => tableMatchesAnyPhrase(t, phrases))
      if (hit.length > 0) nextTables = hit.slice(0, 1)
    }
    const kw = extractKeywordsFromQuestion(params.question)
    const scored = nextTables
      .map((t) => ({ t, s: scoreTableRelevance(t, kw) }))
      .sort((a, b) => b.s - a.s)
    nextTables = scored
      .filter((x) => x.s > 0)
      .slice(0, 2)
      .map((x) => x.t)
  }
  const ans = appendFollowUps(fin.answer, fin.followUps || [])
  const scalar = deriveScalarSummaryFromTables(params.question, nextTables)
  const insight = deriveInsightSummaryFromTables(params.question, nextTables)
  const needsInsight =
    Boolean(insight) &&
    (!ans ||
      ans.length < 140 ||
      (!/(\bkarena\b|\bpenyebab\b|\bdominan\b|\bkontribusi\b|\banomali\b|\bpola\b|\bindikasi\b|\bcek\b)/i.test(ans) && /(\bbiaya\b|\bbeban\b|\bnaik\b|\bturun\b|\bpendapatan\b|\bgaji\b|\bkendaraan\b)/i.test(normalizeText(params.question))))
  const analyzed = needsInsight ? `${insight}\n\n${ans || ''}`.trim() : ans
  const finalText =
    scalar && !hasAnyDigit(analyzed) ? (analyzed ? `${scalar}\n\n${analyzed}` : scalar) : analyzed || scalar || 'Berikut hasilnya.'
  return { ...base, answer: finalText, tables: nextTables }
}

function compactSpaces(v: string) {
  return String(v || '')
    .replace(/\s+/g, ' ')
    .trim()
}

function extractKeywordsFromQuestion(question: string) {
  const norm = normalizeText(question)
  const stop = new Set([
    'yang',
    'dan',
    'atau',
    'dari',
    'untuk',
    'pada',
    'di',
    'ke',
    'dengan',
    'ini',
    'itu',
    'apakah',
    'kenapa',
    'mengapa',
    'bagaimana',
    'tolong',
    'mohon',
    'tampilkan',
    'sebutkan',
    'daftar',
    'list',
    'data',
    'laporan',
    'rekap',
    'ringkas',
    'total',
    'jumlah',
    'berapa',
    'bandingkan',
    'perbandingan',
    'detail',
    'per',
    'satu',
    'hari',
    'bulan',
    'tahun',
    'kemarin',
    'tadi',
    'sekarang',
    'saja',
    'dong',
  ])
  const tokens = norm
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 3 && !stop.has(t))
  const uniq: string[] = []
  for (const t of tokens) {
    if (uniq.includes(t)) continue
    uniq.push(t)
    if (uniq.length >= 12) break
  }
  return new Set(uniq)
}

function extractFocusPhrases(question: string) {
  const norm = normalizeText(question)
  const phrases = [
    'berat akhir',
    'netto',
    'bruto',
    'tara',
    'pph',
    'setelah pph',
    'harga',
    'harga/kg',
    'pembayaran',
    'total pembayaran',
    'pembayaran aktual',
    'status pembayaran',
  ]
  const out: string[] = []
  for (const p of phrases) {
    if (norm.includes(p)) out.push(p)
  }
  return out.slice(0, 3)
}

function tableMatchesAnyPhrase(table: TablePayload, phrases: string[]) {
  if (!table || !Array.isArray(phrases) || phrases.length === 0) return false
  const cols = Array.isArray((table as any).columns) ? ((table as any).columns as any[]) : []
  const head = normalizeText(cols.map((c) => String(c || '')).join(' '))
  const title = normalizeText(String((table as any).title || ''))
  for (const p of phrases) {
    const pn = normalizeText(p)
    if (!pn) continue
    if (head.includes(pn) || title.includes(pn)) return true
  }
  return false
}

function scoreTableRelevance(table: TablePayload, keywords: Set<string>) {
  if (!table || keywords.size === 0) return 0
  const cols = Array.isArray((table as any).columns) ? ((table as any).columns as any[]) : []
  const rows = Array.isArray((table as any).rows) ? ((table as any).rows as any[]) : []
  const head = cols.map((c) => String(c || '')).join(' ')
  const sample = rows
    .slice(0, 3)
    .flatMap((r) => (Array.isArray(r) ? r : Object.values(r || {})))
    .slice(0, 24)
    .map((v) => String(v ?? ''))
    .join(' ')
  const text = normalizeText(`${String((table as any).title || '')} ${head} ${sample}`)
  let score = 0
  for (const k of keywords) {
    if (!k) continue
    if (text.includes(k)) score += 1
  }
  return score
}

function hasAnyDigit(text: string) {
  return /\d/.test(String(text || ''))
}

function parseMaybeNumber(v: unknown) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  const s = String(v ?? '').trim()
  if (!s) return null
  const cleaned = s
    .replace(/rp/gi, '')
    .replace(/[^\d,.\-]/g, '')
    .trim()
  if (!cleaned) return null
  let norm = cleaned
  if (norm.includes(',') && norm.includes('.')) {
    norm = norm.replace(/\./g, '').replace(',', '.')
  } else if (norm.includes('.')) {
    norm = norm.replace(/\./g, '')
  } else if (norm.includes(',')) {
    norm = norm.replace(',', '.')
  }
  const n = Number(norm)
  return Number.isFinite(n) ? n : null
}

function deriveScalarSummaryFromTables(question: string, tables: TablePayload[]) {
  const norm = normalizeText(question)
  const wantsScalar = norm.includes('berapa') || norm.includes('total') || norm.includes('jumlah')
  if (!wantsScalar) return ''

  const wantsKg =
    norm.includes('kg') ||
    norm.includes('kilo') ||
    norm.includes('netto') ||
    norm.includes('bruto') ||
    norm.includes('tara') ||
    norm.includes('berat') ||
    norm.includes('ton')

  if (!wantsKg) return ''

  const colHints = ['kg', 'netto', 'bruto', 'tara', 'berat', 'berat akhir', 'produksi']
  for (const t of tables || []) {
    const cols = Array.isArray((t as any).columns) ? ((t as any).columns as any[]) : []
    const rows = Array.isArray((t as any).rows) ? ((t as any).rows as any[]) : []
    if (cols.length === 0 || rows.length === 0) continue
    const colNorms = cols.map((c) => normalizeText(String(c || '')))
    let pickIdx = -1
    for (const h of colHints) {
      const hn = normalizeText(h)
      const idx = colNorms.findIndex((x) => x && x.includes(hn))
      if (idx >= 0) {
        pickIdx = idx
        break
      }
    }
    if (pickIdx < 0) continue
    let sum = 0
    let count = 0
    for (const r of rows) {
      const cell = Array.isArray(r) ? r[pickIdx] : null
      const n = parseMaybeNumber(cell)
      if (n == null) continue
      sum += n
      count += 1
    }
    if (count > 0) {
      if (norm.includes('ton')) return `Total ${formatIdNumber(sum / 1000)} ton.`
      return `Total ${formatIdNumber(sum)} kg.`
    }
  }
  return ''
}

function stripSpan(text: string, startIdx: number, endIdx: number) {
  const s = String(text || '')
  const out = `${s.slice(0, Math.max(0, startIdx))} ${s.slice(Math.max(0, endIdx))}`
  return compactSpaces(out)
}

function extractQuotedOrWord(text: string, keyword: string) {
  const s = String(text || '')
  const re = new RegExp(`\\b${keyword}\\b\\s*(?:"([^"]+)"|'([^']+)'|([a-z0-9][a-z0-9 .\\-]{0,60}))`, 'i')
  const m = s.match(re)
  if (!m || m.index === undefined) return { value: '', rest: compactSpaces(s) }
  const val = compactSpaces(String(m[1] || m[2] || m[3] || ''))
  const rest = stripSpan(s, m.index, m.index + m[0].length)
  return { value: val, rest }
}

function extractKeywordId(text: string, keyword: string) {
  const s = String(text || '')
  const re = new RegExp(`\\b${keyword}\\b\\s*#?\\s*(\\d+)\\b`, 'i')
  const m = s.match(re)
  if (!m || m.index === undefined) return { id: 0, rest: compactSpaces(s) }
  const id = Number(m[1] || 0)
  const rest = stripSpan(s, m.index, m.index + m[0].length)
  return { id: Number.isFinite(id) ? id : 0, rest }
}

function extractPlat(text: string) {
  const s = String(text || '')
  const re = /\b(?:kendaraan|plat)\b\s*(?:"([^"]+)"|'([^']+)'|([a-z]{1,2}\s*\d{1,4}\s*[a-z]{0,3}))\b/i
  const m = s.match(re)
  if (!m || m.index === undefined) return { plat: '', rest: compactSpaces(s) }
  const plat = compactSpaces(String(m[1] || m[2] || m[3] || '')).toUpperCase()
  const rest = stripSpan(s, m.index, m.index + m[0].length)
  return { plat, rest }
}

function splitKeywordPhraseToList(phrase: string) {
  const s = compactSpaces(String(phrase || '').trim())
  if (!s) return []
  return s
    .split(/(?:,|;|\||\/|&|\bdan\b|\batau\b)/gi)
    .map((x) => compactSpaces(String(x || '').trim()))
    .filter(Boolean)
    .slice(0, 12)
}

function extractIncludeExcludeKeywordsFromText(text: string) {
  const src = compactSpaces(String(text || '').trim())
  const low = normalizeText(src)
  const include: string[] = []
  const exclude: string[] = []

  const pushMany = (arr: string[], items: string[]) => {
    for (const it of items) {
      const v = String(it || '').trim()
      if (!v) continue
      arr.push(v)
    }
  }

  const capAny = (re: RegExp, target: string[]) => {
    let m: RegExpExecArray | null
    while ((m = re.exec(low))) {
      const raw = compactSpaces(String((m as any)[1] || (m as any)[2] || (m as any)[3] || '').trim())
      if (!raw) continue
      pushMany(target, splitKeywordPhraseToList(raw))
    }
  }

  capAny(/\b(?:yang ada kata|ada kata|mengandung kata|mengandung|keyword|filter|include|hanya|khusus)\b\s*(?:=|:)?\s*(?:"([^"]+)"|'([^']+)'|([a-z0-9][^.,;!?]{0,60}))/gi, include)
  capAny(/\b(?:kecuali|selain|tanpa|exclude|bukan|tidak termasuk)\b\s*(?:=|:)?\s*(?:"([^"]+)"|'([^']+)'|([a-z0-9][^.,;!?]{0,60}))/gi, exclude)

  const stop = new Set([
    'kebun',
    'operasional',
    'operasi',
    'produksi',
    'total',
    'jumlah',
    'bulan',
    'tahun',
    'hari',
    'ini',
    'lalu',
    'kemarin',
    'semua',
    'naik',
    'turun',
    'tajam',
    'pendapatan',
    'nota',
    'sawit',
    'tbs',
  ])

  const costWordRe = /\bbiaya\s+([a-z][a-z0-9-]{2,30})\b/gi
  let m: RegExpExecArray | null
  while ((m = costWordRe.exec(low))) {
    const kw = String(m[1] || '').trim()
    if (!kw) continue
    if (stop.has(kw)) continue
    include.push(kw)
  }

  const costUntukRe = /\bbiaya\b[^.,;!?]{0,24}\buntuk\b\s+([a-z][a-z0-9-]{2,30})\b/gi
  while ((m = costUntukRe.exec(low))) {
    const kw = String(m[1] || '').trim()
    if (!kw) continue
    if (stop.has(kw)) continue
    include.push(kw)
  }

  const inc = normalizeKeywordList(Array.from(new Set(include)))
  const exc = normalizeKeywordList(Array.from(new Set(exclude)))
  const excSet = new Set(exc.map((x) => normalizeText(x)))
  const incFinal = inc.filter((x) => !excSet.has(normalizeText(x)))
  return { include: incFinal, exclude: exc }
}

type ToolNormalizeResult = { args: any; notes: string[] }

async function normalizeArgsForTool(name: string, rawArgs: any, contextMessage?: string): Promise<ToolNormalizeResult> {
  const args = isPlainObject(rawArgs) ? { ...rawArgs } : {}
  const notes: string[] = []
  const qRaw = compactSpaces(String(args.query || ''))
  const ctxRaw = compactSpaces(String(contextMessage || ''))

  if (name === 'kebun_kinerja_analisis' || name === 'kebun_biaya_naik_analisis') {
    const src = qRaw || ctxRaw

    if (!args.kebunId) {
      const { id: kebunId } = extractKeywordId(src, 'kebun')
      if (kebunId > 0) {
        args.kebunId = kebunId
        notes.push(`parse: kebunId=${kebunId}`)
      }
    }
    if (!args.kebunName) {
      const { value: kebunName } = extractQuotedOrWord(src, 'kebun')
      if (kebunName) {
        args.kebunName = kebunName
        notes.push(`parse: kebunName="${kebunName}"`)
      }
    }

    const parsed = extractIncludeExcludeKeywordsFromText(src)
    const inc = normalizeKeywordList(args.includeKeywords)
    const exc = normalizeKeywordList(args.excludeKeywords)
    if (inc.length === 0 && parsed.include.length > 0) {
      args.includeKeywords = parsed.include
      notes.push(`parse: includeKeywords=[${parsed.include.join(', ')}]`)
    }
    if (exc.length === 0 && parsed.exclude.length > 0) {
      args.excludeKeywords = parsed.exclude
      notes.push(`parse: excludeKeywords=[${parsed.exclude.join(', ')}]`)
    }

    if (name === 'kebun_kinerja_analisis' && !args.rangePreset) {
      const norm = normalizeText(src)
      if (norm.includes('hari ini') || norm.includes('today')) {
        args.rangePreset = 'today'
        notes.push('parse: rangePreset=today')
      } else if (norm.includes('bulan lalu') || norm.includes('bulan kemarin')) {
        args.rangePreset = 'prev_month'
        notes.push('parse: rangePreset=prev_month')
      } else if (norm.includes('bulan ini')) {
        args.rangePreset = 'this_month'
        notes.push('parse: rangePreset=this_month')
      } else if (norm.includes('tahun ini') || norm.includes('year') || norm.includes('ytd') || norm.includes('year to date')) {
        args.rangePreset = 'year_to_date'
        notes.push('parse: rangePreset=year_to_date')
      }
    }
    return { args, notes }
  }

  if (name === 'kendaraan_biaya_analisis') {
    const src = qRaw || ctxRaw
    if (!args.kendaraanPlatNomor) {
      const a = extractPlat(src)
      let plat = a.plat
      if (!plat) {
        const m = String(src || '').match(/\b([a-z]{1,2}\s*\d{1,4}\s*[a-z]{0,3})\b/i)
        if (m?.[1]) plat = compactSpaces(String(m[1] || '')).toUpperCase()
      }
      if (plat) {
        args.kendaraanPlatNomor = plat
        notes.push(`parse: kendaraanPlatNomor="${plat}"`)
      }
    }

    const parsed = extractIncludeExcludeKeywordsFromText(src)
    const inc = normalizeKeywordList(args.includeKeywords)
    const exc = normalizeKeywordList(args.excludeKeywords)
    if (inc.length === 0 && parsed.include.length > 0) {
      args.includeKeywords = parsed.include
      notes.push(`parse: includeKeywords=[${parsed.include.join(', ')}]`)
    }
    if (exc.length === 0 && parsed.exclude.length > 0) {
      args.excludeKeywords = parsed.exclude
      notes.push(`parse: excludeKeywords=[${parsed.exclude.join(', ')}]`)
    }

    if (!args.rangePreset) {
      const norm = normalizeText(src)
      if (norm.includes('hari ini') || norm.includes('today')) {
        args.rangePreset = 'today'
        notes.push('parse: rangePreset=today')
      } else if (norm.includes('bulan lalu') || norm.includes('bulan kemarin')) {
        args.rangePreset = 'prev_month'
        notes.push('parse: rangePreset=prev_month')
      } else if (norm.includes('bulan ini')) {
        args.rangePreset = 'this_month'
        notes.push('parse: rangePreset=this_month')
      } else if (norm.includes('tahun ini') || norm.includes('year') || norm.includes('ytd') || norm.includes('year to date')) {
        args.rangePreset = 'year_to_date'
        notes.push('parse: rangePreset=year_to_date')
      }
    }
    return { args, notes }
  }

  if (name === 'karyawan_gaji_analisis') {
    const src = qRaw || ctxRaw

    if (!args.kebunId) {
      const { id: kebunId } = extractKeywordId(src, 'kebun')
      if (kebunId > 0) {
        args.kebunId = kebunId
        notes.push(`parse: kebunId=${kebunId}`)
      }
    }
    if (!args.kebunName) {
      const { value: kebunName } = extractQuotedOrWord(src, 'kebun')
      if (kebunName) {
        args.kebunName = kebunName
        notes.push(`parse: kebunName="${kebunName}"`)
      }
    }
    if (!args.karyawanId) {
      const { id: karyawanId } = extractKeywordId(src, 'karyawan')
      if (karyawanId > 0) {
        args.karyawanId = karyawanId
        notes.push(`parse: karyawanId=${karyawanId}`)
      }
    }
    if (!args.karyawanName) {
      const { value: karyawanName } = extractQuotedOrWord(src, 'karyawan')
      if (karyawanName) {
        args.karyawanName = karyawanName
        notes.push(`parse: karyawanName="${karyawanName}"`)
      }
    }

    const parsed = extractIncludeExcludeKeywordsFromText(src)
    const inc = normalizeKeywordList(args.includeKeywords)
    const exc = normalizeKeywordList(args.excludeKeywords)
    if (inc.length === 0 && parsed.include.length > 0) {
      args.includeKeywords = parsed.include
      notes.push(`parse: includeKeywords=[${parsed.include.join(', ')}]`)
    }
    if (exc.length === 0 && parsed.exclude.length > 0) {
      args.excludeKeywords = parsed.exclude
      notes.push(`parse: excludeKeywords=[${parsed.exclude.join(', ')}]`)
    }

    if (!args.rangePreset) {
      const norm = normalizeText(src)
      if (norm.includes('hari ini') || norm.includes('today')) {
        args.rangePreset = 'today'
        notes.push('parse: rangePreset=today')
      } else if (norm.includes('bulan lalu') || norm.includes('bulan kemarin')) {
        args.rangePreset = 'prev_month'
        notes.push('parse: rangePreset=prev_month')
      } else if (norm.includes('bulan ini')) {
        args.rangePreset = 'this_month'
        notes.push('parse: rangePreset=this_month')
      } else if (norm.includes('tahun ini') || norm.includes('year') || norm.includes('ytd') || norm.includes('year to date')) {
        args.rangePreset = 'year_to_date'
        notes.push('parse: rangePreset=year_to_date')
      }
    }
    return { args, notes }
  }

  if (name === 'nota_sawit_search') {
    let q = qRaw
    if (!args.supirId) {
      const { value: supirName, rest } = extractQuotedOrWord(q, 'supir')
      if (supirName && !args.supirName) {
        args.supirName = supirName
        notes.push(`parse: supirName="${supirName}"`)
      }
      q = rest
    }
    if (!args.kebunId) {
      const { id: kebunId, rest } = extractKeywordId(q, 'kebun')
      if (kebunId > 0 && !args.kebunId) {
        args.kebunId = kebunId
        notes.push(`parse: kebunId=${kebunId}`)
      }
      q = rest
    }
    if (!args.kebunName) {
      const { value: kebunName, rest } = extractQuotedOrWord(q, 'kebun')
      if (kebunName && !args.kebunName) {
        args.kebunName = kebunName
        notes.push(`parse: kebunName="${kebunName}"`)
      }
      q = rest
    }
    args.query = q
    return { args, notes }
  }

  if (name === 'kas_transaksi_search') {
    let q = qRaw
    if (!args.kebunId) {
      const { id: kebunId, rest } = extractKeywordId(q, 'kebun')
      if (kebunId > 0) {
        args.kebunId = kebunId
        notes.push(`parse: kebunId=${kebunId}`)
      }
      q = rest
    }
    if (!args.kebunName) {
      const { value: kebunName, rest } = extractQuotedOrWord(q, 'kebun')
      if (kebunName) {
        args.kebunName = kebunName
        notes.push(`parse: kebunName="${kebunName}"`)
      }
      q = rest
    }
    if (!args.karyawanId) {
      const { id: karyawanId, rest } = extractKeywordId(q, 'karyawan')
      if (karyawanId > 0) {
        args.karyawanId = karyawanId
        notes.push(`parse: karyawanId=${karyawanId}`)
      }
      q = rest
    }
    if (!args.karyawanName) {
      const { value: karyawanName, rest } = extractQuotedOrWord(q, 'karyawan')
      if (karyawanName) {
        args.karyawanName = karyawanName
        notes.push(`parse: karyawanName="${karyawanName}"`)
      }
      q = rest
    }
    if (!args.kendaraanPlatNomor) {
      const { plat, rest } = extractPlat(q)
      if (plat) {
        args.kendaraanPlatNomor = plat
        notes.push(`parse: kendaraanPlatNomor="${plat}"`)
      }
      q = rest
    }
    args.query = q
    return { args, notes }
  }

  if (name === 'uang_jalan_sessions') {
    let q = qRaw
    if (!args.supirId) {
      const { id: supirId, rest } = extractKeywordId(q, 'supir')
      if (supirId > 0) {
        args.supirId = supirId
        notes.push(`parse: supirId=${supirId}`)
      }
      q = rest
    }
    if (!args.supirName) {
      const { value: supirName, rest } = extractQuotedOrWord(q, 'supir')
      if (supirName) {
        args.supirName = supirName
        notes.push(`parse: supirName="${supirName}"`)
      }
      q = rest
    }
    if (!args.kendaraanPlatNomor) {
      const { plat, rest } = extractPlat(q)
      if (plat) {
        args.kendaraanPlatNomor = plat
        notes.push(`parse: kendaraanPlatNomor="${plat}"`)
      }
      q = rest
    }
    args.query = q
    return { args, notes }
  }

  if (name === 'gajian_search') {
    let q = qRaw
    if (!args.kebunId) {
      const { id: kebunId, rest } = extractKeywordId(q, 'kebun')
      if (kebunId > 0) {
        args.kebunId = kebunId
        notes.push(`parse: kebunId=${kebunId}`)
      }
      q = rest
    }
    if (!args.kebunName) {
      const { value: kebunName, rest } = extractQuotedOrWord(q, 'kebun')
      if (kebunName) {
        args.kebunName = kebunName
        notes.push(`parse: kebunName="${kebunName}"`)
      }
      q = rest
    }
    args.query = q
    return { args, notes }
  }

  if (name === 'karyawan_search') {
    let q = qRaw
    if (!args.kebunId) {
      const { id: kebunId, rest } = extractKeywordId(q, 'kebun')
      if (kebunId > 0) {
        args.kebunId = kebunId
        notes.push(`parse: kebunId=${kebunId}`)
      }
      q = rest
    }
    if (!args.kebunName) {
      const { value: kebunName, rest } = extractQuotedOrWord(q, 'kebun')
      if (kebunName) {
        args.kebunName = kebunName
        notes.push(`parse: kebunName="${kebunName}"`)
      }
      q = rest
    }
    if (!args.query && q) args.query = q
    return { args, notes }
  }

  if (name === 'db_find_many' || name === 'db_find_unique' || name === 'db_count' || name === 'db_compare' || name === 'db_model_info') {
    const model = resolveModelDelegateName(args?.model)
    if (model) {
      if (String(args?.model || '').trim() !== model) notes.push(`model: normalize "${String(args?.model || '').trim()}" -> "${model}"`)
      args.model = model
      const allowed = getModelFieldNameSet(model)
      const aliasMap: Record<string, string> = { nama: 'name', lokasi: 'location', dibuat: 'createdAt', diubah: 'updatedAt' }
      if (isPlainObject(args.where)) {
        const s = sanitizeWhereRoot(args.where, allowed, aliasMap)
        args.where = coerceWhereDateTimes(s.out, 8)
        notes.push(...s.notes)
      }
      if (args.orderBy && (isPlainObject(args.orderBy) || Array.isArray(args.orderBy))) {
        const s = sanitizeOrderBy(args.orderBy, allowed, aliasMap)
        args.orderBy = s.out
        notes.push(...s.notes)
      }
      if (isPlainObject(args.select)) {
        const s = sanitizeFieldKeyObject(args.select, allowed, aliasMap, 'select')
        args.select = s.out
        notes.push(...s.notes)
      }
      if (isPlainObject(args.include)) {
        const s = sanitizeFieldKeyObject(args.include, allowed, aliasMap, 'include')
        args.include = s.out
        notes.push(...s.notes)
      }
      if (name === 'db_compare') {
        if (isPlainObject(args.whereA)) {
          const s = sanitizeWhereRoot(args.whereA, allowed, aliasMap)
          args.whereA = coerceWhereDateTimes(s.out, 8)
          notes.push(...s.notes.map((x) => `whereA: ${x.replace(/^where:\s*/, '')}`))
        }
        if (isPlainObject(args.whereB)) {
          const s = sanitizeWhereRoot(args.whereB, allowed, aliasMap)
          args.whereB = coerceWhereDateTimes(s.out, 8)
          notes.push(...s.notes.map((x) => `whereB: ${x.replace(/^where:\s*/, '')}`))
        }
      }
    }
    return { args, notes }
  }

  return { args, notes }
}

function needsDbEvidence(message: string) {
  const norm = normalizeText(message)
  const isDefinition =
    norm.startsWith('apa itu ') ||
    norm.startsWith('apa itu') ||
    norm.includes('pengertian ') ||
    norm.includes('definisi ') ||
    norm.includes('jelaskan konsep') ||
    norm.includes('secara umum')
  if (isDefinition) return false

  const hasAskWord =
    norm.includes('berapa') ||
    norm.includes('total') ||
    norm.includes('jumlah') ||
    norm.includes('biaya') ||
    norm.includes('upah') ||
    norm.includes('detail') ||
    norm.includes('ringkas') ||
    norm.includes('tampilkan') ||
    norm.includes('daftar') ||
    norm.includes('list') ||
    norm.includes('cari') ||
    norm.includes('bandingkan') ||
    norm.includes('selisih') ||
    norm.includes('rekap') ||
    norm.includes('laporan') ||
    norm.includes('statistik') ||
    norm.includes('riwayat') ||
    norm.includes('history') ||
    norm.includes('top') ||
    norm.includes('ranking') ||
    norm.includes('terbesar') ||
    norm.includes('terkecil') ||
    norm.includes('paling') ||
    norm.includes('sebutkan') ||
    norm.includes('siapa') ||
    norm.includes('mana') ||
    norm.includes('kapan') ||
    norm.includes('dimana') ||
    norm.includes('bagaimana')

  const domainWords = [
    'kebun',
    'panen',
    'kas',
    'kasir',
    'gajian',
    'nota',
    'nota sawit',
    'timbangan',
    'invoice',
    'perusahaan',
    'pabrik',
    'pabrik sawit',
    'supir',
    'kendaraan',
    'uang jalan',
    'hutang',
    'hutang bank',
    'absensi',
    'audit',
    'audit trail',
    'inventory',
    'ledger',
    'pekerjaan',
    'pekerjaan kebun',
    'karyawan',
  ]
  const hasDomain = domainWords.some((w) => norm.includes(w))

  const hasIdLike =
    /\b(id|#)\s*\d+\b/i.test(norm) ||
    /\b(nota|kas|kebun|gajian|timbangan|invoice|supir|kendaraan)\s*#?\s*\d+\b/i.test(norm)
  const hasAnyNumber = /\b\d+\b/.test(norm)
  const hasTimeWord =
    norm.includes('hari ini') ||
    norm.includes('kemarin') ||
    norm.includes('minggu ini') ||
    norm.includes('bulan ini') ||
    norm.includes('bulan lalu') ||
    norm.includes('tahun ini') ||
    norm.includes('tahun lalu') ||
    norm.includes('tanggal ') ||
    /\b\d{4}-\d{2}-\d{2}\b/.test(norm)
  const hasActionWord =
    norm.includes('digunakan') ||
    norm.includes('terpakai') ||
    norm.includes('dipakai') ||
    norm.includes('terjadi') ||
    norm.includes('masuk') ||
    norm.includes('keluar') ||
    norm.includes('dibayar') ||
    norm.includes('dibongkar')

  const hasQuestionMark = norm.includes('?')
  return hasDomain && (hasAskWord || hasIdLike || hasAnyNumber || hasTimeWord || hasActionWord || hasQuestionMark)
}

async function reportAktivitasHarian(args: AktivitasHarianArgs): Promise<ChatResponse> {
  const scope = await resolveKebunIds({ kebunId: args.kebunId, kebunName: args.kebunName })
  const preset = args.rangePreset || 'today'
  const customStart = parseIsoDate(args.startDate)
  const customEnd = parseIsoDate(args.endDate)
  const today = todayRangeUtc()
  const range = preset === 'custom' && customStart && customEnd ? { start: customStart, end: customEnd, label: 'Custom' } : today

  const scopeLabel =
    scope.kebunIds && scope.kebunIds.length === 1
      ? `Kebun ${scope.kebunNameById.get(scope.kebunIds[0]) || `#${scope.kebunIds[0]}`}`
      : 'Semua kebun'

  const notaWhere: any = {
    deletedAt: null,
    OR: [
      { tanggalBongkar: { gte: range.start, lte: range.end } },
      { tanggalBongkar: null, createdAt: { gte: range.start, lte: range.end } },
    ],
  }
  if (scope.kebunIds) notaWhere.kebunId = { in: scope.kebunIds }

  const kasWhere: any = { deletedAt: null, date: { gte: range.start, lte: range.end } }
  if (scope.kebunIds) kasWhere.kebunId = { in: scope.kebunIds }

  const gajianWhere: any = { tanggalMulai: { lte: range.end }, tanggalSelesai: { gte: range.start } }
  if (scope.kebunIds) gajianWhere.kebunId = { in: scope.kebunIds }

  const [notaCount, notaAgg, kasRows, gajianCount, gajianAgg] = await Promise.all([
    prisma.notaSawit.count({ where: notaWhere }),
    prisma.notaSawit.aggregate({ where: notaWhere, _sum: { pembayaranSetelahPph: true, totalPembayaran: true, netto: true } }),
    prisma.kasTransaksi.groupBy({ by: ['tipe'], where: kasWhere, _sum: { jumlah: true }, _count: { _all: true } }),
    prisma.gajian.count({ where: gajianWhere }),
    prisma.gajian.aggregate({ where: gajianWhere, _sum: { totalGaji: true, totalBiayaLain: true, totalPotongan: true } }),
  ])

  const totalSetelahPph = safeNumber(notaAgg._sum.pembayaranSetelahPph)
  const totalPembayaran = safeNumber(notaAgg._sum.totalPembayaran)
  const totalNetto = safeNumber(notaAgg._sum.netto)

  const kasMapped = (kasRows || []).map((r: any) => ({
    tipe: String(r.tipe || ''),
    count: safeNumber(r._count?._all),
    total: safeNumber(r._sum?.jumlah),
  }))
  const kasMasuk = kasMapped.filter((x) => x.tipe === 'PEMASUKAN').reduce((s, x) => s + x.total, 0)
  const kasKeluar = kasMapped.filter((x) => x.tipe === 'PENGELUARAN').reduce((s, x) => s + x.total, 0)
  const kasNet = kasMasuk - kasKeluar

  const gTotal = safeNumber(gajianAgg._sum.totalGaji) + safeNumber(gajianAgg._sum.totalBiayaLain)
  const gPot = safeNumber(gajianAgg._sum.totalPotongan)

  const table: TablePayload = {
    title: 'Data',
    columns: ['Komponen', 'Ringkas'],
    rows: [
      ['Nota Sawit', `Jumlah ${notaCount}; Netto ${formatIdCurrency(totalNetto)}; Setelah PPh ${formatIdCurrency(totalSetelahPph)}`],
      ['Kas', `Masuk ${formatIdCurrency(kasMasuk)}; Keluar ${formatIdCurrency(kasKeluar)}; Net ${formatIdCurrency(kasNet)}`],
      ['Gajian', `Jumlah ${gajianCount}; Total ${formatIdCurrency(gTotal)}; Potongan ${formatIdCurrency(gPot)}`],
    ],
  }

  return {
    answer: `${scopeLabel}. Hari ini: nota ${notaCount}, kas net ${formatIdCurrency(kasNet)}, gajian ${gajianCount}.`,
    tables: [table],
  }
}

async function runToolByName(name: string, args: any): Promise<ChatResponse | null> {
  if (name === 'kebun_profitability') return reportProfitabilityByArgs(args as ProfitabilityArgs)
  if (name === 'kebun_cost_change_explain') return reportCostChangeExplainByArgs(args as CostChangeArgs)
  if (name === 'kebun_kinerja_analisis') return reportKebunKinerjaAnalisisByArgs(args as KebunKinerjaAnalisisArgs)
  if (name === 'kebun_biaya_naik_analisis') return reportKebunBiayaNaikAnalisisByArgs(args as KebunBiayaNaikAnalisisArgs)
  if (name === 'kendaraan_biaya_analisis') return reportKendaraanBiayaAnalisisByArgs(args as KendaraanBiayaAnalisisArgs)
  if (name === 'karyawan_gaji_analisis') return reportKaryawanGajiAnalisisByArgs(args as KaryawanGajiAnalisisArgs)
  if (name === 'nota_sawit_count') return reportNotaSawitCountByArgs(args as NotaSawitCountArgs)
  if (name === 'nota_sawit_kendaraan_used') return reportNotaSawitKendaraanUsed(args as NotaSawitKendaraanUsedArgs)
  if (name === 'nota_sawit_berat_akhir') return reportNotaSawitBeratAkhir(args as NotaSawitBeratAkhirArgs)
  if (name === 'aktivitas_harian') return reportAktivitasHarian(args as AktivitasHarianArgs)
  if (name === 'nota_sawit_search') return reportNotaSawitSearch(args as NotaSawitSearchArgs)
  if (name === 'nota_sawit_detail') return reportNotaSawitDetail(args as NotaSawitDetailArgs)
  if (name === 'kas_transaksi_summary') return reportKasTransaksiSummary(args as KasTransaksiSummaryArgs)
  if (name === 'kas_transaksi_search') return reportKasTransaksiSearch(args as KasTransaksiSearchArgs)
  if (name === 'kas_transaksi_detail') return reportKasTransaksiDetail(args as KasTransaksiDetailArgs)
  if (name === 'uang_jalan_sessions') return reportUangJalanSessions(args as UangJalanSessionsArgs)
  if (name === 'uang_jalan_session_detail') return reportUangJalanSessionDetail(args as UangJalanSessionDetailArgs)
  if (name === 'gajian_search') return reportGajianSearch(args as GajianSearchArgs)
  if (name === 'gajian_detail') return reportGajianDetail(args as GajianDetailArgs)
  if (name === 'karyawan_search') return reportKaryawanSearch(args as KaryawanSearchArgs)
  if (name === 'kendaraan_search') return reportKendaraanSearch(args as KendaraanSearchArgs)
  if (name === 'kendaraan_expiring') return reportKendaraanExpiring(args as KendaraanExpiringArgs)
  if (name === 'kebun_overview') return reportKebunOverview(args as KebunOverviewArgs)
  if (name === 'kebun_list') return reportKebunList(args as KebunListArgs)
  if (name === 'kebun_detail') return reportKebunDetail(args as KebunDetailArgs)
  if (name === 'db_models_list') return reportDbModelsList()
  if (name === 'db_find_many') return reportDbFindMany(args)
  if (name === 'db_find_unique') return reportDbFindUnique(args)
  if (name === 'db_count') return reportDbCount(args)
  if (name === 'db_compare') return reportDbCompare(args)
  if (name === 'db_model_info') return reportDbModelInfo(args)
  if (name === 'db_raw_select') return reportDbRawSelect(args)
  if (name === 'db_compare_any') return reportDbCompareAny(args)
  return null
}

async function executeTool(
  name: string,
  rawArgs: any,
  contextMessage?: string,
): Promise<{ result: ChatResponse | null; notes: string[]; args: any }> {
  const norm = await normalizeArgsForTool(name, rawArgs, contextMessage)
  try {
    const result = await runToolByName(name, norm.args)
    return { result, notes: norm.notes, args: norm.args }
  } catch (e) {
    const msgRaw = e instanceof Error ? e.message : String(e || 'Unknown error')
    const msg = redactDbNamesFromText(msgRaw)
    const model = resolveModelDelegateName((norm.args as any)?.model)
    const schema = model ? await reportDbModelInfo({ model }) : null
    const tables = schema?.tables || []
    const hint = model ? 'Cek schema pakai db_model_info (entitas yang dipakai).' : 'Pakai db_models_list lalu pilih entitas valid.'
    const result: ChatResponse = {
      answer: `Tool error: ${msg}. ${hint}`,
      tables,
    }
    return { result, notes: norm.notes, args: norm.args }
  }
}

type PlannedToolStep = { name: string; args: any; why?: string }

function shouldInterviewQuestion(message: string) {
  const norm = normalizeText(message)
  if (!needsDbEvidence(message)) return false
  const len = norm.length
  const hasIdLike = /\b(id|#)\s*\d+\b/i.test(message) || /\b\d{4,}\b/.test(message)
  const hasTimeWord =
    norm.includes('hari ini') ||
    norm.includes('kemarin') ||
    norm.includes('minggu ini') ||
    norm.includes('bulan ini') ||
    norm.includes('bulan lalu') ||
    norm.includes('tahun ini') ||
    norm.includes('tahun lalu') ||
    norm.includes('tanggal ') ||
    /\b\d{4}-\d{2}-\d{2}\b/.test(norm)
  const hasDomain =
    norm.includes('nota') ||
    norm.includes('sawit') ||
    norm.includes('tbs') ||
    norm.includes('kebun') ||
    norm.includes('kas') ||
    norm.includes('kasir') ||
    norm.includes('gajian') ||
    norm.includes('karyawan') ||
    norm.includes('supir') ||
    norm.includes('kendaraan') ||
    norm.includes('timbangan') ||
    norm.includes('pekerjaan') ||
    norm.includes('borongan') ||
    norm.includes('hutang') ||
    norm.includes('absensi')
  if (!hasDomain) return false
  const askWord =
    norm.includes('tampilkan') ||
    norm.includes('sebutkan') ||
    norm.includes('daftar') ||
    norm.includes('list') ||
    norm.includes('cari') ||
    norm.includes('rekap') ||
    norm.includes('laporan') ||
    norm.includes('berapa') ||
    norm.includes('total') ||
    norm.includes('jumlah') ||
    norm.includes('biaya') ||
    norm.includes('beban')
  if (!askWord) return false
  if (hasIdLike || hasTimeWord) return false
  return len <= 140
}

async function planInterviewQuestions(params: { apiKey: string; model: string; question: string; rag?: string }) {
  const sys =
    'Mode interview.\n' +
    'Tugas: jika pertanyaan user ambigu untuk query DB, ajukan 1-3 pertanyaan klarifikasi.\n' +
    'Jika sudah cukup jelas, keluarkan questions=[]\n' +
    'Jangan sebut nama tabel/model Prisma.\n' +
    'Keluaran JSON saja:\n' +
    '{ "questions": ["...","..."] }'
  const prompt = params.rag
    ? `Pertanyaan user:\n${params.question}\n\nKonteks (RAG):\n${params.rag}`
    : `Pertanyaan user:\n${params.question}`
  const json = await pollinationsChat({
    apiKey: params.apiKey,
    model: params.model,
    messages: [
      { role: 'system', content: sys },
      { role: 'user', content: prompt },
    ],
    tools: [],
  })
  const text = extractPollinationsText(json)
  const parsed = extractJsonObject(text)
  const list = Array.isArray(parsed?.questions) ? (parsed.questions as any[]) : []
  const questions = list.map((x) => String(x || '').trim()).filter(Boolean).slice(0, 3)
  return { questions }
}

async function planDbSteps(params: { apiKey: string; model: string; prompt: string }) {
  const sys =
    'Tugas: buat rencana ambil data DB untuk jawab pertanyaan user.\n\n' +
    'Keluaran JSON saja:\n' +
    '{ "steps": [ { "name": "<tool>", "args": {..}, "why": "<alasan singkat>" } ] }\n\n' +
    'Aturan:\n' +
    '- steps 1..3.\n' +
    '- Pilih tool paling langsung.\n' +
    '- Kalau butuh schema/field: step pertama db_model_info.\n' +
    '- Untuk detail: nota_sawit_detail / kas_transaksi_detail / kebun_detail.\n' +
    '- Untuk ringkas aktivitas hari ini (nota/kas/gajian): aktivitas_harian.\n' +
    '- Untuk kinerja kebun (pendapatan vs biaya operasional + keyword filter): kebun_kinerja_analisis.\n' +
    '- Untuk analisis kenapa biaya bulan ini naik/turun (keyword filter): kebun_biaya_naik_analisis.\n' +
    '- Untuk analisis biaya kendaraan (kas tag kendaraan + uang jalan + service): kendaraan_biaya_analisis.\n' +
    '- Untuk analisis gaji karyawan (menu gajian + kas tag karyawan/gaji): karyawan_gaji_analisis.\n' +
    '- Untuk kendaraan dipakai nota sawit: nota_sawit_kendaraan_used.\n' +
    '- Untuk berat akhir nota sawit: nota_sawit_berat_akhir.\n' +
    '- Untuk banding 2 data detail: pakai db_compare_any dengan a/b tool invoke.\n' +
    '- Untuk angka: db_count/db_compare/db_compare_any.\n' +
    '- Untuk list: db_find_many (take<=50).\n' +
    '- Jangan keluarkan data sensitif.'

  const json = await pollinationsChat({
    apiKey: params.apiKey,
    model: params.model,
    messages: [
      { role: 'system', content: sys },
      { role: 'user', content: params.prompt },
    ],
    tools: [],
  })
  const text = extractPollinationsText(json)
  const parsed = extractJsonObject(text)
  const stepsRaw = Array.isArray(parsed?.steps) ? (parsed.steps as any[]) : []
  const steps: PlannedToolStep[] = stepsRaw
    .map((s) => ({
      name: String(s?.name || '').trim(),
      args: s?.args ?? {},
      why: String(s?.why || '').trim() || undefined,
    }))
    .filter((s) => Boolean(s.name))
    .slice(0, 3)
  return { steps }
}

async function planCompareSpecs(params: { apiKey: string; model: string; aPrompt: string; bPrompt: string }) {
  const sys =
    'Tugas: ubah 2 pertanyaan user menjadi spec perbandingan angka dari database.\n\nKeluaran: JSON saja (tanpa markdown), bentuk:\n{\n  "a": { "label": "A", "model": "...", "metric": "count|sum|avg|min|max", "field": "...", "where": { ... } }\n       atau { "label": "A", "sql": "SELECT ..." },\n  "b": { "label": "B", "model": "...", "metric": "count|sum|avg|min|max", "field": "...", "where": { ... } }\n       atau { "label": "B", "sql": "SELECT ..." }\n}\n\nAturan:\n- Prioritas: model+where+metric.\n- Default metric: count.\n- Jika butuh angka uang/berat, pakai sum(field) yang paling relevan.\n- where harus object Prisma. Jangan pakai operator SQL di where.\n- Jika struktur sulit, pakai sql SELECT/WITH yang return 1 angka.\n- Jangan ambil data sensitif.'

  const messages = [
    { role: 'system', content: sys },
    { role: 'user', content: `A: ${params.aPrompt}\nB: ${params.bPrompt}` },
  ]

  const json = await pollinationsChat({ apiKey: params.apiKey, model: params.model, messages, tools: [] })
  const text = extractPollinationsText(json)
  const parsed = extractJsonObject(text)
  return parsed
}

async function compareTwoPrompts(params: { apiKey: string; model: string; aPrompt: string; bPrompt: string }) {
  const planned = await planCompareSpecs(params)
  const a = planned?.a
  const b = planned?.b
  if (!a || !b) {
    return {
      answer:
        'Gagal buat rencana perbandingan otomatis. Pakai format: "bandingkan: <pertanyaan A> || <pertanyaan B>" atau tulis jelas A vs B dalam 1 kalimat.',
      tables: [],
      reasoning: ['Mode bandingkan: rencana gagal (planner output bukan JSON spec a/b).'],
    } satisfies ChatResponse
  }
  const base = await reportDbCompareAny({ a, b })
  return mergeReasoning(base, [
    'Mode bandingkan: 2 pertanyaan → planner buat spec → eksekusi db_compare_any.',
    `Spec A: ${safeShortJson(a, 320)}`,
    `Spec B: ${safeShortJson(b, 320)}`,
  ])
}

async function handleAgent(message: string, history?: ChatHistoryItem[], memories?: string[]): Promise<ChatResponse> {
  const apiKey = String(process.env.POLLINATIONS_API_KEY || '').trim()
  if (!apiKey) return handleMessage(message)

  const model = String(process.env.POLLINATIONS_MODEL || 'openai-fast').trim() || 'openai-fast'
  const modelNorm = model.toLowerCase()
  const modelSupportsTools = !modelNorm.startsWith('gemini') && !modelNorm.includes('vertex')

  const norm = normalizeText(message)
  const compareExplicit = message.match(/^bandingkan\s*:\s*([\s\S]+?)\s*\|\|\s*([\s\S]+)$/i)
  const comparePrev =
    norm === 'bandingkan' ||
    (norm.includes('bandingkan') && (norm.includes('sebelumnya') || norm.includes('tadi') || norm.includes('yang lalu') || norm.includes('pertanyaan') || norm.includes('jawaban')))

  if (compareExplicit?.[1] && compareExplicit?.[2]) {
    const aPrompt = String(compareExplicit[1]).trim()
    const bPrompt = String(compareExplicit[2]).trim()
    if (aPrompt && bPrompt) return compareTwoPrompts({ apiKey, model, aPrompt, bPrompt })
  }
  if (comparePrev) {
    const lastTwo = pickLastUserPrompts(history, 2)
    if (lastTwo.length >= 2) {
      return compareTwoPrompts({ apiKey, model, aPrompt: lastTwo[0], bPrompt: lastTwo[1] })
    }
    return { answer: 'Butuh 2 pertanyaan sebelumnya untuk dibandingkan.', tables: [], reasoning: ['Mode bandingkan: history user < 2.'] }
  }

  const multiParts = message
    .split('|')
    .map((s) => String(s || '').trim())
    .filter(Boolean)
    .slice(0, 3)
  if (modelSupportsTools && multiParts.length >= 2) {
    const outs: ChatResponse[] = []
    const why: string[] = ['Multi-intent: user pisah dengan "|" → eksekusi per bagian.']
    for (const part of multiParts) {
      const pNorm = normalizeText(part)
      if (pNorm.includes('ringkas aktivitas') && (pNorm.includes('hari ini') || pNorm.includes('today'))) {
        const base = await reportAktivitasHarian({ rangePreset: 'today' })
        outs.push(mergeReasoning(base, ['Bagian: ringkas aktivitas hari ini (nota/kas/gajian).']))
        continue
      }
      if (pNorm.includes('bandingkan') && pNorm.includes('biaya') && pNorm.includes('kebun') && (pNorm.includes('bulan ini') || pNorm.includes('bulan lalu'))) {
        const base = await reportCostChangeExplain(part)
        outs.push(mergeReasoning(base, ['Bagian: banding bulan ini vs bulan lalu untuk biaya kebun.']))
        continue
      }
    }
    if (outs.length >= 2) {
      const answer = outs.map((o, i) => `${i + 1}) ${String(o.answer || '').trim()}`).filter(Boolean).join('\n')
      const tables = outs.flatMap((o) => (Array.isArray(o.tables) ? o.tables : [])).slice(0, 4)
      const reasoning = why.concat(outs.flatMap((o) => (Array.isArray(o.reasoning) ? o.reasoning : []))).slice(0, 40)
      return { answer, tables, reasoning }
    }
  }

  const normLower = normalizeText(message)
  const isNotaBeratAkhir =
    (normLower.includes('nota') || normLower.includes('sawit') || normLower.includes('tbs')) &&
    normLower.includes('berat akhir') &&
    (normLower.includes('hari ini') || normLower.includes('bulan ini') || /\b\d{4}-\d{2}-\d{2}\b/.test(normLower))
  if (isNotaBeratAkhir) {
    const range = inferRangeFromQuestion(message) || todayRangeUtc()
    const base = await reportNotaSawitBeratAkhir({ rangePreset: 'custom', startDate: range.start.toISOString(), endDate: range.end.toISOString(), limit: 50 })
    return mergeReasoning(base, ['Shortcut: pertanyaan minta berat akhir nota sawit → query minimal (tidak ambil detail).'])
  }

  const isAktivitasHariIni =
    normLower.includes('ringkas aktivitas') && (normLower.includes('hari ini') || normLower.includes('today')) && (normLower.includes('nota') || normLower.includes('kas') || normLower.includes('gajian'))
  if (isAktivitasHariIni) {
    const base = await reportAktivitasHarian({ rangePreset: 'today' })
    return mergeReasoning(base, ['Shortcut: ringkas aktivitas hari ini → query minimal 3 sumber (nota/kas/gajian).'])
  }

  const ragMini = retrieveKnowledgeForQuestion(message, 900, 4)
  if (modelSupportsTools && shouldInterviewQuestion(message)) {
    const planned = await planInterviewQuestions({ apiKey, model, question: message, rag: ragMini || undefined })
    if (planned.questions.length > 0) {
      const lines = planned.questions.map((q, i) => `${i + 1}) ${q}`)
      return {
        answer: `Mode interview:\n${lines.join('\n')}\n\nBalas dengan format: 1: ...; 2: ...; 3: ... (yang tidak perlu boleh kosong).`,
        tables: [],
        reasoning: ['Interview: butuh klarifikasi sebelum ambil data DB.'],
      }
    }
  }

  const isKebunListIntent =
    norm.includes('daftar kebun') || norm.includes('list kebun') || norm.includes('kebun terdaftar') || norm.includes('nama kebun')
  const isKebunBiayaIntent = norm.includes('biaya kebun') || (norm.includes('biaya') && norm.includes('kebun')) || (norm.includes('beban') && norm.includes('kebun'))
  const isKebunBiayaPanenIntent =
    norm.includes('biaya panen') || ((norm.includes('biaya') || norm.includes('upah')) && norm.includes('panen') && norm.includes('kebun'))
  const isBiayaExplainIntent =
    (norm.includes('kenapa') || norm.includes('mengapa') || norm.includes('naik') || norm.includes('turun') || norm.includes('dibanding') || norm.includes('banding')) &&
    (norm.includes('bulan ini') || norm.includes('bulan') || norm.includes('sebelumnya') || norm.includes('bulan lalu'))
  const isProfitIntent =
    norm.includes('beban') ||
    norm.includes('pendapatan') ||
    norm.includes('margin') ||
    norm.includes('rasio') ||
    norm.includes('profit') ||
    norm.includes('laba')

  if (isKebunBiayaPanenIntent) {
    const base = await reportKebunBiayaPanen(message)
    return mergeReasoning(base, [
      'Deteksi intent: biaya panen kebun.',
      'Sumber data: Gajian (tipe=PANEN) + PekerjaanKebun (jenis/kategori mengandung panen, gajianId null) + KasTransaksi (pengeluaran mengandung kata panen).',
    ])
  }

  if (!modelSupportsTools) {
    if (isKebunBiayaIntent && !isKebunListIntent) {
      const base = await reportKebunBiayaSummary(message)
      return mergeReasoning(base, ['Deteksi intent: biaya kebun.', 'Ambil data via Prisma (kas+borongan+gajian) lalu total.'])
    }
    if (isBiayaExplainIntent) {
      const base = await reportCostChangeExplain(message)
      return mergeReasoning(base, ['Deteksi intent: penjelasan perubahan biaya.', 'Ambil 2 range lalu breakdown kas+borongan+gajian.'])
    }
    if (isKebunListIntent) {
      const base = await reportKebunList({ query: undefined, limit: 50 })
      return mergeReasoning(base, ['Deteksi intent: daftar kebun.', 'Query Prisma kebun.findMany (limit 50).'])
    }
    if (isProfitIntent) {
      const base = await reportProfitability(message)
      return mergeReasoning(base, ['Deteksi intent: profit/laba/rasio kebun.', 'Pendapatan: nota sawit setelah PPh. Beban: kas+borongan+gajian.'])
    }
    const fallback = await handleMessage(message)
    if (fallback.answer && !fallback.answer.startsWith('Pertanyaan belum dikenali')) return fallback
  }

  const tools = [
    {
      type: 'function',
      function: {
        name: 'kebun_profitability',
        description:
          'Hitung beban produksi vs pendapatan kebun. Pendapatan pakai nota sawit setelah PPh. Beban gabungan kas pengeluaran (kebunId/tag), biaya borongan, gajian harian.',
        parameters: {
          type: 'object',
          properties: {
            rangePreset: { type: 'string', enum: ['year_to_date', 'this_month', 'prev_month', 'custom'] },
            startDate: { type: 'string', description: 'ISO date/time. Dipakai kalau rangePreset=custom.' },
            endDate: { type: 'string', description: 'ISO date/time. Dipakai kalau rangePreset=custom.' },
            kebunId: { type: 'integer' },
            kebunName: { type: 'string' },
            sortBy: { type: 'string', enum: ['ratio', 'beban', 'pendapatan'] },
          },
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'aktivitas_harian',
        description: 'Ringkas aktivitas hari ini (nota sawit + kas + gajian). Bisa filter kebun.',
        parameters: {
          type: 'object',
          properties: {
            rangePreset: { type: 'string', enum: ['today', 'custom'] },
            startDate: { type: 'string' },
            endDate: { type: 'string' },
            kebunId: { type: 'integer' },
            kebunName: { type: 'string' },
          },
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'nota_sawit_berat_akhir',
        description: 'Tampilkan berat akhir nota sawit dalam range (default hari ini). Output list id + berat akhir.',
        parameters: {
          type: 'object',
          properties: {
            rangePreset: { type: 'string', enum: ['today', 'this_month', 'year_to_date', 'custom'] },
            startDate: { type: 'string', description: 'ISO date/time. Dipakai kalau rangePreset=custom.' },
            endDate: { type: 'string', description: 'ISO date/time. Dipakai kalau rangePreset=custom.' },
            kebunId: { type: 'integer' },
            kebunName: { type: 'string' },
            limit: { type: 'integer' },
          },
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'kebun_cost_change_explain',
        description:
          'Jelaskan kenapa biaya berubah. Default banding bulan ini vs bulan lalu. Breakdown: kas kategori + borongan jenis + gajian.',
        parameters: {
          type: 'object',
          properties: {
            kebunId: { type: 'integer' },
            kebunName: { type: 'string' },
            aStartDate: { type: 'string', description: 'ISO. Range A start. Default bulan ini.' },
            aEndDate: { type: 'string', description: 'ISO. Range A end. Default bulan ini.' },
            bStartDate: { type: 'string', description: 'ISO. Range B start. Default bulan lalu.' },
            bEndDate: { type: 'string', description: 'ISO. Range B end. Default bulan lalu.' },
          },
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'kebun_kinerja_analisis',
        description:
          'Analisis kinerja kebun: bandingkan pendapatan nota sawit (setelah PPh) vs biaya operasional (kas pengeluaran + borongan + gajian). Bisa filter biaya pakai include/exclude keyword (contoh: ["panen"]).',
        parameters: {
          type: 'object',
          properties: {
            rangePreset: { type: 'string', enum: ['today', 'this_month', 'prev_month', 'year_to_date', 'custom'] },
            startDate: { type: 'string' },
            endDate: { type: 'string' },
            kebunId: { type: 'integer' },
            kebunName: { type: 'string' },
            includeKeywords: { type: 'array', items: { type: 'string' } },
            excludeKeywords: { type: 'array', items: { type: 'string' } },
            topN: { type: 'integer' },
          },
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'kebun_biaya_naik_analisis',
        description:
          'Analisis kenapa biaya kebun bulan ini naik/turun dibanding bulan lalu. Bisa filter biaya pakai include/exclude keyword (contoh: ["panen"]). Output top penyebab + kontribusi.',
        parameters: {
          type: 'object',
          properties: {
            kebunId: { type: 'integer' },
            kebunName: { type: 'string' },
            includeKeywords: { type: 'array', items: { type: 'string' } },
            excludeKeywords: { type: 'array', items: { type: 'string' } },
            topN: { type: 'integer' },
          },
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'kendaraan_biaya_analisis',
        description:
          'Analisis biaya kendaraan dari beberapa sumber: kas transaksi (tag kendaraan), uang jalan (pengeluaran), dan service log. Jika plat tidak diisi, tampilkan top kendaraan berdasarkan kas tag kendaraan.',
        parameters: {
          type: 'object',
          properties: {
            rangePreset: { type: 'string', enum: ['today', 'this_month', 'prev_month', 'year_to_date', 'custom'] },
            startDate: { type: 'string' },
            endDate: { type: 'string' },
            kendaraanPlatNomor: { type: 'string' },
            includeKeywords: { type: 'array', items: { type: 'string' } },
            excludeKeywords: { type: 'array', items: { type: 'string' } },
            topN: { type: 'integer' },
          },
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'karyawan_gaji_analisis',
        description:
          'Analisis gaji karyawan gabungan: menu gajian (detail per karyawan) + kas transaksi (tag karyawan / kategori gaji). Bisa filter kebun + keyword untuk kas.',
        parameters: {
          type: 'object',
          properties: {
            rangePreset: { type: 'string', enum: ['today', 'this_month', 'prev_month', 'year_to_date', 'custom'] },
            startDate: { type: 'string' },
            endDate: { type: 'string' },
            kebunId: { type: 'integer' },
            kebunName: { type: 'string' },
            karyawanId: { type: 'integer' },
            karyawanName: { type: 'string' },
            includeKeywords: { type: 'array', items: { type: 'string' } },
            excludeKeywords: { type: 'array', items: { type: 'string' } },
            topN: { type: 'integer' },
          },
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'nota_sawit_count',
        description: 'Hitung jumlah nota sawit dalam range (default hari ini). Bisa filter kebun. Output ringkas + tabel.',
        parameters: {
          type: 'object',
          properties: {
            rangePreset: { type: 'string', enum: ['today', 'this_month', 'year_to_date', 'custom'] },
            startDate: { type: 'string', description: 'ISO date/time. Dipakai kalau rangePreset=custom.' },
            endDate: { type: 'string', description: 'ISO date/time. Dipakai kalau rangePreset=custom.' },
            kebunId: { type: 'integer' },
            kebunName: { type: 'string' },
          },
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'nota_sawit_kendaraan_used',
        description: 'List kendaraan (plat) yang dipakai untuk nota sawit dalam range (default hari ini) + jumlah nota per plat.',
        parameters: {
          type: 'object',
          properties: {
            rangePreset: { type: 'string', enum: ['today', 'this_month', 'year_to_date', 'custom'] },
            startDate: { type: 'string' },
            endDate: { type: 'string' },
            limit: { type: 'integer' },
          },
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'nota_sawit_search',
        description: 'Cari/list nota sawit. Bisa filter kebun, status, range. Output tabel.',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string' },
            rangePreset: { type: 'string', enum: ['today', 'this_month', 'year_to_date', 'custom'] },
            startDate: { type: 'string' },
            endDate: { type: 'string' },
            kebunId: { type: 'integer' },
            kebunName: { type: 'string' },
            supirId: { type: 'integer' },
            supirName: { type: 'string' },
            statusPembayaran: { type: 'string' },
            limit: { type: 'integer' },
          },
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'nota_sawit_detail',
        description: 'Detail nota sawit by ID, termasuk relasi utama + kas/invoice/pembayaran terkait (ringkas).',
        parameters: { type: 'object', properties: { notaSawitId: { type: 'integer' } }, required: ['notaSawitId'] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'kas_transaksi_summary',
        description:
          'Ringkas kas transaksi (pemasukan/pengeluaran) dalam range. Bisa filter kebun. Optional group by kategori.',
        parameters: {
          type: 'object',
          properties: {
            rangePreset: { type: 'string', enum: ['today', 'this_month', 'year_to_date', 'custom'] },
            startDate: { type: 'string' },
            endDate: { type: 'string' },
            kebunId: { type: 'integer' },
            kebunName: { type: 'string' },
            groupByKategori: { type: 'boolean' },
          },
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'kas_transaksi_search',
        description:
          'Cari/list kas transaksi (kasir) read-only. Filter range/tipe/kategori/kebun/karyawan/kendaraan. Output tabel.',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string' },
            rangePreset: { type: 'string', enum: ['today', 'this_month', 'year_to_date', 'custom'] },
            startDate: { type: 'string' },
            endDate: { type: 'string' },
            tipe: { type: 'string', enum: ['all', 'PEMASUKAN', 'PENGELUARAN'] },
            kategori: { type: 'string' },
            kebunId: { type: 'integer' },
            kebunName: { type: 'string' },
            karyawanId: { type: 'integer' },
            karyawanName: { type: 'string' },
            kendaraanPlatNomor: { type: 'string' },
            limit: { type: 'integer' },
          },
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'kas_transaksi_detail',
        description: 'Detail kas transaksi by ID, termasuk relasi (kebun/karyawan/kendaraan/user/gajian/nota/batch).',
        parameters: { type: 'object', properties: { kasTransaksiId: { type: 'integer' } }, required: ['kasTransaksiId'] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'uang_jalan_sessions',
        description: 'Cari/list sesi uang jalan. Filter range/status/supir/kendaraan. Output tabel.',
        parameters: {
          type: 'object',
          properties: {
            rangePreset: { type: 'string', enum: ['today', 'this_month', 'year_to_date', 'custom'] },
            startDate: { type: 'string' },
            endDate: { type: 'string' },
            status: { type: 'string' },
            supirId: { type: 'integer' },
            supirName: { type: 'string' },
            kendaraanPlatNomor: { type: 'string' },
            limit: { type: 'integer' },
          },
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'uang_jalan_session_detail',
        description: 'Detail sesi uang jalan + rincian. Input sesiId.',
        parameters: { type: 'object', properties: { sesiId: { type: 'integer' } }, required: ['sesiId'] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'gajian_search',
        description: 'Cari/list gajian. Filter kebun/status/tipe/range. Output tabel.',
        parameters: {
          type: 'object',
          properties: {
            rangePreset: { type: 'string', enum: ['this_month', 'year_to_date', 'custom'] },
            startDate: { type: 'string' },
            endDate: { type: 'string' },
            kebunId: { type: 'integer' },
            kebunName: { type: 'string' },
            status: { type: 'string' },
            tipe: { type: 'string' },
            limit: { type: 'integer' },
          },
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'gajian_detail',
        description: 'Detail gajian + top karyawan. Input gajianId.',
        parameters: { type: 'object', properties: { gajianId: { type: 'integer' }, karyawanLimit: { type: 'integer' } }, required: ['gajianId'] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'karyawan_search',
        description: 'Cari/list user/karyawan/supir/mandor/manager. Filter role/jobType/status/kebun. Output tabel.',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string' },
            role: { type: 'string' },
            jobType: { type: 'string' },
            status: { type: 'string' },
            kebunId: { type: 'integer' },
            kebunName: { type: 'string' },
            limit: { type: 'integer' },
          },
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'kendaraan_search',
        description: 'Cari/list kendaraan. Filter query/jnis. Output tabel.',
        parameters: { type: 'object', properties: { query: { type: 'string' }, jenis: { type: 'string' }, limit: { type: 'integer' } } },
      },
    },
    {
      type: 'function',
      function: {
        name: 'kendaraan_expiring',
        description: 'List kendaraan dokumen hampir jatuh tempo. days default 30. type stnk/pajak/speksi/trayek/all.',
        parameters: { type: 'object', properties: { days: { type: 'integer' }, type: { type: 'string', enum: ['all', 'stnk', 'pajak', 'speksi', 'trayek'] } } },
      },
    },
    {
      type: 'function',
      function: {
        name: 'kebun_overview',
        description:
          'Ringkas kebun (pendapatan setelah PPh, beban kas+borongan+gajian, produksi timbangan). Filter kebun + range.',
        parameters: {
          type: 'object',
          properties: {
            rangePreset: { type: 'string', enum: ['this_month', 'year_to_date', 'custom'] },
            startDate: { type: 'string' },
            endDate: { type: 'string' },
            kebunId: { type: 'integer' },
            kebunName: { type: 'string' },
          },
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'kebun_detail',
        description: 'Detail kebun by ID/nama + list data terbaru (nota/kas/pekerjaan/gajian).',
        parameters: {
          type: 'object',
          properties: { kebunId: { type: 'integer' }, kebunName: { type: 'string' }, recentLimit: { type: 'integer' } },
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'kebun_list',
        description: 'List kebun terdaftar. Bisa search nama/lokasi/id. Output tabel.',
        parameters: { type: 'object', properties: { query: { type: 'string' }, limit: { type: 'integer' } } },
      },
    },
    {
      type: 'function',
      function: {
        name: 'db_models_list',
        description: 'List semua model Prisma yang bisa di-query (read-only).',
        parameters: { type: 'object', properties: {} },
      },
    },
    {
      type: 'function',
      function: {
        name: 'db_find_many',
        description:
          'Query data read-only via Prisma findMany. Support include relasi (max depth 2). Pakai model dari db_models_list. Default take=20.',
        parameters: {
          type: 'object',
          properties: {
            model: { type: 'string' },
            where: { type: 'object' },
            select: { type: 'object' },
            include: { type: 'object' },
            orderBy: { oneOf: [{ type: 'object' }, { type: 'array', items: { type: 'object' } }] },
            take: { type: 'integer' },
            skip: { type: 'integer' },
          },
          required: ['model'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'db_find_unique',
        description: 'Query 1 baris read-only via Prisma findUnique. where wajib.',
        parameters: {
          type: 'object',
          properties: {
            model: { type: 'string' },
            where: { type: 'object' },
            select: { type: 'object' },
            include: { type: 'object' },
          },
          required: ['model', 'where'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'db_count',
        description: 'Hitung jumlah baris via Prisma count (read-only).',
        parameters: {
          type: 'object',
          properties: {
            model: { type: 'string' },
            where: { type: 'object' },
          },
          required: ['model'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'db_compare',
        description: 'Bandingkan 2 kondisi filter untuk model yang sama (count atau sum(field)).',
        parameters: {
          type: 'object',
          properties: {
            model: { type: 'string' },
            metric: { type: 'string', enum: ['count', 'sum'] },
            field: { type: 'string' },
            labelA: { type: 'string' },
            labelB: { type: 'string' },
            whereA: { type: 'object' },
            whereB: { type: 'object' },
          },
          required: ['model'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'db_model_info',
        description: 'Lihat schema field untuk 1 model Prisma.',
        parameters: { type: 'object', properties: { model: { type: 'string' } }, required: ['model'] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'db_raw_select',
        description: 'Query SQL read-only (SELECT/WITH saja). Limit otomatis max 100.',
        parameters: { type: 'object', properties: { sql: { type: 'string' } }, required: ['sql'] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'db_compare_any',
        description:
          'Bandingkan 2 metric lintas menu/model. Spec bisa pakai model+where+metric(+field) atau sql (SELECT/WITH) yang return 1 angka.',
        parameters: {
          type: 'object',
          properties: {
            a: {
              type: 'object',
              properties: {
                label: { type: 'string' },
                model: { type: 'string' },
                where: { type: 'object' },
                metric: { type: 'string', enum: ['count', 'sum', 'avg', 'min', 'max'] },
                field: { type: 'string' },
                sql: { type: 'string' },
              },
            },
            b: {
              type: 'object',
              properties: {
                label: { type: 'string' },
                model: { type: 'string' },
                where: { type: 'object' },
                metric: { type: 'string', enum: ['count', 'sum', 'avg', 'min', 'max'] },
                field: { type: 'string' },
                sql: { type: 'string' },
              },
            },
          },
          required: ['a', 'b'],
        },
      },
    },
  ]

  const systemInstructionBase =
    `Peran: kamu asisten ahli untuk aplikasi sarakan_app.\n` +
    `Tujuan: jawab pertanyaan user tentang data & proses bisnis aplikasi.\n\n` +
    `Gaya jawab: jelas, langsung, langkah-aksi.\n\n` +
    `Teknik CoT:\n- Pikirkan jawaban selangkah demi selangkah secara internal sebelum jawab.\n- Jangan tampilkan chain-of-thought rinci. Tampilkan hanya ringkas hasil + proses level tinggi.\n\n` +
    `Batasan (wajib):\n` +
    `- Jawab hanya berdasarkan konteks yang diberikan (tool DB + hasil RAG + history/memory).\n` +
    `- Tidak punya akses browsing internet.\n` +
    `- Jika jawaban tidak ada dalam data yang tersedia, katakan: "Maaf, saya tidak tahu berdasarkan data yang tersedia." lalu minta 1-3 klarifikasi.\n` +
    `- Jika user minta angka/biaya/total/bandingkan dari DB: wajib query DB (tool). Jangan tebak.\n` +
    `- Dilarang mengarang angka, nama, atau status. Jika ragu, minta klarifikasi.\n` +
    `- Jangan keluarkan data sensitif (password/token/secret/keys). Jika diminta, tolak.\n` +
    `- Jangan sebut nama tabel/model Prisma di jawaban. Tampilkan data saja, pakai istilah bisnis.\n` +
    `- Boleh ringkas hasil dalam teks + tabel tool. Jangan bikin tabel markdown.\n\n` +
    `RAG:\n- Ambil konteks dari knowledge base (schema + menu + API) dulu.\n- Pakai konteks itu untuk pilih tool/query.\n\n` +
    `Tool DB umum:\n- Pakai db_model_info bila field tidak yakin.\n- Pakai db_find_many/db_find_unique/db_count/db_compare/db_compare_any/db_raw_select untuk query.\n- Pakai nota_sawit_detail/kas_transaksi_detail/kebun_detail untuk detail.\n\n` +
    `Jika ambiguous, pilih asumsi paling masuk akal dan tulis asumsi.\nBahasa: Indonesia.`
  const rag = retrieveKnowledgeForQuestion(message, 1800, 6)
  const ragBlock = rag ? `\n\nKonteks (RAG hasil retrieval):\n${rag}` : ''
  const systemInstruction = `${systemInstructionBase}${formatMemoryBlock(normalizeMemoryList(memories))}${ragBlock}`

  const messages: any[] = [{ role: 'system', content: systemInstruction }]
  if (Array.isArray(history) && history.length > 0) {
    const sliced = history
      .filter((h) => h && (h.role === 'user' || h.role === 'assistant'))
      .map((h) => ({ role: h.role, content: String(h.content || '').trim() }))
      .filter((h) => Boolean(h.content))
      .slice(-24)
    messages.push(...sliced)
  }
  messages.push({ role: 'user', content: message })

  const toolTables: TablePayload[] = []
  let toolSummary = ''
  const reasoning: string[] = []
  if (rag) reasoning.push('RAG: ambil konteks dari knowledge base (schema/menu/API) sebelum query.')
  let totalExecuted = 0
  let lastText = ''

  const maxSteps = 6
  for (let step = 0; step < maxSteps; step += 1) {
    let resp: any
    try {
      resp = await pollinationsChat({ apiKey, model, messages, tools: modelSupportsTools ? tools : [] })
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e || '')
      if (modelSupportsTools && /thought_signature/i.test(errMsg)) {
        resp = await pollinationsChat({ apiKey, model, messages, tools: [] })
      } else {
        throw e
      }
    }

    const text = extractPollinationsText(resp)
    const calls = modelSupportsTools ? extractPollinationsToolCalls(resp) : []
    lastText = text || lastText

    if (calls.length === 0) {
      if (step === 0 && modelSupportsTools && needsDbEvidence(message)) {
        const plan = await planDbSteps({ apiKey, model, prompt: message })
        const steps = Array.isArray(plan.steps) ? plan.steps : []
        if (steps.length > 0) {
          const accTables: TablePayload[] = []
          let accAnswer = ''
          const accReason: string[] = [
            `DB-first: pertanyaan butuh data DB, model tidak memanggil tool → planner rencanakan ${steps.length} langkah.`,
          ]
          for (let i = 0; i < steps.length; i += 1) {
            const st = steps[i]
            const exec = await executeTool(st.name, st.args, message)
            const notes = exec.notes.length > 0 ? `Normalisasi: ${exec.notes.join('; ')}` : ''
            accReason.push(`Langkah ${i + 1}: ${st.name}. ${st.why ? `why: ${st.why}` : ''} args: ${safeShortJson(exec.args, 520)}`)
            if (notes) accReason.push(notes)
            if (exec.result?.answer) accAnswer = exec.result.answer
            if (Array.isArray(exec.result?.tables)) accTables.push(...exec.result.tables)
          }
          const base = mergeReasoning({ answer: accAnswer || 'Selesai ambil data.', tables: accTables, reasoning: accReason }, [
            'Sumber data: database via Prisma (bukan internet).',
          ])
          return postProcessAgentResponse({ apiKey, model, question: message, resp: base })
        }
        const raw = await rawFallbackFromDb(message, apiKey, model)
        if (raw) return raw
        return {
          answer:
            'Maaf, saya tidak tahu berdasarkan data yang tersedia. Pertanyaan butuh data database tapi gagal menentukan langkah. Tambah kata kunci menu (nota/kas/gajian/kebun) + waktu (hari ini/bulan ini) atau sebut id.',
          tables: [],
          reasoning: ['DB-first: planner gagal, raw fallback gagal.'],
        }
      }

      if (totalExecuted > 0) {
        const answer = toolSummary || text || lastText || 'Pertanyaan belum dikenali.'
        return postProcessAgentResponse({ apiKey, model, question: message, resp: { answer, tables: toolTables, reasoning } })
      }

      if (modelSupportsTools && needsDbEvidence(message)) {
        const raw = await rawFallbackFromDb(message, apiKey, model)
        if (raw) return raw
        return {
          answer:
            'Maaf, saya tidak tahu berdasarkan data yang tersedia. Butuh data database dulu. Tulis pertanyaan versi lebih spesifik (menu + waktu/id) agar bisa ambil data.',
          tables: [],
          reasoning: ['Guard: butuh DB, raw fallback gagal → tolak jawab agar tidak halu.'],
        }
      }
      if (text) return { answer: text, tables: [], reasoning: ['Jawab tanpa query DB (tidak ada tool dipakai).'] }
      return handleMessage(message)
    }

    const assistantMessage = resp?.choices?.[0]?.message
    if (assistantMessage) messages.push(assistantMessage)

    let executedThisStep = 0
    for (const call of calls.slice(0, 3)) {
      const name = call.name
      const exec = await executeTool(name, call.args || {}, message)
      if (!exec.result) continue
      reasoning.push(`Tool dipakai: ${name}. args: ${safeShortJson(exec.args, 420)}`)
      if (exec.notes.length > 0) reasoning.push(`Normalisasi: ${exec.notes.join('; ')}`)
      toolSummary = exec.result.answer || toolSummary
      if (Array.isArray(exec.result.tables)) toolTables.push(...exec.result.tables)
      totalExecuted += 1
      executedThisStep += 1
      messages.push({
        role: 'tool',
        tool_call_id: call.id,
        content: JSON.stringify({ result: exec.result }),
      })
      if (totalExecuted >= 12) break
    }

    if (executedThisStep === 0) {
      if (text) return { answer: text, tables: toolTables, reasoning: [...reasoning, 'Model minta tool, tapi tool tidak dieksekusi.'] }
      break
    }

    if (totalExecuted >= 12) break
  }

  if (totalExecuted > 0) {
    const answer = toolSummary || lastText || 'Pertanyaan belum dikenali.'
    return postProcessAgentResponse({ apiKey, model, question: message, resp: { answer, tables: toolTables, reasoning } })
  }
  if (lastText) return { answer: lastText, tables: [], reasoning: ['Jawab tanpa query DB.'] }
  return handleMessage(message)
}

async function handleMessage(message: string): Promise<ChatResponse> {
  const norm = normalizeText(message)
  const wantsKebunList =
    norm.includes('daftar kebun') || norm.includes('list kebun') || norm.includes('kebun terdaftar') || norm.includes('nama kebun')
  const wantsKebunBiaya =
    norm.includes('biaya kebun') || (norm.includes('biaya') && norm.includes('kebun')) || (norm.includes('beban') && norm.includes('kebun'))
  const wantsExplain =
    norm.includes('kenapa') ||
    norm.includes('mengapa') ||
    norm.includes('naik') ||
    norm.includes('turun') ||
    norm.includes('dibanding') ||
    norm.includes('banding')
  const wantsProfit =
    norm.includes('beban') ||
    norm.includes('pendapatan') ||
    norm.includes('margin') ||
    norm.includes('rasio') ||
    norm.includes('profit') ||
    norm.includes('laba')

  if (wantsExplain && (norm.includes('bulan ini') || norm.includes('bulan') || norm.includes('sebelumnya'))) {
    return reportCostChangeExplain(message)
  }
  if (wantsKebunBiaya && !wantsKebunList) {
    return reportKebunBiayaSummary(message)
  }
  if (wantsKebunList) {
    const query = message
      .replace(/daftar|list/gi, ' ')
      .replace(/kebun/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    const q = query && query.toLowerCase() !== 'semua' ? query : ''
    return reportKebunList({ query: q || undefined, limit: 50 })
  }
  if (wantsProfit) {
    return reportProfitability(message)
  }

  return {
    answer:
      'Pertanyaan belum dikenali. Contoh: "beban produksi terhadap pendapatan kebun tahun ini" atau "kenapa biaya bulan ini naik dibanding bulan lalu".',
    tables: [],
  }
}

export async function POST(request: Request) {
  const guard = await requireRole(['ADMIN'])
  if (guard.response) return guard.response
  const body = await request.json().catch(() => ({} as any))
  const message = String((body as any)?.message || '').trim()
  if (!message) return NextResponse.json({ error: 'message wajib' }, { status: 400 })
  const historyRaw = (body as any)?.history
  const history: ChatHistoryItem[] | undefined = Array.isArray(historyRaw)
    ? (historyRaw as any[])
        .map((h): ChatHistoryItem => ({ role: h?.role === 'assistant' ? 'assistant' : 'user', content: String(h?.content || '').trim() }))
        .filter((h) => Boolean(h.content))
        .slice(-24)
    : undefined
  const memories = normalizeMemoryList((body as any)?.memories)

  const hasKey = Boolean(String(process.env.POLLINATIONS_API_KEY || '').trim())
  const model = String(process.env.POLLINATIONS_MODEL || 'openai-fast').trim() || 'openai-fast'
  try {
    const data = await handleAgent(message, history, memories)
    const apiKey = String(process.env.POLLINATIONS_API_KEY || '').trim()
    const autoFollow =
      apiKey && !hasFollowUps(data.answer)
        ? await suggestFollowUpsViaModel({ apiKey, model, question: message, answer: data.answer, tables: data.tables || [] })
        : null
    const follow = autoFollow || heuristicFollowUps(message)
    const answer = appendFollowUps(data.answer, follow)
    return NextResponse.json({ ...data, answer, meta: { agent: hasKey ? 'pollinations' : 'fallback', model } })
  } catch (e) {
    if (hasKey) {
      const errMsg = e instanceof Error ? e.message : 'Unknown error'
      const fallback = await handleMessage(message)
      return NextResponse.json({
        answer: appendFollowUps(`Pollinations error: ${errMsg}. Cek POLLINATIONS_API_KEY, POLLINATIONS_MODEL, restart server.`, heuristicFollowUps(message)),
        tables: fallback.tables || [],
        meta: { agent: 'pollinations_error', model },
      })
    }
    const data = await handleMessage(message)
    return NextResponse.json({ ...data, answer: appendFollowUps(data.answer, heuristicFollowUps(message)), meta: { agent: 'fallback', model } })
  }
}

export async function GET() {
  const hasKey = Boolean(String(process.env.POLLINATIONS_API_KEY || '').trim())
  const model = String(process.env.POLLINATIONS_MODEL || 'openai-fast').trim() || 'openai-fast'
  return NextResponse.json({
    ok: true,
    message: 'Gunakan method POST dengan body JSON: { "message": "..." }',
    meta: { agent: hasKey ? 'pollinations' : 'fallback', model },
  })
}
