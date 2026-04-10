export type AssetTaxGroup =
  | 'KEL1'
  | 'KEL2'
  | 'KEL3'
  | 'KEL4'
  | 'BANGUNAN_PERMANEN'
  | 'BANGUNAN_NON_PERMANEN'

export type DepreciationMethod = 'GARIS_LURUS'

export const ASSET_GROUPS: Array<{
  value: AssetTaxGroup
  label: string
  usefulLifeYears: number
  straightLineRatePerYear: number
}> = [
  { value: 'KEL1', label: 'Kelompok 1 (4 th, 25%)', usefulLifeYears: 4, straightLineRatePerYear: 0.25 },
  { value: 'KEL2', label: 'Kelompok 2 (8 th, 12,5%)', usefulLifeYears: 8, straightLineRatePerYear: 0.125 },
  { value: 'KEL3', label: 'Kelompok 3 (16 th, 6,25%)', usefulLifeYears: 16, straightLineRatePerYear: 0.0625 },
  { value: 'KEL4', label: 'Kelompok 4 (20 th, 5%)', usefulLifeYears: 20, straightLineRatePerYear: 0.05 },
  { value: 'BANGUNAN_PERMANEN', label: 'Bangunan Permanen (20 th, 5%)', usefulLifeYears: 20, straightLineRatePerYear: 0.05 },
  { value: 'BANGUNAN_NON_PERMANEN', label: 'Bangunan Non Permanen (10 th, 10%)', usefulLifeYears: 10, straightLineRatePerYear: 0.1 },
]

export const getAssetGroupInfo = (group: string) => {
  return ASSET_GROUPS.find(g => g.value === group) || null
}

const monthIndex = (d: Date) => d.getFullYear() * 12 + d.getMonth()

export const computeStraightLineDepreciation = (params: {
  cost: number
  salvage?: number | null
  acquiredAt: Date
  group: string
  periodStart?: Date | null
  periodEnd: Date
  disposedAt?: Date | null
}) => {
  const groupInfo = getAssetGroupInfo(params.group)
  const salvage = Math.max(0, Number(params.salvage || 0))
  const cost = Math.max(0, Number(params.cost || 0))
  const base = Math.max(0, cost - salvage)
  if (!groupInfo || base === 0) {
    return {
      usefulLifeYears: groupInfo?.usefulLifeYears || 0,
      monthly: 0,
      accumulated: 0,
      expenseInPeriod: 0,
      bookValue: cost,
    }
  }

  const totalMonths = groupInfo.usefulLifeYears * 12
  const monthly = (base * groupInfo.straightLineRatePerYear) / 12

  const endDate = params.disposedAt && params.disposedAt < params.periodEnd ? params.disposedAt : params.periodEnd
  const startIdx = monthIndex(params.acquiredAt)
  const asOfIdx = monthIndex(endDate)
  const usedMonths = Math.max(0, Math.min(totalMonths, asOfIdx - startIdx + 1))
  const accumulated = Math.min(base, monthly * usedMonths)

  const periodStart = params.periodStart || new Date(endDate.getFullYear(), 0, 1)
  const pStartIdx = monthIndex(periodStart)
  const pEndIdx = asOfIdx
  const assetEndIdx = startIdx + totalMonths - 1
  const overlapStart = Math.max(startIdx, pStartIdx)
  const overlapEnd = Math.min(assetEndIdx, pEndIdx)
  const overlapMonths = Math.max(0, overlapEnd - overlapStart + 1)
  const expenseInPeriod = Math.min(base, monthly * overlapMonths)

  return {
    usefulLifeYears: groupInfo.usefulLifeYears,
    monthly,
    accumulated,
    expenseInPeriod,
    bookValue: Math.max(0, cost - accumulated),
  }
}

export const computeStraightLineYearlySchedule = (params: {
  cost: number
  salvage?: number | null
  acquiredAt: Date
  group: string
  throughYear?: number | null
  disposedAt?: Date | null
}) => {
  const groupInfo = getAssetGroupInfo(params.group)
  const salvage = Math.max(0, Number(params.salvage || 0))
  const cost = Math.max(0, Number(params.cost || 0))
  const base = Math.max(0, cost - salvage)

  if (!groupInfo || base === 0) {
    return {
      usefulLifeYears: groupInfo?.usefulLifeYears || 0,
      monthly: 0,
      rows: [] as Array<{ year: number; months: number; expense: number; accumulatedEnd: number; bookValueEnd: number }>,
    }
  }

  const totalMonths = groupInfo.usefulLifeYears * 12
  const monthly = (base * groupInfo.straightLineRatePerYear) / 12

  const startIdx = monthIndex(params.acquiredAt)
  const assetEndIdx = startIdx + totalMonths - 1
  const disposedIdx = params.disposedAt ? monthIndex(params.disposedAt) : null
  const effectiveEndIdx = disposedIdx !== null ? Math.min(assetEndIdx, disposedIdx) : assetEndIdx
  const startYear = params.acquiredAt.getFullYear()
  const endYear = Math.floor(effectiveEndIdx / 12)
  const maxYear = params.throughYear ? Math.min(endYear, params.throughYear) : endYear

  const rows: Array<{ year: number; months: number; expense: number; accumulatedEnd: number; bookValueEnd: number }> = []
  for (let year = startYear; year <= maxYear; year += 1) {
    const yearStartIdx = year * 12
    const yearEndIdx = year * 12 + 11

    const overlapStart = Math.max(startIdx, yearStartIdx)
    const overlapEnd = Math.min(effectiveEndIdx, yearEndIdx)
    const months = Math.max(0, overlapEnd - overlapStart + 1)
    if (months === 0) continue

    const expense = Math.min(base, monthly * months)
    const usedMonthsToYearEnd = Math.max(0, Math.min(totalMonths, overlapEnd - startIdx + 1))
    const accumulatedEnd = Math.min(base, monthly * usedMonthsToYearEnd)
    const bookValueEnd = Math.max(0, cost - accumulatedEnd)
    rows.push({ year, months, expense, accumulatedEnd, bookValueEnd })
  }

  return { usefulLifeYears: groupInfo.usefulLifeYears, monthly, rows }
}
