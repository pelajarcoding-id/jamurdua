import React from 'react';
import useSWR from 'swr';
import { Kendaraan } from '@prisma/client';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ExclamationTriangleIcon, CheckCircleIcon } from '@heroicons/react/24/outline';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface DocumentStatus {
    date: Date | null;
    daysLeft: number | null;
    status: 'expired' | 'warning' | 'ok' | 'none';
}

interface VehicleAlertGroup {
  platNomor: string;
  merk: string;
  stnk: DocumentStatus;
  pajak: DocumentStatus;
  speksi: DocumentStatus;
  minDaysLeft: number; // For sorting
  hasIssues: boolean;
}

export default function VehicleExpirySection() {
  const { data: vehicles, isLoading } = useSWR<Kendaraan[]>('/api/kendaraan/alerts', fetcher);

  if (isLoading) {
    return (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-full">
            <div className="flex items-center gap-2 mb-4">
                <Skeleton className="h-6 w-6 rounded-full" />
                <Skeleton className="h-6 w-48" />
            </div>
            <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                ))}
            </div>
        </div>
    );
  }

  const processAlerts = () => {
    if (!vehicles) return [];
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const groups: VehicleAlertGroup[] = vehicles.map(v => {
        const getStatus = (dateStr: Date | string | null): DocumentStatus => {
            if (!dateStr) return { date: null, daysLeft: null, status: 'none' };
            
            const d = new Date(dateStr);
            d.setHours(0, 0, 0, 0);
            
            const diffTime = d.getTime() - today.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            
            let status: DocumentStatus['status'] = 'ok';
            if (diffDays < 0) status = 'expired';
            else if (diffDays <= 30) status = 'warning';
            
            return { date: d, daysLeft: diffDays, status };
        };

        const stnk = getStatus(v.tanggalMatiStnk);
        const pajak = getStatus(v.tanggalPajakTahunan);
        const speksi = getStatus(v.speksi);

        // Calculate minimum days left for sorting (prioritize issues)
        // Use a large number for 'none' or 'ok' so they go to bottom
        const getSortValue = (s: DocumentStatus) => {
            if (s.status === 'expired') return -100000 + (s.daysLeft || 0); // Expired first
            if (s.status === 'warning') return s.daysLeft || 0; // Warning next
            if (s.status === 'ok') return 1000 + (s.daysLeft || 0); // OK later
            return 99999; // None last
        };

        const minDaysLeft = Math.min(
            getSortValue(stnk),
            getSortValue(pajak),
            getSortValue(speksi)
        );

        const hasIssues = stnk.status === 'expired' || stnk.status === 'warning' ||
                          pajak.status === 'expired' || pajak.status === 'warning' ||
                          speksi.status === 'expired' || speksi.status === 'warning';

        return {
            platNomor: v.platNomor,
            merk: v.merk,
            stnk,
            pajak,
            speksi,
            minDaysLeft,
            hasIssues
        };
    });

    // Sort by most urgent
    return groups.sort((a, b) => a.minDaysLeft - b.minDaysLeft);
  };

  const alerts = processAlerts();
  const issueCount = alerts.filter(a => a.hasIssues).length;

  const renderStatusCell = (doc: DocumentStatus) => {
      if (doc.status === 'none') return <span className="text-gray-400 text-sm">-</span>;
      
      const dateStr = doc.date?.toLocaleDateString('id-ID', { 
          day: 'numeric', 
          month: 'short', 
          year: 'numeric' 
      });

      if (doc.status === 'expired') {
          return (
              <div className="flex flex-col items-start gap-1">
                  <span className="text-sm font-medium text-gray-900">{dateStr}</span>
                  <Badge variant="destructive" className="rounded-sm text-[10px] px-1.5 py-0.5 h-auto leading-none">
                      Telat {Math.abs(doc.daysLeft!)} hari
                  </Badge>
              </div>
          );
      }
      
      if (doc.status === 'warning') {
           return (
              <div className="flex flex-col items-start gap-1">
                  <span className="text-sm font-medium text-gray-900">{dateStr}</span>
                  <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-200 border-yellow-200 rounded-sm text-[10px] px-1.5 py-0.5 h-auto leading-none shadow-none">
                      {doc.daysLeft === 0 ? 'Hari Ini' : `${doc.daysLeft} hari lagi`}
                  </Badge>
              </div>
          );
      }

      return (
          <div className="flex flex-col items-start gap-1">
              <span className="text-sm text-gray-600">{dateStr}</span>
              <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50 text-[10px] px-1.5 py-0.5 h-auto leading-none">
                  Aman
              </Badge>
          </div>
      );
  };

  const renderStatusCompact = (label: string, doc: DocumentStatus) => {
    const dateStr = doc.date?.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });

    let badge: React.ReactNode = null
    if (doc.status === 'expired') {
      badge = (
        <Badge variant="destructive" className="rounded-sm text-[10px] px-1.5 py-0.5 h-auto leading-none">
          Telat {Math.abs(doc.daysLeft || 0)}h
        </Badge>
      )
    } else if (doc.status === 'warning') {
      badge = (
        <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-200 border-yellow-200 rounded-sm text-[10px] px-1.5 py-0.5 h-auto leading-none shadow-none">
          {doc.daysLeft === 0 ? 'Hari ini' : `${doc.daysLeft}h`}
        </Badge>
      )
    } else if (doc.status === 'ok') {
      badge = (
        <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50 text-[10px] px-1.5 py-0.5 h-auto leading-none">
          Aman
        </Badge>
      )
    } else {
      badge = <span className="text-[10px] text-gray-400">-</span>
    }

    return (
      <div className="rounded-xl border border-gray-100 bg-white p-3 min-w-0">
        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{label}</div>
        <div className="mt-1 flex items-center justify-between gap-2 min-w-0">
          <div className="text-[11px] font-semibold text-gray-800 truncate">{dateStr || '-'}</div>
          <div className="shrink-0">{badge}</div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-gray-100 h-full flex flex-col">
      <div className="flex items-start sm:items-center justify-between gap-3 mb-4">
        <h3 className="text-base sm:text-lg font-bold text-gray-800 flex items-center gap-2">
            {issueCount > 0 ? (
                <ExclamationTriangleIcon className="w-5 h-5 text-yellow-500" />
            ) : (
                <CheckCircleIcon className="w-5 h-5 text-green-500" />
            )}
            Status Dokumen Kendaraan
        </h3>
        {issueCount > 0 && (
            <Badge variant="secondary" className="bg-yellow-50 text-yellow-700 border-yellow-200 text-xs">
                {issueCount} Perlu Perhatian
            </Badge>
        )}
      </div>
      
      {alerts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center text-gray-500">
            <CheckCircleIcon className="w-12 h-12 mb-3 text-green-100" />
            <p>Tidak ada data kendaraan.</p>
        </div>
      ) : (
        <>
          <div className="space-y-3 sm:hidden">
            {alerts.map((vehicle) => (
              <div key={vehicle.platNomor} className={`rounded-2xl border border-gray-100 p-4 ${vehicle.hasIssues ? 'bg-red-50/30' : 'bg-white'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-bold text-gray-900 truncate">{vehicle.platNomor}</div>
                    <div className="text-xs text-gray-500 truncate">{vehicle.merk}</div>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-1 gap-2">
                  {renderStatusCompact('STNK', vehicle.stnk)}
                  {renderStatusCompact('Pajak Tahunan', vehicle.pajak)}
                  {renderStatusCompact('Speksi', vehicle.speksi)}
                </div>
              </div>
            ))}
          </div>

          <div className="hidden sm:block overflow-x-auto relative rounded-md border max-h-[400px]">
              <Table>
              <TableHeader className="sticky top-0 bg-white z-10 shadow-sm">
                  <TableRow>
                  <TableHead className="w-[200px]">Kendaraan</TableHead>
                  <TableHead>STNK</TableHead>
                  <TableHead>Pajak Tahunan</TableHead>
                  <TableHead>Speksi</TableHead>
                  </TableRow>
              </TableHeader>
              <TableBody>
                  {alerts.map((vehicle) => (
                  <TableRow key={vehicle.platNomor} className={vehicle.hasIssues ? 'bg-red-50/30' : ''}>
                      <TableCell>
                      <div className="font-bold text-gray-800">{vehicle.platNomor}</div>
                      <div className="text-xs text-gray-500">{vehicle.merk}</div>
                      </TableCell>
                      <TableCell>{renderStatusCell(vehicle.stnk)}</TableCell>
                      <TableCell>{renderStatusCell(vehicle.pajak)}</TableCell>
                      <TableCell>{renderStatusCell(vehicle.speksi)}</TableCell>
                  </TableRow>
                  ))}
              </TableBody>
              </Table>
          </div>
        </>
      )}
    </div>
  );
}
