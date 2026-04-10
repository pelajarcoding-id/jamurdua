'use client'

import { useRef } from 'react';
import { useReactToPrint } from 'react-to-print';
import { TimbanganData } from './columns';
import { Button } from "@/components/ui/button";
import PrintableTimbangan from './printable-timbangan';
import { DocumentDuplicateIcon, MapPinIcon, CalendarIcon, UserIcon, TruckIcon, ArrowUpIcon, ArrowDownIcon, ScaleIcon, PencilSquareIcon, PhotoIcon, XMarkIcon, PrinterIcon } from '@heroicons/react/24/outline';
import { ModalContentWrapper, ModalFooter, ModalHeader } from '@/components/ui/modal-elements'

interface ModalDetailProps {
  timbangan: TimbanganData;
  onClose: () => void;
}

const formatDate = (date: Date) => new Date(date).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });

function DetailRow({ label, value, icon }: { label: string; value: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2 border-b border-gray-100">
      <p className="text-sm font-medium text-gray-600 flex items-center gap-2">
        {icon}
        {label}
      </p>
      <p className="text-sm text-gray-900 text-right">{value}</p>
    </div>
  );
}

export default function ModalDetail({ timbangan, onClose }: ModalDetailProps) {
  const componentRef = useRef<HTMLDivElement>(null);
  const handlePrint = useReactToPrint({
    contentRef: componentRef,
    documentTitle: `Timbangan - ${timbangan.kebun.name} - ${formatDate(timbangan.date)}`,
  });

  if (!timbangan) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4">
      <div className="bg-white rounded-xl sm:rounded-2xl shadow-2xl w-[90%] max-w-lg transform transition-all max-h-[90vh] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        <ModalHeader
          title="Detail Timbangan"
          subtitle="Rincian data timbang kebun"
          variant="emerald"
          icon={<DocumentDuplicateIcon className="h-5 w-5 text-white" />}
          onClose={onClose}
        />

        <ModalContentWrapper className="space-y-4">
            <DetailRow label="Kebun" value={timbangan.kebun.name} icon={<MapPinIcon className="h-4 w-4 text-blue-500" />} />
            <DetailRow label="Tanggal" value={formatDate(timbangan.date)} icon={<CalendarIcon className="h-4 w-4 text-blue-500" />} />
            <DetailRow label="Supir" value={timbangan.supir?.name || '-'} icon={<UserIcon className="h-4 w-4 text-blue-500" />} />
            <DetailRow label="Kendaraan" value={timbangan.kendaraan?.platNomor || '-'} icon={<TruckIcon className="h-4 w-4 text-blue-500" />} />
            <DetailRow label="Bruto" value={`${timbangan.grossKg.toLocaleString('id-ID')} kg`} icon={<ArrowUpIcon className="h-4 w-4 text-emerald-600" />} />
            <DetailRow label="Tara" value={`${timbangan.tareKg.toLocaleString('id-ID')} kg`} icon={<ArrowDownIcon className="h-4 w-4 text-amber-600" />} />
            <DetailRow label="Netto" value={`${timbangan.netKg.toLocaleString('id-ID')} kg`} icon={<ScaleIcon className="h-4 w-4 text-indigo-600" />} />
            <DetailRow label="Catatan" value={timbangan.notes || '-'} icon={<PencilSquareIcon className="h-4 w-4 text-blue-500" />} />
            {timbangan.photoUrl && (
              <div className="py-2">
                <p className="text-sm font-medium text-gray-600 flex items-center gap-2">
                  <PhotoIcon className="h-4 w-4 text-blue-500" />
                  Foto
                </p>
                <div className="mt-2">
                  <img src={timbangan.photoUrl} alt="Foto Timbangan" className="rounded-xl max-w-full h-auto border border-gray-100" />
                </div>
              </div>
            )}
        </ModalContentWrapper>

        <ModalFooter>
          <Button className="rounded-full w-full sm:w-auto" variant="outline" onClick={onClose}>
            <XMarkIcon className="h-4 w-4 mr-2" />
            Tutup
          </Button>
          <Button className="rounded-full w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700" onClick={handlePrint}>
            <PrinterIcon className="h-4 w-4 mr-2" />
            Cetak
          </Button>
        </ModalFooter>
      </div>
      <div style={{ display: "none" }}>
        <PrintableTimbangan ref={componentRef} timbangan={timbangan} />
      </div>
    </div>
  );
}
