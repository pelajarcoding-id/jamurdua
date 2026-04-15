'use client'

import { Dialog, DialogContent, DialogFooter, DialogTitle } from '@/components/ui/dialog'
import { ConfirmationModal } from './modal'
import { DetailGajianModal } from './detail-modal'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { BanknotesIcon, CheckIcon, TrashIcon, XMarkIcon } from '@heroicons/react/24/outline'

export default function GajianPageModals(props: {
  isConfirmOpen: boolean
  handleCloseConfirm: () => void
  handleDelete: () => void

  isDraftConfirmOpen: boolean
  handleCloseDraftDeleteConfirm: () => void
  handleDeleteDraft: () => void

  isResetConfirmOpen: boolean
  setIsResetConfirmOpen: (open: boolean) => void
  handleConfirmReset: () => void

  openPotongHutangMassal: boolean
  setOpenPotongHutangMassal: (open: boolean) => void
  massPotongMax: boolean
  setMassPotongMax: (v: boolean) => void
  massPotongAmount: string
  setMassPotongAmount: (v: string) => void
  hutangLoading: boolean
  applyPotongHutangMassal: (args: { mode: 'MAX' | 'NOMINAL'; amount: number }) => Promise<void>
  formatNumber: (n: number) => string

  openTambahHutang: boolean
  setOpenTambahHutang: (open: boolean) => void
  tambahHutangKaryawanId: string
  setTambahHutangKaryawanId: (v: string) => void
  tambahHutangJumlah: number
  setTambahHutangJumlah: (n: number) => void
  tambahHutangTanggal: string
  setTambahHutangTanggal: (v: string) => void
  tambahHutangDeskripsi: string
  setTambahHutangDeskripsi: (v: string) => void
  tambahHutangSubmitting: boolean
  handleSubmitTambahHutang: () => Promise<void>
  hutangTambahanMap: Record<number, { jumlah: number; date: string; deskripsi: string }>
  setHutangTambahanMap: (updater: any) => void
  detailKaryawan: any[]

  isDetailOpen: boolean
  isPreviewOpen: boolean
  setIsPreviewOpen: (open: boolean) => void
  selectedGajian: any | null
  previewGajian: any | null
  handleCloseDetail: () => void
  handleConfirmSave: (payload: { dibuatOlehName: string; disetujuiOlehName: string }) => Promise<void> | void
  loading: boolean
  handleApplyHistoryFilters: () => void
}) {
  const {
    isConfirmOpen,
    handleCloseConfirm,
    handleDelete,
    isDraftConfirmOpen,
    handleCloseDraftDeleteConfirm,
    handleDeleteDraft,
    isResetConfirmOpen,
    setIsResetConfirmOpen,
    handleConfirmReset,
    openPotongHutangMassal,
    setOpenPotongHutangMassal,
    massPotongMax,
    setMassPotongMax,
    massPotongAmount,
    setMassPotongAmount,
    hutangLoading,
    applyPotongHutangMassal,
    formatNumber,
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
    handleSubmitTambahHutang,
    hutangTambahanMap,
    setHutangTambahanMap,
    detailKaryawan,
    isDetailOpen,
    isPreviewOpen,
    setIsPreviewOpen,
    selectedGajian,
    previewGajian,
    handleCloseDetail,
    handleConfirmSave,
    loading,
    handleApplyHistoryFilters,
  } = props

  const gajianForModal = isPreviewOpen ? previewGajian : selectedGajian

  return (
    <>
      <ConfirmationModal
        isOpen={isConfirmOpen}
        onClose={handleCloseConfirm}
        onConfirm={handleDelete}
        title="Konfirmasi Hapus Gajian"
        description="Apakah Anda yakin ingin menghapus gajian ini? Tindakan ini tidak dapat dibatalkan."
      />

      <ConfirmationModal
        isOpen={isDraftConfirmOpen}
        onClose={handleCloseDraftDeleteConfirm}
        onConfirm={handleDeleteDraft}
        title="Konfirmasi Hapus Draft"
        description="Apakah Anda yakin ingin menghapus draft gajian ini?"
      />

      <ConfirmationModal
        isOpen={isResetConfirmOpen}
        onClose={() => setIsResetConfirmOpen(false)}
        onConfirm={handleConfirmReset}
        title="Konfirmasi Reset"
        description="Mengatur ulang form akan menghapus data yang belum disimpan. Lanjutkan?"
      />

      <Dialog open={openPotongHutangMassal} onOpenChange={setOpenPotongHutangMassal}>
        <DialogContent className="bg-white p-0 overflow-hidden [&>button.absolute]:hidden sm:max-w-[520px]">
          <div className="px-6 py-4 bg-gradient-to-r from-emerald-600 to-emerald-500 text-white">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center">
                  <BanknotesIcon className="h-5 w-5 text-white" />
                </div>
                <DialogTitle className="text-white">Potong Hutang Massal</DialogTitle>
              </div>
              <button
                type="button"
                onClick={() => setOpenPotongHutangMassal(false)}
                className="h-9 w-9 rounded-md border border-white/70 bg-white text-emerald-600 flex items-center justify-center hover:bg-white/90"
                aria-label="Tutup"
              >
                <XMarkIcon className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="px-6 py-5 space-y-4">
            <div className="flex items-start gap-3">
              <Checkbox checked={massPotongMax} onCheckedChange={(v) => setMassPotongMax(Boolean(v))} />
              <div className="min-w-0">
                <div className="text-sm font-semibold text-gray-900">Potong maksimal</div>
                <div className="text-xs text-gray-500">Potongan = saldo hutang (gaji boleh minus).</div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Nominal Potongan per Karyawan (Rp)</Label>
              <Input
                disabled={massPotongMax}
                value={massPotongAmount ? formatNumber(Number(String(massPotongAmount).replace(/\D/g, '')) || 0) : ''}
                onChange={(e) => setMassPotongAmount(e.target.value.replace(/\D/g, ''))}
                placeholder="Contoh: 100000"
                className="rounded-xl text-right"
                inputMode="numeric"
              />
              <div className="text-xs text-gray-500">Jika potong maksimal aktif, nominal ini diabaikan.</div>
            </div>
          </div>

          <DialogFooter className="bg-gray-50 border-t px-6 py-4 flex flex-col-reverse sm:flex-row gap-3 sm:gap-2 sm:justify-between">
            <Button variant="outline" onClick={() => setOpenPotongHutangMassal(false)} className="rounded-full" disabled={hutangLoading}>
              <XMarkIcon className="h-4 w-4 mr-2" />
              Batal
            </Button>
            <Button
              onClick={async () => {
                const amount = Number(String(massPotongAmount || '').replace(/\D/g, '')) || 0
                await applyPotongHutangMassal({ mode: massPotongMax ? 'MAX' : 'NOMINAL', amount })
                setOpenPotongHutangMassal(false)
              }}
              className="rounded-full bg-emerald-600 hover:bg-emerald-700"
              disabled={hutangLoading || (!massPotongMax && (Number(String(massPotongAmount || '').replace(/\D/g, '')) || 0) <= 0)}
            >
              <CheckIcon className="h-4 w-4 mr-2" />
              Terapkan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={openTambahHutang} onOpenChange={setOpenTambahHutang}>
        <DialogContent className="bg-white p-0 overflow-hidden [&>button.absolute]:hidden sm:max-w-[520px]">
          <div className="px-6 py-4 bg-gradient-to-r from-emerald-600 to-emerald-500 text-white">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center">
                  <BanknotesIcon className="h-5 w-5 text-white" />
                </div>
                <DialogTitle className="text-white">Tambah Hutang Karyawan</DialogTitle>
              </div>
              <button
                type="button"
                onClick={() => setOpenTambahHutang(false)}
                className="h-9 w-9 rounded-md border border-white/70 bg-white text-emerald-700 flex items-center justify-center hover:bg-white/90"
                aria-label="Tutup"
              >
                <XMarkIcon className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="px-6 py-5 space-y-4">
            <div className="space-y-2">
              <Label>Karyawan</Label>
              <Select value={tambahHutangKaryawanId} onValueChange={setTambahHutangKaryawanId}>
                <SelectTrigger className="input-style rounded-xl">
                  <SelectValue placeholder="Pilih karyawan" />
                </SelectTrigger>
                <SelectContent>
                  {detailKaryawan.map((dk: any) => (
                    <SelectItem key={dk.userId} value={String(dk.userId)}>
                      {dk.user?.name || '-'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Jumlah Hutang (Rp)</Label>
              <Input
                type="text"
                inputMode="numeric"
                placeholder="0"
                value={formatNumber(tambahHutangJumlah || 0)}
                onChange={(e) => setTambahHutangJumlah(Number(e.target.value.replace(/\D/g, '')) || 0)}
                className="rounded-xl text-right"
              />
            </div>

            <div className="space-y-2">
              <Label>Tanggal</Label>
              <Input type="date" value={tambahHutangTanggal} onChange={(e) => setTambahHutangTanggal(e.target.value)} className="rounded-xl" />
            </div>

            <div className="space-y-2">
              <Label>Keterangan</Label>
              <Input value={tambahHutangDeskripsi} onChange={(e) => setTambahHutangDeskripsi(e.target.value)} placeholder="Hutang Karyawan" className="rounded-xl" />
            </div>
          </div>

          <DialogFooter className="bg-gray-50 border-t px-6 py-4 flex flex-col-reverse sm:flex-row gap-3 sm:gap-2 sm:justify-between">
            <Button variant="outline" onClick={() => setOpenTambahHutang(false)} className="rounded-full" disabled={tambahHutangSubmitting}>
              <XMarkIcon className="h-4 w-4 mr-2" />
              Batal
            </Button>
            {Number(tambahHutangKaryawanId) > 0 && Boolean(hutangTambahanMap[Number(tambahHutangKaryawanId)]) && (
              <Button
                variant="outline"
                onClick={() => {
                  const idNum = Number(tambahHutangKaryawanId)
                  setHutangTambahanMap((prev: any) => {
                    const next = { ...prev }
                    delete (next as any)[idNum]
                    return next
                  })
                  setOpenTambahHutang(false)
                }}
                className="rounded-full text-red-600 border-red-200 hover:bg-red-50"
                disabled={tambahHutangSubmitting}
              >
                <TrashIcon className="h-4 w-4 mr-2" />
                Hapus
              </Button>
            )}
            <Button
              onClick={handleSubmitTambahHutang}
              className="rounded-full bg-emerald-600 hover:bg-emerald-700"
              disabled={tambahHutangSubmitting || !tambahHutangKaryawanId || (tambahHutangJumlah || 0) <= 0}
            >
              <CheckIcon className="h-4 w-4 mr-2" />
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {(gajianForModal || isPreviewOpen) && (
        <DetailGajianModal
          isOpen={isDetailOpen || isPreviewOpen}
          onClose={isPreviewOpen ? () => setIsPreviewOpen(false) : handleCloseDetail}
          gajian={gajianForModal}
          isPreview={isPreviewOpen}
          onConfirm={handleConfirmSave}
          isLoading={loading}
          onRevert={handleApplyHistoryFilters}
        />
      )}
    </>
  )
}
