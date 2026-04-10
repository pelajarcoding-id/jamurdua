'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { DataTable } from '@/components/data-table';
import { createProcessingColumns, ProcessingNotaSawit } from '@/app/(main)/gajian/columns';
import { Button } from '@/components/ui/button';
import toast from 'react-hot-toast';
import type { NotaSawit, Kebun, Kendaraan, Timbangan, User, Gajian, BiayaLainGajian, DetailGajian } from '@prisma/client';
import { PlusCircleIcon, TrashIcon } from '@heroicons/react/24/outline';
import { Input } from '@/components/ui/input';

// Extended types
type NotaSawitWithRelations = NotaSawit & {
  supir: User;
  kendaraan: Kendaraan | null;
  timbangan: Timbangan & { kebun: Kebun };
};

type DetailGajianWithRelations = DetailGajian & {
  notaSawit: NotaSawitWithRelations;
};

type GajianWithDetails = Gajian & {
  detailGajian: DetailGajianWithRelations[];
  biayaLain: BiayaLainGajian[];
  kebun: Kebun;
};

interface BiayaLain {
  id: number | string; // Can be number from DB or string for new items
  deskripsi: string;
  jumlah: string;
  satuan: string;
  hargaSatuan: string;
  total: number;
}

const formatNumber = (num: number) => new Intl.NumberFormat('id-ID').format(num);

