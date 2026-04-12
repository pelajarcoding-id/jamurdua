import { useState, useEffect, useRef, SyntheticEvent } from 'react';
import { NotaSawitData } from './columns';
import type { Kendaraan, User as Supir, PabrikSawit, Timbangan, Kebun } from '@prisma/client';
import ReactCrop, { type Crop, centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import ImageUpload from '@/components/ui/ImageUpload';
import { useAuth } from '@/components/AuthProvider';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import toast from 'react-hot-toast';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CheckIcon, ChevronUpDownIcon, DocumentDuplicateIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { cn } from "@/lib/utils";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import { ModalHeader, ModalContentWrapper, ModalFooter } from '@/components/ui/modal-elements'

type TimbanganWithKebun = Timbangan & { 
  kebun: Kebun;
  kendaraan?: Kendaraan | null;
  supir?: Supir | null;
};

interface ModalNotaProps {
  nota: NotaSawitData | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any, file?: File) => void;
}

// --- Helper Functions ---
const formatNumber = (value: number | string) => {
  if (typeof value === 'string') {
    // Remove dots, replace comma with dot
    value = parseFloat(value.replace(/\./g, '').replace(',', '.')) || 0;
  }
  return new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(Math.round(value));
};

const parseNumber = (value: string) => {
  // Remove dots (thousands), replace comma with dot (decimal)
  return parseFloat(value.replace(/\./g, '').replace(',', '.')) || 0;
};

const toLocalYmd = (d: Date) => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// Internal component for formatted input
const FormattedNumberInput = ({ 
  value, 
  onChange, 
  name, 
  disabled, 
  readOnly, 
  className,
  placeholder 
}: any) => {
  const [localValue, setLocalValue] = useState("");
  const [isFocused, setIsFocused] = useState(false);

  // Sync with external value when not focused
  useEffect(() => {
      if (!isFocused) {
          setLocalValue(formatNumber(value));
      }
  }, [value, isFocused]);

  const handleFocus = () => {
      setIsFocused(true);
      // When focusing, show the value in a way that's easy to edit
      // Convert number to string, replacing dot with comma for ID locale
      // If it's 0, maybe clear it? Or keep 0. Let's keep it simple.
      if (value === 0) {
          setLocalValue("");
      } else {
          setLocalValue(value.toString().replace('.', ','));
      }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setLocalValue(val);
      // Propagate change
      if (onChange) {
          onChange({ target: { name, value: val } });
      }
  };

  const handleBlur = () => {
      setIsFocused(false);
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
          className={`${className || ''} rounded-xl border-gray-200`}
          placeholder={placeholder}
          autoComplete="off"
      />
  );
};

