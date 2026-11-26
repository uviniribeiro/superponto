// Exportação única de relatórios: o mesmo conteúdo (título, período, colunas e linhas) sai em PDF
// (padrão, com a identidade visual do sistema), XLS, DOCX, DOC, ODT, ODS, CSV, RTF e TXT.
import JSZip from 'jszip';
import * as XLSX from 'xlsx';
import { createA4PDF, getContentStartY, addCompanyInfo, addTable, addFooter, getCompanyBranding } from './pdfUtils';

export type ReportFormat = 'pdf' | 'xls' | 'docx' | 'doc' | 'odt' | 'ods' | 'csv' | 'rtf' | 'txt';
export type Cell = string | number | null | undefined;
export interface ReportData {
  title: string;
  subtitle?: string;
  period?: { start: string; end: string };
  columns: string[];
  rows: Cell[][];
  /** linha de totais (opcional), destacada no fim */
  totals?: Cell[];
  orientation?: 'portrait' | 'landscape';
}

export const FORMATS: { key: ReportFormat; label: string; ext: string; mime: string }[] = [
  { key: 'pdf', label: 'PDF', ext: 'pdf', mime: 'application/pdf' },
  { key: 'xls', label: 'XLS (Excel)', ext: 'xls', mime: 'application/vnd.ms-excel' },
  { key: 'docx', label: 'DOCX (Word)', ext: 'docx', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
  { key: 'doc', label: 'DOC (Word 97-2003)', ext: 'doc', mime: 'application/msword' },
  { key: 'odt', label: 'ODT (LibreOffice Writer)', ext: 'odt', mime: 'application/vnd.oasis.opendocument.text' },
  { key: 'ods', label: 'ODS (LibreOffice Calc)', ext: 'ods', mime: 'application/vnd.oasis.opendocument.spreadsheet' },
  { key: 'csv', label: 'CSV', ext: 'csv', mime: 'text/csv;charset=utf-8' },
  { key: 'rtf', label: 'RTF', ext: 'rtf', mime: 'application/rtf' },
  { key: 'txt', label: 'TXT', ext: 'txt', mime: 'text/plain;charset=utf-8' },
];

const s = (v: Cell) => (v === null || v === undefined ? '' : String(v));
const xml = (v: Cell) => s(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const brDate = (d: string) => d.split('-').reverse().join('/');
const allRows = (d: ReportData) => (d.totals ? [...d.rows, d.totals] : d.rows);

export function periodText(d: ReportData) {
  return d.period ? (d.period.start === d.period.end ? brDate(d.period.start) : `${brDate(d.period.start)} a ${brDate(d.period.end)}`) : '';
}
export function fileName(d: ReportData, f: ReportFormat) {
  const slug = d.title.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '');
  const ext = FORMATS.find((x) => x.key === f)!.ext;
  return `${slug}${d.period ? `_${d.period.start}_${d.period.end}` : ''}.${ext}`;
}

async function headerLines(d: ReportData) {
  const b = await getCompanyBranding();
  return [b?.trade_name || b?.company_name || 'SuperPonto', b?.cnpj ? `CNPJ ${b.cnpj}` : '', d.title, [d.subtitle, periodText(d)].filter(Boolean).join(' · '), `Gerado em ${new Date().toLocaleString('pt-BR')}`].filter(Boolean);
}

async function pdf(d: ReportData): Promise<Blob> {
  const landscape = d.orientation ?? (d.columns.length > 6 ? 'landscape' : 'portrait');
  const doc = await createA4PDF({ title: d.title, subtitle: d.subtitle, period: d.period, orientation: landscape });
  let y = addCompanyInfo(doc, getContentStartY(doc), await getCompanyBranding());
  y = addTable(doc, y, [d.columns], d.rows.map((r) => r.map(s)), d.totals ? [d.totals.map(s)] : undefined);
  addFooter(doc);
  return doc.output('blob');
}

function sheet(d: ReportData, bookType: 'xls' | 'ods'): Blob {
  const aoa = [[d.title], [periodText(d)], [], d.columns, ...allRows(d).map((r) => r.map((c) => (typeof c === 'number' ? c : s(c))))];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = d.columns.map((c, i) => ({ wch: Math.min(50, Math.max(c.length, ...d.rows.map((r) => s(r[i]).length)) + 2) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Relatório');
  const out = XLSX.write(wb, { bookType, type: 'array' });
  return new Blob([out], { type: FORMATS.find((x) => x.key === bookType)!.mime });
}

function csv(d: ReportData): Blob {
  const esc = (v: Cell) => `"${s(v).replace(/"/g, '""')}"`;
  return new Blob(['﻿' + [d.columns, ...allRows(d)].map((r) => r.map(esc).join(';')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
}

async function txt(d: ReportData): Promise<Blob> {
  const rows = [d.columns, ...allRows(d)].map((r) => r.map(s));
  const w = d.columns.map((_, i) => Math.min(40, Math.max(...rows.map((r) => (r[i] ?? '').length))));
  const line = (r: string[]) => r.map((c, i) => c.slice(0, w[i]).padEnd(w[i])).join('  ').trimEnd();
  const sep = w.map((n) => '-'.repeat(n)).join('  ');
  const head = await headerLines(d);
  return new Blob([[...head, '', line(rows[0]), sep, ...rows.slice(1).map(line)].join('\r\n') + '\r\n'], { type: 'text/plain;charset=utf-8' });
}

async function htmlDoc(d: ReportData): Promise<Blob> {
  const head = await headerLines(d);
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><title>${xml(d.title)}</title>
<style>body{font-family:Calibri,Arial;font-size:10pt}h1{font-size:15pt;margin:0}p{margin:2px 0;color:#555}table{border-collapse:collapse;width:100%;margin-top:10px}th{background:#1e3a5f;color:#fff;text-align:left}th,td{border:1px solid #ccc;padding:3px 5px;font-size:9pt}tr.t td{font-weight:bold;background:#eef2f7}</style></head><body>
<p><b>${xml(head[0])}</b></p>${head.slice(1, -3).map((h) => `<p>${xml(h)}</p>`).join('')}<h1>${xml(d.title)}</h1><p>${xml(head.at(-2))}</p><p>${xml(head.at(-1))}</p>
<table><tr>${d.columns.map((c) => `<th>${xml(c)}</th>`).join('')}</tr>${d.rows.map((r) => `<tr>${r.map((c) => `<td>${xml(c)}</td>`).join('')}</tr>`).join('')}${d.totals ? `<tr class="t">${d.totals.map((c) => `<td>${xml(c)}</td>`).join('')}</tr>` : ''}</table></body></html>`;
  return new Blob(['﻿' + html], { type: 'application/msword' });
}

async function docx(d: ReportData): Promise<Blob> {
  const head = await headerLines(d);
  const p = (t: string, bold = false, size = 20) => `<w:p><w:r><w:rPr>${bold ? '<w:b/>' : ''}<w:sz w:val="${size}"/></w:rPr><w:t xml:space="preserve">${xml(t)}</w:t></w:r></w:p>`;
  const cell = (t: Cell, header = false) => `<w:tc><w:tcPr>${header ? '<w:shd w:val="clear" w:color="auto" w:fill="1E3A5F"/>' : ''}</w:tcPr><w:p><w:r><w:rPr>${header ? '<w:b/><w:color w:val="FFFFFF"/>' : ''}<w:sz w:val="16"/></w:rPr><w:t xml:space="preserve">${xml(t)}</w:t></w:r></w:p></w:tc>`;
  const row = (r: Cell[], header = false) => `<w:tr>${r.map((c) => cell(c, header)).join('')}</w:tr>`;
  const landscape = d.columns.length > 6;
  const body = `${p(head[0], true, 22)}${head.slice(1, -3).map((h) => p(h)).join('')}${p(d.title, true, 30)}${p(head.at(-2) ?? '')}${p(head.at(-1) ?? '')}
<w:tbl><w:tblPr><w:tblStyle w:val="TableGrid"/><w:tblW w:w="5000" w:type="pct"/><w:tblBorders><w:top w:val="single" w:sz="4" w:color="CCCCCC"/><w:left w:val="single" w:sz="4" w:color="CCCCCC"/><w:bottom w:val="single" w:sz="4" w:color="CCCCCC"/><w:right w:val="single" w:sz="4" w:color="CCCCCC"/><w:insideH w:val="single" w:sz="4" w:color="CCCCCC"/><w:insideV w:val="single" w:sz="4" w:color="CCCCCC"/></w:tblBorders></w:tblPr>${row(d.columns, true)}${allRows(d).map((r) => row(r)).join('')}</w:tbl>
<w:sectPr><w:pgSz w:w="${landscape ? 16838 : 11906}" w:h="${landscape ? 11906 : 16838}"${landscape ? ' w:orient="landscape"' : ''}/><w:pgMar w:top="850" w:right="850" w:bottom="850" w:left="850" w:header="0" w:footer="0" w:gutter="0"/></w:sectPr>`;
  const zip = new JSZip();
  zip.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
  zip.file('_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
  zip.file('word/document.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}</w:body></w:document>`);
  return zip.generateAsync({ type: 'blob', mimeType: FORMATS[2].mime });
}

async function odt(d: ReportData): Promise<Blob> {
  const head = await headerLines(d);
  const p = (t: string, style = 'P') => `<text:p text:style-name="${style}">${xml(t)}</text:p>`;
  const cell = (t: Cell, h = false) => `<table:table-cell table:style-name="${h ? 'H' : 'C'}" office:value-type="string"><text:p text:style-name="${h ? 'TH' : 'TD'}">${xml(t)}</text:p></table:table-cell>`;
  const content = `<?xml version="1.0" encoding="UTF-8"?><office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0" xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0" office:version="1.2">
<office:automatic-styles><style:style style:name="T" style:family="text"><style:text-properties fo:font-weight="bold"/></style:style>
<style:style style:name="Title" style:family="paragraph"><style:text-properties fo:font-size="15pt" fo:font-weight="bold"/></style:style>
<style:style style:name="P" style:family="paragraph"><style:text-properties fo:font-size="10pt" fo:color="#555555"/></style:style>
<style:style style:name="TH" style:family="paragraph"><style:text-properties fo:font-size="9pt" fo:font-weight="bold" fo:color="#ffffff"/></style:style>
<style:style style:name="TD" style:family="paragraph"><style:text-properties fo:font-size="9pt"/></style:style>
<style:style style:name="H" style:family="table-cell"><style:table-cell-properties fo:background-color="#1e3a5f" fo:border="0.5pt solid #cccccc" fo:padding="0.05cm"/></style:style>
<style:style style:name="C" style:family="table-cell"><style:table-cell-properties fo:border="0.5pt solid #cccccc" fo:padding="0.05cm"/></style:style></office:automatic-styles>
<office:body><office:text>${p(head[0])}${head.slice(1, -3).map((h) => p(h)).join('')}${p(d.title, 'Title')}${p(head.at(-2) ?? '')}${p(head.at(-1) ?? '')}
<table:table table:name="Relatorio"><table:table-column table:number-columns-repeated="${d.columns.length}"/><table:table-row>${d.columns.map((c) => cell(c, true)).join('')}</table:table-row>${allRows(d).map((r) => `<table:table-row>${r.map((c) => cell(c)).join('')}</table:table-row>`).join('')}</table:table>
</office:text></office:body></office:document-content>`;
  const zip = new JSZip();
  zip.file('mimetype', 'application/vnd.oasis.opendocument.text', { compression: 'STORE' });
  zip.file('META-INF/manifest.xml', '<?xml version="1.0" encoding="UTF-8"?><manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.2"><manifest:file-entry manifest:full-path="/" manifest:media-type="application/vnd.oasis.opendocument.text"/><manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/></manifest:manifest>');
  zip.file('content.xml', content);
  return zip.generateAsync({ type: 'blob', mimeType: FORMATS[4].mime });
}

async function rtf(d: ReportData): Promise<Blob> {
  const head = await headerLines(d);
  const esc = (v: Cell) => s(v).replace(/\\/g, '\\\\').replace(/[{}]/g, (m) => `\\${m}`).replace(/[^\x00-\x7f]/g, (c) => `\\u${c.charCodeAt(0)}?`);
  const width = Math.floor((d.columns.length > 6 ? 15000 : 10000) / d.columns.length);
  const rowRtf = (r: Cell[], bold = false) => `\\trowd\\trgaph60${r.map((_, i) => `\\clbrdrt\\brdrs\\clbrdrl\\brdrs\\clbrdrb\\brdrs\\clbrdrr\\brdrs${bold ? '\\clcbpat2' : ''}\\cellx${width * (i + 1)}`).join('')}\n${r.map((c) => `\\pard\\intbl\\fs16${bold ? '\\b\\cf1' : ''} ${esc(c)}${bold ? '\\b0\\cf0' : ''}\\cell`).join('')}\\row\n`;
  const doc = `{\\rtf1\\ansi\\ansicpg1252\\deff0{\\fonttbl{\\f0 Arial;}}{\\colortbl;\\red255\\green255\\blue255;\\red30\\green58\\blue95;}${d.columns.length > 6 ? '\\landscape\\paperw16838\\paperh11906' : ''}\\margl850\\margr850\\margt850\\margb850\n\\fs22\\b ${esc(head[0])}\\b0\\par\n${head.slice(1, -3).map((h) => `\\fs18 ${esc(h)}\\par\n`).join('')}\\fs30\\b ${esc(d.title)}\\b0\\par\n\\fs18 ${esc(head.at(-2))}\\par\n${esc(head.at(-1))}\\par\\par\n${rowRtf(d.columns, true)}${allRows(d).map((r) => rowRtf(r)).join('')}}`;
  return new Blob([doc], { type: 'application/rtf' });
}

export async function buildReport(f: ReportFormat, d: ReportData): Promise<Blob> {
  switch (f) {
    case 'pdf': return pdf(d);
    case 'xls': return sheet(d, 'xls');
    case 'ods': return sheet(d, 'ods');
    case 'docx': return docx(d);
    case 'doc': return htmlDoc(d);
    case 'odt': return odt(d);
    case 'csv': return csv(d);
    case 'rtf': return rtf(d);
    case 'txt': return txt(d);
  }
}

export async function downloadReport(f: ReportFormat, d: ReportData) {
  const blob = await buildReport(f, d);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = fileName(d, f);
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

export async function blobToBase64(blob: Blob): Promise<string> {
  const buf = new Uint8Array(await blob.arrayBuffer());
  let bin = '';
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(bin);
}
