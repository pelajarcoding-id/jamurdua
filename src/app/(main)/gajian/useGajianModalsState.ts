import { useState } from 'react'

export function useGajianModalsState() {
  const [isConfirmOpen, setIsConfirmOpen] = useState(false)
  const [selectedGajianId, setSelectedGajianId] = useState<number | null>(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [selectedGajian, setSelectedGajian] = useState<any | null>(null)

  const [isDraftConfirmOpen, setIsDraftConfirmOpen] = useState(false)
  const [selectedDraftId, setSelectedDraftId] = useState<number | null>(null)
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false)

  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [previewGajian, setPreviewGajian] = useState<any | null>(null)

  const [openPotongHutangMassal, setOpenPotongHutangMassal] = useState(false)
  const [massPotongMax, setMassPotongMax] = useState(true)
  const [massPotongAmount, setMassPotongAmount] = useState('')

  const [openTambahHutang, setOpenTambahHutang] = useState(false)
  const [tambahHutangKaryawanId, setTambahHutangKaryawanId] = useState<string>('')
  const [tambahHutangJumlah, setTambahHutangJumlah] = useState(0)
  const [tambahHutangTanggal, setTambahHutangTanggal] = useState('')
  const [tambahHutangDeskripsi, setTambahHutangDeskripsi] = useState('Hutang Karyawan')
  const [tambahHutangSubmitting, setTambahHutangSubmitting] = useState(false)

  return {
    isConfirmOpen,
    setIsConfirmOpen,
    selectedGajianId,
    setSelectedGajianId,
    isDetailOpen,
    setIsDetailOpen,
    selectedGajian,
    setSelectedGajian,
    isDraftConfirmOpen,
    setIsDraftConfirmOpen,
    selectedDraftId,
    setSelectedDraftId,
    isResetConfirmOpen,
    setIsResetConfirmOpen,
    isPreviewOpen,
    setIsPreviewOpen,
    previewGajian,
    setPreviewGajian,
    openPotongHutangMassal,
    setOpenPotongHutangMassal,
    massPotongMax,
    setMassPotongMax,
    massPotongAmount,
    setMassPotongAmount,
    openTambahHutang,
    setOpenTambahHutang,
    tambahHutangKaryawanId,
    setTambahHutangKaryawanId,
    tambahHutangJumlah,
    setTambahHutangJumlah,
    tambahHutangTanggal,
    setTambahHutangTanggal,
    tambahHutangDeskripsi,
    setTambahHutangDeskripsi,
    tambahHutangSubmitting,
    setTambahHutangSubmitting,
  }
}

