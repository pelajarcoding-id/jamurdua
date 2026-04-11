'use client'

import React, { useEffect, useRef, useState, Dispatch, SetStateAction } from 'react'
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  SortingState,
} from '@tanstack/react-table'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Input } from './input'
import { Skeleton } from '@/components/ui/skeleton'

// Define the new props interface
interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  refreshData: () => void;
  page: number;
  limit: number;
  totalItems: number;
  onPageChange: Dispatch<SetStateAction<number>>;
  onLimitChange: Dispatch<SetStateAction<number>>;
  showPageSizeSelector?: boolean;
  pageSizeOptions?: number[];
  showFooter?: boolean;
  searchQuery: string;
  onSearchChange: Dispatch<SetStateAction<string>>;
  startDate?: Date;
  onStartDateChange?: (date: Date | undefined) => void;
  endDate?: Date;
  onEndDateChange?: (date: Date | undefined) => void;
  onAdd?: () => void;
  addLabel?: string;
  searchPlaceholder?: string;
  isLoading?: boolean;
  dateFilterStyle?: 'grouped' | 'separate';
  extraFilters?: React.ReactNode;
  renderMobileCards?: (params: { data: TData[]; isLoading: boolean }) => React.ReactNode;
  virtualize?: {
    enabled: boolean;
    rowHeight: number;
    maxHeight?: number;
  };
}

