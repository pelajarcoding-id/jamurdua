'use client'

import { useCallback, useEffect, useMemo, useState, type SetStateAction } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { DataTable } from '@/components/ui/data-table';
import { ColumnDef } from '@tanstack/react-table';
import { format } from 'date-fns';
import { useDebounce } from 'use-debounce';
import RoleGate from '@/components/RoleGate';
import {
    Dialog,
    DialogContent,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { EyeIcon } from "@heroicons/react/24/outline"
import { Skeleton } from "@/components/ui/skeleton"
import { ModalHeader } from '@/components/ui/modal-elements'

type AuditLog = {
    id: number;
    user: { name: string; email: string };
    action: string;
    entity: string;
    entityId: string;
    details: any;
    createdAt: string;
};

function buildColumns(onViewDetail: (log: AuditLog) => void): ColumnDef<AuditLog>[] {
    return [
        {
            accessorKey: 'createdAt',
            header: 'Waktu',
            cell: ({ row }) => format(new Date(row.original.createdAt), 'dd/MM/yyyy HH:mm'),
        },
        {
            accessorKey: 'user.name',
            header: 'User',
        },
        {
            accessorKey: 'action',
            header: 'Aksi',
            cell: ({ row }) => (
                <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                    row.original.action === 'CREATE' ? 'bg-green-100 text-green-800' :
                    row.original.action === 'UPDATE' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'
                }`}>
                    {row.original.action}
                </span>
            )
        },
        {
            accessorKey: 'entity',
            header: 'Modul',
        },
        {
            id: 'details',
            header: 'Detail',
            cell: ({ row }) => (
                <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => onViewDetail(row.original)}
                >
                    <EyeIcon className="h-4 w-4 text-emerald-600" />
                    <span className="sr-only">Lihat Detail</span>
                </Button>
            )
        }
    ];
}

export default function AuditTrailPage() {
    const [data, setData] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(10);
    const [totalItems, setTotalItems] = useState(0);
    const [search, setSearch] = useState('');
    const [debouncedSearch] = useDebounce(search, 500);
    const [detailOpen, setDetailOpen] = useState(false)
    const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null)
    const searchParams = useSearchParams();
    const pathname = usePathname();
    const router = useRouter();

    useEffect(() => {
        const q = searchParams.get('search') || '';
        if (q !== search) setSearch(q);
    }, [searchParams, search]);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const res = await fetch(`/api/audit-trail?page=${page}&limit=${limit}&search=${debouncedSearch}`);
                const json = await res.json();
                setData(json.data);
                setTotalItems(json.total);
            } catch (error) {
                console.error(error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [page, limit, debouncedSearch]);

    const handleOpenDetail = useCallback((log: AuditLog) => {
        setSelectedLog(log)
        setDetailOpen(true)
    }, [])

    const tableColumns = useMemo(() => buildColumns(handleOpenDetail), [handleOpenDetail])

    return (
        <RoleGate allow={['ADMIN']}>
            <div className="p-6">
                <h1 className="text-2xl font-bold mb-6">Audit Trail (Log Aktivitas)</h1>
                <div className="bg-white p-6 rounded-lg shadow">
                    <DataTable
                        columns={tableColumns}
                        data={data}
                        renderMobileCards={({ data, isLoading }) => (
                            <div className="space-y-3">
                                {isLoading ? (
                                    Array.from({ length: 4 }).map((_, i) => (
                                        <div key={i} className="rounded-2xl border border-gray-100 bg-white p-4 space-y-3">
                                            <Skeleton className="h-4 w-32" />
                                            <Skeleton className="h-4 w-40" />
                                            <Skeleton className="h-4 w-24" />
                                        </div>
                                    ))
                                ) : !data || data.length === 0 ? (
                                    <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/50 p-6 text-center text-sm text-gray-500">
                                        Tidak ada audit log
                                    </div>
                                ) : (
                                    (data || []).map((item) => (
                                        <div key={item.id} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm space-y-3">
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="space-y-1">
                                                    <div className="font-semibold text-gray-900">{item.user?.name || '-'}</div>
                                                    <div className="text-xs text-gray-500">{item.user?.email || '-'}</div>
                                                    <div className="text-xs text-gray-500">{format(new Date(item.createdAt), 'dd/MM/yyyy HH:mm')}</div>
                                                </div>
                                                <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                                                    item.action === 'CREATE' ? 'bg-green-100 text-green-800' :
                                                    item.action === 'UPDATE' ? 'bg-yellow-100 text-yellow-800' :
                                                    'bg-red-100 text-red-800'
                                                }`}>
                                                    {item.action}
                                                </span>
                                            </div>
                                            <div className="grid grid-cols-2 gap-2 text-xs">
                                                <div>
                                                    <div className="text-gray-400">Modul</div>
                                                    <div className="font-semibold text-gray-900">{item.entity}</div>
                                                </div>
                                                <div>
                                                    <div className="text-gray-400">ID</div>
                                                    <div className="font-semibold text-gray-900">{item.entityId}</div>
                                                </div>
                                            </div>
                                            <div className="flex justify-end pt-1">
                                                <Button size="sm" variant="outline" className="rounded-full" onClick={() => handleOpenDetail(item)}>
                                                    <EyeIcon className="h-4 w-4 mr-2 text-emerald-600" />
                                                    Detail
                                                </Button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}
                        page={page}
                        limit={limit}
                        totalItems={totalItems}
                        onPageChange={setPage}
                        onLimitChange={setLimit}
                        searchQuery={search}
                        onSearchChange={(value: SetStateAction<string>) => {
                            const next = typeof value === 'function' ? value(search) : value;
                            setSearch(next);
                            const params = new URLSearchParams(searchParams.toString());
                            if (next) {
                                params.set('search', next);
                            } else {
                                params.delete('search');
                            }
                            router.replace(`${pathname}?${params.toString()}`);
                        }}
                        isLoading={loading}
                        searchPlaceholder="Cari user, aksi, atau modul..."
                        refreshData={() => {}}
                    />
                </div>
            </div>

            <Dialog open={detailOpen} onOpenChange={(open) => { if (!open) setSelectedLog(null); setDetailOpen(open) }}>
                <DialogContent className="w-[96vw] sm:w-auto max-w-2xl max-h-[92vh] p-0 overflow-hidden rounded-2xl shadow-2xl border-none flex flex-col [&>button.absolute]:hidden">
                    <ModalHeader
                        title="Detail Aktivitas"
                        subtitle={selectedLog ? `ID Entitas: ${selectedLog.entityId}` : ''}
                        variant="emerald"
                        icon={<EyeIcon className="h-5 w-5 text-white" />}
                        onClose={() => setDetailOpen(false)}
                    />
                    {selectedLog ? (
                        <div className="p-6 flex-1 min-h-0 overflow-y-auto bg-gray-50/30 space-y-6">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg border">
                                <div>
                                    <p className="text-xs text-gray-500 font-medium uppercase">Waktu</p>
                                    <p className="text-sm font-semibold">{format(new Date(selectedLog.createdAt), 'dd/MM/yyyy HH:mm')}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500 font-medium uppercase">User</p>
                                    <p className="text-sm font-semibold">{selectedLog.user?.name || '-'}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500 font-medium uppercase">Aksi</p>
                                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${
                                        selectedLog.action === 'CREATE' ? 'bg-green-100 text-green-700' :
                                        selectedLog.action === 'UPDATE' ? 'bg-yellow-100 text-yellow-700' :
                                        'bg-red-100 text-red-700'
                                    }`}>
                                        {selectedLog.action}
                                    </span>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500 font-medium uppercase">Modul</p>
                                    <p className="text-sm font-semibold">{selectedLog.entity}</p>
                                </div>
                            </div>
                            <div>
                                <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                                    <span className="w-1 h-4 bg-emerald-600 rounded-full"></span>
                                    Perubahan Data
                                </h4>
                                <div className="bg-slate-900 rounded-lg p-4 overflow-x-auto">
                                    <pre className="text-xs text-emerald-100 font-mono whitespace-pre-wrap">
                                        {JSON.stringify(selectedLog.details, null, 2)}
                                    </pre>
                                </div>
                            </div>
                        </div>
                    ) : null}
                </DialogContent>
            </Dialog>
        </RoleGate>
    );
}
