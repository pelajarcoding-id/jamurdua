'use client'

import useSWR from 'swr';
import { Kendaraan } from '@prisma/client';
import { 
  ExclamationTriangleIcon, 
  TruckIcon, 
  DocumentCheckIcon, 
  CreditCardIcon 
} from '@heroicons/react/24/outline';
import { format, differenceInDays } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function VehicleSummary() {
  const { data: vehicles, isLoading } = useSWR<Kendaraan[]>('/api/kendaraan/alerts', fetcher);

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

  const pajakAlerts = vehicles.filter(v => {
    if (!v.tanggalPajakTahunan) return false;
    const days = differenceInDays(new Date(v.tanggalPajakTahunan), today);
    return days <= 30;
  });

  // Combined alerts for the table
  const attentionVehicles = vehicles.filter(v => {
    const stnkDays = differenceInDays(new Date(v.tanggalMatiStnk), today);
    const pajakDays = v.tanggalPajakTahunan ? differenceInDays(new Date(v.tanggalPajakTahunan), today) : 999;
    return stnkDays <= 30 || pajakDays <= 30;
  }).sort((a, b) => {
    const daysA = Math.min(
        differenceInDays(new Date(a.tanggalMatiStnk), today),
        a.tanggalPajakTahunan ? differenceInDays(new Date(a.tanggalPajakTahunan), today) : 999
    );
    const daysB = Math.min(
        differenceInDays(new Date(b.tanggalMatiStnk), today),
        b.tanggalPajakTahunan ? differenceInDays(new Date(b.tanggalPajakTahunan), today) : 999
    );
    return daysA - daysB;
  });

  return (
    <div className="space-y-6 mb-8">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
            <CardTitle className="text-sm font-medium text-gray-600">Pajak Perlu Perhatian</CardTitle>
            <CreditCardIcon className="h-5 w-5 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{pajakAlerts.length}</div>
            <p className="text-xs text-gray-500 mt-1">Mati dalam &lt; 30 hari</p>
          </CardContent>
        </Card>
      </div>

      {/* Attention Table */}
      {attentionVehicles.length > 0 && (
        <Card className="bg-white border-none shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <ExclamationTriangleIcon className="h-5 w-5 text-amber-500" />
              <CardTitle className="text-lg font-semibold text-gray-800">
                Perhatian Kendaraan
              </CardTitle>
            </div>
            <p className="text-sm text-gray-500">
              Daftar kendaraan dengan dokumen yang akan segera habis masa berlakunya.
            </p>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border border-gray-100 overflow-hidden">
              <Table>
                <TableHeader className="bg-gray-50">
                  <TableRow>
                    <TableHead className="font-semibold">Plat Nomor</TableHead>
                    <TableHead className="font-semibold">Merk / Jenis</TableHead>
                    <TableHead className="font-semibold text-amber-700">Mati STNK</TableHead>
                    <TableHead className="font-semibold text-blue-700">Pajak Tahunan</TableHead>
                    <TableHead className="font-semibold text-right">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attentionVehicles.map((v) => {
                    const stnkDays = differenceInDays(new Date(v.tanggalMatiStnk), today);
                    const pajakDays = v.tanggalPajakTahunan ? differenceInDays(new Date(v.tanggalPajakTahunan), today) : 999;
                    
                    return (
                      <TableRow key={v.platNomor} className="hover:bg-gray-50/50 transition-colors">
                        <TableCell className="font-bold">{v.platNomor}</TableCell>
                        <TableCell>
                          <div className="text-sm">{v.merk}</div>
                          <div className="text-xs text-gray-500">{v.jenis}</div>
                        </TableCell>
                        <TableCell>
                          <div className={`text-sm font-medium ${stnkDays < 0 ? 'text-red-600' : stnkDays <= 7 ? 'text-amber-600' : 'text-gray-700'}`}>
                            {format(new Date(v.tanggalMatiStnk), 'dd MMM yyyy', { locale: idLocale })}
                          </div>
                          <div className="text-xs text-gray-500">
                            {stnkDays < 0 ? `Telat ${Math.abs(stnkDays)} hari` : `${stnkDays} hari lagi`}
                          </div>
                        </TableCell>
                        <TableCell>
                          {v.tanggalPajakTahunan ? (
                            <>
                              <div className={`text-sm font-medium ${pajakDays < 0 ? 'text-red-600' : pajakDays <= 7 ? 'text-amber-600' : 'text-gray-700'}`}>
                                {format(new Date(v.tanggalPajakTahunan), 'dd MMM yyyy', { locale: idLocale })}
                              </div>
                              <div className="text-xs text-gray-500">
                                {pajakDays < 0 ? `Telat ${Math.abs(pajakDays)} hari` : `${pajakDays} hari lagi`}
                              </div>
                            </>
                          ) : (
                            <span className="text-xs text-gray-400 italic">Data belum diisi</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            (stnkDays < 0 || pajakDays < 0) ? 'bg-red-100 text-red-800' : 
                            (stnkDays <= 7 || pajakDays <= 7) ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
                          }`}>
                            {(stnkDays < 0 || pajakDays < 0) ? 'Sudah Mati' : 'Segera Habis'}
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
