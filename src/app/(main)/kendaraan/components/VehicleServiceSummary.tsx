import { prisma } from '@/lib/prisma';

export default async function VehicleServiceSummary({
  platNomor,
  startDateISO,
  endDateISO,
}: {
  platNomor: string;
  startDateISO?: string;
  endDateISO?: string;
}) {
  const start = startDateISO ? new Date(startDateISO) : undefined;
  const end = endDateISO ? new Date(endDateISO) : undefined;
  if (end) end.setDate(end.getDate() + 1);
  const where = {
    kendaraanPlat: platNomor,
    ...(start || end
      ? {
          date: {
            ...(start ? { gte: start } : {}),
            ...(end ? { lt: end } : {}),
          },
        }
      : {}),
  };
  const [agg, total] = await Promise.all([
    prisma.serviceLog.aggregate({ where, _sum: { cost: true } }),
    prisma.serviceLog.count({ where }),
  ]);
  const sum = Number(agg._sum.cost || 0);
  return (
    <div className="flex flex-wrap items-center gap-2 mb-3">
      <div className="rounded-md bg-gray-50 px-3 py-2 text-sm">
        Pengeluaran Servis: Rp {new Intl.NumberFormat('id-ID').format(sum)}
      </div>
      <div className="rounded-md bg-gray-50 px-3 py-2 text-sm">
        Total Entri: {total}
      </div>
    </div>
  );
}
