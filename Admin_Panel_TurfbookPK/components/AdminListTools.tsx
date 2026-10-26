'use client';
import { ReactNode } from 'react';

type CsvRow = Record<string, string | number | boolean | null | undefined>;
function escape(value: CsvRow[string]) {
  const raw = value == null ? '' : String(value);
  // Spreadsheet programs execute cells starting with these characters as formulas.
  const text = typeof value === 'string' && /^[\s\u0000-\u001f]*[=+\-@]/.test(raw) ? `'${raw}` : raw;
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}
export function CsvExport({ rows, filename, columns }: { rows: CsvRow[]; filename: string; columns: { key: string; label: string }[] }) { function download() { const csv = [columns.map((column) => escape(column.label)).join(','), ...rows.slice(0, 100).map((row) => columns.map((column) => escape(row[column.key])).join(','))].join('\r\n'); const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = filename; link.click(); URL.revokeObjectURL(url); } return <button className="outline" type="button" onClick={download} disabled={!rows.length}>Export page CSV</button>; }
export function PageControls({ page, hasMore, onPrevious, onNext, children }: { page: number; hasMore: boolean; onPrevious: () => void; onNext: () => void; children?: ReactNode }) { return <div className="page-controls"><span>Page {page}</span>{children}<button className="outline" disabled={page === 1} onClick={onPrevious}>Previous</button><button className="outline" disabled={!hasMore} onClick={onNext}>Next</button></div>; }
