'use client'

import { useState, useEffect, useRef, type ChangeEvent, type SyntheticEvent, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast';
import ReactCrop, { type Crop, centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import ImageUpload from '@/components/ui/ImageUpload';
import type { Timbangan, User as Supir, Kebun, Kendaraan, PabrikSawit } from '@prisma/client';
import { useAuth } from '@/components/AuthProvider';
import { DocumentDuplicateIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { ModalHeader, ModalFooter } from '@/components/ui/modal-elements'

type TimbanganWithKebun = Timbangan & { kebun: Kebun };

export default function TambahNotaSawitPage() {
  const { role } = useAuth();
  // --- States ---
  const [isLoading, setIsLoading] = useState(true);
  const [timbanganList, setTimbanganList] = useState<TimbanganWithKebun[]>([]);
  const [supirList, setSupirList] = useState<Supir[]>([]);
  const [kebunList, setKebunList] = useState<Kebun[]>([]);
  const [kendaraanList, setKendaraanList] = useState<Kendaraan[]>([]);
  const [pabrikSawitList, setPabrikSawitList] = useState<PabrikSawit[]>([]);
  
  const [selectedTimbangan, setSelectedTimbangan] = useState<TimbanganWithKebun | null>(null);
  const [potongan, setPotongan] = useState(0);
  const [beratTotal, setBeratTotal] = useState(0);
  const [totalPembayaran, setTotalPembayaran] = useState(0);
  const [tanggalBongkar, setTanggalBongkar] = useState<Date | null>(null);
  
  const [isManualInput, setIsManualInput] = useState(false);
  const [manualGross, setManualGross] = useState(0);
  const [manualTare, setManualTare] = useState(0);
  const [manualNet, setManualNet] = useState(0);

  const [timbanganGross, setTimbanganGross] = useState(0);
  const [timbanganTare, setTimbanganTare] = useState(0);

  const [hargaPerKg, setHargaPerKg] = useState(0);
  const [pph25, setPph25] = useState(0);
  const [pembayaranAktual, setPembayaranAktual] = useState<number | null>(null);
  const [isPembayaranAktualManual, setIsPembayaranAktualManual] = useState(false);
  const [statusPembayaran, setStatusPembayaran] = useState('BELUM_LUNAS');
  const [gambarNota, setGambarNota] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<Crop>();
  const [isCropping, setIsCropping] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const router = useRouter();
  const [draftLoaded, setDraftLoaded] = useState(false);

  const formatNumber = (value: number | string) => {
    if (typeof value === 'string') {
      value = parseFloat(value.replace(/\./g, '')) || 0;
    }
    return new Intl.NumberFormat('id-ID').format(value);
  };

  const parseNumber = (value: string) => {
    return parseFloat(value.replace(/\./g, '')) || 0;
  };

  const handleNumericChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const numericValue = parseNumber(value);

    switch (name) {
      case 'potongan':
        setPotongan(numericValue);
        break;
      case 'hargaPerKg':
        setHargaPerKg(numericValue);
        break;
      case 'manualGross':
        setManualGross(numericValue);
        break;
      case 'manualTare':
        setManualTare(numericValue);
        break;
      case 'timbanganGross':
        setTimbanganGross(numericValue);
        break;
      case 'timbanganTare':
        setTimbanganTare(numericValue);
        break;
      case 'pph25':
        setPph25(numericValue);
        break;
      case 'pembayaranAktual':
        if (value === '') {
            setPembayaranAktual(null);
            setIsPembayaranAktualManual(false); // Reset to auto if cleared
        } else {
            setPembayaranAktual(numericValue);
            setIsPembayaranAktualManual(true);
        }
        break;
      default:
        break;
    }
  };

  // --- Data Fetching ---
  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);
      try {
        const [timbanganRes, supirRes, kebunRes, kendaraanRes, pabrikRes] = await Promise.all([
          fetch('/api/timbangan/list'),
          fetch('/api/supir?limit=1000'),
          fetch('/api/kebun/list'),
          fetch('/api/kendaraan?limit=1000'),
          fetch('/api/pabrik-sawit?limit=1000'),
        ]);
        const timbanganData = await timbanganRes.json();
        const supirData = await supirRes.json();
        const kebunData = await kebunRes.json();
        const kendaraanData = await kendaraanRes.json();
        const pabrikData = await pabrikRes.json();

        setTimbanganList(timbanganData.data || timbanganData);
        setSupirList(supirData.data || []);
        setKebunList(kebunData.data || kebunData);
        setKendaraanList(kendaraanData.data || []);
        setPabrikSawitList(pabrikData.data || []);
      } catch (error) {
        console.error("Failed to fetch data", error);
        toast.error("Gagal memuat data form");
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('notaSawitDraft');
      if (raw) {
        const d = JSON.parse(raw);
        setIsManualInput(!!d.isManualInput);
        setPotongan(Number(d.potongan ?? 0));
        setManualGross(Number(d.manualGross ?? 0));
        setManualTare(Number(d.manualTare ?? 0));
        setTimbanganGross(Number(d.timbanganGross ?? 0));
        setTimbanganTare(Number(d.timbanganTare ?? 0));
        setHargaPerKg(Number(d.hargaPerKg ?? 0));
        setPph25(Number(d.pph25 ?? 0));
        setPembayaranAktual(d.pembayaranAktual ?? null);
        setIsPembayaranAktualManual(!!d.isPembayaranAktualManual);
        setStatusPembayaran(d.statusPembayaran ?? 'BELUM_LUNAS');
        if (d.tanggalBongkar) setTanggalBongkar(new Date(d.tanggalBongkar));
        if (d.selectedTimbanganId) {
          const t = timbanganList.find(x => x.id === Number(d.selectedTimbanganId)) || null;
          setSelectedTimbangan(t);
          if (t) { setTimbanganGross(t.grossKg); setTimbanganTare(t.tareKg); }
        }
      }
    } catch {}
    setDraftLoaded(true);
  }, [timbanganList]);

  useEffect(() => {
    if (!draftLoaded) return;
    const payload = {
      isManualInput,
      potongan,
      manualGross,
      manualTare,
      timbanganGross,
      timbanganTare,
      hargaPerKg,
      pph25,
      pembayaranAktual,
      isPembayaranAktualManual,
      statusPembayaran,
      tanggalBongkar,
      selectedTimbanganId: selectedTimbangan?.id ?? null,
    };
    const id = setTimeout(() => {
      try { localStorage.setItem('notaSawitDraft', JSON.stringify(payload)); } catch {}
    }, 400);
    return () => clearTimeout(id);
  }, [
    draftLoaded,
    isManualInput,
    potongan,
    manualGross,
    manualTare,
    timbanganGross,
    timbanganTare,
    hargaPerKg,
    pph25,
    pembayaranAktual,
    isPembayaranAktualManual,
    statusPembayaran,
    tanggalBongkar,
    selectedTimbangan
  ]);
  // --- Event Handlers ---
  const handleTimbanganChange = (e: ChangeEvent<HTMLSelectElement>) => {
    const timbanganId = Number(e.target.value);
    const timbangan = timbanganList.find(t => t.id === timbanganId) || null;
    setSelectedTimbangan(timbangan);
    if (timbangan) {
      setTimbanganGross(timbangan.grossKg);
      setTimbanganTare(timbangan.tareKg);
    } else {
      setTimbanganGross(0);
      setTimbanganTare(0);
    }
  };


  // --- Effects for Calculation ---
  useEffect(() => {
    const net = manualGross - manualTare;
    setManualNet(net > 0 ? net : 0);
  }, [manualGross, manualTare]);

  useEffect(() => {
    let currentNet = 0;
    if (isManualInput) {
        currentNet = manualNet;
    } else {
        currentNet = timbanganGross - timbanganTare;
    }
    const total = currentNet - potongan;
    setBeratTotal(total > 0 ? total : 0);
  }, [isManualInput, manualNet, timbanganGross, timbanganTare, potongan]);

  useEffect(() => {
    const pembayaran = beratTotal * hargaPerKg;
    setTotalPembayaran(pembayaran > 0 ? pembayaran : 0);
  }, [beratTotal, hargaPerKg]);

  const pph = totalPembayaran * 0.0025;
  const pembayaranSetelahPph = totalPembayaran - pph - pph25;

  useEffect(() => {
      if (!isPembayaranAktualManual) {
          setPembayaranAktual(pembayaranSetelahPph > 0 ? pembayaranSetelahPph : 0);
      }
  }, [pembayaranSetelahPph, isPembayaranAktualManual]);

  const handleFileChangeForCrop = (file: File | null) => {
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
        setIsCropping(true); // Open cropping dialog
      };
      reader.readAsDataURL(file);
    } else {
      setPreview(null);
      setGambarNota(null);
    }
  };

  function onImageLoad(e: SyntheticEvent<HTMLImageElement>) {
    const { width, height } = e.currentTarget;
    const crop = centerCrop(
      makeAspectCrop(
        {
          unit: '%',
          width: 90,
        },
        undefined as any, // Allow free crop, ignore aspect
        width,
        height,
      ),
      width,
      height,
    );
    // Force remove aspect if makeAspectCrop added it, or just construct crop manually
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
      const croppedImageFile = await getCroppedImg(
        imgRef.current,
        completedCrop,
        'cropped-nota.webp'
      );
      setGambarNota(croppedImageFile);
      // Create a new preview for the cropped image
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(croppedImageFile);
      setIsCropping(false);
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!formRef.current) return false;

    const formData = new FormData(formRef.current);

    if (isManualInput) {
      // Kebun tetap direkomendasikan diisi saat manual, tapi tidak wajib
      if (manualGross < 0) newErrors.manualGross = 'Berat bruto tidak boleh negatif.';
      if (manualTare < 0) newErrors.manualTare = 'Berat tara tidak boleh negatif.';
      if (manualGross < manualTare) newErrors.manualNet = 'Berat bruto tidak boleh lebih kecil dari tara.';
    } else {
      // Timbangan tidak wajib lagi
      if (timbanganGross < timbanganTare) newErrors.timbanganNet = 'Berat bruto tidak boleh lebih kecil dari tara.';
    }

    if (!formData.get('supirId')) newErrors.supirId = 'Supir harus dipilih.';
    if (!formData.get('kendaraanPlatNomor')) newErrors.kendaraanPlatNomor = 'Kendaraan harus dipilih.';
    if (!formData.get('pabrikSawitId')) newErrors.pabrikSawitId = 'Pabrik sawit harus dipilih.';
    if (!tanggalBongkar) newErrors.tanggalBongkar = 'Tanggal bongkar harus diisi.';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // --- Form Submission ---
  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!validateForm()) {
      toast.error('Harap periksa kembali semua field yang wajib diisi.');
      return;
    }

    setIsSubmitting(true);
    const loadingToast = toast.loading('Menyimpan data...');

    const formData = new FormData(e.currentTarget);
    const supirId = Number(formData.get('supirId'));
    const kendaraanPlatNomor = formData.get('kendaraanPlatNomor') as string;
    const pabrikSawitId = Number(formData.get('pabrikSawitId'));

    const data = new FormData();

    if (tanggalBongkar) {
      data.append('tanggalBongkar', tanggalBongkar.toISOString());
    }

    if (isManualInput) {
        const kebunId = Number(formData.get('kebunId'));
        data.append('supirId', String(supirId));
        data.append('potongan', String(potongan));
        data.append('kebunId', String(kebunId));
        data.append('grossKg', String(manualGross));
        data.append('tareKg', String(manualTare));
        data.append('isManual', 'true');
        data.append('kendaraanPlatNomor', kendaraanPlatNomor);
        data.append('pabrikSawitId', String(pabrikSawitId));
        data.append('hargaPerKg', String(hargaPerKg));
        data.append('statusPembayaran', statusPembayaran);
        data.append('pembayaranAktual', pembayaranAktual !== null ? String(pembayaranAktual) : '');
    } else if (selectedTimbangan) {
        const timbanganId = Number(formData.get('timbanganId'));
        data.append('timbanganId', String(timbanganId));
        data.append('supirId', String(supirId));
        data.append('potongan', String(potongan));
        data.append('isManual', 'false');
        data.append('kendaraanPlatNomor', kendaraanPlatNomor);
        data.append('pabrikSawitId', String(pabrikSawitId));
        data.append('hargaPerKg', String(hargaPerKg));
        data.append('pph25', String(pph25));
        data.append('statusPembayaran', statusPembayaran);
        data.append('grossKg', String(timbanganGross));
        data.append('tareKg', String(timbanganTare));
        data.append('kebunId', String(selectedTimbangan.kebunId));
        data.append('pembayaranAktual', pembayaranAktual !== null ? String(pembayaranAktual) : '');
    }

    if (gambarNota) {
      data.append('gambarNota', gambarNota);
    }

    try {
      const res = await fetch('/api/nota-sawit', {
        method: 'POST',
        body: data,
      });

      if (res.ok) {
        toast.success('Nota sawit berhasil dibuat!', { id: loadingToast });
        try { localStorage.removeItem('notaSawitDraft'); } catch {}
        router.push('/nota-sawit');
        router.refresh();
      } else {
        const errorData = await res.json();
        toast.error(`Gagal membuat nota: ${errorData.error}`, { id: loadingToast });
      }
    } catch (error) {
        console.error('Error submitting form:', error);
        toast.error('Terjadi kesalahan saat mengirim data.', { id: loadingToast });
    } finally {
        setIsSubmitting(false);
    }
  };

  // --- Render ---
  return (
    <main className="p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Tambah Nota Sawit Baru</h1>

        <div className="bg-white p-6 rounded-lg shadow-md">
          <form ref={formRef} onSubmit={handleSubmit} onInvalid={(e) => e.preventDefault()} noValidate>
            {/* --- Toggle Manual Input --- */}
            <div className="flex items-center mb-6">
                <input 
                    id="manual-input-toggle" 
                    type="checkbox" 
                    checked={isManualInput} 
                    onChange={(e) => setIsManualInput(e.target.checked)} 
                    className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="manual-input-toggle" className="ml-2 block text-sm text-gray-900">Input Berat Manual</label>
            </div>

            {/* --- Main Form Fields --- */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {isManualInput ? (
                <div>
                    <label htmlFor="kebunId" className="block text-sm font-medium text-gray-700 mb-2">Pilih Kebun</label>
                    <select name="kebunId" id="kebunId" className={`input-style w-full ${errors.kebunId ? 'border-red-500 focus-visible:ring-red-500' : ''}`}>
                        <option value="">-- Pilih Kebun --</option>
                        {kebunList.map((k) => (<option key={k.id} value={k.id}>{k.name}</option>))}
                    </select>
                    {errors.kebunId && <p className="mt-1 text-xs text-red-600 bg-red-50 px-2 py-1 rounded">{errors.kebunId}</p>}
                </div>
              ) : (
                <div>
                    <label htmlFor="timbanganId" className="block text-sm font-medium text-gray-700 mb-2">Pilih Timbangan</label>
                    <select name="timbanganId" id="timbanganId" className={`input-style w-full ${errors.timbanganId ? 'border-red-500 focus-visible:ring-red-500' : ''}`} onChange={handleTimbanganChange} value={selectedTimbangan?.id || ''}>
                        <option value="">-- Pilih Data Timbangan --</option>
                        {timbanganList.map((t) => (<option key={t.id} value={t.id}>{t.kebun.name} - {new Date(t.date).toLocaleDateString('id-ID')} (Netto: {t.netKg} Kg)</option>))}
                    </select>
                    {errors.timbanganId && <p className="mt-1 text-xs text-red-600 bg-red-50 px-2 py-1 rounded">{errors.timbanganId}</p>}
                </div>
              )}
              <div>
                <label htmlFor="supirId" className="block text-sm font-medium text-gray-700 mb-2">Pilih Supir</label>
                <select name="supirId" id="supirId" className={`input-style w-full ${errors.supirId ? 'border-red-500 focus-visible:ring-red-500' : ''}`}>
                  <option value="">-- Pilih Supir --</option>
                  {supirList.map((supir) => (<option key={supir.id} value={supir.id}>{supir.name}</option>))}
                </select>
                {errors.supirId && <p className="mt-1 text-xs text-red-600 bg-red-50 px-2 py-1 rounded">{errors.supirId}</p>}
              </div>
              <div>
                <label htmlFor="kendaraanPlatNomor" className="block text-sm font-medium text-gray-700 mb-2">Pilih Kendaraan</label>
                <select name="kendaraanPlatNomor" id="kendaraanPlatNomor" className={`input-style w-full ${errors.kendaraanPlatNomor ? 'border-red-500 focus-visible:ring-red-500' : ''}`}>
                  <option value="">-- Pilih Kendaraan --</option>
                  {kendaraanList.map((k) => (<option key={k.platNomor} value={k.platNomor}>{k.platNomor} - {k.merk}</option>))}
                </select>
                {errors.kendaraanPlatNomor && <p className="mt-1 text-xs text-red-600 bg-red-50 px-2 py-1 rounded">{errors.kendaraanPlatNomor}</p>}
              </div>
              <div>
                <label htmlFor="pabrikSawitId" className="block text-sm font-medium text-gray-700 mb-2">Pilih Pabrik Sawit</label>
                <select name="pabrikSawitId" id="pabrikSawitId" className={`input-style w-full ${errors.pabrikSawitId ? 'border-red-500 focus-visible:ring-red-500' : ''}`}>
                  <option value="">-- Pilih Pabrik Sawit --</option>
                  {pabrikSawitList.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
                </select>
                {errors.pabrikSawitId && <p className="mt-1 text-xs text-red-600 bg-red-50 px-2 py-1 rounded">{errors.pabrikSawitId}</p>}
              </div>
              <div>
                <label htmlFor="tanggalBongkar" className="block text-sm font-medium text-gray-700 mb-2">Tanggal Bongkar</label>
                <input type="date" name="tanggalBongkar" id="tanggalBongkar" required onChange={(e) => setTanggalBongkar(new Date(e.target.value))} className={`input-style w-full ${errors.tanggalBongkar ? 'border-red-500 focus-visible:ring-red-500' : ''}`} />
                {errors.tanggalBongkar && <p className="mt-1 text-xs text-red-600 bg-red-50 px-2 py-1 rounded">{errors.tanggalBongkar}</p>}
              </div>
            </div>

            {/* --- Rincian Berat --- */}
            <div className="mt-6 border-t pt-6">
                <h3 className="text-lg font-medium text-gray-800 mb-4">Rincian Berat</h3>
                {isManualInput ? (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div>
                            <label htmlFor="manualGross" className="block text-sm font-medium text-gray-700 mb-2">Berat Bruto (Kg)</label>
                            <input type="text" name="manualGross" id="manualGross" value={formatNumber(manualGross)} onChange={handleNumericChange} className={`input-style w-full ${errors.manualGross ? 'border-red-500 focus-visible:ring-red-500' : ''}`} />
                            {errors.manualGross && <p className="mt-1 text-xs text-red-600 bg-red-50 px-2 py-1 rounded">{errors.manualGross}</p>}
                        </div>
                        <div>
                            <label htmlFor="manualTare" className="block text-sm font-medium text-gray-700 mb-2">Berat Tara (Kg)</label>
                            <input type="text" name="manualTare" id="manualTare" value={formatNumber(manualTare)} onChange={handleNumericChange} className={`input-style w-full ${errors.manualTare ? 'border-red-500 focus-visible:ring-red-500' : ''}`} />
                            {errors.manualTare && <p className="mt-1 text-xs text-red-600 bg-red-50 px-2 py-1 rounded">{errors.manualTare}</p>}
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-500">Berat Netto</label>
                            <p className="mt-2 text-xl font-semibold">{manualNet.toLocaleString('id-ID')} Kg</p>
                            {errors.manualNet && <p className="mt-1 text-xs text-red-600 bg-red-50 px-2 py-1 rounded">{errors.manualNet}</p>}
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div>
                            <label htmlFor="timbanganGross" className="block text-sm font-medium text-gray-700 mb-2">Berat Bruto (Kg)</label>
                            <input type="text" name="timbanganGross" id="timbanganGross" value={formatNumber(timbanganGross)} onChange={handleNumericChange} className="input-style w-full" />
                        </div>
                        <div>
                            <label htmlFor="timbanganTare" className="block text-sm font-medium text-gray-700 mb-2">Berat Tara (Kg)</label>
                            <input type="text" name="timbanganTare" id="timbanganTare" value={formatNumber(timbanganTare)} onChange={handleNumericChange} className="input-style w-full" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-500">Berat Netto</label>
                            <p className="mt-2 text-xl font-semibold">{(timbanganGross - timbanganTare).toLocaleString('id-ID')} Kg</p>
                            {errors.timbanganNet && <p className="mt-1 text-xs text-red-600 bg-red-50 px-2 py-1 rounded">{errors.timbanganNet}</p>}
                        </div>
                    </div>
                )}
            </div>

            {/* --- Final Calculation --- */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                 <div>
                    <label htmlFor="potongan" className="block text-sm font-medium text-gray-700 mb-2">Potongan (Kg)</label>
                    <input type="text" name="potongan" id="potongan" value={formatNumber(potongan)} onChange={handleNumericChange} className="input-style w-full" placeholder="0"/>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-500">Berat Total</label>
                    <p className="mt-1 text-2xl font-bold">{beratTotal.toLocaleString('id-ID')} Kg</p>
                </div>
            </div>

            {/* --- Harga dan Status --- */}
            {role !== 'SUPIR' && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                  <div>
                    <label htmlFor="hargaPerKg" className="block text-sm font-medium text-gray-700 mb-2">Harga / Kg</label>
                    <input type="text" name="hargaPerKg" id="hargaPerKg" value={formatNumber(hargaPerKg)} onChange={handleNumericChange} className={`input-style w-full ${errors.hargaPerKg ? 'border-red-500 focus-visible:ring-red-500' : ''}`} />
                    {errors.hargaPerKg && <p className="mt-1 text-xs text-red-600 bg-red-50 px-2 py-1 rounded">{errors.hargaPerKg}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500">Total Pembayaran</label>
                    <p className="mt-1 text-2xl font-bold">Rp {totalPembayaran.toLocaleString('id-ID')}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
                  <div>
                    <label htmlFor="pph25" className="block text-sm font-medium text-gray-700 mb-2">PPh 25</label>
                    <input type="text" name="pph25" id="pph25" value={formatNumber(pph25)} onChange={handleNumericChange} className="input-style w-full" placeholder="0" />
                  </div>
                   <div>
                    <label className="block text-sm font-medium text-gray-500">PPh (0.25%)</label>
                    <p className="mt-1 text-xl font-semibold text-red-600">Rp {pph.toLocaleString('id-ID')}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500">Total Bayar Net</label>
                    <p className="mt-1 text-2xl font-bold text-green-700">Rp {pembayaranSetelahPph.toLocaleString('id-ID')}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                  <div>
                    <label htmlFor="statusPembayaran" className="block text-sm font-medium text-gray-700 mb-2">Status Pembayaran</label>
                    <select name="statusPembayaran" id="statusPembayaran" value={statusPembayaran} onChange={(e) => setStatusPembayaran(e.target.value)} className="input-style w-full">
                        <option value="BELUM_LUNAS">Belum Lunas</option>
                        <option value="LUNAS">Lunas</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="pembayaranAktual" className="block text-sm font-medium text-gray-700 mb-2">Pembayaran Aktual</label>
                    <input 
                      type="text" 
                      name="pembayaranAktual" 
                      id="pembayaranAktual" 
                      value={pembayaranAktual !== null ? formatNumber(pembayaranAktual) : ''} 
                      onChange={handleNumericChange} 
                      className="input-style w-full" 
                      placeholder="Kosongkan jika sama dengan Net" 
                    />
                  </div>
                </div>
              </>
            )}

            {/* --- Upload Gambar Nota --- */}
            <div className="mt-6 border-t pt-6">
                <h3 className="text-lg font-medium text-gray-800 mb-4">Gambar Nota</h3>
                <ImageUpload onFileChange={handleFileChangeForCrop} previewUrl={preview} />
            </div>

            {/* --- Submit Button --- */}
            <div className="mt-8 flex justify-end">
              <button type="submit" className="border border-green-500 bg-green-500 text-white hover:bg-green-600 py-2 px-6 rounded-md" disabled={isSubmitting}>
                {isSubmitting ? 'Menyimpan...' : 'Simpan Nota'}
              </button>
            </div>
          </form>
        </div>

        <Dialog open={isCropping} onOpenChange={setIsCropping}>
          <DialogContent className="max-w-4xl p-0 overflow-hidden [&>button.absolute]:hidden">
            <ModalHeader
              title="Potong Gambar"
              variant="emerald"
              icon={<DocumentDuplicateIcon className="h-5 w-5 text-white" />}
              onClose={() => setIsCropping(false)}
            />
            <div className="flex justify-center p-4 bg-gray-100 rounded-md">
                <ReactCrop
                    crop={crop}
                    onChange={(_, percentCrop) => setCrop(percentCrop)}
                    onComplete={(c) => setCompletedCrop(c)}
                >
                    <img
                        ref={imgRef}
                        alt="Crop me"
                        src={preview!}
                        onLoad={onImageLoad}
                        style={{ maxHeight: '80vh' }}
                    />
                </ReactCrop>
            </div>
            <ModalFooter>
              <Button className="rounded-full" variant="outline" onClick={() => setIsCropping(false)}>
                <XMarkIcon className="h-4 w-4 mr-2" />
                Batal
              </Button>
              <Button className="rounded-full bg-emerald-600 hover:bg-emerald-700" onClick={handleCropConfirm}>Konfirmasi</Button>
            </ModalFooter>
          </DialogContent>
        </Dialog>

      </div>
    </main>
  )
}
