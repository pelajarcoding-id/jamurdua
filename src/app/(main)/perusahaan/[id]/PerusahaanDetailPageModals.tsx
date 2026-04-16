'use client'

import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ModalHeader, ModalContentWrapper, ModalFooter } from '@/components/ui/modal-elements'
import { cn } from '@/lib/utils'
import { ASSET_GROUPS, computeStraightLineDepreciation, computeStraightLineYearlySchedule, type AssetTaxGroup } from '@/lib/asset-depreciation'
import {
  ArrowDownTrayIcon,
  ClipboardDocumentListIcon,
  DocumentTextIcon,
  EyeIcon,
  PencilSquareIcon,
  ScaleIcon,
  TagIcon,
  TrashIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'

type DocPreview = {
  type: string
  fileName: string
  fileUrl: string
} | null

export default function PerusahaanDetailPageModals(props: {
  assetModalOpen: boolean
  setAssetModalOpen: (v: boolean) => void
  assetEditing: any | null
  assetName: string
  setAssetName: (v: string) => void
  assetGroup: AssetTaxGroup
  setAssetGroup: (v: AssetTaxGroup) => void
  assetAcquiredAt: string
  setAssetAcquiredAt: (v: string) => void
  assetCost: string
  setAssetCost: (v: string) => void
  assetSalvage: string
  setAssetSalvage: (v: string) => void
  assetSaving: boolean
  saveAsset: () => void

  assetDeleteOpen: boolean
  setAssetDeleteOpen: (v: boolean) => void
  assetDeleteTarget: { name?: string | null } | null
  deleteAsset: () => void

  assetDisposalOpen: boolean
  setAssetDisposalOpen: (v: boolean) => void
  assetDisposalTarget: any | null
  assetDisposalStatus: 'AKTIF' | 'DIJUAL' | 'DIHENTIKAN'
  setAssetDisposalStatus: (v: any) => void
  assetDisposalDate: string
  setAssetDisposalDate: (v: string) => void
  assetDisposalProceeds: string
  setAssetDisposalProceeds: (v: string) => void
  assetDisposalNotes: string
  setAssetDisposalNotes: (v: string) => void
  saveAssetDisposal: () => void

  assetDetailOpen: boolean
  setAssetDetailOpen: (v: boolean) => void
  assetDetailTarget: any | null

  ppnSettingOpen: boolean
  setPpnSettingOpen: (v: boolean) => void
  ppnRatePct: string
  setPpnRatePct: (v: string) => void
  savePpnSetting: () => void
  ppnSettingLoading: boolean

  notaSawitSettingOpen: boolean
  setNotaSawitSettingOpen: (v: boolean) => void
  notaSawitPphEffectiveFrom: string
  setNotaSawitPphEffectiveFrom: (v: string) => void
  notaSawitPphRatePct: string
  setNotaSawitPphRatePct: (v: string) => void
  notaSawitPphRates: any[]
  saveNotaSawitSetting: () => void
  notaSawitSettingLoading: boolean

  editBiayaOpen: boolean
  setEditBiayaOpen: (v: boolean) => void
  setEditBiaya: (v: any | null) => void
  editBiaya: any | null
  kategoriDatalistId: string
  biayaCategories: string[]
  editKategori: string
  setEditKategori: (v: string) => void
  handleSaveEditBiaya: () => void

  kategoriOpen: boolean
  setKategoriOpen: (v: boolean) => void
  kategoriNew: string
  setKategoriNew: (v: string) => void
  addKategori: (name: string) => void
  deleteKategori: (name: string) => void

  taxSettingOpen: boolean
  setTaxSettingOpen: (v: boolean) => void
  taxScheme: string
  setTaxScheme: (v: string) => void
  taxRounding: string
  setTaxRounding: (v: string) => void
  taxStandardRatePct: string
  setTaxStandardRatePct: (v: string) => void
  taxUmkmFinalRatePct: string
  setTaxUmkmFinalRatePct: (v: string) => void
  taxFacilityDiscountPct: string
  setTaxFacilityDiscountPct: (v: string) => void
  taxUmkmThreshold: string
  setTaxUmkmThreshold: (v: string) => void
  taxFacilityThreshold: string
  setTaxFacilityThreshold: (v: string) => void
  taxFacilityPortionThreshold: string
  setTaxFacilityPortionThreshold: (v: string) => void
  saveTaxSetting: () => void
  taxSettingLoading: boolean

  buktiOpen: boolean
  setBuktiOpen: (v: boolean) => void
  buktiUrl: string | null
  setBuktiUrl: (v: string | null) => void
  handleDownloadBukti: () => void

  docPreviewOpen: boolean
  setDocPreviewOpen: (v: boolean) => void
  docPreview: DocPreview
  isPdfPreview: boolean
  labelDocType: (t: string) => string

  formatCurrency: (n: number) => string
  formatRupiahInput: (v: string) => string
  parseRupiahToNumber: (v: string) => number
}) {
  const {
    assetModalOpen,
    setAssetModalOpen,
    assetEditing,
    assetName,
    setAssetName,
    assetGroup,
    setAssetGroup,
    assetAcquiredAt,
    setAssetAcquiredAt,
    assetCost,
    setAssetCost,
    assetSalvage,
    setAssetSalvage,
    assetSaving,
    saveAsset,
    assetDeleteOpen,
    setAssetDeleteOpen,
    assetDeleteTarget,
    deleteAsset,
    assetDisposalOpen,
    setAssetDisposalOpen,
    assetDisposalTarget,
    assetDisposalStatus,
    setAssetDisposalStatus,
    assetDisposalDate,
    setAssetDisposalDate,
    assetDisposalProceeds,
    setAssetDisposalProceeds,
    assetDisposalNotes,
    setAssetDisposalNotes,
    saveAssetDisposal,
    assetDetailOpen,
    setAssetDetailOpen,
    assetDetailTarget,
    ppnSettingOpen,
    setPpnSettingOpen,
    ppnRatePct,
    setPpnRatePct,
    savePpnSetting,
    ppnSettingLoading,
    notaSawitSettingOpen,
    setNotaSawitSettingOpen,
    notaSawitPphEffectiveFrom,
    setNotaSawitPphEffectiveFrom,
    notaSawitPphRatePct,
    setNotaSawitPphRatePct,
    notaSawitPphRates,
    saveNotaSawitSetting,
    notaSawitSettingLoading,
    editBiayaOpen,
    setEditBiayaOpen,
    setEditBiaya,
    editBiaya,
    kategoriDatalistId,
    biayaCategories,
    editKategori,
    setEditKategori,
    handleSaveEditBiaya,
    kategoriOpen,
    setKategoriOpen,
    kategoriNew,
    setKategoriNew,
    addKategori,
    deleteKategori,
    taxSettingOpen,
    setTaxSettingOpen,
    taxScheme,
    setTaxScheme,
    taxRounding,
    setTaxRounding,
    taxStandardRatePct,
    setTaxStandardRatePct,
    taxUmkmFinalRatePct,
    setTaxUmkmFinalRatePct,
    taxFacilityDiscountPct,
    setTaxFacilityDiscountPct,
    taxUmkmThreshold,
    setTaxUmkmThreshold,
    taxFacilityThreshold,
    setTaxFacilityThreshold,
    taxFacilityPortionThreshold,
    setTaxFacilityPortionThreshold,
    saveTaxSetting,
    taxSettingLoading,
    buktiOpen,
    setBuktiOpen,
    buktiUrl,
    setBuktiUrl,
    handleDownloadBukti,
    docPreviewOpen,
    setDocPreviewOpen,
    docPreview,
    isPdfPreview,
    labelDocType,
    formatCurrency,
    formatRupiahInput,
    parseRupiahToNumber,
  } = props

  return (
    <>
      <Dialog open={assetModalOpen} onOpenChange={setAssetModalOpen}>
        <DialogContent className="bg-white w-[95vw] sm:max-w-lg rounded-2xl p-0 overflow-hidden [&>button.absolute]:hidden">
          <ModalHeader
            title={assetEditing ? 'Ubah Harta' : 'Tambah Harta'}
            subtitle="Data aset tetap perusahaan"
            variant="emerald"
            icon={<ClipboardDocumentListIcon className="h-5 w-5 text-white" />}
            onClose={() => setAssetModalOpen(false)}
          />
          <ModalContentWrapper className="space-y-4">
            <div>
              <Label>Nama Harta</Label>
              <Input value={assetName} onChange={(e) => setAssetName(e.target.value)} className="rounded-xl" />
            </div>
            <div>
              <Label>Kelompok (Pajak)</Label>
              <select
                value={assetGroup}
                onChange={(e) => setAssetGroup(e.target.value as AssetTaxGroup)}
                className="w-full h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm focus:outline-none"
              >
                {ASSET_GROUPS.map((g) => (
                  <option key={g.value} value={g.value}>
                    {g.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>Tanggal Perolehan</Label>
                <Input type="date" value={assetAcquiredAt} onChange={(e) => setAssetAcquiredAt(e.target.value)} className="rounded-xl" />
              </div>
              <div>
                <Label>Harga Perolehan</Label>
                <Input
                  value={formatRupiahInput(assetCost)}
                  onChange={(e) => setAssetCost(parseRupiahToNumber(e.target.value).toString())}
                  className="rounded-xl"
                  inputMode="numeric"
                />
              </div>
            </div>
            <div>
              <Label>Nilai Residu (Opsional)</Label>
              <Input
                value={formatRupiahInput(assetSalvage)}
                onChange={(e) => setAssetSalvage(parseRupiahToNumber(e.target.value).toString())}
                className="rounded-xl"
                inputMode="numeric"
              />
            </div>
            <div className="text-xs text-gray-500">Metode: Garis lurus sesuai kelompok penyusutan pajak.</div>
          </ModalContentWrapper>
          <ModalFooter className="pb-[calc(16px+env(safe-area-inset-bottom))] sm:justify-end">
            <Button variant="outline" className="rounded-full" onClick={() => setAssetModalOpen(false)} disabled={assetSaving}>
              Batal
            </Button>
            <Button className="rounded-full bg-emerald-600 hover:bg-emerald-700" onClick={saveAsset} disabled={assetSaving}>
              {assetSaving ? 'Menyimpan...' : 'Simpan'}
            </Button>
          </ModalFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={assetDeleteOpen} onOpenChange={setAssetDeleteOpen}>
        <DialogContent className="bg-white w-[95vw] sm:max-w-md rounded-2xl p-0 overflow-hidden [&>button.absolute]:hidden">
          <ModalHeader
            title="Hapus Harta"
            subtitle="Konfirmasi penghapusan data aset"
            variant="emerald"
            icon={<TrashIcon className="h-5 w-5 text-white" />}
            onClose={() => setAssetDeleteOpen(false)}
          />
          <ModalContentWrapper className="space-y-2">Hapus harta {assetDeleteTarget?.name || ''}?</ModalContentWrapper>
          <ModalFooter className="pb-[calc(16px+env(safe-area-inset-bottom))] sm:justify-end">
            <Button variant="outline" className="rounded-full" onClick={() => setAssetDeleteOpen(false)} disabled={assetSaving}>
              Batal
            </Button>
            <Button className="rounded-full bg-red-600 hover:bg-red-700" onClick={deleteAsset} disabled={assetSaving}>
              {assetSaving ? 'Menghapus...' : 'Hapus'}
            </Button>
          </ModalFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={assetDisposalOpen} onOpenChange={setAssetDisposalOpen}>
        <DialogContent className="bg-white w-[95vw] sm:max-w-lg rounded-2xl p-0 overflow-hidden [&>button.absolute]:hidden flex flex-col">
          <ModalHeader
            title="Penghentian/Penjualan Harta"
            subtitle={assetDisposalTarget?.name || '-'}
            variant="emerald"
            icon={<DocumentTextIcon className="h-5 w-5 text-white" />}
            onClose={() => setAssetDisposalOpen(false)}
          />

          <ModalContentWrapper className="space-y-4">
            <div>
              <Label>Status</Label>
              <select
                value={assetDisposalStatus}
                onChange={(e) => setAssetDisposalStatus(e.target.value as any)}
                className="w-full h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm focus:outline-none mt-1"
              >
                <option value="AKTIF">Aktif</option>
                <option value="DIJUAL">Dijual</option>
                <option value="DIHENTIKAN">Dihentikan</option>
              </select>
              <div className="mt-2 text-[11px] text-gray-500">
                Jika status diubah ke Aktif, data penghentian akan dihapus dan harta dianggap masih digunakan.
              </div>
            </div>

            {assetDisposalStatus !== 'AKTIF' ? (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label>Tanggal Penghentian</Label>
                    <Input type="date" value={assetDisposalDate} onChange={(e) => setAssetDisposalDate(e.target.value)} className="rounded-xl mt-1" />
                  </div>
                  {assetDisposalStatus === 'DIJUAL' ? (
                    <div>
                      <Label>Harga Jual</Label>
                      <Input
                        value={formatRupiahInput(assetDisposalProceeds)}
                        onChange={(e) => setAssetDisposalProceeds(e.target.value)}
                        className="rounded-xl mt-1"
                        inputMode="numeric"
                      />
                    </div>
                  ) : null}
                </div>
                <div>
                  <Label>Keterangan (opsional)</Label>
                  <Input value={assetDisposalNotes} onChange={(e) => setAssetDisposalNotes(e.target.value)} className="rounded-xl mt-1" />
                </div>

                {assetDisposalTarget && assetDisposalDate ? (
                  (() => {
                    const disposedAt = new Date(assetDisposalDate)
                    const depAt = computeStraightLineDepreciation({
                      cost: Number(assetDisposalTarget.cost || 0),
                      salvage: Number(assetDisposalTarget.salvage || 0),
                      acquiredAt: new Date(assetDisposalTarget.acquiredAt),
                      group: String(assetDisposalTarget.group || ''),
                      periodStart: new Date(disposedAt.getFullYear(), 0, 1),
                      periodEnd: disposedAt,
                      disposedAt,
                    })
                    const proceeds = assetDisposalStatus === 'DIJUAL' ? parseRupiahToNumber(assetDisposalProceeds) : 0
                    const gainLoss = proceeds - Number(depAt.bookValue || 0)
                    return (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                          <div className="text-[10px] font-black tracking-wider uppercase text-gray-400">Nilai Buku (Saat Henti)</div>
                          <div className="text-sm font-extrabold text-gray-900 mt-1">{formatCurrency(depAt.bookValue)}</div>
                        </div>
                        <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                          <div className="text-[10px] font-black tracking-wider uppercase text-gray-400">Harga Jual</div>
                          <div className="text-sm font-extrabold text-gray-900 mt-1">{formatCurrency(proceeds)}</div>
                        </div>
                        <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                          <div className="text-[10px] font-black tracking-wider uppercase text-gray-400">Laba/Rugi</div>
                          <div className={cn('text-sm font-extrabold mt-1', gainLoss >= 0 ? 'text-emerald-700' : 'text-rose-700')}>
                            {formatCurrency(gainLoss)}
                          </div>
                        </div>
                      </div>
                    )
                  })()
                ) : null}
              </>
            ) : null}
          </ModalContentWrapper>

          <ModalFooter className="flex-shrink-0 pb-[calc(16px+env(safe-area-inset-bottom))] sm:justify-end">
            <Button variant="outline" className="rounded-full" onClick={() => setAssetDisposalOpen(false)} disabled={assetSaving}>
              Batal
            </Button>
            <Button className="rounded-full bg-emerald-600 hover:bg-emerald-700" onClick={saveAssetDisposal} disabled={assetSaving}>
              {assetSaving ? 'Menyimpan...' : 'Simpan'}
            </Button>
          </ModalFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={assetDetailOpen} onOpenChange={setAssetDetailOpen}>
        <DialogContent className="bg-white w-[95vw] sm:max-w-3xl rounded-2xl p-0 overflow-hidden [&>button.absolute]:hidden flex flex-col">
          <ModalHeader
            title="Detail Penyusutan"
            subtitle={assetDetailTarget?.name || '-'}
            variant="emerald"
            icon={<ScaleIcon className="h-5 w-5 text-white" />}
            onClose={() => setAssetDetailOpen(false)}
          />
          <div className="p-6 flex-1 min-h-0 overflow-y-auto space-y-4">
            {assetDetailTarget ? (
              (() => {
                const groupLabel = ASSET_GROUPS.find((g) => g.value === assetDetailTarget.group)?.label || assetDetailTarget.group
                const disposedAt = assetDetailTarget.disposedAt ? new Date(assetDetailTarget.disposedAt) : null
                const schedule = computeStraightLineYearlySchedule({
                  cost: Number(assetDetailTarget.cost || 0),
                  salvage: Number(assetDetailTarget.salvage || 0),
                  acquiredAt: new Date(assetDetailTarget.acquiredAt),
                  group: String(assetDetailTarget.group || ''),
                  throughYear: null,
                  disposedAt,
                })
                return (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                      <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                        <div className="text-[10px] font-black tracking-wider uppercase text-gray-400">Kelompok</div>
                        <div className="text-sm font-semibold text-gray-900 mt-1">{groupLabel}</div>
                        <div className="text-xs text-gray-500 mt-1">Metode: Garis lurus</div>
                      </div>
                      <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                        <div className="text-[10px] font-black tracking-wider uppercase text-gray-400">Tanggal Perolehan</div>
                        <div className="text-sm font-semibold text-gray-900 mt-1">{new Date(assetDetailTarget.acquiredAt).toLocaleDateString('id-ID')}</div>
                        <div className="text-xs text-gray-500 mt-1">Umur manfaat: {schedule.usefulLifeYears} tahun</div>
                      </div>
                      <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                        <div className="text-[10px] font-black tracking-wider uppercase text-gray-400">Nilai</div>
                        <div className="text-sm font-semibold text-gray-900 mt-1">{formatCurrency(Number(assetDetailTarget.cost || 0))}</div>
                        <div className="text-xs text-gray-500 mt-1">Residu: {formatCurrency(Number(assetDetailTarget.salvage || 0))}</div>
                      </div>
                      <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                        <div className="text-[10px] font-black tracking-wider uppercase text-gray-400">Status</div>
                        <div className="text-sm font-semibold text-gray-900 mt-1">
                          {disposedAt ? (String(assetDetailTarget.disposalType || 'SOLD') === 'SCRAPPED' ? 'Dihentikan' : 'Dijual') : 'Aktif'}
                        </div>
                        {disposedAt ? (
                          <div className="text-xs text-gray-500 mt-1">{disposedAt.toLocaleDateString('id-ID')}</div>
                        ) : (
                          <div className="text-xs text-gray-500 mt-1">-</div>
                        )}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
                      <div className="px-4 py-3 border-b bg-gray-50 flex items-center justify-between gap-2">
                        <div className="text-xs font-black tracking-wider text-gray-700 uppercase">Penyusutan per Tahun</div>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="min-w-[760px] w-full text-sm">
                          <thead className="text-xs text-gray-500 uppercase border-b">
                            <tr>
                              <th className="text-left py-2 px-4">Tahun</th>
                              <th className="text-right py-2 px-4">Bulan</th>
                              <th className="text-right py-2 px-4">Penyusutan</th>
                              <th className="text-right py-2 px-4">Akumulasi</th>
                              <th className="text-right py-2 px-4">Nilai Buku</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {schedule.rows.map((r) => (
                              <tr key={r.year}>
                                <td className="py-2 px-4 font-semibold text-gray-900">{r.year}</td>
                                <td className="py-2 px-4 text-right text-gray-700">{r.months}</td>
                                <td className="py-2 px-4 text-right font-semibold text-gray-900">{formatCurrency(r.expense)}</td>
                                <td className="py-2 px-4 text-right font-semibold text-gray-900">{formatCurrency(r.accumulatedEnd)}</td>
                                <td className="py-2 px-4 text-right font-semibold text-gray-900">{formatCurrency(r.bookValueEnd)}</td>
                              </tr>
                            ))}
                            {schedule.rows.length === 0 ? (
                              <tr>
                                <td colSpan={5} className="py-6 text-center text-sm text-gray-500">
                                  Tidak ada data
                                </td>
                              </tr>
                            ) : null}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </>
                )
              })()
            ) : (
              <div className="text-sm text-gray-500">Pilih harta untuk melihat detail.</div>
            )}
          </div>
          <ModalFooter className="flex-shrink-0 pb-[calc(16px+env(safe-area-inset-bottom))] sm:justify-end">
            <Button variant="outline" className="rounded-full" onClick={() => setAssetDetailOpen(false)}>
              Tutup
            </Button>
          </ModalFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={ppnSettingOpen} onOpenChange={setPpnSettingOpen}>
        <DialogContent className="sm:max-w-[520px] p-0 overflow-hidden [&>button.absolute]:hidden">
          <ModalHeader
            title="Pengaturan Tarif PPN"
            variant="emerald"
            icon={<TagIcon className="h-5 w-5 text-white" />}
            onClose={() => setPpnSettingOpen(false)}
          />
          <ModalContentWrapper className="space-y-4">
            <div className="space-y-2">
              <Label>Tarif PPN (%)</Label>
              <Input
                className="h-10 rounded-xl w-40"
                value={ppnRatePct}
                onChange={(e) => setPpnRatePct(e.target.value)}
                inputMode="decimal"
                placeholder="11"
              />
              <div className="text-xs text-gray-500">Masukkan angka persen. Misal 11 untuk 11%.</div>
            </div>
          </ModalContentWrapper>
          <ModalFooter className="sm:justify-between">
            <Button className="rounded-full" variant="outline" onClick={() => setPpnSettingOpen(false)} disabled={ppnSettingLoading}>
              Batal
            </Button>
            <Button className="rounded-full bg-emerald-600 hover:bg-emerald-700 text-white" onClick={savePpnSetting} disabled={ppnSettingLoading}>
              {ppnSettingLoading ? 'Menyimpan...' : 'Simpan'}
            </Button>
          </ModalFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={notaSawitSettingOpen} onOpenChange={setNotaSawitSettingOpen}>
        <DialogContent className="sm:max-w-[520px] p-0 overflow-hidden [&>button.absolute]:hidden">
          <ModalHeader
            title="Pengaturan Tarif PPh Nota Sawit"
            variant="emerald"
            icon={<TagIcon className="h-5 w-5 text-white" />}
            onClose={() => setNotaSawitSettingOpen(false)}
          />
          <ModalContentWrapper className="space-y-4">
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Berlaku Mulai</Label>
                  <Input
                    type="date"
                    className="h-10 rounded-xl"
                    value={notaSawitPphEffectiveFrom}
                    onChange={(e) => setNotaSawitPphEffectiveFrom(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tarif PPh Nota Sawit (%)</Label>
                  <Input
                    className="h-10 rounded-xl"
                    value={notaSawitPphRatePct}
                    onChange={(e) => setNotaSawitPphRatePct(e.target.value)}
                    inputMode="decimal"
                    placeholder="0.25"
                  />
                </div>
              </div>
              <div className="text-xs text-gray-500">Masukkan angka persen. Misal 0.25 untuk 0,25% atau 0.5 untuk 0,5%.</div>
            </div>

            {notaSawitPphRates.length > 0 ? (
              <div className="rounded-2xl border border-gray-100 bg-white overflow-hidden">
                <div className="px-4 py-3 bg-gray-50 border-b text-xs font-black tracking-wider text-gray-700 uppercase">Riwayat Tarif</div>
                <div className="divide-y divide-gray-100">
                  {notaSawitPphRates.slice(0, 20).map((r: any, idx: number) => {
                    const dt = r?.effectiveFrom ? new Date(r.effectiveFrom) : null
                    const label = dt && !Number.isNaN(dt.getTime()) ? dt.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }) : '-'
                    const pct = Math.round(Number(r?.pphRate ?? 0) * 10000) / 100
                    return (
                      <div key={`${idx}-${String(r?.effectiveFrom)}`} className="px-4 py-3 flex items-center justify-between text-sm">
                        <div className="text-gray-700">{label}</div>
                        <div className="font-extrabold text-gray-900 tabular-nums">{String(pct).replace('.', ',')}%</div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ) : (
              <div className="text-xs text-gray-500">Belum ada riwayat tarif. Simpan tarif pertama untuk membuat riwayat.</div>
            )}
          </ModalContentWrapper>
          <ModalFooter className="sm:justify-between">
            <Button className="rounded-full" variant="outline" onClick={() => setNotaSawitSettingOpen(false)} disabled={notaSawitSettingLoading}>
              Batal
            </Button>
            <Button className="rounded-full bg-emerald-600 hover:bg-emerald-700 text-white" onClick={saveNotaSawitSetting} disabled={notaSawitSettingLoading}>
              {notaSawitSettingLoading ? 'Menyimpan...' : 'Simpan'}
            </Button>
          </ModalFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editBiayaOpen} onOpenChange={(v) => { setEditBiayaOpen(v); if (!v) setEditBiaya(null) }}>
        <DialogContent className="sm:max-w-[520px] p-0 overflow-hidden [&>button.absolute]:hidden">
          <ModalHeader
            title="Edit Kategori Biaya"
            variant="emerald"
            icon={<PencilSquareIcon className="h-5 w-5 text-white" />}
            onClose={() => setEditBiayaOpen(false)}
          />
          <ModalContentWrapper className="space-y-4">
            <div className="text-xs text-gray-500">{editBiaya?.source === 'MANUAL' ? 'Sumber: Biaya Manual' : 'Sumber: Kasir'}</div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-left">Kategori</Label>
              <div className="col-span-3">
                {editBiaya?.source === 'MANUAL' ? (
                  <Input className="h-10 rounded-xl" list={kategoriDatalistId} value={editKategori} onChange={(e) => setEditKategori(e.target.value)} />
                ) : (
                  <div className="space-y-2">
                    <select
                      value={(biayaCategories.find((c) => c.toLowerCase() === String(editKategori || '').trim().toLowerCase()) || '__CUSTOM__') as any}
                      onChange={(e) => {
                        if (e.target.value === '__CUSTOM__') setEditKategori('')
                        else setEditKategori(e.target.value)
                      }}
                      className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm focus:outline-none w-full"
                    >
                      {biayaCategories.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                      <option value="__CUSTOM__">Kategori lainnya…</option>
                    </select>
                    {biayaCategories.some((c) => c.toLowerCase() === String(editKategori || '').trim().toLowerCase()) ? null : (
                      <Input className="h-10 rounded-xl" placeholder="Tulis kategori..." value={editKategori} onChange={(e) => setEditKategori(e.target.value)} />
                    )}
                  </div>
                )}
              </div>
            </div>
            <div className="text-[11px] text-gray-500">Perubahan kategori mempengaruhi “Biaya per Kategori” pada Laba Rugi.</div>
          </ModalContentWrapper>
          <ModalFooter className="sm:justify-between">
            <Button className="rounded-full" variant="outline" onClick={() => setEditBiayaOpen(false)}>
              Batal
            </Button>
            <Button className="rounded-full bg-emerald-600 hover:bg-emerald-700" onClick={handleSaveEditBiaya}>
              Simpan
            </Button>
          </ModalFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={kategoriOpen} onOpenChange={setKategoriOpen}>
        <DialogContent className="sm:max-w-[560px] p-0 overflow-hidden [&>button.absolute]:hidden">
          <ModalHeader
            title="Kelola Kategori Biaya"
            variant="emerald"
            icon={<TagIcon className="h-5 w-5 text-white" />}
            onClose={() => setKategoriOpen(false)}
          />
          <ModalContentWrapper className="space-y-4">
            <div className="text-xs text-gray-500">
              Kategori ini dipakai untuk saran pada input dan dropdown edit. Menghapus kategori tidak menghapus data biaya yang sudah ada.
            </div>
            <div className="flex items-center gap-2">
              <Input className="h-10 rounded-xl" placeholder="Tambah kategori..." value={kategoriNew} onChange={(e) => setKategoriNew(e.target.value)} />
              <Button
                type="button"
                className="h-10 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={() => {
                  const name = String(kategoriNew || '').trim()
                  if (!name) return
                  addKategori(name)
                  setKategoriNew('')
                }}
              >
                Tambah
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {biayaCategories.length === 0 ? (
                <div className="text-sm text-gray-500">Belum ada kategori.</div>
              ) : (
                biayaCategories.map((c) => (
                  <span key={c} className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gray-100 text-gray-700 text-xs font-semibold">
                    {c}
                    <button
                      type="button"
                      onClick={() => deleteKategori(c)}
                      className="ml-1 h-5 w-5 rounded-full bg-white text-gray-600 flex items-center justify-center border border-gray-200 hover:bg-gray-50"
                      aria-label="Hapus kategori"
                      title="Hapus kategori"
                    >
                      <XMarkIcon className="h-3 w-3" />
                    </button>
                  </span>
                ))
              )}
            </div>
          </ModalContentWrapper>
          <ModalFooter className="sm:justify-end">
            <Button className="rounded-full" variant="outline" onClick={() => setKategoriOpen(false)}>
              Tutup
            </Button>
          </ModalFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={taxSettingOpen} onOpenChange={setTaxSettingOpen}>
        <DialogContent className="sm:max-w-[680px] p-0 overflow-hidden [&>button.absolute]:hidden">
          <ModalHeader
            title="Pengaturan Pajak (PPH Badan)"
            variant="emerald"
            icon={<TagIcon className="h-5 w-5 text-white" />}
            onClose={() => setTaxSettingOpen(false)}
          />
          <ModalContentWrapper className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Skema Pajak</Label>
                <select
                  className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm focus:outline-none w-full"
                  value={taxScheme}
                  onChange={(e) => setTaxScheme(e.target.value)}
                >
                  <option value="AUTO">Auto (berdasarkan omzet)</option>
                  <option value="UMKM_FINAL">Final UMKM (omzet)</option>
                  <option value="PASAL_31E">Fasilitas Pasal 31E</option>
                  <option value="STANDARD">Standar</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>Pembulatan Laba Kena Pajak</Label>
                <select
                  className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm focus:outline-none w-full"
                  value={taxRounding}
                  onChange={(e) => setTaxRounding(e.target.value)}
                >
                  <option value="THOUSAND">Dibulatkan 1.000</option>
                  <option value="NONE">Tanpa pembulatan</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Tarif Standar (%)</Label>
                <Input className="h-10 rounded-xl" value={taxStandardRatePct} onChange={(e) => setTaxStandardRatePct(e.target.value)} inputMode="decimal" placeholder="22" />
              </div>
              <div className="space-y-2">
                <Label>Tarif Final UMKM (%)</Label>
                <Input className="h-10 rounded-xl" value={taxUmkmFinalRatePct} onChange={(e) => setTaxUmkmFinalRatePct(e.target.value)} inputMode="decimal" placeholder="0.5" />
              </div>
              <div className="space-y-2">
                <Label>Diskon Pasal 31E (%)</Label>
                <Input className="h-10 rounded-xl" value={taxFacilityDiscountPct} onChange={(e) => setTaxFacilityDiscountPct(e.target.value)} inputMode="decimal" placeholder="50" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Batas Omzet UMKM</Label>
                <Input className="h-10 rounded-xl" value={taxUmkmThreshold} onChange={(e) => setTaxUmkmThreshold(formatRupiahInput(e.target.value))} inputMode="numeric" placeholder="Rp 4.800.000.000" />
              </div>
              <div className="space-y-2">
                <Label>Batas Omzet Pasal 31E</Label>
                <Input className="h-10 rounded-xl" value={taxFacilityThreshold} onChange={(e) => setTaxFacilityThreshold(formatRupiahInput(e.target.value))} inputMode="numeric" placeholder="Rp 50.000.000.000" />
              </div>
              <div className="space-y-2">
                <Label>Porsi Omzet Diskon 31E</Label>
                <Input className="h-10 rounded-xl" value={taxFacilityPortionThreshold} onChange={(e) => setTaxFacilityPortionThreshold(formatRupiahInput(e.target.value))} inputMode="numeric" placeholder="Rp 4.800.000.000" />
              </div>
            </div>

            <div className="text-xs text-gray-500">Skema Auto: omzet ≤ UMKM → Final, omzet ≤ Pasal 31E → 31E, selain itu → Standar.</div>
          </ModalContentWrapper>
          <ModalFooter className="sm:justify-between">
            <Button className="rounded-full" variant="outline" onClick={() => setTaxSettingOpen(false)} disabled={taxSettingLoading}>
              Batal
            </Button>
            <Button className="rounded-full bg-emerald-600 hover:bg-emerald-700 text-white" onClick={saveTaxSetting} disabled={taxSettingLoading}>
              {taxSettingLoading ? 'Menyimpan...' : 'Simpan'}
            </Button>
          </ModalFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={buktiOpen} onOpenChange={(v) => { setBuktiOpen(v); if (!v) setBuktiUrl(null) }}>
        <DialogContent className="w-[96vw] sm:w-[96vw] max-w-3xl h-[90vh] max-h-[90vh] p-0 overflow-hidden rounded-2xl shadow-2xl border-none flex flex-col [&>button.absolute]:hidden">
          <ModalHeader title="Bukti" variant="emerald" icon={<EyeIcon className="h-5 w-5 text-white" />} onClose={() => setBuktiOpen(false)} />
          <div className="p-4 flex-1 min-h-0 bg-black/5">
            {buktiUrl ? (
              <div className="w-full h-full flex items-center justify-center">
                <img src={buktiUrl} alt="Bukti" className="max-w-full max-h-full rounded-xl border bg-white object-contain" />
              </div>
            ) : (
              <div className="text-sm text-gray-500">Tidak ada bukti</div>
            )}
          </div>
          <ModalFooter className="sm:justify-center">
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={handleDownloadBukti}
              disabled={!buktiUrl}
              className="rounded-full"
              aria-label="Download"
              title="Download"
            >
              <ArrowDownTrayIcon className="h-4 w-4" />
            </Button>
          </ModalFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={docPreviewOpen} onOpenChange={setDocPreviewOpen}>
        <DialogContent className="w-[96vw] sm:w-[96vw] max-w-6xl h-[96vh] max-h-[96vh] p-0 overflow-hidden rounded-2xl shadow-2xl border-none flex flex-col [&>button.absolute]:hidden">
          <ModalHeader
            title={docPreview ? labelDocType(docPreview.type) : 'Dokumen'}
            variant="emerald"
            icon={<DocumentTextIcon className="h-5 w-5 text-white" />}
            onClose={() => setDocPreviewOpen(false)}
          />
          <div className="p-4 flex-1 min-h-0">
            {docPreview ? (
              isPdfPreview ? (
                <iframe src={docPreview.fileUrl} className="w-full h-full rounded-lg border" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <img src={docPreview.fileUrl} alt={docPreview.fileName} className="max-w-full max-h-full rounded-lg border object-contain" />
                </div>
              )
            ) : null}
          </div>
          <ModalFooter className="sm:justify-end">
            {docPreview ? (
              <Button asChild className="rounded-xl bg-emerald-600 hover:bg-emerald-700">
                <a href={docPreview.fileUrl} target="_blank" rel="noopener noreferrer">
                  <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
                  Download
                </a>
              </Button>
            ) : null}
          </ModalFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
