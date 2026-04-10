'use client'

import { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import useSWR, { mutate } from 'swr';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { PencilSquareIcon, TrashIcon, PhotoIcon, ChevronDownIcon, ChevronUpIcon, ArrowDownTrayIcon, XMarkIcon, CalendarIcon, ArrowDownOnSquareIcon, PlusIcon, DocumentTextIcon, WrenchIcon } from '@heroicons/react/24/outline';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { id as idLocale } from 'date-fns/locale';
import { ConfirmationModal } from '@/components/ui/confirmation-modal';
import ImageUpload from '@/components/ui/ImageUpload';
import { ModalFooter, ModalHeader } from '@/components/ui/modal-elements';
 

interface ImagePreviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    imageUrl: string | null;
}

const ImagePreviewModal = ({ isOpen, onClose, imageUrl }: ImagePreviewModalProps) => {
    const [error, setError] = useState(false);
    if (!isOpen || !imageUrl) return null;

    return (
        <Dialog open={isOpen} onOpenChange={(open) => { if (!open) { setError(false); onClose(); } }}>
            <DialogContent className="w-full max-w-[95vw] sm:max-w-3xl p-0 overflow-hidden bg-transparent border-none shadow-none [&>button]:hidden">
                <div className="relative flex flex-col items-center justify-center">
                    {!error ? (
                      <div className="relative w-full h-[80vh] flex items-center justify-center">
                        <img
                          src={imageUrl}
                          alt="Preview Bukti Servis"
                          className="max-w-[95vw] sm:max-w-3xl max-h-[80vh] w-auto h-auto object-contain rounded-lg shadow-2xl"
                          onError={() => setError(true)}
                        />
                      </div>
                    ) : (
                      <div className="flex items-center justify-center w-[95vw] sm:max-w-3xl h-[60vh]">
                        <div className="px-4 py-3 rounded-md bg-white shadow text-gray-700">
                          Gambar tidak ditemukan atau tidak dapat dimuat.
                        </div>
                      </div>
                    )}
                    <div className="absolute top-4 right-4 flex gap-2">
                        {!error && (
                          <a 
                              href={imageUrl}
                              download
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-2 bg-gray-200/80 hover:bg-gray-300 rounded-full text-gray-700 transition-colors backdrop-blur-sm shadow-sm"
                              title="Download Foto"
                          >
                              <ArrowDownTrayIcon className="w-5 h-5" />
                          </a>
                        )}
                        <button 
                            onClick={onClose}
                            className="p-2 bg-gray-200/80 hover:bg-gray-300 rounded-full text-gray-700 transition-colors backdrop-blur-sm shadow-sm"
                            title="Tutup"
                        >
                            <XMarkIcon className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};

interface CollapsibleSectionProps {
    title: string;
    children: React.ReactNode;
    defaultOpen?: boolean;
}

const CollapsibleSection = ({ title, children, defaultOpen = false }: CollapsibleSectionProps) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);
    return (
        <div className="border rounded-xl overflow-hidden">
            <button 
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex justify-between items-center p-3 bg-gray-50 hover:bg-gray-100 transition-colors"
            >
                <span className="font-medium text-sm text-gray-700">{title}</span>
                {isOpen ? <ChevronUpIcon className="w-4 h-4 text-gray-500" /> : <ChevronDownIcon className="w-4 h-4 text-gray-500" />}
            </button>
            {isOpen && (
                <div className="p-4 bg-white border-t">
                    {children}
                </div>
            )}
        </div>
    );
}

interface ServiceLogItem {
  id: number;
  inventoryItemId: number;
  quantity: number;
  inventoryItem: {
    id: number;
    name: string;
    unit: string;
  };
}

interface ServiceLog {
  id: number;
  date: string;
  description: string;
  cost: number;
  odometer: number | null;
  nextServiceDate: string | null;
  fotoUrl: string | null;
  items?: ServiceLogItem[];
}

interface InventoryItem {
  id: number;
  name: string;
  stock: number;
  unit: string;
}

