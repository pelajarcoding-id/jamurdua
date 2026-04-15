'use client';

import { useMemo, useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from 'sonner';
import { ArrowDownTrayIcon, ClipboardDocumentListIcon, UserIcon, BanknotesIcon, CalendarIcon, PlusIcon, CheckIcon, ChevronUpDownIcon, XMarkIcon, PencilSquareIcon, EyeIcon, TrashIcon, TruckIcon } from "@heroicons/react/24/outline";
import { ConfirmationModal } from "@/components/ui/confirmation-modal";
import ImageUpload from '@/components/ui/ImageUpload';
import { ModalHeader, ModalContentWrapper, ModalFooter } from '@/components/ui/modal-elements'

type Pekerjaan = {
  id: number;
  ids?: number[];
  date: string;
  jenisPekerjaan: string;
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

const formatNumber = (value: number | string) => {
  const numeric = typeof value === 'string' ? parseNumber(value) : value;
  return new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(numeric || 0);
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
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (!isFocused) {
      setLocalValue(formatNumber(value));
    }
  }, [value, isFocused]);

  return (
    <Input
      value={localValue}
      onFocus={() => {
        setIsFocused(true);
        setLocalValue(value === 0 ? '' : value.toString().replace('.', ','));
      }}
      onBlur={() => setIsFocused(false)}
      onChange={(e) => {
        const val = e.target.value;
        setLocalValue(val);
        onChange(parseNumber(val));
      }}
      className={className}
      placeholder={placeholder}
      inputMode="decimal"
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
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<Pekerjaan | null>(null);
  const [editUserQuery, setEditUserQuery] = useState('');
  const [openEditUserSelect, setOpenEditUserSelect] = useState(false);
  const [openEditKendaraanSelect, setOpenEditKendaraanSelect] = useState(false)
  const [editKendaraanQuery, setEditKendaraanQuery] = useState('')
  const [editForm, setEditForm] = useState(() => ({
    date: formatWibYmd(new Date()),
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
  }, [mode]);

  useEffect(() => {
    fetchUsers();
  }, [kebunId]);

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
      const key = `${dateKey}|${item.jenisPekerjaan}|${item.keterangan || ''}|${item.biaya || 0}|${item.jumlah || 0}|${item.satuan || ''}|${item.hargaSatuan || 0}|${(item as any).imageUrl || ''}`;
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
      const totalBiaya = effectiveUpahBorongan ? Number(formData.jumlah || 0) * Number(formData.hargaSatuan || 0) : 0;
      const res = await fetch(`/api/kebun/${kebunId}/pekerjaan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          upahBorongan: effectiveUpahBorongan,
          biaya: totalBiaya,
          userIds: selectedUserIds,
          imageUrl,
          jumlah: mode === 'aktivitas' ? formData.jumlah : formData.jumlah,
          satuan: mode === 'aktivitas' ? formData.satuan : formData.satuan,
          kendaraanPlatNomor: (formData as any).kendaraanPlatNomor || undefined,
        }),
      });

      if (!res.ok) throw new Error('Gagal menyimpan');

      toast.success('Pekerjaan berhasil dicatat', { id: loadingToast });
      setFormData({
        date: formatWibYmd(new Date()),
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
      const totalBiaya = effectiveUpahBorongan ? Number(editForm.jumlah || 0) * Number(editForm.hargaSatuan || 0) : 0;
      let imageUrl: string | undefined = undefined;
      if (editBuktiFile) {
        const fd = new FormData();
        fd.append('file', editBuktiFile);
        const up = await fetch('/api/upload', { method: 'POST', body: fd });
        const upJson = await up.json().catch(() => ({}));
        if (!up.ok || !upJson?.success) throw new Error(upJson?.error || 'Upload gambar gagal');
        imageUrl = upJson.url;
      }
      const res = await fetch(`/api/kebun/${kebunId}/pekerjaan`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ids,
          ...editForm,
          upahBorongan: effectiveUpahBorongan,
          biaya: totalBiaya,
          ...(typeof imageUrl !== 'undefined' ? { imageUrl } : {}),
        }),
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

  const filteredActivities = activities.filter((item) => {
    if (activityFilter === 'upah') return !!item.upahBorongan;
    if (activityFilter === 'aktivitas') return !item.upahBorongan;
    return true;
  });

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
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
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
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 w-full lg:w-auto">
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
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
          </div>

          <Button onClick={() => setShowForm(!showForm)} className="whitespace-nowrap rounded-full bg-emerald-600 hover:bg-emerald-700 w-full sm:w-auto">
            <PlusIcon className="w-4 h-4 mr-2" />
            {mode === 'borongan' ? 'Catat Borongan' : 'Catat Aktivitas'}
          </Button>
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
            {mode === 'aktivitas' ? (
              <>
                <div>
                  <Label>Jumlah</Label>
                  <Input
                    type="number"
                    min="0"
                    value={formData.jumlah}
                    onChange={(e) => setFormData({ ...formData, jumlah: Number(e.target.value) })}
                    className="bg-white"
                    placeholder="0"
                  />
                </div>
                <div>
                  <Label>Satuan</Label>
                  <Input
                    value={formData.satuan}
                    onChange={(e) => setFormData({ ...formData, satuan: e.target.value })}
                    className="bg-white"
                    placeholder="Contoh: Liter, Kg, Rit"
                  />
                </div>
              </>
            ) : null}
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
                    min="0"
                    value={formData.jumlah}
                    onChange={(e) => setFormData({ ...formData, jumlah: Number(e.target.value) })}
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
                    value={formatNumber(Number(formData.jumlah || 0) * Number(formData.hargaSatuan || 0))}
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
          filteredActivities.map((item) => {
            const isUpah = !!item.upahBorongan
            const totalCount = Number(item.totalCount || 0) || 1
            const inGajianCount = Number(item.inGajianCount || 0)
            const finalizedCount = Number(item.finalizedCount || 0)
            const isLocked = isUpah && inGajianCount > 0
            const isPaid = isUpah && finalizedCount > 0 && finalizedCount === totalCount
            const isInGajian = isUpah && inGajianCount > 0 && !isPaid
            const isUnpaid = isUpah && !isLocked

            return (
            <div key={item.id} className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start mb-2 gap-3">
                <div className="order-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="font-semibold text-gray-900">{item.jenisPekerjaan}</h4>
                    {item.upahBorongan && (
                      <span className="inline-flex items-center rounded-full bg-amber-100 text-amber-800 px-2 py-0.5 text-xs font-semibold">
                        Upah Borongan
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
                  {mode === 'aktivitas' && item.kendaraan ? (
                    <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                      <TruckIcon className="w-3 h-3" />
                      <span>{item.kendaraan.platNomor} • {item.kendaraan.merk} • {item.kendaraan.jenis}</span>
                    </div>
                  ) : null}
                </div>
                <div className="hidden sm:flex items-center gap-2 w-full sm:w-auto sm:justify-end order-2">
                  {item.biaya > 0 && (
                    <div className="flex items-center gap-1 text-green-600 font-medium bg-green-50 px-2 py-1 rounded-md text-sm">
                      <BanknotesIcon className="w-4 h-4" />
                      Rp {item.biaya.toLocaleString('id-ID')}
                    </div>
                  )}
                  <div className="flex items-center gap-2">
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
              
              {(item.keterangan || item.user || (item.users && item.users.length > 0)) && (
                <div className="mt-3 pt-3 border-t border-gray-50 flex flex-col gap-2">
                  {(item.users && item.users.length > 0) ? (
                    <div className="flex items-center gap-2 text-sm text-blue-600 flex-wrap">
                      <UserIcon className="w-4 h-4" />
                      <span className="font-medium">{item.users.map(u => u.name).join(', ')}</span>
                    </div>
                  ) : item.user ? (
                    <div className="flex items-center gap-2 text-sm text-blue-600">
                      <UserIcon className="w-4 h-4" />
                      <span className="font-medium">{item.user.name}</span>
                    </div>
                  ) : null}
                  {item.keterangan && (
                    <p className="text-sm text-gray-600 italic">“{item.keterangan}”</p>
                  )}
                </div>
              )}
              <div className="mt-3 pt-3 border-t border-gray-50 flex flex-col gap-2 sm:hidden">
                {item.biaya > 0 && (
                  <div className="flex items-center gap-1 text-green-600 font-medium bg-green-50 px-2 py-1 rounded-md text-sm w-fit">
                    <BanknotesIcon className="w-4 h-4" />
                    Rp {item.biaya.toLocaleString('id-ID')}
                  </div>
                )}
                <div className="flex items-center gap-2">
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
          )})
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

            <div className="rounded-xl border border-gray-100 bg-white p-3">
              <div className="flex items-start gap-2">
                <BanknotesIcon className="h-5 w-5 text-emerald-600 mt-0.5" />
                <div className="min-w-0 w-full">
                  <div className="text-xs font-black tracking-wider text-gray-400 uppercase">Biaya</div>
                  {selectedActivity?.upahBorongan ? (
                    <div className="mt-1 space-y-1 text-sm text-gray-800">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-500">Jumlah</span>
                        <span className="font-semibold">{(selectedActivity?.jumlah || 0).toLocaleString('id-ID')} {selectedActivity?.satuan || ''}</span>
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
                  ) : (
                    <div className="mt-1 text-sm font-black text-emerald-700">
                      Rp {(selectedActivity?.biaya || 0).toLocaleString('id-ID')}
                    </div>
                  )}
                </div>
              </div>
            </div>

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
              {mode === 'aktivitas' ? (
                <>
                  <div>
                    <Label>Jumlah</Label>
                    <Input
                      type="number"
                      min="0"
                      value={editForm.jumlah}
                      onChange={(e) => setEditForm({ ...editForm, jumlah: Number(e.target.value) })}
                      className="bg-white"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <Label>Satuan</Label>
                    <Input
                      value={editForm.satuan}
                      onChange={(e) => setEditForm({ ...editForm, satuan: e.target.value })}
                      className="bg-white"
                      placeholder="Contoh: Liter, Kg, Rit"
                    />
                  </div>
                </>
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
                      min="0"
                      value={editForm.jumlah}
                      onChange={(e) => setEditForm({ ...editForm, jumlah: Number(e.target.value) })}
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
                      value={formatNumber(Number(editForm.jumlah || 0) * Number(editForm.hargaSatuan || 0))}
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
