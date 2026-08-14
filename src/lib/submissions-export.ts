import * as XLSX from 'xlsx';

/**
 * Build the Submissions export worksheet, attaching REAL clickable hyperlinks to
 * the "Document Link" column.
 *
 * We use the cell `.l` hyperlink property — which IS supported by SheetJS
 * Community Edition (verified: it round-trips through write→read as an external
 * hyperlink relationship). This replaces the previous `=HYPERLINK(...)` formula
 * approach: a formula cell has no cached value, so Excel/LibreOffice/Google
 * Sheets frequently render it as the plain text "Open Document" with no link.
 *
 * @param rows     the flat per-submission objects (one key per column)
 * @param docUrls  resolved absolute document URLs, index-aligned with `rows`
 *                 (empty string = no document for that row)
 */
export function buildSubmissionsWorksheet(
  rows: Record<string, unknown>[],
  docUrls: string[],
): XLSX.WorkSheet {
  const ws = XLSX.utils.json_to_sheet(rows);
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');

  // Locate the "Document Link" column by its header cell.
  let docLinkCol = -1;
  for (let col = range.s.c; col <= range.e.c; col++) {
    const header = ws[XLSX.utils.encode_cell({ r: 0, c: col })] as XLSX.CellObject | undefined;
    if (header?.v === 'Document Link') { docLinkCol = col; break; }
  }
  if (docLinkCol < 0) return ws;

  docUrls.forEach((url, i) => {
    // Strip any embedded whitespace/newlines — some stored URLs picked up a
    // stray newline from a mis-set storage-bucket secret, which breaks the link.
    const clean = (url || '').replace(/\s+/g, '');
    if (!clean) return;
    const addr = XLSX.utils.encode_cell({ r: i + 1, c: docLinkCol }); // +1 skips the header row
    ws[addr] = {
      t: 's',
      v: 'Open Document',
      l: { Target: clean, Tooltip: 'Open Document' },
    };
  });

  return ws;
}
