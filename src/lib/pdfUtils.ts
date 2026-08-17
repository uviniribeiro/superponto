import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';

// A4 dimensions in mm
const A4_WIDTH = 210;
const A4_HEIGHT = 297;
const MARGIN = 14;
const CONTENT_WIDTH = A4_WIDTH - (MARGIN * 2);

export interface CompanyBranding {
  company_name: string;
  trade_name?: string | null;
  cnpj?: string | null;
  logo_url?: string | null;
  address?: string | null;
  phone?: string | null;
}

export interface PDFConfig {
  title: string;
  subtitle?: string;
  period?: { start: string; end: string };
  orientation?: 'portrait' | 'landscape';
}

// Fetch company settings for branding
export async function getCompanyBranding(): Promise<CompanyBranding | null> {
  try {
    const { data } = await supabase
      .from('company_settings')
      .select('company_name, trade_name, cnpj, logo_url, address, phone')
      .limit(1)
      .maybeSingle();
    return data;
  } catch {
    return null;
  }
}

// Convert image URL to base64
async function imageUrlToBase64(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

// Create standardized A4 PDF with company branding
export async function createA4PDF(config: PDFConfig): Promise<jsPDF> {
  const doc = new jsPDF({
    orientation: config.orientation || 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const branding = await getCompanyBranding();
  let headerY = MARGIN;
  
  // Add company logo if available
  if (branding?.logo_url) {
    try {
      const logoBase64 = await imageUrlToBase64(branding.logo_url);
      if (logoBase64) {
        // Add logo (max 30mm height, proportional width)
        doc.addImage(logoBase64, 'PNG', MARGIN, headerY, 30, 15, undefined, 'FAST');
        headerY += 18;
      }
    } catch {
      // Fallback to text header if logo fails
    }
  }

  // Company name header
  const displayName = branding?.trade_name || branding?.company_name || 'Ponto Max';
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(displayName, A4_WIDTH / 2, headerY, { align: 'center' });
  headerY += 6;

  // Report title
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(config.title.toUpperCase(), A4_WIDTH / 2, headerY, { align: 'center' });
  headerY += 5;

  // Subtitle and period
  if (config.subtitle) {
    doc.setFontSize(10);
    doc.text(config.subtitle, A4_WIDTH / 2, headerY, { align: 'center' });
    headerY += 5;
  }

  if (config.period) {
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text(
      `Período: ${config.period.start} a ${config.period.end}`,
      A4_WIDTH / 2,
      headerY,
      { align: 'center' }
    );
    doc.setTextColor(0);
    headerY += 4;
  }

  // Separator line
  doc.setDrawColor(200);
  doc.line(MARGIN, headerY, A4_WIDTH - MARGIN, headerY);

  // Store header end position for content start
  (doc as any).__headerEndY = headerY + 4;

  return doc;
}

// Get starting Y position for content
export function getContentStartY(doc: jsPDF): number {
  return (doc as any).__headerEndY || 50;
}

// Add company info block
export function addCompanyInfo(doc: jsPDF, startY: number, branding: CompanyBranding | null): number {
  if (!branding) return startY;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  
  let y = startY;
  if (branding.company_name) {
    doc.text(`Empresa: ${branding.company_name}`, MARGIN, y);
    y += 4;
  }
  if (branding.cnpj) {
    doc.text(`CNPJ: ${branding.cnpj}`, MARGIN, y);
    y += 4;
  }
  if (branding.address) {
    doc.text(`Endereço: ${branding.address}`, MARGIN, y);
    y += 4;
  }

  return y + 2;
}

// Add standardized table with autoTable
export function addTable(
  doc: jsPDF,
  startY: number,
  head: string[][],
  body: string[][],
  footer?: string[][],
  options?: {
    headColor?: [number, number, number];
  }
): number {
  autoTable(doc, {
    startY,
    head,
    body,
    foot: footer,
    margin: { left: MARGIN, right: MARGIN },
    styles: {
      fontSize: 8,
      cellPadding: 2,
    },
    headStyles: {
      fillColor: options?.headColor || [16, 185, 129], // Emerald-500
      textColor: [255, 255, 255],
      fontStyle: 'bold',
    },
    footStyles: {
      fillColor: [229, 231, 235],
      textColor: [0, 0, 0],
      fontStyle: 'bold',
    },
    alternateRowStyles: {
      fillColor: [249, 250, 251],
    },
    tableWidth: 'auto',
  });

  return (doc as any).lastAutoTable?.finalY || startY + 50;
}

// Add footer with generation info
export function addFooter(doc: jsPDF): void {
  const pageCount = doc.getNumberOfPages();
  
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(128);
    
    // Generation timestamp
    doc.text(
      `Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`,
      A4_WIDTH / 2,
      A4_HEIGHT - 10,
      { align: 'center' }
    );
    
    // Page number
    doc.text(
      `Página ${i} de ${pageCount}`,
      A4_WIDTH - MARGIN,
      A4_HEIGHT - 10,
      { align: 'right' }
    );
    
    // System credit
    doc.text('Ponto Max - Sistema de Ponto Eletrônico', MARGIN, A4_HEIGHT - 10);
    
    doc.setTextColor(0);
  }
}

// Add signature lines
export function addSignatureLines(doc: jsPDF, startY: number, labels: string[] = ['Assinatura do Empregado', 'Assinatura do Empregador']): number {
  const signatureWidth = 80;
  const gap = 30;
  let x = MARGIN;
  
  labels.forEach((label, index) => {
    if (index > 0) x += signatureWidth + gap;
    
    doc.setDrawColor(0);
    doc.line(x, startY, x + signatureWidth, startY);
    
    doc.setFontSize(8);
    doc.text(label, x + signatureWidth / 2, startY + 5, { align: 'center' });
  });

  return startY + 15;
}

// Helper to format minutes as HH:MM
export function formatMinutesToHHMM(minutes: number): string {
  const hours = Math.floor(Math.abs(minutes) / 60);
  const mins = Math.abs(minutes) % 60;
  const sign = minutes < 0 ? '-' : '';
  return `${sign}${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

// Complete PDF generation helper
export async function generateStandardPDF(
  config: PDFConfig,
  tableConfig: {
    head: string[][];
    body: string[][];
    footer?: string[][];
    headColor?: [number, number, number];
  },
  extraContent?: (doc: jsPDF, startY: number, branding: CompanyBranding | null) => number
): Promise<jsPDF> {
  const doc = await createA4PDF(config);
  const branding = await getCompanyBranding();
  
  let y = getContentStartY(doc);
  y = addCompanyInfo(doc, y, branding);
  
  if (extraContent) {
    y = extraContent(doc, y, branding);
  }
  
  addTable(doc, y, tableConfig.head, tableConfig.body, tableConfig.footer, {
    headColor: tableConfig.headColor,
  });
  
  addFooter(doc);
  
  return doc;
}
