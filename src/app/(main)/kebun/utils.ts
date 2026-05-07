export function formatMonthKey(month: Date) {
  return `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`
}

export function normalizeDateKey(raw: unknown) {
  const value = raw == null ? '' : String(raw).trim()
  if (!value) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  const dateObj = new Date(value)
  if (Number.isNaN(dateObj.getTime())) return null
  const year = dateObj.getUTCFullYear()
  const month = String(dateObj.getUTCMonth() + 1).padStart(2, '0')
  const day = String(dateObj.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function getAbsensiStorageKey(kebunId: number, karyawanId: number, month: Date) {
  return `absensi:v2:${kebunId}:${karyawanId}:${formatMonthKey(month)}`
}

export function parseThousandInt(value: unknown) {
  const raw = value == null ? '' : String(value)
  const normalized = raw.replace(/\./g, '').replace(/,/g, '')
  const num = Number(normalized)
  return Number.isFinite(num) ? num : 0
}
