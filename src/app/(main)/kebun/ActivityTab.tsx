'use client';

import { useMemo, useState, useEffect, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from 'sonner';
import { ArrowDownTrayIcon, ClipboardDocumentListIcon, UserIcon, BanknotesIcon, CalendarIcon, PlusIcon, CheckIcon, ChevronUpDownIcon, XMarkIcon, PencilSquareIcon, EyeIcon, TrashIcon, TruckIcon, MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { ConfirmationModal } from "@/components/ui/confirmation-modal";
import ImageUpload from '@/components/ui/ImageUpload';
import { ModalHeader, ModalContentWrapper, ModalFooter } from '@/components/ui/modal-elements'

type Pekerjaan = {
  id: number;
  ids?: number[];
  date: string;
  jenisPekerjaan: string;
  kategoriBorongan?: string | null;
  keterangan: string | null;
  biaya: number;
  imageUrl?: string | null;
  gajianId?: number | null;
  gajianStatus?: string | null;
  upahBorongan?: boolean;
  jumlah?: number | null;
  satuan?: string | null;
  hargaSatuan?: number | null;
  kendaraanPlatNomor?: string | null;
  kendaraan?: { platNomor: string; merk: string; jenis: string } | null;
  user: { id: number; name: string } | null;
  users?: { id: number; name: string }[];
  paidCount?: number;
  totalCount?: number;
  inGajianCount?: number;
  finalizedCount?: number;
};

type User = {
  id: number;
  name: string;
};

type Kendaraan = {
  platNomor: string
  merk: string
  jenis: string
}

const formatWibYmd = (date: Date) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)

const formatWibYm = (date: Date) => formatWibYmd(date).slice(0, 7)

const parseMonthToWibDate = (ym: string) => {
  const raw = String(ym || '').trim()
  if (!raw) return null
  const m = raw.match(/^(\d{4})-(\d{2})$/)
  if (!m) return null
  return new Date(`${m[1]}-${m[2]}-01T00:00:00+07:00`)
}

const formatNumber = (value: number | string, maxFractionDigits = 0) => {
  const numeric = typeof value === 'string' ? parseNumber(value) : value;
  return new Intl.NumberFormat('id-ID', { maximumFractionDigits: maxFractionDigits }).format(numeric || 0);
};

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value || 0);
}

const parseNumber = (value: string) => {
  return parseFloat(value.replace(/\./g, '').replace(',', '.')) || 0;
};

const FormattedNumberInput = ({
  value,
  onChange,
  className,
  placeholder,
  disabled,
}: {
  value: number;
  onChange: (value: number) => void;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
}) => {
  const [localValue, setLocalValue] = useState('');

  useEffect(() => {
    // Only update localValue if it differs from the formatted version of the incoming value
    // This allows users to type while keeping the cursor position mostly stable
    const formatted = value === 0 ? '' : formatNumber(value);
    const currentDigits = localValue.replace(/\D/g, '');
    const valueDigits = value.toString().replace(/\D/g, '');
    
    if (currentDigits !== valueDigits) {
      setLocalValue(formatted);
    }
  }, [value]);

  return (
    <Input
      value={localValue}
      onChange={(e) => {
        const raw = e.target.value;
        // Remove everything except digits
        const digits = raw.replace(/\D/g, '');
        const num = digits ? parseInt(digits, 10) : 0;
        
        // Update local display immediately with formatting
        setLocalValue(num === 0 ? '' : formatNumber(num));
        // Notify parent of numeric value change
        onChange(num);
      }}
      className={className}
      placeholder={placeholder}
      inputMode="numeric"
      disabled={disabled}
    />
  );
};

