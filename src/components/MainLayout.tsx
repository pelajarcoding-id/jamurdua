'use client'

import { useState, useEffect, useRef } from 'react';
import SideNav from '@/components/SideNav';
import clsx from 'clsx';
import { Bars3Icon, UserCircleIcon, ArrowRightOnRectangleIcon } from '@heroicons/react/24/outline';
import { useAuth } from '@/components/AuthProvider';
import Link from 'next/link';
import { logout } from '@/lib/actions';
import { ConfirmationModal } from '@/components/ui/confirmation-modal';
import toast from 'react-hot-toast';
import NotificationDropdown from './NotificationDropdown';
import { SWRConfig } from 'swr';
import PwaReloadButton from '@/components/PwaReloadButton';

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const [isMinimized, setIsMinimized] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const { name, role } = useAuth();
  const canViewNotification = ['ADMIN', 'PEMILIK', 'KASIR'].includes(String(role || '').toUpperCase())
  const profileMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setIsProfileMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleLogout = async () => {
    setIsLogoutModalOpen(false);
    try {
      await logout();
      toast.success('Berhasil logout!');
      setTimeout(() => {
        window.location.href = '/login';
      }, 1000);
    } catch (error) {
      toast.error('Gagal logout');
      console.error('Logout error:', error);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };


  return (
    <SWRConfig value={{ revalidateOnFocus: false, dedupingInterval: 3000, provider: () => new Map() }}>
    <div className="min-h-screen w-full bg-gray-50 font-sans text-gray-900 overflow-x-hidden">
      <ConfirmationModal 
        isOpen={isLogoutModalOpen}
        onClose={() => setIsLogoutModalOpen(false)}
        onConfirm={handleLogout}
        title="Konfirmasi Logout"
        description="Apakah Anda yakin ingin keluar dari aplikasi?"
        variant="emerald"
      />
      <SideNav isMinimized={isMinimized} setIsMinimized={setIsMinimized} isOpen={isMobileMenuOpen} setIsOpen={setIsMobileMenuOpen} />
      
      <div className={clsx("flex flex-col min-h-screen transition-all duration-300 ease-in-out max-w-full", {
        "md:ml-64": !isMinimized,
        "md:ml-20": isMinimized,
      })}>
        {/* Top Header */}
        <header className="h-20 bg-white px-6 md:px-8 flex items-center justify-between sticky top-0 z-30 shadow-sm">
          <div className="flex items-center gap-3">
            <button 
              className="md:hidden p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200"
              onClick={() => setIsMobileMenuOpen(true)}
              aria-label="Open menu"
            >
              <Bars3Icon className="w-6 h-6" />
            </button>
            <h1 className="text-2xl font-bold text-gray-800 hidden md:block">Dashboard Keuangan</h1>
          </div>
          
          <div className="flex items-center space-x-6 flex-1 md:flex-none justify-end md:justify-start">
            <div className="flex items-center space-x-4">
              {canViewNotification ? <NotificationDropdown /> : null}
              <PwaReloadButton />
              
              <div className="relative" ref={profileMenuRef}>
                <button 
                  onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                  className="flex items-center space-x-3 pl-4 border-l border-gray-100 focus:outline-none hover:bg-gray-50 rounded-lg p-2 transition-colors"
                >
                  <div className="text-right hidden lg:block">
                    <p className="text-sm font-bold text-gray-800 capitalize">{name || 'User'}</p>
                    <p className="text-xs text-gray-500 capitalize">{role || 'Role'}</p>
                  </div>
                  <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold border-2 border-white shadow-sm">
                    {name ? getInitials(name) : 'U'}
                  </div>
                </button>

                {/* Dropdown Menu */}
                {isProfileMenuOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-50 animate-in fade-in zoom-in-95 duration-200">
                    <div className="px-4 py-3 border-b border-gray-100 lg:hidden">
                      <p className="text-sm font-bold text-gray-800 capitalize">{name || 'User'}</p>
                      <p className="text-xs text-gray-500 capitalize">{role || 'Role'}</p>
                    </div>
                    
                    <Link 
                      href="/profile" 
                      className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                      onClick={() => setIsProfileMenuOpen(false)}
                    >
                      <UserCircleIcon className="w-5 h-5 text-gray-400" />
                      <span>Profile</span>
                    </Link>
                    
                    <button
                      onClick={() => {
                        setIsProfileMenuOpen(false);
                        setIsLogoutModalOpen(true);
                      }}
                      className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors text-left"
                    >
                      <ArrowRightOnRectangleIcon className="w-5 h-5" />
                      <span>Logout</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 p-4 md:p-8 w-full max-w-full">
          {children}
        </main>
      </div>
    </div>
    </SWRConfig>
  );
}
