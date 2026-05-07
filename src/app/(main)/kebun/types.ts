export type User = {
  id: number
  name: string
  email: string
  photoUrl?: string | null
  kebunId?: number | null
  jobType?: string | null
  status?: string | null
  deleteRequestPending?: boolean
}

export type Row = {
  karyawan: User
  hariKerja: number
  totalGaji: number
  totalGajiDibayar: number
  totalGajiBelumDibayar: number
  hutangSaldo: number
  lastPaymentId?: number | null
  lastPotongan?: {
    date: string
    jumlah: number
  } | null
}

export type HutangDetailRow = {
  id: number
  date: string
  jumlah: number
  amount?: number // alias for jumlah
  tipe: string
  type?: string // alias for tipe
  kategori: string | null
  deskripsi: string | null
  description?: string | null // alias for deskripsi
  balance?: number // current balance after this transaction
}

export interface AbsensiSummary {
  hariKerja: number
  jamKerjaBelumDibayar: number
  totalGaji: number
  hutang: number
}

export interface AttendanceRecord {
  amount: string
  work: boolean
  off: boolean
  note: string
  source?: string | null
  useHourly: boolean
  hour: string
  rate: string
  mealEnabled: boolean
  mealAmount: string
}

export interface AttendanceDraft extends AttendanceRecord {
  date: string
}

export interface PaymentDetail {
  id: number
  date: string
  paidAt?: string | null // when payment was finalized
  karyawanId: number
  karyawanName: string
  items: {
    label: string
    amount: number
  }[]
  total: number
  jumlah?: number // base salary amount
  potonganHutang?: number // debt deduction amount
}

export interface HutangHistoryItem {
  id: number
  date: string
  jumlah: number
  tipe: string
  kategori: string | null
  deskripsi: string | null
}

export type PekerjaanUser = {
  id: number
  name: string
}

export type Pekerjaan = {
  id: number
  ids?: number[]
  date: string
  jenisPekerjaan: string
  kategoriBorongan?: string | null
  keterangan: string | null
  biaya: number
  imageUrl?: string | null
  gajianId?: number | null
  gajianStatus?: string | null
  upahBorongan?: boolean
  jumlah?: number | null
  satuan?: string | null
  hargaSatuan?: number | null
  kendaraanPlatNomor?: string | null
  kendaraan?: { platNomor: string; merk: string; jenis: string } | null
  user: PekerjaanUser | null
  users?: PekerjaanUser[]
  paidCount?: number
  totalCount?: number
  inGajianCount?: number
  finalizedCount?: number
}

export type Kendaraan = {
  platNomor: string
  merk: string
  jenis: string
}
