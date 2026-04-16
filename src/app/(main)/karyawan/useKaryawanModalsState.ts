import { useState } from 'react'

export function useKaryawanModalsState() {
  const [openAbsenView, setOpenAbsenView] = useState(false)
  const [openDeleteAbsenConfirm, setOpenDeleteAbsenConfirm] = useState(false)
  const [openCancelGajiConfirm, setOpenCancelGajiConfirm] = useState(false)
  const [absenOpen, setAbsenOpen] = useState(false)
  const [absenPayOpen, setAbsenPayOpen] = useState(false)

  const [openCancelPaid, setOpenCancelPaid] = useState(false)
  const [cancelPaidDate, setCancelPaidDate] = useState<string>('')

  const [openDeleteAbsenPay, setOpenDeleteAbsenPay] = useState(false)
  const [deleteAbsenPayId, setDeleteAbsenPayId] = useState<number | null>(null)
  const [deleteAbsenPayPaidAt, setDeleteAbsenPayPaidAt] = useState<string>('')

  const [openDeleteKaryawan, setOpenDeleteKaryawan] = useState(false)
  const [deleteKaryawanId, setDeleteKaryawanId] = useState<number | null>(null)

  const [openHutang, setOpenHutang] = useState(false)
  const [openPotong, setOpenPotong] = useState(false)
  const [hutangModalUser, setHutangModalUser] = useState<any | null>(null)

  const [openDetail, setOpenDetail] = useState(false)
  const [openEditDetail, setOpenEditDetail] = useState(false)
  const [openDeleteDetail, setOpenDeleteDetail] = useState(false)

  const [openPayroll, setOpenPayroll] = useState(false)

  const [openAddEditKaryawan, setOpenAddEditKaryawan] = useState(false)
  const [editKaryawan, setEditKaryawan] = useState<any | null>(null)

  const [openMove, setOpenMove] = useState(false)
  const [moveUser, setMoveUser] = useState<any | null>(null)
  const [moveLocationId, setMoveLocationId] = useState<number | null>(null)
  const [moveDate, setMoveDate] = useState<string>('')

  const [openHistory, setOpenHistory] = useState(false)
  const [historyUser, setHistoryUser] = useState<any | null>(null)

  return {
    openAbsenView,
    setOpenAbsenView,
    openDeleteAbsenConfirm,
    setOpenDeleteAbsenConfirm,
    openCancelGajiConfirm,
    setOpenCancelGajiConfirm,
    absenOpen,
    setAbsenOpen,
    absenPayOpen,
    setAbsenPayOpen,
    openCancelPaid,
    setOpenCancelPaid,
    cancelPaidDate,
    setCancelPaidDate,
    openDeleteAbsenPay,
    setOpenDeleteAbsenPay,
    deleteAbsenPayId,
    setDeleteAbsenPayId,
    deleteAbsenPayPaidAt,
    setDeleteAbsenPayPaidAt,
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
    openDetail,
    setOpenDetail,
    openEditDetail,
    setOpenEditDetail,
    openDeleteDetail,
    setOpenDeleteDetail,
    openPayroll,
    setOpenPayroll,
    openAddEditKaryawan,
    setOpenAddEditKaryawan,
    editKaryawan,
    setEditKaryawan,
    openMove,
    setOpenMove,
    moveUser,
    setMoveUser,
    moveLocationId,
    setMoveLocationId,
    moveDate,
    setMoveDate,
    openHistory,
    setOpenHistory,
    historyUser,
    setHistoryUser,
  }
}

