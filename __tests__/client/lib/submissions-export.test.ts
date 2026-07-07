import * as XLSX from 'xlsx';
import { buildSubmissionsWorksheet } from '@/lib/submissions-export';

// Two data rows: keys become columns A ("Reference ID") and B ("Document Link").
// Header is row 1, so data rows land on Excel rows 2 and 3.
const rows = [
  { 'Reference ID': 'KW-2026-00001', 'Document Link': 'Open Document' },
  { 'Reference ID': 'KW-2026-00002', 'Document Link': '' },
];

describe('buildSubmissionsWorksheet', () => {
  it('attaches a REAL clickable hyperlink (.l) to the Document Link cell when a URL exists', () => {
    const ws = buildSubmissionsWorksheet(rows, ['https://storage.example.com/a.jpg', '']);
    const cell = ws['B2'] as XLSX.CellObject;
    expect(cell.v).toBe('Open Document');
    expect(cell.l).toBeDefined();
    expect(cell.l!.Target).toBe('https://storage.example.com/a.jpg');
  });

  it('leaves the cell without a hyperlink when there is no URL', () => {
    const ws = buildSubmissionsWorksheet(rows, ['https://x/a.jpg', '']);
    const cell = ws['B3'] as XLSX.CellObject | undefined;
    expect(cell?.l).toBeUndefined();
  });

  it('round-trips: the written .xlsx bytes preserve the hyperlink target', () => {
    const ws = buildSubmissionsWorksheet(rows, ['https://x/a.jpg', '']);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Submissions');
    const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const wb2 = XLSX.read(out, { type: 'array' });
    const cell = wb2.Sheets['Submissions']['B2'] as XLSX.CellObject;
    expect(cell.l!.Target).toBe('https://x/a.jpg');
    expect(cell.v).toBe('Open Document');
  });

  it('is a no-op on the links when there is no Document Link column', () => {
    const ws = buildSubmissionsWorksheet([{ 'Reference ID': 'KW-1' }], ['https://x/a.jpg']);
    expect((ws['A1'] as XLSX.CellObject).v).toBe('Reference ID');
  });
});
