'use client'

import { useState, useRef, useEffect } from 'react'
import { useAuth } from '@/components/AuthProvider'
import { ConfirmationModal } from '@/components/ui/confirmation-modal'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { id as idLocale } from 'date-fns/locale'

import { useAttendance } from './hooks/useAttendance'
import { useAbsensiData } from './hooks/useAbsensiData'
import { useAbsensiActions } from './hooks/useAbsensiActions'
import { useAbsensiDetail } from './hooks/useAbsensiDetail'
import { AbsensiSummaryCards } from './components/absensi/AbsensiSummaryCards'
import { AbsensiKaryawanTable } from './components/absensi/AbsensiKaryawanTable'
import { AbsensiCalendar } from './components/absensi/AbsensiCalendar'
import { AbsensiHutangTable } from './components/absensi/AbsensiHutangTable'
import { AbsensiAddKaryawanModal } from './components/absensi/AbsensiAddKaryawanModal'
import { AbsensiEditKaryawanModal } from './components/absensi/AbsensiEditKaryawanModal'
import { AbsensiDetailHutangModal } from './components/absensi/AbsensiDetailHutangModal'
import { AbsensiDetailPayModal } from './components/absensi/AbsensiDetailPayModal'
import { AbsensiInputModal } from './components/absensi/AbsensiInputModal'
import { AbsensiViewModal } from './components/absensi/AbsensiViewModal'
import { User } from './types'

