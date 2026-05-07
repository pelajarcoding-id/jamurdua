'use client'

import { useState, useEffect } from 'react'
import { Kendaraan } from '../types'

export function useKendaraan() {
  const [kendaraanList, setKendaraanList] = useState<Kendaraan[]>([])
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    const fetchKendaraan = async () => {
      setIsLoading(true)
      try {
        const res = await fetch('/api/kendaraan/list', { cache: 'no-store' })
        if (!res.ok) {
          setKendaraanList([])
          return
        }
        const data = await res.json()
        const list = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : []
        const filtered: Kendaraan[] = list
          .map((k: any) => ({
            platNomor: String(k?.platNomor || ''),
            merk: String(k?.merk || ''),
            jenis: String(k?.jenis || ''),
          }))
          .filter((k: Kendaraan) => k.platNomor && ['Mobil Truck', 'Mobil Langsir', 'Alat Berat'].includes(k.jenis))
          .sort((a: Kendaraan, b: Kendaraan) => {
            const rank = (x: Kendaraan) => (x.jenis === 'Alat Berat' ? 0 : 1)
            const r = rank(a) - rank(b)
            if (r !== 0) return r
            return a.platNomor.localeCompare(b.platNomor)
          })
        setKendaraanList(filtered)
      } catch {
        setKendaraanList([])
      } finally {
        setIsLoading(false)
      }
    }
    fetchKendaraan()
  }, [])

  return { list: kendaraanList, isLoading }
}
