'use client'

import useSWR from 'swr';
import { Kendaraan } from '@prisma/client';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function ServiceAlerts() {
  const { data: alerts, isLoading } = useSWR<Kendaraan[]>('/api/kendaraan/alerts', fetcher);

  if (isLoading || !alerts || alerts.length === 0) return null;

  return (
    <div className="mb-6 bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-md shadow-sm">
      <div className="flex">
        <div className="flex-shrink-0">
          <ExclamationTriangleIcon className="h-5 w-5 text-yellow-400" aria-hidden="true" />
        </div>
        <div className="ml-3">
          <h3 className="text-sm font-medium text-yellow-800">
            Perhatian: {alerts.length} Kendaraan dengan STNK Segera Habis
          </h3>
          <div className="mt-2 text-sm text-yellow-700">
            <ul role="list" className="list-disc pl-5 space-y-1">
              {alerts.slice(0, 5).map((kendaraan) => {
                 const daysLeft = Math.ceil((new Date(kendaraan.tanggalMatiStnk).getTime() - new Date().getTime()) / (1000 * 3600 * 24));
                 return (
                    <li key={kendaraan.platNomor}>
                        <span className="font-semibold">{kendaraan.platNomor}</span> ({kendaraan.merk}) - 
                        STNK mati pada {new Date(kendaraan.tanggalMatiStnk).toLocaleDateString('id-ID')} 
                        <span className={daysLeft < 0 ? "text-red-600 font-bold ml-1" : "ml-1"}>
                            ({daysLeft < 0 ? `Telat ${Math.abs(daysLeft)} hari` : `${daysLeft} hari lagi`})
                        </span>
                    </li>
                 )
              })}
              {alerts.length > 5 && <li>...dan {alerts.length - 5} lainnya</li>}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