export default function AbsensiTab({ kebunId }: { kebunId: number }) {
  const { role } = useAuth()
  const isAdminOrOwner = role === 'ADMIN' || role === 'PEMILIK' || role === 'MANAGER' || role === 'MANDOR'
  const isManagerOrMandor = role === 'MANAGER' || role === 'MANDOR'
  const canSeeDebtDetail = isAdminOrOwner

  const [absenMonth, setAbsenMonth] = useState<Date>(new Date())
  const [selectedUser, setSelectedUser] = useState<User | null>(null)

  const {
    rows,
    filteredRows,
    pagedKaryawanRows,
    pagedHutangRows,
    loadingSummary,
    karyawanSearch, setKaryawanSearch,
    karyawanPage, setKaryawanPage,
    karyawanTotalPages,
    karyawanStartIndex,
    karyawanPerView, setKaryawanPerView,
    hutangPage, setHutangPage,
    hutangTotalPages,
    hutangStartIndex,
    hutangPerView, setHutangPerView,
    totals,
    mutateSummary,
    mutateKaryawanList,
    formatDateKey
  } = useAbsensiData(kebunId, absenMonth, selectedUser?.id || null)

  const {
    openAddKaryawan, setOpenAddKaryawan,
    addKaryawanLoading,
    addKaryawanName, setAddKaryawanName,
    addKaryawanStatus, setAddKaryawanStatus,
    addKaryawanPhotoPreview, setAddKaryawanPhotoPreview,
    handleCreateKaryawan,
    openEditKaryawan, setOpenEditKaryawan,
    editKaryawanSubmitting,
    editKaryawanTarget,
    editKaryawanName, setEditKaryawanName,
    editKaryawanStatus, setEditKaryawanStatus,
    editKaryawanPhotoPreview, setEditKaryawanPhotoPreview,
    openEditKaryawanModal,
    handleUpdateKaryawan,
    openDeleteKaryawan, setOpenDeleteKaryawan,
    requestDeleteKaryawan,
    handleConfirmDeleteKaryawan,
    setAddKaryawanPhotoFile,
    setEditKaryawanPhotoFile
  } = useAbsensiActions(kebunId, mutateSummary, mutateKaryawanList)

  const {
    records,
    paidMap,
    draft,
    absenOpen, setAbsenOpen,
    openAbsenView, setOpenAbsenView,
    absenSaving,
    isDeletingAbsen,
    openDeleteAbsenConfirm, setOpenDeleteAbsenConfirm,
    isPaid,
    formatRibuanId,
    openDraftForDate,
    setDraftField,
    handleSaveAbsen,
    handleDeleteAbsen
  } = useAttendance(kebunId, selectedUser?.id || null, absenMonth, formatDateKey)

  const {
    openPayDetail, setOpenPayDetail,
    payDetail, payDetailLoading, payDetailExporting, setPayDetailExporting,
    openDetailHutang, setOpenDetailHutang,
    detailTarget, detailRows, detailLoading, detailExporting, setDetailExporting,
    handleShowPayDetail,
    handleShowDetailHutang,
  } = useAbsensiDetail(kebunId)

  const calendarRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (selectedUser && calendarRef.current) {
      calendarRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [selectedUser])

  return (
    <div className="space-y-6">
      <AbsensiSummaryCards loading={loadingSummary} totals={totals} />

      <AbsensiKaryawanTable 
        rows={pagedKaryawanRows}
        totalCount={filteredRows.length}
        startIndex={karyawanStartIndex}
        onRowClick={(u: User) => setSelectedUser(u)}
        selectedUserId={selectedUser?.id || null}
        onEdit={(u: User) => openEditKaryawanModal(u)}
        onDelete={(u: number) => requestDeleteKaryawan(u)}
        onShowDebt={(u: User) => handleShowDetailHutang(u)}
        onShowPayment={(r) => handleShowPayDetail(r)}
        search={karyawanSearch}
        onSearchChange={setKaryawanSearch}
        page={karyawanPage}
        onPageChange={setKaryawanPage}
        totalPages={karyawanTotalPages}
        perView={karyawanPerView}
        onPerViewChange={setKaryawanPerView}
        onAddClick={() => setOpenAddKaryawan(true)}
        isAdminOrOwner={isAdminOrOwner}
        loading={loadingSummary}
        totals={totals}
        absenMonth={absenMonth}
        setAbsenMonth={setAbsenMonth}
      />

      {selectedUser && (
        <div ref={calendarRef} className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <AbsensiCalendar 
            selectedUser={selectedUser}
            absenMonth={absenMonth}
            setAbsenMonth={setAbsenMonth}
            totals={totals}
            formatDateKey={formatDateKey}
            records={records}
            paidMap={paidMap}
            onCellClick={openDraftForDate}
            onClose={() => setSelectedUser(null)}
          />
        </div>
      )}

      <AbsensiHutangTable 
        rows={pagedHutangRows}
        startIndex={hutangStartIndex}
        page={hutangPage}
        onPageChange={setHutangPage}
        totalPages={hutangTotalPages}
        perView={hutangPerView}
        onPerViewChange={setHutangPerView}
        onShowDebt={(u: User) => handleShowDetailHutang(u)}
        canSeeDebtDetail={canSeeDebtDetail}
      />

      <AbsensiAddKaryawanModal 
        open={openAddKaryawan}
        onOpenChange={setOpenAddKaryawan}
        name={addKaryawanName}
        onNameChange={setAddKaryawanName}
        status={addKaryawanStatus}
        onStatusChange={(v) => setAddKaryawanStatus(v as 'AKTIF' | 'NONAKTIF')}
        photoPreview={addKaryawanPhotoPreview}
        onPhotoChange={setAddKaryawanPhotoFile}
        onPhotoPreviewChange={setAddKaryawanPhotoPreview}
        loading={addKaryawanLoading}
        onSubmit={handleCreateKaryawan}
      />

      <AbsensiEditKaryawanModal 
        open={openEditKaryawan}
        onOpenChange={setOpenEditKaryawan}
        target={editKaryawanTarget}
        name={editKaryawanName}
        onNameChange={setEditKaryawanName}
        status={editKaryawanStatus}
        onStatusChange={(v) => setEditKaryawanStatus(v as 'AKTIF' | 'NONAKTIF')}
        photoPreview={editKaryawanPhotoPreview}
        onPhotoChange={setEditKaryawanPhotoFile}
        onPhotoPreviewChange={setEditKaryawanPhotoPreview}
        submitting={editKaryawanSubmitting}
        onSubmit={() => handleUpdateKaryawan(selectedUser, setSelectedUser)}
      />

      <ConfirmationModal
        isOpen={openDeleteKaryawan}
        onClose={() => setOpenDeleteKaryawan(false)}
        onConfirm={() => handleConfirmDeleteKaryawan(rows)}
        title="Konfirmasi Hapus Karyawan"
        description="Permintaan Anda akan dikirim untuk persetujuan admin/pemilik."
        variant="emerald"
      />

      <AbsensiInputModal 
        open={absenOpen}
        onOpenChange={setAbsenOpen}
        target={selectedUser}
        draft={draft}
        onChange={setDraftField}
        saving={absenSaving}
        onSave={() => handleSaveAbsen(mutateSummary)}
        formatRibuanId={formatRibuanId}
      />

      <AbsensiViewModal 
        open={openAbsenView}
        onOpenChange={setOpenAbsenView}
        target={selectedUser}
        draft={draft}
        isPaid={isPaid}
        onEdit={() => { setOpenAbsenView(false); setAbsenOpen(true) }}
        onDelete={() => setOpenDeleteAbsenConfirm(true)}
        isDeleting={isDeletingAbsen}
      />

      <AbsensiDetailHutangModal 
        open={openDetailHutang}
        onOpenChange={setOpenDetailHutang}
        target={detailTarget}
        rows={detailRows}
        loading={detailLoading}
        exporting={detailExporting}
        onExport={() => toast.success('PDF Hutang diunduh')}
      />

      <AbsensiDetailPayModal 
        open={openPayDetail}
        onOpenChange={setOpenPayDetail}
        loading={payDetailLoading}
        detail={payDetail}
        onExport={() => toast.success('PDF Gaji diunduh')}
        exporting={payDetailExporting}
      />

      <ConfirmationModal
        isOpen={openDeleteAbsenConfirm}
        onClose={() => setOpenDeleteAbsenConfirm(false)}
        onConfirm={() => handleDeleteAbsen(mutateSummary)}
        title="Hapus Data Absensi"
        description={`Apakah Anda yakin ingin menghapus data absensi tanggal ${draft.date ? format(new Date(draft.date), 'dd MMMM yyyy', { locale: idLocale }) : ''}?`}
        variant="emerald"
      />
    </div>
  )
}
