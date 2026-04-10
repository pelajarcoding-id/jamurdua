'use client'

import { ColumnDef, flexRender, getCoreRowModel, useReactTable, RowSelectionState, Row } from '@tanstack/react-table'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table'
import { EllipsisHorizontalIcon } from "@heroicons/react/24/outline"
import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

import { Skeleton } from "@/components/ui/skeleton"
import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'

interface DataTableProps<TData, TValue> {
    columns: ColumnDef<TData, TValue>[]
    data: TData[]
    meta?: any
    rowSelection?: RowSelectionState
    setRowSelection?: React.Dispatch<React.SetStateAction<RowSelectionState>>
    isLoading?: boolean
    virtualize?: {
        enabled: boolean
        rowHeight: number
        maxHeight?: number
    }
    renderMobileCards?: (params: { data: TData[]; isLoading?: boolean }) => ReactNode
}

export function DataTable<TData, TValue>({ columns, data, meta, rowSelection, setRowSelection, isLoading, virtualize, renderMobileCards }: DataTableProps<TData, TValue>) {
    const table = useReactTable({
        data,
        columns,
        getCoreRowModel: getCoreRowModel(),
        state: {
            rowSelection: rowSelection || {},
        },
        onRowSelectionChange: setRowSelection,
        enableRowSelection: !!rowSelection && !!setRowSelection,
        meta,
    })

    const scrollRef = useRef<HTMLDivElement | null>(null)
    const [scrollTop, setScrollTop] = useState(0)
    const [containerHeight, setContainerHeight] = useState(0)

    useEffect(() => {
        if (!virtualize?.enabled) return
        const el = scrollRef.current
        const updateHeight = () => {
            setContainerHeight(el ? el.clientHeight : 0)
        }
        updateHeight()
        const resizeObserver = new ResizeObserver(updateHeight)
        if (el) resizeObserver.observe(el)
        return () => {
            resizeObserver.disconnect()
        }
    }, [virtualize])

    return (
        <div className="w-full">
            {renderMobileCards && (
                <div className="md:hidden">
                    {renderMobileCards({ data, isLoading })}
                </div>
            )}
            <div className={renderMobileCards ? "hidden md:block" : ""}>
                <div className="w-full overflow-hidden rounded-xl border border-gray-100">
                    <div
                        ref={scrollRef}
                        className="w-full overflow-x-auto"
                        style={virtualize?.enabled ? { contentVisibility: 'auto', overflowY: 'auto', maxHeight: virtualize.maxHeight ? `${virtualize.maxHeight}vh` : undefined } : undefined}
                        onScroll={virtualize?.enabled ? (e) => setScrollTop((e.target as HTMLElement).scrollTop) : undefined}
                    >
                        <Table>
                    <TableHeader>
                        {table.getHeaderGroups().map((headerGroup) => (
                            <TableRow key={headerGroup.id}>
                                {headerGroup.headers.map((header) => {
                                    return (
                                        <TableHead 
                                            key={header.id}
                                            className="whitespace-nowrap px-4 py-3 text-xs md:px-6 md:py-4 md:text-sm font-semibold bg-gray-50/50 text-gray-500 uppercase tracking-wider"
                                        >
                                            {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                                        </TableHead>
                                    )
                                })}
                            </TableRow>
                        ))}
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                             [...Array(5)].map((_, i) => (
                                <TableRow key={i}>
                                    {columns.map((_, j) => (
                                        <TableCell key={j} className="px-4 py-3 md:px-6 md:py-4">
                                            <Skeleton className="h-6 w-full" />
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))
                        ) : table.getRowModel().rows?.length ? (
                            virtualize?.enabled ? (
                                (() => {
                                    const rows = table.getRowModel().rows
                                    const total = rows.length
                                    const rh = virtualize.rowHeight
                                    const start = Math.max(0, Math.floor(scrollTop / rh))
                                    const visible = Math.max(1, Math.ceil((containerHeight || 1) / rh) + 5)
                                    const end = Math.min(total, start + visible)
                                    const topSpacer = start * rh
                                    const bottomSpacer = (total - end) * rh
                                    const slice = rows.slice(start, end)
                                    return (
                                        <>
                                            <TableRow>
                                                <TableCell colSpan={columns.length} style={{ height: topSpacer }} />
                                            </TableRow>
                                            {slice.map((row) => (
                                            <TableRow 
                                                key={row.id} 
                                                data-state={row.getIsSelected() && 'selected'} 
                                                className="hover:bg-gray-50/50 transition-colors border-b border-gray-50 last:border-0 cursor-pointer"
                                                onClick={(e) => {
                                                    const target = e.target as HTMLElement;
                                                    if (target.closest('button, a, input, [role="button"]')) return;
                                                    (table.options as any).meta?.onRowClick?.(row.original);
                                                }}
                                            >
                                                    {row.getVisibleCells().map((cell) => (
                                                        <TableCell 
                                                            key={cell.id}
                                                            className="whitespace-nowrap px-4 py-3 text-xs md:px-6 md:py-4 md:text-sm text-gray-700"
                                                        >
                                                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                                        </TableCell>
                                                    ))}
                                                </TableRow>
                                            ))}
                                            <TableRow>
                                                <TableCell colSpan={columns.length} style={{ height: bottomSpacer }} />
                                            </TableRow>
                                        </>
                                    )
                                })()
                            ) : (
                                table.getRowModel().rows.map((row) => (
                                    <TableRow 
                                        key={row.id} 
                                        data-state={row.getIsSelected() && 'selected'} 
                                        className="hover:bg-gray-50/50 transition-colors border-b border-gray-50 last:border-0 cursor-pointer"
                                        onClick={(e) => {
                                            const target = e.target as HTMLElement;
                                            if (target.closest('button, a, input, [role=\"button\"]')) return;
                                            (table.options as any).meta?.onRowClick?.(row.original);
                                        }}
                                    >
                                        {row.getVisibleCells().map((cell) => (
                                            <TableCell 
                                                key={cell.id}
                                                className="whitespace-nowrap px-4 py-3 text-xs md:px-6 md:py-4 md:text-sm text-gray-700"
                                            >
                                                {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                ))
                            )
                        ) : (
                            <TableRow>
                                <TableCell colSpan={columns.length} className="h-24 text-center text-xs md:text-sm text-gray-500">
                                    No results.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                    <TableFooter>
                        {table.getFooterGroups().map((footerGroup) => (
                            <TableRow key={footerGroup.id}>
                                {footerGroup.headers.map((header) => (
                                    <TableCell key={header.id} className="px-4 py-3 md:px-6 md:py-4 bg-gray-50 font-bold">
                                        {header.isPlaceholder
                                            ? null
                                            : flexRender(
                                                header.column.columnDef.footer,
                                                header.getContext()
                                            )}
                                    </TableCell>
                                ))}
                            </TableRow>
                        ))}
                    </TableFooter>
                        </Table>
                    </div>
                </div>
            </div>
        </div>
    )
}