export function DataTable<TData, TValue>({
  columns,
  data,
  refreshData,
  page,
  limit,
  totalItems,
  onPageChange,
  onLimitChange,
  showPageSizeSelector = false,
  pageSizeOptions = [10, 20, 50, 100],
  showFooter = false,
  searchQuery,
  onSearchChange,
  startDate,
  onStartDateChange,
  endDate,
  onEndDateChange,
  onAdd,
  addLabel = 'Tambah',
  searchPlaceholder = 'Cari data...',
  isLoading = false,
  dateFilterStyle = 'grouped',
  extraFilters,
  renderMobileCards,
  virtualize,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>([]);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    manualPagination: true,
    manualFiltering: true,
    manualSorting: false,
    pageCount: Math.ceil(totalItems / limit),
    state: {
      sorting,
      pagination: {
        pageIndex: page - 1,
        pageSize: limit,
      },
    },
  })

  const totalPages = Math.ceil(totalItems / limit);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);

  useEffect(() => {
    if (!virtualize?.enabled) return;
    const el = scrollRef.current;
    const updateHeight = () => setContainerHeight(el ? el.clientHeight : 0);
    updateHeight();
    const ro = new ResizeObserver(updateHeight);
    if (el) ro.observe(el);
    return () => ro.disconnect();
  }, [virtualize]);

  const rowsSafe = (() => {
    try {
      const rm = table?.getRowModel?.()
      const r = rm && Array.isArray((rm as any).rows) ? (rm as any).rows as any[] : []
      return r || []
    } catch {
      return [] as any[]
    }
  })()

  const safePageSizeOptions = Array.from(new Set((pageSizeOptions || []).filter((n) => Number.isFinite(n) && n > 0))).sort((a, b) => a - b)
  const hasFooter = showFooter && table.getFooterGroups().some((g) => g.headers.some((h) => (h.column.columnDef as any).footer))

  return (
    <div>
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-6 gap-4">
        <div className="flex flex-col md:flex-row flex-wrap items-start md:items-center gap-4 flex-1 w-full lg:w-auto">
          <div className="w-full md:w-64 flex-shrink-0">
            <Input
              placeholder={searchPlaceholder}
              value={searchQuery}
              onChange={(event) => onSearchChange(event.target.value)}
              className="input-style rounded-xl"
            />
          </div>
          {onStartDateChange && onEndDateChange && (
            dateFilterStyle === 'grouped' ? (
              <div className="w-full md:w-auto flex items-center gap-2 bg-gray-50 p-1 rounded-xl border border-gray-200 overflow-x-auto">
                <Input
                  type="date"
                  value={startDate?.toISOString().split('T')[0] || ''}
                  onChange={(e) => onStartDateChange(e.target.value ? new Date(e.target.value) : undefined)}
                  className="border-none bg-transparent shadow-none focus:ring-0 text-sm w-auto flex-1 min-w-0"
                />
                <span className="text-gray-400">-</span>
                <Input
                  type="date"
                  value={endDate?.toISOString().split('T')[0] || ''}
                  onChange={(e) => onEndDateChange(e.target.value ? new Date(e.target.value) : undefined)}
                  className="border-none bg-transparent shadow-none focus:ring-0 text-sm w-auto flex-1 min-w-0"
                />
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row items-center gap-2 w-full lg:w-auto">
                <Input
                  type="date"
                  value={startDate?.toISOString().split('T')[0] || ''}
                  onChange={(e) => onStartDateChange(e.target.value ? new Date(e.target.value) : undefined)}
                  className="w-full rounded-xl"
                />
                <span className="hidden sm:inline">s/d</span>
                <span className="sm:hidden text-sm text-gray-500 my-1">sampai dengan</span>
                <Input
                  type="date"
                  value={endDate?.toISOString().split('T')[0] || ''}
                  onChange={(e) => onEndDateChange(e.target.value ? new Date(e.target.value) : undefined)}
                  className="w-full rounded-xl"
                />
              </div>
            )
          )}
          {extraFilters}
        </div>
        {onAdd && (
          <button onClick={onAdd} className="btn-primary flex items-center justify-center gap-2 whitespace-nowrap w-full lg:w-auto">
            {addLabel}
          </button>
        )}
      </div>
      {renderMobileCards && (
        <div className="md:hidden">
          {renderMobileCards({ data, isLoading })}
        </div>
      )}
      <div className={`w-full overflow-hidden rounded-xl border border-gray-100${renderMobileCards ? ' hidden md:block' : ''}`}>
        <div
          ref={scrollRef}
          className="w-full overflow-x-auto"
          style={virtualize?.enabled ? { contentVisibility: 'auto', overflowY: 'auto', maxHeight: virtualize.maxHeight ? `${virtualize.maxHeight}vh` : undefined } : undefined}
          onScroll={virtualize?.enabled ? (e) => setScrollTop((e.target as HTMLElement).scrollTop) : undefined}
        >
          <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-2 py-2 md:px-6 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                    {{ asc: ' 🔼', desc: ' 🔽' }[header.column.getIsSorted() as string] ?? null}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {isLoading ? (
              [...Array(5)].map((_, i) => (
                <tr key={i}>
                  {columns.map((_, j) => (
                    <td key={j} className="px-2 py-2 md:px-6 md:py-4">
                      <Skeleton className="h-4 w-full" />
                    </td>
                  ))}
                </tr>
              ))
            ) : rowsSafe.length > 0 ? (
              virtualize?.enabled ? (
                (() => {
                  const rows = rowsSafe;
                  const total = rows.length;
                  const rh = virtualize.rowHeight;
                  const start = Math.max(0, Math.floor(scrollTop / rh));
                  const visible = Math.max(1, Math.ceil((containerHeight || 1) / rh) + 5);
                  const end = Math.min(total, start + visible);
                  const topSpacer = start * rh;
                  const bottomSpacer = (total - end) * rh;
                  const slice = rows.slice(start, end);
                  return (
                    <>
                      <tr>
                        <td colSpan={columns.length} style={{ height: topSpacer }} />
                      </tr>
                      {slice.map((row: any) => (
                        <tr key={row.id}>
                          {row.getVisibleCells().map((cell: any) => (
                            <td key={cell.id} className="px-2 py-2 text-xs md:px-6 md:py-4 md:text-sm text-gray-700">
                              {flexRender(cell.column.columnDef.cell, cell.getContext())}
                            </td>
                          ))}
                        </tr>
                      ))}
                      <tr>
                        <td colSpan={columns.length} style={{ height: bottomSpacer }} />
                      </tr>
                    </>
                  )
                })()
              ) : (
                rowsSafe.map((row: any) => (
                  <tr key={row.id}>
                    {row.getVisibleCells().map((cell: any) => (
                      <td key={cell.id} className="px-2 py-2 text-xs md:px-6 md:py-4 md:text-sm text-gray-700">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))
              )
            ) : (
              <tr>
                  <td colSpan={columns.length} className="h-24 text-center text-xs md:text-sm">
                    Tidak ada data.
                  </td>
                </tr>
            )}
          </tbody>
          {hasFooter ? (
            <tfoot className="bg-gray-50 border-t border-gray-200">
              {table.getFooterGroups().map((footerGroup) => (
                <tr key={footerGroup.id}>
                  {footerGroup.headers.map((header) => (
                    <td key={header.id} className="px-2 py-2 text-xs md:px-6 md:py-3 md:text-sm font-semibold text-gray-900">
                      {header.isPlaceholder ? null : flexRender(header.column.columnDef.footer, header.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tfoot>
          ) : null}
        </table>
        </div>
      </div>
      <div className="flex flex-col md:flex-row items-center justify-between mt-4 gap-4">
        <span className="text-xs md:text-sm text-gray-700">
          Halaman {page} dari {totalPages > 0 ? totalPages : 1}
        </span>
        <div className="flex flex-col sm:flex-row items-center gap-3">
          {showPageSizeSelector ? (
            <div className="flex items-center gap-2">
              <span className="text-xs md:text-sm text-gray-700">Per halaman</span>
              <select
                className="h-9 rounded-md border border-gray-300 bg-white px-2 text-xs md:text-sm"
                value={String(limit)}
                onChange={(e) => {
                  const next = Number(e.target.value)
                  onLimitChange(next)
                  onPageChange(1)
                }}
              >
                {(safePageSizeOptions.length > 0 ? safePageSizeOptions : [10, 20, 50, 100]).map((n) => (
                  <option key={n} value={String(n)}>{n}</option>
                ))}
              </select>
            </div>
          ) : null}
          <div className="flex items-center space-x-2">
          <button
            onClick={() => onPageChange(page - 1)}
            disabled={page === 1}
            className="px-4 py-2 text-xs md:text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
          >
            Sebelumnya
          </button>
          <button
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            className="px-4 py-2 text-xs md:text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
          >
            Berikutnya
          </button>
          </div>
        </div>
      </div>
    </div>
  )
}
