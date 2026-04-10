'use client'
import { useMemo, useState } from 'react';
import useSWR from 'swr';
import Link from 'next/link'
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  BarChart, Bar, Legend, Cell
} from 'recharts';
import {
  ClipboardDocumentListIcon,
  ScaleIcon,
  CurrencyDollarIcon,
  CalendarIcon,
  TruckIcon,
  UserIcon,
  BuildingOffice2Icon,
  MapIcon,
  WalletIcon,
  CreditCardIcon,
  UsersIcon,
  ArrowRightIcon
} from '@heroicons/react/24/outline';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/components/AuthProvider';
import VehicleExpirySection from '@/components/dashboard/VehicleExpirySection';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { id as idLocale } from 'date-fns/locale'

const fetcher = (url: string) => fetch(url, { cache: 'no-store' }).then((res) => res.json());

const formatCurrency = (value: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value);
const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
}

type QuickLink = {
  title: string
  subtitle: string
  href: string
  icon: any
  color: 'blue' | 'emerald' | 'violet' | 'gray'
  roles?: string[]
}

const QUICK_LINKS: QuickLink[] = [
  {
    title: 'Nota Sawit',
    subtitle: 'Input & cek nota',
    href: '/nota-sawit',
    icon: ClipboardDocumentListIcon,
    color: 'blue',
    roles: ['ADMIN', 'KASIR', 'PEMILIK', 'SUPIR'],
  },
  {
    title: 'Kasir',
    subtitle: 'Transaksi kas',
    href: '/kasir',
    icon: CreditCardIcon,
    color: 'emerald',
    roles: ['ADMIN', 'KASIR', 'PEMILIK'],
  },
  {
    title: 'Karyawan',
    subtitle: 'Data & hutang',
    href: '/karyawan',
    icon: UsersIcon,
    color: 'gray',
    roles: ['ADMIN', 'PEMILIK', 'MANAGER'],
  },
  {
    title: 'Gajian',
    subtitle: 'Proses gaji kebun',
    href: '/gajian',
    icon: WalletIcon,
    color: 'violet',
    roles: ['ADMIN', 'KASIR', 'PEMILIK'],
  },
]

