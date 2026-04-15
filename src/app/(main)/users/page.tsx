'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { DataTable } from '@/components/ui/data-table'
import { columns, UserData, formatUserName } from './columns'
import { UserModal, ConfirmationModal } from './modal'
import { DetailModal } from './detail-modal'
import toast from 'react-hot-toast'
import RoleGate from '@/components/RoleGate'
import { PlusIcon, EllipsisHorizontalIcon } from '@heroicons/react/24/outline'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

export default function UsersPage() {
  const [data, setData] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [limit, setLimit] = useState(10);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const q = searchParams.get('search') || '';
    setSearchQuery((prev) => (prev === q ? prev : q))
  }, [searchParams]);

  const handleSearchChange = useCallback((value: string) => {
    const next = String(value || '').trim()
    setSearchQuery(next)
    setPage(1)
    const params = new URLSearchParams(searchParams.toString())
    if (next) params.set('search', next)
    else params.delete('search')
    router.replace(`${pathname}?${params.toString()}`)
  }, [pathname, router, searchParams])

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const startDateString = startDate?.toISOString() || '';
      const endDateString = endDate?.toISOString() || '';
      const q = String(searchQuery || '').trim()
      const res = await fetch(`/api/users?page=${page}&limit=${limit}&search=${encodeURIComponent(q)}&startDate=${startDateString}&endDate=${endDateString}`, { cache: 'no-store' });
      if (!res.ok) throw new Error('Gagal mengambil data');
      const usersData = await res.json();
      setData(usersData.data);
      setTotalItems(usersData.total);
    } catch (error) {
      toast.error('Gagal memuat data. Coba lagi nanti.');
    } finally {
      setLoading(false);
    }
  }, [page, limit, searchQuery, startDate, endDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleOpenModal = useCallback((user: UserData | null = null) => {
    setSelectedUser(user);
    setIsModalOpen(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setSelectedUser(null);
    setIsModalOpen(false);
  }, []);

  const handleOpenDetail = useCallback((user: UserData) => {
    setSelectedUser(user);
    setIsDetailOpen(true);
  }, []);

  const handleCloseDetail = useCallback(() => {
    setSelectedUser(null);
    setIsDetailOpen(false);
  }, []);

  const handleOpenConfirm = useCallback((user: UserData) => {
    setSelectedUser(user);
    setIsConfirmOpen(true);
  }, []);

  const handleCloseConfirm = useCallback(() => {
    setIsConfirmOpen(false);
    setSelectedUser(null);
  }, []);

  const handleSave = useCallback(async (formDataObj: any) => {
    const isEditing = !!selectedUser;
    
    const previousData = [...data];
    const previousTotal = totalItems;

    // Create a temporary object for UI display
    // Note: Photo handling is complex for optimistic UI, so we might see a delay in photo update
    // or we could use URL.createObjectURL(formDataObj.photo) if we wanted to be fancy.
    // For now, we update the text fields immediately.
    
    if (isEditing) {
        setData(prev => prev.map(item => item.id === selectedUser.id ? { ...item, ...formDataObj, photoUrl: item.photoUrl } : item));
    } else {
        const tempId = Math.random();
        const newItem = { 
            id: tempId, 
            ...formDataObj, 
            photoUrl: null, // Placeholder or null until server confirms
            createdAt: new Date().toISOString(), 
            updatedAt: new Date().toISOString() 
        };
        setData(prev => [newItem, ...prev]);
        setTotalItems(prev => prev + 1);
    }
    
    handleCloseModal();

    const url = isEditing ? `/api/users/${selectedUser.id}` : '/api/users';
    const method = isEditing ? 'PUT' : 'POST';

    let toastId: string | undefined
    try {
      toastId = toast.loading(isEditing ? 'Memperbarui pengguna...' : 'Menambahkan pengguna...')

      let finalPhotoUrl = formDataObj.photoUrl || '';

      if (formDataObj.photo) {
        const uploadFormData = new FormData();
        uploadFormData.append('file', formDataObj.photo);
        
        const uploadRes = await fetch('/api/upload', {
            method: 'POST',
            body: uploadFormData
        });

        if (uploadRes.ok) {
            const uploadData = await uploadRes.json();
            if (uploadData.success) {
                finalPhotoUrl = uploadData.url;
            } else {
                throw new Error(`Gagal upload foto: ${uploadData.error}`);
            }
        } else {
           throw new Error('Gagal upload foto: Server Error');
        }
      }

      const payload = {
        name: formDataObj.name,
        email: formDataObj.email,
        role: formDataObj.role,
        jenisPekerjaan: (formDataObj.jenisPekerjaan && formDataObj.jenisPekerjaan !== 'none') ? formDataObj.jenisPekerjaan : '',
        kebunId: formDataObj.kebunId,
        kebunIds: formDataObj.kebunIds,
        password: formDataObj.password,
        oldPassword: formDataObj.oldPassword,
        photoUrl: finalPhotoUrl,
      };

      const res = await fetch(url, { 
        method, 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload) 
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Gagal menyimpan data');
      }

      fetchData();
      toast.success(`Pengguna berhasil ${isEditing ? 'diperbarui' : 'ditambahkan'}`, { id: toastId })
    } catch (error: any) {
      setData(previousData);
      setTotalItems(previousTotal);
      if (toastId) toast.dismiss(toastId)
      toast.error(error.message || 'Gagal menyimpan data, mengembalikan perubahan.');
    }
  }, [selectedUser, data, totalItems, fetchData, handleCloseModal]);

  const handleDelete = useCallback(async () => {
    if (!selectedUser) return;

    const previousData = [...data];
    const previousTotal = totalItems;

    setData(prev => prev.filter(item => item.id !== selectedUser.id));
    setTotalItems(prev => prev - 1);
    handleCloseConfirm();

    let toastId: string | undefined
    try {
      toastId = toast.loading('Menghapus pengguna...')
      const res = await fetch(`/api/users/${selectedUser.id}`, { method: 'DELETE' });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Gagal menghapus data');
      }

      fetchData();
      toast.success('Pengguna berhasil dihapus', { id: toastId })
    } catch (error: any) {
      setData(previousData);
      setTotalItems(previousTotal);
      if (toastId) toast.dismiss(toastId)
      toast.error(error.message || 'Gagal menghapus data, mengembalikan perubahan.');
    }
  }, [selectedUser, data, totalItems, fetchData, handleCloseConfirm]);

  const tableColumns = useMemo(
    () => columns(handleOpenModal, handleOpenConfirm, handleOpenDetail),
    [handleOpenModal, handleOpenConfirm, handleOpenDetail]
  );

  const refreshData = useCallback(() => {
    fetchData();
  }, [fetchData]);

  const getRoleClass = useCallback((role: string) => {
    switch (role) {
      case "ADMIN":
        return "bg-red-500"
      case "PEMILIK":
        return "bg-blue-500"
      case "KASIR":
        return "bg-green-500"
      case "MANDOR":
        return "bg-amber-500"
      case "MANAGER":
        return "bg-indigo-500"
      default:
        return "bg-gray-500"
    }
  }, [])

  return (
    <main className="p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Akun Pengguna</h1>
          <p className="text-sm text-gray-500 mt-1">Untuk admin/manager yang memiliki akses login aplikasi.</p>
        </div>
        <RoleGate allow={["ADMIN", "PEMILIK"]}>
            <div className="bg-white p-6 rounded-lg shadow-md">
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
                    ) : data.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/50 p-6 text-center text-sm text-gray-500">
                        Tidak ada pengguna
                      </div>
                    ) : (
                      data.map((user) => (
                        <div
                          key={user.id}
                          onClick={() => handleOpenDetail(user)}
                          className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm space-y-3 transition-colors hover:bg-gray-50/50"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3">
                              {user.photoUrl ? (
                                <img src={user.photoUrl} alt={user.name} className="h-10 w-10 rounded-full object-cover" />
                              ) : (
                                <div className="h-10 w-10 rounded-full bg-gray-100" />
                              )}
                              <div className="space-y-1">
                                <div className="font-semibold text-gray-900">{formatUserName(user.name)}</div>
                                <div className="text-xs text-gray-500">{user.email}</div>
                              </div>
                            </div>
                            <Badge className={getRoleClass(user.role)}>{user.role}</Badge>
                          </div>
                          {user.kebuns?.length ? (
                            <div className="text-xs text-gray-500">
                              {user.kebuns.map(k => k.name).join(', ')}
                            </div>
                          ) : null}
                          <div className="flex justify-end pt-1">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button size="sm" variant="outline" className="rounded-full" onClick={(e) => e.stopPropagation()}>
                                  <EllipsisHorizontalIcon className="h-4 w-4 mr-2" />
                                  Aksi
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="bg-white">
                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleOpenDetail(user); }}>
                                  Detail
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleOpenModal(user); }}>
                                  Ubah
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleOpenModal(user); }}>
                                  Reset Password
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleOpenConfirm(user); }} className="text-red-500">
                                  Hapus
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
                refreshData={refreshData}
                page={page}
                limit={limit}
                totalItems={totalItems}
                onPageChange={setPage}
                onLimitChange={setLimit}
                searchQuery={searchQuery}
                onSearchChange={handleSearchChange}
                startDate={startDate}
                onStartDateChange={setStartDate}
                endDate={endDate}
                onEndDateChange={setEndDate}

                searchPlaceholder="Cari nama atau email..."
                isLoading={loading}
                showPageSizeSelector
                pageSizeOptions={[10, 20, 50, 100]}
            />
            </div>
            
            <button
                onClick={() => handleOpenModal()}
                className="fixed bottom-6 right-6 w-14 h-14 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center z-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
                title="Tambah Pengguna"
            >
                <PlusIcon className="w-8 h-8" />
            </button>
        </RoleGate>
      </div>

      <UserModal 
        key={selectedUser ? selectedUser.id : 'new-user'}
        isOpen={isModalOpen} 
        onClose={handleCloseModal} 
        onConfirm={handleSave} 
        title={selectedUser ? 'Ubah Pengguna' : 'Tambah Pengguna'}
        initialData={selectedUser}
      />

      <DetailModal
        isOpen={isDetailOpen}
        onClose={handleCloseDetail}
        user={selectedUser}
      />

      <ConfirmationModal
        isOpen={isConfirmOpen}
        onClose={handleCloseConfirm}
        onConfirm={handleDelete}
        title="Konfirmasi Hapus"
        description="Apakah Anda yakin ingin menghapus pengguna ini?"
      />
    </main>
  )
}
