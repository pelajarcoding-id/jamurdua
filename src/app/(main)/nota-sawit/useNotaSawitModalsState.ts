import { useState } from 'react'
import type { NotaSawitData } from './columns'

export function useNotaSawitModalsState() {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)
  const [isConfirmOpen, setIsConfirmOpen] = useState(false)
  const [isBulkDeleteConfirmOpen, setIsBulkDeleteConfirmOpen] = useState(false)
  const [isBulkHargaOpen, setIsBulkHargaOpen] = useState(false)
  const [bulkHargaValue, setBulkHargaValue] = useState('')
  const [bulkHargaSubmitting, setBulkHargaSubmitting] = useState(false)

  const [isBulkReconcileOpen, setIsBulkReconcileOpen] = useState(false)
  const [reconcileSubmitting, setReconcileSubmitting] = useState(false)
  const [reconcileTanggal, setReconcileTanggal] = useState('')
  const [reconcileJumlahMasuk, setReconcileJumlahMasuk] = useState('')
  const [reconcileSetLunas, setReconcileSetLunas] = useState(true)
  const [reconcileKeterangan, setReconcileKeterangan] = useState('')
  const [reconcilePabrikId, setReconcilePabrikId] = useState<string>('')
  const [reconcileNotas, setReconcileNotas] = useState<NotaSawitData[]>([])
  const [reconcileGambarFile, setReconcileGambarFile] = useState<File | null>(null)
  const [reconcileGambarPreview, setReconcileGambarPreview] = useState<string | null>(null)
  const [reconcileRangeStart, setReconcileRangeStart] = useState<string>('')
  const [reconcileRangeEnd, setReconcileRangeEnd] = useState<string>('')
  const [reconcileRangeLoading, setReconcileRangeLoading] = useState(false)
  const [reconcileRangeCandidates, setReconcileRangeCandidates] = useState<NotaSawitData[]>([])

  const [isReconcileDetailOpen, setIsReconcileDetailOpen] = useState(false)
  const [reconcileDetail, setReconcileDetail] = useState<any | null>(null)
  const [isBuktiTransferOpen, setIsBuktiTransferOpen] = useState(false)
  const [buktiTransferUrl, setBuktiTransferUrl] = useState<string | null>(null)

  const [isReconcileEditOpen, setIsReconcileEditOpen] = useState(false)
  const [reconcileEditSubmitting, setReconcileEditSubmitting] = useState(false)
  const [reconcileEditingBatchId, setReconcileEditingBatchId] = useState<number | null>(null)
  const [reconcileEditTanggal, setReconcileEditTanggal] = useState('')
  const [reconcileEditJumlahMasuk, setReconcileEditJumlahMasuk] = useState('')
  const [reconcileEditKeterangan, setReconcileEditKeterangan] = useState('')
  const [reconcileEditSetLunas, setReconcileEditSetLunas] = useState(true)
  const [reconcileEditPabrikId, setReconcileEditPabrikId] = useState<string>('')
  const [reconcileEditNotas, setReconcileEditNotas] = useState<any[]>([])
  const [reconcileEditRangeStart, setReconcileEditRangeStart] = useState<string>('')
  const [reconcileEditRangeEnd, setReconcileEditRangeEnd] = useState<string>('')
  const [reconcileEditRangeLoading, setReconcileEditRangeLoading] = useState(false)
  const [reconcileEditRangeCandidates, setReconcileEditRangeCandidates] = useState<any[]>([])
  const [reconcileEditGambarFile, setReconcileEditGambarFile] = useState<File | null>(null)
  const [reconcileEditGambarPreview, setReconcileEditGambarPreview] = useState<string | null>(null)
  const [reconcileEditGambarExistingUrl, setReconcileEditGambarExistingUrl] = useState<string | null>(null)

  const [isReconcileDeleteConfirmOpen, setIsReconcileDeleteConfirmOpen] = useState(false)
  const [reconcileDeletingBatchId, setReconcileDeletingBatchId] = useState<number | null>(null)
  const [reconcileDeleteSubmitting, setReconcileDeleteSubmitting] = useState(false)

  const [duplicateWarningOpen, setDuplicateWarningOpen] = useState(false)
  const [duplicateCandidates, setDuplicateCandidates] = useState<any[]>([])
  const [pendingDuplicatePayload, setPendingDuplicatePayload] = useState<any | null>(null)
  const [submittingDuplicateProceed, setSubmittingDuplicateProceed] = useState(false)

  const [isUbahStatusModalOpen, setIsUbahStatusModalOpen] = useState(false)
  const [selectedNota, setSelectedNota] = useState<NotaSawitData | null>(null)

  const [viewImageUrl, setViewImageUrl] = useState<string | null>(null)
  const [viewImageError, setViewImageError] = useState(false)

  return {
    isModalOpen,
    setIsModalOpen,
    isDetailModalOpen,
    setIsDetailModalOpen,
    isConfirmOpen,
    setIsConfirmOpen,
    isBulkDeleteConfirmOpen,
    setIsBulkDeleteConfirmOpen,
    isBulkHargaOpen,
    setIsBulkHargaOpen,
    bulkHargaValue,
    setBulkHargaValue,
    bulkHargaSubmitting,
    setBulkHargaSubmitting,
    isBulkReconcileOpen,
    setIsBulkReconcileOpen,
    reconcileSubmitting,
    setReconcileSubmitting,
    reconcileTanggal,
    setReconcileTanggal,
    reconcileJumlahMasuk,
    setReconcileJumlahMasuk,
    reconcileSetLunas,
    setReconcileSetLunas,
    reconcileKeterangan,
    setReconcileKeterangan,
    reconcilePabrikId,
    setReconcilePabrikId,
    reconcileNotas,
    setReconcileNotas,
    reconcileGambarFile,
    setReconcileGambarFile,
    reconcileGambarPreview,
    setReconcileGambarPreview,
    reconcileRangeStart,
    setReconcileRangeStart,
    reconcileRangeEnd,
    setReconcileRangeEnd,
    reconcileRangeLoading,
    setReconcileRangeLoading,
    reconcileRangeCandidates,
    setReconcileRangeCandidates,
    isReconcileDetailOpen,
    setIsReconcileDetailOpen,
    reconcileDetail,
    setReconcileDetail,
    isBuktiTransferOpen,
    setIsBuktiTransferOpen,
    buktiTransferUrl,
    setBuktiTransferUrl,
    isReconcileEditOpen,
    setIsReconcileEditOpen,
    reconcileEditSubmitting,
    setReconcileEditSubmitting,
    reconcileEditingBatchId,
    setReconcileEditingBatchId,
    reconcileEditTanggal,
    setReconcileEditTanggal,
    reconcileEditJumlahMasuk,
    setReconcileEditJumlahMasuk,
    reconcileEditKeterangan,
    setReconcileEditKeterangan,
    reconcileEditSetLunas,
    setReconcileEditSetLunas,
    reconcileEditPabrikId,
    setReconcileEditPabrikId,
    reconcileEditNotas,
    setReconcileEditNotas,
    reconcileEditRangeStart,
    setReconcileEditRangeStart,
    reconcileEditRangeEnd,
    setReconcileEditRangeEnd,
    reconcileEditRangeLoading,
    setReconcileEditRangeLoading,
    reconcileEditRangeCandidates,
    setReconcileEditRangeCandidates,
    reconcileEditGambarFile,
    setReconcileEditGambarFile,
    reconcileEditGambarPreview,
    setReconcileEditGambarPreview,
    reconcileEditGambarExistingUrl,
    setReconcileEditGambarExistingUrl,
    isReconcileDeleteConfirmOpen,
    setIsReconcileDeleteConfirmOpen,
    reconcileDeletingBatchId,
    setReconcileDeletingBatchId,
    reconcileDeleteSubmitting,
    setReconcileDeleteSubmitting,
    duplicateWarningOpen,
    setDuplicateWarningOpen,
    duplicateCandidates,
    setDuplicateCandidates,
    pendingDuplicatePayload,
    setPendingDuplicatePayload,
    submittingDuplicateProceed,
    setSubmittingDuplicateProceed,
    isUbahStatusModalOpen,
    setIsUbahStatusModalOpen,
    selectedNota,
    setSelectedNota,
    viewImageUrl,
    setViewImageUrl,
    viewImageError,
    setViewImageError,
  }
}

