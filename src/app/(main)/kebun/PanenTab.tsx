'use client';

import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { Input } from "@/components/ui/input";
import { 
  CalendarIcon, 
  TruckIcon, 
  BuildingOfficeIcon,
  ScaleIcon,
  ArrowTrendingUpIcon,
  ArchiveBoxIcon
} from "@heroicons/react/24/outline";
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';

type Panen = {
  id: number;
  tanggalBongkar: string | null;
  bruto: number;
  tara: number;
  netto: number;
  potongan: number;
  beratAkhir: number;
  pabrikSawit: { name: string };
  supir: { name: string };
  kendaraan: { platNomor: string } | null;
  gajian?: { status: string } | null;
  timbangan: {
    grossKg: number;
    tareKg: number;
    netKg: number;
  } | null;
};

export default function PanenTab({ kebunId }: { kebunId: number }) {
  const [panenData, setPanenData] = useState<Panen[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [perView, setPerView] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [filterType, setFilterType] = useState<'month' | 'year' | 'range'>('month');
  const [statusGajianFilter, setStatusGajianFilter] = useState<'ALL' | 'BELUM_DIGAJI' | 'SUDAH_DIGAJI'>('ALL');
  const [dateRange, setDateRange] = useState({
    start: new Date().toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    fetchPanen();
  }, [kebunId, selectedDate, filterType, dateRange, statusGajianFilter]);

  const fetchPanen = async () => {
    try {
      setIsLoading(true);
      let start, end;
      
      if (filterType === 'month') {
        start = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1).toISOString();
        end = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0).toISOString();
      } else if (filterType === 'year') {
        start = new Date(selectedDate.getFullYear(), 0, 1).toISOString();
        end = new Date(selectedDate.getFullYear(), 11, 31).toISOString();
      } else {
        // Range
        start = new Date(`${dateRange.start}T00:00:00`).toISOString();
        const endDate = new Date(`${dateRange.end}T00:00:00`);
        endDate.setHours(23, 59, 59, 999);
        end = endDate.toISOString();
      }
      
      const params = new URLSearchParams({ startDate: start, endDate: end });
      if (statusGajianFilter !== 'ALL') {
        params.set('statusGajian', statusGajianFilter);
      }
      const res = await fetch(`/api/kebun/${kebunId}/panen?${params.toString()}`);
      if (!res.ok) throw new Error('Gagal mengambil data');
      const data = await res.json();
      setPanenData(data);
    } catch (error) {
      console.error(error);
      toast.error('Gagal memuat riwayat panen');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    if (filterType === 'month') {
      const date = new Date(e.target.value + '-01');
      if (!isNaN(date.getTime())) setSelectedDate(date);
    } else if (filterType === 'year') {
      const year = parseInt(e.target.value);
      if (!isNaN(year)) {
        const date = new Date();
        date.setFullYear(year);
        setSelectedDate(date);
      }
    }
  };

  const totalNetto = panenData.reduce((acc, curr) => acc + curr.beratAkhir, 0);
  const averageNetto = panenData.length > 0 ? totalNetto / panenData.length : 0;
  const totalPages = Math.max(1, Math.ceil(panenData.length / perView));
  const startIndex = (currentPage - 1) * perView;
  const pagedPanenData = panenData.slice(startIndex, startIndex + perView);

  useEffect(() => {
    setCurrentPage(1);
  }, [filterType, selectedDate, dateRange.start, dateRange.end, perView, kebunId, statusGajianFilter]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  return (
    <div className="space-y-8">
      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600">
            <ScaleIcon className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Total Netto</p>
            <h4 className="text-xl font-bold text-gray-900">{totalNetto.toLocaleString('id-ID')} <span className="text-sm font-normal text-gray-400">kg</span></h4>
          </div>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600">
            <ArrowTrendingUpIcon className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Rata-rata Panen</p>
            <h4 className="text-xl font-bold text-gray-900">{Math.round(averageNetto).toLocaleString('id-ID')} <span className="text-sm font-normal text-gray-400">kg</span></h4>
          </div>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-600">
            <ArchiveBoxIcon className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Total Pengiriman</p>
            <h4 className="text-xl font-bold text-gray-900">{panenData.length} <span className="text-sm font-normal text-gray-400">Trip</span></h4>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 px-2">
          <h3 className="text-lg font-bold text-gray-900 capitalize">Daftar Pengiriman Panen</h3>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 w-full lg:w-auto">
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <select
                className="h-10 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 w-full sm:w-auto flex-shrink-0"
                value={statusGajianFilter}
                onChange={(e) => setStatusGajianFilter(e.target.value as any)}
              >
                <option value="ALL">Semua Status</option>
                <option value="BELUM_DIGAJI">Belum Digaji</option>
                <option value="SUDAH_DIGAJI">Sudah Digaji</option>
              </select>
              <select 
                className="h-10 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 w-full sm:w-auto flex-shrink-0"
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as any)}
              >
                <option value="month">Bulanan</option>
                <option value="year">Tahunan</option>
                <option value="range">Rentang</option>
              </select>

              {filterType === 'month' && (
                <Input 
                  type="month" 
                  className="h-10 w-full sm:w-44 bg-white !rounded-md pr-10" 
                  value={selectedDate.toISOString().slice(0, 7)}
                  onChange={handleDateChange}
                />
              )}

              {filterType === 'year' && (
                <select
                  className="h-10 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 w-full sm:w-32"
                  value={selectedDate.getFullYear()}
                  onChange={handleDateChange}
                >
                  {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(year => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              )}

              {filterType === 'range' && (
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <Input 
                    type="date" 
                    className="h-10 w-full sm:w-36 bg-white !rounded-md pr-10" 
                    value={dateRange.start}
                    onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                  />
                  <span className="text-gray-500">-</span>
                  <Input 
                    type="date" 
                    className="h-10 w-full sm:w-36 bg-white !rounded-md pr-10" 
                    value={dateRange.end}
                    onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
        
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-32 bg-white rounded-3xl border border-gray-100 animate-pulse" />
            ))}
          </div>
        ) : panenData.length === 0 ? (
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-12 text-center text-gray-400 border-dashed">
            <p>Belum ada riwayat panen tercatat untuk kebun ini</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-1">
              <div className="text-xs text-gray-500">
                Menampilkan {panenData.length === 0 ? 0 : startIndex + 1} - {Math.min(startIndex + perView, panenData.length)} dari {panenData.length} data
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">Per View</span>
                <select
                  className="h-8 rounded-md border border-gray-200 bg-white px-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  value={perView}
                  onChange={(e) => setPerView(Number(e.target.value))}
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                </select>
              </div>
            </div>

            <div className="grid gap-4">
            {pagedPanenData.map((item, idx) => {
              const isFinalPaid = String(item?.gajian?.status || '').toUpperCase() === 'FINALIZED'
              const displayNo = panenData.length - (startIndex + idx)
              return (
              <div key={item.id} className="relative bg-white rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-all overflow-hidden group">
                <div className="absolute top-4 left-4 h-7 min-w-7 px-2.5 rounded-full bg-gray-100 text-gray-700 text-xs font-bold flex items-center justify-center z-10">
                  {displayNo}
                </div>
                <div className="p-5 md:p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center text-gray-400 group-hover:bg-gray-900 group-hover:text-white transition-colors shrink-0">
                      <TruckIcon className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-bold text-gray-900">Nota ke {displayNo}</span>
                        <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 text-[10px] font-bold rounded-full uppercase tracking-wider">Berhasil</span>
                        {isFinalPaid ? (
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-bold rounded-full uppercase tracking-wider">
                            Sudah Digaji
                          </span>
                        ) : null}
                        <span className="text-sm font-black text-gray-900">Berat Akhir {item.beratAkhir.toLocaleString('id-ID')} kg</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
                        <div className="flex items-center gap-1">
                          <CalendarIcon className="w-3.5 h-3.5" />
                          {item.tanggalBongkar ? format(new Date(item.tanggalBongkar), 'dd MMMM yyyy', { locale: localeId }) : '-'}
                        </div>
                        <div className="flex items-center gap-1">
                          <BuildingOfficeIcon className="w-3.5 h-3.5" />
                          {item.pabrikSawit.name}
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="font-medium text-gray-700">{item.supir.name}</span>
                          <span className="text-gray-300">•</span>
                          <span>{item.kendaraan?.platNomor || '-'}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 md:gap-8 bg-gray-50 md:bg-transparent p-4 md:p-0 rounded-2xl">
                    <div className="text-right">
                      <p className="text-[10px] text-gray-400 uppercase font-bold tracking-widest mb-0.5">Bruto Pabrik</p>
                      <p className="text-lg font-black text-gray-900">{item.bruto.toLocaleString('id-ID')} <span className="text-xs font-normal">kg</span></p>
                    </div>
                    <div className="w-px h-8 bg-gray-200 hidden md:block" />
                    <div className="text-right">
                      <p className="text-[10px] text-gray-400 uppercase font-bold tracking-widest mb-0.5">Bruto Timbangan Kebun</p>
                      <p className="text-lg font-black text-gray-600">{typeof item.timbangan?.grossKg === 'number' ? item.timbangan.grossKg.toLocaleString('id-ID') : '-'} <span className="text-xs font-normal">kg</span></p>
                    </div>
                  </div>
                </div>
                
                {/* Detail Bar */}
                <div className="bg-gray-50/50 px-6 py-3 border-t border-gray-50 flex flex-wrap gap-x-6 gap-y-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                   <div className="flex gap-2 italic">
                      <span>Bruto: {item.bruto.toLocaleString('id-ID')} kg</span>
                      <span>•</span>
                      <span>Tara: {item.tara.toLocaleString('id-ID')} kg</span>
                      <span>•</span>
                      <span>Netto: {item.netto.toLocaleString('id-ID')} kg</span>
                      <span>•</span>
                      <span>Potongan: {item.potongan.toLocaleString('id-ID')} kg</span>
                   </div>
                   {item.timbangan && (
                     <div className="ml-auto text-blue-500">
                        {(() => {
                          const selisihBruto = item.bruto - (item.timbangan?.grossKg || 0)
                          const label =
                            selisihBruto === 0
                              ? 'Timbangan Pabrik Sama'
                              : selisihBruto > 0
                                ? `Timbangan Pabrik Lebih ${Math.abs(selisihBruto).toLocaleString('id-ID')} kg`
                                : `Timbangan Pabrik Kurang ${Math.abs(selisihBruto).toLocaleString('id-ID')} kg`
                          return `Selisih: ${label}`
                        })()}
                     </div>
                   )}
                </div>
              </div>
              )
            })}
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                className="h-8 px-3 rounded-md border border-gray-200 bg-white text-xs disabled:opacity-50"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              >
                Sebelumnya
              </button>
              <span className="text-xs text-gray-600">
                Halaman {currentPage} / {totalPages}
              </span>
              <button
                type="button"
                className="h-8 px-3 rounded-md border border-gray-200 bg-white text-xs disabled:opacity-50"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              >
                Berikutnya
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
