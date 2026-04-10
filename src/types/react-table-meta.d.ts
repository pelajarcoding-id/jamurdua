import { RowData } from '@tanstack/react-table';

declare module '@tanstack/react-table' {
  interface TableMeta<TData extends RowData> {
    onUbah?: (data: TData) => void;
    onHapus?: (data: TData) => void;
    onDetail?: (data: TData) => void;
    onUbahStatus?: (data: TData) => void;
    refreshData?: () => void;
  }
}
