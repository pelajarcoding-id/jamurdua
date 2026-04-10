import '@tanstack/react-table';

declare module '@tanstack/react-table' {
  interface TableMeta<TData extends RowData> {
    onEdit?: (rowData: TData) => void;
    onDelete?: (rowData: TData) => void;
    onUpdateStatus?: (rowData: TData) => void;
  }
}
