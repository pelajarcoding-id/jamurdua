import type { RowData } from '@tanstack/react-table'

declare module '@tanstack/react-table' {
  interface TableMeta<TData extends RowData> {
    onEdit?: (data: TData) => void;
    onDelete?: (data: TData) => void;
    onDetail?: (data: TData) => void;
    onUpdateStatus?: (data: TData) => void;
    onAddRincian?: (data: TData) => void;
    refreshData?: () => void;
  }
}
