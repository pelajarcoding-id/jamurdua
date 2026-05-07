'use client'

import { useState, useCallback, useMemo } from 'react'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { id as idLocale } from 'date-fns/locale'
import { User, Row } from '../types'
import { parseIdThousandInt } from '@/lib/utils'

export function usePayrollKaryawan({
  selectedKebunId,
  rows,
}: {
  selectedKebunId: number | null
  rows: Row[]
}) {
  // Potong map untuk mass payroll
  const [potongMap, setPotongMap] = useState<Record<number, string>>({})
  
  // Mass payroll settings
  const [massNominal, setMassNominal] = useState<string>('')
  const [massPercent, setMassPercent] = useState<string>('')
  const [massDate, setMassDate] = useState<string>('')
  const [massDesc, setMassDesc] = useState<string>('')

  // Calculations
  const potongEffectiveById = useMemo(() => {
    const next: Record<number, number> = {}
    rows.forEach(r => {
      const saldo = Math.max(0, Math.round(r.hutangSaldo || 0))
      const raw = potongMap[r.karyawan.id] || ''
      const num = parseIdThousandInt(raw)
      const eff = saldo <= 0 ? 0 : Math.min(Math.max(0, num), saldo)
      next[r.karyawan.id] = eff
    })
    return next
  }, [rows, potongMap])

  const totalPotong = useMemo(() => {
    return Object.values(potongEffectiveById).reduce((acc, n) => acc + (Number.isFinite(n) ? n : 0), 0)
  }, [potongEffectiveById])

  const totalSisa = useMemo(() => {
    return rows.reduce((acc, r) => {
      const saldo = Math.max(0, Math.round(r.hutangSaldo || 0))
      const potong = potongEffectiveById[r.karyawan.id] || 0
      return acc + Math.max(0, saldo - potong)
    }, 0)
  }, [rows, potongEffectiveById])

  // Apply mass nominal
  const applyMassNominal = useCallback(() => {
    const nominal = parseIdThousandInt(massNominal)
    if (nominal <= 0) return
    const next: Record<number, string> = {}
    rows.forEach(r => {
      const saldo = Math.max(0, Math.round(r.hutangSaldo || 0))
      if (saldo > 0) {
        next[r.karyawan.id] = String(Math.min(nominal, saldo))
      }
    })
    setPotongMap(next)
  }, [rows, massNominal])

  // Apply mass percent
  const applyMassPercent = useCallback(() => {
    const percent = parseFloat(massPercent) || 0
    if (percent <= 0 || percent > 100) return
    const next: Record<number, string> = {}
    rows.forEach(r => {
      const saldo = Math.max(0, Math.round(r.hutangSaldo || 0))
      if (saldo > 0) {
        const amount = Math.round(saldo * (percent / 100))
        next[r.karyawan.id] = String(amount)
      }
    })
    setPotongMap(next)
  }, [rows, massPercent])

  // Clear all
  const clearAll = useCallback(() => {
    setPotongMap({})
    setMassNominal('')
    setMassPercent('')
  }, [])

  // Export PDF
  const exportPayrollPdf = useCallback(async (endDate: string) => {
    try {
      const jsPDF = (await import('jspdf')).default
      const autoTable = (await import('jspdf-autotable')).default
      const doc = new jsPDF()
      doc.setFontSize(14)
      doc.text('DAFTAR POTONGAN HUTANG KARYAWAN', 14, 18)
      doc.setFontSize(10)
      const periodText = `Periode: ${format(new Date(endDate || new Date()), 'MMMM yyyy', { locale: idLocale })}`
      doc.text(periodText, 14, 26)

      const body = rows.map((r, idx) => {
        const raw = potongMap[r.karyawan.id] || ''
        const potong = parseIdThousandInt(raw)
        const saldo = Math.round(r.hutangSaldo) || 0
        const sisa = Math.max(0, saldo - potong)
        return [
          String(idx + 1),
          r.karyawan.name,
          `Rp ${saldo.toLocaleString('id-ID')}`,
          `Rp ${potong.toLocaleString('id-ID')}`,
          `Rp ${sisa.toLocaleString('id-ID')}`,
        ]
      })

      autoTable(doc, {
        head: [['NO', 'NAMA', 'SALDO', 'POTONG', 'SISA']],
        body,
        startY: 32,
        theme: 'grid',
        headStyles: { fillColor: [37, 99, 235], textColor: [255, 255, 255], fontStyle: 'bold' },
        styles: { fontSize: 10 },
      })

      const finalY = (doc as any).lastAutoTable?.finalY || 32
      doc.setFontSize(12)
      doc.text(
        `JUMLAH      RP. ${totalPotong.toLocaleString('id-ID')}          RP. ${totalSisa.toLocaleString('id-ID')}`,
        14,
        finalY + 10
      )

      doc.save(`Daftar-Hutang-Periode-${format(new Date(), 'yyyyMMdd')}.pdf`)
    } catch {
      toast.error('Gagal export PDF')
    }
  }, [rows, potongMap, totalPotong, totalSisa])

  // Export CSV
  const exportPayrollCsv = useCallback((endDate: string) => {
    try {
      const headers = ['NO', 'NAMA', 'TANGGAL', 'SALDO', 'POTONG', 'SISA', 'KETERANGAN']
      const rowsCsv = rows.map((r, idx) => {
        const raw = potongMap[r.karyawan.id] || ''
        const potong = parseIdThousandInt(raw)
        const saldo = Math.round(r.hutangSaldo) || 0
        const sisa = Math.max(0, saldo - potong)
        const tanggal = format(new Date(endDate || new Date()), 'dd-MMM-yy', { locale: idLocale })
        return [
          String(idx + 1),
          r.karyawan.name,
          tanggal,
          `RP. ${saldo.toLocaleString('id-ID')}`,
          `RP. ${potong.toLocaleString('id-ID')}`,
          `RP. ${sisa.toLocaleString('id-ID')}`,
          '',
        ]
      })
      const csvLines = [
        headers.join(','),
        ...rowsCsv.map(cols =>
          cols.map(val => {
            const s = String(val)
            const needsQuote = s.includes(',') || s.includes('"') || s.includes('\n')
            const escaped = s.replace(/"/g, '""')
            return needsQuote ? `"${escaped}"` : escaped
          }).join(',')
        ),
      ]
      const csvContent = csvLines.join('\n')
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Daftar-Hutang-Periode-${format(new Date(), 'yyyyMMdd')}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error('Gagal export CSV')
    }
  }, [rows, potongMap])

  // Process payroll
  const processPayroll = useCallback(async (payrollDate: string) => {
    if (!payrollDate) {
      toast.error('Tanggal payroll harus diisi')
      return false
    }
    const items = rows
      .filter(r => potongEffectiveById[r.karyawan.id] > 0)
      .map(r => ({
        karyawanId: r.karyawan.id,
        jumlah: potongEffectiveById[r.karyawan.id],
        deskripsi: massDesc || 'Potongan hutang dari payroll',
        tanggal: massDate || payrollDate,
      }))
    if (items.length === 0) {
      toast.error('Tidak ada potongan untuk diproses')
      return false
    }
    try {
      const res = await fetch('/api/karyawan/potongan-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kebunId: selectedKebunId ?? 0,
          items,
        }),
      })
      if (!res.ok) throw new Error('Failed')
      toast.success(`Berhasil memproses ${items.length} potongan`)
      setPotongMap({})
      return true
    } catch {
      toast.error('Gagal memproses payroll')
      return false
    }
  }, [rows, potongEffectiveById, selectedKebunId, massDesc, massDate])

  return {
    // State
    potongMap,
    setPotongMap,
    massNominal,
    setMassNominal,
    massPercent,
    setMassPercent,
    massDate,
    setMassDate,
    massDesc,
    setMassDesc,

    // Computed
    potongEffectiveById,
    totalPotong,
    totalSisa,

    // Actions
    applyMassNominal,
    applyMassPercent,
    clearAll,
    exportPayrollPdf,
    exportPayrollCsv,
    processPayroll,
  }
}
