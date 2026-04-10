export interface KasTransaksi {
  id: number;
  date: string;
  tipe: 'PEMASUKAN' | 'PENGELUARAN';
  deskripsi: string;
  jumlah: number;
  keterangan: string | null;
  gambarUrl: string | null;
  kategori: string | null;
  kebunId: number | null;
  kebun?: { id: number; name: string } | null;
  kendaraanPlatNomor: string | null;
  kendaraan?: { platNomor: string; merk: string } | null;
  karyawanId: number | null;
  karyawan?: { id: number; name: string } | null;
  user?: { name: string } | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface KasirData {
  saldoAwal: number;
  totalPemasukan: number;
  totalPengeluaran: number;
  saldoAkhir: number;
  transactions: KasTransaksi[];
  totalItems: number;
  pageCount: number;
}
