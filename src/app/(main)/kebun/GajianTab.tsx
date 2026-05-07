'use client'

import { useState, useCallback } from 'react'
import toast from 'react-hot-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PencilSquareIcon, TrashIcon } from '@heroicons/react/24/outline'
import { format } from 'date-fns'
import { id as localeId } from 'date-fns/locale'
import { ConfirmationModal } from '@/components/ui/confirmation-modal'
import { DetailGajianModal } from '../gajian/detail-modal'
import { formatIdCurrency, formatIdNumber } from '@/lib/utils'
import { useGajianData } from './hooks/useGajianData'

export default function GajianTab({ kebunId }: { kebunId: number }) {
  const gajian = useGajianData({ kebunId })

  const [isConfirmOpen, setIsConfirmOpen] = useState(false)
  const [isDetailOpen, setIsDetailOpen] = useState(false)

  const formatCurrency = useCallback((num: number) => formatIdCurrency(num), [])
  const formatNumber = useCallback((num: number, maxFractionDigits = 0) => formatIdNumber(num, maxFractionDigits), [])

  const handleOpenDetail = useCallback(async (id: number) => {
    const data = await gajian.handleOpenDetail(id)
    if (data) {
      setIsDetailOpen(true)
    }
  }, [gajian])

  const handleCloseDetail = () => {
    setIsDetailOpen(false)
    gajian.setSelectedGajian(null)
  }

  const handleSubmit = useCallback(async () => {
    await gajian.handleSubmit()
    setIsConfirmOpen(false)
  }, [gajian])

  return (
    <div className="space-y-6">
      {/* Preview Section */}
      <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-end gap-4 justify-between">
          <div>
            <h2 className="text-lg md:text-xl font-bold text-gray-900 capitalize">Preview Pengajuan Gajian</h2>
            <p className="text-xs md:text-sm text-gray-500">Hitung gaji yang belum dibayar dan biaya lain sebelum diajukan.</p>
          </div>
          <div className="w-full lg:hidden">
            <div className="grid grid-cols-2 gap-3 items-end">
              <div className="space-y-1 col-span-1">
                <Label>Mulai</Label>
                <Input 
                  type="date" 
                  value={gajian.startDate} 
                  onChange={(e) => gajian.setStartDate(e.target.value)} 
                  className="h-10 w-full bg-white !rounded-full pr-10" 
                />
              </div>
              <div className="space-y-1 col-span-1">
                <Label>Selesai</Label>
                <Input 
                  type="date" 
                  value={gajian.endDate} 
                  onChange={(e) => gajian.setEndDate(e.target.value)} 
                  className="h-10 w-full bg-white !rounded-full pr-10" 
                />
              </div>
              <Button
                onClick={() => setIsConfirmOpen(true)}
                disabled={gajian.isSubmitting}
                className="rounded-full bg-emerald-600 hover:bg-emerald-700 text-white h-10 w-full whitespace-nowrap col-span-2"
              >
                {gajian.isSubmitting ? 'Mengajukan...' : 'Ajukan Gajian'}
              </Button>
            </div>
          </div>

          <div className="hidden lg:flex items-end gap-3">
            <div className="space-y-1">
              <Label>Mulai</Label>
              <Input 
                type="date" 
                value={gajian.startDate} 
                onChange={(e) => gajian.setStartDate(e.target.value)} 
                className="h-10 bg-white !rounded-full pr-10" 
              />
            </div>
            <div className="space-y-1">
              <Label>Selesai</Label>
              <Input 
                type="date" 
                value={gajian.endDate} 
                onChange={(e) => gajian.setEndDate(e.target.value)} 
                className="h-10 bg-white !rounded-full pr-10" 
              />
            </div>
            <Button 
              onClick={() => setIsConfirmOpen(true)} 
              disabled={gajian.isSubmitting} 
              className="rounded-full bg-emerald-600 hover:bg-emerald-700 text-white h-10 whitespace-nowrap"
            >
              {gajian.isSubmitting ? 'Mengajukan...' : 'Ajukan Gajian'}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-100">
            <div className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">Total Gaji Belum Dibayar</div>
            <div className="text-xl sm:text-2xl font-bold text-emerald-900 mt-2 leading-tight break-words">{formatCurrency(gajian.totalGajiUnpaid)}</div>
          </div>
          <div className="p-4 rounded-2xl bg-blue-50 border border-blue-100">
            <div className="text-xs font-semibold text-blue-600 uppercase tracking-wider">Total Biaya Borongan</div>
            <div className="text-xl sm:text-2xl font-bold text-blue-900 mt-2 leading-tight break-words">{formatCurrency(gajian.totalBiayaLain)}</div>
          </div>
          <div className="p-4 rounded-2xl bg-white border border-gray-100">
            <div className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Total Nota Sawit Belum Digaji</div>
            <div className="text-xl sm:text-2xl font-bold text-gray-900 mt-2 leading-tight">
              {formatNumber(gajian.notaSawitCount)} <span className="text-base font-semibold text-gray-500">| {formatNumber(Math.round(gajian.notaSawitTotalKg || 0))} kg</span>
            </div>
          </div>
          <div className="p-4 rounded-2xl bg-gray-900 text-white">
            <div className="text-xs font-semibold uppercase tracking-wider">Total Pengajuan</div>
            <div className="text-xl sm:text-2xl font-bold mt-2 leading-tight break-words">{formatCurrency(gajian.totalPengajuan)}</div>
          </div>
        </div>

        {gajian.previewLoading && (
          <div className="rounded-2xl border border-gray-100 bg-gray-50 p-8 text-center">
            <div className="text-sm text-gray-500">Memuat data...</div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Detail Gaji Karyawan */}
          <div className="border border-gray-100 rounded-2xl overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 font-semibold text-gray-700 text-sm">Detail Gaji Karyawan (Belum Dibayar)</div>
            <div className="md:hidden space-y-3 p-4">
              {gajian.unpaidList.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/50 p-6 text-center text-sm text-gray-500">Tidak ada gaji belum dibayar</div>
              ) : (
                gajian.unpaidList.map((u) => (
                  <div key={`unpaid-${u.karyawanId}`} className="rounded-2xl border border-gray-100 bg-white p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-semibold text-gray-900 truncate">{u.name}</div>
                      <span className="inline-flex items-center rounded-full bg-gray-100 text-gray-700 px-2 py-0.5 text-[10px] font-bold whitespace-nowrap">
                        {Number(u.hariKerja || 0)} HK
                      </span>
                    </div>
                    <div className="text-xs text-gray-400 mt-1">Total</div>
                    <div className="font-semibold text-emerald-700">{formatCurrency(Number(u.total) || 0)}</div>
                  </div>
                ))
              )}
            </div>

            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-white">
                  <tr>
                    <th className="px-4 py-2 text-left text-gray-500 font-semibold">Karyawan</th>
                    <th className="px-4 py-2 text-right text-gray-500 font-semibold">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {gajian.unpaidList.length === 0 ? (
                    <tr>
                      <td colSpan={2} className="px-4 py-6 text-center text-gray-400">
                        Tidak ada gaji belum dibayar
                      </td>
                    </tr>
                  ) : (
                    gajian.unpaidList.map((u) => (
                      <tr key={u.karyawanId}>
                        <td className="px-4 py-2">
                          <div className="flex items-center justify-between gap-3">
                            <span className="truncate">{u.name}</span>
                            <span className="inline-flex items-center rounded-full bg-gray-100 text-gray-700 px-2 py-0.5 text-[10px] font-bold whitespace-nowrap">
                              {Number(u.hariKerja || 0)} HK
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-2 text-right font-semibold">{formatCurrency(Number(u.total) || 0)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Biaya Gaji & Borongan */}
          <div className="border border-gray-100 rounded-2xl overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 font-semibold text-gray-700 text-sm">Biaya Gaji & Borongan</div>
            <div className="md:hidden space-y-3 p-4">
              {gajian.biayaLain.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/50 p-6 text-center text-sm text-gray-500">Tidak ada biaya lain</div>
              ) : (
                gajian.biayaLain.map((b, idx) => (
                  <div key={`${b.deskripsi}-${idx}`} className="rounded-2xl border border-gray-100 bg-white p-4">
                    <div className="text-sm font-semibold text-gray-900">{b.deskripsi}</div>
                    {b.karyawan ? <div className="text-xs text-gray-500 mt-1 truncate">Karyawan: {b.karyawan}</div> : null}
                    {b.isAutoKg ? (
                      <div className="text-xs text-gray-500 mt-1">
                      {formatNumber(Number(b.jumlah || 0), 2)} {b.satuan || ''} x {formatCurrency(Number(b.hargaSatuan || 0))}
                    </div>
                    ) : null}
                    <div className="text-xs text-gray-400 mt-1">Total</div>
                    <div className="font-semibold text-blue-700">{formatCurrency(Number(b.total) || 0)}</div>
                  </div>
                ))
              )}
            </div>

            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-white">
                  <tr>
                    <th className="px-4 py-2 text-left text-gray-500 font-semibold">Deskripsi</th>
                    <th className="px-4 py-2 text-right text-gray-500 font-semibold">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {gajian.biayaLain.length === 0 ? (
                    <tr>
                      <td colSpan={2} className="px-4 py-6 text-center text-gray-400">
                        Tidak ada biaya lain
                      </td>
                    </tr>
                  ) : (
                    gajian.biayaLain.map((b, idx) => (
                      <tr key={`${b.deskripsi}-${idx}`}>
                        <td className="px-4 py-2">
                          <div className="font-medium text-gray-900">{b.deskripsi}</div>
                          {b.karyawan ? <div className="text-xs text-gray-500 truncate">Karyawan: {b.karyawan}</div> : null}
                          {b.isAutoKg ? (
                            <div className="text-xs text-gray-500">
                              {formatNumber(Number(b.jumlah || 0), 2)} {b.satuan || ''} x {formatCurrency(Number(b.hargaSatuan || 0))}
                            </div>
                          ) : null}
                        </td>
                        <td className="px-4 py-2 text-right font-semibold">{formatCurrency(Number(b.total) || 0)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Potongan */}
          <div className="border border-gray-100 rounded-2xl overflow-hidden lg:col-span-2">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 font-semibold text-gray-700 text-sm flex items-center justify-between gap-3">
              <span>Potongan</span>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  className="rounded-full h-8 text-xs bg-red-600 text-white hover:bg-red-700 border-red-600"
                  onClick={() => {
                    const newId = `p-${Date.now()}`
                    gajian.setPotonganList((prev) => [...prev, { id: newId, deskripsi: '', total: 0, keterangan: '', tanggal: '' }])
                    gajian.setEditingPotonganId(newId)
                  }}
                >
                  + Tambah
                </Button>
              </div>
            </div>
            <div className="p-4 space-y-3">
              {gajian.potonganList.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/50 p-6 text-center text-sm text-gray-500">Tidak ada potongan</div>
              ) : (
                gajian.potonganList.map((p) => (
                  <div key={p.id} className="rounded-2xl border border-gray-100 bg-white p-4 space-y-2">
                    {gajian.editingPotonganId === p.id ? (
                      <>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs text-gray-600">Deskripsi</Label>
                            <Input
                              value={p.deskripsi}
                              onChange={(e) => gajian.setPotonganList((prev) => prev.map((x) => (x.id === p.id ? { ...x, deskripsi: e.target.value } : x)))}
                              className="h-10 rounded-full"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs text-gray-600">Total</Label>
                            <Input
                              inputMode="numeric"
                              value={formatNumber(Number(p.total || 0))}
                              onChange={(e) => {
                                const numericValue = Number(String(e.target.value || '').replace(/\D/g, '')) || 0
                                gajian.setPotonganList((prev) => prev.map((x) => (x.id === p.id ? { ...x, total: numericValue } : x)))
                              }}
                              className="h-10 rounded-full text-right"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs text-gray-600">Tanggal</Label>
                            <Input
                              type="date"
                              min={gajian.startDate}
                              max={gajian.endDate}
                              value={p.tanggal || ''}
                              onChange={(e) => gajian.setPotonganList((prev) => prev.map((x) => (x.id === p.id ? { ...x, tanggal: e.target.value } : x)))}
                              className="h-10 bg-white !rounded-md pr-10"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs text-gray-600">Keterangan</Label>
                            <Input
                              value={p.keterangan || ''}
                              onChange={(e) => gajian.setPotonganList((prev) => prev.map((x) => (x.id === p.id ? { ...x, keterangan: e.target.value } : x)))}
                              className="h-10 rounded-full"
                            />
                          </div>
                        </div>
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="outline" className="rounded-full" onClick={gajian.handleSavePotongan}>
                            Simpan
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            className="rounded-full"
                            onClick={() => {
                              gajian.setPotonganList((prev) => prev.filter((x) => x.id !== p.id))
                              gajian.setEditingPotonganId(null)
                            }}
                          >
                            Hapus
                          </Button>
                        </div>
                      </>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1">
                            <div className="text-sm font-semibold text-gray-900 break-words">{p.deskripsi || '-'}</div>
                            {p.tanggal && <div className="text-xs text-gray-400">{format(new Date(p.tanggal), 'dd MMM yyyy', { locale: localeId })}</div>}
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 rounded-full text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                              onClick={() => gajian.setEditingPotonganId(p.id)}
                            >
                              <PencilSquareIcon className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 rounded-full text-red-600 hover:text-red-700 hover:bg-red-50"
                              onClick={() => {
                                if (gajian.savedPotonganIds[p.id]) {
                                  gajian.handleDeleteSavedPotongan(p.id)
                                } else {
                                  gajian.setPotonganList((prev) => prev.filter((x) => x.id !== p.id))
                                  gajian.setEditingPotonganId((prev) => (prev === p.id ? null : prev))
                                }
                              }}
                            >
                              <TrashIcon className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-500">Total</span>
                          <span className="font-semibold text-gray-900">{formatCurrency(Number(p.total || 0))}</span>
                        </div>
                        {p.keterangan ? <div className="text-xs text-gray-500">{p.keterangan}</div> : null}
                      </div>
                    )}
                  </div>
                ))
              )}
              {gajian.potonganList.length > 0 && (
                <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-gray-700">Total Potongan</span>
                    <span className="font-semibold text-red-600">-{formatCurrency(gajian.totalPotongan)}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* History Section */}
      <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-end gap-4 justify-between">
          <div>
            <h2 className="text-lg md:text-xl font-bold text-gray-900 capitalize">Riwayat Pengajuan Gajian</h2>
            <p className="text-xs md:text-sm text-gray-500">Lihat draft dan gajian final berdasarkan periode pembuatan.</p>
          </div>
          <div className="flex flex-col sm:flex-row items-end gap-3">
            <div className="space-y-1 w-full sm:w-auto">
              <Label>Mulai</Label>
              <Input 
                type="date" 
                value={gajian.historyStartDate} 
                onChange={(e) => gajian.setHistoryStartDate(e.target.value)} 
                className="h-10 w-full sm:w-auto bg-white !rounded-full pr-10" 
              />
            </div>
            <div className="space-y-1 w-full sm:w-auto">
              <Label>Selesai</Label>
              <Input 
                type="date" 
                value={gajian.historyEndDate} 
                onChange={(e) => gajian.setHistoryEndDate(e.target.value)} 
                className="h-10 w-full sm:w-auto bg-white !rounded-full pr-10" 
              />
            </div>
            {/* Removed manual refresh button - auto-refresh on date change */}
          </div>
        </div>

        <div className="md:hidden space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs text-gray-500">
              Menampilkan {gajian.historyItems.length === 0 ? 0 : gajian.historyStartIndex + 1} - {Math.min(gajian.historyStartIndex + gajian.historyPerView, gajian.historyItems.length)} dari {gajian.historyItems.length}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Per View</span>
              <select
                className="h-8 rounded-md border border-gray-200 bg-white px-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                value={gajian.historyPerView}
                onChange={(e) => gajian.setHistoryPerView(Number(e.target.value))}
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
            </div>
          </div>
          {gajian.historyLoading ? (
            <div className="rounded-2xl border border-gray-100 bg-white p-6 text-center text-sm text-gray-400">Memuat riwayat...</div>
          ) : gajian.historyItems.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/50 p-6 text-center text-sm text-gray-500">Belum ada riwayat gajian</div>
          ) : (
            gajian.pagedHistoryItems.map((g) => (
              <div key={`history-${g.id}`} className="rounded-2xl border border-gray-100 bg-white p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="text-xs text-gray-400">Periode</div>
                    <div className="font-semibold text-gray-900">
                      {format(new Date(g.tanggalMulai), 'dd MMM yyyy', { locale: localeId })} - {format(new Date(g.tanggalSelesai), 'dd MMM yyyy', { locale: localeId })}
                    </div>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs font-semibold ${g.status === 'FINALIZED' ? 'bg-emerald-100 text-emerald-700' : 'bg-yellow-100 text-yellow-700'}`}>
                    {g.status === 'FINALIZED' ? 'FINAL' : 'DRAFT'}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <div className="text-gray-400">Total Gajian</div>
                    <div className="font-semibold text-gray-900">{formatCurrency(Number((g as any).totalJumlahGaji) || 0)}</div>
                  </div>
                  <div>
                    <div className="text-gray-400">Gaji Harian</div>
                    <div className="font-semibold text-gray-900">{formatCurrency(Number((g as any).totalGajiHarian) || 0)}</div>
                  </div>
                  <div>
                    <div className="text-gray-400">Potongan</div>
                    <div className="font-semibold text-red-600">-{formatCurrency(Number(g.totalPotongan) || 0)}</div>
                  </div>
                  <div>
                    <div className="text-gray-400">Gaji Bersih</div>
                    <div className="font-semibold text-gray-900">{formatCurrency(Number(g.totalGaji) || 0)}</div>
                  </div>
                  <div>
                    <div className="text-gray-400">Dibuat</div>
                    <div className="font-medium text-gray-700">{format(new Date(g.createdAt), 'dd MMM yyyy', { locale: localeId })}</div>
                  </div>
                </div>
                <div className="pt-2 flex justify-end">
                  <Button size="sm" variant="outline" className="rounded-full" onClick={() => handleOpenDetail(g.id)}>
                    Detail
                  </Button>
                </div>
              </div>
            ))
          )}
          {!gajian.historyLoading && gajian.historyItems.length > 0 && (
            <div className="flex items-center justify-end gap-2">
              <Button variant="outline" size="sm" className="rounded-full" disabled={gajian.historyPage <= 1} onClick={() => gajian.setHistoryPage((p) => Math.max(1, p - 1))}>
                Sebelumnya
              </Button>
              <span className="text-xs text-gray-600">
                Halaman {gajian.historyPage} / {gajian.historyTotalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="rounded-full"
                disabled={gajian.historyPage >= gajian.historyTotalPages}
                onClick={() => gajian.setHistoryPage((p) => Math.min(gajian.historyTotalPages, p + 1))}
              >
                Berikutnya
              </Button>
            </div>
          )}
        </div>

        <div className="hidden md:block overflow-x-auto rounded-2xl border border-gray-100">
          <div className="flex items-center justify-between gap-2 p-3 border-b border-gray-100 bg-white">
            <div className="text-xs text-gray-500">
              Menampilkan {gajian.historyItems.length === 0 ? 0 : gajian.historyStartIndex + 1} - {Math.min(gajian.historyStartIndex + gajian.historyPerView, gajian.historyItems.length)} dari {gajian.historyItems.length}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Per View</span>
              <select
                className="h-8 rounded-md border border-gray-200 bg-white px-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                value={gajian.historyPerView}
                onChange={(e) => gajian.setHistoryPerView(Number(e.target.value))}
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
            </div>
          </div>
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-gray-700">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Periode</th>
                <th className="px-4 py-3 text-left font-semibold">Status</th>
                <th className="px-4 py-3 text-right font-semibold">Jumlah Gajian</th>
                <th className="px-4 py-3 text-right font-semibold">Gaji Harian</th>
                <th className="px-4 py-3 text-right font-semibold">Potongan</th>
                <th className="px-4 py-3 text-right font-semibold">Gaji Bersih</th>
                <th className="px-4 py-3 text-right font-semibold">Dibuat</th>
                <th className="px-4 py-3 text-right font-semibold">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {gajian.historyLoading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-center text-gray-400">
                    Memuat riwayat...
                  </td>
                </tr>
              ) : gajian.historyItems.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-center text-gray-400">
                    Belum ada riwayat gajian
                  </td>
                </tr>
              ) : (
                gajian.pagedHistoryItems.map((g) => (
                  <tr key={g.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-gray-900">
                        {format(new Date(g.tanggalMulai), 'dd MMM yyyy', { locale: localeId })} - {format(new Date(g.tanggalSelesai), 'dd MMM yyyy', { locale: localeId })}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${g.status === 'FINALIZED' ? 'bg-emerald-100 text-emerald-700' : 'bg-yellow-100 text-yellow-700'}`}>
                        {g.status === 'FINALIZED' ? 'FINAL' : 'DRAFT'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">{formatCurrency(Number((g as any).totalJumlahGaji) || 0)}</td>
                    <td className="px-4 py-3 text-right font-semibold">{formatCurrency(Number((g as any).totalGajiHarian) || 0)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-red-600">-{formatCurrency(Number(g.totalPotongan) || 0)}</td>
                    <td className="px-4 py-3 text-right font-semibold">{formatCurrency(Number(g.totalGaji) || 0)}</td>
                    <td className="px-4 py-3 text-right text-gray-500">{format(new Date(g.createdAt), 'dd MMM yyyy', { locale: localeId })}</td>
                    <td className="px-4 py-3 text-right">
                      <Button size="sm" variant="outline" className="rounded-full" onClick={() => handleOpenDetail(g.id)}>
                        Detail
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          {!gajian.historyLoading && gajian.historyItems.length > 0 && (
            <div className="flex items-center justify-end gap-2 p-3 border-t border-gray-100 bg-white">
              <Button variant="outline" size="sm" className="rounded-full" disabled={gajian.historyPage <= 1} onClick={() => gajian.setHistoryPage((p) => Math.max(1, p - 1))}>
                Sebelumnya
              </Button>
              <span className="text-xs text-gray-600">
                Halaman {gajian.historyPage} / {gajian.historyTotalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="rounded-full"
                disabled={gajian.historyPage >= gajian.historyTotalPages}
                onClick={() => gajian.setHistoryPage((p) => Math.min(gajian.historyTotalPages, p + 1))}
              >
                Berikutnya
              </Button>
            </div>
          )}
        </div>
        <DetailGajianModal isOpen={isDetailOpen} onClose={handleCloseDetail} gajian={gajian.selectedGajian} isLoading={gajian.detailLoading} showApprovalFields={true} />
      </div>

      <ConfirmationModal
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={handleSubmit}
        title="Konfirmasi Ajukan Gajian"
        description={`Ajukan gajian periode ${format(new Date(`${gajian.startDate}T00:00:00+07:00`), 'dd MMM yyyy', { locale: localeId })} - ${format(new Date(`${gajian.endDate}T00:00:00+07:00`), 'dd MMM yyyy', { locale: localeId })}?`}
        variant="emerald"
      />
    </div>
  )
}