export default function Dashboard() {
  const { role, name, loading: loadingAuth } = useAuth();
  const defaultMonthStart = useMemo(() => {
    const d = new Date()
    d.setDate(1)
    return d.toISOString().split('T')[0]
  }, [])

  const defaultToday = useMemo(() => new Date().toISOString().split('T')[0], [])

  const [productionStartDate, setProductionStartDate] = useState(defaultMonthStart)
  const [productionEndDate, setProductionEndDate] = useState(defaultToday)
  const [productionQuickRange, setProductionQuickRange] = useState<'today' | 'yesterday' | 'last_week' | 'last_30_days' | 'this_month' | 'custom' | ''>('this_month')

  const [financeStartDate, setFinanceStartDate] = useState(defaultMonthStart)
  const [financeEndDate, setFinanceEndDate] = useState(defaultToday)
  const [financeQuickRange, setFinanceQuickRange] = useState<'today' | 'yesterday' | 'last_week' | 'last_30_days' | 'this_month' | 'custom' | ''>('this_month')

  const statsUrl = useMemo(() => {
    const sp = new URLSearchParams()
    if (productionStartDate) sp.set('productionStartDate', productionStartDate)
    if (productionEndDate) sp.set('productionEndDate', productionEndDate)
    if (financeStartDate) sp.set('financeStartDate', financeStartDate)
    if (financeEndDate) sp.set('financeEndDate', financeEndDate)
    const qs = sp.toString()
    return qs ? `/api/dashboard/stats?${qs}` : '/api/dashboard/stats'
  }, [productionStartDate, productionEndDate, financeStartDate, financeEndDate])

  function formatDateRangeLabel(start: string, end: string) {
    if (!start || !end) return 'Rentang Waktu'
    const s = new Date(start)
    const e = new Date(end)
    if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return 'Rentang Waktu'
    return `${format(s, 'dd MMM yyyy', { locale: idLocale })} - ${format(e, 'dd MMM yyyy', { locale: idLocale })}`
  }

  function applyQuickRangeProduction(range: 'today' | 'yesterday' | 'last_week' | 'last_30_days' | 'this_month') {
    const today = new Date()
    const start = new Date(today)
    const end = new Date(today)
    start.setHours(0, 0, 0, 0)
    end.setHours(0, 0, 0, 0)

    if (range === 'today') {
      setProductionStartDate(start.toISOString().split('T')[0])
      setProductionEndDate(end.toISOString().split('T')[0])
    } else if (range === 'yesterday') {
      start.setDate(start.getDate() - 1)
      end.setDate(end.getDate() - 1)
      setProductionStartDate(start.toISOString().split('T')[0])
      setProductionEndDate(end.toISOString().split('T')[0])
    } else if (range === 'last_week') {
      start.setDate(start.getDate() - 6)
      setProductionStartDate(start.toISOString().split('T')[0])
      setProductionEndDate(end.toISOString().split('T')[0])
    } else if (range === 'last_30_days') {
      start.setDate(start.getDate() - 29)
      setProductionStartDate(start.toISOString().split('T')[0])
      setProductionEndDate(end.toISOString().split('T')[0])
    } else if (range === 'this_month') {
      start.setDate(1)
      setProductionStartDate(start.toISOString().split('T')[0])
      setProductionEndDate(end.toISOString().split('T')[0])
    }
    setProductionQuickRange(range)
  }

  function applyQuickRangeFinance(range: 'today' | 'yesterday' | 'last_week' | 'last_30_days' | 'this_month') {
    const today = new Date()
    const start = new Date(today)
    const end = new Date(today)
    start.setHours(0, 0, 0, 0)
    end.setHours(0, 0, 0, 0)

    if (range === 'today') {
      setFinanceStartDate(start.toISOString().split('T')[0])
      setFinanceEndDate(end.toISOString().split('T')[0])
    } else if (range === 'yesterday') {
      start.setDate(start.getDate() - 1)
      end.setDate(end.getDate() - 1)
      setFinanceStartDate(start.toISOString().split('T')[0])
      setFinanceEndDate(end.toISOString().split('T')[0])
    } else if (range === 'last_week') {
      start.setDate(start.getDate() - 6)
      setFinanceStartDate(start.toISOString().split('T')[0])
      setFinanceEndDate(end.toISOString().split('T')[0])
    } else if (range === 'last_30_days') {
      start.setDate(start.getDate() - 29)
      setFinanceStartDate(start.toISOString().split('T')[0])
      setFinanceEndDate(end.toISOString().split('T')[0])
    } else if (range === 'this_month') {
      start.setDate(1)
      setFinanceStartDate(start.toISOString().split('T')[0])
      setFinanceEndDate(end.toISOString().split('T')[0])
    }
    setFinanceQuickRange(range)
  }

  const { data: stats, isLoading: loadingStats, error: statsError } = useSWR(statsUrl, fetcher, {
    refreshInterval: 15000,
    revalidateOnFocus: true,
    dedupingInterval: 5000,
  });

  const allCards = [
    { 
      key: 'notaCount', 
      title: "Nota Sawit", 
      value: stats?.notaCount ?? 0, 
      icon: ClipboardDocumentListIcon, 
      color: "blue",
      roles: ['ADMIN', 'KASIR', 'PEMILIK', 'SUPIR']
    },
    { 
      key: 'timbanganCount', 
      title: "Timbangan", 
      value: stats?.timbanganCount ?? 0, 
      icon: ScaleIcon, 
      color: "green",
      roles: ['ADMIN', 'KASIR', 'PEMILIK', 'SUPIR']
    },
    { 
      key: 'uangJalanCount', 
      title: "Uang Jalan", 
      value: stats?.uangJalanCount ?? 0, 
      icon: CurrencyDollarIcon, 
      color: "yellow",
      roles: ['ADMIN', 'KASIR', 'PEMILIK', 'SUPIR']
    },
    { 
      key: 'kendaraanCount', 
      title: "Kendaraan", 
      value: stats?.kendaraanCount ?? 0, 
      icon: TruckIcon, 
      color: "purple",
      roles: ['ADMIN', 'KASIR', 'PEMILIK']
    },
    { 
      key: 'supirCount', 
      title: "Supir", 
      value: stats?.supirCount ?? 0, 
      icon: UserIcon, 
      color: "blue",
      roles: ['ADMIN', 'KASIR', 'PEMILIK']
    },
    { 
      key: 'pabrikCount', 
      title: "Pabrik Sawit", 
      value: stats?.pabrikCount ?? 0, 
      icon: BuildingOffice2Icon, 
      color: "green",
      roles: ['ADMIN', 'KASIR', 'PEMILIK']
    },
    { 
      key: 'kebunCount', 
      title: "Kebun", 
      value: stats?.kebunCount ?? 0, 
      icon: MapIcon, 
      color: "yellow",
      roles: ['ADMIN', 'KASIR', 'PEMILIK']
    },
    { 
      key: 'gajianCount', 
      title: "Gajian", 
      value: stats?.gajianCount ?? 0, 
      icon: WalletIcon, 
      color: "purple",
      roles: ['ADMIN', 'KASIR', 'PEMILIK']
    },
    { 
      key: 'kasirCount', 
      title: "Kasir", 
      value: stats?.kasirCount ?? 0, 
      icon: CreditCardIcon, 
      color: "blue",
      roles: ['ADMIN', 'KASIR', 'PEMILIK']
    },
    { 
      key: 'userCount', 
      title: "Users", 
      value: stats?.userCount ?? 0, 
      icon: UsersIcon, 
      color: "yellow",
      roles: ['ADMIN', 'PEMILIK']
    },
  ] as const;

  const loading = loadingAuth || loadingStats;
  const visibleCards = role ? allCards.filter(card => (card.roles as readonly string[]).includes(role)) : [];
  const colorMap: Record<string, { bg: string; text: string }> = {
    blue: { bg: 'bg-blue-50/70', text: 'text-blue-700' },
    green: { bg: 'bg-emerald-50/60', text: 'text-emerald-700' },
    yellow: { bg: 'bg-amber-50/70', text: 'text-amber-700' },
    purple: { bg: 'bg-violet-50/70', text: 'text-violet-700' }
  };

  const visibleQuickLinks = useMemo(() => {
    if (!role) return []
    return QUICK_LINKS.filter((l) => !l.roles || l.roles.includes(role))
  }, [role])

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Dashboard</h1>
      {loading ? (
        <div className="mb-8">
          <Skeleton className="h-7 w-64" />
          <div className="mt-6 bg-white p-4 rounded-2xl shadow-sm border border-gray-100 space-y-4">
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-28" />
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[1,2,3,4].map(i => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
            </div>
          </div>
        </div>
      ) : (
        <>
          <p className="text-lg mb-8">Selamat datang kembali, {name || 'User'}!</p>

          {visibleQuickLinks.length > 0 && (
            <div className="mb-6">
              <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
                    <ArrowRightIcon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Akses Cepat</p>
                    <p className="text-xs text-gray-500">Buka menu utama dengan cepat</p>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
                  {visibleQuickLinks.map((item) => {
                    const Icon = item.icon
                    const colorCls = (() => {
                      if (item.color === 'emerald') return 'from-emerald-600 to-emerald-500'
                      if (item.color === 'violet') return 'from-violet-600 to-violet-500'
                      if (item.color === 'gray') return 'from-gray-900 to-gray-700'
                      return 'from-blue-600 to-blue-500'
                    })()
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className="group rounded-2xl border border-gray-100 bg-white hover:bg-gray-50/50 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                      >
                        <div className="p-3 flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className={`h-10 w-10 rounded-2xl bg-gradient-to-r ${colorCls} text-white flex items-center justify-center shadow-sm`}>
                              <Icon className="h-5 w-5" />
                            </div>
                            <div className="mt-3 text-sm font-semibold text-gray-900 truncate">{item.title}</div>
                            <div className="text-xs text-gray-500 truncate">{item.subtitle}</div>
                          </div>
                          <div className="h-8 w-8 rounded-full border border-gray-200 bg-white flex items-center justify-center text-gray-500 group-hover:text-gray-900 group-hover:border-gray-300 transition-colors">
                            <ArrowRightIcon className="h-4 w-4" />
                          </div>
                        </div>
                      </Link>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
          
          <div className="mb-6">
            <VehicleExpirySection />
          </div>

          <div className="mb-6">
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                  <UsersIcon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">Ringkasan Statistik</p>
                  <p className="text-xs text-gray-500">Total data utama sistem</p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {visibleCards.length > 0 ? (
                  visibleCards.map((data, index) => {
                    const color = colorMap[data.color] || colorMap.blue;
                    return (
                      <div key={index} className={`rounded-xl ${color.bg} px-3 py-2`}>
                        <p className={`text-xs ${color.text}`}>{data.title}</p>
                        <p className="text-lg font-semibold text-gray-900">{data.value.toLocaleString('id-ID')}</p>
                      </div>
                    );
                  })
                ) : (
                  <p className="col-span-full text-gray-500">Tidak ada data statistik yang tersedia untuk role Anda.</p>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
            {/* Production Chart */}
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-gray-800">Tren Produksi Sawit</h3>
                    <p className="text-xs text-gray-500 mt-1">{formatDateRangeLabel(productionStartDate, productionEndDate)}</p>
                  </div>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          'h-10 rounded-xl justify-start text-left font-normal bg-white',
                          !(productionStartDate && productionEndDate) && 'text-muted-foreground'
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {formatDateRangeLabel(productionStartDate, productionEndDate)}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[92vw] sm:w-auto p-4 bg-white" align="end">
                      <div className="space-y-4">
                        <div className="space-y-1">
                          <div className="font-semibold leading-none">Rentang Waktu</div>
                          <div className="text-sm text-muted-foreground">Pilih rentang waktu cepat atau kustom</div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <Button variant="outline" size="sm" onClick={() => applyQuickRangeProduction('today')} className={productionQuickRange === 'today' ? 'bg-accent' : ''}>Hari Ini</Button>
                          <Button variant="outline" size="sm" onClick={() => applyQuickRangeProduction('yesterday')} className={productionQuickRange === 'yesterday' ? 'bg-accent' : ''}>Kemarin</Button>
                          <Button variant="outline" size="sm" onClick={() => applyQuickRangeProduction('last_week')} className={productionQuickRange === 'last_week' ? 'bg-accent' : ''}>7 Hari</Button>
                          <Button variant="outline" size="sm" onClick={() => applyQuickRangeProduction('last_30_days')} className={productionQuickRange === 'last_30_days' ? 'bg-accent' : ''}>30 Hari</Button>
                          <Button variant="outline" size="sm" onClick={() => applyQuickRangeProduction('this_month')} className={productionQuickRange === 'this_month' ? 'bg-accent' : ''}>Bulan Ini</Button>
                        </div>
                        <div className="border-t pt-4 space-y-2">
                          <div className="font-semibold leading-none">Kustom</div>
                          <div className="grid gap-2">
                            <div className="grid grid-cols-3 items-center gap-4">
                              <Label className="text-xs">Dari</Label>
                              <Input
                                type="date"
                                className="col-span-2 h-8"
                                value={productionStartDate}
                                onChange={(e) => { setProductionStartDate(e.target.value); setProductionQuickRange('custom') }}
                              />
                            </div>
                            <div className="grid grid-cols-3 items-center gap-4">
                              <Label className="text-xs">Sampai</Label>
                              <Input
                                type="date"
                                className="col-span-2 h-8"
                                value={productionEndDate}
                                onChange={(e) => { setProductionEndDate(e.target.value); setProductionQuickRange('custom') }}
                              />
                            </div>
                          </div>
                        </div>
                        <div className="flex justify-end">
                          <Button variant="outline" size="sm" onClick={() => { setProductionStartDate(''); setProductionEndDate(''); setProductionQuickRange('') }}>Reset</Button>
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="h-64">
                    <div className="w-full h-full min-w-0 min-h-0">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={stats?.productionStats || []}>
                            <defs>
                                <linearGradient id="colorBerat" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis 
                                dataKey="date" 
                                tickFormatter={formatDate} 
                                tick={{fontSize: 12}}
                            />
                            <YAxis tick={{fontSize: 12}} />
                            <RechartsTooltip 
                                formatter={(value: number) => [`${value} kg`, 'Total Berat']}
                                labelFormatter={(label) => formatDate(label as string)}
                            />
                            <Area 
                                type="monotone" 
                                dataKey="total" 
                                stroke="#3b82f6" 
                                fillOpacity={1} 
                                fill="url(#colorBerat)" 
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Financial Chart */}
             <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-gray-800">Ringkasan Keuangan</h3>
                    <p className="text-xs text-gray-500 mt-1">{formatDateRangeLabel(financeStartDate, financeEndDate)}</p>
                  </div>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          'h-10 rounded-xl justify-start text-left font-normal bg-white',
                          !(financeStartDate && financeEndDate) && 'text-muted-foreground'
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {formatDateRangeLabel(financeStartDate, financeEndDate)}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[92vw] sm:w-auto p-4 bg-white" align="end">
                      <div className="space-y-4">
                        <div className="space-y-1">
                          <div className="font-semibold leading-none">Rentang Waktu</div>
                          <div className="text-sm text-muted-foreground">Pilih rentang waktu cepat atau kustom</div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <Button variant="outline" size="sm" onClick={() => applyQuickRangeFinance('today')} className={financeQuickRange === 'today' ? 'bg-accent' : ''}>Hari Ini</Button>
                          <Button variant="outline" size="sm" onClick={() => applyQuickRangeFinance('yesterday')} className={financeQuickRange === 'yesterday' ? 'bg-accent' : ''}>Kemarin</Button>
                          <Button variant="outline" size="sm" onClick={() => applyQuickRangeFinance('last_week')} className={financeQuickRange === 'last_week' ? 'bg-accent' : ''}>7 Hari</Button>
                          <Button variant="outline" size="sm" onClick={() => applyQuickRangeFinance('last_30_days')} className={financeQuickRange === 'last_30_days' ? 'bg-accent' : ''}>30 Hari</Button>
                          <Button variant="outline" size="sm" onClick={() => applyQuickRangeFinance('this_month')} className={financeQuickRange === 'this_month' ? 'bg-accent' : ''}>Bulan Ini</Button>
                        </div>
                        <div className="border-t pt-4 space-y-2">
                          <div className="font-semibold leading-none">Kustom</div>
                          <div className="grid gap-2">
                            <div className="grid grid-cols-3 items-center gap-4">
                              <Label className="text-xs">Dari</Label>
                              <Input
                                type="date"
                                className="col-span-2 h-8"
                                value={financeStartDate}
                                onChange={(e) => { setFinanceStartDate(e.target.value); setFinanceQuickRange('custom') }}
                              />
                            </div>
                            <div className="grid grid-cols-3 items-center gap-4">
                              <Label className="text-xs">Sampai</Label>
                              <Input
                                type="date"
                                className="col-span-2 h-8"
                                value={financeEndDate}
                                onChange={(e) => { setFinanceEndDate(e.target.value); setFinanceQuickRange('custom') }}
                              />
                            </div>
                          </div>
                        </div>
                        <div className="flex justify-end">
                          <Button variant="outline" size="sm" onClick={() => { setFinanceStartDate(''); setFinanceEndDate(''); setFinanceQuickRange('') }}>Reset</Button>
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="h-64">
                    <div className="w-full h-full min-w-0 min-h-0">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={[
                            { name: 'Pemasukan', value: stats?.financialStats?.pemasukan || 0 },
                            { name: 'Pengeluaran', value: stats?.financialStats?.pengeluaran || 0 }
                        ]}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="name" />
                            <YAxis tickFormatter={(value) => `Rp${(value/1000000).toFixed(0)}jt`} width={80}/>
                            <RechartsTooltip formatter={(value: number) => formatCurrency(value)} />
                            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                                <Cell fill="#22c55e" />
                                <Cell fill="#ef4444" />
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                    </div>
                </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
