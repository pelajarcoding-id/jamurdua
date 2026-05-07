export type Kebun = { id: number; name: string }

export type WorkLocation = { 
  id: number; 
  name: string; 
  type: string; 
  kebunId?: number | null 
}

export type DeleteRequest = { 
  id: number; 
  status: string; 
  createdAt: string; 
  reason?: string | null; 
  karyawan: { id: number; name: string }; 
  requester: { id: number; name: string } 
}

export type User = {
  id: number
  name: string
  email: string
  role?: string
  photoUrl?: string | null
  kebunId?: number | null
  noHp?: string | null
  phone?: string | null
  jenisPekerjaan?: string | null
  jobType?: string | null
  status?: string | null
  kendaraanPlatNomor?: string | null
}

export type Row = {
  karyawan: User
  pekerjaanCount: number
  pekerjaanTotalBiaya: number
  totalPengeluaran: number
  totalPembayaran: number
  hutangSaldo: number
  hariKerja: number
  totalGaji: number
}

export type SummaryRow = {
  kebun: { id: number; name: string }
  karyawan: User
  pekerjaanCount: number
  pekerjaanTotalBiaya: number
  totalPengeluaran: number
  totalPembayaran: number
  hutangSaldo: number
  hariKerja: number
  totalGaji: number
}

export type Absen = {
  date: string
  amount: number
  work: boolean
  off: boolean
  note: string
  source: string
}

export type PaymentHistoryItem = {
  id: number
  paidAt: string
  amount: number
}

export type HutangDetailRow = {
  id: number
  date: string
  jumlah: number
  amount?: number
  tipe: string
  type?: string
  kategori: string
  deskripsi: string
  description?: string
  balance?: number
}

export type Assignment = {
  userId: number
  location: WorkLocation
}

export type PayrollData = {
  basePay: number
  totalHutang: number
  potonganHutang: number
  hutangAfter: number
  takeHome: number
}

export const fetcher = (url: string) => fetch(url).then(r => r.json())
