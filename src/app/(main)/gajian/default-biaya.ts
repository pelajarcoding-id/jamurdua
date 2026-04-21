export type GajianBiayaLain = {
  id: string
  deskripsi: string
  kategori?: string | null
  jumlah: number
  satuan: string
  hargaSatuan: number
  total?: number
  keterangan?: string
  isAutoKg?: boolean
}

export type KebunDefaultBiayaRow = {
  id?: number | string
  deskripsi?: string | null
  satuan?: string | null
  hargaSatuan?: number | null
  isAutoKg?: boolean | null
  kategori?: string | null
}

const normalize = (v: any) => String(v || '').trim().toLowerCase()

export function upsertDefaultBiaya(params: {
  prev: GajianBiayaLain[]
  kebunId: string
  kebunDefaultBiaya: KebunDefaultBiayaRow[]
  totalBeratAll: number
}) {
  const next = [...params.prev]

  for (const db of params.kebunDefaultBiaya) {
    const dbId = String(db?.id ?? '').trim()
    const dbDesc = String(db?.deskripsi || '').trim()
    const dbSatuan = String(db?.satuan || 'Kg').trim() || 'Kg'
    const dbHarga = Number(db?.hargaSatuan || 0)
    const isAutoKg = !!db?.isAutoKg
    const dbKategori = typeof db?.kategori === 'string' ? db.kategori.trim() : ''
    if (!dbDesc) continue

    const stableId = `default-${params.kebunId}-${dbId || normalize(dbDesc)}`
    const existingIdx = next.findIndex((b) => {
      const bid = String((b as any)?.id || '')
      if (bid === stableId) return true
      return (
        normalize((b as any)?.deskripsi) === normalize(dbDesc) &&
        String((b as any)?.satuan || 'Kg').trim() === dbSatuan &&
        Number((b as any)?.hargaSatuan || 0) === dbHarga
      )
    })

    if (!isAutoKg) {
      if (existingIdx === -1) {
        next.push({
          id: stableId,
          deskripsi: dbDesc,
          kategori: dbKategori || null,
          jumlah: 0,
          satuan: dbSatuan,
          hargaSatuan: dbHarga,
          total: 0,
          isAutoKg: false,
        })
      } else {
        const existing: any = next[existingIdx]
        next[existingIdx] = {
          ...existing,
          kategori: dbKategori || existing?.kategori || null,
        }
      }
      continue
    }

    const desiredJumlah = params.totalBeratAll
    const desiredTotal = Math.round(params.totalBeratAll * dbHarga)

    if (existingIdx === -1) {
      next.push({
        id: stableId,
        deskripsi: dbDesc,
        kategori: dbKategori || null,
        jumlah: desiredJumlah,
        satuan: dbSatuan,
        hargaSatuan: dbHarga,
        total: desiredTotal,
        isAutoKg: true,
        keterangan: '',
      })
      continue
    }

    const existing: any = next[existingIdx]
    next[existingIdx] = {
      ...existing,
      id: stableId,
      deskripsi: dbDesc,
      kategori: dbKategori || existing?.kategori || null,
      satuan: dbSatuan,
      hargaSatuan: dbHarga,
      jumlah: desiredJumlah,
      total: desiredTotal,
      isAutoKg: true,
    }
  }

  return next
}
