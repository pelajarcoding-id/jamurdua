import { Dialog, DialogContent } from '@/components/ui/dialog'
import { ConfirmationModal } from '@/components/ui/confirmation-modal'
import { ModalHeader, ModalContentWrapper, ModalFooter } from '@/components/ui/modal-elements'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import ImageUpload from '@/components/ui/ImageUpload'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { id as idLocale } from 'date-fns/locale'
import {
  ArrowDownTrayIcon,
  ArrowPathIcon,
  BanknotesIcon,
  CalendarIcon,
  CheckCircleIcon,
  ClockIcon,
  CreditCardIcon,
  CurrencyDollarIcon,
  EyeIcon,
  MinusCircleIcon,
  PencilSquareIcon,
  PlusCircleIcon,
  TrashIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline'

export default function KaryawanPageModals(props: any) {
  const {
    canDelete,
    canRequestDelete,
    selectedKebunId,
    selectedUser,
    absenUserId,
    absenMonth,
    endDate,
    mutate,
    mutateKaryawan,
    persistAbsensiLocal,
    fetchAbsenPayHistory,
    loadPaid,
    formatRibuanId,
    formatShort,
    getLocationLabel,
    workLocations,
    rows,
    unpaidDates,
    payTotal,
    hutangBeforePay,
    potongHutangEffective,
    hutangAfterPay,
    handleCancelPaidDate,
    handleDeleteAbsenPay,
    handleMove,
    exportDetailPdf,
    exportDetailCsv,
    exportPayrollCsv,
    exportPayrollPdf,
    submitHutang,
    submitPotong,
    confirmDeleteDetail,
    openEditDetailModal,
    openDeleteDetailModal,
    submitEditDetail,
    submitPayrollCuts,
    isSubmitting,
    openAbsenView,
    setOpenAbsenView,
    openDeleteAbsenConfirm,
    setOpenDeleteAbsenConfirm,
    openCancelGajiConfirm,
    setOpenCancelGajiConfirm,
    isCancellingGaji,
    setIsCancellingGaji,
    openDeleteKaryawan,
    setOpenDeleteKaryawan,
    deleteKaryawanId,
    setDeleteKaryawanId,
    openHutang,
    setOpenHutang,
    openPotong,
    setOpenPotong,
    hutangModalUser,
    setHutangModalUser,
    hutangJumlah,
    setHutangJumlah,
    hutangTanggal,
    setHutangTanggal,
    hutangDeskripsi,
    setHutangDeskripsi,
    potongJumlah,
    setPotongJumlah,
    potongTanggal,
    setPotongTanggal,
    potongDeskripsi,
    setPotongDeskripsi,
    openDeleteDetail,
    setOpenDeleteDetail,
    deleteDetail,
    deleteLoading,
    openDetail,
    setOpenDetail,
    detailLoading,
    detailRows,
    totalHutangDetail,
    totalPotonganDetail,
    lastPotonganDetail,
    sisaHutangDetail,
    openEditDetail,
    setOpenEditDetail,
    editDetailId,
    editDetailDate,
    setEditDetailDate,
    editDetailJumlah,
    setEditDetailJumlah,
    editDetailDeskripsi,
    setEditDetailDeskripsi,
    openHistory,
    setOpenHistory,
    historyUser,
    historyLoading,
    historyItems,
    openMove,
    setOpenMove,
    moveUser,
    moveLoading,
    moveLocationId,
    setMoveLocationId,
    moveDate,
    setMoveDate,
    absenSelectedDate,
    absenMap,
    setAbsenMap,
    absenWorkMap,
    setAbsenWorkMap,
    absenOffMap,
    setAbsenOffMap,
    absenNoteMap,
    setAbsenNoteMap,
    absenHourlyMap,
    setAbsenHourlyMap,
    absenHourMap,
    setAbsenHourMap,
    absenRateMap,
    setAbsenRateMap,
    absenMealEnabledMap,
    setAbsenMealEnabledMap,
    absenMealMap,
    setAbsenMealMap,
    absenPaidMap,
    setAbsenPaidMap,
    absenSourceMap,
    isDeletingAbsen,
    setIsDeletingAbsen,
    absenOpen,
    setAbsenOpen,
    absenWork,
    setAbsenWork,
    absenOff,
    setAbsenOff,
    absenValue,
    setAbsenValue,
    absenDefaultAmount,
    setAbsenDefaultAmount,
    absenUseHourly,
    setAbsenUseHourly,
    absenHour,
    setAbsenHour,
    absenRate,
    setAbsenRate,
    absenMealEnabled,
    setAbsenMealEnabled,
    absenMealAmount,
    setAbsenMealAmount,
    absenSetDefault,
    setAbsenSetDefault,
    absenNote,
    setAbsenNote,
    absenSaving,
    setAbsenSaving,
    setAbsenSaved,
    absenSaveTimerRef,
    absenPayOpen,
    setAbsenPayOpen,
    absenPaySelection,
    setAbsenPaySelection,
    absenPayPotong,
    setAbsenPayPotong,
    absenPayPotongDesc,
    setAbsenPayPotongDesc,
    openCancelPaid,
    setOpenCancelPaid,
    setCancelPaidDate,
    openDeleteAbsenPay,
    setOpenDeleteAbsenPay,
    setDeleteAbsenPayId,
    setDeleteAbsenPayPaidAt,
    openAddEditKaryawan,
    setOpenAddEditKaryawan,
    editKaryawan,
    setEditKaryawan,
    formName,
    setFormName,
    formPhotoFile,
    setFormPhotoFile,
    formPhotoPreview,
    setFormPhotoPreview,
    formKebunId,
    setFormKebunId,
    formJobType,
    setFormJobType,
    formStatus,
    setFormStatus,
    formRole,
    setFormRole,
    formTanggalMulaiBekerja,
    setFormTanggalMulaiBekerja,
    formKendaraanPlatNomor,
    setFormKendaraanPlatNomor,
    alatBeratList,
    kebunList,
    openKebunCombo,
    setOpenKebunCombo,
    kebunQuery,
    setKebunQuery,
    openPayroll,
    setOpenPayroll,
    massNominal,
    setMassNominal,
    massDate,
    setMassDate,
    massDesc,
    setMassDesc,
    potongMap,
    setPotongMap,
    potongEffectiveById,
    totalPotong,
    totalSisa,
  } = props

  return (
    <>
      <Dialog open={openAbsenView} onOpenChange={setOpenAbsenView}>
        <DialogContent className="w-[92vw] sm:w-full sm:max-w-md bg-white rounded-3xl p-0 overflow-hidden shadow-2xl border-none [&>button.absolute]:hidden">
          <ModalHeader
            title={selectedUser?.name || 'Detail Absensi'}
            subtitle={absenSelectedDate ? format(new Date(absenSelectedDate), 'EEEE, dd MMMM yyyy', { locale: idLocale }) : ''}
            variant="emerald"
            onClose={() => setOpenAbsenView(false)}
          />

          <ModalContentWrapper className="space-y-5" id="absen-view-content">
            <div className="flex items-center justify-between p-4 rounded-2xl bg-gray-50 border border-gray-100">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${absenOffMap[absenSelectedDate] ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'}`}>
                  <CheckCircleIcon className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Status</p>
                  <p className="font-bold text-gray-900">
                    {absenOffMap[absenSelectedDate] ? 'Libur' : 'Masuk Kerja'}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Total Gaji</p>
                <p className="font-bold text-emerald-600 text-lg">
                  Rp {(() => {
                    const val = absenMap[absenSelectedDate] || '0'
                    return Number(val.replace(/\./g, '').replace(/,/g, '')).toLocaleString('id-ID')
                  })()}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 rounded-xl bg-gray-50 border border-gray-100">
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">Status Pembayaran</p>
                {absenPaidMap[absenSelectedDate] ? (
                  <div className="flex items-center gap-1.5 text-purple-600 font-bold text-sm">
                    <BanknotesIcon className="w-4 h-4" />
                    Sudah Dibayar
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-amber-600 font-bold text-sm">
                    <ClockIcon className="w-4 h-4" />
                    Belum Dibayar
                  </div>
                )}
              </div>
              <div className="p-3 rounded-xl bg-gray-50 border border-gray-100">
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">Metode Upah</p>
                <div className="flex items-center gap-1.5 text-emerald-700 font-bold text-sm">
                  <CurrencyDollarIcon className="w-4 h-4" />
                  {absenHourlyMap[absenSelectedDate] ? 'Per Jam' : 'Harian'}
                </div>
              </div>
              <div className="col-span-2 p-3 rounded-xl bg-gray-50 border border-gray-100">
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">Diinput Oleh</p>
                <div className="flex items-center gap-1.5 text-sky-700 font-bold text-sm">
                  <UserGroupIcon className="w-4 h-4" />
                  {(() => {
                    const src = String(absenSourceMap[absenSelectedDate] || '').toUpperCase()
                    if (src === 'SELFIE') return 'Selfie (Karyawan)'
                    if (src === 'MANUAL') return 'Manual'
                    if (src) return src
                    return '-'
                  })()}
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center text-sm p-2 px-3 bg-gray-50 rounded-lg border border-gray-100">
                <span className="text-gray-500 font-medium">Upah Harian:</span>
                <span className="font-bold text-gray-900">
                  {!absenHourlyMap[absenSelectedDate] ? `Rp ${Number(absenMap[absenSelectedDate]?.replace(/\./g, '') || 0).toLocaleString('id-ID')}` : '-'}
                </span>
              </div>
              <div className="flex justify-between items-center text-sm p-2 px-3 bg-gray-50 rounded-lg border border-gray-100">
                <span className="text-gray-500 font-medium">Upah Per Jam:</span>
                <span className="font-bold text-gray-900">
                  {absenHourlyMap[absenSelectedDate] ? (
                    `${absenHourMap[absenSelectedDate] || 0} jam × Rp ${Number(absenRateMap[absenSelectedDate]?.replace(/\./g, '') || 0).toLocaleString('id-ID')}`
                  ) : '-'}
                </span>
              </div>
              <div className="flex justify-between items-center text-sm p-2 px-3 bg-gray-50 rounded-lg border border-gray-100">
                <span className="text-gray-500 font-medium">Uang Makan:</span>
                <span className="font-bold text-gray-900">
                  {absenMealEnabledMap[absenSelectedDate] ? (
                    `Rp ${Number(absenMealMap[absenSelectedDate]?.replace(/\./g, '') || 0).toLocaleString('id-ID')}`
                  ) : '-'}
                </span>
              </div>
              <div className="space-y-1.5">
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider ml-1">Keterangan</p>
                <div className="p-3 rounded-xl bg-emerald-50/50 border border-emerald-100 text-gray-700 text-sm leading-relaxed min-h-[44px]">
                  {absenNoteMap[absenSelectedDate] || '-'}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                variant="outline"
                size="icon"
                className="rounded-xl w-10 h-10 border-emerald-200 text-emerald-700 hover:bg-emerald-50 transition-all shadow-sm"
                title="Export PDF"
                onClick={async () => {
                  const html2canvas = (await import('html2canvas')).default
                  const jsPDF = (await import('jspdf')).jsPDF

                  const pdfContainer = document.createElement('div')
                  pdfContainer.style.position = 'fixed'
                  pdfContainer.style.left = '-9999px'
                  pdfContainer.style.top = '0'
                  pdfContainer.style.width = '210mm'
                  pdfContainer.style.backgroundColor = '#ffffff'
                  pdfContainer.style.padding = '20mm'
                  pdfContainer.style.fontFamily = 'sans-serif'
                  pdfContainer.style.color = '#000000'

                  const dateStr = absenSelectedDate ? format(new Date(absenSelectedDate), 'EEEE, dd MMMM yyyy', { locale: idLocale }) : ''
                  const totalGaji = (() => {
                    const val = absenMap[absenSelectedDate] || '0'
                    return Number(val.replace(/\./g, '').replace(/,/g, '')).toLocaleString('id-ID')
                  })()

                  pdfContainer.innerHTML = `
                    <div style="border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 20px;">
                      <h1 style="font-size: 24px; margin: 0; color: #059669;">LAPORAN ABSENSI HARIAN</h1>
                      <p style="font-size: 14px; margin: 5px 0 0 0; color: #666;">Dicetak pada: ${format(new Date(), 'dd/MM/yyyy HH:mm')}</p>
                    </div>

                    <div style="margin-bottom: 30px;">
                      <table style="width: 100%; border-collapse: collapse;">
                        <tr>
                          <td style="width: 150px; padding: 8px 0; font-weight: bold; color: #4b5563;">Nama Karyawan</td>
                          <td style="padding: 8px 0;">: ${selectedUser?.name || '-'}</td>
                        </tr>
                        <tr>
                          <td style="padding: 8px 0; font-weight: bold; color: #4b5563;">Tanggal</td>
                          <td style="padding: 8px 0;">: ${dateStr}</td>
                        </tr>
                      </table>
                    </div>

                    <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin-bottom: 30px;">
                      <h2 style="font-size: 18px; margin: 0 0 15px 0; border-bottom: 1px solid #e5e7eb; padding-bottom: 10px;">Ringkasan Pekerjaan</h2>
                      <table style="width: 100%; border-collapse: collapse;">
                        <tr>
                          <td style="padding: 8px 0; color: #4b5563;">Status Kehadiran</td>
                          <td style="padding: 8px 0; font-weight: bold; text-align: right;">${absenOffMap[absenSelectedDate] ? 'Libur' : 'Masuk Kerja'}</td>
                        </tr>
                        <tr>
                          <td style="padding: 8px 0; color: #4b5563;">Metode Upah</td>
                          <td style="padding: 8px 0; font-weight: bold; text-align: right;">${absenHourlyMap[absenSelectedDate] ? 'Per Jam' : 'Harian'}</td>
                        </tr>
                        <tr>
                          <td style="padding: 8px 0; color: #4b5563;">Status Pembayaran</td>
                          <td style="padding: 8px 0; font-weight: bold; text-align: right; color: ${absenPaidMap[absenSelectedDate] ? '#7c3aed' : '#d97706'};">${absenPaidMap[absenSelectedDate] ? 'SUDAH DIBAYAR' : 'BELUM DIBAYAR'}</td>
                        </tr>
                        <tr style="border-top: 1px solid #e5e7eb;">
                          <td style="padding: 15px 0 8px 0; font-size: 18px; font-weight: bold;">TOTAL GAJI</td>
                          <td style="padding: 15px 0 8px 0; font-size: 20px; font-weight: bold; text-align: right; color: #059669;">Rp ${totalGaji}</td>
                        </tr>
                      </table>
                    </div>

                    <div style="margin-bottom: 30px;">
                      <h2 style="font-size: 16px; margin: 0 0 10px 0; color: #4b5563;">Rincian Gaji:</h2>
                      <div style="border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
                        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                          <tr style="background-color: #f3f4f6;">
                            <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">Upah Harian</td>
                            <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: bold;">${!absenHourlyMap[absenSelectedDate] ? `Rp ${Number(absenMap[absenSelectedDate]?.replace(/\./g, '') || 0).toLocaleString('id-ID')}` : '-'}</td>
                          </tr>
                          <tr>
                            <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">Upah Per Jam</td>
                            <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: bold;">${absenHourlyMap[absenSelectedDate] ? `${absenHourMap[absenSelectedDate] || 0} jam × Rp ${Number(absenRateMap[absenSelectedDate]?.replace(/\./g, '') || 0).toLocaleString('id-ID')}` : '-'}</td>
                          </tr>
                          <tr style="background-color: #f3f4f6;">
                            <td style="padding: 10px;">Uang Makan</td>
                            <td style="padding: 10px; text-align: right; font-weight: bold;">${absenMealEnabledMap[absenSelectedDate] ? `Rp ${Number(absenMealMap[absenSelectedDate]?.replace(/\./g, '') || 0).toLocaleString('id-ID')}` : '-'}</td>
                          </tr>
                        </table>
                      </div>
                    </div>

                    <div>
                      <h2 style="font-size: 16px; margin: 0 0 10px 0; color: #4b5563;">Keterangan:</h2>
                      <div style="padding: 15px; background-color: #ecfdf5; border: 1px solid #d1fae5; border-radius: 8px; font-size: 14px; color: #065f46; min-height: 60px;">
                        ${absenNoteMap[absenSelectedDate] || '-'}
                      </div>
                    </div>

                    <div style="margin-top: 50px; text-align: right; font-size: 12px; color: #9ca3af;">
                      <p>Dokumen ini dihasilkan secara otomatis oleh Sistem Aplikasi Sarakan.</p>
                    </div>
                  `

                  document.body.appendChild(pdfContainer)

                  const canvas = await html2canvas(pdfContainer, {
                    logging: false,
                    useCORS: true,
                    backgroundColor: '#ffffff',
                    scale: 2,
                  } as any)

                  const imgData = canvas.toDataURL('image/png')
                  const pdf = new jsPDF('p', 'mm', 'a4')
                  const pdfWidth = pdf.internal.pageSize.getWidth()
                  const imgProps = pdf.getImageProperties(imgData)
                  const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width

                  pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight)
                  pdf.save(`Laporan_Absensi_${selectedUser?.name || 'Karyawan'}_${absenSelectedDate}.pdf`)

                  document.body.removeChild(pdfContainer)
                }}
              >
                <ArrowDownTrayIcon className="w-4 h-4" />
              </Button>
              {absenPaidMap[absenSelectedDate] ? (
                <Button
                  variant="outline"
                  className="rounded-xl h-10 border-amber-200 text-amber-600 hover:bg-amber-50 transition-all shadow-sm px-4 font-semibold text-xs"
                  title="Batalkan Gaji"
                  onClick={() => setOpenCancelGajiConfirm(true)}
                  disabled={isCancellingGaji}
                >
                  <ArrowPathIcon className="w-4 h-4 mr-1.5" />
                  Batalkan Gaji
                </Button>
              ) : (
                <>
                  <Button
                    variant="outline"
                    size="icon"
                    className="rounded-xl w-10 h-10 border-emerald-200 text-emerald-700 hover:bg-emerald-50 transition-all shadow-sm"
                    title="Edit Data"
                    onClick={() => {
                      setOpenAbsenView(false)
                      setAbsenOpen(true)
                    }}
                  >
                    <PencilSquareIcon className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="rounded-xl w-10 h-10 border-red-200 text-red-500 hover:bg-red-50 transition-all shadow-sm"
                    title="Hapus Data"
                    disabled={isDeletingAbsen || (absenSelectedDate ? String(absenSourceMap[absenSelectedDate] || '').toUpperCase() === 'SELFIE' : false)}
                    onClick={() => setOpenDeleteAbsenConfirm(true)}
                  >
                    <TrashIcon className="w-4 h-4" />
                  </Button>
                </>
              )}
            </div>
          </ModalContentWrapper>
        </DialogContent>
      </Dialog>

      <ConfirmationModal
        isOpen={openDeleteAbsenConfirm}
        onClose={() => setOpenDeleteAbsenConfirm(false)}
        title="Hapus Absensi"
        description={`Apakah Anda yakin ingin menghapus data absensi tanggal ${absenSelectedDate ? format(new Date(absenSelectedDate), 'dd MMMM yyyy', { locale: idLocale }) : ''}? Tindakan ini tidak dapat dibatalkan.`}
        variant="emerald"
        onConfirm={async () => {
          const kebunKey = selectedKebunId ?? 0
          if (!absenUserId || !absenSelectedDate) return

          setIsDeletingAbsen(true)
          try {
            const res = await fetch(`/api/karyawan/operasional/absensi?kebunId=${kebunKey}&karyawanId=${absenUserId}&date=${absenSelectedDate}`, {
              method: 'DELETE',
            })
            if (res.ok) {
              const nextAmount = { ...absenMap }; delete nextAmount[absenSelectedDate]
              const nextWork = { ...absenWorkMap }; delete nextWork[absenSelectedDate]
              const nextOff = { ...absenOffMap }; delete nextOff[absenSelectedDate]
              const nextNote = { ...absenNoteMap }; delete nextNote[absenSelectedDate]

              setAbsenMap(nextAmount)
              setAbsenWorkMap(nextWork)
              setAbsenOffMap(nextOff)
              setAbsenNoteMap(nextNote)

              persistAbsensiLocal(nextAmount, nextWork, nextOff, nextNote, absenHourlyMap, absenHourMap, absenRateMap, absenMealEnabledMap, absenMealMap)
              toast.success('Absensi dihapus')
              setOpenAbsenView(false)
              await mutate()
            } else {
              const err = await res.json().catch(() => ({} as any))
              toast.error(err?.error || 'Gagal menghapus data')
            }
          } catch {
            toast.error('Kesalahan jaringan')
          } finally {
            setIsDeletingAbsen(false)
            setOpenDeleteAbsenConfirm(false)
          }
        }}
      />

      <ConfirmationModal
        isOpen={openCancelGajiConfirm}
        onClose={() => setOpenCancelGajiConfirm(false)}
        title="Batalkan Pembayaran Gaji"
        description={`Apakah Anda yakin ingin membatalkan pembayaran gaji untuk tanggal ${absenSelectedDate ? format(new Date(absenSelectedDate), 'dd MMMM yyyy', { locale: idLocale }) : ''}? Seluruh transaksi kas yang terkait dengan pembayaran hari ini akan dihapus.`}
        variant="emerald"
        onConfirm={async () => {
          const kebunKey = selectedKebunId ?? 0
          if (!absenUserId || !absenSelectedDate) return

          setIsCancellingGaji(true)
          try {
            const res = await fetch(`/api/karyawan-kebun/absensi-payments?kebunId=${kebunKey}&karyawanId=${absenUserId}&date=${absenSelectedDate}`, {
              method: 'DELETE',
            })
            if (res.ok) {
              const nextPaid = { ...absenPaidMap }
              delete nextPaid[absenSelectedDate]
              setAbsenPaidMap(nextPaid)
              toast.success('Pembayaran gaji dibatalkan')
              setOpenCancelGajiConfirm(false)
              await mutate()
            } else {
              const err = await res.json().catch(() => ({}))
              toast.error(err.error || 'Gagal membatalkan pembayaran')
            }
          } catch {
            toast.error('Kesalahan jaringan')
          } finally {
            setIsCancellingGaji(false)
          }
        }}
      />

      <Dialog open={absenOpen} onOpenChange={setAbsenOpen}>
        <DialogContent className="w-[92vw] sm:w-full sm:max-w-md bg-white rounded-3xl p-0 overflow-hidden max-h-[90vh] [&>button.absolute]:hidden flex flex-col">
          <ModalHeader
            title="Input Absensi"
            subtitle={absenSelectedDate ? format(new Date(absenSelectedDate), 'EEEE, dd MMMM yyyy', { locale: idLocale }) : ''}
            variant="emerald"
            icon={<CalendarIcon className="h-5 w-5 text-white" />}
            onClose={() => setAbsenOpen(false)}
          />
          <ModalContentWrapper className="space-y-6 flex-1 min-h-0 overflow-y-auto no-scrollbar">
            {absenSelectedDate && absenPaidMap[absenSelectedDate] && (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-100 text-xs text-amber-700">
                Tanggal ini sudah digaji. Batalkan digaji untuk mengubah data.
              </div>
            )}
            {absenSelectedDate && String(absenSourceMap[absenSelectedDate] || '').toUpperCase() === 'SELFIE' && (
              <div className="p-3 rounded-xl bg-blue-50 border border-blue-100 text-xs text-blue-700">
                Absensi pada tanggal ini berasal dari Absensi Selfie.
              </div>
            )}

            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-2xl bg-gray-50 border border-gray-100">
                <div className="space-y-0.5">
                  <Label className="text-sm font-semibold">Masuk Kerja</Label>
                  <p className="text-xs text-gray-500">Karyawan hadir bekerja</p>
                </div>
                <Switch
                  checked={absenWork}
                  disabled={!!absenSelectedDate && !!absenPaidMap[absenSelectedDate]}
                  onCheckedChange={(v) => {
                    setAbsenWork(v)
                    if (v) {
                      setAbsenOff(false)
                      if (!absenValue && absenDefaultAmount > 0) {
                        setAbsenValue(formatRibuanId(String(absenDefaultAmount)))
                      }
                    } else {
                      setAbsenValue('0')
                      setAbsenUseHourly(false)
                      setAbsenHour('')
                      setAbsenRate('')
                      setAbsenMealEnabled(false)
                      setAbsenMealAmount('')
                    }
                  }}
                />
              </div>
              <div className="flex items-center justify-between p-3 rounded-2xl bg-gray-50 border border-gray-100">
                <div className="space-y-0.5">
                  <Label className="text-sm font-semibold">Libur</Label>
                  <p className="text-xs text-gray-500">Karyawan tidak hadir</p>
                </div>
                <Switch
                  checked={absenOff}
                  disabled={!!absenSelectedDate && !!absenPaidMap[absenSelectedDate]}
                  onCheckedChange={(v) => {
                    setAbsenOff(v)
                    if (v) {
                      setAbsenWork(false)
                      setAbsenValue('0')
                      setAbsenUseHourly(false)
                      setAbsenHour('')
                      setAbsenRate('')
                      setAbsenMealEnabled(false)
                      setAbsenMealAmount('')
                    }
                  }}
                />
              </div>
            </div>

            {!absenOff && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Upah Harian (Rp)</Label>
                  <Input
                    className="rounded-xl h-12 text-lg font-bold"
                    placeholder="0"
                    value={absenValue}
                    disabled={!!absenSelectedDate && !!absenPaidMap[absenSelectedDate]}
                    onChange={(e) => {
                      const next = formatRibuanId(e.target.value)
                      setAbsenValue(next)
                      if (next) {
                        setAbsenWork(true)
                        setAbsenOff(false)
                      } else {
                        setAbsenWork(false)
                      }
                    }}
                  />
                  {absenDefaultAmount > 0 && (
                    <p className="text-xs text-gray-500">Default saat ini: Rp {absenDefaultAmount.toLocaleString('id-ID')}</p>
                  )}
                </div>

                <div className="flex items-center justify-between p-3 rounded-2xl bg-gray-50 border border-gray-100">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-semibold">Hitung per jam</Label>
                    <p className="text-xs text-gray-500">Gunakan rate per jam</p>
                  </div>
                  <Switch
                    checked={absenUseHourly}
                    disabled={!!absenSelectedDate && !!absenPaidMap[absenSelectedDate]}
                    onCheckedChange={setAbsenUseHourly}
                  />
                </div>

                {absenUseHourly && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold uppercase tracking-wider text-gray-500">Jam Kerja</Label>
                      <Input
                        type="number"
                        step="0.5"
                        className="rounded-xl h-11"
                        value={absenHour}
                        disabled={!!absenSelectedDate && !!absenPaidMap[absenSelectedDate]}
                        onChange={e => setAbsenHour(e.target.value)}
                        placeholder="7.5"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold uppercase tracking-wider text-gray-500">Rate/Jam</Label>
                      <Input
                        className="rounded-xl h-11"
                        value={absenRate}
                        disabled={!!absenSelectedDate && !!absenPaidMap[absenSelectedDate]}
                        onChange={e => setAbsenRate(formatRibuanId(e.target.value))}
                        placeholder="15.000"
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-2xl bg-gray-50 border border-gray-100">
                    <div className="space-y-0.5">
                      <Label className="text-sm font-semibold">Uang Makan</Label>
                      <p className="text-xs text-gray-500">Opsional tambahan</p>
                    </div>
                    <Switch
                      checked={absenMealEnabled}
                      disabled={!!absenSelectedDate && !!absenPaidMap[absenSelectedDate]}
                      onCheckedChange={setAbsenMealEnabled}
                    />
                  </div>
                  {absenMealEnabled && (
                    <Input
                      className="rounded-xl h-11"
                      value={absenMealAmount}
                      disabled={!!absenSelectedDate && !!absenPaidMap[absenSelectedDate]}
                      onChange={e => {
                        const next = formatRibuanId(e.target.value)
                        setAbsenMealAmount(next)
                        if (next) {
                          setAbsenWork(true)
                          setAbsenOff(false)
                        }
                      }}
                      placeholder="contoh: 20.000"
                    />
                  )}
                </div>

                <div className="rounded-2xl border border-gray-100 bg-gray-50/50 p-4 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Input Rupiah</span>
                    <span className="font-semibold text-gray-900">Rp {(() => {
                      const manual = Number((absenValue || '').toString().replace(/\./g, '').replace(/,/g, '')) || 0
                      return manual ? manual.toLocaleString('id-ID') : 0
                    })()}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Hitung Per Jam</span>
                    <span className="font-semibold text-gray-900">Rp {(() => {
                      if (!absenUseHourly) return 0
                      const hourly = (parseFloat((absenHour || '').toString().replace(',', '.')) || 0) * (Number((absenRate || '').toString().replace(/\./g, '').replace(/,/g, '')) || 0)
                      return Math.round(hourly).toLocaleString('id-ID')
                    })()}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Uang Makan</span>
                    <span className="font-semibold text-gray-900">Rp {(() => {
                      const meal = !absenMealEnabled ? 0 : Number((absenMealAmount || '').toString().replace(/\./g, '').replace(/,/g, '')) || 0
                      return Math.round(meal).toLocaleString('id-ID')
                    })()}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm pt-2 border-t border-gray-200">
                    <span className="text-gray-900 font-bold">TOTAL AKHIR</span>
                    <span className="font-bold text-emerald-600 text-lg">Rp {(() => {
                      const manual = Number((absenValue || '').toString().replace(/\./g, '').replace(/,/g, '')) || 0
                      const hourly = !absenUseHourly ? 0 : (parseFloat((absenHour || '').toString().replace(',', '.')) || 0) * (Number((absenRate || '').toString().replace(/\./g, '').replace(/,/g, '')) || 0)
                      const meal = !absenMealEnabled ? 0 : Number((absenMealAmount || '').toString().replace(/\./g, '').replace(/,/g, '')) || 0
                      return Math.round(manual + hourly + meal).toLocaleString('id-ID')
                    })()}</span>
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-center gap-2">
              <Switch
                checked={absenSetDefault}
                disabled={!!absenSelectedDate && !!absenPaidMap[absenSelectedDate]}
                onCheckedChange={setAbsenSetDefault}
              />
              <Label className="text-xs text-gray-500">Jadikan upah ini sebagai default harian</Label>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold text-gray-700">Keterangan (Opsional)</Label>
              <Input
                className="rounded-xl"
                placeholder="Contoh: Lembur, Izin, dll"
                value={absenNote}
                onChange={(e) => setAbsenNote(e.target.value)}
                disabled={!!absenSelectedDate && !!absenPaidMap[absenSelectedDate]}
              />
              {absenSelectedDate && String(absenSourceMap[absenSelectedDate] || '').toUpperCase() === 'SELFIE' && (
                <p className="text-xs text-blue-600">Absensi melalui Absensi Selfie.</p>
              )}
            </div>
          </ModalContentWrapper>
          <ModalFooter className="gap-2">
            {canDelete && absenSelectedDate && absenPaidMap[absenSelectedDate] && (
              <Button
                className="rounded-full bg-red-500 text-white hover:bg-red-600 w-full sm:w-auto mr-auto"
                onClick={() => {
                  setCancelPaidDate(absenSelectedDate)
                  setOpenCancelPaid(true)
                }}
              >
                Batalkan Gaji
              </Button>
            )}
            <Button variant="outline" className="rounded-full" onClick={() => setAbsenOpen(false)}>Batal</Button>
            <Button
              className="rounded-full bg-emerald-600 text-white hover:bg-emerald-700 px-8"
              disabled={absenSaving || (!!absenSelectedDate && !!absenPaidMap[absenSelectedDate])}
              onClick={async () => {
                if (!absenSelectedDate) return
                if (!absenUserId) {
                  toast.error('Pilih karyawan terlebih dahulu')
                  return
                }
                const kebunKey = selectedKebunId ?? 0
                const baseManual = Number((absenValue || '').toString().replace(/\./g, '').replace(/,/g, '')) || 0
                const hours = parseFloat((absenHour || '').toString().replace(',', '.')) || 0
                const rate = Number((absenRate || '').toString().replace(/\./g, '').replace(/,/g, '')) || 0
                const baseHourly = hours * rate
                const useHourly = absenUseHourly && hours > 0 && rate > 0
                const mealVal = absenMealEnabled ? (Number((absenMealAmount || '').toString().replace(/\./g, '').replace(/,/g, '')) || 0) : 0
                const totalAmount = Math.round(((useHourly ? baseHourly : 0) + baseManual) + mealVal)
                const totalFormatted = totalAmount ? formatRibuanId(String(totalAmount)) : ''
                const nextAmount = { ...absenMap, [absenSelectedDate]: totalFormatted }
                const nextWork = { ...absenWorkMap, [absenSelectedDate]: absenWork || totalAmount > 0 }
                const nextOff = { ...absenOffMap, [absenSelectedDate]: absenOff }
                const nextNote = { ...absenNoteMap, [absenSelectedDate]: absenNote }
                const nextHourly = { ...absenHourlyMap, [absenSelectedDate]: absenUseHourly }
                const nextHour = { ...absenHourMap, [absenSelectedDate]: absenUseHourly ? absenHour : '' }
                const nextRate = { ...absenRateMap, [absenSelectedDate]: absenUseHourly ? absenRate : '' }
                const nextMealEnabled = { ...absenMealEnabledMap, [absenSelectedDate]: absenMealEnabled }
                const nextMeal = { ...absenMealMap, [absenSelectedDate]: absenMealAmount }
                setAbsenMap(nextAmount)
                setAbsenWorkMap(nextWork)
                setAbsenOffMap(nextOff)
                setAbsenNoteMap(nextNote)
                setAbsenHourlyMap(nextHourly)
                setAbsenHourMap(nextHour)
                setAbsenRateMap(nextRate)
                setAbsenMealEnabledMap(nextMealEnabled)
                setAbsenMealMap(nextMeal)
                persistAbsensiLocal(nextAmount, nextWork, nextOff, nextNote, nextHourly, nextHour, nextRate, nextMealEnabled, nextMeal)
                const jumlah = totalAmount
                const entries = [{
                  date: absenSelectedDate,
                  jumlah,
                  kerja: absenWork || totalAmount > 0,
                  libur: absenOff,
                  note: absenNote || '',
                  jamKerja: useHourly ? hours : null,
                  ratePerJam: useHourly ? rate : null,
                  uangMakan: absenMealEnabled ? mealVal : null,
                  useHourly: absenUseHourly,
                }]
                setAbsenSaving(true)
                try {
                  const res = await fetch('/api/karyawan/operasional/absensi', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ kebunId: kebunKey, karyawanId: absenUserId, entries }),
                  })
                  if (!res.ok) {
                    let msg = 'Gagal menyimpan absensi'
                    try {
                      const j = await res.json()
                      if (j?.error) msg = j.error
                    } catch {}
                    toast.error(msg)
                    return
                  }
                  setAbsenSaved(true)
                  if (absenSaveTimerRef.current) clearTimeout(absenSaveTimerRef.current)
                  absenSaveTimerRef.current = setTimeout(() => setAbsenSaved(false), 1500)
                } catch {
                  toast.error('Kesalahan jaringan saat menyimpan absensi')
                  return
                } finally {
                  setAbsenSaving(false)
                }
                if (absenSetDefault && selectedKebunId && absenUserId) {
                  const num = Number((absenValue || '').toString().replace(/\./g, '').replace(/,/g, '')) || 0
                  if (num > 0) {
                    fetch('/api/karyawan/operasional/absensi-default', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ kebunId: selectedKebunId, karyawanId: absenUserId, amount: num }),
                    }).then(() => {}).catch(() => {})
                    setAbsenDefaultAmount(num)
                  }
                }
                setAbsenOpen(false)
              }}
            >
              {absenSaving ? 'Menyimpan...' : 'Simpan'}
            </Button>
          </ModalFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={absenPayOpen} onOpenChange={setAbsenPayOpen}>
        <DialogContent className="w-[92vw] sm:w-full sm:max-w-lg max-h-[92vh] rounded-2xl p-0 overflow-hidden [&>button.absolute]:hidden flex flex-col">
          <ModalHeader
            title={`Bayar Gaji - ${selectedUser?.name || ''}`}
            variant="emerald"
            icon={<BanknotesIcon className="h-5 w-5 text-white" />}
            onClose={() => setAbsenPayOpen(false)}
          />
          <ModalContentWrapper className="space-y-3 overflow-y-auto flex-1 min-h-0">
            {unpaidDates.length === 0 ? (
              <div className="text-sm text-gray-500">Tidak ada tanggal yang belum digaji.</div>
            ) : (
              <div className="max-h-64 overflow-y-auto border rounded-lg divide-y">
                {unpaidDates.map((d: any) => (
                  <label key={d.date} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                    <span>{format(new Date(d.date), 'dd MMM yyyy', { locale: idLocale })}</span>
                    <span className="flex items-center gap-3">
                      <span className="text-gray-700">Rp {d.amount.toLocaleString('id-ID')}</span>
                      <input
                        type="checkbox"
                        checked={!!absenPaySelection[d.date]}
                        onChange={(e) => setAbsenPaySelection((prev: any) => ({ ...prev, [d.date]: e.target.checked }))}
                      />
                    </span>
                  </label>
                ))}
              </div>
            )}
            <div className="flex items-center justify-between text-sm font-semibold">
              <span>Total Dibayar</span>
              <span>Rp {payTotal.toLocaleString('id-ID')}</span>
            </div>
            <div className="border rounded-lg p-3 space-y-2">
              <div className="text-sm font-semibold">Potong Hutang</div>
              <div className="text-xs text-gray-500">
                Saldo hutang saat ini: Rp {hutangBeforePay.toLocaleString('id-ID')}
              </div>
              <Input
                className="input-style h-10 rounded-full"
                value={absenPayPotong}
                onChange={(e) => setAbsenPayPotong(formatRibuanId(e.target.value))}
                placeholder="Nominal potong hutang"
                disabled={hutangBeforePay === 0}
              />
              <Input
                className="input-style h-10 rounded-full"
                value={absenPayPotongDesc}
                onChange={(e) => setAbsenPayPotongDesc(e.target.value)}
                placeholder="Keterangan potongan"
                disabled={hutangBeforePay === 0}
              />
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="rounded-md bg-gray-50 p-2">
                  <div className="text-gray-500">Sebelum</div>
                  <div className="font-semibold">Rp {hutangBeforePay.toLocaleString('id-ID')}</div>
                </div>
                <div className="rounded-md bg-gray-50 p-2">
                  <div className="text-gray-500">Potong</div>
                  <div className="font-semibold">Rp {potongHutangEffective.toLocaleString('id-ID')}</div>
                </div>
                <div className="rounded-md bg-gray-50 p-2">
                  <div className="text-gray-500">Sesudah</div>
                  <div className="font-semibold">Rp {hutangAfterPay.toLocaleString('id-ID')}</div>
                </div>
              </div>
            </div>
          </ModalContentWrapper>
          <ModalFooter className="sm:justify-end">
            <Button className="rounded-full w-full sm:w-auto" variant="outline" onClick={() => setAbsenPayOpen(false)}>Batal</Button>
            <Button
              className="rounded-full w-full sm:w-auto bg-emerald-600 text-white hover:bg-emerald-700"
              onClick={async () => {
                if (!absenUserId) {
                  toast.error('Pilih karyawan terlebih dahulu')
                  return
                }
                const kebunKey = selectedKebunId ?? 0
                const selectedEntries = unpaidDates.filter((d: any) => absenPaySelection[d.date])
                const entries = selectedEntries.map((d: any) => ({ date: d.date, jumlah: d.amount }))
                if (entries.length === 0) {
                  toast.error('Pilih minimal 1 tanggal yang akan dibayar')
                  return
                }
                try {
                  const batchCreatedAt = new Date().toISOString()
                  const res = await fetch('/api/karyawan/operasional/absensi-payments', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      kebunId: kebunKey,
                      karyawanId: absenUserId,
                      entries,
                      createdAt: batchCreatedAt,
                    }),
                  })
                  if (!res.ok) {
                    let msg = 'Gagal menyimpan pembayaran'
                    try {
                      const j = await res.json()
                      if (j?.error) msg = j.error
                    } catch {}
                    toast.error(msg)
                    return
                  }
                  if (potongHutangEffective > 0) {
                    const lastDate = selectedEntries[selectedEntries.length - 1]?.date
                    const potongRes = await fetch('/api/karyawan/operasional/pembayaran', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        kebunId: kebunKey,
                        karyawanId: absenUserId,
                        jumlah: potongHutangEffective,
                        date: lastDate || undefined,
                        deskripsi: `${absenPayPotongDesc || 'Potong Hutang dari Pembayaran Gaji'}`,
                        createdAt: batchCreatedAt,
                      }),
                    })
                    if (!potongRes.ok) {
                      toast.error('Gagal menyimpan potongan hutang')
                    } else {
                      await mutate()
                    }
                  }
                  await fetchAbsenPayHistory()
                  await loadPaid(kebunKey, absenUserId, absenMonth)
                  setAbsenPaySelection({})
                  setAbsenPayPotong('')
                  setAbsenPayPotongDesc('Potong Hutang dari Pembayaran Gaji')
                  setAbsenPayOpen(false)
                  toast.success('Pembayaran gaji tersimpan')
                } catch {
                  toast.error('Gagal menyimpan pembayaran (network)')
                }
              }}
              disabled={!absenUserId || payTotal <= 0}
            >
              Simpan
            </Button>
          </ModalFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={openHutang} onOpenChange={(v) => { setOpenHutang(v); if (!v) setHutangModalUser(null) }}>
        <DialogContent className="w-[92vw] sm:w-full sm:max-w-md rounded-2xl p-0 overflow-hidden [&>button.absolute]:hidden">
          <ModalHeader
            title="Tambah Hutang"
            variant="emerald"
            icon={<PlusCircleIcon className="h-5 w-5 text-white" />}
            onClose={() => setOpenHutang(false)}
          />
          <ModalContentWrapper className="space-y-4">
            <div>
              <Label>Nama</Label>
              <div className="mt-1 text-sm">{hutangModalUser?.name}</div>
            </div>
            <div>
              <Label>Jumlah</Label>
              <div className="relative mt-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">Rp</span>
                <Input
                  className="input-style h-10 pl-10 rounded-full"
                  value={hutangJumlah}
                  onChange={(e) => setHutangJumlah(formatRibuanId(e.target.value))}
                  placeholder="contoh: 100.000"
                />
              </div>
              {!hutangJumlah && (
                <div className="mt-1 text-xs text-red-600">Jumlah wajib diisi</div>
              )}
            </div>
            <div>
              <Label>Tanggal</Label>
              <Input type="date" className="input-style h-10 rounded-full mt-1" value={hutangTanggal} onChange={(e) => setHutangTanggal(e.target.value)} />
            </div>
            <div>
              <Label>Deskripsi</Label>
              <Input className="input-style h-10 rounded-full mt-1" value={hutangDeskripsi} onChange={(e) => setHutangDeskripsi(e.target.value)} placeholder="Hutang Karyawan" />
            </div>
          </ModalContentWrapper>
          <ModalFooter className="sm:justify-between">
            <Button className="rounded-full w-full sm:w-auto" variant="outline" onClick={() => setOpenHutang(false)}>Batal</Button>
            <Button className="rounded-full w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white" onClick={submitHutang} disabled={isSubmitting}>Simpan</Button>
          </ModalFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={openDeleteDetail} onOpenChange={setOpenDeleteDetail}>
        <DialogContent className="w-[92vw] sm:w-full sm:max-w-md rounded-2xl p-0 overflow-hidden [&>button.absolute]:hidden">
          <ModalHeader
            title="Hapus Transaksi"
            subtitle="Konfirmasi penghapusan transaksi"
            variant="emerald"
            icon={<TrashIcon className="h-5 w-5 text-white" />}
            onClose={() => setOpenDeleteDetail(false)}
          />
          <ModalContentWrapper className="space-y-3">
            <p className="text-sm text-gray-600">
              Apakah Anda yakin ingin menghapus transaksi ini? Tindakan tidak dapat dibatalkan.
            </p>
            {deleteDetail && (
              <div className="rounded-xl border bg-gray-50 p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Tanggal</span>
                  <span className="font-medium">
                    {format(new Date(deleteDetail.date), 'dd-MMM-yy', { locale: idLocale })}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-gray-600">Kategori</span>
                  <span className="font-medium">{deleteDetail.kategori}</span>
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-gray-600">Jumlah</span>
                  <span className={`font-semibold ${deleteDetail.kategori === 'HUTANG_KARYAWAN' ? 'text-red-600' : 'text-green-600'}`}>
                    Rp {Math.round(deleteDetail.jumlah).toLocaleString('id-ID')}
                  </span>
                </div>
                {deleteDetail.deskripsi ? (
                  <div className="mt-2">
                    <div className="text-gray-600">Deskripsi</div>
                    <div className="mt-0.5">{deleteDetail.deskripsi}</div>
                  </div>
                ) : null}
              </div>
            )}
          </ModalContentWrapper>
          <ModalFooter className="sm:justify-between">
            <Button className="rounded-full w-full sm:w-auto" variant="outline" onClick={() => setOpenDeleteDetail(false)} disabled={deleteLoading}>Batal</Button>
            <Button className="rounded-full w-full sm:w-auto" variant="destructive" onClick={confirmDeleteDetail} disabled={deleteLoading}>
              {deleteLoading ? 'Menghapus...' : 'Hapus'}
            </Button>
          </ModalFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={openDetail} onOpenChange={(v) => { setOpenDetail(v); if (!v) setHutangModalUser(null) }}>
        <DialogContent className="w-[92vw] sm:w-full sm:max-w-3xl max-h-[92vh] rounded-2xl p-0 overflow-hidden flex flex-col [&>button.absolute]:hidden">
          <ModalHeader
            title="Detail Hutang & Potongan"
            subtitle={hutangModalUser?.name || ''}
            variant="emerald"
            icon={<CreditCardIcon className="h-5 w-5 text-white" />}
            onClose={() => setOpenDetail(false)}
          />
          <ModalContentWrapper className="flex-1 min-h-0 overflow-y-auto">
            <div className="mb-4">
              <div className="flex items-center gap-3 text-sm mb-2">
                {hutangModalUser?.photoUrl ? (
                  <img
                    src={hutangModalUser.photoUrl}
                    alt={hutangModalUser.name}
                    className="w-10 h-10 rounded-full object-cover border border-gray-200"
                  />
                ) : (
                  <div className="w-10 h-10 bg-gray-900 rounded-full flex items-center justify-center text-white font-bold">
                    {hutangModalUser?.name ? hutangModalUser.name.charAt(0) : '?'}
                  </div>
                )}
                <div>
                  <div className="text-xs text-gray-500">Karyawan</div>
                  <div className="font-medium">{hutangModalUser?.name}</div>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="p-3 rounded-xl border bg-gray-50">
                  <div className="text-xs text-gray-600">Saldo Hutang</div>
                  <div className="text-base font-semibold">Rp {Math.round(totalHutangDetail).toLocaleString('id-ID')}</div>
                </div>
                <div className="p-3 rounded-xl border bg-gray-50">
                  <div className="text-xs text-gray-600">Potongan Terakhir</div>
                  <div className="text-base font-semibold">Rp {Math.round(lastPotonganDetail).toLocaleString('id-ID')}</div>
                </div>
                <div className="p-3 rounded-xl border bg-gray-50">
                  <div className="text-xs text-gray-600">Sisa Hutang</div>
                  <div className={`text-base font-semibold ${sisaHutangDetail > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    Rp {sisaHutangDetail.toLocaleString('id-ID')}
                  </div>
                </div>
              </div>
            </div>
            <div className="overflow-x-auto rounded-xl border shadow-sm overflow-hidden -mx-2 sm:mx-0">
              <table className="min-w-[600px] w-full text-sm whitespace-nowrap">
                <thead className="bg-emerald-600 text-white">
                  <tr>
                    <th className="p-3 text-left">TANGGAL</th>
                    <th className="p-3 text-right">HUTANG (RP)</th>
                    <th className="p-3 text-right">POTONGAN (RP)</th>
                    <th className="p-3 text-left">DESKRIPSI</th>
                    <th className="p-3 text-right">AKSI</th>
                  </tr>
                </thead>
                <tbody>
                  {detailLoading ? (
                    <tr><td className="p-2 border text-center" colSpan={5}>Memuat...</td></tr>
                  ) : detailRows.length === 0 ? (
                    <tr><td className="p-2 border text-center" colSpan={5}>Tidak ada data</td></tr>
                  ) : (
                    detailRows.map((d: any) => (
                      <tr key={d.id} className="border">
                        <td className="p-2 border">{format(new Date(d.date), 'dd-MMM-yy', { locale: idLocale })}</td>
                        <td className="p-2 border text-right">
                          {d.kategori === 'HUTANG_KARYAWAN' ? `Rp ${Math.round(d.jumlah).toLocaleString('id-ID')}` : ''}
                        </td>
                        <td className="p-2 border text-right">
                          {d.kategori === 'PEMBAYARAN_HUTANG' ? `Rp ${Math.round(d.jumlah).toLocaleString('id-ID')}` : ''}
                        </td>
                        <td className="p-2 border">{d.deskripsi}</td>
                        <td className="p-2 border text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="icon" className="rounded-full" aria-label="Edit" onClick={() => openEditDetailModal(d)}>
                              <PencilSquareIcon className="w-4 h-4" />
                            </Button>
                            {canDelete && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-red-600 hover:text-red-700"
                                aria-label="Hapus"
                                onClick={() => openDeleteDetailModal(d)}
                              >
                                <TrashIcon className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                <tfoot className="bg-emerald-50 text-emerald-800">
                  <tr>
                    <td className="p-3 font-medium text-right">TOTAL</td>
                    <td className="p-3 text-right font-semibold">Rp {Math.round(totalHutangDetail).toLocaleString('id-ID')}</td>
                    <td className="p-3 text-right font-semibold">Rp {Math.round(totalPotonganDetail).toLocaleString('id-ID')}</td>
                    <td className="p-3 font-medium" colSpan={2}>
                      Sisa Hutang: <span className={`${sisaHutangDetail > 0 ? 'text-red-600' : 'text-green-600'} font-semibold`}>Rp {sisaHutangDetail.toLocaleString('id-ID')}</span>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </ModalContentWrapper>
          <ModalFooter className="flex-row flex-nowrap gap-2 justify-end">
            <Button className="rounded-full" variant="outline" onClick={() => setOpenDetail(false)}>Tutup</Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button className="rounded-full" variant="destructive">Export</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-white">
                <DropdownMenuItem onClick={exportDetailPdf}>Export PDF</DropdownMenuItem>
                <DropdownMenuItem onClick={exportDetailCsv}>Export CSV</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </ModalFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={openEditDetail} onOpenChange={setOpenEditDetail}>
        <DialogContent className="w-[92vw] sm:w-full sm:max-w-md rounded-2xl p-0 overflow-hidden [&>button.absolute]:hidden">
          <ModalHeader
            title="Edit Transaksi"
            variant="emerald"
            icon={<PencilSquareIcon className="h-5 w-5 text-white" />}
            onClose={() => setOpenEditDetail(false)}
          />
          <ModalContentWrapper className="space-y-3">
            <div>
              <Label>Tanggal</Label>
              <Input type="date" className="input-style h-10 rounded-full mt-1" value={editDetailDate} onChange={(e) => setEditDetailDate(e.target.value)} />
            </div>
            <div>
              <Label>Jumlah</Label>
              <div className="relative mt-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">Rp</span>
                <Input
                  className="input-style h-10 pl-10 rounded-full"
                  value={editDetailJumlah}
                  onChange={(e) => setEditDetailJumlah(formatRibuanId(e.target.value))}
                  placeholder="contoh: 100.000"
                />
              </div>
            </div>
            <div>
              <Label>Deskripsi</Label>
              <Input className="input-style h-10 rounded-full mt-1" value={editDetailDeskripsi} onChange={(e) => setEditDetailDeskripsi(e.target.value)} />
            </div>
          </ModalContentWrapper>
          <ModalFooter className="sm:justify-between">
            <Button className="rounded-full w-full sm:w-auto" variant="outline" onClick={() => setOpenEditDetail(false)}>Batal</Button>
            <Button className="rounded-full w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white" onClick={submitEditDetail} disabled={!editDetailId}>Simpan</Button>
          </ModalFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={openHistory} onOpenChange={setOpenHistory}>
        <DialogContent className="w-[92vw] sm:w-full sm:max-w-lg max-h-[92vh] rounded-2xl p-0 overflow-hidden flex flex-col [&>button.absolute]:hidden">
          <ModalHeader
            title="Riwayat Penugasan"
            subtitle={historyUser?.name || ''}
            variant="emerald"
            icon={<ClockIcon className="h-5 w-5 text-white" />}
            onClose={() => setOpenHistory(false)}
          />
          <ModalContentWrapper className="space-y-3 flex-1 min-h-0 overflow-y-auto">
            <div className="text-sm">Karyawan: <span className="font-medium">{historyUser?.name || '-'}</span></div>
            {historyLoading ? (
              <div className="text-sm text-gray-500">Memuat...</div>
            ) : historyItems.length === 0 ? (
              <div className="text-sm text-gray-500">Belum ada riwayat penugasan</div>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {historyItems.map((h: any) => (
                  <div key={h.id} className="rounded-lg border border-gray-100 p-3">
                    <div className="text-sm font-semibold text-gray-900">{getLocationLabel(h.location)}</div>
                    <div className="text-xs text-gray-500 mt-1">
                      {format(new Date(h.startDate), 'dd-MMM-yy', { locale: idLocale })} - {h.endDate ? format(new Date(h.endDate), 'dd-MMM-yy', { locale: idLocale }) : 'Sekarang'}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">Status: {(h.status || '').toString().toUpperCase()}</div>
                  </div>
                ))}
              </div>
            )}
          </ModalContentWrapper>
          <ModalFooter className="sm:justify-end">
            <Button className="rounded-full" variant="outline" onClick={() => setOpenHistory(false)}>Tutup</Button>
          </ModalFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={openMove} onOpenChange={setOpenMove}>
        <DialogContent className="w-[92vw] sm:w-full sm:max-w-md max-h-[92vh] rounded-2xl p-0 overflow-hidden flex flex-col [&>button.absolute]:hidden">
          <ModalHeader
            title="Pindahkan Karyawan"
            subtitle={moveUser?.name || ''}
            variant="emerald"
            icon={<ArrowPathIcon className="h-5 w-5 text-white" />}
            onClose={() => setOpenMove(false)}
          />
          <ModalContentWrapper className="space-y-4 flex-1 min-h-0 overflow-y-auto">
            <div>
              <Label>Nama</Label>
              <div className="mt-1 text-sm">{moveUser?.name || '-'}</div>
            </div>
            <div>
              <Label>Lokasi Tujuan</Label>
              <select
                className="input-style w-full rounded-full mt-1"
                value={moveLocationId ?? ''}
                onChange={(e) => setMoveLocationId(Number(e.target.value))}
              >
                <option value="" disabled>Pilih lokasi</option>
                {workLocations.map((loc: any) => (
                  <option key={loc.id} value={loc.id}>{getLocationLabel(loc)}</option>
                ))}
              </select>
            </div>
            <div>
              <Label>Tanggal Mulai</Label>
              <Input
                type="date"
                className="input-style h-10 rounded-full mt-1"
                value={moveDate}
                onChange={(e) => setMoveDate(e.target.value)}
              />
            </div>
          </ModalContentWrapper>
          <ModalFooter className="sm:justify-between">
            <Button className="rounded-full w-full sm:w-auto" variant="outline" onClick={() => setOpenMove(false)}>Batal</Button>
            <Button className="rounded-full w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleMove} disabled={moveLoading || !moveUser || !moveLocationId || !moveDate}>Simpan</Button>
          </ModalFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={openPotong} onOpenChange={(v) => { setOpenPotong(v); if (!v) setHutangModalUser(null) }}>
        <DialogContent className="w-[92vw] sm:w-full sm:max-w-md rounded-2xl p-0 overflow-hidden [&>button.absolute]:hidden">
          <ModalHeader
            title="Potong Hutang"
            variant="emerald"
            icon={<MinusCircleIcon className="h-5 w-5 text-white" />}
            onClose={() => setOpenPotong(false)}
          />
          <ModalContentWrapper className="space-y-4">
            <div>
              <Label>Nama</Label>
              <div className="mt-1 text-sm">{hutangModalUser?.name}</div>
            </div>
            <div>
              <Label>Jumlah</Label>
              <div className="relative mt-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">Rp</span>
                <Input
                  className="input-style h-10 pl-10 rounded-full"
                  value={potongJumlah}
                  onChange={(e) => setPotongJumlah(formatRibuanId(e.target.value))}
                  placeholder="contoh: 100.000"
                />
              </div>
            </div>
            <div>
              <Label>Tanggal</Label>
              <Input type="date" className="input-style h-10 rounded-full mt-1" value={potongTanggal} onChange={(e) => setPotongTanggal(e.target.value)} />
            </div>
            <div>
              <Label>Deskripsi</Label>
              <Input className="input-style h-10 rounded-full mt-1" value={potongDeskripsi} onChange={(e) => setPotongDeskripsi(e.target.value)} placeholder="Pembayaran Hutang Karyawan" />
            </div>
          </ModalContentWrapper>
          <ModalFooter className="sm:justify-between">
            <Button className="rounded-full w-full sm:w-auto" variant="outline" onClick={() => setOpenPotong(false)}>Batal</Button>
            <Button className="rounded-full w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white" onClick={submitPotong} disabled={isSubmitting}>Simpan</Button>
          </ModalFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={openAddEditKaryawan} onOpenChange={setOpenAddEditKaryawan}>
        <DialogContent className="w-[92vw] sm:w-full sm:max-w-xl max-h-[92vh] rounded-2xl p-0 overflow-hidden flex flex-col [&>button.absolute]:hidden">
          <ModalHeader
            title={editKaryawan ? 'Edit Karyawan' : 'Tambah Karyawan'}
            variant="emerald"
            icon={<UserGroupIcon className="h-5 w-5 text-white" />}
            onClose={() => setOpenAddEditKaryawan(false)}
          />
          <ModalContentWrapper className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1 min-h-0 overflow-y-auto">
            <div className="space-y-2">
              <Label>Nama</Label>
              <Input className="rounded-full" value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Nama lengkap" />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Foto Profil (Opsional)</Label>
              <ImageUpload
                previewUrl={formPhotoPreview}
                onFileChange={(file) => {
                  setFormPhotoFile(file)
                  if (!file) {
                    setFormPhotoPreview(null)
                    return
                  }
                  setFormPhotoPreview(URL.createObjectURL(file))
                }}
              />
            </div>
            <div className="space-y-2">
              <Label>Jenis Pekerjaan</Label>
              <select
                className="input-style w-full rounded-full"
                value={formJobType}
                onChange={(e) => {
                  const val = e.target.value
                  setFormJobType(val)
                  if (val !== 'KEBUN') setFormKebunId(null)
                  if (val !== 'OPERATOR') setFormKendaraanPlatNomor('')
                }}
              >
                <option value="KEBUN">Karyawan Kebun</option>
                <option value="BULANAN">Karyawan Bulanan</option>
                <option value="HARIAN">Pekerja Harian</option>
                <option value="TUKANG BANGUNAN">Tukang Bangunan</option>
                <option value="OPERATOR">Operator</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>Tanggal Mulai Bekerja</Label>
              <Input
                type="date"
                className="rounded-full"
                value={formTanggalMulaiBekerja}
                onChange={(e) => setFormTanggalMulaiBekerja(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Peran (Role)</Label>
              <select
                className="input-style w-full rounded-full"
                value={formRole}
                onChange={(e) => setFormRole(e.target.value)}
              >
                <option value="KARYAWAN">Karyawan</option>
                <option value="SUPIR">Supir</option>
                <option value="MANDOR">Mandor</option>
                <option value="MANAGER">Manager</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <select
                className="input-style w-full rounded-full"
                value={formStatus}
                onChange={(e) => setFormStatus(e.target.value)}
              >
                <option value="AKTIF">Aktif</option>
                <option value="NONAKTIF">Nonaktif</option>
              </select>
            </div>
            {formJobType === 'OPERATOR' && (
              <div className="space-y-2">
                <Label>Kendaraan (Alat Berat)</Label>
                <select
                  className="input-style w-full rounded-full"
                  value={formKendaraanPlatNomor}
                  onChange={(e) => setFormKendaraanPlatNomor(e.target.value)}
                >
                  <option value="">Pilih kendaraan</option>
                  {alatBeratList.map((k: any) => (
                    <option key={k.platNomor} value={k.platNomor}>
                      {k.platNomor}{k.merk ? ` - ${k.merk}` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {formJobType === 'KEBUN' && (
              <div className="space-y-2">
                <Label>Kebun</Label>
                <Popover open={openKebunCombo} onOpenChange={setOpenKebunCombo}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="input-style w-full rounded-full flex items-center justify-between"
                      aria-haspopup="listbox"
                    >
                      <span>
                        {formKebunId
                          ? (kebunList.find((k: any) => k.id === formKebunId)?.name ?? 'Pilih kebun')
                          : 'Pilih kebun'}
                      </span>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-500" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 10.939l3.71-3.71a.75.75 0 111.06 1.061l-4.24 4.24a.75.75 0 01-1.06 0l-4.24-4.24a.75.75 0 01.02-1.06z" clipRule="evenodd" /></svg>
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="p-2 w-[--radix-popover-trigger-width] max-h-60 overflow-y-auto bg-white rounded-xl border shadow-sm">
                    <Input
                      autoFocus
                      placeholder="Cari kebun…"
                      value={kebunQuery}
                      onChange={(e) => setKebunQuery(e.target.value)}
                      className="mb-2 rounded-full"
                    />
                    <div role="listbox" className="space-y-1">
                      {kebunList
                        .filter((k: any) => k.name.toLowerCase().includes(kebunQuery.toLowerCase()))
                        .map((k: any) => (
                          <button
                            key={k.id}
                            type="button"
                            onClick={() => { setFormKebunId(k.id); setOpenKebunCombo(false) }}
                            className={`w-full text-left px-3 py-2 rounded-lg hover:bg-gray-50 ${formKebunId === k.id ? 'bg-emerald-50 text-emerald-700' : ''}`}
                          >
                            {k.name}
                          </button>
                        ))}
                      {kebunList.filter((k: any) => k.name.toLowerCase().includes(kebunQuery.toLowerCase())).length === 0 && (
                        <div className="px-3 py-2 text-sm text-gray-500">Tidak ditemukan</div>
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            )}
          </ModalContentWrapper>
          <ModalFooter className="sm:justify-between">
            <Button className="rounded-full w-full sm:w-auto" variant="outline" onClick={() => setOpenAddEditKaryawan(false)}>Batal</Button>
            <Button className="rounded-full w-full sm:w-auto bg-emerald-600 text-white hover:bg-emerald-700" onClick={async () => {
              if (!formName) {
                toast.error('Nama wajib diisi')
                return
              }
              let photoUrl: string | null | undefined = undefined
              if (formPhotoFile) {
                const fd = new FormData()
                fd.append('file', formPhotoFile)
                const up = await fetch('/api/upload', { method: 'POST', body: fd })
                const upJson = await up.json().catch(() => ({} as any))
                if (!up.ok || !upJson?.success) {
                  toast.error(upJson?.error || 'Upload foto profil gagal')
                  return
                }
                photoUrl = upJson.url
              } else if (editKaryawan?.photoUrl && !formPhotoPreview) {
                photoUrl = null
              }
              const payload: any = {
                name: formName,
                jobType: formJobType,
                jenisPekerjaan: formJobType,
                status: formStatus,
                role: formRole,
              }
              payload.tanggalMulaiBekerja = formTanggalMulaiBekerja || null
              if (typeof photoUrl !== 'undefined') payload.photoUrl = photoUrl
              payload.kendaraanPlatNomor = formJobType === 'OPERATOR' ? (formKendaraanPlatNomor || null) : null
              if (formJobType === 'KEBUN') {
                if (formKebunId) payload.kebunId = formKebunId
              } else {
                payload.kebunId = null
              }
              const res = await fetch(editKaryawan ? `/api/karyawan/${editKaryawan.id}` : '/api/karyawan', {
                method: editKaryawan ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
              })
              if (res.ok) {
                setOpenAddEditKaryawan(false)
                setEditKaryawan(null)
                setFormName(''); setFormPhotoFile(null); setFormPhotoPreview(null); setFormKebunId(null); setFormJobType('KEBUN'); setFormStatus('AKTIF'); setFormRole('KARYAWAN'); setFormTanggalMulaiBekerja(''); setFormKendaraanPlatNomor('')
                toast.success(editKaryawan ? 'Karyawan diperbarui' : 'Karyawan ditambahkan')
                await mutateKaryawan()
              } else {
                const err = await res.json()
                toast.error(err.error || 'Gagal menyimpan karyawan')
              }
            }}>{editKaryawan ? 'Simpan' : 'Tambah'}</Button>
          </ModalFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={openPayroll} onOpenChange={setOpenPayroll}>
        <DialogContent className="w-[92vw] sm:w-full sm:max-w-4xl max-h-[92vh] rounded-2xl p-0 overflow-hidden [&>button.absolute]:hidden flex flex-col">
          <ModalHeader
            title="Potong Hutang Masal"
            variant="emerald"
            icon={<MinusCircleIcon className="h-5 w-5 text-white" />}
            onClose={() => setOpenPayroll(false)}
          />

          <ModalContentWrapper className="space-y-4 overflow-y-auto flex-1 min-h-0">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <Label>Nominal</Label>
                <Input className="rounded-full mt-1" value={massNominal} onChange={(e) => setMassNominal(formatRibuanId(e.target.value))} placeholder="contoh: 100.000" />
                <div className="mt-2">
                  <Button className="rounded-full bg-emerald-600 text-white hover:bg-emerald-700 w-full md:w-auto" onClick={() => {
                    const val = Number(massNominal.toString().replace(/\D/g, '')) || 0
                    const next: Record<number, string> = {}
                    rows.forEach((r: any) => {
                      const saldo = Math.max(0, Math.round(r.hutangSaldo || 0))
                      if (saldo <= 0 || val <= 0) {
                        next[r.karyawan.id] = ''
                        return
                      }
                      const amount = Math.min(val, saldo)
                      next[r.karyawan.id] = amount > 0 ? formatRibuanId(String(amount)) : ''
                    })
                    setPotongMap(next)
                  }}>Isi ke semua karyawan</Button>
                </div>
              </div>
              <div>
                <Label>Tanggal</Label>
                <Input type="date" className="mt-1 rounded-full" value={massDate} onChange={(e) => setMassDate(e.target.value)} />
              </div>
              <div>
                <Label>Deskripsi</Label>
                <Input className="mt-1 rounded-full" value={massDesc} onChange={(e) => setMassDesc(e.target.value)} placeholder="Deskripsi potongan" />
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-gray-100">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50">
                  <tr className="border-b">
                    <th className="p-2 text-left">NO</th>
                    <th className="p-2 text-left">NAMA</th>
                    <th className="p-2 text-left">TANGGAL</th>
                    <th className="p-2 text-right">SALDO</th>
                    <th className="p-2 text-right">POTONG</th>
                    <th className="p-2 text-right">SISA</th>
                    <th className="p-2 text-left">KETERANGAN</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rows.map((r: any, idx: number) => {
                    const saldo = Math.round(r.hutangSaldo)
                    const safeSaldo = Math.max(0, saldo || 0)
                    const sisa = Math.max(0, safeSaldo - (potongEffectiveById[r.karyawan.id] || 0))
                    return (
                      <tr key={r.karyawan.id}>
                        <td className="p-2">{idx + 1}</td>
                        <td className="p-2">{r.karyawan.name}</td>
                        <td className="p-2">{formatShort(endDate || format(new Date(), 'yyyy-MM-dd'))}</td>
                        <td className="p-2 text-right">Rp {safeSaldo.toLocaleString('id-ID')}</td>
                        <td className="p-2">
                          <Input
                            className="rounded-full h-9 text-right"
                            value={potongMap[r.karyawan.id] || ''}
                            onChange={(e) => setPotongMap((prev: any) => ({ ...prev, [r.karyawan.id]: formatRibuanId(e.target.value) }))}
                            onBlur={() => {
                              setPotongMap((prev: any) => {
                                const raw = prev[r.karyawan.id] || ''
                                const num = Number(raw.toString().replace(/\./g, '').replace(/,/g, '')) || 0
                                const amount = safeSaldo <= 0 ? 0 : Math.min(Math.max(0, num), safeSaldo)
                                const nextVal = amount > 0 ? formatRibuanId(String(amount)) : ''
                                if ((prev[r.karyawan.id] || '') === nextVal) return prev
                                return { ...prev, [r.karyawan.id]: nextVal }
                              })
                            }}
                            placeholder="0"
                            disabled={safeSaldo <= 0}
                          />
                        </td>
                        <td className="p-2 text-right">Rp {sisa.toLocaleString('id-ID')}</td>
                        <td className="p-2" />
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot className="bg-gray-50 border-t">
                  <tr>
                    <td className="p-2 font-medium" colSpan={4}>JUMLAH</td>
                    <td className="p-2 font-semibold text-right">Rp {Math.round(totalPotong).toLocaleString('id-ID')}</td>
                    <td className="p-2 font-semibold text-right">Rp {Math.round(totalSisa).toLocaleString('id-ID')}</td>
                    <td className="p-2" />
                  </tr>
                </tfoot>
              </table>
            </div>
          </ModalContentWrapper>

          <ModalFooter className="sm:justify-between">
            <Button className="rounded-full w-full sm:w-auto" variant="outline" onClick={() => setOpenPayroll(false)} disabled={isSubmitting}>Batal</Button>
            <Button className="rounded-full w-full sm:w-auto bg-emerald-600 text-white hover:bg-emerald-700" onClick={submitPayrollCuts} disabled={isSubmitting}>Simpan</Button>
          </ModalFooter>
        </DialogContent>
      </Dialog>

      <ConfirmationModal
        isOpen={openCancelPaid}
        onClose={() => { setOpenCancelPaid(false); setCancelPaidDate('') }}
        onConfirm={handleCancelPaidDate}
        title="Konfirmasi Batalkan Pembayaran Gaji"
        description="Apakah Anda yakin ingin membatalkan pembayaran gaji untuk tanggal ini? Tindakan tidak dapat dibatalkan."
        variant="emerald"
      />

      <ConfirmationModal
        isOpen={openDeleteAbsenPay}
        onClose={() => { setOpenDeleteAbsenPay(false); setDeleteAbsenPayId(null); setDeleteAbsenPayPaidAt('') }}
        onConfirm={handleDeleteAbsenPay}
        title="Konfirmasi Hapus Pembayaran Gaji"
        description="Apakah Anda yakin ingin menghapus pembayaran gaji ini? Tindakan tidak dapat dibatalkan."
        variant="emerald"
      />

      <ConfirmationModal
        isOpen={openDeleteKaryawan}
        onClose={() => { setOpenDeleteKaryawan(false); setDeleteKaryawanId(null) }}
        onConfirm={async () => {
          if (deleteKaryawanId == null) return
          const res = await fetch(`/api/karyawan/${deleteKaryawanId}`, { method: 'DELETE' })
          if (res.ok) {
            toast.success('Karyawan dihapus')
            await mutateKaryawan()
          } else if (res.status === 202) {
            toast.success('Permintaan penghapusan diajukan')
          } else {
            const err = await res.json().catch(() => ({} as any))
            toast.error((err as any).error || 'Gagal menghapus karyawan')
          }
          setOpenDeleteKaryawan(false)
          setDeleteKaryawanId(null)
        }}
        title="Konfirmasi Hapus Karyawan"
        description={canRequestDelete ? 'Permintaan Anda akan dikirim untuk persetujuan admin/pemilik.' : 'Apakah Anda yakin ingin menghapus karyawan ini? Tindakan tidak dapat dibatalkan.'}
        variant="emerald"
      />
    </>
  )
}
