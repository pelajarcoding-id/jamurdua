'use client'

import { useState, useEffect, useRef, useCallback } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { DataTable } from '@/components/data-table';
import { ColumnDef } from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import { PlusIcon, ArrowsRightLeftIcon, EllipsisHorizontalIcon, PencilSquareIcon, TrashIcon, ClockIcon, ExclamationTriangleIcon, PrinterIcon, ArrowPathIcon, ArchiveBoxIcon, XMarkIcon, CheckIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { TransactionModal } from './transaction-modal';
import { EditModal } from './edit-modal';
import { DetailModal } from './detail-modal';
import RoleGate from '@/components/RoleGate';
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ModalContentWrapper, ModalFooter, ModalHeader } from '@/components/ui/modal-elements'
import { 
    DropdownMenu, 
    DropdownMenuContent, 
    DropdownMenuItem, 
    DropdownMenuLabel, 
    DropdownMenuSeparator, 
    DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import ImageUpload from '@/components/ui/ImageUpload';
import toast from 'react-hot-toast';
import ReactCrop, { type Crop, centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';

type InventoryItem = {
    id: number;
    name: string;
    sku: string;
    category?: string | null;
    stock: number;
    initialStock: number;
    unit: string;
    minStock: number;
    price: number;
    imageUrl?: string | null;
};

function centerAspectCrop(mediaWidth: number, mediaHeight: number, aspect: number) {
  return centerCrop(
    makeAspectCrop(
      {
        unit: '%',
        width: 90,
      },
      aspect,
      mediaWidth,
      mediaHeight,
    ),
    mediaWidth,
    mediaHeight,
  )
}

// --- Helper Functions ---
const formatNumber = (value: number | string) => {
  if (typeof value === 'string') {
    // Remove dots, replace comma with dot
    value = parseFloat(value.replace(/\./g, '').replace(',', '.')) || 0;
  }
  return new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(value);
};

const parseNumber = (value: string) => {
  // Remove dots (thousands), replace comma with dot (decimal)
  return parseFloat(value.replace(/\./g, '').replace(',', '.')) || 0;
};

// Internal component for formatted input
const FormattedNumberInput = ({ 
  value, 
  onChange, 
  name, 
  disabled, 
  readOnly, 
  className,
  placeholder,
  defaultValue
}: any) => {
  const [localValue, setLocalValue] = useState("");
  const [isFocused, setIsFocused] = useState(false);

  // Initialize with defaultValue if provided and value is undefined
  useEffect(() => {
    if (defaultValue !== undefined && value === undefined) {
        setLocalValue(formatNumber(defaultValue));
    }
  }, [defaultValue]);

  // Sync with external value when not focused
  useEffect(() => {
      if (!isFocused && value !== undefined) {
          setLocalValue(formatNumber(value));
      }
  }, [value, isFocused]);

  const handleFocus = () => {
      setIsFocused(true);
      // When focusing, keep the formatted value but maybe we want to select all?
      // Or just keep it as string.
      // If it's 0, clear it for easier input
      if (localValue === '0') {
          setLocalValue("");
      }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      
      // Allow only numbers, dots, and commas
      if (!/^[0-9.,]*$/.test(val)) return;

      // Simple formatting while typing (optional, but good for UX)
      // For now, just let user type, we format on blur or we can format on the fly.
      // Let's just update local value.
      setLocalValue(val);
      
      // Propagate change if onChange is provided
      if (onChange) {
          onChange(e);
      }
  };

  const handleBlur = () => {
      setIsFocused(false);
      // Format on blur
      const num = parseNumber(localValue);
      setLocalValue(formatNumber(num));
  };

  return (
      <Input
          name={name}
          value={localValue}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          disabled={disabled}
          readOnly={readOnly}
          className={className}
          placeholder={placeholder}
          type="text" // Must be text to support formatting
          autoComplete="off"
      />
  );
};

export default function InventoryPage() {
    const [data, setData] = useState<InventoryItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(10);
    const [totalItems, setTotalItems] = useState(0);
    const [search, setSearch] = useState('');
    const [searchDraft, setSearchDraft] = useState('');
    const searchParams = useSearchParams();
    const pathname = usePathname();
    const router = useRouter();
    
    useEffect(() => {
        const q = searchParams.get('search') || '';
        setSearch((prev) => (prev === q ? prev : q))
        setSearchDraft((prev) => (prev === q ? prev : q))
    }, [searchParams]);
    
    // New States
    const [lowStockCount, setLowStockCount] = useState(0);
    const [categories, setCategories] = useState<string[]>([]);
    const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

    const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
    const [isTxModalOpen, setIsTxModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);

    // Image Upload & Crop State
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [crop, setCrop] = useState<Crop>();
    const [completedCrop, setCompletedCrop] = useState<Crop>();
    const [isCropping, setIsCropping] = useState(false);
    const imgRef = useRef<HTMLImageElement>(null);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/inventory?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}&category=${selectedCategory}`);
            const json = await res.json();
            setData(json.data);
            setTotalItems(json.total);
            setLowStockCount(json.lowStockCount || 0);
            setCategories(json.categories || []);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    }, [page, limit, search, selectedCategory]);

    const handleRefresh = useCallback(async () => {
        setRefreshing(true);
        try {
            await fetchData();
            toast.success('Data diperbarui');
        } finally {
            setRefreshing(false);
        }
    }, [fetchData]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const applySearch = useCallback((val?: string) => {
        const trimmed = String(val ?? searchDraft ?? '').trim()
        if (trimmed && trimmed.length < 2) return
        setSearch(trimmed)
        setPage(1)
        const params = new URLSearchParams(searchParams.toString())
        if (trimmed) params.set('search', trimmed)
        else params.delete('search')
        router.replace(`${pathname}?${params.toString()}`)
    }, [pathname, router, searchDraft, searchParams]);

    const handleTransaction = (item: InventoryItem) => {
        setSelectedItem(item);
        setIsTxModalOpen(true);
    };

    const handleEdit = (item: InventoryItem) => {
        setSelectedItem(item);
        setIsEditModalOpen(true);
    };

    const handleDetail = (item: InventoryItem) => {
        setSelectedItem(item);
        setIsDetailModalOpen(true);
    };

    const handleDelete = async (item: InventoryItem) => {
        if (!confirm(`Apakah Anda yakin ingin menghapus barang "${item.name}"?`)) return;

        try {
            const res = await fetch(`/api/inventory/${item.id}`, {
                method: 'DELETE'
            });
            
            if (res.ok) {
                toast.success('Barang berhasil dihapus');
                fetchData();
            } else {
                const json = await res.json();
                toast.error(json.error || 'Gagal menghapus barang');
            }
        } catch (error) {
            console.error(error);
            toast.error('Terjadi kesalahan saat menghapus');
        }
    };

    const handleExport = async () => {
        const jsPDF = (await import('jspdf')).default;
        const autoTable = (await import('jspdf-autotable')).default;

        const doc = new jsPDF();
        
        doc.setFontSize(18);
        doc.text('Laporan Stok Gudang', 14, 22);
        
        doc.setFontSize(11);
        doc.text(`Tanggal: ${format(new Date(), 'dd/MM/yyyy')}`, 14, 30);
        doc.text(`Total Barang: ${totalItems}`, 14, 36);
        
        const tableData = data.map(item => [
            item.sku,
            item.name,
            item.category || '-',
            `${item.stock} ${item.unit}`,
            item.stock <= item.minStock ? 'PERLU RESTOCK' : 'Aman'
        ]);

        autoTable(doc, {
            head: [['Kode', 'Nama Barang', 'Kategori', 'Stok', 'Status']],
            body: tableData,
            startY: 44,
            theme: 'grid',
            headStyles: { fillColor: [22, 163, 74] }, // Green header
        });

        doc.save(`laporan-stok-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    };

    const handleFileChange = (file: File | null) => {
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setPreviewUrl(reader.result as string);
                setIsCropping(true); // Open crop modal
            };
            reader.readAsDataURL(file);
        } else {
            setPreviewUrl(null);
            setImageFile(null);
        }
    };

    const onImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
        const { width, height } = e.currentTarget;
        setCrop(centerAspectCrop(width, height, 1)); // Start with square crop 1:1
    };

    async function getCroppedImg(image: HTMLImageElement, crop: Crop, fileName: string): Promise<File> {
        const canvas = document.createElement('canvas');
        const scaleX = image.naturalWidth / image.width;
        const scaleY = image.naturalHeight / image.height;
        
        // Set canvas size to the actual resolution of the cropped image to preserve quality
        canvas.width = Math.floor(crop.width * scaleX);
        canvas.height = Math.floor(crop.height * scaleY);
        
        const ctx = canvas.getContext('2d');

        if (!ctx) {
            throw new Error('No 2d context');
        }

        ctx.imageSmoothingQuality = 'high';

        ctx.drawImage(
            image,
            crop.x * scaleX,
            crop.y * scaleY,
            crop.width * scaleX,
            crop.height * scaleY,
            0,
            0,
            canvas.width,
            canvas.height,
        );

        return new Promise((resolve, reject) => {
            canvas.toBlob(
                (blob) => {
                    if (!blob) {
                        reject(new Error('Canvas is empty'));
                        return;
                    }
                    const base = String(fileName || 'image').replace(/\.[^/.]+$/, '')
                    const outName = `${base}.webp`
                    const file = new File([blob], outName, { type: 'image/webp' });
                    resolve(file);
                },
                'image/webp',
                0.9,
            );
        });
    }

    const handleCropConfirm = async () => {
        if (completedCrop?.width && completedCrop?.height && imgRef.current) {
            try {
                const croppedImageFile = await getCroppedImg(
                    imgRef.current,
                    completedCrop,
                    'cropped-inventory-item.webp'
                );
                setImageFile(croppedImageFile);
                
                // Update preview to show cropped image
                const reader = new FileReader();
                reader.onloadend = () => {
                    setPreviewUrl(reader.result as string);
                };
                reader.readAsDataURL(croppedImageFile);
                
                setIsCropping(false);
            } catch (e) {
                console.error('Error cropping image:', e);
                toast.error('Gagal memotong gambar');
            }
        }
    };

    const columns: ColumnDef<InventoryItem>[] = [
        {
            accessorKey: 'imageUrl',
            header: 'Foto',
            cell: ({ row }) => (
                <div className="w-16 h-16 bg-gray-100 rounded-md overflow-hidden flex items-center justify-center border">
                    {row.original.imageUrl ? (
                        <img src={row.original.imageUrl} alt={row.original.name} className="w-full h-full object-cover" />
                    ) : (
                        <span className="text-xs text-gray-400">No Img</span>
                    )}
                </div>
            )
        },
        { accessorKey: 'sku', header: 'Kode' },
        { accessorKey: 'name', header: 'Nama Barang' },
        { accessorKey: 'category', header: 'Kategori' },
        { 
            accessorKey: 'initialStock', 
            header: 'Stok Awal',
            cell: ({ row }) => (
                <span className="font-medium text-gray-600">
                    {row.original.initialStock || 0} {row.original.unit}
                </span>
            )
        },
        { 
            accessorKey: 'stock', 
            header: 'Sisa Stok',
            cell: ({ row }) => (
                <span className={row.original.stock <= row.original.minStock ? 'text-red-600 font-bold flex items-center' : 'font-medium'}>
                    {row.original.stock} {row.original.unit}
                    {row.original.stock <= row.original.minStock && (
                        <ExclamationTriangleIcon className="w-4 h-4 ml-1" />
                    )}
                </span>
            )
        },
        {
            accessorKey: 'price',
            header: 'Harga Satuan',
            cell: ({ row }) => (
                <span>{new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(row.original.price || 0)}</span>
            )
        },
        {
            id: 'totalValue',
            header: 'Nilai Barang',
            cell: ({ row }) => {
                const total = (row.original.stock || 0) * (row.original.price || 0);
                 return (
                    <span className="font-medium text-emerald-700">{new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(total)}</span>
                )
            }
        },
        {
            id: 'actions',
            cell: ({ row }) => (
                <div className="flex items-center gap-2">
                     <Button variant="outline" size="sm" onClick={() => handleTransaction(row.original)} className="hidden md:flex">
                        <ArrowsRightLeftIcon className="w-4 h-4 mr-1" />
                        Stok
                    </Button>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                                <span className="sr-only">Open menu</span>
                                <EllipsisHorizontalIcon className="h-5 w-5" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Aksi</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => handleTransaction(row.original)} className="md:hidden">
                                <ArrowsRightLeftIcon className="mr-2 h-4 w-4" /> Update Stok
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDetail(row.original)}>
                                <ClockIcon className="mr-2 h-4 w-4" /> Detail & Riwayat
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleEdit(row.original)}>
                                <PencilSquareIcon className="mr-2 h-4 w-4" /> Edit Detail
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDelete(row.original)} className="text-red-600">
                                <TrashIcon className="mr-2 h-4 w-4" /> Hapus Barang
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            )
        }
    ];

    const handleAddItem = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const form = e.currentTarget;
        const formData = new FormData(form);
        
        // Clean price format
        const priceRaw = formData.get('price') as string;
        const priceClean = priceRaw ? priceRaw.replace(/\./g, '').replace(',', '.') : '0';

        const loadingToast = toast.loading('Menambahkan barang...');
        
        try {
            let finalImageUrl = '';
            if (imageFile) {
                const uploadFormData = new FormData();
                uploadFormData.append('file', imageFile);
                const uploadRes = await fetch('/api/upload', {
                    method: 'POST',
                    body: uploadFormData
                });
                if (uploadRes.ok) {
                    const uploadData = await uploadRes.json();
                    if (uploadData.success) {
                        finalImageUrl = uploadData.url;
                    }
                }
            }

            const payload = {
                sku: formData.get('sku'),
                name: formData.get('name'),
                unit: formData.get('unit'),
                category: formData.get('category'),
                stock: Number(formData.get('stock')),
                minStock: Number(formData.get('minStock')),
                price: Number(priceClean),
                date: formData.get('date'),
                imageUrl: finalImageUrl
            };
            
            const res = await fetch('/api/inventory', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload) 
            });
            if(res.ok) {
                toast.success('Barang ditambahkan', { id: loadingToast });
                setIsAddModalOpen(false);
                setImageFile(null);
                setPreviewUrl(null);
                fetchData();
            } else {
                toast.error('Gagal menambah barang', { id: loadingToast });
            }
        } catch(err) {
            toast.error('Gagal menambah barang', { id: loadingToast });
        }
    };

    return (
        <RoleGate allow={['ADMIN', 'GUDANG', 'PEMILIK', 'KASIR']}>
            <div className="p-4 md:p-8">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                    <div>
                        <h1 className="text-2xl font-bold">Manajemen Inventaris</h1>
                        <p className="text-gray-500">Kelola stok barang dan aset perusahaan</p>
                    </div>
                </div>

                {/* Dashboard Widget */}
                {lowStockCount > 0 && (
                    <div className="bg-red-50 border border-red-200 p-4 rounded-xl flex items-center text-red-700 mb-6">
                        <ExclamationTriangleIcon className="w-6 h-6 mr-3" />
                        <div>
                            <span className="font-bold">Perhatian:</span> Ada {lowStockCount} barang yang stoknya menipis (di bawah minimum).
                        </div>
                    </div>
                )}

                <div className="card-style">
                    <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-6 gap-4">
                        <div className="flex flex-col md:flex-row flex-wrap items-start md:items-center gap-4 flex-1 w-full lg:w-auto">
                            <div className="w-full md:w-64 flex-shrink-0">
                                <div className="relative">
                                    <Input
                                        placeholder="Cari nama atau kode barang..."
                                        value={searchDraft}
                                        onChange={(e) => {
                                            const next = e.target.value
                                            setSearchDraft(next)
                                            if (!String(next || '').trim()) {
                                                setSearch('')
                                                setPage(1)
                                                const params = new URLSearchParams(searchParams.toString())
                                                params.delete('search')
                                                router.replace(`${pathname}?${params.toString()}`)
                                            }
                                        }}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                applySearch()
                                            }
                                        }}
                                        className="input-style pr-10"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => applySearch()}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                                        aria-label="Cari"
                                    >
                                        <MagnifyingGlassIcon className="h-5 w-5" />
                                    </button>
                                </div>
                            </div>
                            <select
                                value={selectedCategory}
                                onChange={(e) => setSelectedCategory(e.target.value)}
                                className="w-full md:w-48 input-style"
                            >
                                <option value="ALL">Semua Kategori</option>
                                {categories.map((cat) => (
                                    <option key={cat} value={cat}>{cat}</option>
                                ))}
                            </select>
                        </div>
                        <div className="flex gap-2 w-full lg:w-auto">
                            <Button
                                onClick={handleRefresh}
                                variant="outline"
                                size="icon"
                                className="rounded-full"
                                title="Refresh data"
                                aria-label="Refresh data"
                            >
                                <ArrowPathIcon className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
                            </Button>
                            <Button onClick={handleExport} variant="destructive" className="flex items-center justify-center gap-2 whitespace-nowrap w-full lg:w-auto rounded-full">
                                <PrinterIcon className="w-5 h-5 mr-1" />
                                Export PDF
                            </Button>
                            <Button
                              onClick={() => {
                                setIsAddModalOpen(true);
                                setImageFile(null);
                                setPreviewUrl(null);
                              }}
                              className="fixed bottom-6 right-6 w-14 h-14 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center z-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
                              title="Tambah Barang"
                              size="icon"
                            >
                              <PlusIcon className="w-8 h-8" />
                            </Button>
                        </div>
                    </div>

                    <div className="md:hidden space-y-3">
                        {loading ? (
                            Array.from({ length: 4 }).map((_, i) => (
                                <div key={i} className="rounded-2xl border border-gray-100 bg-white p-4 space-y-3">
                                    <Skeleton className="h-4 w-32" />
                                    <Skeleton className="h-4 w-40" />
                                    <Skeleton className="h-4 w-24" />
                                </div>
                            ))
                        ) : data.length === 0 ? (
                            <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/50 p-6 text-center text-sm text-gray-500">
                                Tidak ada barang
                            </div>
                        ) : (
                            data.map((item) => {
                                const total = (item.stock || 0) * (item.price || 0);
                                const isLow = item.stock <= item.minStock;
                                return (
                                    <div
                                        key={item.id}
                                        onClick={() => handleDetail(item)}
                                        className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm space-y-3 transition-colors hover:bg-gray-50/50"
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex items-center gap-3">
                                                <div className="w-12 h-12 bg-gray-100 rounded-md overflow-hidden flex items-center justify-center border">
                                                    {item.imageUrl ? (
                                                        <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <span className="text-[10px] text-gray-400">No Img</span>
                                                    )}
                                                </div>
                                                <div className="space-y-1">
                                                    <div className="font-semibold text-gray-900">{item.name}</div>
                                                    <div className="text-xs text-gray-500">{item.sku} • {item.category || '-'}</div>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2 text-xs">
                                            <div>
                                                <div className="text-gray-400">Stok Awal</div>
                                                <div className="font-semibold text-gray-900">{item.initialStock || 0} {item.unit}</div>
                                            </div>
                                            <div>
                                                <div className="text-gray-400">Sisa Stok</div>
                                                <div className={`font-semibold ${isLow ? 'text-red-600' : 'text-gray-900'}`}>
                                                    {item.stock} {item.unit}
                                                </div>
                                            </div>
                                            <div>
                                                <div className="text-gray-400">Harga</div>
                                                <div className="font-semibold text-gray-900">{new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(item.price || 0)}</div>
                                            </div>
                                            <div>
                                                <div className="text-gray-400">Nilai</div>
                                                <div className="font-semibold text-emerald-700">{new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(total)}</div>
                                            </div>
                                        </div>
                                        <div className="flex flex-wrap gap-2 pt-1">
                                            <Button size="sm" variant="outline" className="rounded-full" onClick={(e) => { e.stopPropagation(); handleTransaction(item); }}>
                                                Update Stok
                                            </Button>
                                            <Button size="sm" variant="outline" className="rounded-full" onClick={(e) => { e.stopPropagation(); handleDetail(item); }}>
                                                Detail
                                            </Button>
                                            <Button size="sm" variant="outline" className="rounded-full" onClick={(e) => { e.stopPropagation(); handleEdit(item); }}>
                                                Edit
                                            </Button>
                                            <Button size="sm" variant="destructive" className="rounded-full" onClick={(e) => { e.stopPropagation(); handleDelete(item); }}>
                                                Hapus
                                            </Button>
                                        </div>
                                    </div>
                                )
                            })
                        )}
                    </div>

                    <div className="hidden md:block overflow-hidden rounded-xl border border-gray-100">
                        <DataTable 
                            columns={columns} 
                            data={data} 
                            meta={{ onRowClick: handleDetail }}
                            isLoading={loading}
                            virtualize={{ enabled: true, rowHeight: 56, maxHeight: 60 }}
                        />
                    </div>

                    <div className="flex flex-col md:flex-row items-center justify-center md:justify-between gap-4 mt-6 pt-4 border-t border-gray-100">
                        <div className="text-sm text-gray-500">
                            Menampilkan <span className="font-medium text-gray-800">{Math.min((page - 1) * limit + 1, totalItems)}</span> - <span className="font-medium text-gray-800">{Math.min(page * limit, totalItems)}</span> dari <span className="font-medium text-gray-800">{totalItems}</span> data
                        </div>
                        <div className="flex space-x-2">
                            <button
                                onClick={() => setPage(page - 1)}
                                disabled={page === 1 || loading}
                                className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                Sebelumnya
                            </button>
                            <button
                                onClick={() => setPage(page + 1)}
                                disabled={page * limit >= totalItems || loading}
                                className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                Berikutnya
                            </button>
                        </div>
                    </div>
                </div>

                {/* Modals */}
                <TransactionModal
                    isOpen={isTxModalOpen}
                    onClose={() => setIsTxModalOpen(false)}
                    item={selectedItem}
                    onSuccess={fetchData}
                />

                <EditModal 
                    isOpen={isEditModalOpen}
                    onClose={() => setIsEditModalOpen(false)}
                    item={selectedItem}
                    onSuccess={fetchData}
                />

                <DetailModal
                    isOpen={isDetailModalOpen}
                    onClose={() => setIsDetailModalOpen(false)}
                    item={selectedItem}
                />

                <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
                    <DialogContent className="w-[90%] max-w-2xl max-h-[90vh] p-0 overflow-hidden flex flex-col [&>button.absolute]:hidden">
                        <ModalHeader
                            title="Tambah Barang Baru"
                            variant="emerald"
                            icon={<ArchiveBoxIcon className="h-5 w-5 text-white" />}
                            onClose={() => setIsAddModalOpen(false)}
                        />
                        <form onSubmit={handleAddItem} className="flex flex-col flex-1 min-h-0">
                            <ModalContentWrapper className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1 min-h-0 overflow-y-auto">
                                <div className="md:col-span-2">
                                    <Label>Foto Barang</Label>
                                    <ImageUpload onFileChange={handleFileChange} previewUrl={previewUrl} />
                                </div>
                                <div>
                                    <Label>Tanggal</Label>
                                    <Input 
                                        type="date" 
                                        name="date" 
                                        defaultValue={format(new Date(), 'yyyy-MM-dd')} 
                                        required 
                                    />
                                </div>
                                <div>
                                    <Label>Kode (SKU)</Label>
                                    <Input name="sku" required />
                                </div>
                                <div>
                                    <Label>Nama Barang</Label>
                                    <Input name="name" required />
                                </div>
                                <div>
                                    <Label>Satuan</Label>
                                    <Input name="unit" placeholder="Pcs, Kg, Liter" required />
                                </div>
                                <div>
                                    <Label>Kategori</Label>
                                    <Input name="category" placeholder="Contoh: Sparepart" />
                                </div>
                                <div>
                                    <Label>Stok Awal</Label>
                                    <Input name="stock" type="number" defaultValue="0" />
                                </div>
                                <div>
                                    <Label>Harga Satuan (Rp)</Label>
                                    <FormattedNumberInput name="price" defaultValue={0} />
                                </div>
                                <div>
                                    <Label>Min. Stok (Alert)</Label>
                                    <Input name="minStock" type="number" defaultValue="5" />
                                </div>
                            </ModalContentWrapper>
                            <ModalFooter className="sm:justify-between">
                                <Button type="button" variant="outline" onClick={() => setIsAddModalOpen(false)} className="rounded-full">
                                    <XMarkIcon className="h-4 w-4 mr-2" />
                                    Batal
                                </Button>
                                <Button type="submit" className="rounded-full bg-emerald-600 hover:bg-emerald-700">
                                    <CheckIcon className="h-4 w-4 mr-2" />
                                    Simpan
                                </Button>
                            </ModalFooter>
                        </form>
                    </DialogContent>
                </Dialog>

                {/* Crop Modal (Reused for Add Item) */}
                <Dialog open={isCropping} onOpenChange={setIsCropping}>
                    <DialogContent className="max-w-xl p-0 overflow-hidden flex flex-col [&>button.absolute]:hidden">
                        <ModalHeader
                            title="Potong Gambar"
                            variant="emerald"
                            icon={<ArchiveBoxIcon className="h-5 w-5 text-white" />}
                            onClose={() => { setIsCropping(false); setImageFile(null); setPreviewUrl(null); }}
                        />
                        <div className="flex justify-center bg-black/5 p-4 rounded-lg overflow-auto max-h-[60vh]">
                            {previewUrl && (
                                <ReactCrop
                                    crop={crop}
                                    onChange={(_, percentCrop) => setCrop(percentCrop)}
                                    onComplete={(c) => setCompletedCrop(c)}
                                    aspect={1} 
                                >
                                    <img 
                                        ref={imgRef} 
                                        src={previewUrl} 
                                        onLoad={onImageLoad} 
                                        alt="Crop preview" 
                                    />
                                </ReactCrop>
                            )}
                        </div>
                        <ModalFooter className="sm:justify-between">
                            <Button variant="outline" onClick={() => { setIsCropping(false); setImageFile(null); setPreviewUrl(null); }} className="rounded-full">
                                <XMarkIcon className="h-4 w-4 mr-2" />
                                Batal
                            </Button>
                            <Button onClick={handleCropConfirm} className="rounded-full bg-emerald-600 hover:bg-emerald-700">
                                <CheckIcon className="h-4 w-4 mr-2" />
                                Potong & Simpan
                            </Button>
                        </ModalFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </RoleGate>
    );
}
