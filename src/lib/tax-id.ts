export type TaxScheme = 'AUTO' | 'STANDARD' | 'PASAL_31E' | 'UMKM_FINAL'
export type TaxRounding = 'THOUSAND' | 'NONE'

export type PerusahaanTaxSettingShape = {
  scheme: TaxScheme
  standardRate: number
  umkmFinalRate: number
  umkmOmzetThreshold: number
  facilityOmzetThreshold: number
  facilityPortionThreshold: number
  facilityDiscount: number
  rounding: TaxRounding
}

export function defaultPerusahaanTaxSetting(): PerusahaanTaxSettingShape {
  return {
    scheme: 'AUTO',
    standardRate: 0.22,
    umkmFinalRate: 0.005,
    umkmOmzetThreshold: 4_800_000_000,
    facilityOmzetThreshold: 50_000_000_000,
    facilityPortionThreshold: 4_800_000_000,
    facilityDiscount: 0.5,
    rounding: 'THOUSAND',
  }
}

export function roundTaxableIncome(value: number, rounding: TaxRounding) {
  const x = Number(value || 0)
  if (!Number.isFinite(x)) return 0
  if (rounding === 'NONE') return x
  return Math.round(x / 1000) * 1000
}

export function computePphTerutang(params: {
  omzet: number
  taxableIncome: number
  setting: PerusahaanTaxSettingShape
}) {
  const omzet = Math.max(0, Number(params.omzet || 0))
  const taxableIncome = Number(params.taxableIncome || 0)
  const s = params.setting

  const standardRate = Math.max(0, Number(s.standardRate || 0))
  const umkmRate = Math.max(0, Number(s.umkmFinalRate || 0))
  const umkmThreshold = Math.max(0, Number(s.umkmOmzetThreshold || 0))
  const facilityThreshold = Math.max(0, Number(s.facilityOmzetThreshold || 0))
  const portionThreshold = Math.max(0, Number(s.facilityPortionThreshold || 0))
  const discount = Math.max(0, Math.min(1, Number(s.facilityDiscount ?? 0.5)))

  const pickScheme = (): TaxScheme => {
    if (s.scheme !== 'AUTO') return s.scheme
    if (omzet > 0 && omzet <= umkmThreshold) return 'UMKM_FINAL'
    if (omzet > 0 && omzet <= facilityThreshold) return 'PASAL_31E'
    return 'STANDARD'
  }

  const schemeApplied = pickScheme()

  let pph = 0
  if (schemeApplied === 'UMKM_FINAL') {
    pph = omzet * umkmRate
  } else if (schemeApplied === 'PASAL_31E') {
    const ti = Math.max(0, taxableIncome)
    if (omzet <= 0) {
      pph = ti * standardRate
    } else {
      const ratio = Math.min(1, portionThreshold / omzet)
      const effectiveFactor = 1 - discount * ratio
      pph = ti * standardRate * effectiveFactor
    }
  } else {
    pph = Math.max(0, taxableIncome) * standardRate
  }

  if (!Number.isFinite(pph) || pph < 0) pph = 0
  return { schemeApplied, pphTerutang: pph }
}

