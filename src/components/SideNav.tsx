'use client'

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { PowerIcon, Bars3Icon, XMarkIcon, ChevronDownIcon, ArrowRightOnRectangleIcon, CubeIcon } from '@heroicons/react/24/outline';
import { useState } from 'react';
import clsx from 'clsx';
import { links, NavLink } from './nav-links';
import { logout } from '@/lib/actions';
import { ConfirmationModal } from '@/components/ui/confirmation-modal';
import toast from 'react-hot-toast';
import { useAuth } from '@/components/AuthProvider';

interface SideNavProps {
  isMinimized: boolean;
  setIsMinimized: (isMinimized: boolean) => void;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}

export default function SideNav({ isMinimized, setIsMinimized, isOpen, setIsOpen }: SideNavProps) {
  const pathname = usePathname();
  const { role } = useAuth();
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [openSubmenus, setOpenSubmenus] = useState<Record<string, boolean>>(
    links.reduce((acc, link) => {
      if (link.subLinks) {
        acc[link.name] = false;
      }
      return acc;
    }, {} as Record<string, boolean>)
  );

  const visibleLinks: NavLink[] = links.filter((link) => {
    const userRole = role?.toUpperCase() || '';

    if (userRole && !['ADMIN', 'PEMILIK', 'KASIR', 'MANAGER'].includes(userRole)) {
      return link.name === 'Absensi'
    }
    
    // Menu Akun Pengguna hanya untuk ADMIN dan PEMILIK
    if (link.name === 'Akun Pengguna') {
      return userRole === 'ADMIN' || userRole === 'PEMILIK';
    }

    if (link.name === 'Audit Trail' || link.name === 'Recycle Bin') {
      return userRole === 'ADMIN';
    }

    if (link.name === 'Hutang Bank') {
      return userRole === 'ADMIN' || userRole === 'PEMILIK';
    }

    if (link.name === 'Monitoring Absensi') {
      return userRole === 'ADMIN' || userRole === 'PEMILIK' || userRole === 'KASIR';
    }

    // Role SUPIR memiliki batasan akses menu tertentu
    if (userRole === 'SUPIR') {
      return !['Kebun', 'Gajian', 'Kendaraan', 'Kasir', 'Jurnal', 'Pabrik Sawit', 'Supir', 'Inventory', 'Laporan Biaya', 'Audit Trail', 'Hutang Bank'].includes(link.name);
    }

    // Role MANDOR: akses menu Kebun dan Timbangan
    if (userRole === 'MANDOR') {
      return ['Kebun', 'Timbangan'].includes(link.name);
    }

    // Role MANAGER: akses menu Kebun dan Timbangan saja
    if (userRole === 'MANAGER') {
      return ['Kebun', 'Timbangan'].includes(link.name);
    }

    return true;
  });

  const toggleSubmenu = (key: string) => {
    setOpenSubmenus(prevOpenSubmenus => {
      const isCurrentlyOpen = !!prevOpenSubmenus[key];
      
      const newOpenSubmenus: Record<string, boolean> = {};
      Object.keys(prevOpenSubmenus).forEach(k => {
        newOpenSubmenus[k] = false;
      });

      if (!isCurrentlyOpen) {
        newOpenSubmenus[key] = true;
      }

      return newOpenSubmenus;
    });
  };

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

  return (
    <>
      <ConfirmationModal 
        isOpen={isLogoutModalOpen}
        onClose={() => setIsLogoutModalOpen(false)}
        onConfirm={handleLogout}
        title="Konfirmasi Logout"
        description="Apakah Anda yakin ingin keluar dari aplikasi?"
      />

      {/* Overlay - Visible on small screens when menu is open */}
      <div
        onClick={() => setIsOpen(false)}
        className={clsx(
          'fixed inset-0 bg-black bg-opacity-50 z-30 md:hidden',
          {
            'block': isOpen,
            'hidden': !isOpen,
          }
        )}
      />

      {/* Side Navigation */}
      <div
        className={clsx(
          'fixed top-0 left-0 h-full bg-white border-r border-gray-200 text-gray-600 flex flex-col transform transition-all duration-300 ease-in-out z-40',
          {
            'translate-x-0': isOpen,
            '-translate-x-full md:translate-x-0': !isOpen,
            'w-64': !isMinimized,
            'w-20': isMinimized,
          }
        )}
      >
        <div className={clsx("flex h-full flex-col py-6", { "px-4": !isMinimized, "px-2": isMinimized })}>
          <div className={clsx("flex items-center mb-8 h-10", { 'justify-center': isMinimized, 'justify-start px-2': !isMinimized })}>
            <Link
              href="/"
              onClick={(e) => {
                window.dispatchEvent(new Event('nav:start'));
                setIsOpen(false);
              }}
              className="flex items-center gap-x-3"
            >
              <div className="bg-emerald-600 text-white p-1.5 rounded-lg">
                <CubeIcon className="w-6 h-6" />
              </div>
              <p className={clsx("text-xl font-bold text-gray-800 tracking-wide", { "hidden": isMinimized })}>
                SARAKAN
              </p>
            </Link>
            <button
              onClick={() => setIsOpen(false)}
              className="md:hidden ml-auto p-1 rounded-md text-gray-500 hover:bg-gray-100"
              aria-label="Close navigation"
            >
              <XMarkIcon className="w-6 h-6" />
            </button>
          </div>

          <div className="flex grow flex-col justify-between space-y-4 overflow-y-auto custom-scrollbar">
            <div className="flex flex-col w-full space-y-1">
              {!isMinimized && (
                 <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-2">Menu</p>
              )}
              {visibleLinks.map((link) => {
                const LinkIcon = link.icon;
                const isActive = pathname === link.href || (link.href !== '/' && pathname.startsWith(`${link.href}/`));

                if (link.subLinks) {
                  return (
                    <div key={link.name} className="mb-1">
                      <div
                        className={clsx('flex items-center text-sm rounded-xl transition-colors duration-200 group', {
                          'bg-emerald-600 text-white shadow-md': isActive,
                          'text-gray-600 hover:bg-gray-50 hover:text-emerald-600': !isActive,
                          'w-full': !isMinimized,
                          'w-9 h-9 justify-center mx-auto': isMinimized,
                        })}
                      >
                        <Link
                            href={link.href}
                            onClick={(e) => {
                                window.dispatchEvent(new Event('nav:start'));
                                setIsOpen(false);
                            }}
                            className={clsx("flex flex-1 items-center rounded-l-xl", {
                                "justify-center": isMinimized,
                                "px-4 py-3": !isMinimized,
                                "h-full w-full rounded-xl": isMinimized
                            })}
                        >
                             <LinkIcon className={clsx("w-6 h-6", { "mr-3": !isMinimized, "text-white": isActive, "text-gray-700 group-hover:text-emerald-600": !isActive })} />
                             {!isMinimized && <span className="font-medium">{link.name}</span>}
                        </Link>
                        
                        {!isMinimized && (
                             <button
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    toggleSubmenu(link.name);
                                }}
                                className="px-4 py-3 rounded-r-xl hover:bg-black/5 transition-colors"
                             >
                                <ChevronDownIcon className={clsx("w-4 h-4 transition-transform duration-200", { "transform rotate-180": openSubmenus[link.name] })} />
                             </button>
                        )}
                      </div>
                      
                      {openSubmenus[link.name] && !isMinimized && (
                        <div className="flex flex-col space-y-1 mt-1 ml-4 border-l-2 border-gray-100 pl-2">
                          {link.subLinks.map((subLink) => (
                            <Link key={subLink.name} href={subLink.href} onClick={(e) => { window.dispatchEvent(new Event('nav:start')); setIsOpen(false); }} 
                            className={clsx('block py-2.5 px-4 text-sm rounded-lg transition-colors', {
                              'text-emerald-600 font-medium bg-emerald-50': pathname.startsWith(subLink.href),
                              'text-gray-500 hover:text-gray-800 hover:bg-gray-50': !pathname.startsWith(subLink.href),
                            })}
                            >
                              <span className="truncate">{subLink.name}</span>
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                }

                return (
                  <Link
                    key={link.name}
                    href={link.href}
                    onClick={(e) => { window.dispatchEvent(new Event('nav:start')); setIsOpen(false); }}
                    title={isMinimized ? link.name : undefined}
                    className={clsx('flex items-center mb-1 text-sm rounded-xl transition-all duration-200 group', {
                      'bg-emerald-600 text-white shadow-md': isActive,
                      'text-gray-600 hover:bg-gray-50 hover:text-emerald-600': !isActive,
                      'justify-center w-9 h-9 mx-auto': isMinimized,
                      'w-full px-4 py-3': !isMinimized,
                    })}
                  >
                    <LinkIcon className={clsx("w-6 h-6 flex-shrink-0", { "mr-3": !isMinimized, "text-white": isActive, "text-gray-700 group-hover:text-emerald-600": !isActive })} />
                    <span className={clsx("font-medium truncate", { 'hidden': isMinimized })}>{link.name}</span>
                    {/* Add a notification badge for 'Nota Sawit' as an example if needed, similar to 'Messages' in the image */}
                    {link.name === 'Nota Sawit' && !isMinimized && !isActive && (
                         <span className="ml-auto bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">New</span>
                    )}
                  </Link>
                );
              })}
            </div>
            
            <div className="space-y-1 pt-4 border-t border-gray-100">
               {!isMinimized && (
                 <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-2">Support</p>
              )}
              <button
                onClick={() => setIsMinimized(!isMinimized)}
                title={isMinimized ? 'Expand' : 'Minimize'}
                className={clsx('flex items-center text-sm rounded-xl text-gray-600 hover:bg-gray-50 hover:text-emerald-600 transition-colors', {
                  'justify-center w-9 h-9 mx-auto': isMinimized,
                  'w-full px-4 py-3': !isMinimized,
                })}
              >
                <ArrowRightOnRectangleIcon className={clsx("w-6 h-6 flex-shrink-0 transition-transform", { "transform rotate-180": isMinimized, "mr-3": !isMinimized })} />
                <span className={clsx("font-medium", { 'hidden': isMinimized })}>Minimize</span>
              </button>
              
              <button
                onClick={() => setIsLogoutModalOpen(true)}
                title={isMinimized ? 'Sign Out' : undefined}
                className={clsx('flex items-center text-sm rounded-xl text-gray-600 hover:bg-red-50 hover:text-red-600 transition-colors', {
                  'justify-center w-9 h-9 mx-auto': isMinimized,
                  'w-full px-4 py-3': !isMinimized,
                })}
              >
                  <PowerIcon className={clsx("w-6 h-6 flex-shrink-0", { "mr-3": !isMinimized })} />
                  <span className={clsx("font-medium", { 'hidden': isMinimized })}>Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