export default function ModalNota({ nota, isOpen, onClose, onSave }: ModalNotaProps) {
  const { role } = useAuth();
  
  // --- Data Lists ---
  const [kendaraanList, setKendaraanList] = useState<Kendaraan[]>([]);
  const [supirList, setSupirList] = useState<Supir[]>([]);
  const [pabrikSawitList, setPabrikSawitList] = useState<PabrikSawit[]>([]);
  const [timbanganList, setTimbanganList] = useState<TimbanganWithKebun[]>([]);
  const [kebunList, setKebunList] = useState<Kebun[]>([]);

  // --- Form States ---
  // If editing (nota exists), we use its values. If adding (nota null), we use defaults.
  const [formData, setFormData] = useState<Partial<NotaSawitData> & { 
    manualGross?: number, 
    manualTare?: number, 
    manualNet?: number,
    timbanganId?: number,
    kebunId?: number,
    keterangan?: string,
    pembayaranAktual?: number | null,
    pph25?: number | null,
    bruto?: number,
    tara?: number,
    netto?: number
  }>({});

  const [isManualInput, setIsManualInput] = useState(false);
  const [isPembayaranAktualManual, setIsPembayaranAktualManual] = useState(false);
  const [useTimbanganKebunInput, setUseTimbanganKebunInput] = useState(false);
  const [selectedTimbangan, setSelectedTimbangan] = useState<TimbanganWithKebun | null>(null);
  const [isEditingComparison, setIsEditingComparison] = useState(false);
  const [originalComparison, setOriginalComparison] = useState<{ grossKg: number; tareKg: number } | null>(null);
  
  // Image states
  const [gambarNota, setGambarNota] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<Crop>();
  const [isCropping, setIsCropping] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  // Derived states for calculation
  const [beratTotal, setBeratTotal] = useState(0);
  const [totalPembayaran, setTotalPembayaran] = useState(0);
  const [pph, setPph] = useState(0);
  const [pembayaranSetelahPph, setPembayaranSetelahPph] = useState(0);

  const [supirQuery, setSupirQuery] = useState('');
  const [kendaraanQuery, setKendaraanQuery] = useState('');
  const [pabrikQuery, setPabrikQuery] = useState('');
  const [statusQuery, setStatusQuery] = useState('');
  const [openSupir, setOpenSupir] = useState(false);
  const [openKendaraan, setOpenKendaraan] = useState(false);
  const [openPabrik, setOpenPabrik] = useState(false);
  const [openStatus, setOpenStatus] = useState(false);
  const [openTimbangan, setOpenTimbangan] = useState(false);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const tanggalBongkarRef = useRef<HTMLInputElement>(null);
  const timbanganSelectRef = useRef<HTMLSelectElement>(null);
  const kebunSelectRef = useRef<HTMLSelectElement>(null);



  // --- Initialization ---
  useEffect(() => {
    if (isOpen) {
        if (nota) {
            // Edit Mode
            setFormData({
                ...nota,
                tanggalBongkar: nota.tanggalBongkar ? (toLocalYmd(new Date(nota.tanggalBongkar as any)) as any) : undefined,
                keterangan: (nota as any).keterangan || '',
                timbanganId: nota.timbanganId || undefined,
                kebunId: (nota as any).kebunId || nota.timbangan?.kebunId || undefined,
                pembayaranAktual: typeof nota.pembayaranAktual === 'number' ? Math.round(nota.pembayaranAktual) : nota.pembayaranAktual,
                pph25: Math.round(nota.pph25 || 0),
                // Initialize with existing values, fallback to Timbangan values if 0 (legacy data)
                // @ts-ignore
                bruto: Math.round(nota.bruto || nota.timbangan?.grossKg || 0),
                // @ts-ignore
                tara: Math.round(nota.tara || nota.timbangan?.tareKg || 0),
                // @ts-ignore
                netto: Math.round(nota.netto || nota.timbangan?.netKg || 0),
            });
            setPreview(nota.gambarNotaUrl || null);
            setIsManualInput(false); 
            setUseTimbanganKebunInput(false);
            
            // Recalculate derived
            // @ts-ignore
            const net = Math.round(nota.netto || nota.timbangan?.netKg || 0);
            const total = Math.round(net - Math.round(nota.potongan || 0));
            setBeratTotal(total > 0 ? total : 0);
            const totalBayar = Math.round(nota.totalPembayaran || 0);
            setTotalPembayaran(totalBayar);
            
            const existingPph = Math.round((nota.pph || totalBayar * 0.0025) as number);
            setPph(existingPph);
            const calculatedNet = Math.round((nota.pembayaranSetelahPph || (totalBayar - existingPph - Math.round(nota.pph25 || 0))) as number);
            setPembayaranSetelahPph(calculatedNet);

            if (nota.pembayaranAktual !== null && nota.pembayaranAktual !== undefined) {
                 const diff = Math.abs(nota.pembayaranAktual - calculatedNet);
                 setIsPembayaranAktualManual(diff > 1);
            } else {
                 setIsPembayaranAktualManual(false);
            }

        } else {
            // Add Mode
            setFormData({
                tanggalBongkar: toLocalYmd(new Date()) as any,
                keterangan: '',
                potongan: 0,
                hargaPerKg: 0,
                statusPembayaran: 'BELUM_LUNAS',
                manualGross: 0,
                manualTare: 0,
                manualNet: 0,
                pembayaranAktual: null,
                pph25: 0,
                bruto: 0,
                tara: 0,
                netto: 0
            });
            setPreview(null);
            setIsManualInput(false);
            setIsPembayaranAktualManual(false);
            setUseTimbanganKebunInput(false);
            setSelectedTimbangan(null);
            setBeratTotal(0);
            setTotalPembayaran(0);
            setPph(0);
            setPembayaranSetelahPph(0);
        }
        setErrors({});
    }
  }, [isOpen, nota]);

  useEffect(() => {
    if (!isOpen) return
    if (!formData?.timbanganId) return
    if (formData?.kebunId) return
    if (!Array.isArray(timbanganList) || timbanganList.length === 0) return
    const found = timbanganList.find((t) => Number((t as any)?.id) === Number(formData.timbanganId))
    if (!found) return
    setSelectedTimbangan(found)
    setFormData((prev) => ({ ...prev, kebunId: Number((found as any).kebunId) || undefined }))
  }, [formData.kebunId, formData.timbanganId, isOpen, timbanganList]);

  // --- Data Fetching ---
  useEffect(() => {
    async function fetchData() {
      try {
        let timbanganUrl = '/api/timbangan/list';
        if (nota?.timbanganId) {
            timbanganUrl += `?includeId=${nota.timbanganId}`;
        }

        const [kendaraanRes, supirRes, pabrikRes, timbanganRes, kebunRes] = await Promise.all([
            fetch('/api/kendaraan?limit=1000'),
            fetch('/api/supir/list'),
            fetch('/api/pabrik-sawit?limit=1000'),
            fetch(timbanganUrl), 
            fetch('/api/kebun/list')
        ]);
        
        setKendaraanList((await kendaraanRes.json()).data || []);
        {
          const supirJson = await supirRes.json()
          const supirs = (supirJson?.data || supirJson || []) as Supir[]
          setSupirList(Array.isArray(supirs) ? supirs : [])
        }
        setPabrikSawitList((await pabrikRes.json()).data || []);
        
        const timbanganData = await timbanganRes.json();
        setTimbanganList(timbanganData.data || timbanganData);
        
        const kebunData = await kebunRes.json();
        setKebunList(kebunData.data || kebunData);

      } catch (error) {
        console.error("Error fetching form data", error);
      }
    }
    if (isOpen) fetchData();
  }, [isOpen, nota?.timbanganId]);

  // --- Logic & Calculations ---
  
  // Handle Timbangan Selection (Add & Edit Mode)
  const handleTimbanganChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    
    if (value === "") {
        setSelectedTimbangan(null);
        setFormData(prev => ({ ...prev, timbanganId: undefined }));
        return;
    }

    const id = Number(value);
    const timbangan = timbanganList.find(t => t.id === id) || null;
    setSelectedTimbangan(timbangan);
    
    if (timbangan) {
        setFormData(prev => ({
            ...prev,
            timbanganId: id,
            manualGross: timbangan.grossKg,
            manualTare: timbangan.tareKg,
            manualNet: timbangan.netKg,
            supirId: timbangan.supirId || prev.supirId,
            kendaraanPlatNomor: timbangan.kendaraan?.platNomor || prev.kendaraanPlatNomor,
            kebunId: timbangan.kebunId || prev.kebunId,
            // bruto: timbangan.grossKg, // Removed auto-fill for pabrik data
            // tara: timbangan.tareKg, // Removed auto-fill for pabrik data
            // netto: timbangan.netKg, // Removed auto-fill for pabrik data
        }));
    }
  };

  const startEditComparison = () => {
    if (!nota || !nota.timbangan) return;
    const g = nota.timbangan.grossKg || 0;
    const t = nota.timbangan.tareKg || 0;
    setOriginalComparison({ grossKg: g, tareKg: t });
    setIsEditingComparison(true);
  };

  const cancelEditComparison = () => {
    if (!nota) return;
    if (originalComparison) {
      setFormData(prev => ({
        ...prev,
        timbangan: {
          ...prev.timbangan!,
          grossKg: originalComparison.grossKg,
          tareKg: originalComparison.tareKg,
          netKg: originalComparison.grossKg - originalComparison.tareKg
        }
      }));
    }
    setIsEditingComparison(false);
  };

  const saveEditComparison = async () => {
    try {
      if (!nota || !nota.timbangan) return;
      const grossKg = formData.timbangan?.grossKg || 0;
      const tareKg = formData.timbangan?.tareKg || 0;
      const kebunId = nota.timbangan.kebunId;
      const kendaraanPlatNomor = nota.timbangan.kendaraan?.platNomor || null;
      const notes = nota.timbangan.notes || null;
      const body = { kebunId, grossKg, tareKg, kendaraanPlatNomor, notes, photoUrl: nota.timbangan.photoUrl || null };
      const res = await fetch(`/api/timbangan/${nota.timbanganId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        throw new Error('Gagal menyimpan perubahan timbangan');
      }
      setIsEditingComparison(false);
      toast.success('Data timbangan diperbarui');
    } catch (e) {
      console.error(e);
      toast.error('Gagal menyimpan perubahan timbangan');
    }
  };

  const clearComparison = async () => {
    try {
      if (!nota || !nota.timbangan) return;
      const kebunId = nota.timbangan.kebunId;
      const body = { kebunId, grossKg: 0, tareKg: 0, kendaraanPlatNomor: nota.timbangan.kendaraan?.platNomor || null, notes: null, photoUrl: nota.timbangan.photoUrl || null };
      const res = await fetch(`/api/timbangan/${nota.timbanganId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('Gagal mengosongkan timbangan');
      setFormData(prev => ({
        ...prev,
        timbangan: {
          ...prev.timbangan!,
          grossKg: 0,
          tareKg: 0,
          netKg: 0,
        }
      }));
      toast.success('Data timbangan dikosongkan');
    } catch (e) {
      console.error(e);
      toast.error('Gagal mengosongkan timbangan');
    }
  };

  // Handle Input Changes
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    
    if (name === 'tanggalBongkar') {
      setFormData(prev => ({ ...prev, [name]: value as any }));
    } else if (name === 'kebunId') {
      setFormData(prev => ({ ...prev, kebunId: value ? Number(value) : undefined }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleNumericChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;

    // Special handling for nullable fields
    if (name === 'pembayaranAktual') {
        if (value === '') {
             setFormData(prev => ({ ...prev, [name]: null }));
             setIsPembayaranAktualManual(false); // Reset to auto if cleared
             return;
        } else {
             setIsPembayaranAktualManual(true);
        }
    }

    const numericValue = Math.round(parseNumber(value));

    setFormData(prev => {
        const updated = { ...prev, [name]: numericValue };
        
        // Handle nested timbangan updates (Edit Mode)
        if (nota && (name === 'grossKg' || name === 'tareKg')) {
            return {
                ...updated,
                timbangan: {
                    ...prev.timbangan!,
                    [name]: numericValue
                }
            };
        }

        // Sync Manual Inputs from Pabrik Data
        if (isManualInput) {
            if (name === 'bruto') updated.manualGross = numericValue;
            if (name === 'tara') updated.manualTare = numericValue;
        }

        return updated;
    });
  };

  // Effect: Sync Netto from Bruto/Tara
  useEffect(() => {
      const gross = formData.bruto || 0;
      const tare = formData.tara || 0;
      const net = Math.max(0, gross - tare);
      if (formData.netto !== net) {
          setFormData(prev => ({ ...prev, netto: net }));
      }
  }, [formData.bruto, formData.tara, formData.netto]);

  // Effect: Calculate Totals
  useEffect(() => {
    // Nota Sawit Calculation uses Nota Netto (formData.netto)
    // Timbangan inputs (manualGross/Tare or timbangan.grossKg/tareKg) are for Timbangan record update/display only
    
    const net = Math.round(formData.netto || 0);
    const potongan = Math.round(formData.potongan || 0);
    const beratAkhir = Math.max(0, Math.round(net - potongan));
    
    setBeratTotal(beratAkhir);
    
    const harga = Math.round(formData.hargaPerKg || 0);
    const totalBayar = Math.round(beratAkhir * harga);
    setTotalPembayaran(totalBayar);
    
    // Calculate PPh (0.25%)
    const calculatedPph = Math.round(totalBayar * 0.0025);
    setPph(calculatedPph);
    const netPay = Math.round(totalBayar - calculatedPph - Math.round(formData.pph25 || 0));
    setPembayaranSetelahPph(netPay);
    
    if (!isPembayaranAktualManual) {
         setFormData(prev => {
             // Avoid infinite loop by checking if value actually changed
             if (prev.pembayaranAktual !== netPay) {
                 return { ...prev, pembayaranAktual: netPay };
             }
             return prev;
         });
    }

  }, [
    formData.netto, // Depend on netto
    formData.potongan, formData.hargaPerKg,
    formData.pph25,
    nota,
    isPembayaranAktualManual
  ]);


  // --- Image Handling ---
  const handleFileChangeForCrop = (file: File | null) => {
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
        setIsCropping(true);
      };
      reader.readAsDataURL(file);
    } else {
      setPreview(null);
      setGambarNota(null);
    }
  };

  function onImageLoad(e: SyntheticEvent<HTMLImageElement>) {
    const { width, height } = e.currentTarget;
    setCrop({
        unit: '%',
        width: 90,
        height: 90,
        x: 5,
        y: 5
    });
  }

  async function getCroppedImg(image: HTMLImageElement, crop: Crop, fileName: string): Promise<File> {
    const canvas = document.createElement('canvas');
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;
    
    // Set canvas size to the actual resolution of the cropped image to preserve quality
    canvas.width = Math.floor(crop.width * scaleX);
    canvas.height = Math.floor(crop.height * scaleY);
    
    const ctx = canvas.getContext('2d');

    if (!ctx) throw new Error('No 2d context');

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
      canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error('Canvas is empty'));
            return;
          }
          const base = String(fileName || 'image').replace(/\.[^/.]+$/, '')
          const outName = `${base}.webp`
          resolve(new File([blob], outName, { type: 'image/webp' }));
        }, 'image/webp', 0.9);
    });
  }

  const handleCropConfirm = async () => {
    if (completedCrop?.width && completedCrop?.height && imgRef.current) {
      const croppedImageFile = await getCroppedImg(imgRef.current, completedCrop, 'cropped-nota.webp');
      setGambarNota(croppedImageFile);
      const reader = new FileReader();
      reader.onloadend = () => setPreview(reader.result as string);
      reader.readAsDataURL(croppedImageFile);
      setIsCropping(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const newErrors: Record<string, string> = {};

    if (!formData.tanggalBongkar) newErrors.tanggalBongkar = 'Tanggal bongkar harus diisi.';
    if (!formData.supirId) newErrors.supirId = 'Supir harus dipilih.';
    if (!formData.kendaraanPlatNomor) newErrors.kendaraanPlatNomor = 'Kendaraan harus dipilih.';
    if (!formData.pabrikSawitId) newErrors.pabrikSawitId = 'Pabrik sawit harus dipilih.';
    if (!formData.timbanganId && !formData.kebunId) newErrors.kebunId = 'Kebun harus dipilih jika tidak memilih timbangan.';
    // Catatan: timbangan dan harga/kg tidak lagi wajib diisi sesuai permintaan

    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) {
      toast.error('Harap isi semua field yang wajib diisi.');
      const order = [
        'tanggalBongkar',
        'timbanganId',
        'kebunId',
        'supirId',
        'kendaraanPlatNomor',
        'pabrikSawitId',
        'hargaPerKg',
      ];
      const first = order.find(k => newErrors[k]);
      if (first === 'tanggalBongkar') {
        tanggalBongkarRef.current?.focus();
      } else if (first === 'timbanganId') {
        timbanganSelectRef.current?.focus();
      } else if (first === 'kebunId') {
        kebunSelectRef.current?.focus();
      } else if (first === 'supirId') {
        setOpenSupir(true);
      } else if (first === 'kendaraanPlatNomor') {
        setOpenKendaraan(true);
      } else if (first === 'pabrikSawitId') {
        setOpenPabrik(true);
      } else if (first === 'hargaPerKg') {
        setTimeout(() => {
          const el = document.querySelector<HTMLInputElement>('input[name="hargaPerKg"]');
          el?.focus();
        }, 0);
      }
      return;
    }

    // Prepare final data
    const finalData: any = { ...formData };
    
    // Add calculated fields
    finalData.pph = pph;
    finalData.pembayaranSetelahPph = pembayaranSetelahPph;
    finalData.pph25 = formData.pph25 || 0;
    
    // Determine isManual based on timbanganId
    const isManual = !formData.timbanganId && !useTimbanganKebunInput;
    finalData.isManual = isManual;
    finalData.useTimbanganKebun = useTimbanganKebunInput;
    
    // Ensure numeric values are correct
    if (!nota && !isManual && selectedTimbangan) {
      finalData.timbanganId = selectedTimbangan.id;
    }
    if (useTimbanganKebunInput) {
      const gross = nota ? (formData.timbangan?.grossKg || 0) : (formData.manualGross || 0)
      const tare = nota ? (formData.timbangan?.tareKg || 0) : (formData.manualTare || 0)
      finalData.grossKg = gross
      finalData.tareKg = tare
    }
    
    onSave(finalData, gambarNota || undefined);
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl top-[calc(12px+env(safe-area-inset-top))] translate-y-0 sm:top-[50%] sm:translate-y-[-50%] max-h-[calc(100dvh-24px-env(safe-area-inset-top)-env(safe-area-inset-bottom))] sm:max-h-[90vh] p-0 overflow-hidden flex flex-col [&>button.absolute]:hidden">
        <ModalHeader
          title={nota ? 'Ubah Nota Sawit' : 'Tambah Nota Sawit'}
          subtitle={`Isi formulir di bawah ini untuk ${nota ? 'mengubah' : 'menambah'} data nota sawit.`}
          variant="emerald"
          icon={<DocumentDuplicateIcon className="h-5 w-5 text-white" />}
          onClose={onClose}
        />

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <ModalContentWrapper className="space-y-6 flex-1 min-h-0 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Left Column: Timbangan & Details */}
            <div className="space-y-4">
              <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                <div className="flex justify-between items-center mb-3">
                    <h3 className="text-sm font-semibold">Data Timbangan (Kebun)</h3>
                </div>

                <div className="flex items-center justify-between gap-3 mb-3">
                  <div className="text-xs text-gray-600">
                    Input timbangan kebun langsung di nota
                  </div>
                  <Switch
                    checked={useTimbanganKebunInput}
                    onCheckedChange={(checked) => {
                      setUseTimbanganKebunInput(!!checked)
                      if (checked && !nota) {
                        setSelectedTimbangan(null)
                        setFormData(prev => ({
                          ...prev,
                          timbanganId: undefined,
                          manualGross: prev.manualGross || 0,
                          manualTare: prev.manualTare || 0,
                          manualNet: prev.manualNet || 0,
                        }))
                      }
                    }}
                  />
                </div>

                <div className="mb-3">
                    <Label>Pilih Timbangan</Label>
                    <select
                        ref={timbanganSelectRef}
                        disabled={useTimbanganKebunInput}
                        className={`w-full input-style rounded-xl border-gray-200 ${errors.timbanganId ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                        onChange={handleTimbanganChange}
                        value={formData.timbanganId || ''}
                    >
                        <option value="">-- Pilih Data Timbangan --</option>
                        {/* If editing and timbangan exists but not in list (legacy), show it */}
                        {nota?.timbanganId && !timbanganList.find(t => t.id === nota.timbanganId) && (
                            <option value={nota.timbanganId}>
                                ID: {nota.timbanganId} (Data Lama)
                            </option>
                        )}
                        {timbanganList.map(t => (
                            <option key={t.id} value={t.id}>
                                {t.kebun.name} - {t.kendaraan?.platNomor || '-'} - {formatNumber(t.netKg)} Kg ({new Date(t.date).toLocaleDateString('id-ID')})
                            </option>
                        ))}
                    </select>
                    {errors.timbanganId && (
                      <p className="mt-1 text-xs text-red-600 bg-red-50 px-2 py-1 rounded">{errors.timbanganId}</p>
                    )}
                </div>

                {formData.timbanganId || useTimbanganKebunInput ? (
                  <div className="grid grid-cols-3 gap-2">
                      <div>
                          <Label>Gross (Kg)</Label>
                          <FormattedNumberInput 
                              name={nota ? "grossKg" : "manualGross"}
                              value={nota ? (formData.timbangan?.grossKg || 0) : (formData.manualGross || 0)}
                              onChange={handleNumericChange}
                              disabled={!formData.timbanganId && !useTimbanganKebunInput}
                              readOnly={!!formData.timbanganId && !useTimbanganKebunInput}
                              className={`${(formData.timbanganId && !useTimbanganKebunInput) ? "bg-gray-100 text-gray-500" : "bg-white text-gray-900"} rounded-xl border-gray-200`}
                          />
                      </div>
                      <div>
                          <Label>Tare (Kg)</Label>
                          <FormattedNumberInput 
                              name={nota ? "tareKg" : "manualTare"}
                              value={nota ? (formData.timbangan?.tareKg || 0) : (formData.manualTare || 0)}
                              onChange={handleNumericChange}
                              disabled={!formData.timbanganId && !useTimbanganKebunInput}
                              readOnly={!!formData.timbanganId && !useTimbanganKebunInput}
                              className={`${(formData.timbanganId && !useTimbanganKebunInput) ? "bg-gray-100 text-gray-500" : "bg-white text-gray-900"} rounded-xl border-gray-200`}
                          />
                      </div>
                      <div>
                          <Label>Netto (Kg)</Label>
                          <Input 
                              value={formatNumber(
                                  nota ? ((formData.timbangan?.grossKg || 0) - (formData.timbangan?.tareKg || 0)) :
                                  ((formData.manualGross || 0) - (formData.manualTare || 0))
                              )}
                              readOnly
                              className="bg-gray-100 font-bold rounded-xl border-gray-200"
                          />
                      </div>
                  </div>
                ) : null}

                {(formData.timbanganId || useTimbanganKebunInput) ? (
                  <div className="mt-3 text-xs text-gray-600">
                    {(() => {
                      const kebunGross = nota ? (formData.timbangan?.grossKg || 0) : (formData.manualGross || 0)
                      const selisih = (formData.bruto || 0) - kebunGross
                      const label = selisih === 0 ? 'Sama' : selisih > 0 ? `Lebih ${formatNumber(Math.abs(selisih))} kg` : `Kurang ${formatNumber(Math.abs(selisih))} kg`
                      return (
                        <span className={selisih === 0 ? 'text-emerald-700 font-semibold' : 'text-gray-700'}>
                          Selisih Bruto (Pabrik - Kebun): {label}
                        </span>
                      )
                    })()}
                  </div>
                ) : null}

                <div className="mt-3 text-[11px] text-gray-500">
                  Data timbangan boleh dikosongkan. Jika tidak memilih timbangan, isi data nota pabrik secara manual.
                </div>
              </div>

              {/* Data Nota Pabrik Section */}
              <div className="bg-green-50 p-4 rounded-2xl border border-green-100">
                <h3 className="text-sm font-semibold mb-3">Data Nota Pabrik (Utama)</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    <div>
                        <Label>Bruto (Kg)</Label>
                        <FormattedNumberInput 
                            name="bruto"
                            value={formData.bruto || 0}
                            onChange={handleNumericChange}
                            placeholder="0"
                            className="font-semibold rounded-xl border-gray-200"
                        />
                    </div>
                    <div>
                        <Label>Tara (Kg)</Label>
                        <FormattedNumberInput 
                            name="tara"
                            value={formData.tara || 0}
                            onChange={handleNumericChange}
                            placeholder="0"
                            className="font-semibold rounded-xl border-gray-200"
                        />
                    </div>
                    <div>
                        <Label>Netto (Kg)</Label>
                        <Input 
                            value={formatNumber(formData.netto || 0)}
                            readOnly
                            className="bg-gray-100 font-bold text-green-700 rounded-xl border-gray-200"
                        />
                    </div>
                    <div>
                        <Label>Potongan (Kg)</Label>
                        <FormattedNumberInput 
                            name="potongan"
                            value={formData.potongan || 0}
                            onChange={handleNumericChange}
                            className="rounded-xl border-gray-200"
                        />
                    </div>
                    <div>
                        <Label>Berat Akhir (Kg)</Label>
                        <Input 
                            value={formatNumber(beratTotal)}
                            readOnly
                            className="bg-gray-100 font-bold text-blue-700 rounded-xl border-gray-200"
                        />
                    </div>
                </div>
              </div>

              {/* Payment Details */}
              <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100">
                <h3 className="text-sm font-semibold mb-3">Rincian Pembayaran</h3>
                <div>
                    <Label>Harga per Kg (Rp)</Label>
                    <FormattedNumberInput 
                        name="hargaPerKg"
                        value={formData.hargaPerKg || 0}
                        onChange={handleNumericChange}
                        disabled={role === 'SUPIR'}
                        className={`rounded-xl border-gray-200 ${errors.hargaPerKg ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                    />
                    {errors.hargaPerKg && (
                      <p className="mt-1 text-xs text-red-600 bg-red-50 px-2 py-1 rounded">{errors.hargaPerKg}</p>
                    )}
                </div>
                <div className="mt-4">
                    <Label>Total Pembayaran (Rp)</Label>
                    <Input 
                        value={formatNumber(totalPembayaran)}
                        readOnly
                        className="bg-white font-bold text-green-700 text-lg rounded-xl border-gray-200"
                    />
                </div>
                <div className="grid grid-cols-2 gap-4 mt-4">
                    <div>
                        <Label>PPh 25 (0.25%)</Label>
                        <Input 
                            value={formatNumber(pph)}
                            readOnly
                            className="bg-white font-bold text-red-600 rounded-xl border-gray-200"
                        />
                    </div>
                    <div>
                        <Label>Bayar Setelah PPh</Label>
                        <Input 
                            value={formatNumber(pembayaranSetelahPph)}
                            readOnly
                            className="bg-white font-bold text-blue-700 text-lg rounded-xl border-gray-200"
                        />
                    </div>
                </div>
                
                <div className="mt-4 pt-4 border-t border-blue-200">
                    <Label className="flex justify-between">
                        <span>Pembayaran Aktual (Opsional)</span>
                        <span className="text-xs font-normal text-gray-500">Isi jika beda dengan hitungan sistem</span>
                    </Label>
                    <FormattedNumberInput 
                        name="pembayaranAktual"
                        value={formData.pembayaranAktual ?? ''}
                        onChange={handleNumericChange}
                        placeholder={formatNumber(pembayaranSetelahPph)}
                        className="bg-white border-blue-300 rounded-xl"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                        *Biarkan kosong untuk menggunakan nominal &quot;Bayar Setelah PPh&quot; otomatis.
                    </p>
                </div>

                {role !== 'SUPIR' && (
                  <div className="mt-4 pt-4 border-t border-blue-200">
                      <Label>Status Pembayaran</Label>
                      <Popover open={openStatus} onOpenChange={setOpenStatus}>
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            className="w-full input-style rounded-xl border-gray-200 flex items-center justify-between mt-1"
                            aria-haspopup="listbox"
                          >
                            <span>
                              {(formData.statusPembayaran || 'BELUM_LUNAS') === 'BELUM_LUNAS' ? 'Belum Lunas' : 'Lunas'}
                            </span>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-500" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 10.939l3.71-3.71a.75.75 0 111.06 1.061l-4.24 4.24a.75.75 0 01-1.06 0l-4.24-4.24a.75.75 0 01.02-1.06z" clipRule="evenodd" /></svg>
                          </button>
                        </PopoverTrigger>
                        <PopoverContent align="start" className="p-2 w-[--radix-popover-trigger-width] max-h-60 overflow-y-auto bg-white rounded-xl border shadow-sm">
                          <Input
                            autoFocus
                            placeholder="Cari status…"
                            value={statusQuery}
                            onChange={(e) => setStatusQuery(e.target.value)}
                            className="mb-2 rounded-lg"
                          />
                          <div role="listbox" className="space-y-1">
                            {[
                              { val: 'BELUM_LUNAS', label: 'Belum Lunas' },
                              { val: 'LUNAS', label: 'Lunas' },
                            ]
                              .filter(s => s.label.toLowerCase().includes(statusQuery.toLowerCase()))
                              .map(s => (
                                <button
                                  key={s.val}
                                  type="button"
                                  onClick={() => { setFormData(prev => ({ ...prev, statusPembayaran: s.val as any })); setOpenStatus(false); }}
                                  className={`w-full text-left px-3 py-2 rounded-lg hover:bg-gray-50 ${(formData.statusPembayaran || 'BELUM_LUNAS') === s.val ? 'bg-blue-50 text-blue-700' : ''}`}
                                >
                                  {s.label}
                                </button>
                              ))}
                            {[
                              { val: 'BELUM_LUNAS', label: 'Belum Lunas' },
                              { val: 'LUNAS', label: 'Lunas' },
                            ].filter(s => s.label.toLowerCase().includes(statusQuery.toLowerCase())).length === 0 && (
                              <div className="px-3 py-2 text-sm text-gray-500">Tidak ditemukan</div>
                            )}
                          </div>
                        </PopoverContent>
                      </Popover>
                  </div>
                )}
              </div>

            </div>

            {/* Right Column: Meta Data & Image */}
            <div className="space-y-4">
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                    <h3 className="text-sm font-semibold mb-3">Data Bongkar & Pabrik</h3>
                    <div className="space-y-4">
                        <div>
                            <Label>Tanggal Bongkar</Label>
                            <Input 
                                ref={tanggalBongkarRef}
                                type="date"
                                name="tanggalBongkar"
                                value={String((formData as any).tanggalBongkar || '')}
                                onChange={handleChange}
                                required
                                className={`rounded-xl border-gray-200 ${errors.tanggalBongkar ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                            />
                            {errors.tanggalBongkar && (
                              <p className="mt-1 text-xs text-red-600 bg-red-50 px-2 py-1 rounded">{errors.tanggalBongkar}</p>
                            )}
                        </div>

                        <div>
                            <Label>Kebun <span className="text-red-500">*</span></Label>
                            <select
                                ref={kebunSelectRef}
                                name="kebunId"
                                className={`w-full input-style rounded-xl border-gray-200 ${formData.timbanganId ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''} ${errors.kebunId ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                                value={formData.kebunId || ''}
                                onChange={handleChange}
                                disabled={!!formData.timbanganId}
                            >
                                <option value="">-- Pilih Kebun --</option>
                                {kebunList.map(k => (
                                    <option key={k.id} value={k.id}>{k.name}</option>
                                ))}
                            </select>
                            {errors.kebunId && (
                              <p className="mt-1 text-xs text-red-600 bg-red-50 px-2 py-1 rounded">{errors.kebunId}</p>
                            )}
                            <p className="text-xs text-gray-500 mt-1">
                                {formData.timbanganId 
                                    ? "Kebun otomatis terisi dari data timbangan." 
                                    : "Pilih kebun jika tidak menggunakan data timbangan otomatis."}
                            </p>
                        </div>
                        
                        <div>
                            <Label>Supir</Label>
                            <Popover open={openSupir} onOpenChange={setOpenSupir}>
                              <PopoverTrigger asChild>
                                <button
                                  type="button"
                                  className={`w-full input-style rounded-xl border-gray-200 flex items-center justify-between ${errors.supirId ? 'border-red-500 ring-2 ring-red-500/10' : ''}`}
                                  aria-haspopup="listbox"
                                >
                                  <span>
                                    {formData.supirId
                                      ? (supirList.find(s => String(s.id) === String(formData.supirId))?.name ?? 'Pilih Supir')
                                      : 'Pilih Supir'}
                                  </span>
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-500" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 10.939l3.71-3.71a.75.75 0 111.06 1.061l-4.24 4.24a.75.75 0 01-1.06 0l-4.24-4.24a.75.75 0 01.02-1.06z" clipRule="evenodd" /></svg>
                                </button>
                              </PopoverTrigger>
                              <PopoverContent align="start" className="p-2 w-[--radix-popover-trigger-width] max-h-60 overflow-y-auto bg-white rounded-xl border shadow-sm">
                                <Input
                                  autoFocus
                                  placeholder="Cari supir…"
                                  value={supirQuery}
                                  onChange={(e) => setSupirQuery(e.target.value)}
                                  className="mb-2 rounded-lg"
                                />
                                <div role="listbox" className="space-y-1">
                                  {supirList
                                    .filter(s => String((s as any)?.name || '').toLowerCase().includes(String(supirQuery || '').toLowerCase()))
                                    .map(s => (
                                      <button
                                        key={s.id}
                                        type="button"
                                        onClick={() => { setFormData(prev => ({ ...prev, supirId: s.id })); setOpenSupir(false); }}
                                        className={`w-full text-left px-3 py-2 rounded-lg hover:bg-gray-50 ${String(formData.supirId) === String(s.id) ? 'bg-blue-50 text-blue-700' : ''}`}
                                      >
                                        {String((s as any)?.name || '-')}
                                      </button>
                                    ))}
                                  {supirList.filter(s => String((s as any)?.name || '').toLowerCase().includes(String(supirQuery || '').toLowerCase())).length === 0 && (
                                    <div className="px-3 py-2 text-sm text-gray-500">Tidak ditemukan</div>
                                  )}
                                </div>
                              </PopoverContent>
                            </Popover>
                            {errors.supirId && (
                              <p className="mt-1 text-xs text-red-600 bg-red-50 px-2 py-1 rounded">{errors.supirId}</p>
                            )}
                        </div>

                        <div>
                            <Label>Kendaraan</Label>
                            <Popover open={openKendaraan} onOpenChange={setOpenKendaraan}>
                              <PopoverTrigger asChild>
                                <button
                                  type="button"
                                  className={`w-full input-style rounded-xl border-gray-200 flex items-center justify-between ${errors.kendaraanPlatNomor ? 'border-red-500 ring-2 ring-red-500/10' : ''}`}
                                  aria-haspopup="listbox"
                                >
                                  <span>
                                    {formData.kendaraanPlatNomor
                                      ? `${formData.kendaraanPlatNomor}`
                                      : 'Pilih Kendaraan'}
                                  </span>
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-500" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 10.939l3.71-3.71a.75.75 0 111.06 1.061l-4.24 4.24a.75.75 0 01-1.06 0l-4.24-4.24a.75.75 0 01.02-1.06z" clipRule="evenodd" /></svg>
                                </button>
                              </PopoverTrigger>
                              <PopoverContent align="start" className="p-2 w-[--radix-popover-trigger-width] max-h-60 overflow-y-auto bg-white rounded-xl border shadow-sm">
                                <Input
                                  autoFocus
                                  placeholder="Cari kendaraan…"
                                  value={kendaraanQuery}
                                  onChange={(e) => setKendaraanQuery(e.target.value)}
                                  className="mb-2 rounded-lg"
                                />
                                <div role="listbox" className="space-y-1">
                                  {kendaraanList
                                    .filter(k => (k as any).jenis?.toLowerCase?.() === 'mobil truck' || /truck/i.test((k as any).jenis || ''))
                                    .filter(k => (k.platNomor + ' ' + ((k as any).merk || '')).toLowerCase().includes(kendaraanQuery.toLowerCase()))
                                    .map(k => (
                                      <button
                                        key={k.platNomor}
                                        type="button"
                                        onClick={() => { setFormData(prev => ({ ...prev, kendaraanPlatNomor: k.platNomor })); setOpenKendaraan(false); }}
                                        className={`w-full text-left px-3 py-2 rounded-lg hover:bg-gray-50 ${String(formData.kendaraanPlatNomor) === String(k.platNomor) ? 'bg-blue-50 text-blue-700' : ''}`}
                                      >
                                        {k.platNomor} {(k as any).merk ? `- ${(k as any).merk}` : ''}
                                      </button>
                                    ))}
                                  {kendaraanList
                                    .filter(k => (k as any).jenis?.toLowerCase?.() === 'mobil truck' || /truck/i.test((k as any).jenis || ''))
                                    .filter(k => (k.platNomor + ' ' + ((k as any).merk || '')).toLowerCase().includes(kendaraanQuery.toLowerCase()))
                                    .length === 0 && (
                                    <div className="px-3 py-2 text-sm text-gray-500">Tidak ditemukan</div>
                                  )}
                                </div>
                              </PopoverContent>
                            </Popover>
                            {errors.kendaraanPlatNomor && (
                              <p className="mt-1 text-xs text-red-600 bg-red-50 px-2 py-1 rounded">{errors.kendaraanPlatNomor}</p>
                            )}
                        </div>

                        <div>
                            <Label>Pabrik Sawit</Label>
                            <Popover open={openPabrik} onOpenChange={setOpenPabrik}>
                              <PopoverTrigger asChild>
                                <button
                                  type="button"
                                  className={`w-full input-style rounded-xl border-gray-200 flex items-center justify-between ${errors.pabrikSawitId ? 'border-red-500 ring-2 ring-red-500/10' : ''}`}
                                  aria-haspopup="listbox"
                                >
                                  <span>
                                    {formData.pabrikSawitId
                                      ? (pabrikSawitList.find(p => String(p.id) === String(formData.pabrikSawitId))?.name ?? 'Pilih Pabrik')
                                      : 'Pilih Pabrik'}
                                  </span>
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-500" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 10.939l3.71-3.71a.75.75 0 111.06 1.061l-4.24 4.24a.75.75 0 01-1.06 0l-4.24-4.24a.75.75 0 01.02-1.06z" clipRule="evenodd" /></svg>
                                </button>
                              </PopoverTrigger>
                              <PopoverContent align="start" className="p-2 w-[--radix-popover-trigger-width] max-h-60 overflow-y-auto bg-white rounded-xl border shadow-sm">
                                <Input
                                  autoFocus
                                  placeholder="Cari pabrik…"
                                  value={pabrikQuery}
                                  onChange={(e) => setPabrikQuery(e.target.value)}
                                  className="mb-2 rounded-lg"
                                />
                                <div role="listbox" className="space-y-1">
                                  {pabrikSawitList
                                    .filter(p => p.name.toLowerCase().includes(pabrikQuery.toLowerCase()))
                                    .map(p => (
                                      <button
                                        key={p.id}
                                        type="button"
                                        onClick={() => { setFormData(prev => ({ ...prev, pabrikSawitId: p.id })); setOpenPabrik(false); }}
                                        className={`w-full text-left px-3 py-2 rounded-lg hover:bg-gray-50 ${String(formData.pabrikSawitId) === String(p.id) ? 'bg-blue-50 text-blue-700' : ''}`}
                                      >
                                        {p.name}
                                      </button>
                                    ))}
                                  {pabrikSawitList.filter(p => p.name.toLowerCase().includes(pabrikQuery.toLowerCase())).length === 0 && (
                                    <div className="px-3 py-2 text-sm text-gray-500">Tidak ditemukan</div>
                                  )}
                                </div>
                              </PopoverContent>
                            </Popover>
                            {errors.pabrikSawitId && (
                              <p className="mt-1 text-xs text-red-600 bg-red-50 px-2 py-1 rounded">{errors.pabrikSawitId}</p>
                            )}
                        </div>

                        <div>
                            <Label>Keterangan</Label>
                            <Textarea
                              name="keterangan"
                              value={String((formData as any).keterangan || '')}
                              onChange={handleChange}
                              placeholder="Tambah keterangan nota (opsional)"
                              className="rounded-xl border-gray-200"
                            />
                        </div>
                    </div>
                </div>

                {/* Image Upload */}
                <div>
                    <Label>Foto Nota</Label>
                    <ImageUpload 
                        onFileChange={handleFileChangeForCrop}
                        previewUrl={preview}
                    />
                </div>
            </div>
          </div>
          </ModalContentWrapper>

          <ModalFooter>
            <Button type="button" variant="outline" onClick={onClose} className="w-full sm:w-auto rounded-full">
              <XMarkIcon className="h-4 w-4 mr-2" />
              Batal
            </Button>
            <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700 w-full sm:w-auto rounded-full">
              <CheckIcon className="h-4 w-4 mr-2" />
              Simpan
            </Button>
          </ModalFooter>
        </form>

        {/* Cropping Dialog */}
        <Dialog open={isCropping} onOpenChange={setIsCropping}>
            <DialogContent className="max-w-xl p-0 overflow-hidden [&>button.absolute]:hidden">
                <ModalHeader
                    title="Potong Gambar"
                    variant="emerald"
                    icon={<DocumentDuplicateIcon className="h-5 w-5 text-white" />}
                    onClose={() => { setIsCropping(false); setPreview(null); setGambarNota(null); }}
                />
                <div className="flex justify-center bg-black/5 p-4 overflow-auto max-h-[60vh]">
                    {preview && (
                        <ReactCrop
                            crop={crop}
                            onChange={(_, percentCrop) => setCrop(percentCrop)}
                            onComplete={(c) => setCompletedCrop(c)}
                            aspect={undefined}
                        >
                            <img
                                ref={imgRef}
                                src={preview}
                                alt="Crop preview"
                                onLoad={onImageLoad}
                            />
                        </ReactCrop>
                    )}
                </div>
                <ModalFooter>
                    <Button className="w-full sm:w-auto rounded-full" variant="outline" onClick={() => { setIsCropping(false); setPreview(null); setGambarNota(null); }}>
                        <XMarkIcon className="h-4 w-4 mr-2" />
                        Batal
                    </Button>
                    <Button className="w-full sm:w-auto rounded-full bg-emerald-600 hover:bg-emerald-700" onClick={handleCropConfirm}>Potong & Simpan</Button>
                </ModalFooter>
            </DialogContent>
        </Dialog>

      </DialogContent>
    </Dialog>
  );
}