export default function ActivityTab({ kebunId, mode }: { kebunId: number; mode?: 'aktivitas' | 'borongan' }) {
  const [activities, setActivity] = useState<Pekerjaan[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [kendaraanList, setKendaraanList] = useState<Kendaraan[]>([])
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [buktiFile, setBuktiFile] = useState<File | null>(null);
  const [buktiPreview, setBuktiPreview] = useState<string | null>(null);
  const [editBuktiFile, setEditBuktiFile] = useState<File | null>(null);
  const [editBuktiPreview, setEditBuktiPreview] = useState<string | null>(null);
  const [viewImageUrl, setViewImageUrl] = useState<string | null>(null);
  const [viewImageError, setViewImageError] = useState(false);
  const [detailImageError, setDetailImageError] = useState(false);

  // Form State
  const [formData, setFormData] = useState(() => ({
    date: formatWibYmd(new Date()),
    kategoriBorongan: '',
    jenisPekerjaan: '',
    keterangan: '',
    biaya: 0,
    upahBorongan: mode === 'borongan',
    kendaraanPlatNomor: '',
    jumlah: 0,
    satuan: '',
    hargaSatuan: 0,
  }));
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const [openUserSelect, setOpenUserSelect] = useState(false);
  const [userQuery, setUserQuery] = useState('');
  const [openKendaraanSelect, setOpenKendaraanSelect] = useState(false)
  const [kendaraanQuery, setKendaraanQuery] = useState('')
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailExporting, setDetailExporting] = useState(false);
  const [listExporting, setListExporting] = useState(false)
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<Pekerjaan | null>(null);
  const [editUserQuery, setEditUserQuery] = useState('');
  const [openEditUserSelect, setOpenEditUserSelect] = useState(false);
  const [openEditKendaraanSelect, setOpenEditKendaraanSelect] = useState(false)
  const [editKendaraanQuery, setEditKendaraanQuery] = useState('')
  const [editForm, setEditForm] = useState(() => ({
    date: formatWibYmd(new Date()),
    kategoriBorongan: '',
    jenisPekerjaan: '',
    keterangan: '',
    biaya: 0,
    upahBorongan: mode === 'borongan',
    jumlah: 0,
    satuan: '',
    hargaSatuan: 0,
    userId: '',
    kendaraanPlatNomor: '',
  }));

  const [currentPage, setCurrentPage] = useState(1);
  const [perView, setPerView] = useState(20);
  const [searchDraft, setSearchDraft] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'draft' | 'penggajian' | 'dibayar'>('all')
  const [kategoriFilter, setKategoriFilter] = useState<string>('all')
  const [kategoriMaster, setKategoriMaster] = useState<Array<{ id: number; name: string }>>([])
  const [kategoriMasterOpen, setKategoriMasterOpen] = useState(false)
  const [kategoriMasterDraft, setKategoriMasterDraft] = useState('')
  const [kategoriMasterSaving, setKategoriMasterSaving] = useState(false)
  const [kategoriMasterDeletingId, setKategoriMasterDeletingId] = useState<number | null>(null)

  const applySearch = useCallback(() => {
    setSearchQuery(String(searchDraft || '').trim())
    setCurrentPage(1)
  }, [searchDraft])

  const fetchKategoriMaster = useCallback(async () => {
    if (mode !== 'borongan') return
    try {
      const res = await fetch(`/api/kebun/${kebunId}/borongan/categories`, { cache: 'no-store' })
      if (!res.ok) {
        setKategoriMaster([])
        return
      }
      const json = await res.json().catch(() => ({} as any))
      const rows = Array.isArray(json?.data) ? json.data : []
      const mapped = rows
        .map((r: any) => ({ id: Number(r?.id), name: String(r?.name || '').trim() }))
        .filter((r: any) => Number.isFinite(r.id) && r.id > 0 && r.name)
      setKategoriMaster(mapped)
    } catch {
      setKategoriMaster([])
    }
  }, [kebunId, mode])

  const handleAddKategoriMaster = useCallback(async () => {
    if (mode !== 'borongan') return
    if (kategoriMasterSaving) return
    const name = String(kategoriMasterDraft || '').trim()
    if (!name) return
    setKategoriMasterSaving(true)
    try {
      const res = await fetch(`/api/kebun/${kebunId}/borongan/categories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      const json = await res.json().catch(() => ({} as any))
      if (!res.ok) throw new Error(json?.error || 'Gagal menambahkan kategori')
      setKategoriMasterDraft('')
      await fetchKategoriMaster()
      toast.success('Kategori ditambahkan')
    } catch (e: any) {
      toast.error(e?.message || 'Gagal menambahkan kategori')
    } finally {
      setKategoriMasterSaving(false)
    }
  }, [fetchKategoriMaster, kebunId, kategoriMasterDraft, kategoriMasterSaving, mode])

  const handleDeleteKategoriMaster = useCallback(async (id: number) => {
    if (mode !== 'borongan') return
    if (kategoriMasterDeletingId) return
    setKategoriMasterDeletingId(id)
    try {
      const res = await fetch(`/api/kebun/${kebunId}/borongan/categories?id=${encodeURIComponent(String(id))}`, {
        method: 'DELETE',
      })
      const json = await res.json().catch(() => ({} as any))
      if (!res.ok) throw new Error(json?.error || 'Gagal menghapus kategori')
      await fetchKategoriMaster()
      toast.success('Kategori dihapus')
    } catch (e: any) {
      toast.error(e?.message || 'Gagal menghapus kategori')
    } finally {
      setKategoriMasterDeletingId(null)
    }
  }, [fetchKategoriMaster, kebunId, kategoriMasterDeletingId, mode])

  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [filterType, setFilterType] = useState<'month' | 'year' | 'range'>('month');
  const [activityFilter, setActivityFilter] = useState<'all' | 'upah' | 'aktivitas'>(() => {
    if (mode === 'borongan') return 'upah'
    if (mode === 'aktivitas') return 'aktivitas'
    return 'all'
  });
  const [dateRange, setDateRange] = useState({
    start: formatWibYmd(new Date()),
    end: formatWibYmd(new Date())
  });

  useEffect(() => {
    fetchActivities();
  }, [kebunId, selectedDate, filterType, dateRange, activityFilter]);

  useEffect(() => {
    if (mode === 'borongan') setActivityFilter('upah')
    if (mode === 'aktivitas') setActivityFilter('aktivitas')
    if (mode !== 'borongan') setStatusFilter('all')
    if (mode !== 'borongan') setKategoriFilter('all')
  }, [mode]);

  useEffect(() => {
    fetchUsers();
  }, [kebunId]);

  useEffect(() => {
    fetchKategoriMaster()
  }, [fetchKategoriMaster])

  useEffect(() => {
    const fetchKendaraan = async () => {
      try {
        const res = await fetch('/api/kendaraan/list', { cache: 'no-store' })
        if (!res.ok) {
          setKendaraanList([])
          return
        }
        const data = await res.json()
        const list = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : []
        const filtered: Kendaraan[] = list
          .map((k: any) => ({
            platNomor: String(k?.platNomor || ''),
            merk: String(k?.merk || ''),
            jenis: String(k?.jenis || ''),
          }))
          .filter((k: Kendaraan) => k.platNomor && ['Mobil Truck', 'Alat Berat'].includes(k.jenis))
          .sort((a: Kendaraan, b: Kendaraan) => {
            const rank = (x: Kendaraan) => (x.jenis === 'Alat Berat' ? 0 : 1)
            const r = rank(a) - rank(b)
            if (r !== 0) return r
            return a.platNomor.localeCompare(b.platNomor)
          })
        setKendaraanList(filtered)
      } catch {
        setKendaraanList([])
      }
    }
    fetchKendaraan()
  }, [])

  const fetchActivities = async () => {
    try {
      setIsLoading(true);
      let startYmd: string
      let endYmd: string

      if (filterType === 'month') {
        const ymd = formatWibYmd(selectedDate)
        const y = Number(ymd.slice(0, 4))
        const m = Number(ymd.slice(5, 7))
        const endDay = new Date(Date.UTC(y, m, 0)).getUTCDate()
        startYmd = `${ymd.slice(0, 8)}01`
        endYmd = `${ymd.slice(0, 5)}${String(m).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`
      } else if (filterType === 'year') {
        const y = Number(formatWibYmd(selectedDate).slice(0, 4))
        startYmd = `${y}-01-01`
        endYmd = `${y}-12-31`
      } else {
        startYmd = dateRange.start
        endYmd = dateRange.end
      }
      
      const baseUrl = new URL(`/api/kebun/${kebunId}/pekerjaan`, window.location.origin)
      baseUrl.searchParams.set('startDate', startYmd)
      baseUrl.searchParams.set('endDate', endYmd)
      if (activityFilter === 'upah') baseUrl.searchParams.set('upahBorongan', '1')
      if (activityFilter === 'aktivitas') baseUrl.searchParams.set('aktivitas', '1')
      const res = await fetch(baseUrl.toString());
      if (!res.ok) throw new Error('Gagal mengambil data');
      const data = await res.json();
      const grouped = new Map<string, Pekerjaan>();
      (Array.isArray(data) ? data : []).forEach((item: Pekerjaan) => {
        const dateKey = item.date ? formatWibYmd(new Date(item.date)) : '';
      const key = item.upahBorongan
        ? `${dateKey}|${item.jenisPekerjaan}|${item.keterangan || ''}|${item.biaya || 0}|${item.jumlah || 0}|${item.satuan || ''}|${item.hargaSatuan || 0}|${(item as any).imageUrl || ''}`
        : `${dateKey}|${item.jenisPekerjaan}|${item.keterangan || ''}|${(item as any).imageUrl || ''}`;
        const isPaid = !!(item.upahBorongan && item.gajianStatus === 'FINALIZED')
        const isInGajian = !!(item.upahBorongan && item.gajianId)
        if (!grouped.has(key)) {
          grouped.set(key, {
            ...item,
            ids: [item.id],
            users: item.user ? [item.user] : [],
            paidCount: isPaid ? 1 : 0,
            totalCount: 1,
            inGajianCount: isInGajian ? 1 : 0,
            finalizedCount: isPaid ? 1 : 0,
          });
        } else {
          const existing = grouped.get(key)!;
          existing.ids = [...(existing.ids || []), item.id];
          if (item.user) {
            existing.users = [...(existing.users || []), item.user];
          }
          existing.totalCount = (existing.totalCount || 0) + 1
          existing.paidCount = (existing.paidCount || 0) + (isPaid ? 1 : 0)
          existing.inGajianCount = (existing.inGajianCount || 0) + (isInGajian ? 1 : 0)
          existing.finalizedCount = (existing.finalizedCount || 0) + (isPaid ? 1 : 0)
        }
      });
      setActivity(Array.from(grouped.values()));
    } catch (error) {
      console.error(error);
      toast.error('Gagal memuat riwayat pekerjaan');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch(`/api/kebun/${kebunId}/karyawan?limit=1000`, { cache: 'no-store' });
      if (res.ok) {
        const responseData = await res.json();
        if (Array.isArray(responseData.data)) {
            setUsers(responseData.data);
        } else if (Array.isArray(responseData)) {
            // Jaga-jaga jika format berubah jadi array langsung
            setUsers(responseData);
        } else {
            setUsers([]);
        }
      }
    } catch (error) {
      console.error('Error fetching users:', error);
      setUsers([]);
    }
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    if (filterType === 'month') {
      const date = parseMonthToWibDate(e.target.value)
      if (date && !isNaN(date.getTime())) setSelectedDate(date);
    } else if (filterType === 'year') {
      const year = parseInt(e.target.value);
      if (!isNaN(year)) {
        setSelectedDate(new Date(`${year}-01-01T00:00:00+07:00`));
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    const loadingToast = toast.loading('Menyimpan pekerjaan...');

    try {
      let imageUrl: string | null = null;
      if (buktiFile) {
        const fd = new FormData();
        fd.append('file', buktiFile);
        const up = await fetch('/api/upload', { method: 'POST', body: fd });
        const upJson = await up.json().catch(() => ({}));
        if (!up.ok || !upJson?.success) throw new Error(upJson?.error || 'Upload gambar gagal');
        imageUrl = upJson.url;
      }

      const effectiveUpahBorongan = mode === 'borongan' ? true : mode === 'aktivitas' ? false : formData.upahBorongan
      const totalBiaya = effectiveUpahBorongan ? Math.round(Number(formData.jumlah || 0) * Number(formData.hargaSatuan || 0)) : 0;
      const payload: any = {
        ...formData,
        upahBorongan: effectiveUpahBorongan,
        biaya: totalBiaya,
        userIds: selectedUserIds,
        imageUrl,
      }
      if (mode === 'aktivitas') {
        delete payload.kategoriBorongan
        delete payload.jumlah
        delete payload.satuan
        delete payload.hargaSatuan
        payload.kendaraanPlatNomor = (formData as any).kendaraanPlatNomor || undefined
      } else {
        delete payload.kendaraanPlatNomor
      }
      const res = await fetch(`/api/kebun/${kebunId}/pekerjaan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error('Gagal menyimpan');

      toast.success('Pekerjaan berhasil dicatat', { id: loadingToast });
      setFormData({
        date: formatWibYmd(new Date()),
        kategoriBorongan: '',
        jenisPekerjaan: '',
        keterangan: '',
        biaya: 0,
        upahBorongan: mode === 'borongan',
        kendaraanPlatNomor: '',
        jumlah: 0,
        satuan: '',
        hargaSatuan: 0,
      });
      setSelectedUserIds([]);
      setBuktiFile(null);
      setBuktiPreview(null);
      setShowForm(false);
      fetchActivities();
    } catch (error) {
      toast.error('Gagal menyimpan data', { id: loadingToast });
    } finally {
      setIsSubmitting(false);
    }
  };

  const openDetail = (item: Pekerjaan) => {
    setSelectedActivity(item);
    setDetailImageError(false);
    setDetailOpen(true);
  };

  const handleExportDetailPdf = async () => {
    if (!selectedActivity || detailExporting) return
    setDetailExporting(true)
    try {
      const jsPDF = (await import('jspdf')).default
      const autoTable = (await import('jspdf-autotable')).default

      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      const pageWidth = doc.internal.pageSize.getWidth()
      const pageHeight = doc.internal.pageSize.getHeight()

      const headerBg = [37, 99, 235] as const
      const footerBg = [15, 23, 42] as const
      const headerHeight = 16
      const footerHeight = 10

      const title = 'Detail Pekerjaan'
      const subTitle = `Kebun ID: ${kebunId}`

      const activityDate = selectedActivity.date ? new Date(selectedActivity.date) : null
      const dateText = activityDate
        ? activityDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
        : '-'

      const karyawanText = (selectedActivity.users && selectedActivity.users.length > 0)
        ? selectedActivity.users.map(u => u.name).join(', ')
        : selectedActivity.user
          ? selectedActivity.user.name
          : '-'

      const biayaTotal = Number(selectedActivity.biaya || 0)
      const jumlahText = `${Number(selectedActivity.jumlah || 0).toLocaleString('id-ID')} ${selectedActivity.satuan || ''}`.trim()
      const biayaSatuan = Number(selectedActivity.hargaSatuan || 0)

      const rows: Array<[string, string]> = []
      rows.push(['Jenis Pekerjaan', selectedActivity.jenisPekerjaan || '-'])
      rows.push(['Tanggal', dateText])
      rows.push(['Karyawan', karyawanText])
      if (selectedActivity.upahBorongan) {
        rows.push(['Jumlah', jumlahText || '-'])
        rows.push(['Biaya / Satuan', formatCurrency(biayaSatuan)])
        rows.push(['Total Biaya', formatCurrency(biayaTotal)])
      } else {
        rows.push(['Biaya', formatCurrency(biayaTotal)])
      }
      rows.push(['Keterangan', selectedActivity.keterangan || '-'])

      const drawChrome = (pageNumber: number, totalPages: number) => {
        doc.setFillColor(headerBg[0], headerBg[1], headerBg[2])
        doc.rect(0, 0, pageWidth, headerHeight, 'F')
        doc.setTextColor(255, 255, 255)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(12)
        doc.text(title, 12, 10)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(9)
        doc.text(subTitle, pageWidth - 12, 10, { align: 'right' })

        doc.setFillColor(footerBg[0], footerBg[1], footerBg[2])
        doc.rect(0, pageHeight - footerHeight, pageWidth, footerHeight, 'F')
        doc.setTextColor(255, 255, 255)
        doc.setFontSize(8)
        doc.text(`Halaman ${pageNumber} / ${totalPages}`, pageWidth - 12, pageHeight - 3, { align: 'right' })
        doc.text(`Dicetak: ${new Date().toLocaleDateString('id-ID')}`, 12, pageHeight - 3)
      }

      autoTable(doc, {
        startY: headerHeight + 10,
        theme: 'grid',
        head: [['Field', 'Nilai']],
        body: rows,
        styles: { fontSize: 9, cellPadding: 3, textColor: [15, 23, 42] },
        headStyles: { fillColor: headerBg as any, textColor: 255, fontStyle: 'bold' as const },
        columnStyles: {
          0: { cellWidth: 45, fontStyle: 'bold' as const },
          1: { cellWidth: pageWidth - 24 - 45 },
        },
        margin: { left: 12, right: 12, top: headerHeight + 10, bottom: footerHeight + 8 },
      })

      const totalPages = doc.getNumberOfPages()
      for (let p = 1; p <= totalPages; p++) {
        doc.setPage(p)
        drawChrome(p, totalPages)
      }

      const safeJenis = String(selectedActivity.jenisPekerjaan || 'pekerjaan').replace(/[^\p{L}\p{N}\s_-]/gu, '').trim().replace(/\s+/g, '-')
      const safeDate = activityDate ? formatWibYmd(activityDate) : 'tanggal'
      doc.save(`detail-pekerjaan-${safeDate}-${safeJenis}.pdf`)
    } catch {
      toast.error('Gagal export PDF')
    } finally {
      setDetailExporting(false)
    }
  }

  const openEdit = (item: Pekerjaan) => {
    setSelectedActivity(item);
    setEditBuktiFile(null);
    setEditBuktiPreview(item.imageUrl || null);
    const userIds = item.users && item.users.length > 0 ? item.users.map(u => u.id) : (item.user ? [item.user.id] : []);
    setEditForm({
      date: item.date ? formatWibYmd(new Date(item.date)) : formatWibYmd(new Date()),
      kategoriBorongan: String((item as any).kategoriBorongan || ''),
      jenisPekerjaan: item.jenisPekerjaan,
      keterangan: item.keterangan || '',
      biaya: item.biaya || 0,
      upahBorongan: mode === 'borongan' ? true : mode === 'aktivitas' ? false : item.upahBorongan ?? (item.biaya || 0) > 0,
      jumlah: item.jumlah || 0,
      satuan: item.satuan || '',
      hargaSatuan: item.hargaSatuan || 0,
      userId: userIds.length === 1 ? String(userIds[0]) : '',
      kendaraanPlatNomor: item.kendaraan?.platNomor || item.kendaraanPlatNomor || '',
    });
    setEditOpen(true);
  };

  const openDelete = (item: Pekerjaan) => {
    setSelectedActivity(item);
    setDeleteOpen(true);
  };

  const handleUpdate = async () => {
    if (!selectedActivity) return;
    const loadingToast = toast.loading('Menyimpan perubahan...');
    try {
      const ids = selectedActivity.ids && selectedActivity.ids.length > 0 ? selectedActivity.ids : [selectedActivity.id];
      const effectiveUpahBorongan = mode === 'borongan' ? true : mode === 'aktivitas' ? false : editForm.upahBorongan
      const totalBiaya = effectiveUpahBorongan ? Math.round(Number(editForm.jumlah || 0) * Number(editForm.hargaSatuan || 0)) : 0;
      const payload: any = {
        ids,
        ...editForm,
        upahBorongan: effectiveUpahBorongan,
        biaya: totalBiaya,
      }
      if (mode === 'aktivitas') {
        delete payload.kategoriBorongan
        delete payload.jumlah
        delete payload.satuan
        delete payload.hargaSatuan
      } else {
        delete payload.kendaraanPlatNomor
      }
      let imageUrl: string | undefined = undefined;
      if (editBuktiFile) {
        const fd = new FormData();
        fd.append('file', editBuktiFile);
        const up = await fetch('/api/upload', { method: 'POST', body: fd });
        const upJson = await up.json().catch(() => ({}));
        if (!up.ok || !upJson?.success) throw new Error(upJson?.error || 'Upload gambar gagal');
        imageUrl = upJson.url;
      }
      if (typeof imageUrl !== 'undefined') payload.imageUrl = imageUrl
      const res = await fetch(`/api/kebun/${kebunId}/pekerjaan`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Gagal memperbarui');
      toast.success('Pekerjaan diperbarui', { id: loadingToast });
      setEditOpen(false);
      setSelectedActivity(null);
      setEditBuktiFile(null);
      setEditBuktiPreview(null);
      fetchActivities();
    } catch (error) {
      toast.error('Gagal memperbarui data', { id: loadingToast });
    }
  };

  const handleDelete = async () => {
    if (!selectedActivity) return;
    try {
      const ids = selectedActivity.ids && selectedActivity.ids.length > 0 ? selectedActivity.ids : [selectedActivity.id];
      const res = await fetch(`/api/kebun/${kebunId}/pekerjaan?ids=${ids.join(',')}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Gagal menghapus');
      toast.success('Pekerjaan dihapus');
      setDeleteOpen(false);
      setSelectedActivity(null);
      fetchActivities();
    } catch (error) {
      toast.error('Gagal menghapus data');
    }
  };

  const filteredActivities = useMemo(() => {
    const q = String(searchQuery || '').trim().toLowerCase()
    return activities.filter((item) => {
      if (activityFilter === 'upah' && !item.upahBorongan) return false
      if (activityFilter === 'aktivitas' && item.upahBorongan) return false

      if (mode === 'borongan') {
        const totalCount = Number(item.totalCount || 0) || 1
        const inGajianCount = Number(item.inGajianCount || 0)
        const finalizedCount = Number(item.finalizedCount || 0)
        const isPaid = !!(item.upahBorongan && finalizedCount > 0 && finalizedCount === totalCount)
        const isInGajian = !!(item.upahBorongan && inGajianCount > 0 && !isPaid)
        const isDraft = !!(item.upahBorongan && !isPaid && !isInGajian)

        if (statusFilter === 'dibayar' && !isPaid) return false
        if (statusFilter === 'penggajian' && !isInGajian) return false
        if (statusFilter === 'draft' && !isDraft) return false

        if (kategoriFilter !== 'all') {
          const kategori = String((item as any).kategoriBorongan || '').trim()
          if (kategoriFilter === '__none__') {
            if (kategori) return false
          } else {
            if (kategori.toLowerCase() !== String(kategoriFilter).toLowerCase()) return false
          }
        }
      }

      if (!q) return true

      const userNames = (item.users && item.users.length > 0) ? item.users.map((u) => u.name).join(' ') : (item.user?.name || '')
      const kendaraanText = `${item.kendaraan?.platNomor || item.kendaraanPlatNomor || ''} ${item.kendaraan?.merk || ''} ${item.kendaraan?.jenis || ''}`
      const kategoriText = String((item as any).kategoriBorongan || '')
      const haystack = `${kategoriText} ${item.jenisPekerjaan || ''} ${item.keterangan || ''} ${userNames} ${kendaraanText}`.toLowerCase()
      return haystack.includes(q)
    })
  }, [activities, activityFilter, kategoriFilter, mode, searchQuery, statusFilter])

  const totalPages = Math.max(1, Math.ceil(filteredActivities.length / perView));
  const startIndex = (currentPage - 1) * perView;
  const pagedActivities = filteredActivities.slice(startIndex, startIndex + perView);

  useEffect(() => {
    setCurrentPage(1);
  }, [kebunId, selectedDate, filterType, dateRange, activityFilter, statusFilter, kategoriFilter]);

  const boronganFooter = useMemo(() => {
    if (mode !== 'borongan') return null
    const totalJumlah = filteredActivities.reduce((acc, curr) => acc + Number(curr.jumlah || 0), 0)
    const totalBiaya = filteredActivities.reduce((acc, curr) => acc + Number(curr.biaya || 0), 0)
    const avgHargaSatuan = totalJumlah > 0 ? Math.round(totalBiaya / totalJumlah) : 0
    return { totalJumlah, totalBiaya, avgHargaSatuan }
  }, [filteredActivities, mode])

  const kategoriBoronganOptions = useMemo(() => {
    if (mode !== 'borongan') return [] as string[]
    const set = new Set<string>()
    kategoriMaster.forEach((k) => {
      const name = String(k?.name || '').trim()
      if (name) set.add(name)
    })
    activities.forEach((a) => {
      if (!a?.upahBorongan) return
      const k = String((a as any).kategoriBorongan || '').trim()
      if (k) set.add(k)
    })
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'id-ID'))
  }, [activities, kategoriMaster, mode])

  const handleExportListPdf = useCallback(async () => {
    if (listExporting) return
    if (!filteredActivities || filteredActivities.length === 0) return
    setListExporting(true)
    try {
      const jsPDF = (await import('jspdf')).default
      const autoTable = (await import('jspdf-autotable')).default

      const isBoronganMode = mode === 'borongan'
      const isAktivitasMode = mode === 'aktivitas'
      const doc = new jsPDF({ orientation: isBoronganMode ? 'landscape' : 'portrait', unit: 'mm', format: 'a4' })
      const pageWidth = doc.internal.pageSize.getWidth()
      const pageHeight = doc.internal.pageSize.getHeight()

      const headerBg = [5, 150, 105] as const
      const footerBg = [15, 23, 42] as const
      const headerHeight = 16
      const footerHeight = 10

      let startYmd: string
      let endYmd: string
      if (filterType === 'month') {
        const ymd = formatWibYmd(selectedDate)
        const y = Number(ymd.slice(0, 4))
        const m = Number(ymd.slice(5, 7))
        const endDay = new Date(Date.UTC(y, m, 0)).getUTCDate()
        startYmd = `${ymd.slice(0, 8)}01`
        endYmd = `${ymd.slice(0, 5)}${String(m).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`
      } else if (filterType === 'year') {
        const y = Number(formatWibYmd(selectedDate).slice(0, 4))
        startYmd = `${y}-01-01`
        endYmd = `${y}-12-31`
      } else {
        startYmd = dateRange.start
        endYmd = dateRange.end
      }

      const title = isBoronganMode ? 'Laporan Borongan' : isAktivitasMode ? 'Laporan Aktivitas' : 'Laporan Aktivitas & Borongan'
      const period = `Periode ${startYmd} s/d ${endYmd}`

      const drawChrome = (pageNumber: number, totalPages: number) => {
        doc.setFillColor(headerBg[0], headerBg[1], headerBg[2])
        doc.rect(0, 0, pageWidth, headerHeight, 'F')
        doc.setTextColor(255, 255, 255)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(11)
        doc.text(title, 12, 10)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(9)
        doc.text(period, pageWidth - 12, 10, { align: 'right' })

        doc.setFillColor(footerBg[0], footerBg[1], footerBg[2])
        doc.rect(0, pageHeight - footerHeight, pageWidth, footerHeight, 'F')
        doc.setTextColor(255, 255, 255)
        doc.setFontSize(8)
        doc.text(`Halaman ${pageNumber} / ${totalPages}`, pageWidth - 12, pageHeight - 3, { align: 'right' })
        doc.text(`Dicetak: ${new Date().toLocaleDateString('id-ID')}`, 12, pageHeight - 3)
      }

      const getStatus = (item: Pekerjaan) => {
        const isUpah = !!item.upahBorongan
        const totalCount = Number(item.totalCount || 0) || 1
        const inGajianCount = Number(item.inGajianCount || 0)
        const finalizedCount = Number(item.finalizedCount || 0)
        const isPaid = isUpah && finalizedCount > 0 && finalizedCount === totalCount
        const isInGajian = isUpah && inGajianCount > 0 && !isPaid
        if (isPaid) return 'Dibayar'
        if (isInGajian) return 'Penggajian'
        if (isUpah) return 'Draft'
        return 'Aktivitas'
      }

      if (isBoronganMode) {
        const rows = filteredActivities.map((item, idx) => {
          const jumlah = Number(item.jumlah || 0)
          const hargaSatuan = Number(item.hargaSatuan || 0) || (jumlah > 0 ? Math.round(Number(item.biaya || 0) / jumlah) : 0)
          const kategori = String((item as any).kategoriBorongan || '').trim()
          return [
            idx + 1,
            item.date ? new Date(item.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '',
            kategori,
            item.jenisPekerjaan || '',
            jumlah ? `${formatNumber(jumlah, 2)} ${item.satuan || ''}` : '',
            hargaSatuan > 0 ? formatNumber(hargaSatuan) : '',
            item.biaya > 0 ? formatNumber(item.biaya) : '',
            getStatus(item),
          ]
        })

        const totalJumlah = filteredActivities.reduce((acc, curr) => acc + Number(curr.jumlah || 0), 0)
        const totalBiaya = filteredActivities.reduce((acc, curr) => acc + Number(curr.biaya || 0), 0)
        const avgHargaSatuan = totalJumlah > 0 ? Math.round(totalBiaya / totalJumlah) : 0

        autoTable(doc, {
          startY: headerHeight + 8,
          head: [['NO', 'TANGGAL', 'KATEGORI', 'PEKERJAAN', 'JUMLAH', 'HARGA SATUAN', 'JUMLAH BIAYA', 'STATUS']],
          body: rows as any,
          foot: [[
            { content: 'JUMLAH', colSpan: 4, styles: { halign: 'center', fontStyle: 'bold' } },
            { content: totalJumlah ? formatNumber(totalJumlah, 2) : '-', styles: { fontStyle: 'bold' } },
            { content: avgHargaSatuan > 0 ? formatNumber(avgHargaSatuan) : '-', styles: { fontStyle: 'bold' } },
            { content: totalBiaya > 0 ? formatNumber(totalBiaya) : '-', styles: { fontStyle: 'bold' } },
            { content: '', styles: { fontStyle: 'bold' } },
          ]] as any,
          showFoot: 'lastPage',
          theme: 'grid',
          styles: { fontSize: 8, cellPadding: 2.2, textColor: [15, 23, 42] },
          headStyles: { fillColor: headerBg as any, textColor: 255, fontStyle: 'bold' as const },
          footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold' as const },
          margin: { left: 12, right: 12, top: headerHeight + 8, bottom: footerHeight + 8 },
        })
      } else {
        const rows = filteredActivities.map((item, idx) => {
          const karyawanText = (item.users && item.users.length > 0)
            ? item.users.map((u) => u.name).join(', ')
            : item.user?.name || ''
          return [
            idx + 1,
            item.date ? new Date(item.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '',
            item.jenisPekerjaan || '',
            karyawanText,
            getStatus(item),
          ]
        })

        autoTable(doc, {
          startY: headerHeight + 8,
          head: [['NO', 'TANGGAL', 'PEKERJAAN', 'KARYAWAN', 'STATUS']],
          body: rows as any,
          theme: 'grid',
          styles: { fontSize: 8, cellPadding: 2.2, textColor: [15, 23, 42] },
          headStyles: { fillColor: headerBg as any, textColor: 255, fontStyle: 'bold' as const },
          margin: { left: 12, right: 12, top: headerHeight + 8, bottom: footerHeight + 8 },
        })
      }

      const totalPages = doc.getNumberOfPages()
      for (let p = 1; p <= totalPages; p++) {
        doc.setPage(p)
        drawChrome(p, totalPages)
      }

      const safeMode = mode === 'borongan' ? 'borongan' : mode === 'aktivitas' ? 'aktivitas' : 'aktivitas-borongan'
      doc.save(`laporan-${safeMode}-${startYmd}-${endYmd}.pdf`)
    } catch {
      toast.error('Gagal export PDF')
    } finally {
      setListExporting(false)
    }
  }, [dateRange.end, dateRange.start, filterType, filteredActivities, listExporting, mode, selectedDate])

  const stats = useMemo(() => {
    const totalSemua = filteredActivities.reduce((acc, curr) => acc + Number(curr.biaya || 0), 0)
    const totalUpah = filteredActivities.reduce((acc, curr) => acc + (curr.upahBorongan ? Number(curr.biaya || 0) : 0), 0)
    const totalAktivitas = totalSemua - totalUpah
    const jumlahItem = filteredActivities.length
    const jumlahUpah = filteredActivities.filter((x) => !!x.upahBorongan).length
    const jumlahAktivitas = jumlahItem - jumlahUpah
    const { upahSudahDibayar, upahBelumDibayar, upahSudahDibayarItem, upahBelumDibayarItem } = filteredActivities.reduce(
      (acc, curr) => {
        if (!curr.upahBorongan) return acc
        const total = Number(curr.biaya || 0)
        const paidCount = Number(curr.paidCount || 0)
        const totalCount = Number(curr.totalCount || 0) || 1
        const ratio = totalCount > 0 ? Math.min(1, Math.max(0, paidCount / totalCount)) : 0
        const paidAmount = total * ratio
        const unpaidAmount = total - paidAmount
        acc.upahSudahDibayar += paidAmount
        acc.upahBelumDibayar += unpaidAmount
        acc.upahSudahDibayarItem += Math.max(0, Math.round(paidCount))
        acc.upahBelumDibayarItem += Math.max(0, Math.round(totalCount - paidCount))
        return acc
      },
      { upahSudahDibayar: 0, upahBelumDibayar: 0, upahSudahDibayarItem: 0, upahBelumDibayarItem: 0 },
    )

    return {
      totalSemua,
      totalUpah,
      totalAktivitas,
      jumlahItem,
      jumlahUpah,
      jumlahAktivitas,
      upahSudahDibayar,
      upahBelumDibayar,
      upahSudahDibayarItem,
      upahBelumDibayarItem,
    }
  }, [filteredActivities])

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm space-y-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900 capitalize">
              {mode === 'borongan' ? 'Borongan' : mode === 'aktivitas' ? 'Aktivitas' : 'Aktivitas & Pekerjaan'}
            </h2>
            <p className="text-sm text-gray-500">
              {mode === 'borongan'
                ? 'Pekerjaan borongan yang masuk pengajuan gajian'
                : 'Catatan kegiatan di kebun'}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto lg:justify-end">
            <Button
              type="button"
              variant="outline"
              className="rounded-full h-10 w-full sm:w-auto"
              onClick={handleExportListPdf}
              disabled={listExporting || filteredActivities.length === 0}
            >
              <ArrowDownTrayIcon className="w-4 h-4 mr-2" />
              {listExporting ? 'Membuat PDF...' : 'Export PDF'}
            </Button>
            <Button
              onClick={() => setShowForm(!showForm)}
              className="whitespace-nowrap rounded-full bg-emerald-600 hover:bg-emerald-700 w-full sm:w-auto"
            >
              <PlusIcon className="w-4 h-4 mr-2" />
              {mode === 'borongan' ? 'Catat Borongan' : 'Catat Aktivitas'}
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
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
                className="h-10 w-full sm:w-40 bg-white" 
                value={formatWibYm(selectedDate)}
                onChange={handleDateChange}
              />
            )}

            {filterType === 'year' && (
              <select
                className="h-10 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 w-full sm:w-32"
                value={Number(formatWibYmd(selectedDate).slice(0, 4))}
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
                  className="h-10 w-full sm:w-32 bg-white" 
                  value={dateRange.start}
                  onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                />
                <span className="text-gray-500">-</span>
                <Input 
                  type="date" 
                  className="h-10 w-full sm:w-32 bg-white" 
                  value={dateRange.end}
                  onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                />
              </div>
            )}

            {!mode ? (
              <select
                className="h-10 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 w-full sm:w-48"
                value={activityFilter}
                onChange={(e) => setActivityFilter(e.target.value as 'all' | 'upah' | 'aktivitas')}
              >
                <option value="all">Semua aktivitas</option>
                <option value="upah">Upah borongan</option>
                <option value="aktivitas">Aktivitas biasa</option>
              </select>
            ) : null}

            {mode === 'borongan' ? (
              <select
                className="h-10 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 w-full sm:w-40"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
              >
                <option value="all">Semua status</option>
                <option value="draft">Draft</option>
                <option value="penggajian">Penggajian</option>
                <option value="dibayar">Dibayar</option>
              </select>
            ) : null}

            {mode === 'borongan' ? (
              <select
                className="h-10 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 w-full sm:w-56"
                value={kategoriFilter}
                onChange={(e) => setKategoriFilter(e.target.value)}
              >
                <option value="all">Semua kategori</option>
                <option value="__none__">Tanpa kategori</option>
                {kategoriBoronganOptions.map((k) => (
                  <option key={k} value={k}>{k}</option>
                ))}
              </select>
            ) : null}
            {mode === 'borongan' ? (
              <Button
                type="button"
                variant="outline"
                className="h-10 rounded-md w-full sm:w-auto"
                onClick={() => setKategoriMasterOpen(true)}
              >
                Master Kategori
              </Button>
            ) : null}
          </div>

          <div className="w-full sm:max-w-sm relative">
            <MagnifyingGlassIcon className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              value={searchDraft}
              onChange={(e) => {
                const next = e.target.value
                setSearchDraft(next)
                if (!String(next || '').trim()) {
                  setSearchQuery('')
                  setCurrentPage(1)
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  applySearch()
                }
              }}
              placeholder={mode === 'borongan' ? 'Cari borongan...' : mode === 'aktivitas' ? 'Cari aktivitas...' : 'Cari aktivitas / borongan...'}
              className="pl-9 pr-10 rounded-full h-10"
            />
            <button
              type="button"
              onClick={applySearch}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
              aria-label="Cari"
            >
              <MagnifyingGlassIcon className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      {mode === 'borongan' || !mode ? (
        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
              <BanknotesIcon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Statistik Total Upah</p>
              <p className="text-xs text-gray-500">Ringkasan biaya berdasarkan filter periode</p>
            </div>
          </div>
          <div className="mt-4">
            <div className="rounded-xl bg-emerald-50 border border-emerald-100 px-3 py-3 w-full sm:w-1/2 lg:w-1/4">
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Total</p>
              <p className="text-lg font-bold mt-1 text-emerald-900">{formatCurrency(stats.totalSemua)}</p>
              <p className="text-xs text-emerald-700/80 mt-1">{stats.jumlahItem.toLocaleString('id-ID')} item</p>
              <div className="mt-3 border-t border-emerald-100 pt-3 space-y-2 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-emerald-700/90">Upah sudah dibayar</span>
                  <span className="font-semibold text-emerald-900">
                    {formatCurrency(Math.round(stats.upahSudahDibayar || 0))} ({(stats.upahSudahDibayarItem || 0).toLocaleString('id-ID')})
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-emerald-700/90">Upah belum dibayar</span>
                  <span className="font-semibold text-emerald-900">
                    {formatCurrency(Math.round(stats.upahBelumDibayar || 0))} ({(stats.upahBelumDibayarItem || 0).toLocaleString('id-ID')})
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-4 animate-in slide-in-from-top-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Tanggal</Label>
              <Input 
                type="date" 
                value={formData.date}
                onChange={e => setFormData({...formData, date: e.target.value})}
                required
                className="bg-white"
              />
            </div>
            {mode === 'borongan' ? (
              <div>
                <Label>Kategori Borongan</Label>
                <Input
                  list="borongan-kategori-options"
                  placeholder="Contoh: Panen, Angkut, Perawatan..."
                  value={(formData as any).kategoriBorongan || ''}
                  onChange={(e) => setFormData({ ...formData, kategoriBorongan: e.target.value })}
                  className="bg-white"
                />
              </div>
            ) : null}
            <div>
              <Label>{mode === 'borongan' ? 'Jenis Pekerjaan' : 'Deskripsi'}</Label>
              <Input 
                placeholder={mode === 'borongan' ? 'Contoh: Panen, Mupuk...' : 'Contoh : Minyak Kendaraan, Panen , Mupuk ....'} 
                value={formData.jenisPekerjaan}
                onChange={e => setFormData({...formData, jenisPekerjaan: e.target.value})}
                required
                className="bg-white"
              />
            </div>
            {mode === 'aktivitas' ? (
              <div>
                <Label>Kendaraan</Label>
                <Popover open={openKendaraanSelect} onOpenChange={setOpenKendaraanSelect}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      aria-expanded={openKendaraanSelect}
                      className="w-full h-10 px-3 rounded-md border border-input bg-white text-sm flex items-center justify-between"
                    >
                      {(formData as any).kendaraanPlatNomor
                        ? (kendaraanList.find(k => k.platNomor === (formData as any).kendaraanPlatNomor)?.platNomor || (formData as any).kendaraanPlatNomor)
                        : 'Pilih kendaraan'}
                      <ChevronUpDownIcon className="h-4 w-4 text-gray-400" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[320px] p-3" align="start">
                    <Input
                      placeholder="Cari plat / merk..."
                      value={kendaraanQuery}
                      onChange={(e) => setKendaraanQuery(e.target.value)}
                      className="mb-2 rounded-lg"
                    />
                    <div className="max-h-56 overflow-y-auto space-y-1">
                      {kendaraanList
                        .filter((k) => {
                          const q = kendaraanQuery.trim().toLowerCase()
                          if (!q) return true
                          return k.platNomor.toLowerCase().includes(q) || k.merk.toLowerCase().includes(q)
                        })
                        .map((k) => {
                          const checked = (formData as any).kendaraanPlatNomor === k.platNomor
                          return (
                            <button
                              key={k.platNomor}
                              type="button"
                              onClick={() => {
                                setFormData((prev: any) => ({ ...prev, kendaraanPlatNomor: checked ? '' : k.platNomor }))
                                setOpenKendaraanSelect(false)
                              }}
                              className={`w-full text-left px-3 py-2 rounded-lg hover:bg-gray-50 flex items-center justify-between ${checked ? 'bg-emerald-50 text-emerald-700' : ''}`}
                            >
                              <span className="truncate">{k.platNomor} <span className="text-gray-500">({k.merk} • {k.jenis})</span></span>
                              {checked ? <CheckIcon className="h-4 w-4" /> : <span className="h-4 w-4" />}
                            </button>
                          )
                        })}
                      {kendaraanList.filter((k) => {
                        const q = kendaraanQuery.trim().toLowerCase()
                        if (!q) return true
                        return k.platNomor.toLowerCase().includes(q) || k.merk.toLowerCase().includes(q)
                      }).length === 0 && (
                        <div className="px-3 py-2 text-sm text-gray-500">Kendaraan tidak ditemukan</div>
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
                <p className="text-xs text-gray-500 mt-1">Boleh dikosongkan. Hanya alat berat dan mobil truck.</p>
              </div>
            ) : null}
            <div>
              <Label>Karyawan (Bisa pilih lebih dari satu)</Label>
              <Popover open={openUserSelect} onOpenChange={setOpenUserSelect}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    aria-expanded={openUserSelect}
                    className="w-full h-10 px-3 rounded-md border border-input bg-white text-sm flex items-center justify-between"
                  >
                    {selectedUserIds.length === 0
                      ? 'Pilih karyawan'
                      : `${selectedUserIds.length} karyawan dipilih`}
                    <ChevronUpDownIcon className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] p-2">
                  <Input
                    autoFocus
                    placeholder="Cari karyawan..."
                    value={userQuery}
                    onChange={(e) => setUserQuery(e.target.value)}
                    className="mb-2 rounded-lg"
                  />
                  <div className="max-h-56 overflow-y-auto space-y-1">
                    {users
                      .filter((u) => u.name.toLowerCase().includes(userQuery.toLowerCase()))
                      .map((user) => {
                        const isSelected = selectedUserIds.includes(user.id);
                        return (
                          <button
                            key={user.id}
                            type="button"
                            onClick={() => {
                              setSelectedUserIds((prev) =>
                                isSelected ? prev.filter((id) => id !== user.id) : [...prev, user.id]
                              );
                            }}
                            className={`w-full text-left px-3 py-2 rounded-lg hover:bg-gray-50 flex items-center justify-between ${isSelected ? 'bg-emerald-50 text-emerald-700' : ''}`}
                          >
                            <span>{user.name}</span>
                            {isSelected && <CheckIcon className="h-4 w-4" />}
                          </button>
                        );
                      })}
                    {users.filter((u) => u.name.toLowerCase().includes(userQuery.toLowerCase())).length === 0 && (
                      <div className="px-3 py-2 text-sm text-gray-500">Karyawan tidak ditemukan</div>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
              <p className="text-xs text-gray-500 mt-1">Karyawan boleh dikosongkan.</p>
              {selectedUserIds.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {selectedUserIds.map((id) => {
                    const user = users.find((u) => u.id === id);
                    if (!user) return null;
                    return (
                      <span
                        key={id}
                        className="inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-700 px-3 py-1 text-xs"
                      >
                        {user.name}
                        <button
                          type="button"
                          onClick={() => setSelectedUserIds((prev) => prev.filter((uid) => uid !== id))}
                          className="rounded-full hover:bg-emerald-100"
                        >
                          <XMarkIcon className="h-3 w-3" />
                        </button>
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
            {!mode ? (
              <div>
                <Label>Upah Borongan</Label>
                <div className="mt-2 flex items-center gap-2">
                  <input
                    id="upahBorongan"
                    type="checkbox"
                    checked={formData.upahBorongan}
                    onChange={(e) => setFormData({ ...formData, upahBorongan: e.target.checked })}
                    className="h-4 w-4"
                  />
                  <label htmlFor="upahBorongan" className="text-sm text-gray-700">Masukkan ke penggajian</label>
                </div>
              </div>
            ) : null}
            {(mode === 'borongan' || formData.upahBorongan) && (
              <>
                <div>
                  <Label>Jumlah</Label>
                  <Input
                    type="number"
                    step="any"
                    min="0"
                    value={formData.jumlah === 0 ? '' : formData.jumlah}
                    onChange={(e) => {
                      const val = e.target.value
                      setFormData({ ...formData, jumlah: val === '' ? 0 : Number(val) })
                    }}
                    className="bg-white"
                  />
                </div>
                <div>
                  <Label>Satuan</Label>
                  <Input
                    value={formData.satuan}
                    onChange={(e) => setFormData({ ...formData, satuan: e.target.value })}
                    className="bg-white"
                    placeholder="Contoh: HK, Kg, Ha"
                  />
                </div>
                <div>
                  <Label>Biaya / Satuan (Rp)</Label>
                  <FormattedNumberInput
                    value={formData.hargaSatuan}
                    onChange={(value) => setFormData({ ...formData, hargaSatuan: value })}
                    className="bg-white"
                    placeholder="0"
                  />
                </div>
                <div>
                  <Label>Total Biaya (Rp)</Label>
                  <Input
                    value={formatNumber(Math.round(Number(formData.jumlah || 0) * Number(formData.hargaSatuan || 0)))}
                    className="bg-white"
                    readOnly
                  />
                </div>
              </>
            )}
          </div>
          <div>
            <Label>Keterangan Tambahan (Opsional)</Label>
            <Textarea 
              placeholder="Detail pekerjaan..." 
              value={formData.keterangan}
              onChange={e => setFormData({...formData, keterangan: e.target.value})}
              className="bg-white"
            />
          </div>
          <div>
            <Label>Upload Gambar (Opsional)</Label>
            <ImageUpload
              previewUrl={buktiPreview}
              onFileChange={(file) => {
                setBuktiFile(file);
                if (!file) {
                  setBuktiPreview(null);
                  return;
                }
                setBuktiPreview(URL.createObjectURL(file));
              }}
            />
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Menyimpan...' : 'Simpan Pekerjaan'}
            </Button>
          </div>
        </form>
      )}

      <div className="space-y-3">
        {isLoading ? (
          <p className="text-center text-gray-500 py-4">Memuat data...</p>
        ) : filteredActivities.length === 0 ? (
          <p className="text-center text-gray-500 py-4 bg-gray-50 rounded-lg border border-dashed">Belum ada riwayat pekerjaan</p>
        ) : (
          <>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-1">
              <div className="text-xs text-gray-500">
                Menampilkan {filteredActivities.length === 0 ? 0 : startIndex + 1} - {Math.min(startIndex + perView, filteredActivities.length)} dari {filteredActivities.length} data
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">Per View</span>
                <select
                  className="h-8 rounded-md border border-gray-200 bg-white px-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  value={perView}
                  onChange={(e) => {
                    setPerView(Number(e.target.value))
                    setCurrentPage(1)
                  }}
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
            </div>

            {/* Mobile Card View */}
            <div className="grid grid-cols-1 gap-4 md:hidden">
              {pagedActivities.map((item, idx) => {
                const isUpah = !!item.upahBorongan
                const totalCount = Number(item.totalCount || 0) || 1
                const inGajianCount = Number(item.inGajianCount || 0)
                const finalizedCount = Number(item.finalizedCount || 0)
                const isLocked = isUpah && inGajianCount > 0
                const isPaid = isUpah && finalizedCount > 0 && finalizedCount === totalCount
                const isInGajian = isUpah && inGajianCount > 0 && !isPaid
                const isUnpaid = isUpah && !isLocked
                const displayNo = startIndex + idx + 1
                const jumlah = Number(item.jumlah || 0)
                const hargaSatuan = Number(item.hargaSatuan || 0) || (jumlah > 0 ? Math.round(Number(item.biaya || 0) / jumlah) : 0)

                return (
                  <div key={item.id} className="relative bg-white p-4 pt-11 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                    <div className="absolute top-3 left-3 h-6 min-w-6 px-2 rounded-full bg-gray-100 text-gray-700 text-xs font-bold flex items-center justify-center">
                      {displayNo}
                    </div>
                    <div className="flex flex-col gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          {mode === 'borongan' && (item as any).kategoriBorongan ? (
                            <span className="inline-flex items-center rounded-full bg-emerald-50 text-emerald-700 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide">
                              {String((item as any).kategoriBorongan)}
                            </span>
                          ) : null}
                          <h4 className="font-semibold text-gray-900">{item.jenisPekerjaan}</h4>
                          {item.upahBorongan && (
                            <span className="inline-flex items-center rounded-full bg-amber-100 text-amber-800 px-2 py-0.5 text-xs font-semibold">
                              Borongan
                            </span>
                          )}
                          {isPaid && (
                            <span className="inline-flex items-center rounded-full bg-emerald-100 text-emerald-800 px-2 py-0.5 text-xs font-semibold">
                              Dibayar
                            </span>
                          )}
                          {isInGajian && (
                            <span className="inline-flex items-center rounded-full bg-blue-100 text-blue-800 px-2 py-0.5 text-xs font-semibold">
                              Masuk penggajian
                            </span>
                          )}
                          {mode === 'borongan' && isUnpaid && (
                            <span className="inline-flex items-center rounded-full bg-gray-100 text-gray-700 px-2 py-0.5 text-xs font-semibold">
                              Belum dibayar
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                          <CalendarIcon className="w-3 h-3" />
                          {new Date(item.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </div>
                        {mode !== 'borongan' ? (
                          (item.users && item.users.length > 0) ? (
                            <div className="flex items-center gap-2 text-xs text-blue-600 mt-1 flex-wrap">
                              <UserIcon className="w-3 h-3" />
                              <span className="font-medium">{item.users.map(u => u.name).join(', ')}</span>
                            </div>
                          ) : item.user ? (
                            <div className="flex items-center gap-2 text-xs text-blue-600 mt-1">
                              <UserIcon className="w-3 h-3" />
                              <span className="font-medium">{item.user.name}</span>
                            </div>
                          ) : null
                        ) : null}
                      </div>
                      
                      {mode === 'borongan' ? (
                        <div className="grid grid-cols-3 gap-2 text-xs">
                          <div className="rounded-lg border border-gray-100 bg-gray-50 p-2">
                            <div className="text-[10px] font-black tracking-wider text-gray-400 uppercase">Jumlah</div>
                            <div className="font-semibold text-gray-900">{jumlah ? `${formatNumber(jumlah, 2)} ${item.satuan || ''}` : '-'}</div>
                          </div>
                          <div className="rounded-lg border border-gray-100 bg-gray-50 p-2">
                            <div className="text-[10px] font-black tracking-wider text-gray-400 uppercase">Harga Satuan</div>
                            <div className="font-semibold text-gray-900">{hargaSatuan > 0 ? formatCurrency(hargaSatuan) : '-'}</div>
                          </div>
                          <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-2">
                            <div className="text-[10px] font-black tracking-wider text-emerald-700 uppercase">Jumlah Biaya</div>
                            <div className="font-extrabold text-emerald-800">{item.biaya > 0 ? formatCurrency(item.biaya) : '-'}</div>
                          </div>
                        </div>
                      ) : (
                        mode !== 'aktivitas' && item.biaya > 0 ? (
                          <div className="flex items-center gap-1 text-green-600 font-medium bg-green-50 px-2 py-1 rounded-md text-sm w-fit">
                            <BanknotesIcon className="w-4 h-4" />
                            Rp {item.biaya.toLocaleString('id-ID')}
                          </div>
                        ) : null
                      )}

                      <div className="flex items-center gap-2 pt-2 border-t border-gray-50">
                        <Button variant="outline" className="h-8 w-8 p-0 rounded-full" onClick={() => openDetail(item)}>
                          <EyeIcon className="h-4 w-4" />
                        </Button>
                        {!isLocked && (
                          <>
                            <Button variant="outline" className="h-8 w-8 p-0 rounded-full" onClick={() => openEdit(item)}>
                              <PencilSquareIcon className="h-4 w-4" />
                            </Button>
                            <Button variant="destructive" className="h-8 w-8 p-0 rounded-full" onClick={() => openDelete(item)}>
                              <TrashIcon className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <table className="w-full text-left text-sm border-collapse">
                <thead className="bg-gray-50 text-gray-500 font-semibold text-xs uppercase tracking-wider">
                  <tr>
                    {mode === 'borongan' ? (
                      <>
                        <th className="px-4 py-3 border-b border-gray-100 text-center w-12">No</th>
                        <th className="px-4 py-3 border-b border-gray-100">Tanggal</th>
                        <th className="px-4 py-3 border-b border-gray-100">Kategori</th>
                        <th className="px-4 py-3 border-b border-gray-100">Pekerjaan</th>
                        <th className="px-4 py-3 border-b border-gray-100">Jumlah</th>
                        <th className="px-4 py-3 border-b border-gray-100 text-right">Harga Satuan</th>
                        <th className="px-4 py-3 border-b border-gray-100 text-right">Jumlah Biaya</th>
                        <th className="px-4 py-3 border-b border-gray-100">Status</th>
                        <th className="px-4 py-3 border-b border-gray-100 text-center w-28">Aksi</th>
                      </>
                    ) : mode === 'aktivitas' ? (
                      <>
                        <th className="px-4 py-3 border-b border-gray-100 text-center w-12">No</th>
                        <th className="px-4 py-3 border-b border-gray-100">Tanggal</th>
                        <th className="px-4 py-3 border-b border-gray-100">Pekerjaan</th>
                        <th className="px-4 py-3 border-b border-gray-100">Karyawan</th>
                        <th className="px-4 py-3 border-b border-gray-100">Status</th>
                        <th className="px-4 py-3 border-b border-gray-100 text-center w-28">Aksi</th>
                      </>
                    ) : (
                      <>
                        <th className="px-4 py-3 border-b border-gray-100 text-center w-12">No</th>
                        <th className="px-4 py-3 border-b border-gray-100">Tanggal</th>
                        <th className="px-4 py-3 border-b border-gray-100">Pekerjaan</th>
                        <th className="px-4 py-3 border-b border-gray-100">Karyawan</th>
                        <th className="px-4 py-3 border-b border-gray-100">Jumlah</th>
                        <th className="px-4 py-3 border-b border-gray-100 text-right">Biaya</th>
                        <th className="px-4 py-3 border-b border-gray-100">Status</th>
                        <th className="px-4 py-3 border-b border-gray-100 text-center w-28">Aksi</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {pagedActivities.map((item, idx) => {
                    const isUpah = !!item.upahBorongan
                    const totalCount = Number(item.totalCount || 0) || 1
                    const inGajianCount = Number(item.inGajianCount || 0)
                    const finalizedCount = Number(item.finalizedCount || 0)
                    const isLocked = isUpah && inGajianCount > 0
                    const isPaid = isUpah && finalizedCount > 0 && finalizedCount === totalCount
                    const isInGajian = isUpah && inGajianCount > 0 && !isPaid
                    const isUnpaid = isUpah && !isLocked
                    const displayNo = startIndex + idx + 1
                    const jumlah = Number(item.jumlah || 0)
                    const hargaSatuan = Number(item.hargaSatuan || 0) || (jumlah > 0 ? Math.round(Number(item.biaya || 0) / jumlah) : 0)

                    return (
                      <tr key={item.id} className="hover:bg-gray-50/50 transition-colors group">
                        <td className="px-4 py-3 text-center text-gray-500 font-medium">{displayNo}</td>
                        <td className="px-4 py-3 text-gray-900 whitespace-nowrap">
                          {new Date(item.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </td>
                        {mode === 'borongan' ? (
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center rounded-full bg-emerald-50 text-emerald-700 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide">
                              {String((item as any).kategoriBorongan || '-')}
                            </span>
                          </td>
                        ) : null}
                        <td className="px-4 py-3">
                          <div className="font-semibold text-gray-900">{item.jenisPekerjaan}</div>
                          {item.keterangan && <div className="text-xs text-gray-500 italic truncate max-w-[200px]">{item.keterangan}</div>}
                        </td>
                        {mode === 'borongan' ? (
                          <>
                            <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                              {jumlah ? `${formatNumber(jumlah, 2)} ${item.satuan || ''}` : '-'}
                            </td>
                            <td className="px-4 py-3 text-right font-semibold text-gray-800 whitespace-nowrap">
                              {hargaSatuan > 0 ? formatCurrency(hargaSatuan) : '-'}
                            </td>
                            <td className="px-4 py-3 text-right font-bold text-emerald-600 whitespace-nowrap">
                              {item.biaya > 0 ? formatCurrency(item.biaya) : '-'}
                            </td>
                          </>
                        ) : mode === 'aktivitas' ? (
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5 text-blue-600 font-medium">
                              <UserIcon className="w-3.5 h-3.5 shrink-0" />
                              <span className="truncate max-w-[220px]">
                                {(item.users && item.users.length > 0) ? item.users.map(u => u.name).join(', ') : item.user?.name || '-'}
                              </span>
                            </div>
                          </td>
                        ) : (
                          <>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1.5 text-blue-600 font-medium">
                                <UserIcon className="w-3.5 h-3.5 shrink-0" />
                                <span className="truncate max-w-[150px]">
                                  {(item.users && item.users.length > 0) ? item.users.map(u => u.name).join(', ') : item.user?.name || '-'}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                              {item.jumlah ? `${formatNumber(item.jumlah, 2)} ${item.satuan || ''}` : '-'}
                            </td>
                            <td className="px-4 py-3 text-right font-bold text-emerald-600 whitespace-nowrap">
                              {item.biaya > 0 ? formatCurrency(item.biaya) : '-'}
                            </td>
                          </>
                        )}
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {isPaid && (
                              <span className="inline-flex items-center rounded-full bg-emerald-100 text-emerald-800 px-2 py-0.5 text-[10px] font-bold uppercase tracking-tight">
                                Dibayar
                              </span>
                            )}
                            {isInGajian && (
                              <span className="inline-flex items-center rounded-full bg-blue-100 text-blue-800 px-2 py-0.5 text-[10px] font-bold uppercase tracking-tight">
                                Penggajian
                              </span>
                            )}
                            {mode === 'borongan' && isUnpaid && (
                              <span className="inline-flex items-center rounded-full bg-gray-100 text-gray-700 px-2 py-0.5 text-[10px] font-bold uppercase tracking-tight">
                                Draft
                              </span>
                            )}
                            {!item.upahBorongan && (
                              <span className="inline-flex items-center rounded-full bg-slate-100 text-slate-700 px-2 py-0.5 text-[10px] font-bold uppercase tracking-tight">
                                Aktivitas
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-emerald-50 hover:text-emerald-600" onClick={() => openDetail(item)} title="Lihat Detail">
                              <EyeIcon className="h-4 w-4" />
                            </Button>
                            {!isLocked && (
                              <>
                                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-blue-50 hover:text-blue-600" onClick={() => openEdit(item)} title="Edit">
                                  <PencilSquareIcon className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-red-50 hover:text-red-600" onClick={() => openDelete(item)} title="Hapus">
                                  <TrashIcon className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                {mode === 'borongan' && boronganFooter && filteredActivities.length > 0 ? (
                  <tfoot className="bg-gray-50">
                    <tr>
                      <td colSpan={4} className="px-4 py-3 font-bold text-gray-700 uppercase tracking-wide">Jumlah</td>
                      <td className="px-4 py-3 text-gray-700 font-semibold whitespace-nowrap">
                        {boronganFooter.totalJumlah ? formatNumber(boronganFooter.totalJumlah, 2) : '-'}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700 font-semibold whitespace-nowrap">
                        {boronganFooter.avgHargaSatuan > 0 ? formatCurrency(boronganFooter.avgHargaSatuan) : '-'}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-emerald-700 whitespace-nowrap">
                        {boronganFooter.totalBiaya > 0 ? formatCurrency(boronganFooter.totalBiaya) : '-'}
                      </td>
                      <td colSpan={2} className="px-4 py-3" />
                    </tr>
                  </tfoot>
                ) : null}
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="flex items-center justify-between gap-4 mt-6 px-1">
              <div className="hidden sm:block text-xs text-gray-500">
                Halaman {currentPage} dari {totalPages}
              </div>
              <div className="flex items-center gap-2 ml-auto">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 rounded-xl px-3 text-xs font-semibold"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                >
                  Sebelumnya
                </Button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum = i + 1;
                    if (totalPages > 5 && currentPage > 3) {
                      pageNum = currentPage - 3 + i + 1;
                      if (pageNum > totalPages) pageNum = totalPages - (4 - i);
                    }
                    if (pageNum <= 0) return null;
                    return (
                      <Button
                        key={pageNum}
                        variant={currentPage === pageNum ? 'default' : 'outline'}
                        size="sm"
                        className={`h-8 w-8 p-0 rounded-xl text-xs font-bold ${currentPage === pageNum ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600' : ''}`}
                        onClick={() => setCurrentPage(pageNum)}
                      >
                        {pageNum}
                      </Button>
                    );
                  })}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 rounded-xl px-3 text-xs font-semibold"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                >
                  Berikutnya
                </Button>
              </div>
            </div>
          </>
        )}
      </div>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="bg-white sm:max-w-[700px] max-h-[90vh] p-0 overflow-hidden rounded-2xl flex flex-col [&>button.absolute]:hidden">
          <ModalHeader
            title="Detail Pekerjaan"
            variant="emerald"
            icon={<EyeIcon className="h-5 w-5 text-white" />}
            onClose={() => setDetailOpen(false)}
          />

          <ModalContentWrapper className="space-y-4 flex-1 min-h-0 overflow-y-auto">
            <div className="rounded-xl border border-gray-100 bg-white p-3">
              <div className="flex items-start gap-2">
                <ClipboardDocumentListIcon className="h-5 w-5 text-indigo-600 mt-0.5" />
                <div className="min-w-0">
                  <div className="text-xs font-black tracking-wider text-gray-400 uppercase">Jenis Pekerjaan</div>
                  <div className="text-base font-semibold text-gray-900 break-words">{selectedActivity?.jenisPekerjaan || '-'}</div>
                  {selectedActivity?.upahBorongan ? (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center rounded-full bg-amber-100 text-amber-800 px-2 py-0.5 text-xs font-semibold">
                        Upah Borongan
                      </span>
                      {(selectedActivity?.paidCount || 0) > 0 && (selectedActivity?.paidCount || 0) === (selectedActivity?.totalCount || 0) ? (
                        <span className="inline-flex items-center rounded-full bg-emerald-100 text-emerald-800 px-2 py-0.5 text-xs font-semibold">
                          Sudah dibayar
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-xl border border-gray-100 bg-white p-3">
                <div className="flex items-start gap-2">
                  <CalendarIcon className="h-5 w-5 text-gray-700 mt-0.5" />
                  <div className="min-w-0">
                    <div className="text-xs font-black tracking-wider text-gray-400 uppercase">Tanggal</div>
                    <div className="text-sm font-semibold text-gray-900">
                      {selectedActivity ? new Date(selectedActivity.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '-'}
                    </div>
                  </div>
                </div>
              </div>
              <div className="rounded-xl border border-gray-100 bg-white p-3">
                <div className="flex items-start gap-2">
                  <UserIcon className="h-5 w-5 text-gray-700 mt-0.5" />
                  <div className="min-w-0">
                    <div className="text-xs font-black tracking-wider text-gray-400 uppercase">Karyawan</div>
                    <div className="text-sm font-semibold text-gray-900 break-words">
                      {(selectedActivity?.users && selectedActivity.users.length > 0)
                        ? selectedActivity.users.map(u => u.name).join(', ')
                        : selectedActivity?.user
                          ? selectedActivity.user.name
                          : '-'}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {selectedActivity?.upahBorongan ? (
              <div className="rounded-xl border border-gray-100 bg-white p-3">
                <div className="flex items-start gap-2">
                  <BanknotesIcon className="h-5 w-5 text-emerald-600 mt-0.5" />
                  <div className="min-w-0 w-full">
                    <div className="text-xs font-black tracking-wider text-gray-400 uppercase">Biaya</div>
                    <div className="mt-1 space-y-1 text-sm text-gray-800">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-500">Jumlah</span>
                        <span className="font-semibold">{formatNumber(selectedActivity?.jumlah || 0, 2)} {selectedActivity?.satuan || ''}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-500">Biaya / Satuan</span>
                        <span className="font-semibold">Rp {(selectedActivity?.hargaSatuan || 0).toLocaleString('id-ID')}</span>
                      </div>
                      <div className="flex items-center justify-between border-t pt-2">
                        <span className="text-gray-500">Total</span>
                        <span className="font-black text-emerald-700">Rp {(selectedActivity?.biaya || 0).toLocaleString('id-ID')}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="rounded-xl border border-gray-100 bg-white p-3">
              <div className="flex items-start gap-2">
                <PencilSquareIcon className="h-5 w-5 text-gray-700 mt-0.5" />
                <div className="min-w-0 w-full">
                  <div className="text-xs font-black tracking-wider text-gray-400 uppercase">Keterangan</div>
                  <div className="mt-1 text-sm text-gray-800 break-words">
                    {selectedActivity?.keterangan || '-'}
                  </div>
                </div>
              </div>
            </div>

            {selectedActivity?.imageUrl && (
              <div className="rounded-xl border border-gray-100 bg-white p-3">
                <div className="text-xs font-black tracking-wider text-gray-400 uppercase mb-2">Bukti Foto</div>
                {!detailImageError ? (
                  <button
                    type="button"
                    className="w-full rounded-xl overflow-hidden border border-gray-100 bg-gray-50 hover:border-blue-200 transition-colors"
                    onClick={() => { setViewImageUrl(selectedActivity.imageUrl || null); setViewImageError(false); }}
                    title="Klik untuk memperbesar"
                  >
                    <img
                      src={selectedActivity.imageUrl}
                      alt="Bukti Aktivitas"
                      className="w-full max-h-56 object-contain"
                      onError={() => setDetailImageError(true)}
                    />
                  </button>
                ) : (
                  <div className="text-sm text-gray-600 bg-gray-50 border border-dashed rounded-xl p-3">
                    Gambar tidak dapat dimuat.
                  </div>
                )}
              </div>
            )}
          </ModalContentWrapper>

          <ModalFooter className="sm:justify-end">
            <Button
              className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={handleExportDetailPdf}
              disabled={!selectedActivity || detailExporting}
            >
              <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
              {detailExporting ? 'Membuat PDF...' : 'Export PDF'}
            </Button>
            <Button variant="outline" className="rounded-xl" onClick={() => setDetailOpen(false)}>Tutup</Button>
          </ModalFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="w-[92vw] sm:max-w-2xl max-h-[90vh] p-0 overflow-hidden [&>button.absolute]:hidden flex flex-col">
          <ModalHeader
            title="Edit Pekerjaan"
            variant="emerald"
            icon={<PencilSquareIcon className="h-5 w-5 text-white" />}
            onClose={() => setEditOpen(false)}
          />
          <ModalContentWrapper className="space-y-6 flex-1 min-h-0 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Tanggal</Label>
                <Input
                  type="date"
                  value={editForm.date}
                  onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
                  className="bg-white"
                />
              </div>
              {mode === 'borongan' ? (
                <div>
                  <Label>Kategori Borongan</Label>
                  <Input
                    list="borongan-kategori-options"
                    placeholder="Contoh: Panen, Angkut, Perawatan..."
                    value={(editForm as any).kategoriBorongan || ''}
                    onChange={(e) => setEditForm({ ...editForm, kategoriBorongan: e.target.value })}
                    className="bg-white"
                  />
                </div>
              ) : null}
              <div>
                <Label>{mode === 'borongan' ? 'Jenis Pekerjaan' : 'Deskripsi'}</Label>
                <Input
                  value={editForm.jenisPekerjaan}
                  onChange={(e) => setEditForm({ ...editForm, jenisPekerjaan: e.target.value })}
                  className="bg-white"
                  placeholder={mode === 'borongan' ? 'Contoh: Panen, Mupuk...' : 'Contoh : Minyak Kendaraan, Panen , Mupuk ....'}
                />
              </div>
              {mode === 'aktivitas' ? (
                <div>
                  <Label>Kendaraan</Label>
                  <Popover open={openEditKendaraanSelect} onOpenChange={setOpenEditKendaraanSelect}>
                    <PopoverTrigger asChild>
                      <button type="button" className="w-full h-10 rounded-md border border-gray-200 bg-white px-3 text-left text-sm flex items-center justify-between">
                        {editForm.kendaraanPlatNomor
                          ? (kendaraanList.find(k => k.platNomor === editForm.kendaraanPlatNomor)?.platNomor || editForm.kendaraanPlatNomor)
                          : 'Pilih kendaraan'}
                        <ChevronUpDownIcon className="h-4 w-4 text-gray-400" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[320px] p-3" align="start">
                      <Input
                        placeholder="Cari plat / merk..."
                        value={editKendaraanQuery}
                        onChange={(e) => setEditKendaraanQuery(e.target.value)}
                        className="mb-2 rounded-lg"
                      />
                      <div className="max-h-56 overflow-y-auto space-y-1">
                        {kendaraanList
                          .filter((k) => {
                            const q = editKendaraanQuery.trim().toLowerCase()
                            if (!q) return true
                            return k.platNomor.toLowerCase().includes(q) || k.merk.toLowerCase().includes(q)
                          })
                          .map((k) => {
                            const checked = editForm.kendaraanPlatNomor === k.platNomor
                            return (
                              <button
                                key={k.platNomor}
                                type="button"
                                onClick={() => {
                                  setEditForm((prev) => ({ ...prev, kendaraanPlatNomor: checked ? '' : k.platNomor }))
                                  setOpenEditKendaraanSelect(false)
                                }}
                                className={`w-full text-left px-3 py-2 rounded-lg hover:bg-gray-50 flex items-center justify-between ${checked ? 'bg-emerald-50 text-emerald-700' : ''}`}
                              >
                                <span className="truncate">{k.platNomor} <span className="text-gray-500">({k.merk} • {k.jenis})</span></span>
                                {checked ? <CheckIcon className="h-4 w-4" /> : <span className="h-4 w-4" />}
                              </button>
                            )
                          })}
                        {kendaraanList.filter((k) => {
                          const q = editKendaraanQuery.trim().toLowerCase()
                          if (!q) return true
                          return k.platNomor.toLowerCase().includes(q) || k.merk.toLowerCase().includes(q)
                        }).length === 0 && (
                          <div className="px-3 py-2 text-sm text-gray-500">Kendaraan tidak ditemukan</div>
                        )}
                      </div>
                    </PopoverContent>
                  </Popover>
                <p className="text-xs text-gray-500 mt-1">Boleh dikosongkan. Hanya alat berat dan mobil truck.</p>
                </div>
              ) : null}
              <div>
                <Label>Karyawan</Label>
                <Popover open={openEditUserSelect} onOpenChange={setOpenEditUserSelect}>
                  <PopoverTrigger asChild>
                    <button type="button" className="w-full h-10 rounded-md border border-gray-200 bg-white px-3 text-left text-sm">
                      {editForm.userId
                        ? (users.find((u) => String(u.id) === String(editForm.userId))?.name ?? 'Pilih karyawan')
                        : 'Pilih karyawan'}
                      <ChevronUpDownIcon className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] p-2">
                    <Input
                      autoFocus
                      placeholder="Cari karyawan..."
                      value={editUserQuery}
                      onChange={(e) => setEditUserQuery(e.target.value)}
                      className="mb-2 rounded-lg"
                    />
                    <div className="max-h-56 overflow-y-auto space-y-1">
                      {users
                        .filter((u) => u.name.toLowerCase().includes(editUserQuery.toLowerCase()))
                        .map((user) => (
                          <button
                            key={user.id}
                            type="button"
                            onClick={() => {
                              setEditForm({ ...editForm, userId: String(user.id) });
                              setOpenEditUserSelect(false);
                            }}
                            className={`w-full text-left px-3 py-2 rounded-lg hover:bg-gray-50 ${String(user.id) === String(editForm.userId) ? 'bg-emerald-50 text-emerald-700' : ''}`}
                          >
                            {user.name}
                          </button>
                        ))}
                      {users.filter((u) => u.name.toLowerCase().includes(editUserQuery.toLowerCase())).length === 0 && (
                        <div className="px-3 py-2 text-sm text-gray-500">Karyawan tidak ditemukan</div>
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
                <p className="text-xs text-gray-500 mt-1">Karyawan boleh dikosongkan.</p>
              </div>
              {!mode ? (
                <div>
                  <Label>Upah Borongan</Label>
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      id="editUpahBorongan"
                      type="checkbox"
                      checked={editForm.upahBorongan}
                      onChange={(e) => setEditForm({ ...editForm, upahBorongan: e.target.checked })}
                      className="h-4 w-4"
                    />
                    <label htmlFor="editUpahBorongan" className="text-sm text-gray-700">Masukkan ke penggajian</label>
                  </div>
                </div>
              ) : null}
              {(mode === 'borongan' || editForm.upahBorongan) && (
                <>
                  <div>
                    <Label>Jumlah</Label>
                    <Input
                      type="number"
                      step="any"
                      min="0"
                      value={editForm.jumlah === 0 ? '' : editForm.jumlah}
                      onChange={(e) => {
                        const val = e.target.value
                        setEditForm({ ...editForm, jumlah: val === '' ? 0 : Number(val) })
                      }}
                      className="bg-white"
                    />
                  </div>
                  <div>
                    <Label>Satuan</Label>
                    <Input
                      value={editForm.satuan}
                      onChange={(e) => setEditForm({ ...editForm, satuan: e.target.value })}
                      className="bg-white"
                      placeholder="Contoh: HK, Kg, Ha"
                    />
                  </div>
                  <div>
                    <Label>Biaya / Satuan (Rp)</Label>
                    <FormattedNumberInput
                      value={editForm.hargaSatuan}
                      onChange={(value) => setEditForm({ ...editForm, hargaSatuan: value })}
                      className="bg-white"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <Label>Total Biaya (Rp)</Label>
                    <Input
                      value={formatNumber(Math.round(Number(editForm.jumlah || 0) * Number(editForm.hargaSatuan || 0)))}
                      className="bg-white"
                      readOnly
                    />
                  </div>
                </>
              )}
            </div>
            <div>
              <Label>Keterangan Tambahan (Opsional)</Label>
              <Textarea
                value={editForm.keterangan}
                onChange={(e) => setEditForm({ ...editForm, keterangan: e.target.value })}
                className="bg-white"
              />
            </div>
            <div>
              <Label>Upload Gambar (Opsional)</Label>
              <ImageUpload
                previewUrl={editBuktiPreview}
                onFileChange={(file) => {
                  setEditBuktiFile(file);
                  if (!file) {
                    setEditBuktiPreview(null);
                    return;
                  }
                  setEditBuktiPreview(URL.createObjectURL(file));
                }}
              />
            </div>
          </ModalContentWrapper>
          <ModalFooter>
            <Button type="button" variant="outline" onClick={() => setEditOpen(false)} className="rounded-full">
              Batal
            </Button>
            <Button type="button" onClick={handleUpdate} className="rounded-full bg-emerald-600 hover:bg-emerald-700">
              Simpan
            </Button>
          </ModalFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewImageUrl} onOpenChange={(open) => { if (!open) { setViewImageUrl(null); setViewImageError(false); } }}>
        <DialogContent className="max-w-5xl w-[95vw] p-0 overflow-hidden border-none bg-white shadow-2xl [&>button.absolute]:hidden">
          {viewImageUrl && (
            <div className="flex flex-col h-full max-h-[90vh]">
              <ModalHeader
                title="Bukti Aktivitas"
                subtitle="Pratinjau lampiran"
                variant="emerald"
                icon={<ClipboardDocumentListIcon className="h-5 w-5 text-white" />}
                onClose={() => { setViewImageUrl(null); setViewImageError(false); }}
              />

              <div className="flex-1 overflow-auto flex items-center justify-center p-4 md:p-8 min-h-0 bg-gray-50/50">
                {!viewImageError ? (
                  <img
                    src={viewImageUrl}
                    alt="Bukti Aktivitas"
                    className="max-w-full max-h-[65vh] md:max-h-[70vh] w-auto h-auto object-contain shadow-2xl rounded-md border border-gray-100"
                    onError={() => setViewImageError(true)}
                  />
                ) : (
                  <div className="flex items-center justify-center w-full h-[40vh]">
                    <div className="px-4 py-3 rounded-md bg-white shadow text-gray-700 text-sm">
                      Gambar tidak dapat dimuat.
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {mode === 'borongan' ? (
        <Dialog open={kategoriMasterOpen} onOpenChange={setKategoriMasterOpen}>
          <DialogContent className="w-[92vw] sm:max-w-lg max-h-[90vh] p-0 overflow-hidden [&>button.absolute]:hidden flex flex-col">
            <ModalHeader
              title="Master Kategori Borongan"
              variant="emerald"
              icon={<BanknotesIcon className="h-5 w-5 text-white" />}
              onClose={() => setKategoriMasterOpen(false)}
            />
            <ModalContentWrapper className="space-y-4 flex-1 min-h-0 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  value={kategoriMasterDraft}
                  onChange={(e) => setKategoriMasterDraft(e.target.value)}
                  placeholder="Tambah kategori..."
                  className="h-10 bg-white"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleAddKategoriMaster()
                    }
                  }}
                />
                <Button
                  type="button"
                  className="h-10 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={handleAddKategoriMaster}
                  disabled={kategoriMasterSaving || !String(kategoriMasterDraft || '').trim()}
                >
                  {kategoriMasterSaving ? '...' : 'Tambah'}
                </Button>
              </div>

              <div className="rounded-xl border border-gray-100 bg-white overflow-hidden">
                <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 text-sm font-semibold text-gray-700">
                  Daftar Kategori
                </div>
                <div className="divide-y divide-gray-100">
                  {kategoriMaster.length === 0 ? (
                    <div className="px-4 py-4 text-sm text-gray-500">Belum ada kategori</div>
                  ) : (
                    kategoriMaster.map((k) => (
                      <div key={k.id} className="px-4 py-3 flex items-center justify-between gap-3">
                        <div className="text-sm font-semibold text-gray-900 break-words">{k.name}</div>
                        <Button
                          type="button"
                          variant="ghost"
                          className="h-9 w-9 p-0 rounded-full text-red-600 hover:bg-red-50 hover:text-red-700"
                          onClick={() => handleDeleteKategoriMaster(k.id)}
                          disabled={kategoriMasterDeletingId === k.id}
                        >
                          <TrashIcon className="h-4 w-4" />
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </ModalContentWrapper>
            <ModalFooter className="sm:justify-end">
              <Button variant="outline" className="rounded-xl" onClick={() => setKategoriMasterOpen(false)}>
                Tutup
              </Button>
            </ModalFooter>
          </DialogContent>
        </Dialog>
      ) : null}

      {mode === 'borongan' ? (
        <datalist id="borongan-kategori-options">
          {kategoriBoronganOptions.map((k) => (
            <option key={k} value={k} />
          ))}
        </datalist>
      ) : null}

      <ConfirmationModal
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        title="Hapus Pekerjaan?"
        description="Data pekerjaan ini akan dihapus dan tidak bisa dikembalikan."
        variant="emerald"
      />
    </div>
  );
}
