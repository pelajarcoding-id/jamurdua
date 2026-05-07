import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
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
import { parseIdThousandInt } from '@/lib/utils'
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
  XCircleIcon,
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
        <DialogContent className="w-[92vw] sm:w-full sm:max-w-md bg-white rounded-3xl p-0 overflow-hidden shadow-2xl border-none [&>button.absolute]:hidden flex flex-col max-h-[85vh]">
          <DialogTitle className="sr-only">Detail Absensi {selectedUser?.name}</DialogTitle>
          <DialogDescription className="sr-only">Rincian kehadiran dan upah karyawan.</DialogDescription>
          <ModalHeader
            title={selectedUser?.name || 'Detail Absensi'}
            subtitle={absenSelectedDate ? format(new Date(absenSelectedDate), 'EEEE, dd MMMM yyyy', { locale: idLocale }) : ''}
            variant="emerald"
            onClose={() => setOpenAbsenView(false)}
          />

          <ModalContentWrapper className="space-y-4 py-6 overflow-y-auto scrollbar-hide flex-1" id="absen-view-content">
            <div className="p-5 rounded-2xl border border-gray-100 bg-white flex items-center gap-4 shadow-sm">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${absenOffMap[absenSelectedDate] ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'}`}>
                {absenOffMap[absenSelectedDate] ? <XCircleIcon className="w-8 h-8" /> : <CheckCircleIcon className="w-8 h-8" />}
              </div>
              <div>
                <h4 className="text-sm font-black uppercase tracking-wider text-emerald-900">
                  {absenOffMap[absenSelectedDate] ? 'LIBUR / IJIN' : 'MASUK KERJA'}
                </h4>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Status Kehadiran</p>
              </div>
            </div>

            <div className="p-5 rounded-2xl border border-gray-100 bg-white flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                  <ClockIcon className="w-6 h-6" />
                </div>
                <h4 className="text-[11px] font-black uppercase tracking-widest text-gray-500">Upah Per Jam</h4>
              </div>
              <div className="text-right">
                <p className="text-sm font-black text-gray-900">
                  {absenHourlyMap[absenSelectedDate] ? `${absenHourMap[absenSelectedDate]} Jam` : '-'}
                </p>
                {absenHourlyMap[absenSelectedDate] && (
                  <p className="text-[9px] font-bold text-gray-400 uppercase">@ Rp {absenRateMap[absenSelectedDate]}</p>
                )}
              </div>
            </div>

            <div className="p-5 rounded-2xl border border-gray-100 bg-white flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center text-orange-600">
                  <CurrencyDollarIcon className="w-6 h-6" />
                </div>
                <h4 className="text-[11px] font-black uppercase tracking-widest text-gray-500">Uang Makan</h4>
              </div>
              <p className="text-sm font-black text-gray-900">Rp {absenMealEnabledMap[absenSelectedDate] ? absenMealMap[absenSelectedDate] : '0'}</p>
            </div>

            <div className="p-5 rounded-2xl border border-gray-100 bg-white flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                  <BanknotesIcon className="w-6 h-6" />
                </div>
                <h4 className="text-[11px] font-black uppercase tracking-widest text-gray-500">Gaji Harian / Tambahan</h4>
              </div>
              <p className="text-sm font-black text-gray-900">Rp {(absenMap[absenSelectedDate] ? parseIdThousandInt(absenMap[absenSelectedDate]).toLocaleString('id-ID') : '0')}</p>
            </div>

            {absenNoteMap[absenSelectedDate] && (
              <div className="p-4 rounded-2xl bg-gray-50 border border-gray-100 italic text-xs text-gray-500">
                &quot;{absenNoteMap[absenSelectedDate]}&quot;
              </div>
            )}

            <div className={`mt-4 p-5 rounded-3xl flex items-center justify-center relative overflow-hidden ${absenPaidMap[absenSelectedDate] ? 'bg-purple-50 text-purple-700' : 'bg-orange-50 text-orange-700'}`}>
              <span className="text-xs font-black uppercase tracking-[0.2em] z-10">
                {absenPaidMap[absenSelectedDate] ? 'SUDAH TERBAYAR / LUNAS' : 'BELUM DIBAYAR'}
              </span>
              {absenPaidMap[absenSelectedDate] && (
                <div className="absolute right-[-10px] top-[-10px] opacity-10 rotate-12">
                  <div className="border-4 border-purple-700 rounded-full p-4 font-black text-3xl">PAID</div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between px-2 pt-2 border-t border-gray-100">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Total Diterima</span>
              <span className="text-xl font-black text-gray-900 tracking-tight">Rp {(absenMap[absenSelectedDate] ? parseIdThousandInt(absenMap[absenSelectedDate]).toLocaleString('id-ID') : '0')}</span>
            </div>
          </ModalContentWrapper>

          <ModalFooter className="flex items-center gap-2">
            {!absenPaidMap[absenSelectedDate] && (
              <>
                <Button
                  variant="ghost"
                  className="flex-1 rounded-2xl h-12 font-bold text-blue-600 hover:bg-blue-50"
                  onClick={() => {
                    setOpenAbsenView(false)
                    setAbsenOpen(true)
                  }}
                >
                  <PencilSquareIcon className="w-5 h-5 mr-2" />
                  Ubah
                </Button>
                <Button
                  variant="ghost"
                  className="flex-1 rounded-2xl h-12 font-bold text-red-600 hover:bg-red-50"
                  onClick={() => setOpenDeleteAbsenConfirm(true)}
                  disabled={isDeletingAbsen || (absenSelectedDate ? String(absenSourceMap[absenSelectedDate] || '').toUpperCase() === 'SELFIE' : false)}
                >
                  <TrashIcon className="w-5 h-5 mr-2" />
                  {isDeletingAbsen ? 'Hapus...' : 'Hapus'}
                </Button>
              </>
            )}
            {absenPaidMap[absenSelectedDate] && (
              <Button
                variant="ghost"
                className="rounded-2xl h-12 font-bold text-amber-600 hover:bg-amber-50 flex-1"
                onClick={() => {
                  setOpenAbsenView(false)
                  setCancelPaidDate(absenSelectedDate)
                  setOpenCancelPaid(true)
                }}
              >
                <ArrowPathIcon className="w-5 h-5 mr-2" />
                Batalkan Gaji
              </Button>
            )}
            <Button
              className={`rounded-2xl h-12 font-bold ${absenPaidMap[absenSelectedDate] ? 'w-24 bg-gray-100 hover:bg-gray-200 text-gray-900' : 'w-24 bg-gray-100 hover:bg-gray-200 text-gray-900'} shadow-none transition-all active:scale-95`}
              onClick={() => setOpenAbsenView(false)}
            >
              Tutup
            </Button>
          </ModalFooter>
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
          <DialogTitle className="sr-only">Input Absensi</DialogTitle>
          <DialogDescription className="sr-only">Formulir absensi harian karyawan.</DialogDescription>
          <ModalHeader
            title="Input Absensi"
            subtitle={absenSelectedDate ? format(new Date(absenSelectedDate), 'EEEE, dd MMMM yyyy', { locale: idLocale }) : ''}
            variant="emerald"
            icon={<CalendarIcon className="h-5 w-5 text-white" />}
            onClose={() => setAbsenOpen(false)}
          />
          <ModalContentWrapper className="space-y-5 overflow-y-auto flex-1 min-h-0 scrollbar-hide">
            {absenSelectedDate && absenPaidMap[absenSelectedDate] && (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-100 text-xs text-amber-700">
                Tanggal ini sudah digaji. Batalkan digaji untuk mengubah data.
              </div>
            )}
            {absenSelectedDate && String(absenSourceMap[absenSelectedDate] || '').toUpperCase() === 'SELFIE' && (
              <div className="p-3 rounded-xl bg-blue-50 border border-blue-100 text-xs text-blue-700">
                Absensi pada tanggal ini dari Absensi Selfie.
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => {
                  setAbsenWork(true)
                  setAbsenOff(false)
                  if (!absenValue && absenDefaultAmount > 0) {
                    setAbsenValue(formatRibuanId(String(absenDefaultAmount)))
                  }
                }}
                disabled={!!absenSelectedDate && !!absenPaidMap[absenSelectedDate]}
                className={`flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all gap-2 ${
                  absenWork
                    ? 'bg-emerald-50 border-emerald-500 text-emerald-700'
                    : 'bg-white border-gray-100 text-gray-400 hover:border-gray-200'
                } ${absenSelectedDate && absenPaidMap[absenSelectedDate] ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${absenWork ? 'bg-emerald-100' : 'bg-gray-50'}`}>
                  <span className="text-xl">{'\u2705'}</span>
                </div>
                <span className="text-xs font-bold uppercase tracking-wider">Masuk</span>
              </button>
              <button
                onClick={() => {
                  setAbsenOff(true)
                  setAbsenWork(false)
                  setAbsenValue('0')
                  setAbsenUseHourly(false)
                  setAbsenHour('')
                  setAbsenRate('')
                  setAbsenMealEnabled(false)
                  setAbsenMealAmount('')
                }}
                disabled={!!absenSelectedDate && !!absenPaidMap[absenSelectedDate]}
                className={`flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all gap-2 ${
                  absenOff
                    ? 'bg-red-50 border-red-500 text-red-700'
                    : 'bg-white border-gray-100 text-gray-400 hover:border-gray-200'
                } ${absenSelectedDate && absenPaidMap[absenSelectedDate] ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${absenOff ? 'bg-red-100' : 'bg-gray-50'}`}>
                  <span className="text-xl">{'\uD83C\uDFE0'}</span>
                </div>
                <span className="text-xs font-bold uppercase tracking-wider">Libur</span>
              </button>
            </div>

            {!absenOff && (
              <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="p-4 rounded-2xl bg-gray-50/50 border border-gray-100 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center">
                        <ClockIcon className="w-4 h-4 text-indigo-600" />
                      </div>
                      <label className="text-sm font-bold text-gray-700">Hitung Per Jam</label>
                    </div>
                    <Switch
                      checked={absenUseHourly}
                      onCheckedChange={(v) => setAbsenUseHourly(v)}
                      disabled={!!absenSelectedDate && !!absenPaidMap[absenSelectedDate]}
                    />
                  </div>

                  {absenUseHourly && (
                    <div className="grid grid-cols-2 gap-3 animate-in zoom-in-95 duration-200">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Durasi (Jam)</label>
                        <Input
                          type="text"
                          placeholder="0"
                          value={absenHour}
                          onChange={(e) => setAbsenHour(e.target.value.replace(',', '.'))}
                          disabled={!!absenSelectedDate && !!absenPaidMap[absenSelectedDate]}
                          className="rounded-xl h-10 bg-white border-2 border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-600 transition-all"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Upah / Jam</label>
                        <Input
                          type="text"
                          placeholder="0"
                          value={absenRate}
                          onChange={(e) => setAbsenRate(formatRibuanId(e.target.value))}
                          disabled={!!absenSelectedDate && !!absenPaidMap[absenSelectedDate]}
                          className="rounded-xl h-10 bg-white border-2 border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-600 transition-all"
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center">
                        <CurrencyDollarIcon className="w-4 h-4 text-orange-600" />
                      </div>
                      <label className="text-sm font-bold text-gray-700">Uang Makan</label>
                    </div>
                    <Switch
                      checked={absenMealEnabled}
                      onCheckedChange={(v) => setAbsenMealEnabled(v)}
                      disabled={!!absenSelectedDate && !!absenPaidMap[absenSelectedDate]}
                    />
                  </div>

                  {absenMealEnabled && (
                    <div className="animate-in zoom-in-95 duration-200">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Jumlah Uang Makan</label>
                      <Input
                        type="text"
                        placeholder="0"
                        value={absenMealAmount}
                        onChange={(e) => {
                          const next = formatRibuanId(e.target.value)
                          setAbsenMealAmount(next)
                          if (next) {
                            setAbsenWork(true)
                            setAbsenOff(false)
                          }
                        }}
                        disabled={!!absenSelectedDate && !!absenPaidMap[absenSelectedDate]}
                        className="rounded-xl h-10 bg-white border-2 border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-600 transition-all mt-1.5"
                      />
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between px-1">
                    <label className="text-sm font-bold text-gray-700">Gaji Harian / Tambahan</label>
                  </div>
                  <div className="relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-sm">Rp</div>
                    <Input
                      placeholder="0"
                      value={absenValue}
                      onChange={(e) => {
                        const next = formatRibuanId(e.target.value)
                        setAbsenValue(next)
                        if (next) {
                          setAbsenWork(true)
                          setAbsenOff(false)
                        }
                      }}
                      disabled={!!absenSelectedDate && !!absenPaidMap[absenSelectedDate]}
                      className="rounded-2xl h-14 pl-12 text-lg font-black border-2 border-emerald-500 bg-white focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-600 transition-all duration-200 shadow-md text-gray-900"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between px-2 pt-3 border-t border-gray-100">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Total Diterima</span>
                  <span className="text-xl font-black text-gray-900 tracking-tight">Rp {(() => {
                    const manual = parseIdThousandInt(absenValue)
                    const hourly = !absenUseHourly ? 0 : (parseFloat((absenHour || '').toString().replace(',', '.')) || 0) * parseIdThousandInt(absenRate)
                    const meal = !absenMealEnabled ? 0 : parseIdThousandInt(absenMealAmount)
                    return Math.round(manual + hourly + meal).toLocaleString('id-ID')
                  })()}</span>
                </div>
              </div>
            )}

            <div className="flex items-center gap-2">
              <Switch
                checked={absenSetDefault}
                disabled={!!absenSelectedDate && !!absenPaidMap[absenSelectedDate]}
                onCheckedChange={setAbsenSetDefault}
              />
              <label className="text-xs text-gray-500">Jadikan upah ini sebagai default harian</label>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-700 px-1">Catatan</label>
              <Input
                placeholder="Contoh: Lembur 2 jam, Izin pulang cepat..."
                value={absenNote}
                onChange={(e) => setAbsenNote(e.target.value)}
                disabled={!!absenSelectedDate && !!absenPaidMap[absenSelectedDate]}
                className="rounded-2xl h-12 border-2 border-emerald-500 bg-gray-50/50 focus:bg-white focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-600 transition-all"
              />
            </div>
          </ModalContentWrapper>
          <ModalFooter className="gap-2">
            <div className="flex items-center gap-2 flex-1">
              {canDelete && absenSelectedDate && absenPaidMap[absenSelectedDate] && (
                <Button
                  className="rounded-2xl bg-red-500 text-white hover:bg-red-600 h-12"
                  onClick={() => {
                    setCancelPaidDate(absenSelectedDate)
                    setOpenCancelPaid(true)
                  }}
                >
                  Batalkan Gaji
                </Button>
              )}
              <Button
                variant="ghost"
                className="rounded-2xl text-gray-400 hover:text-gray-600 h-12 flex-1"
                onClick={() => setAbsenOpen(false)}
              >
                Batal
              </Button>
            </div>
            <Button
              className="rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white px-8 h-12 font-bold shadow-lg shadow-emerald-200"
              disabled={absenSaving || (!!absenSelectedDate && !!absenPaidMap[absenSelectedDate]) || (!absenWork && !absenOff)}
              onClick={async () => {
                if (!absenSelectedDate) return
                if (!absenUserId) {
                  toast.error('Pilih karyawan terlebih dahulu')
                  return
                }
                const kebunKey = selectedKebunId ?? 0
                const baseManual = parseIdThousandInt(absenValue)
                const hours = parseFloat((absenHour || '').toString().replace(',', '.')) || 0
                const rate = parseIdThousandInt(absenRate)
                const baseHourly = hours * rate
                const useHourly = absenUseHourly && hours > 0 && rate > 0
                const mealVal = absenMealEnabled ? parseIdThousandInt(absenMealAmount) : 0
                const totalAmount = Math.round(((useHourly ? baseHourly : 0) + baseManual) + mealVal)
                const totalFormatted = totalAmount ? formatRibuanId(String(totalAmount)) : ''
                const nextAmount = { ...absenMap, [absenSelectedDate]: totalFormatted }
                const nextWork = { ...absenWorkMap, [absenSelectedDate]: absenWork || totalAmount > 0 }
                const nextOff = { ...absenOffMap, [absenSelectedDate]: absenOff }
                const nextNote = { ...absenNoteMap, [absenSelectedDate]: absenNote }
                const nextHourly = { ...absenHourlyMap, [absenSelectedDate]: useHourly }
                const nextHour = { ...absenHourMap, [absenSelectedDate]: useHourly ? absenHour : '' }
                const nextRate = { ...absenRateMap, [absenSelectedDate]: useHourly ? absenRate : '' }
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
                  useHourly,
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
                  const num = parseIdThousandInt(absenValue)
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
                      placeholder="Cari kebunâ€¦"
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
                    const val = parseIdThousandInt(massNominal)
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
                                const num = parseIdThousandInt(raw)
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
