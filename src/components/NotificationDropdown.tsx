'use client'

import useSWR from 'swr';
import { BellIcon, ExclamationTriangleIcon, DocumentTextIcon, CheckCircleIcon, TrashIcon, ShoppingCartIcon, XCircleIcon, BanknotesIcon } from '@heroicons/react/24/outline';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/components/AuthProvider';
import toast from 'react-hot-toast';

type NotificationItem = {
    id: string;
    dbId?: number;
    type: string;
    title: string;
    message: string;
    date: string;
    link?: string;
    isRead?: boolean;
    source: 'database' | 'system';
};

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function NotificationDropdown() {
    const { data: notifications, isLoading, mutate: refreshNotifications } = useSWR<NotificationItem[]>('/api/notifications', fetcher, {
        refreshInterval: 30000 // Poll every 30 seconds
    });
    const router = useRouter();
    const { id: userId } = useAuth();
    const [isMobile, setIsMobile] = useState(false);
    const [open, setOpen] = useState(false);

    const [isSubscribed, setIsSubscribed] = useState(false);

    useEffect(() => {
        if ('serviceWorker' in navigator && 'PushManager' in window) {
            navigator.serviceWorker.ready.then(registration => {
                registration.pushManager.getSubscription().then(subscription => {
                    setIsSubscribed(!!subscription);
                });
            });
        }
    }, []);

    const subscribeUser = async () => {
        if (!('serviceWorker' in navigator)) {
            toast.error('Browser tidak mendukung Push Notifikasi');
            return;
        }
        
        const toastId = toast.loading('Memulai proses aktivasi...');
        
        try {
            const keyRes = await fetch('/api/notifications/vapid-public', { cache: 'no-store' })
            const keyJson = await keyRes.json().catch(() => ({} as any))
            const publicKey = String(keyJson?.publicKey || '').trim()
            if (!publicKey) {
                toast.error('Konfigurasi VAPID Key tidak ditemukan.', { id: toastId })
                return
            }

            // 0. Explicit Permission Request
            toast.loading('Meminta izin notifikasi...', { id: toastId });
            const permission = await Notification.requestPermission();
            
            if (permission !== 'granted') {
                toast.error('Izin notifikasi ditolak. Mohon izinkan di pengaturan browser.', { id: toastId });
                return;
            }

            // Check Secure Context
            if (!window.isSecureContext && window.location.hostname !== 'localhost') {
                toast.error('Push Notifikasi memerlukan HTTPS', { id: toastId });
                return;
            }

            // 1. Get or Register SW
            toast.loading('Mendaftarkan Service Worker...', { id: toastId });
            let registration = await navigator.serviceWorker.getRegistration();
            if (!registration) {
                 try {
                     registration = await navigator.serviceWorker.register('/sw.js');
                 } catch (err) {
                     console.error('Failed to register sw.js:', err);
                     // Fallback to custom-sw.js if sw.js fails (maybe not built yet)
                     try {
                         registration = await navigator.serviceWorker.register('/custom-sw.js');
                     } catch (err2) {
                         throw new Error(`Gagal register SW: ${err instanceof Error ? err.message : String(err)}`);
                     }
                 }
            }

            if (!registration) {
                throw new Error('Gagal mendapatkan objek registrasi Service Worker.');
            }

            const readyRegistration = await navigator.serviceWorker.ready
            registration = readyRegistration || registration

            if (!navigator.serviceWorker.controller) {
                toast.loading('Mengaktifkan Service Worker…', { id: toastId })
                await new Promise<void>((resolve) => {
                    const timeout = setTimeout(() => resolve(), 3000)
                    navigator.serviceWorker.addEventListener('controllerchange', () => {
                        clearTimeout(timeout)
                        resolve()
                    }, { once: true })
                })
            }

            if (!navigator.serviceWorker.controller) {
                toast.error('Service Worker belum aktif. Silakan refresh halaman lalu coba lagi.', { id: toastId })
                return
            }

            // 2. Wait for Active State
            // PushManager requires an ACTIVE service worker controller
            if (!registration.active) {
                toast.loading('Menunggu Service Worker aktif...', { id: toastId });
                await new Promise<void>((resolve, reject) => {
                    // Check every 200ms
                    const interval = setInterval(() => {
                        if (registration?.active) {
                            clearInterval(interval);
                            resolve();
                        }
                    }, 200);

                    // Timeout after 5s
                    setTimeout(() => {
                        clearInterval(interval);
                        // Don't reject, just resolve and hope for the best or let it fail downstream
                        console.warn('Timeout waiting for active SW');
                        resolve();
                    }, 5000);
                });
            }

            // Force update to ensure we have the latest version
            if (registration.active) {
                try {
                    // registration.update();
                } catch (e) {
                    console.warn('Failed to update SW', e);
                }
            }

            // Helper to convert VAPID key
            const urlBase64ToUint8Array = (base64String: string) => {
                const padding = '='.repeat((4 - base64String.length % 4) % 4);
                const base64 = (base64String + padding)
                    .replace(/\-/g, '+')
                    .replace(/_/g, '/');
                const rawData = window.atob(base64);
                const outputArray = new Uint8Array(rawData.length);
                for (let i = 0; i < rawData.length; ++i) {
                    outputArray[i] = rawData.charCodeAt(i);
                }
                return outputArray;
            };

            toast.loading('Mendaftarkan push subscription...', { id: toastId });
            let sub = await registration.pushManager.getSubscription();
            if (!sub) {
                sub = await registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: urlBase64ToUint8Array(publicKey)
                });
            }

            toast.loading('Menyimpan ke server...', { id: toastId });
            const res = await fetch('/api/notifications/subscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(sub)
            });

            if (!res.ok) {
                throw new Error('Gagal menyimpan langganan ke server');
            }

            setIsSubscribed(true);
            toast.success('Push notifikasi berhasil diaktifkan!', { id: toastId });
        } catch (error) {
            console.error('Failed to subscribe:', error);
            toast.error(`Gagal: ${error instanceof Error ? error.message : 'Kesalahan tidak diketahui'}`, { id: toastId });
        }
    };

    const unreadCount = notifications?.filter(n => !n.isRead).length || 0;
    const hasNotifications = notifications && notifications.length > 0;

    useEffect(() => {
        const mq = window.matchMedia('(max-width: 640px)');
        setIsMobile(mq.matches);
        const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
        mq.addEventListener?.('change', handler);
        return () => mq.removeEventListener?.('change', handler);
    }, []);

    const handleItemClick = async (notification: NotificationItem) => {
        // Mark as read if it's a DB notification
        if (notification.source === 'database' && !notification.isRead && notification.dbId) {
            try {
                await fetch('/api/notifications', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: notification.dbId })
                });
                // Optimistically update local state or revalidate
                refreshNotifications();
            } catch (error) {
                console.error('Error marking notification as read:', error);
            }
        }

        if (notification.link) {
            router.push(notification.link);
        }
    };

    const handleDelete = async (e: React.MouseEvent, notification: NotificationItem) => {
        e.stopPropagation();
        if (notification.source === 'database' && notification.dbId) {
            try {
                await fetch(`/api/notifications?id=${notification.dbId}`, {
                    method: 'DELETE',
                });
                refreshNotifications();
            } catch (error) {
                console.error('Error deleting notification:', error);
            }
        }
    };

    const handleClearAll = async () => {
        try {
            toast.dismiss();
            toast.loading('Membersihkan notifikasi…');
            const res = await fetch('/api/notifications?all=true', { method: 'DELETE' });
            toast.dismiss();
            if (!res.ok) {
                toast.error('Gagal membersihkan notifikasi');
                return;
            }
            toast.success('Semua notifikasi dibersihkan');
            refreshNotifications();
        } catch (e) {
            console.error(e);
            toast.error('Gagal membersihkan notifikasi');
        }
    };

    const getIcon = (type: string) => {
        switch (type) {
            case 'STNK':
                return <ExclamationTriangleIcon className="w-5 h-5 text-yellow-500" />;
            case 'BILL':
                return <BanknotesIcon className="w-5 h-5 text-orange-500" />;
            case 'NOTA_SAWIT':
                return <DocumentTextIcon className="w-5 h-5 text-blue-500" />;
            case 'PERMINTAAN_KEBUN':
                return <ShoppingCartIcon className="w-5 h-5 text-purple-500" />;
            case 'KARYAWAN_DELETE_REQUEST':
                return <TrashIcon className="w-5 h-5 text-red-500" />;
            case 'SUCCESS':
                return <CheckCircleIcon className="w-5 h-5 text-green-500" />;
            case 'ERROR':
                return <XCircleIcon className="w-5 h-5 text-red-500" />;
            default:
                return <CheckCircleIcon className="w-5 h-5 text-gray-500" />;
        }
    };

    if (isMobile) {
        return (
            <>
                <button
                    className="relative p-2 rounded-full hover:bg-gray-100 transition-colors text-gray-500 focus:outline-none"
                    onClick={() => setOpen(true)}
                    aria-label="Buka notifikasi"
                >
                    <BellIcon className="w-6 h-6" />
                    {unreadCount > 0 && (
                        <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white animate-pulse"></span>
                    )}
                </button>
                <Dialog open={open} onOpenChange={setOpen}>
                    <DialogContent className="w-[92vw] sm:w-96 rounded-2xl p-0 max-h-[80vh] overflow-hidden [&>button]:hidden">
                        <DialogHeader className="px-4 py-3 border-b border-gray-100">
                            <div className="flex items-center justify-between gap-3">
                                <DialogTitle className="min-w-0 truncate">Notifikasi</DialogTitle>
                                {userId && hasNotifications && (
                                    <Button size="icon" variant="outline" className="rounded-full h-8 w-8 shrink-0 text-gray-700" onClick={handleClearAll} aria-label="Bersihkan notifikasi">
                                        <TrashIcon className="w-4 h-4 text-gray-700" />
                                    </Button>
                                )}
                            </div>
                        </DialogHeader>
                        <div className="max-h-[60vh] overflow-y-auto">
                            {isLoading ? (
                                <div className="p-4 text-center text-sm text-gray-500">Memuat...</div>
                            ) : hasNotifications ? (
                                <div className="divide-y divide-gray-50">
                                    {notifications?.map((notification) => (
                                        <div
                                            key={notification.id}
                                            className={cn(
                                                "px-4 py-3 cursor-pointer hover:bg-gray-50 flex items-start gap-3",
                                                !notification.isRead && notification.source === 'database' ? "bg-blue-50/50" : ""
                                            )}
                                            onClick={() => { handleItemClick(notification); setOpen(false); }}
                                        >
                                            <div className="flex-shrink-0 mt-0.5">
                                                {getIcon(notification.type)}
                                            </div>
                                            <div className="flex-1 space-y-1">
                                                <p className={cn("text-sm font-medium text-gray-800", !notification.isRead && notification.source === 'database' ? "font-bold" : "")}>
                                                    {notification.title}
                                                </p>
                                                <p className="text-xs text-gray-500">
                                                    {notification.message}
                                                </p>
                                                <p className="text-[10px] text-gray-400">
                                                    {new Date(notification.date).toLocaleDateString('id-ID', {
                                                        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                                                    })}
                                                </p>
                                            </div>
                                            <div className="flex flex-col items-end gap-2">
                                                {!notification.isRead && notification.source === 'database' && (
                                                    <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                                                )}
                                                {notification.source === 'database' && (
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleDelete(e, notification); }}
                                                        className="p-1 rounded-full hover:bg-red-100 text-gray-400 hover:text-red-500 transition-colors"
                                                        title="Hapus Notifikasi"
                                                    >
                                                        <TrashIcon className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="p-8 text-center">
                                    <p className="text-sm text-gray-500">Tidak ada notifikasi baru</p>
                                </div>
                            )}
                        </div>
                        
                        {!isSubscribed && (
                            <div className="p-3 border-t border-gray-100 bg-gray-50">
                                <Button 
                                    variant="outline" 
                                    size="sm" 
                                    className="w-full text-xs text-blue-600 border-blue-200 hover:bg-blue-50"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        subscribeUser();
                                    }}
                                >
                                    Aktifkan Push Notifikasi
                                </Button>
                            </div>
                        )}
                    </DialogContent>
                </Dialog>
            </>
        );
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <button className="relative p-2 rounded-full hover:bg-gray-100 transition-colors text-gray-500 focus:outline-none" aria-label="Buka notifikasi">
                    <BellIcon className="w-6 h-6" />
                    {unreadCount > 0 && (
                        <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white animate-pulse"></span>
                    )}
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80 bg-white shadow-xl border border-gray-100 rounded-xl">
                <DropdownMenuLabel className="font-bold text-gray-800 px-4 py-3 flex justify-between items-center">
                    <span>Notifikasi</span>
                    <div className="flex items-center gap-2">
                        {unreadCount > 0 && (
                            <span className="text-xs font-normal text-white bg-red-500 px-2 py-0.5 rounded-full">{unreadCount} baru</span>
                        )}
                        {userId && hasNotifications && (
                            <Button size="icon" variant="outline" className="rounded-full h-7 w-7 text-gray-700" onClick={handleClearAll} aria-label="Bersihkan notifikasi">
                                <TrashIcon className="w-4 h-4 text-gray-700" />
                            </Button>
                        )}
                    </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                
                {isLoading ? (
                    <div className="p-4 text-center text-sm text-gray-500">Memuat...</div>
                ) : hasNotifications ? (
                    <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
                        {notifications?.map((notification) => (
                            <DropdownMenuItem 
                                key={notification.id} 
                                className={cn(
                                    "px-4 py-3 cursor-pointer hover:bg-gray-50 focus:bg-gray-50 flex items-start gap-3 border-b border-gray-50 last:border-0",
                                    !notification.isRead && notification.source === 'database' ? "bg-blue-50/50" : ""
                                )}
                                onClick={() => handleItemClick(notification)}
                            >
                                <div className="flex-shrink-0 mt-0.5">
                                    {getIcon(notification.type)}
                                </div>
                                <div className="flex-1 space-y-1">
                                    <p className={cn("text-sm font-medium text-gray-800", !notification.isRead && notification.source === 'database' ? "font-bold" : "")}>
                                        {notification.title}
                                    </p>
                                    <p className="text-xs text-gray-500 line-clamp-2">
                                        {notification.message}
                                    </p>
                                    <p className="text-[10px] text-gray-400">
                                        {new Date(notification.date).toLocaleDateString('id-ID', {
                                            day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                                        })}
                                    </p>
                                </div>
                                
                                <div className="flex flex-col items-end gap-2">
                                    {!notification.isRead && notification.source === 'database' && (
                                        <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                                    )}
                                    
                                    {notification.source === 'database' && (
                                        <button 
                                            onClick={(e) => handleDelete(e, notification)}
                                            className="p-1 rounded-full hover:bg-red-100 text-gray-400 hover:text-red-500 transition-colors"
                                            title="Hapus Notifikasi"
                                        >
                                            <TrashIcon className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                            </DropdownMenuItem>
                        ))}
                    </div>
                ) : (
                    <div className="p-8 text-center">
                        <p className="text-sm text-gray-500">Tidak ada notifikasi baru</p>
                    </div>
                )}
                
                {!isSubscribed && (
                    <>
                        <DropdownMenuSeparator />
                        <div className="p-2">
                            <Button 
                                variant="ghost" 
                                size="sm" 
                                className="w-full text-xs text-blue-600 justify-center h-8"
                                onClick={(e) => {
                                    e.preventDefault();
                                    subscribeUser();
                                }}
                            >
                                Aktifkan Push Notifikasi
                            </Button>
                        </div>
                    </>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
