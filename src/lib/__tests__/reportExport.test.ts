import { describe, expect, it, vi } from 'vitest';
vi.mock('../pdfUtils', () => ({ getCompanyBranding: async () => ({ company_name: 'Empresa Ação', cnpj: '11.222.333/0001-81' }) }));
import JSZip from 'jszip';
import * as XLSX from 'xlsx';
import { buildReport, fileName, type ReportData } from '../reportExport';

const d: ReportData = { title: 'Analítico de Atraso', period: { start: '2026-11-01', end: '2026-11-30' }, columns: ['Funcionário', 'Atraso'], rows: [['José Ção', '00:15'], ['Ana', 7]], totals: ['Total', '00:22'] };
const buf = (b: Blob) => new Promise<ArrayBuffer>((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result as ArrayBuffer); fr.readAsArrayBuffer(b); });
const text = async (b: Blob) => new TextDecoder('utf-8', { ignoreBOM: true }).decode(await buf(b));

describe('exportação de relatórios', () => {
  it('CSV com BOM, separador ; e totais', async () => {
    const t = await text(await buildReport('csv', d));
    expect(t.charCodeAt(0)).toBe(0xfeff);
    expect(t).toContain('"José Ção";"00:15"');
    expect(t).toContain('"Total";"00:22"');
  });
  it('TXT em colunas com cabeçalho da empresa', async () => {
    const t = await text(await buildReport('txt', d));
    expect(t).toContain('Empresa Ação');
    expect(t).toContain('01/11/2026 a 30/11/2026');
    expect(t).toMatch(/José Ção\s+00:15/);
  });
  it('XLS e ODS abrem como planilha', async () => {
    for (const f of ['xls', 'ods'] as const) {
      const wb = XLSX.read(new Uint8Array(await buf(await buildReport(f, d))));
      const rows = XLSX.utils.sheet_to_json<string[]>(wb.Sheets[wb.SheetNames[0]], { header: 1 });
      expect(rows.flat()).toContain('José Ção');
    }
  });
  it('DOCX e ODT são pacotes válidos com a tabela', async () => {
    const docx = await JSZip.loadAsync(await buf(await buildReport('docx', d)));
    expect(await docx.file('word/document.xml')!.async('string')).toContain('José Ção');
    const odt = await JSZip.loadAsync(await buf(await buildReport('odt', d)));
    expect(await odt.file('mimetype')!.async('string')).toBe('application/vnd.oasis.opendocument.text');
    expect(await odt.file('content.xml')!.async('string')).toContain('table:table-row');
  });
  it('DOC (HTML do Word) e RTF', async () => {
    expect(await text(await buildReport('doc', d))).toContain('<th>Funcionário</th>');
    const rtf = await text(await buildReport('rtf', d));
    expect(rtf.startsWith('{\\rtf1')).toBe(true);
    expect(rtf).toContain('Jos\\u233?');
  });
  it('nome do arquivo', () => {
    expect(fileName(d, 'pdf')).toBe('Analitico_de_Atraso_2026-11-01_2026-11-30.pdf');
  });
});
