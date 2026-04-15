import { useState } from 'react'
import type { KasTransaksi } from '@/types/kasir'

export function useKasirModalsState() {
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingTransaction, setEditingTransaction] = useState<KasTransaksi | null>(null)

  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [detailTransaction, setDetailTransaction] = useState<KasTransaksi | null>(null)

  const [openDelete, setOpenDelete] = useState(false)
  const [deleteId, setDeleteId] = useState<number | null>(null)

  const [viewImageUrl, setViewImageUrl] = useState<string | null>(null)

  return {
    isFormOpen,
    setIsFormOpen,
    editingTransaction,
    setEditingTransaction,
    isDetailOpen,
    setIsDetailOpen,
    detailTransaction,
    setDetailTransaction,
    openDelete,
    setOpenDelete,
    deleteId,
    setDeleteId,
    viewImageUrl,
    setViewImageUrl,
  }
}

