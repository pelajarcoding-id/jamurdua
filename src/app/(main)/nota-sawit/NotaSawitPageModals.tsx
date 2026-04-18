import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { ConfirmationModal } from '@/components/ui/confirmation-modal'
import { ModalHeader, ModalContentWrapper, ModalFooter } from '@/components/ui/modal-elements'
import ImageUpload from '@/components/ui/ImageUpload'
import { cn } from '@/lib/utils'
import ModalUbah from './modal'
import ModalDetail from './detail-modal'
import { UbahStatusModal } from './ubah-status-modal'
import type { NotaSawitData } from './columns'
import {
  ArrowDownTrayIcon,
  ClipboardDocumentListIcon,
  DocumentTextIcon,
  PencilSquareIcon,
  PhotoIcon,
  TrashIcon,
} from '@heroicons/react/24/outline'
import type { ReactNode } from 'react'

type Pabrik = { id: number; name: string }

export default function NotaSawitPageModals(props: {
  selectedNota: NotaSawitData | null
  isModalOpen: boolean
  handleCloseModal: () => void
  handleSave: (data: any, file?: File) => void
  isConfirmOpen: boolean
  handleCloseConfirm: () => void
  handleDelete: () => void
  isBulkDeleteConfirmOpen: boolean
  setIsBulkDeleteConfirmOpen: (open: boolean) => void
  handleBulkDelete: () => void
  bulkSelectionCount: number
  isDetailModalOpen: boolean
  handleCloseDetailModal: () => void
  handleEditFromDetail: (nota: NotaSawitData) => void
  handleDeleteFromDetail: (nota: NotaSawitData) => void
  isUbahStatusModalOpen: boolean
  handleCloseUbahStatusModal: () => void
  handleSaveStatus: (id: number, status: 'LUNAS' | 'BELUM_LUNAS') => Promise<void>
  isBulkHargaOpen: boolean
  setIsBulkHargaOpen: (open: boolean) => void
  bulkHargaValue: string
  setBulkHargaValue: (v: string) => void
  bulkHargaSubmitting: boolean
  handleBulkUpdateHarga: () => void
  isBulkReconcileOpen: boolean
  setIsBulkReconcileOpen: (open: boolean) => void
  reconcileSubmitting: boolean
  reconcilePabrikId: string
  setReconcilePabrikId: (v: string) => void
  pabrikList: Pabrik[]
  reconcileTanggal: string
  setReconcileTanggal: (v: string) => void
  reconcileJumlahMasuk: string
  setReconcileJumlahMasuk: (v: string) => void
  reconcileNotas: any[]
  reconcileNotaIds: number[]
  handleReconcileToggleNota: (nota: any, checked: boolean) => void
  reconcileRangeStart: string
  setReconcileRangeStart: (v: string) => void
  reconcileRangeEnd: string
  setReconcileRangeEnd: (v: string) => void
  reconcileRangeLoading: boolean
  reconcileRangeCandidates: any[]
  handleReconcileFetchByRange: () => void
  handleReconcileAddAllCandidates: () => void
  reconcileSetLunas: boolean
  setReconcileSetLunas: (v: boolean) => void
  reconcileKeterangan: string
  setReconcileKeterangan: (v: string) => void
  reconcileGambarPreview: string | null
  setReconcileGambarFile: (f: File | null) => void
  setReconcileGambarPreview: (url: string | null) => void
  handleBulkReconcileSubmit: () => void
  formatNumber: (v: any) => string
  formatCurrency: (v: number) => string
  isReconcileDetailOpen: boolean
  setIsReconcileDetailOpen: (open: boolean) => void
  reconcileDetail: any | null
  setReconcileDetail: (d: any | null) => void
  handleExportPembayaranBatchPdf: () => void
  handleOpenEditReconcileBatch: (detail: any) => void
  handleOpenDeleteReconcileBatch: (batchId: number) => void
  isBuktiTransferOpen: boolean
  setIsBuktiTransferOpen: (open: boolean) => void
  buktiTransferUrl: string | null
  setBuktiTransferUrl: (url: string | null) => void
  isReconcileEditOpen: boolean
  setIsReconcileEditOpen: (open: boolean) => void
  reconcileEditSubmitting: boolean
  reconcileEditingBatchId: number | null
  reconcileEditPabrikId: string
  setReconcileEditTanggal: (v: string) => void
  reconcileEditTanggal: string
  reconcileEditJumlahMasuk: string
  setReconcileEditJumlahMasuk: (v: string) => void
  reconcileEditNotas: any[]
  reconcileEditNotaIds: number[]
  handleReconcileEditToggleNota: (nota: any, checked: boolean) => void
  reconcileEditRangeStart: string
  setReconcileEditRangeStart: (v: string) => void
  reconcileEditRangeEnd: string
  setReconcileEditRangeEnd: (v: string) => void
  reconcileEditRangeLoading: boolean
  reconcileEditRangeCandidates: any[]
  handleReconcileEditFetchByRange: () => void
  handleReconcileEditAddAllCandidates: () => void
  reconcileEditSetLunas: boolean
  setReconcileEditSetLunas: (v: boolean) => void
  reconcileEditKeterangan: string
  setReconcileEditKeterangan: (v: string) => void
  reconcileEditGambarPreview: string | null
  setReconcileEditGambarFile: (f: File | null) => void
  setReconcileEditGambarPreview: (url: string | null) => void
  setReconcileEditGambarExistingUrl: (url: string | null) => void
  handleSubmitEditReconcileBatch: () => void
  isReconcileDeleteConfirmOpen: boolean
  setIsReconcileDeleteConfirmOpen: (open: boolean) => void
  reconcileDeleteSubmitting: boolean
  reconcileDeletingBatchId: number | null
  handleConfirmDeleteReconcileBatch: () => void
  duplicateWarningOpen: boolean
  setDuplicateWarningOpen: (open: boolean) => void
  submittingDuplicateProceed: boolean
  duplicateCandidates: any[]
  setDuplicateCandidates: (rows: any[]) => void
  pendingDuplicatePayload: any | null
  setPendingDuplicatePayload: (p: any | null) => void
  handleViewDuplicateNota: (id: number) => void
  handleProceedDuplicateCreate: () => void
  viewImageUrl: string | null
  setViewImageUrl: (url: string | null) => void
  viewImageError: boolean
  setViewImageError: (v: boolean) => void
  reconcileHeaderIcon?: ReactNode
  bulkHargaHeaderIcon?: ReactNode
  duplicateHeaderIcon?: ReactNode
}) {
  const {
    selectedNota,
    isModalOpen,
    handleCloseModal,
    handleSave,
    isConfirmOpen,
    handleCloseConfirm,
    handleDelete,
    isBulkDeleteConfirmOpen,
    setIsBulkDeleteConfirmOpen,
    handleBulkDelete,
    bulkSelectionCount,
    isDetailModalOpen,
    handleCloseDetailModal,
    handleEditFromDetail,
    handleDeleteFromDetail,
    isUbahStatusModalOpen,
    handleCloseUbahStatusModal,
    handleSaveStatus,
    isBulkHargaOpen,
    setIsBulkHargaOpen,
    bulkHargaValue,
    setBulkHargaValue,
    bulkHargaSubmitting,
    handleBulkUpdateHarga,
    isBulkReconcileOpen,
    setIsBulkReconcileOpen,
    reconcileSubmitting,
    reconcilePabrikId,
    setReconcilePabrikId,
    pabrikList,
    reconcileTanggal,
    setReconcileTanggal,
    reconcileJumlahMasuk,
    setReconcileJumlahMasuk,
    reconcileNotas,
    reconcileNotaIds,
    handleReconcileToggleNota,
    reconcileRangeStart,
    setReconcileRangeStart,
    reconcileRangeEnd,
    setReconcileRangeEnd,
    reconcileRangeLoading,
    reconcileRangeCandidates,
    handleReconcileFetchByRange,
    handleReconcileAddAllCandidates,
    reconcileSetLunas,
    setReconcileSetLunas,
    reconcileKeterangan,
    setReconcileKeterangan,
    reconcileGambarPreview,
    setReconcileGambarFile,
    setReconcileGambarPreview,
    handleBulkReconcileSubmit,
    formatNumber,
    formatCurrency,
    isReconcileDetailOpen,
    setIsReconcileDetailOpen,
    reconcileDetail,
    setReconcileDetail,
    handleExportPembayaranBatchPdf,
    handleOpenEditReconcileBatch,
    handleOpenDeleteReconcileBatch,
    isBuktiTransferOpen,
    setIsBuktiTransferOpen,
    buktiTransferUrl,
    setBuktiTransferUrl,
    isReconcileEditOpen,
    setIsReconcileEditOpen,
    reconcileEditSubmitting,
    reconcileEditingBatchId,
    reconcileEditPabrikId,
    setReconcileEditTanggal,
    reconcileEditTanggal,
    reconcileEditJumlahMasuk,
    setReconcileEditJumlahMasuk,
    reconcileEditNotas,
    reconcileEditNotaIds,
    handleReconcileEditToggleNota,
    reconcileEditRangeStart,
    setReconcileEditRangeStart,
    reconcileEditRangeEnd,
    setReconcileEditRangeEnd,
    reconcileEditRangeLoading,
    reconcileEditRangeCandidates,
    handleReconcileEditFetchByRange,
    handleReconcileEditAddAllCandidates,
    reconcileEditSetLunas,
    setReconcileEditSetLunas,
    reconcileEditKeterangan,
    setReconcileEditKeterangan,
    reconcileEditGambarPreview,
    setReconcileEditGambarFile,
    setReconcileEditGambarPreview,
    setReconcileEditGambarExistingUrl,
    handleSubmitEditReconcileBatch,
    isReconcileDeleteConfirmOpen,
    setIsReconcileDeleteConfirmOpen,
    reconcileDeleteSubmitting,
    reconcileDeletingBatchId,
    handleConfirmDeleteReconcileBatch,
    duplicateWarningOpen,
    setDuplicateWarningOpen,
    submittingDuplicateProceed,
    duplicateCandidates,
    setDuplicateCandidates,
    pendingDuplicatePayload,
    setPendingDuplicatePayload,
    handleViewDuplicateNota,
    handleProceedDuplicateCreate,
    viewImageUrl,
    setViewImageUrl,
    viewImageError,
    setViewImageError,
    reconcileHeaderIcon,
    bulkHargaHeaderIcon,
    duplicateHeaderIcon,
  } = props

  return (
    <>
      {isModalOpen && (
        <ModalUbah
          nota={selectedNota}
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          onSave={handleSave}
        />
      )}

      <ConfirmationModal
        isOpen={isConfirmOpen}
        onClose={handleCloseConfirm}
        onConfirm={handleDelete}
        title="Konfirmasi Hapus"
        description="Apakah Anda yakin ingin menghapus data ini?"
        variant="emerald"
      />

      <ConfirmationModal
        isOpen={isBulkDeleteConfirmOpen}
        onClose={() => setIsBulkDeleteConfirmOpen(false)}
        onConfirm={handleBulkDelete}
        title="Konfirmasi Hapus Massal"
        description={`Apakah Anda yakin ingin menghapus ${bulkSelectionCount} nota yang dipilih? Aksi ini tidak dapat dibatalkan.`}
        variant="emerald"
      />

      {isDetailModalOpen && selectedNota && (
        <ModalDetail
          nota={selectedNota}
          onClose={handleCloseDetailModal}
          onEdit={handleEditFromDetail}
          onDelete={handleDeleteFromDetail}
        />
      )}

      <UbahStatusModal
        isOpen={isUbahStatusModalOpen}
        onClose={handleCloseUbahStatusModal}
        nota={selectedNota}
        onSave={handleSaveStatus}
      />

      {isBulkHargaOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center">
          <div className="bg-white w-[92vw] sm:w-full sm:max-w-[520px] max-h-[92vh] rounded-2xl overflow-hidden shadow-xl p-0 flex flex-col">
            <ModalHeader
              title="Update Harga Massal"
              subtitle={`Set harga per kg untuk ${bulkSelectionCount} nota yang dipilih.`}
              variant="emerald"
              icon={bulkHargaHeaderIcon || <ClipboardDocumentListIcon className="h-5 w-5 text-white" />}
              onClose={() => {
                if (!bulkHargaSubmitting) setIsBulkHargaOpen(false)
              }}
            />
            <ModalContentWrapper className="flex-1 min-h-0 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700">Harga / Kg</Label>
                  <Input
                    inputMode="numeric"
                    value={bulkHargaValue}
                    onChange={(e) => setBulkHargaValue(e.target.value)}
                    placeholder="contoh: 2000"
                    className="rounded-xl"
                    disabled={bulkHargaSubmitting}
                  />
                  <div className="text-xs text-gray-500">
                    Catatan: jika ada nota yang sudah LUNAS, nilai pemasukan kas & jurnal akan disesuaikan otomatis.
                  </div>
                </div>
              </div>
            </ModalContentWrapper>
            <ModalFooter className="sm:justify-end">
              <Button
                variant="outline"
                className="rounded-full"
                onClick={() => setIsBulkHargaOpen(false)}
                disabled={bulkHargaSubmitting}
              >
                Batal
              </Button>
              <Button className="rounded-full" onClick={handleBulkUpdateHarga} disabled={bulkHargaSubmitting}>
                {bulkHargaSubmitting ? 'Menyimpan...' : 'Simpan'}
              </Button>
            </ModalFooter>
          </div>
        </div>
      )}

      <Dialog
        open={isBulkReconcileOpen}
        onOpenChange={(open) => {
          if (!open && !reconcileSubmitting) setIsBulkReconcileOpen(false)
        }}
      >
        <DialogContent className="w-[92vw] sm:w-full sm:max-w-[640px] max-h-[92vh] p-0 overflow-hidden rounded-2xl shadow-2xl border-none flex flex-col gap-0 [&>button.absolute]:hidden">
          <ModalHeader
            title="Rekonsiliasi Pembayaran"
            subtitle={`Atur pembayaran aktual untuk ${reconcileNotaIds.length} nota.`}
            variant="emerald"
            icon={reconcileHeaderIcon || <ClipboardDocumentListIcon className="h-5 w-5 text-white" />}
            onClose={() => {
              if (!reconcileSubmitting) setIsBulkReconcileOpen(false)
            }}
          />
          <ModalContentWrapper className="flex-1 min-h-0 overflow-y-auto px-4 py-4 sm:px-6 sm:py-6 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">Pabrik</Label>
                <select
                  className="w-full input-style rounded-xl border-gray-200 h-10"
                  value={reconcilePabrikId}
                  onChange={(e) => setReconcilePabrikId(e.target.value)}
                  disabled={reconcileSubmitting || reconcileNotaIds.length > 0}
                >
                  <option value="">Pilih Pabrik</option>
                  {pabrikList.map((pabrik) => (
                    <option key={pabrik.id} value={String(pabrik.id)}>
                      {pabrik.name}
                    </option>
                  ))}
                </select>
                {reconcileNotaIds.length > 0 ? (
                  <div className="text-xs text-gray-500">
                    Pabrik dikunci karena sudah ada nota terpilih. Kosongkan pilihan nota jika ingin ganti pabrik.
                  </div>
                ) : null}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700">Tanggal Dibayar/Ditransfer</Label>
                  <Input
                    type="date"
                    value={reconcileTanggal}
                    onChange={(e) => setReconcileTanggal(e.target.value)}
                    className="rounded-xl"
                    disabled={reconcileSubmitting}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700">Nominal Ditransfer (Rp)</Label>
                  <Input
                    inputMode="numeric"
                    value={reconcileJumlahMasuk ? formatNumber(Math.round(Number(reconcileJumlahMasuk) || 0)) : ''}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/\D/g, '')
                      setReconcileJumlahMasuk(digits)
                    }}
                    placeholder="contoh: 12500000"
                    className="rounded-xl"
                    disabled={reconcileSubmitting}
                  />
                </div>
              </div>

              <div className="rounded-2xl border border-gray-100 bg-white p-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-gray-900">Nota Dipilih</div>
                  <div className="text-xs text-gray-500">
                    Jumlah: <span className="font-semibold text-gray-900">{formatNumber(reconcileNotas.length)}</span>
                  </div>
                </div>
                {reconcileNotas.length === 0 ? (
                  <div className="text-xs text-gray-500">Belum ada nota dipilih.</div>
                ) : (
                  <div className="max-h-52 overflow-y-auto rounded-xl border border-gray-100">
                    <div className="divide-y divide-gray-100">
                      {reconcileNotas.map((n: any) => {
                        const id = Number(n?.id)
                        const tagihan = Math.round(Number(n?.pembayaranSetelahPph ?? n?.totalPembayaran ?? 0) || 0)
                        const kebunName = n?.kebun?.name || n?.timbangan?.kebun?.name || '-'
                        const dateText = n?.tanggalBongkar ? new Date(n.tanggalBongkar).toLocaleDateString('id-ID') : '-'
                        const beratAkhir = Math.round(Number(n?.beratAkhir || 0) || 0)
                        const beratText = beratAkhir > 0 ? `${formatNumber(beratAkhir)} Kg` : '-'
                        const hargaPerKg = Math.round(Number(n?.hargaPerKg || 0) || 0)
                        const hargaText = hargaPerKg > 0 ? `${formatCurrency(hargaPerKg)}/Kg` : '-'
                        const checked = reconcileNotaIds.includes(id)
                        return (
                          <div key={String(id)} className="flex items-center gap-3 px-3 py-2 bg-white">
                            <Checkbox checked={checked} onCheckedChange={(v) => handleReconcileToggleNota(n, !!v)} disabled={reconcileSubmitting} />
                            <div className="min-w-0 flex-1">
                              <div className="text-sm font-semibold text-gray-900">Nota #{id}</div>
                              <div className="text-xs text-gray-500 truncate">
                                {kebunName} • {dateText} • {beratText} • {hargaText}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-xs text-gray-500">Tagihan Net</div>
                              <div className="text-sm font-extrabold text-gray-900">{formatCurrency(tagihan)}</div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-gray-100 bg-white p-4 space-y-3">
                <div className="text-sm font-semibold text-gray-900">Tambah Nota dari Rentang Tanggal</div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold uppercase text-gray-500">Dari</Label>
                    <Input
                      type="date"
                      value={reconcileRangeStart}
                      onChange={(e) => setReconcileRangeStart(e.target.value)}
                      className="rounded-xl h-10 bg-white"
                      disabled={reconcileSubmitting || reconcileRangeLoading}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold uppercase text-gray-500">Sampai</Label>
                    <Input
                      type="date"
                      value={reconcileRangeEnd}
                      onChange={(e) => setReconcileRangeEnd(e.target.value)}
                      className="rounded-xl h-10 bg-white"
                      disabled={reconcileSubmitting || reconcileRangeLoading}
                    />
                  </div>
                  <div className="flex items-end">
                    <Button
                      className="rounded-full w-full"
                      variant="outline"
                      onClick={handleReconcileFetchByRange}
                      disabled={reconcileSubmitting || reconcileRangeLoading}
                    >
                      {reconcileRangeLoading ? 'Memuat...' : 'Cari Nota'}
                    </Button>
                  </div>
                </div>

                {reconcileRangeCandidates.length > 0 ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-xs text-gray-500">
                        Ditemukan <span className="font-semibold text-gray-900">{reconcileRangeCandidates.length.toLocaleString('id-ID')}</span> nota (filter: BELUM LUNAS)
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          className="rounded-full bg-emerald-600 hover:bg-emerald-700 text-white"
                          onClick={handleReconcileAddAllCandidates}
                          disabled={reconcileSubmitting}
                        >
                          Tambah Semua
                        </Button>
                      </div>
                    </div>

                    <div className="max-h-52 overflow-y-auto rounded-xl border border-gray-100">
                      <div className="divide-y divide-gray-100">
                        {reconcileRangeCandidates.map((n: any) => {
                          const id = Number(n?.id)
                          const tagihan = Math.round(Number(n?.pembayaranSetelahPph ?? n?.totalPembayaran ?? 0) || 0)
                          const beratAkhir = Math.round(Number(n?.beratAkhir || 0) || 0)
                          const beratText = beratAkhir > 0 ? `${formatNumber(beratAkhir)} Kg` : '-'
                          const hargaPerKg = Math.round(Number(n?.hargaPerKg || 0) || 0)
                          const hargaText = hargaPerKg > 0 ? `${formatCurrency(hargaPerKg)}/Kg` : '-'
                          const checked = reconcileNotaIds.includes(id)
                          return (
                            <div key={String(id)} className="flex items-center gap-3 px-3 py-2 bg-white">
                              <Checkbox checked={checked} onCheckedChange={(v) => handleReconcileToggleNota(n, !!v)} disabled={reconcileSubmitting} />
                              <div className="min-w-0 flex-1">
                                <div className="text-sm font-semibold text-gray-900">Nota #{id}</div>
                                <div className="text-xs text-gray-500 truncate">
                                  {n?.tanggalBongkar ? new Date(n.tanggalBongkar).toLocaleDateString('id-ID') : '-'} • {n?.kendaraanPlatNomor || '-'} • {n?.supir?.name || '-'} • {beratText} • {hargaText}
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-xs text-gray-500">Tagihan Net</div>
                                <div className="text-sm font-extrabold text-gray-900">{formatCurrency(tagihan)}</div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-gray-500">
                    Pilih rentang tanggal bongkar, lalu klik “Cari Nota” untuk menambahkan nota ke rekonsiliasi.
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Checkbox checked={reconcileSetLunas} onCheckedChange={(v) => setReconcileSetLunas(!!v)} disabled={reconcileSubmitting} />
                <div className="text-sm text-gray-700">Set status pembayaran menjadi LUNAS</div>
              </div>

              <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                {(() => {
                  const parseMoney = (v: string) => Math.round(Number(String(v || '').replace(/[^\d.-]/g, '')) || 0)
                  const jumlahMasuk = parseMoney(reconcileJumlahMasuk)
                  const tagihan = reconcileNotas.reduce((sum, n: any) => sum + Math.round(Number(n?.pembayaranSetelahPph ?? n?.totalPembayaran ?? 0) || 0), 0)
                  const totalAktual = Math.max(0, jumlahMasuk)
                  const selisih = Math.round(Number(totalAktual - tagihan) || 0)
                  return (
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                        <div>
                          <div className="text-gray-500">Total Tagihan (Net)</div>
                          <div className="font-extrabold text-gray-900">{formatCurrency(tagihan)}</div>
                          <div className="text-xs text-gray-600 mt-0.5">
                            Jumlah Nota: <span className="font-semibold text-gray-900">{reconcileNotas.length.toLocaleString('id-ID')}</span>
                          </div>
                        </div>
                        <div>
                          <div className="text-gray-500">Total Aktual (Jumlah Ditransfer)</div>
                          <div className="font-extrabold text-gray-900">{formatCurrency(totalAktual)}</div>
                        </div>
                        <div>
                          <div className="text-gray-500">Selisih</div>
                          <div
                            className={cn(
                              'font-extrabold',
                              selisih === 0 ? 'text-emerald-700' : selisih > 0 ? 'text-emerald-700' : 'text-rose-700',
                            )}
                          >
                            {formatCurrency(selisih)}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })()}
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">Keterangan (opsional)</Label>
                <Input
                  value={reconcileKeterangan}
                  onChange={(e) => setReconcileKeterangan(e.target.value)}
                  placeholder="contoh: Transfer gabungan"
                  className="rounded-xl"
                  disabled={reconcileSubmitting}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">Bukti Transfer (opsional)</Label>
                <ImageUpload
                  previewUrl={reconcileGambarPreview}
                  onFileChange={(file) => {
                    setReconcileGambarFile(file)
                    setReconcileGambarPreview(file ? URL.createObjectURL(file) : null)
                  }}
                />
              </div>
            </div>
          </ModalContentWrapper>
          <ModalFooter className="sm:justify-end">
            <Button
              variant="outline"
              className="rounded-full"
              onClick={() => setIsBulkReconcileOpen(false)}
              disabled={reconcileSubmitting}
            >
              Batal
            </Button>
            <Button
              className="rounded-full bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={handleBulkReconcileSubmit}
              disabled={reconcileSubmitting}
            >
              {reconcileSubmitting ? 'Menyimpan...' : 'Simpan'}
            </Button>
          </ModalFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isReconcileDetailOpen}
        onOpenChange={(open) => {
          if (!open) {
            setIsReconcileDetailOpen(false)
            setReconcileDetail(null)
          }
        }}
      >
        <DialogContent className="w-[92vw] sm:w-full sm:max-w-3xl max-h-[92vh] p-0 overflow-hidden rounded-2xl shadow-2xl border-none flex flex-col gap-0 [&>button.absolute]:hidden">
          <ModalHeader
            title="Detail Pembayaran Nota Sawit"
            subtitle={reconcileDetail?.id ? `Batch #${reconcileDetail.id}` : 'Detail batch'}
            variant="emerald"
            icon={<ClipboardDocumentListIcon className="h-5 w-5 text-white" />}
            onClose={() => {
              setIsReconcileDetailOpen(false)
              setReconcileDetail(null)
            }}
          />
          <ModalContentWrapper className="flex-1 min-h-0 overflow-y-auto px-4 py-4 sm:px-6 sm:py-6">
            {!reconcileDetail ? (
              <div className="text-sm text-gray-500">Tidak ada data batch.</div>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-extrabold text-gray-900">Batch #{reconcileDetail.id}</div>
                    <div className="text-xs text-gray-500">
                      Ditransfer tanggal:{' '}
                      <span className="font-semibold text-gray-900">
                        {reconcileDetail?.tanggal
                          ? new Date(reconcileDetail.tanggal).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })
                          : '-'}
                      </span>
                    </div>
                    <div className="text-sm font-semibold text-gray-700">
                      <span className="font-extrabold text-gray-900">{reconcileDetail?.pabrikSawit?.name || '-'}</span> •{' '}
                      <span className="font-extrabold text-gray-900">{formatNumber(Number(reconcileDetail?.count || 0))}</span> nota
                    </div>
                    <div className="mt-1 text-xs text-gray-600">
                      <span className="font-semibold text-gray-700">Keterangan:</span>{' '}
                      <span className="text-gray-700">{reconcileDetail?.keterangan ? String(reconcileDetail.keterangan) : '-'}</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
                  <div className="rounded-xl bg-gray-50 px-3 py-2 border border-gray-100">
                    <div className="text-gray-500 font-semibold">Jumlah Dibayar/Ditransfer</div>
                    <div className="text-lg font-extrabold text-gray-900 tabular-nums">{formatCurrency(Number(reconcileDetail?.jumlahMasuk || 0))}</div>
                  </div>
                  <div className="rounded-xl bg-gray-50 px-3 py-2 border border-gray-100">
                    <div className="text-gray-500 font-semibold">Jumlah Sesuai Nota Sawit</div>
                    <div className="text-lg font-extrabold text-gray-900 tabular-nums">{formatCurrency(Number(reconcileDetail?.totalTagihan || 0))}</div>
                  </div>
                  <div className="rounded-xl bg-gray-50 px-3 py-2 border border-gray-100">
                    <div className="text-gray-500 font-semibold">Selisih Pembayaran</div>
                    <div
                      className={cn(
                        'text-lg font-extrabold tabular-nums',
                        Number(reconcileDetail?.selisih || 0) === 0
                          ? 'text-emerald-700'
                          : Number(reconcileDetail?.selisih || 0) > 0
                            ? 'text-emerald-700'
                            : 'text-rose-700',
                      )}
                    >
                      {formatCurrency(Number(reconcileDetail?.selisih || 0))}
                    </div>
                  </div>
                </div>

                {Array.isArray(reconcileDetail?.items) && reconcileDetail.items.length > 0 ? (
                  <div className="rounded-xl border border-gray-100 overflow-hidden bg-white">
                    <div className="px-3 py-2 text-[11px] font-semibold text-gray-500 bg-gray-50 border-b border-gray-100">
                      NOTA DIBAYAR
                    </div>
                    <div className="divide-y divide-gray-100">
                      {(reconcileDetail.items as any[])
                        .slice()
                        .sort((a: any, b: any) => {
                          const da = a?.nota?.tanggalBongkar ? new Date(a.nota.tanggalBongkar).getTime() : 0
                          const db = b?.nota?.tanggalBongkar ? new Date(b.nota.tanggalBongkar).getTime() : 0
                          return da - db
                        })
                        .slice(0, 20)
                        .map((i: any) => {
                        const nota = i?.nota
                        const kebunName = nota?.kebun?.name || '-'
                        const dateText = nota?.tanggalBongkar
                          ? new Date(nota.tanggalBongkar).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })
                          : '-'
                        const plat = nota?.kendaraanPlatNomor || '-'
                        const supir = nota?.supir?.name || '-'
                        const beratAkhir = Math.round(Number(nota?.beratAkhir || 0) || 0)
                        const beratText = beratAkhir > 0 ? `${formatNumber(beratAkhir)} Kg` : '-'
                        const hargaPerKg = Math.round(Number(nota?.hargaPerKg || 0) || 0)
                        const hargaText = hargaPerKg > 0 ? `${formatCurrency(hargaPerKg)}/Kg` : '-'
                        const amount = Math.round(Number(i?.tagihanNet || 0))
                        return (
                          <div key={String(i?.notaSawitId)} className="px-3 py-2 text-xs text-gray-700">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0 text-gray-900 font-semibold truncate">
                                Nota {kebunName} tanggal {dateText}
                              </div>
                              <div className="shrink-0 text-right text-gray-900 tabular-nums font-extrabold">
                                {formatCurrency(amount)}
                              </div>
                            </div>
                            <div className="mt-0.5 text-[11px] text-gray-500 flex items-center gap-2 flex-nowrap overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                              <span className="whitespace-nowrap shrink-0">
                                Berat akhir: <span className="font-semibold text-gray-800">{beratText}</span>
                              </span>
                              <span className="text-gray-300 shrink-0">•</span>
                              <span className="whitespace-nowrap shrink-0">
                                Harga: <span className="font-semibold text-gray-800">{hargaText}</span>
                              </span>
                              <span className="text-gray-300 shrink-0">•</span>
                              <span className="whitespace-nowrap shrink-0">Plat: <span className="font-semibold text-gray-800">{plat}</span></span>
                              <span className="text-gray-300 shrink-0">•</span>
                              <span className="whitespace-nowrap shrink-0">
                                Supir: <span className="font-semibold text-gray-800">{supir}</span>
                              </span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                    <div className="px-3 py-2 text-xs bg-gray-50 border-t border-gray-100 flex items-center justify-between">
                      <div className="text-gray-500">Total Jumlah</div>
                      <div className="font-extrabold text-gray-900 tabular-nums">
                        {formatCurrency(
                          (reconcileDetail.items as any[]).reduce((sum: number, i: any) => sum + Math.round(Number(i?.tagihanNet || 0)), 0),
                        )}
                      </div>
                    </div>
                    {reconcileDetail.items.length > 20 ? (
                      <div className="px-3 py-2 text-xs text-gray-500 bg-gray-50 border-t border-gray-100">
                        +{formatNumber(reconcileDetail.items.length - 20)} nota lainnya
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {reconcileDetail?.gambarUrl ? (
                  <div className="space-y-2">
                    <div className="text-xs font-semibold uppercase text-gray-500">Bukti Transfer</div>
                    <button
                      type="button"
                      onClick={() => {
                        setBuktiTransferUrl(String(reconcileDetail.gambarUrl))
                        setIsBuktiTransferOpen(true)
                      }}
                      className="block w-full text-left rounded-2xl border border-gray-100 overflow-hidden bg-white hover:bg-gray-50/50 transition-colors"
                    >
                      <img src={String(reconcileDetail.gambarUrl)} alt="Bukti Transfer" className="w-full max-h-[60vh] object-contain bg-white" />
                    </button>
                  </div>
                ) : null}
              </div>
            )}
          </ModalContentWrapper>
          <ModalFooter className="sm:justify-end">
            <Button variant="outline" className="rounded-full" onClick={handleExportPembayaranBatchPdf} disabled={!reconcileDetail?.id}>
              <ArrowDownTrayIcon className="w-4 h-4 mr-2" />
              Ekspor PDF
            </Button>
            <Button variant="outline" className="rounded-full" onClick={() => reconcileDetail && handleOpenEditReconcileBatch(reconcileDetail)} disabled={!reconcileDetail}>
              <PencilSquareIcon className="w-4 h-4 mr-2" />
              Edit
            </Button>
            <Button variant="destructive" className="rounded-full" onClick={() => handleOpenDeleteReconcileBatch(Number(reconcileDetail?.id))} disabled={!reconcileDetail?.id}>
              <TrashIcon className="w-4 h-4 mr-2" />
              Hapus
            </Button>
            <Button
              variant="outline"
              className="rounded-full"
              onClick={() => {
                setIsReconcileDetailOpen(false)
                setReconcileDetail(null)
              }}
            >
              Tutup
            </Button>
          </ModalFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isBuktiTransferOpen}
        onOpenChange={(open) => {
          if (!open) {
            setIsBuktiTransferOpen(false)
            setBuktiTransferUrl(null)
          }
        }}
      >
        <DialogContent className="w-[92vw] sm:w-full sm:max-w-4xl max-h-[92vh] p-0 overflow-hidden rounded-2xl shadow-2xl border-none flex flex-col gap-0 [&>button.absolute]:hidden">
          <ModalHeader
            title="Bukti Transfer"
            subtitle={reconcileDetail?.id ? `Batch #${reconcileDetail.id}` : 'Bukti transfer'}
            variant="emerald"
            icon={<PhotoIcon className="h-5 w-5 text-white" />}
            onClose={() => {
              setIsBuktiTransferOpen(false)
              setBuktiTransferUrl(null)
            }}
          />
          <ModalContentWrapper className="flex-1 min-h-0 overflow-y-auto px-4 py-4 sm:px-6 sm:py-6">
            {buktiTransferUrl ? (
              <div className="rounded-2xl border border-gray-100 bg-white overflow-hidden">
                <img src={buktiTransferUrl} alt="Bukti Transfer" className="w-full max-h-[70vh] object-contain bg-white" />
              </div>
            ) : (
              <div className="text-sm text-gray-500">Tidak ada gambar.</div>
            )}
          </ModalContentWrapper>
          <ModalFooter className="sm:justify-end">
            <Button
              variant="outline"
              className="rounded-full"
              onClick={() => {
                if (!buktiTransferUrl) return
                const link = document.createElement('a')
                link.href = buktiTransferUrl
                link.target = '_blank'
                link.rel = 'noreferrer'
                link.download = `bukti-transfer-batch-${reconcileDetail?.id || 'unknown'}`
                document.body.appendChild(link)
                link.click()
                document.body.removeChild(link)
              }}
              disabled={!buktiTransferUrl}
            >
              <ArrowDownTrayIcon className="w-4 h-4 mr-2" />
              Download
            </Button>
            <Button
              variant="outline"
              className="rounded-full"
              onClick={() => {
                setIsBuktiTransferOpen(false)
                setBuktiTransferUrl(null)
              }}
            >
              Tutup
            </Button>
          </ModalFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isReconcileEditOpen}
        onOpenChange={(open) => {
          if (!open && !reconcileEditSubmitting) setIsReconcileEditOpen(false)
        }}
      >
        <DialogContent className="w-[92vw] sm:w-full sm:max-w-[640px] max-h-[92vh] p-0 overflow-hidden rounded-2xl shadow-2xl border-none flex flex-col gap-0 [&>button.absolute]:hidden">
          <ModalHeader
            title="Edit Pembayaran Nota Sawit"
            subtitle={reconcileEditingBatchId ? `Batch #${reconcileEditingBatchId}` : 'Edit pembayaran'}
            variant="emerald"
            icon={<PencilSquareIcon className="h-5 w-5 text-white" />}
            onClose={() => {
              if (!reconcileEditSubmitting) setIsReconcileEditOpen(false)
            }}
          />
          <ModalContentWrapper className="flex-1 min-h-0 overflow-y-auto px-4 py-4 sm:px-6 sm:py-6 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">Pabrik</Label>
                <select className="w-full input-style rounded-xl border-gray-200 h-10" value={reconcileEditPabrikId} disabled>
                  <option value="">Pilih Pabrik</option>
                  {pabrikList.map((pabrik) => (
                    <option key={pabrik.id} value={String(pabrik.id)}>
                      {pabrik.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700">Tanggal Dibayar/Ditransfer</Label>
                  <Input
                    type="date"
                    value={reconcileEditTanggal}
                    onChange={(e) => setReconcileEditTanggal(e.target.value)}
                    className="rounded-xl"
                    disabled={reconcileEditSubmitting}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700">Nominal Ditransfer (Rp)</Label>
                  <Input
                    inputMode="numeric"
                    value={reconcileEditJumlahMasuk ? formatNumber(Math.round(Number(reconcileEditJumlahMasuk) || 0)) : ''}
                    onChange={(e) => setReconcileEditJumlahMasuk(e.target.value.replace(/\D/g, ''))}
                    placeholder="contoh: 12500000"
                    className="rounded-xl"
                    disabled={reconcileEditSubmitting}
                  />
                </div>
              </div>

              <div className="rounded-2xl border border-gray-100 bg-white p-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-gray-900">Nota Dipilih</div>
                  <div className="text-xs text-gray-500">
                    Jumlah: <span className="font-semibold text-gray-900">{formatNumber(reconcileEditNotas.length)}</span>
                  </div>
                </div>
                {reconcileEditNotas.length === 0 ? (
                  <div className="text-xs text-gray-500">Belum ada nota dipilih.</div>
                ) : (
                  <div className="max-h-52 overflow-y-auto rounded-xl border border-gray-100">
                    <div className="divide-y divide-gray-100">
                      {reconcileEditNotas.map((n: any) => {
                        const id = Number(n?.id)
                        const tagihan = Math.round(Number(n?.tagihanNet ?? n?.pembayaranSetelahPph ?? n?.totalPembayaran ?? 0) || 0)
                        const kebunName = n?.kebun?.name || n?.timbangan?.kebun?.name || '-'
                        const dateText = n?.tanggalBongkar ? new Date(n.tanggalBongkar).toLocaleDateString('id-ID') : '-'
                        const beratAkhir = Math.round(Number(n?.beratAkhir || 0) || 0)
                        const beratText = beratAkhir > 0 ? `${formatNumber(beratAkhir)} Kg` : '-'
                        const hargaPerKg = Math.round(Number(n?.hargaPerKg || 0) || 0)
                        const hargaText = hargaPerKg > 0 ? `${formatCurrency(hargaPerKg)}/Kg` : '-'
                        const checked = reconcileEditNotaIds.includes(id)
                        return (
                          <div key={String(id)} className="flex items-center gap-3 px-3 py-2 bg-white">
                            <Checkbox checked={checked} onCheckedChange={(v) => handleReconcileEditToggleNota(n, !!v)} disabled={reconcileEditSubmitting} />
                            <div className="min-w-0 flex-1">
                              <div className="text-sm font-semibold text-gray-900">Nota #{id}</div>
                              <div className="text-xs text-gray-500 truncate">
                                {kebunName} • {dateText} • {beratText} • {hargaText}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-xs text-gray-500">Tagihan Net</div>
                              <div className="text-sm font-extrabold text-gray-900">{formatCurrency(tagihan)}</div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-gray-100 bg-white p-4 space-y-3">
                <div className="text-sm font-semibold text-gray-900">Tambah Nota dari Rentang Tanggal</div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold uppercase text-gray-500">Dari</Label>
                    <Input
                      type="date"
                      value={reconcileEditRangeStart}
                      onChange={(e) => setReconcileEditRangeStart(e.target.value)}
                      className="rounded-xl h-10 bg-white"
                      disabled={reconcileEditSubmitting || reconcileEditRangeLoading}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold uppercase text-gray-500">Sampai</Label>
                    <Input
                      type="date"
                      value={reconcileEditRangeEnd}
                      onChange={(e) => setReconcileEditRangeEnd(e.target.value)}
                      className="rounded-xl h-10 bg-white"
                      disabled={reconcileEditSubmitting || reconcileEditRangeLoading}
                    />
                  </div>
                  <div className="flex items-end">
                    <Button
                      className="rounded-full w-full"
                      variant="outline"
                      onClick={handleReconcileEditFetchByRange}
                      disabled={reconcileEditSubmitting || reconcileEditRangeLoading}
                    >
                      {reconcileEditRangeLoading ? 'Memuat...' : 'Cari Nota'}
                    </Button>
                  </div>
                </div>

                {reconcileEditRangeCandidates.length > 0 ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-xs text-gray-500">
                        Ditemukan <span className="font-semibold text-gray-900">{reconcileEditRangeCandidates.length.toLocaleString('id-ID')}</span> nota (filter: BELUM LUNAS)
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          className="rounded-full bg-emerald-600 hover:bg-emerald-700 text-white"
                          onClick={handleReconcileEditAddAllCandidates}
                          disabled={reconcileEditSubmitting}
                        >
                          Tambah Semua
                        </Button>
                      </div>
                    </div>

                    <div className="max-h-52 overflow-y-auto rounded-xl border border-gray-100">
                      <div className="divide-y divide-gray-100">
                        {reconcileEditRangeCandidates.map((n: any) => {
                          const id = Number(n?.id)
                          const tagihan = Math.round(Number(n?.pembayaranSetelahPph ?? n?.totalPembayaran ?? 0) || 0)
                          const beratAkhir = Math.round(Number(n?.beratAkhir || 0) || 0)
                          const beratText = beratAkhir > 0 ? `${formatNumber(beratAkhir)} Kg` : '-'
                          const hargaPerKg = Math.round(Number(n?.hargaPerKg || 0) || 0)
                          const hargaText = hargaPerKg > 0 ? `${formatCurrency(hargaPerKg)}/Kg` : '-'
                          const checked = reconcileEditNotaIds.includes(id)
                          return (
                            <div key={String(id)} className="flex items-center gap-3 px-3 py-2 bg-white">
                              <Checkbox checked={checked} onCheckedChange={(v) => handleReconcileEditToggleNota(n, !!v)} disabled={reconcileEditSubmitting} />
                              <div className="min-w-0 flex-1">
                                <div className="text-sm font-semibold text-gray-900">Nota #{id}</div>
                                <div className="text-xs text-gray-500 truncate">
                                  {n?.tanggalBongkar ? new Date(n.tanggalBongkar).toLocaleDateString('id-ID') : '-'} • {n?.kendaraanPlatNomor || '-'} • {n?.supir?.name || '-'} • {beratText} • {hargaText}
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-xs text-gray-500">Tagihan Net</div>
                                <div className="text-sm font-extrabold text-gray-900">{formatCurrency(tagihan)}</div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-gray-500">
                    Pilih rentang tanggal bongkar, lalu klik “Cari Nota” untuk menambahkan nota ke pembayaran.
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Checkbox checked={reconcileEditSetLunas} onCheckedChange={(v) => setReconcileEditSetLunas(!!v)} disabled={reconcileEditSubmitting} />
                <div className="text-sm text-gray-700">Set status pembayaran menjadi LUNAS</div>
              </div>

              <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                {(() => {
                  const parseMoney = (v: string) => Math.round(Number(String(v || '').replace(/[^\d.-]/g, '')) || 0)
                  const jumlahMasuk = parseMoney(reconcileEditJumlahMasuk)
                  const tagihan = reconcileEditNotas.reduce((sum: number, n: any) => sum + Math.round(Number(n?.tagihanNet ?? n?.pembayaranSetelahPph ?? n?.totalPembayaran ?? 0) || 0), 0)
                  const totalAktual = Math.max(0, jumlahMasuk)
                  const selisih = Math.round(Number(totalAktual - tagihan) || 0)
                  return (
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                        <div>
                          <div className="text-gray-500">Total Tagihan (Net)</div>
                          <div className="font-extrabold text-gray-900">{formatCurrency(tagihan)}</div>
                          <div className="text-xs text-gray-600 mt-0.5">
                            Jumlah Nota: <span className="font-semibold text-gray-900">{reconcileEditNotas.length.toLocaleString('id-ID')}</span>
                          </div>
                        </div>
                        <div>
                          <div className="text-gray-500">Total Aktual (Jumlah Ditransfer)</div>
                          <div className="font-extrabold text-gray-900">{formatCurrency(totalAktual)}</div>
                        </div>
                        <div>
                          <div className="text-gray-500">Selisih</div>
                          <div
                            className={cn(
                              'font-extrabold',
                              selisih === 0 ? 'text-emerald-700' : selisih > 0 ? 'text-emerald-700' : 'text-rose-700',
                            )}
                          >
                            {formatCurrency(selisih)}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })()}
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">Keterangan (opsional)</Label>
                <Input
                  value={reconcileEditKeterangan}
                  onChange={(e) => setReconcileEditKeterangan(e.target.value)}
                  placeholder="contoh: Transfer gabungan"
                  className="rounded-xl"
                  disabled={reconcileEditSubmitting}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">Bukti Transfer (opsional)</Label>
                <ImageUpload
                  previewUrl={reconcileEditGambarPreview}
                  onFileChange={(file) => {
                    setReconcileEditGambarFile(file)
                    if (file) {
                      const url = URL.createObjectURL(file)
                      setReconcileEditGambarPreview(url)
                      setReconcileEditGambarExistingUrl(null)
                    } else {
                      setReconcileEditGambarPreview(null)
                      setReconcileEditGambarExistingUrl(null)
                    }
                  }}
                />
              </div>
            </div>
          </ModalContentWrapper>
          <ModalFooter className="sm:justify-end">
            <Button variant="outline" className="rounded-full" onClick={() => setIsReconcileEditOpen(false)} disabled={reconcileEditSubmitting}>
              Batal
            </Button>
            <Button className="rounded-full bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleSubmitEditReconcileBatch} disabled={reconcileEditSubmitting || reconcileEditNotaIds.length === 0}>
              {reconcileEditSubmitting ? 'Menyimpan...' : 'Simpan'}
            </Button>
          </ModalFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isReconcileDeleteConfirmOpen}
        onOpenChange={(open) => {
          if (!open && !reconcileDeleteSubmitting) setIsReconcileDeleteConfirmOpen(false)
        }}
      >
        <DialogContent className="w-[96vw] sm:w-full sm:max-w-md p-0 overflow-hidden rounded-2xl shadow-2xl border-none flex flex-col gap-0 [&>button.absolute]:hidden">
          <ModalHeader
            title="Hapus Rekonsiliasi"
            subtitle={reconcileDeletingBatchId ? `Batch #${reconcileDeletingBatchId}` : 'Hapus batch'}
            variant="emerald"
            icon={<TrashIcon className="h-5 w-5 text-white" />}
            onClose={() => {
              if (!reconcileDeleteSubmitting) setIsReconcileDeleteConfirmOpen(false)
            }}
          />
          <ModalContentWrapper className="flex-1 min-h-0 overflow-y-auto">
            <div className="p-6 text-sm text-gray-700">
              Batch ini akan dihapus, transaksi kas batch akan dibatalkan, dan nota di batch akan kembali menjadi BELUM LUNAS.
            </div>
          </ModalContentWrapper>
          <ModalFooter className="sm:justify-end">
            <Button variant="outline" className="rounded-full" onClick={() => setIsReconcileDeleteConfirmOpen(false)} disabled={reconcileDeleteSubmitting}>
              Batal
            </Button>
            <Button variant="destructive" className="rounded-full" onClick={handleConfirmDeleteReconcileBatch} disabled={reconcileDeleteSubmitting}>
              {reconcileDeleteSubmitting ? 'Menghapus...' : 'Hapus'}
            </Button>
          </ModalFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={duplicateWarningOpen}
        onOpenChange={(open) => {
          if (!open && !submittingDuplicateProceed) {
            setDuplicateWarningOpen(false)
            setDuplicateCandidates([])
            setPendingDuplicatePayload(null)
          }
        }}
      >
        <DialogContent className="w-[96vw] sm:w-full sm:max-w-2xl max-h-[92vh] p-0 overflow-hidden rounded-2xl shadow-2xl border-none flex flex-col [&>button.absolute]:hidden">
          <ModalHeader
            title="Peringatan Duplikasi Nota"
            subtitle="Ditemukan nota lain dengan data identik. Pastikan ini bukan input ganda."
            variant="emerald"
            icon={duplicateHeaderIcon || <DocumentTextIcon className="h-5 w-5 text-white" />}
            onClose={() => {
              if (submittingDuplicateProceed) return
              setDuplicateWarningOpen(false)
              setDuplicateCandidates([])
              setPendingDuplicatePayload(null)
            }}
          />
          <ModalContentWrapper className="flex-1 min-h-0 overflow-y-auto">
            <div className="space-y-3">
              <div className="text-sm text-gray-700">
                Sistem menemukan nota dengan kombinasi yang sama: Tanggal Bongkar, Pabrik, Supir, Kendaraan, Bruto, Tara, Netto, Potongan, dan Berat Akhir.
              </div>
              <div className="space-y-2">
                {(duplicateCandidates || []).length === 0 ? (
                  <div className="text-sm text-gray-500">Tidak ada kandidat.</div>
                ) : (
                  duplicateCandidates.map((d: any) => (
                    <div key={String(d?.id)} className="rounded-xl border border-gray-100 bg-white p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-semibold text-gray-900">Nota #{d?.id}</div>
                          <div className="text-xs text-gray-500">
                            {d?.tanggalBongkar ? new Date(d.tanggalBongkar).toLocaleDateString('id-ID') : '-'} • {d?.kebunName || '-'} • {d?.pabrikSawit?.name || '-'} • {d?.supir?.name || '-'} • {d?.kendaraanPlatNomor || '-'}
                          </div>
                        </div>
                        <Button variant="outline" className="rounded-full" onClick={() => handleViewDuplicateNota(Number(d?.id))}>
                          Lihat
                        </Button>
                      </div>
                      <div className="mt-2 grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                        <div className="rounded-lg bg-gray-50 px-2 py-1">
                          <div className="text-gray-500">Bruto</div>
                          <div className="font-semibold text-gray-900">{formatNumber(Number(d?.bruto || 0))}</div>
                        </div>
                        <div className="rounded-lg bg-gray-50 px-2 py-1">
                          <div className="text-gray-500">Tara</div>
                          <div className="font-semibold text-gray-900">{formatNumber(Number(d?.tara || 0))}</div>
                        </div>
                        <div className="rounded-lg bg-gray-50 px-2 py-1">
                          <div className="text-gray-500">Netto</div>
                          <div className="font-semibold text-gray-900">{formatNumber(Number(d?.netto || 0))}</div>
                        </div>
                        <div className="rounded-lg bg-gray-50 px-2 py-1">
                          <div className="text-gray-500">Potongan</div>
                          <div className="font-semibold text-gray-900">{formatNumber(Number(d?.potongan || 0))}</div>
                        </div>
                        <div className="rounded-lg bg-gray-50 px-2 py-1">
                          <div className="text-gray-500">Berat Akhir</div>
                          <div className="font-semibold text-gray-900">{formatNumber(Number(d?.beratAkhir || 0))}</div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </ModalContentWrapper>
          <ModalFooter className="sm:justify-between">
            <Button
              variant="outline"
              className="rounded-full"
              onClick={() => {
                if (submittingDuplicateProceed) return
                setDuplicateWarningOpen(false)
                setDuplicateCandidates([])
                setPendingDuplicatePayload(null)
              }}
              disabled={submittingDuplicateProceed}
            >
              Batal
            </Button>
            <Button
              className="rounded-full bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={handleProceedDuplicateCreate}
              disabled={submittingDuplicateProceed || !pendingDuplicatePayload}
            >
              {submittingDuplicateProceed ? 'Menyimpan...' : 'Tetap Simpan'}
            </Button>
          </ModalFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewImageUrl} onOpenChange={(open) => !open && setViewImageUrl(null)}>
        <DialogContent className="max-w-5xl w-[95vw] p-0 overflow-hidden border-none bg-white shadow-2xl [&>button.absolute]:hidden">
          {viewImageUrl && (
            <div className="flex flex-col h-full max-h-[90vh]">
              <ModalHeader
                title="Pratinjau Nota"
                subtitle="Gambar lampiran nota sawit"
                variant="emerald"
                icon={<DocumentTextIcon className="h-5 w-5 text-white" />}
                onClose={() => {
                  setViewImageUrl(null)
                  setViewImageError(false)
                }}
              />

              <div className="flex-1 overflow-auto flex items-center justify-center p-4 md:p-8 min-h-0 bg-gray-50/50">
                {!viewImageError ? (
                  <img
                    src={viewImageUrl}
                    alt="Bukti Nota"
                    className="max-w-full max-h-[65vh] md:max-h-[70vh] w-auto h-auto object-contain shadow-2xl rounded-md border border-gray-100"
                    onError={() => setViewImageError(true)}
                  />
                ) : (
                  <div className="flex items-center justify-center w-full h-[40vh]">
                    <div className="px-4 py-3 rounded-md bg-white shadow text-gray-700">Gambar tidak ditemukan atau tidak dapat dimuat.</div>
                  </div>
                )}
              </div>

              {!viewImageError && (
                <ModalFooter className="sm:justify-center">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-9 w-9 rounded-md border border-white bg-white text-emerald-600 hover:bg-gray-50 hover:text-emerald-700 shadow-sm transition-colors"
                    onClick={() => {
                      const link = document.createElement('a')
                      link.href = viewImageUrl
                      link.download = `Nota-Sawit-${Date.now()}.jpg`
                      document.body.appendChild(link)
                      link.click()
                      document.body.removeChild(link)
                    }}
                    title="Download Gambar"
                  >
                    <ArrowDownTrayIcon className="w-4 h-4" />
                  </Button>
                </ModalFooter>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
