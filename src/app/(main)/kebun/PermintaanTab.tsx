'use client';

import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from 'sonner';
import { 
  PlusIcon, 
  CheckCircleIcon, 
  XCircleIcon, 
  ClockIcon, 
  TrashIcon,
  ExclamationTriangleIcon,
  EyeIcon,
  XMarkIcon,
  DocumentTextIcon,
  DocumentArrowDownIcon
} from "@heroicons/react/24/outline";
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { useAuth } from '@/components/AuthProvider';
import ImageUpload from '@/components/ui/ImageUpload';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { ConfirmationModal } from '@/components/ui/confirmation-modal';
import { ModalHeader } from '@/components/ui/modal-elements'

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

const formatTitle = (value: string) => {
  return value
    .toLowerCase()
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

type Permintaan = {
  id: number;
  date: string;
  title: string;
  quantity: number | null;
  unit: string | null;
  description: string | null;
  imageUrl?: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'COMPLETED';
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  user: { id: number; name: string; photoUrl: string | null; role: string };
  createdAt: string;
};

export default function PermintaanTab({ kebunId }: { kebunId: number }) {
  const { role, id: userId } = useAuth();
  const [items, setItems] = useState<Permintaan[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [buktiFile, setBuktiFile] = useState<File | null>(null);
  const [buktiPreview, setBuktiPreview] = useState<string | null>(null);
  const [viewImageUrl, setViewImageUrl] = useState<string | null>(null);
  const [viewImageError, setViewImageError] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    title: '',
    quantity: '',
    unit: '',
    description: '',
    priority: 'NORMAL'
  });

  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [filterType, setFilterType] = useState<'month' | 'year' | 'range'>('month');
  const [dateRange, setDateRange] = useState({
    start: formatWibYmd(new Date()),
    end: formatWibYmd(new Date())
  });

  const isAdminOrOwner = role === 'ADMIN' || role === 'PEMILIK';

  useEffect(() => {
    fetchItems();
  }, [kebunId, selectedDate, filterType, dateRange]);

  const fetchItems = async () => {
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
      
      const res = await fetch(`/api/kebun/${kebunId}/permintaan?startDate=${encodeURIComponent(startYmd)}&endDate=${encodeURIComponent(endYmd)}`);
      if (!res.ok) throw new Error('Gagal mengambil data');
      const data = await res.json();
      setItems(data);
    } catch (error) {
      console.error(error);
      toast.error('Gagal memuat permintaan');
    } finally {
      setIsLoading(false);
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
    if (!formData.title) return toast.error('Judul wajib diisi');
    
    setIsSubmitting(true);
    const loadingToast = toast.loading('Menyimpan permintaan...');
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

      const res = await fetch(`/api/kebun/${kebunId}/permintaan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, imageUrl }),
      });

      if (!res.ok) throw new Error('Gagal menyimpan');

      toast.success('Permintaan berhasil dikirim', { id: loadingToast });
      setFormData({
        title: '',
        quantity: '',
        unit: '',
        description: '',
        priority: 'NORMAL'
      });
      setBuktiFile(null);
      setBuktiPreview(null);
      setShowForm(false);
      fetchItems();
    } catch (error) {
      toast.error('Gagal mengirim permintaan', { id: loadingToast });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStatusChange = async (id: number, newStatus: string) => {
    try {
        const res = await fetch(`/api/kebun/permintaan/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus })
        });
        if (!res.ok) throw new Error('Gagal update status');
        toast.success(`Status diubah menjadi ${newStatus}`);
        fetchItems();
    } catch (error) {
        toast.error('Gagal update status');
    }
  };

  const handleDelete = async (id: number) => {
    const loadingToast = toast.loading('Menghapus permintaan...');
    try {
        const res = await fetch(`/api/kebun/permintaan/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Gagal menghapus');
        toast.success('Permintaan dihapus', { id: loadingToast });
        setItems(prev => prev.filter(i => i.id !== id));
    } catch (error) {
        toast.error('Gagal menghapus', { id: loadingToast });
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTargetId) return;
    const id = deleteTargetId;
    setDeleteTargetId(null);
    await handleDelete(id);
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
        case 'APPROVED': return <Badge className="bg-green-100 text-green-700 hover:bg-green-200 border-green-200">Disetujui</Badge>;
        case 'REJECTED': return <Badge className="bg-red-100 text-red-700 hover:bg-red-200 border-red-200">Ditolak</Badge>;
        case 'COMPLETED': return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-200 border-blue-200">Selesai</Badge>;
        default: return <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-200 border-yellow-200">Menunggu</Badge>;
    }
  };

  const getPriorityColor = (priority: string) => {
      switch (priority) {
          case 'URGENT': return 'text-red-600 bg-red-50 border-red-100';
          case 'HIGH': return 'text-orange-600 bg-orange-50 border-orange-100';
          case 'LOW': return 'text-blue-600 bg-blue-50 border-blue-100';
          default: return 'text-gray-600 bg-gray-50 border-gray-100';
      }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
            <h3 className="text-lg font-semibold text-gray-900 capitalize">Permintaan Barang & Jasa</h3>
            <p className="text-sm text-gray-500">Ajukan kebutuhan operasional kebun di sini</p>
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
             </div>

             <Button onClick={() => setShowForm(!showForm)} size="sm" className="rounded-full shadow-sm w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700">
               {showForm ? 'Batal' : <><PlusIcon className="w-4 h-4 mr-2" /> Buat Permintaan</>}
             </Button>
         </div>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-lg space-y-5 animate-in slide-in-from-top-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-2">
              <Label>Judul Kebutuhan <span className="text-red-500">*</span></Label>
              <Input 
                placeholder="Contoh: Pupuk NPK 50kg, Perbaikan Jalan..." 
                value={formData.title}
                onChange={e => setFormData({...formData, title: e.target.value})}
                required
                className="bg-gray-50 border-gray-200 focus:bg-white transition-colors"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Jumlah</Label>
                <Input 
                  type="number"
                  placeholder="0" 
                  value={formData.quantity}
                  onChange={e => setFormData({...formData, quantity: e.target.value})}
                  className="bg-gray-50 border-gray-200 focus:bg-white transition-colors"
                />
              </div>
              <div className="space-y-2">
                <Label>Satuan</Label>
                <Input 
                  placeholder="Kg, Liter, Pcs..." 
                  value={formData.unit}
                  onChange={e => setFormData({...formData, unit: e.target.value})}
                  className="bg-gray-50 border-gray-200 focus:bg-white transition-colors"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Prioritas</Label>
              <select 
                className="w-full h-10 px-3 rounded-md border border-gray-200 bg-gray-50 focus:bg-white text-sm transition-colors"
                value={formData.priority}
                onChange={e => setFormData({...formData, priority: e.target.value})}
              >
                <option value="LOW">Rendah (Santai)</option>
                <option value="NORMAL">Normal</option>
                <option value="HIGH">Tinggi (Penting)</option>
                <option value="URGENT">Mendesak (Darurat)</option>
              </select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Deskripsi Detail</Label>
            <Textarea 
              placeholder="Jelaskan spesifikasi, jumlah, alasan kebutuhan, atau perkiraan biaya..." 
              value={formData.description}
              onChange={e => setFormData({...formData, description: e.target.value})}
              className="bg-gray-50 border-gray-200 focus:bg-white min-h-[100px] transition-colors"
            />
          </div>

          <div className="space-y-2">
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
          <div className="flex justify-end pt-2">
            <Button type="submit" disabled={isSubmitting} className="rounded-full px-6">
              {isSubmitting ? 'Mengirim...' : 'Kirim Permintaan'}
            </Button>
          </div>
        </form>
      )}

      <div className="space-y-4">
        {isLoading ? (
          <div className="space-y-4">
             {[1,2].map(i => <div key={i} className="h-32 bg-gray-100 rounded-2xl animate-pulse" />)}
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-3xl border border-dashed border-gray-200">
            <div className="mx-auto w-12 h-12 bg-white rounded-full flex items-center justify-center mb-3 shadow-sm text-gray-400">
                <ExclamationTriangleIcon className="w-6 h-6" />
            </div>
            <h3 className="text-gray-900 font-medium capitalize">Belum ada permintaan</h3>
            <p className="text-gray-500 text-sm mt-1">Klik tombol di atas untuk membuat permintaan baru</p>
          </div>
        ) : (
          items.map((item) => (
            <div key={item.id} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all group">
              <div className="flex justify-between items-start mb-3">
                <div className="flex gap-3">
                    <div className={`px-2.5 py-1 rounded-lg text-xs font-medium border uppercase tracking-wider h-fit ${getPriorityColor(item.priority)}`}>
                        {item.priority}
                    </div>
                    <div>
                        <h4 className="font-bold text-gray-900 text-lg leading-tight capitalize">
                            {formatTitle(item.title)}
                            {item.quantity && (
                                <span className="ml-2 text-blue-600">
                                    ({item.quantity} {item.unit})
                                </span>
                            )}
                        </h4>
                        <div className="flex items-center gap-2 text-xs text-gray-500 mt-1.5">
                            <ClockIcon className="w-3.5 h-3.5" />
                            {format(new Date(item.createdAt), 'dd MMMM yyyy HH:mm', { locale: localeId })}
                            <span className="text-gray-300">•</span>
                            <span>Oleh: {item.user.name}</span>
                        </div>
                    </div>
                </div>
                {getStatusBadge(item.status)}
              </div>
              
              {item.description && (
                <div className="mt-3 text-gray-600 text-sm bg-gray-50 p-3 rounded-xl">
                  {item.description}
                </div>
              )}

              {/* Actions for Admin/Owner */}
              {isAdminOrOwner && item.status === 'PENDING' && (
                  <div className="mt-4 pt-4 border-t border-gray-50 flex justify-end gap-2">
                      <Button size="sm" variant="outline" className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-100" onClick={() => handleStatusChange(item.id, 'REJECTED')}>
                          <XCircleIcon className="w-4 h-4 mr-1.5" /> Tolak
                      </Button>
                      <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={() => handleStatusChange(item.id, 'APPROVED')}>
                          <CheckCircleIcon className="w-4 h-4 mr-1.5" /> Setujui
                      </Button>
                  </div>
              )}
              
              {/* Mark as Completed for Approved items */}
              {isAdminOrOwner && item.status === 'APPROVED' && (
                  <div className="mt-4 pt-4 border-t border-gray-50 flex justify-end gap-2">
                      <Button size="sm" variant="outline" className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 border-blue-100" onClick={() => handleStatusChange(item.id, 'COMPLETED')}>
                          <CheckCircleIcon className="w-4 h-4 mr-1.5" /> Tandai Selesai
                      </Button>
                  </div>
              )}

              {/* Delete for owner of item or admin */}
              {(isAdminOrOwner || String(userId) === String(item.user.id)) && (
                  <div className="mt-4 flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="flex items-center gap-3">
                        {item.imageUrl && (
                          <button
                            onClick={() => { setViewImageUrl(item.imageUrl || null); setViewImageError(false); }}
                            className="text-xs text-gray-400 hover:text-blue-600 flex items-center gap-1"
                            title="Lihat bukti"
                          >
                            <EyeIcon className="w-3 h-3" /> Bukti
                          </button>
                        )}
                        <button onClick={() => setDeleteTargetId(item.id)} className="text-xs text-gray-400 hover:text-red-500 flex items-center gap-1">
                            <TrashIcon className="w-3 h-3" /> Hapus
                        </button>
                      </div>
                  </div>
              )}
            </div>
          ))
        )}
      </div>

      <Dialog open={!!viewImageUrl} onOpenChange={(open) => { if (!open) { setViewImageUrl(null); setViewImageError(false); } }}>
        <DialogContent className="max-w-5xl w-[95vw] p-0 overflow-hidden border-none bg-white shadow-2xl [&>button.absolute]:hidden">
          {viewImageUrl && (
            <div className="flex flex-col h-full max-h-[90vh]">
              <ModalHeader
                title="Bukti Permintaan"
                subtitle="Pratinjau lampiran"
                variant="emerald"
                icon={<DocumentTextIcon className="h-5 w-5 text-white" />}
                actions={
                  <button
                    type="button"
                    onClick={() => {
                      if (!viewImageUrl) return
                      const link = document.createElement('a')
                      link.href = viewImageUrl
                      link.download = `bukti-permintaan-${Date.now()}.webp`
                      document.body.appendChild(link)
                      link.click()
                      document.body.removeChild(link)
                    }}
                    className="h-9 w-9 rounded-md border border-white/70 bg-white text-emerald-600 flex items-center justify-center hover:bg-white/90"
                    aria-label="Download"
                    title="Download gambar"
                  >
                    <DocumentArrowDownIcon className="h-4 w-4" />
                  </button>
                }
                onClose={() => { setViewImageUrl(null); setViewImageError(false); }}
              />

              <div className="flex-1 overflow-auto flex items-center justify-center p-4 md:p-8 min-h-0 bg-gray-50/50">
                {!viewImageError ? (
                  <img
                    src={viewImageUrl}
                    alt="Bukti Permintaan"
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
        isOpen={deleteTargetId !== null}
        onClose={() => setDeleteTargetId(null)}
        onConfirm={handleConfirmDelete}
        title="Konfirmasi Hapus Permintaan"
        description="Apakah Anda yakin ingin menghapus permintaan ini?"
        variant="emerald"
      />
    </div>
  );
}
