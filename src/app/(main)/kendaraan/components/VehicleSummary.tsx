'use client'

import useSWR from 'swr';
import { 
  TruckIcon, 
  DocumentCheckIcon, 
  CreditCardIcon,
  WrenchIcon
} from '@heroicons/react/24/outline';
import { differenceInDays } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

type KendaraanAlert = {
  platNomor: string
  merk: string
  jenis: string
  tanggalMatiStnk: Date | string
  tanggalPajakTahunan?: Date | string | null
  tanggalIzinTrayek?: Date | string | null
  speksi?: Date | string | null
}

export default function VehicleSummary() {
  const { data: vehicles, isLoading } = useSWR<KendaraanAlert[]>('/api/kendaraan/alerts', fetcher);

  if (isLoading || !vehicles) return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      {[1, 2, 3].map((i) => (
        <Card key={i} className="animate-pulse">
          <CardContent className="h-24" />
        </Card>
      ))}
    </div>
  );

  const totalVehicles = vehicles.length;
  
  // Calculate alerts
  const today = new Date();
  const stnkAlerts = vehicles.filter(v => {
    const days = differenceInDays(new Date(v.tanggalMatiStnk), today);
    return days <= 30;
  });

  const izinTrayekAlerts = vehicles.filter(v => {
    const t = v.tanggalIzinTrayek ?? v.tanggalPajakTahunan ?? null
    if (!t) return false;
    const days = differenceInDays(new Date(t), today);
    return days <= 30;
  });

  const speksiAlerts = vehicles.filter(v => {
    if (!v.speksi) return false;
    const days = differenceInDays(new Date(v.speksi), today);
    return days <= 30;
  });

  return (
    <div className="space-y-6 mb-8">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-white border-none shadow-sm overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Kendaraan</CardTitle>
            <TruckIcon className="h-5 w-5 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalVehicles}</div>
            <p className="text-xs text-gray-500 mt-1">Unit terdaftar</p>
          </CardContent>
        </Card>

        <Card className="bg-white border-none shadow-sm overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">STNK Perlu Perhatian</CardTitle>
            <DocumentCheckIcon className="h-5 w-5 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{stnkAlerts.length}</div>
            <p className="text-xs text-gray-500 mt-1">Mati dalam &lt; 30 hari</p>
          </CardContent>
        </Card>

        <Card className="bg-white border-none shadow-sm overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Izin Trayek Perlu Perhatian</CardTitle>
            <CreditCardIcon className="h-5 w-5 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{izinTrayekAlerts.length}</div>
            <p className="text-xs text-gray-500 mt-1">Mati dalam &lt; 30 hari</p>
          </CardContent>
        </Card>

        <Card className="bg-white border-none shadow-sm overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Speksi Perlu Perhatian</CardTitle>
            <WrenchIcon className="h-5 w-5 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{speksiAlerts.length}</div>
            <p className="text-xs text-gray-500 mt-1">Mati dalam &lt; 30 hari</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