interface ServiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  platNomor: string | null;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function ServiceModal({ isOpen, onClose, platNomor }: ServiceModalProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [viewingImage, setViewingImage] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const [tableScrollTop, setTableScrollTop] = useState(0);
  const [tableHeight, setTableHeight] = useState(0);
  useEffect(() => {
    setTableHeight(tableScrollRef.current?.clientHeight ?? 0);
  }, []);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    description: '',
    cost: '',
    odometer: '',
    nextServiceDate: ''
  });
  const [fieldErrors, setFieldErrors] = useState<{ date?: string; description?: string; cost?: string }>({});
  const [selectedItems, setSelectedItems] = useState<{inventoryItemId: number, quantity: number}[]>([]);
  const [itemErrors, setItemErrors] = useState<{ item?: string; quantity?: string }[]>([]);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [quickRange, setQuickRange] = useState<string>('this_month');

  const [logsPage, setLogsPage] = useState(1);
  const [logsLimit, setLogsLimit] = useState(10);
  const [logsTotal, setLogsTotal] = useState(0);
  const [logsCursor, setLogsCursor] = useState<number | null>(null);
  const [logsCursorStack, setLogsCursorStack] = useState<number[]>([]);
  const { data: logsResp, isLoading, mutate: refreshLogs } = useSWR<{ data: ServiceLog[]; total: number; nextCursor: number | null }>(
    platNomor ? (() => {
      const params = new URLSearchParams();
      if (startDate) params.set('startDate', new Date(startDate).toISOString());
      if (endDate) params.set('endDate', new Date(endDate).toISOString());
      if (logsCursor != null) {
        params.set('cursorId', String(logsCursor));
      } else {
        params.set('page', String(logsPage));
      }
      params.set('limit', String(logsLimit));
      return `/api/kendaraan/${platNomor}/service?${params.toString()}`;
    })() : null,
    fetcher,
    { revalidateOnFocus: false, revalidateOnReconnect: false, dedupingInterval: 10000, keepPreviousData: true }
  );
  const logs = logsResp?.data ?? [];
  useEffect(() => {
    if (logsResp?.total != null) setLogsTotal(logsResp.total);
  }, [logsResp]);
  
  const dateDisplay = (() => {
    if (quickRange && quickRange !== 'custom') {
      switch (quickRange) {
        case 'today': return 'Hari Ini';
        case 'yesterday': return 'Kemarin';
        case 'last_7_days': return '7 Hari Terakhir';
        case 'last_week': return 'Minggu Lalu';
        case 'last_30_days': return '30 Hari Terakhir';
        case 'this_month': return 'Bulan Ini';
        default: return 'Pilih Rentang Waktu';
      }
    }
    if (startDate && endDate) {
      try {
        const s = new Date(startDate);
        const e = new Date(endDate);
        return `${format(s, 'dd MMM yyyy', { locale: idLocale })} - ${format(e, 'dd MMM yyyy', { locale: idLocale })}`;
      } catch {
        return 'Pilih Rentang Waktu';
      }
    }
    return 'Pilih Rentang Waktu';
  })();

  const { data: inventoryItems } = useSWR<InventoryItem[]>(
    '/api/inventory?limit=1000',
    (url: string) => fetch(url).then(res => res.json()).then((d) => d?.data ?? d)
  );

  const formatNumber = (value: string | number) => {
    // Remove non-digit characters if string
    const number = typeof value === 'string' ? value.replace(/\D/g, '') : value.toString();
    if (!number) return '';
    // Format with dots
    return new Intl.NumberFormat('id-ID').format(Number(number));
  };

  const parseNumber = (value: string) => {
    // Remove dots and convert to number
    return value ? Number(value.replace(/\./g, '')) : 0;
  };

  const handleEdit = (log: ServiceLog) => {
    setEditingId(log.id);
    setFormData({
      date: new Date(log.date).toISOString().split('T')[0],
      description: log.description,
      cost: formatNumber(log.cost),
      odometer: log.odometer ? formatNumber(log.odometer) : '',
      nextServiceDate: log.nextServiceDate ? new Date(log.nextServiceDate).toISOString().split('T')[0] : ''
    });
    setPreviewUrl(log.fotoUrl);
    setSelectedFile(null);
    setSelectedItems(log.items?.map(i => ({
      inventoryItemId: i.inventoryItemId,
      quantity: i.quantity
    })) || []);
    setIsAdding(true);
  };

  const handleDeleteClick = (id: number) => {
    setDeleteId(id);
  };

  const handleFileChange = (file: File | null) => {
    setSelectedFile(file);
    if (file) {
        const objectUrl = URL.createObjectURL(file);
        setPreviewUrl(objectUrl);
    } else {
        setPreviewUrl(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteId) return;

    try {
      const res = await fetch(`/api/kendaraan/${platNomor}/service/${deleteId}`, {
        method: 'DELETE',
      });

      if (!res.ok) throw new Error('Gagal menghapus log service');

      toast.success('Log service berhasil dihapus');
      refreshLogs();
    } catch (error) {
      toast.error('Gagal menghapus log service');
    } finally {
      setDeleteId(null);
    }
  };

  const handleCancel = () => {
    setIsAdding(false);
    setEditingId(null);
    setFormData({
        date: new Date().toISOString().split('T')[0],
        description: '',
        cost: '',
        odometer: '',
        nextServiceDate: ''
    });
    setSelectedFile(null);
    setPreviewUrl(null);
    setSelectedItems([]);
    setFieldErrors({});
    setItemErrors([]);
  };

  const handleAddItem = () => {
    setSelectedItems([...selectedItems, { inventoryItemId: 0, quantity: 1 }]);
    setItemErrors([...itemErrors, {}]);
  };

  const handleRemoveItem = (index: number) => {
    const newItems = [...selectedItems];
    newItems.splice(index, 1);
    setSelectedItems(newItems);
    const newItemErrors = [...itemErrors];
    newItemErrors.splice(index, 1);
    setItemErrors(newItemErrors);
  };

  const handleItemChange = (index: number, field: 'inventoryItemId' | 'quantity', value: number) => {
    const newItems = [...selectedItems];
    newItems[index] = { ...newItems[index], [field]: value };
    setSelectedItems(newItems);
    const newItemErrors = [...itemErrors];
    newItemErrors[index] = { ...newItemErrors[index], [field === 'inventoryItemId' ? 'item' : 'quantity']: undefined };
    setItemErrors(newItemErrors);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!platNomor) return;

    // Validate items
    const validItems = selectedItems.filter(i => i.inventoryItemId > 0 && i.quantity > 0);

    const nextFieldErrors: { date?: string; description?: string; cost?: string } = {};
    if (!formData.date) nextFieldErrors.date = 'Tanggal wajib diisi';
    if (!formData.description.trim()) nextFieldErrors.description = 'Deskripsi wajib diisi';
    const nextItemErrors: { item?: string; quantity?: string }[] = selectedItems.map((i) => {
      const err: { item?: string; quantity?: string } = {};
      if (!i.inventoryItemId || i.inventoryItemId <= 0) err.item = 'Pilih sparepart';
      if (!i.quantity || i.quantity <= 0) err.quantity = 'Qty harus lebih dari 0';
      return err;
    });
    const hasItemError = nextItemErrors.some(e => e.item || e.quantity);
    const hasFieldError = Object.keys(nextFieldErrors).length > 0;
    if (hasItemError || hasFieldError) {
      setFieldErrors(nextFieldErrors);
      setItemErrors(nextItemErrors);
      return;
    }

    const payload = new FormData();
    payload.append('date', formData.date);
    payload.append('description', formData.description);
    if (formData.cost) payload.append('cost', parseNumber(formData.cost).toString());
    if (formData.odometer) payload.append('odometer', parseNumber(formData.odometer).toString());
    if (formData.nextServiceDate) payload.append('nextServiceDate', formData.nextServiceDate);
    if (selectedFile) payload.append('photo', selectedFile);
    if (validItems.length > 0) payload.append('items', JSON.stringify(validItems));

    try {
      const url = editingId 
        ? `/api/kendaraan/${platNomor}/service/${editingId}`
        : `/api/kendaraan/${platNomor}/service`;
      
      const method = editingId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method: method,
        body: payload,
      });

      if (!res.ok) throw new Error(`Gagal ${editingId ? 'mengupdate' : 'menyimpan'} log service`);

      toast.success(`Log service berhasil ${editingId ? 'diupdate' : 'ditambahkan'}`);
      handleCancel();
      refreshLogs();
    } catch (error) {
      toast.error(`Gagal ${editingId ? 'mengupdate' : 'menyimpan'} log service`);
    }
  };

  const applyQuickRange = (val: string) => {
    setQuickRange(val);
    const today = new Date();
    const startOfDay = new Date(today);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(today);
    endOfDay.setHours(23, 59, 59, 999);

    if (val === 'today') {
      setStartDate(startOfDay.toISOString().split('T')[0]);
      setEndDate(endOfDay.toISOString().split('T')[0]);
    } else if (val === 'yesterday') {
      const y = new Date(today);
      y.setDate(y.getDate() - 1);
      const yStart = new Date(y); yStart.setHours(0,0,0,0);
      const yEnd = new Date(y); yEnd.setHours(23,59,59,999);
      setStartDate(yStart.toISOString().split('T')[0]);
      setEndDate(yEnd.toISOString().split('T')[0]);
    } else if (val === 'last_7_days') {
      const start = new Date(today);
      start.setDate(start.getDate() - 6);
      setStartDate(start.toISOString().split('T')[0]);
      setEndDate(endOfDay.toISOString().split('T')[0]);
    } else if (val === 'last_week') {
      const start = new Date(today);
      start.setDate(start.getDate() - 7);
      setStartDate(start.toISOString().split('T')[0]);
      setEndDate(endOfDay.toISOString().split('T')[0]);
    } else if (val === 'last_30_days') {
      const start = new Date(today);
      start.setDate(start.getDate() - 29);
      setStartDate(start.toISOString().split('T')[0]);
      setEndDate(endOfDay.toISOString().split('T')[0]);
    } else if (val === 'this_month') {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      setStartDate(start.toISOString().split('T')[0]);
      setEndDate(endOfDay.toISOString().split('T')[0]);
    } else if (val === 'custom') {
      // Do nothing; user will set dates manually
    }
  };

  // Default apply "this_month" to match Nota Sawit behavior
  // and ensure initial filtered data loads consistently.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { applyQuickRange('this_month'); }, []);

  const handleExportPDF = async () => {
    if (!printRef.current) return;
    setIsExporting(true);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const jsPDF = (await import('jspdf')).default;

      // Create a clone of the element
      const element = printRef.current;
      const clone = element.cloneNode(true) as HTMLElement;
      
      // Define a fixed width for the PDF generation (Landscape)
      const pdfWidthPx = 1400;
      
      // Setup clone styles
      clone.style.position = 'absolute';
      clone.style.left = '-9999px';
      clone.style.top = '0';
      clone.style.width = `${pdfWidthPx}px`;
      clone.style.height = 'auto';
      clone.style.overflow = 'visible';
      clone.style.background = 'white';
      clone.style.padding = '20px';
      
      // Header: Title and ranges
      try {
        const header = document.createElement('div');
        header.style.marginBottom = '20px';
        
        const title = document.createElement('div');
        title.style.fontSize = '18px';
        title.style.fontWeight = '600';
        title.innerText = `Daftar Riwayat Servis - ${platNomor ?? '-'}`;
        header.appendChild(title);
        
        const subinfo = document.createElement('div');
        subinfo.style.fontSize = '12px';
        subinfo.style.color = '#555';
        
        const dateInfo = document.createElement('div');
        dateInfo.style.fontWeight = '700';
        dateInfo.style.color = '#000';
        dateInfo.innerText = `Rentang Waktu: ${dateDisplay}`;
        subinfo.appendChild(dateInfo);
        
        const costInfo = document.createElement('div');
        costInfo.style.fontWeight = '700';
        costInfo.style.color = '#000';
        if (Array.isArray(logs) && logs.length > 0) {
          const total = logs.reduce((sum, l) => sum + Number(l.cost ?? 0), 0);
          costInfo.innerText = `Jumlah Pengeluaran: Rp ${formatNumber(total)}`;
        } else {
          costInfo.innerText = `Jumlah Pengeluaran: -`;
        }
        subinfo.appendChild(costInfo);
        
        header.appendChild(subinfo);
        clone.insertBefore(header, clone.firstChild);
      } catch {}
      
      // Remove overflow from table container in clone
      const tableContainer = clone.querySelector('.overflow-x-auto');
      if (tableContainer) {
          (tableContainer as HTMLElement).classList.remove('overflow-x-auto');
          (tableContainer as HTMLElement).style.overflow = 'visible';
      }

      // Modify Table: Add "Foto" column and Remove "Aksi" column
      const table = clone.querySelector('table');
      if (table && logs) {
          // 1. Add "Foto" Header
          const theadRow = table.querySelector('thead tr');
          if (theadRow) {
             const thFoto = document.createElement('th');
             thFoto.className = 'px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider';
             thFoto.innerText = 'Foto';
             // Insert before the last column (Aksi)
             const ths = theadRow.querySelectorAll('th');
             if (ths.length > 0) {
                 theadRow.insertBefore(thFoto, ths[ths.length - 1]);
             } else {
                 theadRow.appendChild(thFoto);
             }
          }

          // 2. Add "Foto" Body Cells
          const tbody = table.querySelector('tbody');
          const rows = tbody ? tbody.querySelectorAll('tr') : [];
          
          rows.forEach((row, index) => {
              const log = logs[index];
              const tdFoto = document.createElement('td');
              tdFoto.className = 'px-6 py-4 whitespace-nowrap text-sm text-gray-500';
              
              if (log && log.fotoUrl) {
                  const img = document.createElement('img');
                  img.src = log.fotoUrl;
                  img.style.width = '120px';
                  img.style.height = '90px';
                  img.style.objectFit = 'cover';
                  img.style.borderRadius = '4px';
                  // Ensure image is loaded for html2canvas
                  img.crossOrigin = "anonymous"; 
                  tdFoto.appendChild(img);
              } else {
                  tdFoto.innerText = '-';
              }

              // Insert before the last column (Aksi)
              const tds = row.querySelectorAll('td');
              if (tds.length > 0) {
                  row.insertBefore(tdFoto, tds[tds.length - 1]);
              } else {
                  row.appendChild(tdFoto);
              }
          });

          // 3. Remove "Aksi" column (now it's definitely the last one)
          // Remove header
          if (theadRow) {
              const ths = theadRow.querySelectorAll('th');
              if (ths.length > 0) {
                  ths[ths.length - 1].remove();
              }
          }
          // Remove body cells
          rows.forEach(row => {
              const tds = row.querySelectorAll('td');
              if (tds.length > 0) {
                  tds[tds.length - 1].remove();
              }
          });
      }

      document.body.appendChild(clone);
      
      // Short delay to ensure images are rendered/loaded if any
      await new Promise(resolve => setTimeout(resolve, 500));

      const canvas = await html2canvas(clone, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        windowWidth: pdfWidthPx,
        windowHeight: clone.scrollHeight + 100,
      } as any);

      document.body.removeChild(clone);

      const imgData = canvas.toDataURL('image/jpeg', 1.0);
      // Landscape A4
      const pdf = new jsPDF('l', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pdfWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
      heightLeft -= pdfHeight;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
        heightLeft -= pdfHeight;
      }

      pdf.save(`Riwayat-Servis-${platNomor}.pdf`);
    } catch (error) {
      console.error(error);
      toast.error('Gagal export PDF');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="flex flex-col w-[95vw] sm:w-full sm:max-w-3xl max-h-[90vh] overflow-hidden p-0 [&>button]:hidden">
        <ModalHeader
          title={`Riwayat Servis - ${platNomor || ''}`}
          variant="emerald"
          icon={<WrenchIcon className="h-5 w-5 text-white" />}
          onClose={onClose}
        />

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {!isAdding ? (
            <div className="space-y-4">
               <div className="flex flex-col gap-3">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-semibold">Daftar Servis</h3>
                    <Button 
                      onClick={() => setIsAdding(true)} 
                      className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-full shadow-sm inline-flex items-center"
                    >
                      <PlusIcon className="h-4 w-4 mr-2" />
                      Catat Servis Baru
                    </Button>
                  </div>
                  <div className="w-full flex items-center gap-2">
                    <Popover open={isFilterOpen} onOpenChange={setIsFilterOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          id="date"
                          variant={"outline"}
                          className="w-full sm:w-[260px] justify-start text-left font-normal bg-white rounded-xl"
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {dateDisplay}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent
                        className="w-[95vw] sm:w-auto sm:min-w-[300px] sm:max-w-[420px] max-h-[70vh] overflow-auto p-4 bg-white"
                        align="start"
                        side="bottom"
                        sideOffset={4}
                        avoidCollisions={false}
                      >
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <h4 className="font-medium leading-none">Rentang Waktu</h4>
                            <p className="text-sm text-muted-foreground">
                              Pilih rentang waktu cepat
                            </p>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <Button variant="outline" size="sm" onClick={() => applyQuickRange('today')} className={quickRange === 'today' ? 'bg-accent' : ''}>Hari Ini</Button>
                            <Button variant="outline" size="sm" onClick={() => applyQuickRange('yesterday')} className={quickRange === 'yesterday' ? 'bg-accent' : ''}>Kemarin</Button>
                            <Button variant="outline" size="sm" onClick={() => applyQuickRange('last_7_days')} className={quickRange === 'last_7_days' ? 'bg-accent' : ''}>7 Hari</Button>
                            <Button variant="outline" size="sm" onClick={() => applyQuickRange('last_30_days')} className={quickRange === 'last_30_days' ? 'bg-accent' : ''}>30 Hari</Button>
                            <Button variant="outline" size="sm" onClick={() => applyQuickRange('this_month')} className={quickRange === 'this_month' ? 'bg-accent' : ''}>Bulan Ini</Button>
                          </div>
                          <div className="border-t pt-4 space-y-2">
                            <h4 className="font-medium leading-none">Kustom</h4>
                            <div className="grid gap-2">
                              <div className="grid grid-cols-3 items-center gap-4">
                                <Label htmlFor="start-date" className="text-xs">Dari</Label>
                                <Input
                                  id="start-date"
                                  type="date"
                                  value={startDate}
                                  onChange={(e) => { setStartDate(e.target.value); setQuickRange('custom'); }}
                                  className="col-span-2 rounded-xl"
                                />
                              </div>
                              <div className="grid grid-cols-3 items-center gap-4">
                                <Label htmlFor="end-date" className="text-xs">Sampai</Label>
                                <Input
                                  id="end-date"
                                  type="date"
                                  value={endDate}
                                  onChange={(e) => { setEndDate(e.target.value); setQuickRange('custom'); }}
                                  className="col-span-2 rounded-xl"
                                />
                              </div>
                              <div className="flex justify-end pt-2">
                                <Button size="sm" onClick={() => setIsFilterOpen(false)} className="rounded-full bg-emerald-600 hover:bg-emerald-700 text-white">
                                  <ArrowDownOnSquareIcon className="mr-2 h-4 w-4" />
                                  Simpan
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
               </div>
               
               {isLoading ? (
                 <p>Memuat data...</p>
               ) : logs && logs.length > 0 ? (
                <div ref={printRef} className="space-y-2">
                  <div
                    ref={tableScrollRef}
                    className="border rounded-md overflow-x-auto"
                    style={{ contentVisibility: 'auto', overflowY: 'auto', maxHeight: '50vh' }}
                    onScroll={(e) => setTableScrollTop((e.target as HTMLElement).scrollTop)}
                  >
                    <Table>
                      <TableHeader className="bg-gray-50">
                        <TableRow>
                          <TableHead className="whitespace-nowrap">Tanggal</TableHead>
                          <TableHead>Deskripsi</TableHead>
                          <TableHead className="whitespace-nowrap">Biaya</TableHead>
                          <TableHead className="whitespace-nowrap">KM</TableHead>
                          <TableHead className="whitespace-nowrap">Aksi</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(() => {
                          const rowHeight = 44;
                          const totalRows = logs.length;
                          const startIndex = Math.max(0, Math.floor(tableScrollTop / rowHeight));
                          const visibleCount = Math.max(1, Math.ceil((tableHeight || 1) / rowHeight) + 5);
                          const endIndex = Math.min(totalRows, startIndex + visibleCount);
                          const topSpacer = startIndex * rowHeight;
                          const bottomSpacer = (totalRows - endIndex) * rowHeight;
                          const rows = logs.slice(startIndex, endIndex);
                          return (
                            <>
                              <TableRow>
                                <TableCell colSpan={5} style={{ height: topSpacer }} />
                              </TableRow>
                              {rows.map((log) => (
                                <TableRow key={log.id}>
                                  <TableCell className="whitespace-nowrap">
                                    {format(new Date(log.date), 'dd/MM/yyyy')}
                                  </TableCell>
                                  <TableCell className="max-w-[200px] truncate" title={log.description}>
                                      {log.description}
                                  </TableCell>
                                  <TableCell className="whitespace-nowrap">
                                    Rp {new Intl.NumberFormat('id-ID').format(log.cost)}
                                  </TableCell>
                                  <TableCell className="whitespace-nowrap">
                                    {log.odometer ? `${log.odometer} km` : '-'}
                                  </TableCell>
                                  <TableCell className="whitespace-nowrap">
                                    <div className="flex space-x-2">
                                      {log.fotoUrl && (
                                        <button 
                                          onClick={() => setViewingImage(log.fotoUrl)}
                                          className="inline-flex items-center justify-center h-8 w-8 text-green-600 hover:text-green-800 rounded-md hover:bg-green-50"
                                          title="Lihat Foto/Nota"
                                        >
                                          <PhotoIcon className="h-4 w-4" />
                                        </button>
                                      )}
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => handleEdit(log)}
                                        className="h-8 w-8 text-emerald-600 hover:text-emerald-800"
                                      >
                                        <PencilSquareIcon className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => handleDeleteClick(log.id)}
                                        className="h-8 w-8 text-red-600 hover:text-red-800"
                                      >
                                        <TrashIcon className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              ))}
                              <TableRow>
                                <TableCell colSpan={5} style={{ height: bottomSpacer }} />
                              </TableRow>
                            </>
                          );
                        })()}
                      </TableBody>
                      <TableFooter>
                        <TableRow className="bg-gray-100 font-bold">
                          <TableCell colSpan={2} className="text-right">Total Biaya</TableCell>
                          <TableCell className="whitespace-nowrap">
                            Rp {new Intl.NumberFormat('id-ID').format(logs.reduce((acc, log) => acc + log.cost, 0))}
                          </TableCell>
                          <TableCell colSpan={2}></TableCell>
                        </TableRow>
                      </TableFooter>
                    </Table>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 gap-y-3">
                    <div className="text-sm text-muted-foreground flex-1 min-w-0 break-words">
                      Menampilkan {logs.length} dari {logsTotal} entri
                    </div>
                    <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                      <label className="text-sm">Per halaman</label>
                      <select
                        value={logsLimit}
                        onChange={(e) => { setLogsLimit(Number(e.target.value)); setLogsPage(1); setLogsCursor(null); setLogsCursorStack([]); refreshLogs(); }}
                        className="h-9 rounded-md border px-2 text-sm shrink-0"
                      >
                        <option value={10}>10</option>
                        <option value={25}>25</option>
                        <option value={50}>50</option>
                      </select>
                      <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                        <Button
                          variant="outline"
                          onClick={() => {
                            if (logsCursorStack.length > 1) {
                              const newStack = logsCursorStack.slice(0, -1);
                              setLogsCursorStack(newStack);
                              setLogsCursor(newStack.length > 0 ? newStack[newStack.length - 1] : null);
                            } else {
                              setLogsCursor(null);
                              setLogsPage(p => Math.max(1, p - 1));
                            }
                            refreshLogs();
                          }}
                          disabled={logsCursorStack.length <= 0 && logsPage <= 1}
                          className="h-9 shrink-0"
                        >
                          Sebelumnya
                        </Button>
                        <span className="text-sm">Hal {(logsCursorStack.length > 0 ? logsCursorStack.length + 1 : logsPage)} / {Math.max(1, Math.ceil(logsTotal / logsLimit))}</span>
                        <Button
                          variant="outline"
                          onClick={() => {
                            if (logsResp?.nextCursor) {
                              const next = logsResp.nextCursor as number;
                              setLogsCursorStack(prev => [...prev, next]);
                              setLogsCursor(next);
                            } else {
                              setLogsPage(p => p + 1);
                            }
                            refreshLogs();
                          }}
                          disabled={logsCursorStack.length <= 0 ? logsPage >= Math.ceil(logsTotal / logsLimit) : false}
                          className="h-9 shrink-0"
                        >
                          Berikutnya
                        </Button>
                      </div>
                    </div>
                  </div>
                 </div>
               ) : (
                 <p className="text-center text-gray-500 py-4">Belum ada riwayat servis.</p>
               )}
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-medium">{editingId ? 'Edit Servis' : 'Tambah Servis Baru'}</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="date">Tanggal</Label>
                        <Input 
                            id="date" 
                            type="date" 
                            value={formData.date}
                            onChange={(e) => setFormData({...formData, date: e.target.value})}
                            aria-invalid={!!fieldErrors.date}
                            className={`rounded-xl ${fieldErrors.date ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                        />
                        {fieldErrors.date && (
                          <p className="text-xs text-red-600 mt-1">{fieldErrors.date}</p>
                        )}
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="cost">Biaya (Rp)</Label>
                        <Input 
                            id="cost" 
                            type="text" 
                            value={formData.cost}
                            onChange={(e) => setFormData({...formData, cost: formatNumber(e.target.value)})}
                            placeholder="0"
                            className="rounded-xl"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="odometer">Odometer (KM)</Label>
                        <Input 
                            id="odometer" 
                            type="text" 
                            value={formData.odometer}
                            onChange={(e) => setFormData({...formData, odometer: formatNumber(e.target.value)})}
                            placeholder="0"
                            className="rounded-xl"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="nextServiceDate">Jadwal Servis Berikutnya</Label>
                        <Input 
                            id="nextServiceDate" 
                            type="date" 
                            value={formData.nextServiceDate}
                            onChange={(e) => setFormData({...formData, nextServiceDate: e.target.value})}
                            className="rounded-xl"
                        />
                    </div>
                    <div className="col-span-1 md:col-span-2 space-y-2">
                        <Label htmlFor="description">Deskripsi Pengerjaan</Label>
                        <Textarea 
                            id="description" 
                            value={formData.description}
                            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormData({...formData, description: e.target.value})}
                            placeholder="Contoh: Ganti oli mesin, filter udara, kampas rem"
                            aria-invalid={!!fieldErrors.description}
                            className={`rounded-xl ${fieldErrors.description ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                        />
                        {fieldErrors.description && (
                          <p className="text-xs text-red-600 mt-1">{fieldErrors.description}</p>
                        )}
                    </div>

                    <div className="col-span-1 md:col-span-2 space-y-2">
                        <Label>Penggunaan Sparepart (Opsional)</Label>
                        <div className="border rounded-xl p-4 space-y-3 bg-gray-50/50">
                            {selectedItems.map((item, index) => (
                                <div key={index} className="flex gap-2 items-end">
                                    <div className="flex-1">
                                        <Label className="text-xs mb-1 block">Item</Label>
                                        <select
                                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                            value={item.inventoryItemId}
                                            onChange={(e) => handleItemChange(index, 'inventoryItemId', Number(e.target.value))}
                                        >
                                            <option value={0}>Pilih Sparepart</option>
                                            {inventoryItems?.map((inv) => (
                                                <option key={inv.id} value={inv.id}>
                                                    {inv.name} (Stok: {inv.stock} {inv.unit})
                                                </option>
                                            ))}
                                        </select>
                                        {itemErrors[index]?.item && (
                                          <p className="text-xs text-red-600 mt-1">{itemErrors[index]?.item}</p>
                                        )}
                                    </div>
                                    <div className="w-24">
                                        <Label className="text-xs mb-1 block">Qty</Label>
                                        <Input
                                            type="number"
                                            min="0"
                                            step="0.1"
                                            value={item.quantity}
                                            onChange={(e) => handleItemChange(index, 'quantity', Number(e.target.value))}
                                        />
                                    </div>
                                    <Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveItem(index)} className="mb-[2px]">
                                        <TrashIcon className="h-4 w-4 text-red-500" />
                                    </Button>
                                    {itemErrors[index]?.quantity && (
                                      <p className="text-xs text-red-600 mt-1">{itemErrors[index]?.quantity}</p>
                                    )}
                                </div>
                            ))}
                            <Button type="button" variant="outline" size="sm" onClick={handleAddItem} className="mt-2">
                                + Tambah Sparepart
                            </Button>
                        </div>
                    </div>

                    <div className="col-span-1 md:col-span-2">
                        <CollapsibleSection title="Foto Bukti / Nota (Opsional)" defaultOpen={!!previewUrl}>
                            <div className="grid gap-2">
                                <ImageUpload 
                                    onFileChange={handleFileChange}
                                    previewUrl={previewUrl}
                                />
                            </div>
                        </CollapsibleSection>
                    </div>
                </div>
                <ModalFooter className="mt-6 -mx-6 -mb-5 sm:justify-between">
                    <Button type="button" variant="outline" onClick={handleCancel} className="rounded-full">
                      <XMarkIcon className="h-4 w-4 mr-2" />
                      Batal
                    </Button>
                    <Button type="submit" className="rounded-full bg-emerald-600 hover:bg-emerald-700 text-white">
                      <ArrowDownOnSquareIcon className="mr-2 h-4 w-4" />
                      {editingId ? 'Simpan Perubahan' : 'Simpan'}
                    </Button>
                </ModalFooter>
            </form>
          )}
        </div>

        {!isAdding && (
          <ModalFooter className="sm:justify-between">
            <Button 
              type="button" 
              variant="outline" 
              onClick={onClose}
              className="rounded-full h-9 px-3 whitespace-nowrap w-1/2 sm:w-auto flex-1 sm:flex-none"
            >
              Tutup
            </Button>
            <Button 
              type="button" 
              onClick={handleExportPDF} 
              disabled={isExporting}
              className="rounded-full h-9 px-3 whitespace-nowrap w-1/2 sm:w-auto flex-1 sm:flex-none bg-emerald-600 hover:bg-emerald-700 text-white inline-flex items-center"
            >
              <DocumentTextIcon className="h-4 w-4 mr-2" />
              {isExporting ? 'Mengekspor...' : 'Export PDF'}
            </Button>
          </ModalFooter>
        )}
        
        <ConfirmationModal
            isOpen={!!deleteId}
            onClose={() => setDeleteId(null)}
            onConfirm={handleConfirmDelete}
            title="Hapus Riwayat Servis"
            description="Apakah Anda yakin ingin menghapus riwayat servis ini? Tindakan ini tidak dapat dibatalkan."
            variant="emerald"
        />

        <ImagePreviewModal 
            isOpen={!!viewingImage}
            onClose={() => setViewingImage(null)}
            imageUrl={viewingImage}
        />
      </DialogContent>
    </Dialog>
  );
}