export default function EditGajianPage() {
  const { id } = useParams();
  const router = useRouter();
  const [gajian, setGajian] = useState<GajianWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [notasToProcess, setNotasToProcess] = useState<ProcessingNotaSawit[]>([]);
  const [biayaLain, setBiayaLain] = useState<BiayaLain[]>([]);
  const [keterangan, setKeterangan] = useState('');

  useEffect(() => {
    if (id) {
      setLoading(true);
      fetch(`/api/gajian/${id}`)
        .then(res => res.json())
        .then((data: GajianWithDetails) => {
          setGajian(data);
          setKeterangan(data.keterangan || '');
          
          const processedNotas = data.detailGajian.map(detail => ({
            ...detail.notaSawit,
            beratAkhir: detail.notaSawit.timbangan.netKg, 
            harianKerja: detail.harianKerja || 1, 
          }));
          setNotasToProcess(processedNotas);

          const loadedBiayaLain = data.biayaLain.map(item => ({
            ...item,
            jumlah: String(item.jumlah || ''),
            satuan: item.satuan || '', // Ensure satuan is always a string
            hargaSatuan: String(item.hargaSatuan || ''),
            total: (parseFloat(String(item.jumlah)) || 0) * (parseFloat(String(item.hargaSatuan)) || 0)
          }));
          setBiayaLain(loadedBiayaLain);
          setLoading(false);
        })
        .catch(err => {
          toast.error('Gagal memuat data gajian.');
          console.error(err);
          setLoading(false);
        });
    }
  }, [id]);

  const handleRemoveNota = useCallback((id: number) => {
    setNotasToProcess(prev => prev.filter(nota => nota.id !== id));
  }, []);

  const handleKeteranganChange = useCallback((id: number, val: string) => {
    setNotasToProcess(prev => prev.map(nota => 
      nota.id === id ? { ...nota, keterangan: val } : nota
    ));
  }, []);

  const processingColumns = useMemo(() => createProcessingColumns(handleRemoveNota, handleKeteranganChange), [handleRemoveNota, handleKeteranganChange]);

  // Handlers for Biaya Lain
  const handleAddBiayaLain = () => {
    setBiayaLain(prev => [...prev, { id: `new-${Date.now()}`, deskripsi: '', jumlah: '', satuan: '', hargaSatuan: '', total: 0 }]);
  };

  const handleRemoveBiayaLain = (id: number | string) => {
    setBiayaLain(prev => prev.filter(item => item.id !== id));
  };

  const handleBiayaLainChange = (id: number | string, field: keyof BiayaLain, value: string | null) => {
    setBiayaLain(prev => prev.map(item => {
      if (item.id === id) {
        const newItem = { ...item, [field]: value || '' };
        const jumlah = parseFloat(newItem.jumlah) || 0;
        const hargaSatuan = parseFloat(newItem.hargaSatuan) || 0;
        newItem.total = jumlah * hargaSatuan;
        return newItem;
      }
      return item;
    }));
  };

  const totalBiayaLain = useMemo(() => {
    return biayaLain.reduce((sum, item) => sum + item.total, 0);
  }, [biayaLain]);

  const handleUpdateGajian = async () => {
    if (!gajian) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/gajian/${gajian.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keterangan,
          notas: notasToProcess,
          biayaLain: biayaLain.filter(item => item.deskripsi && item.total > 0),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Gagal memperbarui gajian');
      }

      toast.success('Gajian berhasil diperbarui!');
      router.push('/gajian');
    } catch (error: any) {
      toast.error(error.message || 'Gagal memperbarui gajian.');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center">Memuat data gajian...</div>;
  }

  if (!gajian) {
    return <div className="p-8 text-center">Data gajian tidak ditemukan.</div>;
  }

  return (
    <div className="space-y-6 p-4 md:p-8">
      <h1 className="text-2xl font-bold">Edit Gajian</h1>
      <p>Periode: {new Date(gajian.tanggalMulai).toLocaleDateString()} - {new Date(gajian.tanggalSelesai).toLocaleDateString()}</p>
      <p>Kebun: {gajian.kebun.name}</p>

      <div className="bg-white p-6 rounded-lg shadow-md mt-6">
        <h2 className="text-xl font-semibold mb-4">Nota yang Diproses</h2>
        <DataTable 
          columns={processingColumns} 
          data={notasToProcess} 
          rowSelection={{}} 
          setRowSelection={() => {}}
        />
      </div>

      <div className="bg-white p-6 rounded-lg shadow-md mt-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Biaya Lain-lain</h2>
          <Button onClick={handleAddBiayaLain} size="sm" variant="outline">
            <PlusCircleIcon className="h-4 w-4 mr-2" />
            Tambah Biaya
          </Button>
        </div>
        <div className="space-y-4">
          {biayaLain.map((item) => (
            <div key={item.id} className="grid grid-cols-12 gap-2 items-center">
              <Input 
                placeholder="Deskripsi" 
                className="col-span-4"
                value={item.deskripsi}
                onChange={(e) => handleBiayaLainChange(item.id, 'deskripsi', e.target.value)}
              />
              <Input 
                placeholder="Jumlah" 
                type="number" 
                className="col-span-2"
                value={item.jumlah}
                onChange={(e) => handleBiayaLainChange(item.id, 'jumlah', e.target.value)}
              />
              <Input 
                placeholder="Satuan (e.g., HK, Btg)" 
                className="col-span-2"
                value={item.satuan}
                onChange={(e) => handleBiayaLainChange(item.id, 'satuan', e.target.value)}
              />
              <Input 
                placeholder="Harga Satuan (Rp)" 
                type="number" 
                className="col-span-2"
                value={item.hargaSatuan}
                onChange={(e) => handleBiayaLainChange(item.id, 'hargaSatuan', e.target.value)}
              />
              <div className="col-span-1 text-right font-semibold">{formatNumber(item.total)}</div>
              <Button onClick={() => handleRemoveBiayaLain(item.id)} size="icon" variant="ghost" className="col-span-1">
                <TrashIcon className="h-4 w-4 text-red-500" />
              </Button>
            </div>
          ))}
        </div>
        {biayaLain.length > 0 && (
          <div className="mt-4 pt-4 border-t flex justify-end">
            <div className="text-right">
              <p className="text-gray-600">Total Biaya Lain-lain:</p>
              <p className="text-2xl font-bold">Rp {formatNumber(totalBiayaLain)}</p>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white p-6 rounded-lg shadow-md mt-6">
        <h2 className="text-xl font-semibold mb-4">Keterangan</h2>
        <Input 
          value={keterangan}
          onChange={(e) => setKeterangan(e.target.value)}
          placeholder="Tambahkan keterangan jika perlu"
        />
      </div>

      <div className="flex justify-end mt-6 space-x-4">
        <Button variant="outline" onClick={() => router.back()} disabled={loading}>
          Batal
        </Button>
        <Button onClick={handleUpdateGajian} disabled={loading}>
          {loading ? 'Menyimpan...' : 'Simpan Perubahan'}
        </Button>
      </div>
    </div>
  );
}
