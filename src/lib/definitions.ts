export interface PabrikSawit {
  id: number;
  name: string;
  address: string | null;
  createdAt: Date;
  updatedAt: Date;
  stats?: {
    totalBerat: number;
    totalNilai: number;
    totalNota: number;
    totalPotongan: number;
    totalBeratNetto: number;
    rataRataHarga: number;
  };
}
