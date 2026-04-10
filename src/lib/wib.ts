type WibYmd = { y: number; m: number; d: number }

const WIB_OFFSET_HOURS = 7
const WIB_OFFSET_MS = WIB_OFFSET_HOURS * 60 * 60 * 1000

function isValidYmd(ymd: WibYmd) {
  if (!Number.isFinite(ymd.y) || !Number.isFinite(ymd.m) || !Number.isFinite(ymd.d)) return false
  if (ymd.y < 1970 || ymd.y > 2100) return false
  if (ymd.m < 1 || ymd.m > 12) return false
  if (ymd.d < 1 || ymd.d > 31) return false
  return true
}

export function parseWibYmd(input: string | null | undefined): WibYmd | null {
  const value = String(input || '').trim()
  if (!value) return null

  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (m) {
    const ymd = { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) }
    return isValidYmd(ymd) ? ymd : null
  }

  const dt = new Date(value)
  if (Number.isNaN(dt.getTime())) return null

  const wib = new Date(dt.getTime() + WIB_OFFSET_MS)
  const ymd = { y: wib.getUTCFullYear(), m: wib.getUTCMonth() + 1, d: wib.getUTCDate() }
  return isValidYmd(ymd) ? ymd : null
}

export function wibStartUtc(ymd: WibYmd) {
  return new Date(Date.UTC(ymd.y, ymd.m - 1, ymd.d, -WIB_OFFSET_HOURS, 0, 0, 0))
}

export function wibEndExclusiveUtc(ymd: WibYmd) {
  return new Date(Date.UTC(ymd.y, ymd.m - 1, ymd.d + 1, -WIB_OFFSET_HOURS, 0, 0, 0))
}

export function wibEndUtcInclusive(ymd: WibYmd) {
  const endExclusive = wibEndExclusiveUtc(ymd)
  return new Date(endExclusive.getTime() - 1)
}

export function getWibRangeUtcFromParams(
  searchParams: URLSearchParams,
  startKey = 'startDate',
  endKey = 'endDate',
) {
  const startYmd = parseWibYmd(searchParams.get(startKey))
  const endYmd = parseWibYmd(searchParams.get(endKey))
  if (!startYmd || !endYmd) return null

  const startUtc = wibStartUtc(startYmd)
  const endExclusiveUtc = wibEndExclusiveUtc(endYmd)
  if (endExclusiveUtc.getTime() < startUtc.getTime()) {
    const swappedStartUtc = wibStartUtc(endYmd)
    const swappedEndExclusiveUtc = wibEndExclusiveUtc(startYmd)
    return {
      startUtc: swappedStartUtc,
      endExclusiveUtc: swappedEndExclusiveUtc,
      endUtcInclusive: new Date(swappedEndExclusiveUtc.getTime() - 1),
      startYmd: endYmd,
      endYmd: startYmd,
    }
  }

  return {
    startUtc,
    endExclusiveUtc,
    endUtcInclusive: new Date(endExclusiveUtc.getTime() - 1),
    startYmd,
    endYmd,
  }
}

export function parseDateRangeFromSearchParams(
  searchParams: URLSearchParams,
  startKey = 'startDate',
  endKey = 'endDate',
) {
  const range = getWibRangeUtcFromParams(searchParams, startKey, endKey)
  if (!range) return null
  return { start: range.startUtc, end: range.endUtcInclusive }
}

export function getWibMonthRangeUtc(monthParam: string | null | undefined) {
  const raw = String(monthParam || '').trim()
  const m = raw.match(/^(\d{4})-(\d{2})(?:-\d{2})?$/)
  const y = m ? Number(m[1]) : NaN
  const mo = m ? Number(m[2]) : NaN
  if (!Number.isFinite(y) || !Number.isFinite(mo) || y < 1970 || y > 2100 || mo < 1 || mo > 12) return null

  const startYmd = { y, m: mo, d: 1 }
  const endDay = new Date(Date.UTC(y, mo, 0)).getUTCDate()
  const endYmd = { y, m: mo, d: endDay }
  const startUtc = wibStartUtc(startYmd)
  const endExclusiveUtc = wibEndExclusiveUtc(endYmd)
  return {
    startUtc,
    endExclusiveUtc,
    endUtcInclusive: new Date(endExclusiveUtc.getTime() - 1),
    startKey: `${String(y).padStart(4, '0')}-${String(mo).padStart(2, '0')}-01`,
    endKey: `${String(y).padStart(4, '0')}-${String(mo).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`,
    startYmd,
    endYmd,
  }
}
