/**
 * CSV export utility. Converts an array of row objects to a CSV string
 * and triggers a download in the browser.
 */

type CellValue = string | number | boolean | null | undefined;

function escapeCell(value: CellValue): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  // If contains comma, quote, or newline → wrap in quotes and escape quotes
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function toCSV<T extends Record<string, CellValue>>(
  rows: T[],
  columns?: Array<{ key: keyof T; label: string }>
): string {
  if (rows.length === 0) return '';

  const cols =
    columns ??
    Object.keys(rows[0]).map((k) => ({ key: k as keyof T, label: k }));

  const header = cols.map((c) => escapeCell(c.label)).join(',');
  const body = rows
    .map((row) => cols.map((c) => escapeCell(row[c.key])).join(','))
    .join('\n');

  return `${header}\n${body}`;
}

export function downloadCSV(filename: string, csv: string) {
  // Add BOM so Excel opens UTF-8 correctly
  const blob = new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 100);
}

export function exportToCSV<T extends Record<string, CellValue>>(
  filename: string,
  rows: T[],
  columns?: Array<{ key: keyof T; label: string }>
) {
  const csv = toCSV(rows, columns);
  downloadCSV(filename, csv);
}
