import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ConfirmationModal } from '@/components/ui/confirmation-modal'
import { ModalHeader } from '@/components/ui/modal-elements'
import { ArrowDownTrayIcon, DocumentTextIcon } from '@heroicons/react/24/outline'
import AddTransaksiForm from './add-transaksi-form'
import DetailTransaksiModal from './detail-transaksi-modal'
import type { KasTransaksi } from '@/types/kasir'

export default function KasirPageModals(props: {
  isFormOpen: boolean
  setIsFormOpen: (open: boolean) => void
  editingTransaction: KasTransaksi | null
  setEditingTransaction: (trx: KasTransaksi | null) => void
  selectedDate: string
  onSaveTransaksi: (trx: any) => Promise<void>
  isDetailOpen: boolean
  setIsDetailOpen: (open: boolean) => void
  detailTransaction: KasTransaksi | null
  setDetailTransaction: (trx: KasTransaksi | null) => void
  formatKeterangan: (ket?: string | null) => string
  getPerusahaanTags: (ket?: string | null) => string[]
  openDelete: boolean
  setOpenDelete: (open: boolean) => void
  deleteId: number | null
  setDeleteId: (id: number | null) => void
  onConfirmDelete: () => void
  viewImageUrl: string | null
  setViewImageUrl: (url: string | null) => void
}) {
  const {
    isFormOpen,
    setIsFormOpen,
    editingTransaction,
    setEditingTransaction,
    selectedDate,
    onSaveTransaksi,
    isDetailOpen,
    setIsDetailOpen,
    detailTransaction,
    setDetailTransaction,
    formatKeterangan,
    getPerusahaanTags,
    openDelete,
    setOpenDelete,
    deleteId,
    setDeleteId,
    onConfirmDelete,
    viewImageUrl,
    setViewImageUrl,
  } = props

  return (
    <>
      <AddTransaksiForm
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onConfirm={onSaveTransaksi}
        selectedDate={selectedDate}
        initialData={editingTransaction}
      />

      <DetailTransaksiModal
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        transaksi={detailTransaction}
        formatKeterangan={formatKeterangan}
        getPerusahaanTags={getPerusahaanTags}
        onEdit={(trx) => {
          setEditingTransaction(trx)
          setIsDetailOpen(false)
          setIsFormOpen(true)
        }}
        onDelete={(trx) => {
          setDeleteId(trx.id)
          setIsDetailOpen(false)
          setOpenDelete(true)
        }}
      />

      <ConfirmationModal
        isOpen={openDelete}
        onClose={() => {
          setOpenDelete(false)
          setDeleteId(null)
        }}
        onConfirm={onConfirmDelete}
        title="Konfirmasi Hapus Transaksi"
        description="Apakah Anda yakin ingin menghapus transaksi ini? Tindakan tidak dapat dibatalkan."
        variant="emerald"
        confirmLabel="Hapus"
        cancelLabel="Batal"
      />

      <Dialog open={!!viewImageUrl} onOpenChange={(open) => !open && setViewImageUrl(null)}>
        <DialogContent className="max-w-5xl w-[95vw] p-0 overflow-hidden border-none bg-white shadow-2xl [&>button.absolute]:hidden">
          {viewImageUrl && (
            <div className="flex flex-col h-full max-h-[90vh]">
              <ModalHeader
                title="Pratinjau Bukti"
                subtitle="Gambar lampiran transaksi kas"
                variant="emerald"
                icon={<DocumentTextIcon className="h-5 w-5 text-white" />}
                onClose={() => setViewImageUrl(null)}
              />

              <div className="flex-1 overflow-auto flex items-center justify-center p-4 md:p-8 min-h-0 bg-gray-50/50">
                <img
                  src={viewImageUrl}
                  alt="Bukti"
                  className="max-w-full max-h-[65vh] md:max-h-[70vh] w-auto h-auto object-contain shadow-2xl rounded-md border border-gray-100"
                />
              </div>

              <div className="sm:justify-center px-4 pb-4">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-9 w-9 rounded-md border border-white bg-white text-emerald-600 hover:bg-gray-50 hover:text-emerald-700 shadow-sm transition-colors"
                  onClick={() => {
                    const link = document.createElement('a')
                    link.href = viewImageUrl
                    link.download = `Bukti-Kas-${Date.now()}.jpg`
                    document.body.appendChild(link)
                    link.click()
                    document.body.removeChild(link)
                  }}
                  title="Download Gambar"
                >
                  <ArrowDownTrayIcon className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
