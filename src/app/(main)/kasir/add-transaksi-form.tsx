'use client';

import { useState, useRef, SyntheticEvent, useEffect, useMemo } from 'react';
import toast from 'react-hot-toast';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import ImageUpload from '@/components/ui/ImageUpload';
import { convertImageFileToWebp } from '@/lib/image-webp';
import ReactCrop, { type Crop, centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { KasTransaksi } from '@/types/kasir';
import { ArchiveBoxIcon, BuildingOfficeIcon, CheckIcon, ChevronDownIcon, DocumentDuplicateIcon, MagnifyingGlassIcon, TagIcon, TruckIcon, UserIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { ModalContentWrapper, ModalFooter, ModalHeader } from '@/components/ui/modal-elements';

interface AddTransaksiFormProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (data: any) => Promise<void>;
  selectedDate: string;
  initialData?: KasTransaksi | null;
}

const AddTransaksiForm: React.FC<AddTransaksiFormProps> = ({ isOpen, onClose, onConfirm, selectedDate, initialData }) => {
  const [tipe, setTipe] = useState('PENGELUARAN');
  const [deskripsi, setDeskripsi] = useState('');
  const [jumlah, setJumlah] = useState('');
  const [keterangan, setKeterangan] = useState('');
  const [transactionDate, setTransactionDate] = useState<string>(selectedDate);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [kendaraanList, setKendaraanList] = useState<any[]>([]);
  const [kebunList, setKebunList] = useState<any[]>([]);
  const [kendaraanPlatNomor, setKendaraanPlatNomor] = useState<string>('');
  const [kebunId, setKebunId] = useState<string>('');
  const [supirList, setSupirList] = useState<any[]>([]);
  const [karyawanId, setKaryawanId] = useState<string>('');
  const [kategori, setKategori] = useState<string>('UMUM');
  const [tagKendaraanPlats, setTagKendaraanPlats] = useState<string[]>([])
  const [tagKebunIds, setTagKebunIds] = useState<string[]>([])
  const [tagKaryawanIds, setTagKaryawanIds] = useState<string[]>([])
  const [tagPerusahaanIds, setTagPerusahaanIds] = useState<string[]>([])
  const [isTagPickerOpen, setIsTagPickerOpen] = useState(false)
  const [searchKendaraan, setSearchKendaraan] = useState('')
  const [searchKebun, setSearchKebun] = useState('')
  const [searchKaryawan, setSearchKaryawan] = useState('')
  const [searchPerusahaan, setSearchPerusahaan] = useState('')
  const [perusahaanList, setPerusahaanList] = useState<any[]>([])
  const [karyawanPickerOpen, setKaryawanPickerOpen] = useState(false)
  const [karyawanPickerQuery, setKaryawanPickerQuery] = useState('')
  const [kategoriOptions, setKategoriOptions] = useState<Array<{ code: string; label: string; tipe: string }>>([])
  const [tagLoadErrors, setTagLoadErrors] = useState<{ kendaraan?: string; kebun?: string; karyawan?: string; perusahaan?: string }>({})

  const formatRupiah = (value: string) => {
    const numberString = value.replace(/[^0-9]/g, '');
    const split = numberString.split(',');
    const sisa = split[0].length % 3;
    let rupiah = split[0].substr(0, sisa);
    const ribuan = split[0].substr(sisa).match(/\d{3}/gi);

    if (ribuan) {
      const separator = sisa ? '.' : '';
      rupiah += separator + ribuan.join('.');
    }

    rupiah = split[1] !== undefined ? rupiah + ',' + split[1] : rupiah;
    return rupiah ? 'Rp ' + rupiah : '';
  };

  const handleJumlahChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatRupiah(e.target.value);
    setJumlah(formatted);
  };

  // Image Upload & Crop State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isCropping, setIsCropping] = useState(false);
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<Crop>();
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (isOpen) {
        if (initialData) {
            setTipe(initialData.tipe);
            setDeskripsi(initialData.deskripsi);
            setJumlah(formatRupiah(initialData.jumlah.toString()));
            setKeterangan(initialData.keterangan || '');
            setPreview(initialData.gambarUrl || null);
            setSelectedFile(null); // Reset file selection
            try {
              const d = new Date(initialData.date);
              setTransactionDate(d.toISOString().split('T')[0]);
            } catch {
              setTransactionDate(selectedDate);
            }
            setKendaraanPlatNomor(initialData.kendaraanPlatNomor || '');
            setKebunId(initialData.kebunId ? initialData.kebunId.toString() : '');
            setKaryawanId(initialData.karyawanId ? initialData.karyawanId.toString() : '');
            setKategori(initialData.kategori ? initialData.kategori.toUpperCase() : 'UMUM');
            setTagKendaraanPlats(initialData.kendaraanPlatNomor ? [initialData.kendaraanPlatNomor] : [])
            setTagKebunIds(initialData.kebunId ? [initialData.kebunId.toString()] : [])
            setTagKaryawanIds(initialData.karyawanId ? [initialData.karyawanId.toString()] : [])
            setKaryawanPickerOpen(false)
            setKaryawanPickerQuery('')
            setIsTagPickerOpen(false)
        } else {
            setTipe('PENGELUARAN');
            setDeskripsi('');
            setJumlah('');
            setKeterangan('');
            setPreview(null);
            setSelectedFile(null);
            setTransactionDate(selectedDate);
            setKendaraanPlatNomor('');
            setKebunId('');
            setKaryawanId('');
            setKategori('UMUM');
            setTagKendaraanPlats([])
            setTagKebunIds([])
            setTagKaryawanIds([])
            setKaryawanPickerOpen(false)
            setKaryawanPickerQuery('')
            setIsTagPickerOpen(false)
        }
        setTagLoadErrors({})
    }
  }, [isOpen, initialData, selectedDate]);

  useEffect(() => {
    const fetchKategori = async () => {
      try {
        const res = await fetch(`/api/kas-kategori?tipe=${encodeURIComponent(tipe)}`)
        if (!res.ok) return
        const data = await res.json()
        if (!Array.isArray(data)) return
        const mapped = data
          .map((r: any) => ({
            code: String(r?.code || '').toUpperCase(),
            label: String(r?.label || r?.code || '').trim() || String(r?.code || '').toUpperCase(),
            tipe: String(r?.tipe || '').toUpperCase(),
          }))
          .filter((r: any) => !!r.code)
        setKategoriOptions(mapped)
      } catch {
        setKategoriOptions([])
      }
    }
    if (isOpen) fetchKategori()
  }, [isOpen, tipe])

  useEffect(() => {
    if (!isOpen) return
    if (kategori === 'HUTANG_KARYAWAN' || kategori === 'PEMBAYARAN_HUTANG') return
    if (kategoriOptions.length === 0) return
    const exists = kategoriOptions.some((k) => k.code === String(kategori || '').toUpperCase())
    if (!exists) setKategori('UMUM')
  }, [isOpen, kategori, kategoriOptions])

  const countMultiGroups = (sizes: number[]) => sizes.filter((n) => n > 1).length

  const splitAmountEvenly = (total: number, count: number) => {
    const totalInt = Math.round(total)
    const base = Math.floor(totalInt / count)
    const remainder = totalInt % count
    const parts = Array.from({ length: count }, (_, i) => base + (i < remainder ? 1 : 0))
    return parts
  }

  const toggleInList = (list: string[], value: string, checked: boolean) => {
    if (!value) return list
    if (checked) {
      if (list.includes(value)) return list
      return [...list, value]
    }
    return list.filter((v) => v !== value)
  }

  const selectedKaryawanName = useMemo(() => {
    const id = Number(karyawanId)
    if (!id) return ''
    const found = supirList.find((u: any) => Number(u?.id) === id)
    return found?.name ? String(found.name) : ''
  }, [karyawanId, supirList])

  const selectedTagSummary = () => {
    const kendaraan = tagKendaraanPlats.filter(Boolean)
    const kebunIds = tagKebunIds.filter(Boolean)
    const karyawanIds = tagKaryawanIds.filter(Boolean)
    const perusahaanIds = tagPerusahaanIds.filter(Boolean)

    const total = kendaraan.length + kebunIds.length + karyawanIds.length + perusahaanIds.length
    if (total === 0) return 'Belum ada tag'

    const kebunNameById = new Map<string, string>()
    for (const k of kebunList) {
      const id = String((k as any)?.id ?? '')
      const name = String((k as any)?.name || (k as any)?.nama || '').trim()
      if (id && name) kebunNameById.set(id, name)
    }
    const karyawanNameById = new Map<string, string>()
    for (const u of supirList) {
      const id = String((u as any)?.id ?? '')
      const name = String((u as any)?.name || '').trim()
      if (id && name) karyawanNameById.set(id, name)
    }
    const perusahaanNameById = new Map<string, string>()
    for (const p of perusahaanList) {
      const id = String((p as any)?.id ?? '')
      const name = String((p as any)?.name || '').trim()
      if (id && name) perusahaanNameById.set(id, name)
    }

    const fmtMany = (label: string, items: string[]) => {
      if (items.length === 0) return ''
      const first = items[0]
      if (items.length === 1) return `${label}: ${first}`
      return `${label}: ${first} (+${items.length - 1})`
    }

    const parts: string[] = []
    const kendaraanLabel = fmtMany('Kendaraan', kendaraan)
    if (kendaraanLabel) parts.push(kendaraanLabel)

    const kebunNames = kebunIds.map((id) => kebunNameById.get(id) || id)
    const kebunLabel = fmtMany('Kebun', kebunNames)
    if (kebunLabel) parts.push(kebunLabel)

    const karyawanNames = karyawanIds.map((id) => karyawanNameById.get(id) || id)
    const karyawanLabel = fmtMany('Karyawan', karyawanNames)
    if (karyawanLabel) parts.push(karyawanLabel)

    const perusahaanNames = perusahaanIds.map((id) => perusahaanNameById.get(id) || id)
    const perusahaanLabel = fmtMany('Perusahaan', perusahaanNames)
    if (perusahaanLabel) parts.push(perusahaanLabel)

    return parts.join(' • ')
  }

  useEffect(() => {
    const fetchLists = async () => {
      try {
        const [kendRes, kebunRes] = await Promise.all([
          fetch('/api/kendaraan/list'),
          fetch('/api/kebun?limit=1000'),
        ]);
        if (kendRes.ok) {
          const kendData = await kendRes.json();
          const list = Array.isArray(kendData?.data) ? kendData.data : Array.isArray(kendData) ? kendData : []
          setKendaraanList(list);
          setTagLoadErrors((prev) => ({ ...prev, kendaraan: undefined }))
        } else {
          setKendaraanList([])
          setTagLoadErrors((prev) => ({ ...prev, kendaraan: 'Gagal memuat kendaraan' }))
        }
        if (kebunRes.ok) {
          const kebunData = await kebunRes.json();
          const list = Array.isArray(kebunData?.data) ? kebunData.data : Array.isArray(kebunData) ? kebunData : []
          setKebunList(list);
          setTagLoadErrors((prev) => ({ ...prev, kebun: undefined }))
        } else {
          setKebunList([])
          setTagLoadErrors((prev) => ({ ...prev, kebun: 'Gagal memuat kebun' }))
        }
      } catch (e) {
        setKendaraanList([])
        setKebunList([])
        setTagLoadErrors((prev) => ({ ...prev, kendaraan: 'Gagal memuat kendaraan', kebun: 'Gagal memuat kebun' }))
      }
    };
    if (isOpen) fetchLists();
  }, [isOpen]);

  useEffect(() => {
    const fetchSupir = async () => {
      try {
        const res = await fetch('/api/users?limit=1000');
        if (res.ok) {
          const data = await res.json();
          setSupirList(Array.isArray(data?.data) ? data.data : []);
          setTagLoadErrors((prev) => ({ ...prev, karyawan: undefined }))
        } else {
          setSupirList([])
          setTagLoadErrors((prev) => ({ ...prev, karyawan: 'Gagal memuat karyawan' }))
        }
      } catch {
        setSupirList([])
        setTagLoadErrors((prev) => ({ ...prev, karyawan: 'Gagal memuat karyawan' }))
      }
    };
    if (isOpen) fetchSupir();
  }, [isOpen]);

  useEffect(() => {
    const fetchPerusahaan = async () => {
      try {
        const res = await fetch('/api/perusahaan?limit=1000')
        if (res.ok) {
          const data = await res.json()
          setPerusahaanList(Array.isArray(data?.data) ? data.data : [])
          setTagLoadErrors((prev) => ({ ...prev, perusahaan: undefined }))
        } else {
          setPerusahaanList([])
          setTagLoadErrors((prev) => ({ ...prev, perusahaan: 'Gagal memuat perusahaan' }))
        }
      } catch {
        setPerusahaanList([])
        setTagLoadErrors((prev) => ({ ...prev, perusahaan: 'Gagal memuat perusahaan' }))
      }
    }
    if (isOpen) fetchPerusahaan()
  }, [isOpen])

  const handleFileChange = (file: File | null) => {
      if (file) {
          const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
          const ext = String(file.name || '').toLowerCase().split('.').pop()
          const looksHeic = file.type === 'image/heic' || file.type === 'image/heif' || ext === 'heic' || ext === 'heif'
          if (looksHeic || (file.type && !allowedTypes.includes(file.type))) {
              toast.error('Format gambar harus JPG/PNG/WEBP')
              return
          }
          setSelectedFile(file);
          const reader = new FileReader();
          reader.onloadend = () => {
              setPreview(reader.result as string);
              setIsCropping(true);
          };
          reader.readAsDataURL(file);
      } else {
          setSelectedFile(null);
          setPreview(null);
      }
  };

  function onImageLoad(e: SyntheticEvent<HTMLImageElement>) {
      const { width, height } = e.currentTarget;
      // Set initial crop to 90% centered
      setCrop({
          unit: '%',
          width: 90,
          height: 90,
          x: 5,
          y: 5
      });
  }

  async function getCroppedImg(
    image: HTMLImageElement,
    crop: Crop,
    fileName: string,
  ): Promise<File> {
    const canvas = document.createElement('canvas');
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;
    
    const srcCropW = Math.floor(crop.width * scaleX);
    const srcCropH = Math.floor(crop.height * scaleY);
    const maxDimension = 1280;
    const resizeScale = Math.min(1, maxDimension / Math.max(srcCropW, srcCropH));

    canvas.width = Math.max(1, Math.floor(srcCropW * resizeScale));
    canvas.height = Math.max(1, Math.floor(srcCropH * resizeScale));
    
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      throw new Error('No 2d context');
    }

    ctx.imageSmoothingEnabled = true;
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
        0.82,
      );
    });
  }

  const handleCropConfirm = async () => {
      if (completedCrop?.width && completedCrop?.height && imgRef.current) {
          try {
              const croppedImageFile = await getCroppedImg(
                  imgRef.current,
                  completedCrop,
                  selectedFile?.name || 'image.webp'
              );
              setSelectedFile(croppedImageFile);
              
              // Create a new preview for the cropped image
              const reader = new FileReader();
              reader.onloadend = () => {
                  setPreview(reader.result as string);
              };
              reader.readAsDataURL(croppedImageFile);
              setIsCropping(false);
          } catch (e) {
              console.error('Error cropping image:', e);
              setIsCropping(false);
          }
      } else {
          setIsCropping(false);
      }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    if (!tipe || !deskripsi || !jumlah) {
        toast.error('Tipe, Deskripsi, dan Jumlah wajib diisi.');
        setIsSubmitting(false);
        return;
    }

    const cleanJumlah = jumlah.replace(/[^0-9]/g, '');
    const jumlahFloat = parseFloat(cleanJumlah);
    if (isNaN(jumlahFloat)) {
        toast.error('Jumlah harus berupa angka yang valid.');
        setIsSubmitting(false);
        return;
    }

    try {
      let finalGambarUrl = initialData?.gambarUrl || '';

      if (selectedFile) {
          // Use FormData for file upload instead of separate API call
          const formData = new FormData();
          const converted = await convertImageFileToWebp(selectedFile, { quality: 0.9, maxDimension: 1920 })
          formData.append('file', converted);
          
          const uploadRes = await fetch('/api/upload', {
              method: 'POST',
              body: formData,
              cache: 'no-store',
              credentials: 'include',
          });

          if (uploadRes.ok) {
              const uploadData = await uploadRes.json();
              if (uploadData.success) {
                  finalGambarUrl = uploadData.url;
              } else {
                  console.error('Upload failed:', uploadData.error);
                  toast.error(`Gagal upload gambar: ${uploadData.error}`);
              }
          } else {
             console.error('Upload request failed:', uploadRes.statusText);
             toast.error('Gagal upload gambar: Server Error');
          }
      }

      const cleanedTagKendaraan = tagKendaraanPlats.filter(Boolean)
      const cleanedTagKebun = tagKebunIds.filter(Boolean)
      const cleanedTagKaryawan = tagKaryawanIds.filter(Boolean)
      const cleanedTagPerusahaan = tagPerusahaanIds.filter(Boolean)

      if (kategori === 'HUTANG_KARYAWAN' || kategori === 'PEMBAYARAN_HUTANG') {
        const hasKaryawan = cleanedTagKaryawan.length > 0 || Boolean(karyawanId)
        if (!hasKaryawan) {
          toast.error('Kategori hutang wajib pilih karyawan.')
          setIsSubmitting(false)
          return
        }
        if (kategori === 'HUTANG_KARYAWAN' && tipe !== 'PENGELUARAN') {
          toast.error('Hutang karyawan harus bertipe Pengeluaran.')
          setIsSubmitting(false)
          return
        }
        if (kategori === 'PEMBAYARAN_HUTANG' && tipe !== 'PEMASUKAN') {
          toast.error('Pembayaran hutang harus bertipe Pemasukan.')
          setIsSubmitting(false)
          return
        }
      }

      if (initialData && countMultiGroups([cleanedTagKendaraan.length, cleanedTagKebun.length, cleanedTagKaryawan.length, cleanedTagPerusahaan.length]) > 0) {
        toast.error('Edit transaksi tidak mendukung pilih banyak tag. Gunakan transaksi terpisah.')
        setIsSubmitting(false)
        return
      }

      if (countMultiGroups([cleanedTagKendaraan.length, cleanedTagKebun.length, cleanedTagKaryawan.length, cleanedTagPerusahaan.length]) > 1) {
        toast.error('Pilih banyak tag hanya boleh untuk salah satu: Kendaraan atau Kebun atau Karyawan atau Perusahaan.')
        setIsSubmitting(false)
        return
      }

      const basePayload = {
        tipe,
        deskripsi,
        keterangan,
        gambarUrl: finalGambarUrl || undefined,
        date: transactionDate,
        kategori,
      }

      const withPerusahaanTag = (ket: string, perusahaanId?: string) => {
        const idStr = perusahaanId || cleanedTagPerusahaan[0]
        if (idStr) return `${ket ? ket : ''} [PERUSAHAAN:${idStr}]`.trim()
        return ket
      }

      if (cleanedTagKendaraan.length > 1) {
        const amounts = splitAmountEvenly(jumlahFloat, cleanedTagKendaraan.length)
        for (let i = 0; i < cleanedTagKendaraan.length; i++) {
          await onConfirm({
            ...basePayload,
            jumlah: amounts[i],
            kendaraanPlatNomor: cleanedTagKendaraan[i],
            kebunId: kebunId ? parseInt(kebunId) : undefined,
            karyawanId: karyawanId ? parseInt(karyawanId) : undefined,
            keterangan: withPerusahaanTag(keterangan),
          })
        }
      } else if (cleanedTagKebun.length > 1) {
        const amounts = splitAmountEvenly(jumlahFloat, cleanedTagKebun.length)
        for (let i = 0; i < cleanedTagKebun.length; i++) {
          await onConfirm({
            ...basePayload,
            jumlah: amounts[i],
            kebunId: parseInt(cleanedTagKebun[i]),
            kendaraanPlatNomor: kendaraanPlatNomor || undefined,
            karyawanId: karyawanId ? parseInt(karyawanId) : undefined,
            keterangan: withPerusahaanTag(keterangan),
          })
        }
      } else if (cleanedTagKaryawan.length > 1) {
        const amounts = splitAmountEvenly(jumlahFloat, cleanedTagKaryawan.length)
        for (let i = 0; i < cleanedTagKaryawan.length; i++) {
          await onConfirm({
            ...basePayload,
            jumlah: amounts[i],
            karyawanId: parseInt(cleanedTagKaryawan[i]),
            kendaraanPlatNomor: kendaraanPlatNomor || undefined,
            kebunId: kebunId ? parseInt(kebunId) : undefined,
            keterangan: withPerusahaanTag(keterangan),
          })
        }
      } else if (cleanedTagPerusahaan.length > 1) {
        const amounts = splitAmountEvenly(jumlahFloat, cleanedTagPerusahaan.length)
        for (let i = 0; i < cleanedTagPerusahaan.length; i++) {
          await onConfirm({
            ...basePayload,
            jumlah: amounts[i],
            kendaraanPlatNomor: kendaraanPlatNomor || undefined,
            kebunId: kebunId ? parseInt(kebunId) : undefined,
            karyawanId: karyawanId ? parseInt(karyawanId) : undefined,
            keterangan: withPerusahaanTag(keterangan, cleanedTagPerusahaan[i]),
          })
        }
      } else {
        await onConfirm({
          ...basePayload,
          jumlah: jumlahFloat,
          kendaraanPlatNomor: cleanedTagKendaraan[0] || kendaraanPlatNomor || undefined,
          kebunId: cleanedTagKebun[0] ? parseInt(cleanedTagKebun[0]) : kebunId ? parseInt(kebunId) : undefined,
          karyawanId: cleanedTagKaryawan[0] ? parseInt(cleanedTagKaryawan[0]) : karyawanId ? parseInt(karyawanId) : undefined,
          keterangan: withPerusahaanTag(keterangan),
        })
      }

      // Reset form (will be handled by useEffect on next open, but good practice)
      if (!initialData) {
        setDeskripsi('');
        setJumlah('');
        setKeterangan('');
        setSelectedFile(null);
        setPreview(null);
        setTransactionDate(selectedDate);
      }
      onClose();

    } catch (error) {
      console.error(error);
      const message =
        error instanceof Error
          ? error.message
          : 'Gagal menyimpan transaksi'
      const isNetworkError =
        typeof message === 'string' &&
        (message.toLowerCase().includes('failed to fetch') || message.toLowerCase().includes('networkerror'))
      toast.error(
        isNetworkError
          ? 'Gagal menyimpan transaksi (koneksi bermasalah/offline).'
          : `Gagal menyimpan transaksi: ${message}`
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] p-0 overflow-hidden flex flex-col [&>button.absolute]:hidden">
          <ModalHeader
            title={initialData ? 'Edit Transaksi' : 'Tambah Transaksi'}
            variant="emerald"
            icon={<DocumentDuplicateIcon className="h-5 w-5 text-white" />}
            onClose={onClose}
          />
          <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
            <ModalContentWrapper className="grid gap-4 flex-1 min-h-0 overflow-y-auto no-scrollbar">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="tipe" className="text-left">Tipe</Label>
                <select 
                    id="tipe" 
                    value={tipe} 
                    onChange={(e) => setTipe(e.target.value)} 
                    className="input-style col-span-3"
                >
                    <option value="PEMASUKAN">Pemasukan</option>
                    <option value="PENGELUARAN">Pengeluaran</option>
                </select>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="kategori" className="text-left">Kategori</Label>
                <select 
                    id="kategori" 
                    value={kategori} 
                    onChange={(e) => {
                        const val = e.target.value;
                        setKategori(val);
                        if (val === 'HUTANG_KARYAWAN') {
                          setTipe('PENGELUARAN')
                          setKaryawanPickerOpen(true)
                          setKaryawanPickerQuery('')
                        } else if (val === 'PEMBAYARAN_HUTANG') {
                          setTipe('PEMASUKAN')
                          setKaryawanPickerOpen(true)
                          setKaryawanPickerQuery('')
                        } else {
                          setKaryawanPickerOpen(false)
                          setKaryawanPickerQuery('')
                        }
                    }} 
                    className="input-style col-span-3"
                >
                    {(kategoriOptions.length > 0 ? kategoriOptions : [
                      { code: 'UMUM', label: 'Umum', tipe: 'BOTH' },
                      { code: 'KEBUN', label: 'Kebun', tipe: 'BOTH' },
                      { code: 'KENDARAAN', label: 'Kendaraan', tipe: 'BOTH' },
                      { code: 'KARYAWAN', label: 'Karyawan', tipe: 'BOTH' },
                      { code: 'GAJI', label: 'Gaji', tipe: 'PENGELUARAN' },
                      { code: 'HUTANG_KARYAWAN', label: 'Hutang Karyawan', tipe: 'PENGELUARAN' },
                      { code: 'PEMBAYARAN_HUTANG', label: 'Pembayaran Hutang', tipe: 'PEMASUKAN' },
                    ]).map((k) => (
                      <option key={k.code} value={k.code}>{k.label}</option>
                    ))}
                </select>
              </div>
              {(kategori === 'HUTANG_KARYAWAN' || kategori === 'PEMBAYARAN_HUTANG') && (
                <div className="grid grid-cols-4 items-start gap-4">
                  <Label className="text-left mt-2">Karyawan</Label>
                  <div className="col-span-3 relative">
                    <button
                      type="button"
                      className="input-style w-full flex items-center justify-between gap-2"
                      onClick={() => setKaryawanPickerOpen((v) => !v)}
                    >
                      <div className="min-w-0 truncate text-left">
                        {selectedKaryawanName || 'Pilih karyawan...'}
                      </div>
                      <ChevronDownIcon className={`h-4 w-4 text-gray-600 shrink-0 transition-transform ${karyawanPickerOpen ? 'rotate-180' : 'rotate-0'}`} />
                    </button>

                    {karyawanPickerOpen && (
                      <div className="absolute z-50 mt-2 w-full rounded-xl border border-gray-200 bg-white shadow-lg overflow-hidden">
                        <div className="p-2 border-b border-gray-100">
                          <div className="relative">
                            <MagnifyingGlassIcon className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                              autoFocus
                              value={karyawanPickerQuery}
                              onChange={(e) => setKaryawanPickerQuery(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Escape') setKaryawanPickerOpen(false)
                              }}
                              className="input-style w-full pl-9 rounded-lg"
                              placeholder="Cari nama karyawan..."
                            />
                          </div>
                        </div>
                        <div className="max-h-56 overflow-y-auto">
                          {supirList
                            .filter((u: any) => {
                              const q = karyawanPickerQuery.trim().toLowerCase()
                              if (!q) return true
                              const name = String(u?.name || '').toLowerCase()
                              return name.includes(q)
                            })
                            .slice(0, 50)
                            .map((u: any) => {
                              const idVal = String(u?.id)
                              const active = idVal === karyawanId
                              return (
                                <button
                                  key={idVal}
                                  type="button"
                                  className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center justify-between gap-2 ${active ? 'bg-blue-50 text-blue-700' : 'text-gray-900'}`}
                                  onClick={() => {
                                    setKaryawanId(idVal)
                                    setTagKaryawanIds([idVal])
                                    setKaryawanPickerOpen(false)
                                    setKaryawanPickerQuery('')
                                  }}
                                >
                                  <div className="min-w-0 truncate">{u?.name || '-'}</div>
                                  {active ? <CheckIcon className="h-4 w-4" /> : null}
                                </button>
                              )
                            })}
                          {supirList.filter((u: any) => {
                            const q = karyawanPickerQuery.trim().toLowerCase()
                            if (!q) return true
                            const name = String(u?.name || '').toLowerCase()
                            return name.includes(q)
                          }).length === 0 && (
                            <div className="px-3 py-3 text-sm text-gray-500">Tidak ada hasil.</div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="tanggal" className="text-left">Tanggal</Label>
                <input
                  id="tanggal"
                  type="date"
                  value={transactionDate}
                  onChange={(e) => setTransactionDate(e.target.value)}
                  className="input-style col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="deskripsi" className="text-left">Deskripsi</Label>
                <input 
                    id="deskripsi" 
                    value={deskripsi} 
                    onChange={(e) => setDeskripsi(e.target.value)} 
                    className="input-style col-span-3" 
                    placeholder="Contoh: Beli Bensin, Uang Makan" 
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="jumlah" className="text-left">Jumlah</Label>
                <input 
                    id="jumlah" 
                    type="text" 
                    value={jumlah} 
                    onChange={handleJumlahChange} 
                    className="input-style col-span-3" 
                    placeholder="Rp 0" 
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="keterangan" className="text-left">Keterangan</Label>
                <input 
                    id="keterangan" 
                    value={keterangan} 
                    onChange={(e) => setKeterangan(e.target.value)} 
                    className="input-style col-span-3" 
                    placeholder="Opsional" 
                />
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-left">Tag</Label>
                <button
                  type="button"
                  className="input-style col-span-3 flex items-center justify-between gap-2"
                  onClick={() => {
                    setIsTagPickerOpen(true)
                  }}
                >
                  <div className="min-w-0 truncate text-left text-sm text-gray-900">{selectedTagSummary()}</div>
                  <TagIcon className="h-4 w-4 text-emerald-600 shrink-0" />
                </button>
              </div>

              <div className="grid grid-cols-4 items-start gap-4">
                <Label className="text-left mt-2">Bukti Foto</Label>
                <div className="col-span-3">
                    <ImageUpload onFileChange={handleFileChange} previewUrl={preview} />
                </div>
              </div>
            </ModalContentWrapper>
            <ModalFooter>
              <Button type="button" variant="outline" onClick={onClose} className="w-full sm:w-auto rounded-full">
                <XMarkIcon className="h-4 w-4 mr-2" />
                Batal
              </Button>
              <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto rounded-full bg-emerald-600 hover:bg-emerald-700">
                <CheckIcon className="h-4 w-4 mr-2" />
                {isSubmitting ? 'Menyimpan...' : 'Simpan'}
              </Button>
            </ModalFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isTagPickerOpen} onOpenChange={setIsTagPickerOpen}>
        <DialogContent className="w-[95vw] sm:w-auto sm:max-w-[650px] max-h-[92vh] p-0 overflow-hidden flex flex-col [&>button.absolute]:hidden">
          <ModalHeader
            title="Pilih Tag"
            subtitle={selectedTagSummary()}
            variant="emerald"
            icon={<TagIcon className="h-5 w-5 text-white" />}
            onClose={() => setIsTagPickerOpen(false)}
          />
          <ModalContentWrapper className="space-y-4 flex-1 min-h-0 overflow-y-auto no-scrollbar">
            <div className="rounded-xl border border-gray-100 p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <TruckIcon className="h-4 w-4 text-gray-700" />
                  <div className="text-sm font-semibold text-gray-900">Kendaraan</div>
                </div>
                <div className="text-xs text-gray-500">{tagKendaraanPlats.length} dipilih</div>
              </div>
              {tagLoadErrors.kendaraan ? <div className="mt-2 text-xs text-red-600">{tagLoadErrors.kendaraan}</div> : null}
              <div className="mt-2 relative">
                <MagnifyingGlassIcon className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  value={searchKendaraan}
                  onChange={(e) => setSearchKendaraan(e.target.value)}
                  className="input-style w-full pl-9"
                  placeholder="Cari plat / merk..."
                />
              </div>
              <div className="mt-3 max-h-44 overflow-y-auto pr-1 space-y-2">
                {kendaraanList.length === 0 ? (
                  <div className="px-2 py-2 text-sm text-gray-500">Tidak ada data kendaraan</div>
                ) : kendaraanList
                  .filter((k: any) => {
                    const q = searchKendaraan.trim().toLowerCase()
                    if (!q) return true
                    const plat = String(k?.platNomor || '').toLowerCase()
                    const merk = String(k?.merk || '').toLowerCase()
                    return plat.includes(q) || merk.includes(q)
                  })
                  .map((k: any) => {
                    const plat = String(k?.platNomor || '')
                    const checked = tagKendaraanPlats.includes(plat)
                    return (
                      <button
                        key={plat}
                        type="button"
                        onClick={() => setTagKendaraanPlats(prev => toggleInList(prev, plat, !checked))}
                        className={`w-full flex items-center justify-between gap-3 rounded-lg px-2 py-2 hover:bg-gray-50 ${checked ? 'bg-emerald-50/60' : ''}`}
                      >
                        <div className="text-sm text-gray-900 text-left">
                          {plat} <span className="text-gray-500">({k?.merk || '-'})</span>
                        </div>
                        {checked ? <CheckIcon className="h-4 w-4 text-emerald-700" /> : <span className="h-4 w-4" />}
                      </button>
                    )
                  })}
              </div>
            </div>

            <div className="rounded-xl border border-gray-100 p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <ArchiveBoxIcon className="h-4 w-4 text-gray-700" />
                  <div className="text-sm font-semibold text-gray-900">Kebun</div>
                </div>
                <div className="text-xs text-gray-500">{tagKebunIds.length} dipilih</div>
              </div>
              {tagLoadErrors.kebun ? <div className="mt-2 text-xs text-red-600">{tagLoadErrors.kebun}</div> : null}
              <div className="mt-2 relative">
                <MagnifyingGlassIcon className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  value={searchKebun}
                  onChange={(e) => setSearchKebun(e.target.value)}
                  className="input-style w-full pl-9"
                  placeholder="Cari nama kebun..."
                />
              </div>
              <div className="mt-3 max-h-44 overflow-y-auto pr-1 space-y-2">
                {kebunList.length === 0 ? (
                  <div className="px-2 py-2 text-sm text-gray-500">Tidak ada data kebun</div>
                ) : kebunList
                  .filter((kb: any) => {
                    const q = searchKebun.trim().toLowerCase()
                    if (!q) return true
                    const name = String(kb?.name || kb?.nama || '').toLowerCase()
                    return name.includes(q)
                  })
                  .map((kb: any) => {
                    const idVal = String(kb?.id)
                    const label = String(kb?.name || kb?.nama || `Kebun #${kb?.id}`)
                    const checked = tagKebunIds.includes(idVal)
                    return (
                      <button
                        key={idVal}
                        type="button"
                        onClick={() => setTagKebunIds(prev => toggleInList(prev, idVal, !checked))}
                        className={`w-full flex items-center justify-between gap-3 rounded-lg px-2 py-2 hover:bg-gray-50 ${checked ? 'bg-emerald-50/60' : ''}`}
                      >
                        <div className="text-sm text-gray-900 text-left">{label}</div>
                        {checked ? <CheckIcon className="h-4 w-4 text-emerald-700" /> : <span className="h-4 w-4" />}
                      </button>
                    )
                  })}
              </div>
            </div>

            <div className="rounded-xl border border-gray-100 p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <UserIcon className="h-4 w-4 text-gray-700" />
                  <div className="text-sm font-semibold text-gray-900">Karyawan</div>
                </div>
                <div className="text-xs text-gray-500">{tagKaryawanIds.length} dipilih</div>
              </div>
              {tagLoadErrors.karyawan ? <div className="mt-2 text-xs text-red-600">{tagLoadErrors.karyawan}</div> : null}
              <div className="mt-2 relative">
                <MagnifyingGlassIcon className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  value={searchKaryawan}
                  onChange={(e) => setSearchKaryawan(e.target.value)}
                  className="input-style w-full pl-9"
                  placeholder="Cari nama karyawan..."
                />
              </div>
              <div className="mt-3 max-h-44 overflow-y-auto pr-1 space-y-2">
                {supirList.length === 0 ? (
                  <div className="px-2 py-2 text-sm text-gray-500">Tidak ada data karyawan</div>
                ) : supirList
                  .filter((u: any) => {
                    const q = searchKaryawan.trim().toLowerCase()
                    if (!q) return true
                    const name = String(u?.name || '').toLowerCase()
                    return name.includes(q)
                  })
                  .map((u: any) => {
                    const idVal = String(u?.id)
                    const checked = tagKaryawanIds.includes(idVal)
                    return (
                      <button
                        key={idVal}
                        type="button"
                        onClick={() => setTagKaryawanIds(prev => toggleInList(prev, idVal, !checked))}
                        className={`w-full flex items-center justify-between gap-3 rounded-lg px-2 py-2 hover:bg-gray-50 ${checked ? 'bg-emerald-50/60' : ''}`}
                      >
                        <div className="text-sm text-gray-900 text-left">{u?.name || '-'}</div>
                        {checked ? <CheckIcon className="h-4 w-4 text-emerald-700" /> : <span className="h-4 w-4" />}
                      </button>
                    )
                  })}
              </div>
            </div>

            <div className="rounded-xl border border-gray-100 p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <BuildingOfficeIcon className="h-4 w-4 text-gray-700" />
                  <div className="text-sm font-semibold text-gray-900">Perusahaan</div>
                </div>
                <div className="text-xs text-gray-500">{tagPerusahaanIds.length} dipilih</div>
              </div>
              {tagLoadErrors.perusahaan ? <div className="mt-2 text-xs text-red-600">{tagLoadErrors.perusahaan}</div> : null}
              <div className="mt-2 relative">
                <MagnifyingGlassIcon className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  value={searchPerusahaan}
                  onChange={(e) => setSearchPerusahaan(e.target.value)}
                  className="input-style w-full pl-9"
                  placeholder="Cari perusahaan..."
                />
              </div>
              <div className="mt-3 max-h-44 overflow-y-auto pr-1 space-y-2">
                {perusahaanList.length === 0 ? (
                  <div className="px-2 py-2 text-sm text-gray-500">Tidak ada data perusahaan</div>
                ) : perusahaanList
                  .filter((p: any) => {
                    const q = searchPerusahaan.trim().toLowerCase()
                    if (!q) return true
                    const name = String(p?.name || '').toLowerCase()
                    return name.includes(q)
                  })
                  .map((p: any) => {
                    const idVal = String(p?.id)
                    const checked = tagPerusahaanIds.includes(idVal)
                    return (
                      <button
                        key={idVal}
                        type="button"
                        onClick={() => setTagPerusahaanIds(prev => toggleInList(prev, idVal, !checked))}
                        className={`w-full flex items-center justify-between gap-3 rounded-lg px-2 py-2 hover:bg-gray-50 ${checked ? 'bg-emerald-50/60' : ''}`}
                      >
                        <div className="text-sm text-gray-900 text-left">{p?.name || `Perusahaan #${idVal}`}</div>
                        {checked ? <CheckIcon className="h-4 w-4 text-emerald-700" /> : <span className="h-4 w-4" />}
                      </button>
                    )
                  })}
              </div>
            </div>

            <div className="text-[11px] text-gray-500 leading-snug">
              Jika memilih lebih dari satu pada salah satu tag, transaksi otomatis dipecah menjadi beberapa transaksi agar laporan bisa membaca per item.
            </div>
          </ModalContentWrapper>
          <ModalFooter className="justify-end">
            <Button type="button" onClick={() => setIsTagPickerOpen(false)} className="rounded-full bg-emerald-600 hover:bg-emerald-700">
              Selesai
            </Button>
          </ModalFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isCropping} onOpenChange={setIsCropping}>
        <DialogContent className="w-[95vw] sm:w-auto max-w-4xl max-h-[92vh] p-0 overflow-hidden flex flex-col [&>button.absolute]:hidden">
            <ModalHeader
              title="Potong Gambar"
              variant="emerald"
              icon={<DocumentDuplicateIcon className="h-5 w-5 text-white" />}
              onClose={() => { setIsCropping(false); setPreview(null); setSelectedFile(null); }}
            />
            <div className="flex-1 min-h-0 flex justify-center items-start p-4 bg-gray-100 overflow-auto">
                {preview && (
                    <div className="w-full flex justify-center">
                        <ReactCrop
                            crop={crop}
                            onChange={(_, percentCrop) => setCrop(percentCrop)}
                            onComplete={(c) => setCompletedCrop(c)}
                            className="max-w-full max-h-[70vh]"
                        >
                            <img
                                ref={imgRef}
                                src={preview}
                                alt="Crop preview"
                                onLoad={onImageLoad}
                                className="max-h-[70vh] w-auto max-w-full object-contain"
                            />
                        </ReactCrop>
                    </div>
                )}
            </div>
            <ModalFooter className="flex-row flex-shrink-0 pb-[calc(16px+env(safe-area-inset-bottom))]">
                <Button type="button" variant="outline" onClick={() => { setIsCropping(false); setPreview(null); setSelectedFile(null); }} className="rounded-full">
                  <XMarkIcon className="h-4 w-4 mr-2" />
                  Batal
                </Button>
                <Button type="button" onClick={handleCropConfirm} className="rounded-full bg-emerald-600 hover:bg-emerald-700">
                  <CheckIcon className="h-4 w-4 mr-2" />
                  Potong & Simpan
                </Button>
            </ModalFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default AddTransaksiForm;
