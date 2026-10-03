import type * as XLSXType from 'xlsx';

export interface JourneyExcelRow {
  date: string;
  lineName: string;
  driverName: string;
  vehicleName: string;
  startTime: string;
  endTime: string;
  actualStart: string | null;
  actualEnd: string | null;
  distanceKm: number;
  stoppedMinutes: number;
  status: string;
}

interface JourneyExcelOptions {
  companyName: string;
  start: string;
  end: string;
  filters: string;
  rows: JourneyExcelRow[];
}

const clock = (value: string | null) => value
  ? new Date(value).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  : '—';

export function createJourneyWorkbook(XLSX: typeof XLSXType, options: JourneyExcelOptions) {
  const headers = ['Data', 'Linha', 'Motorista', 'Veículo', 'Início previsto', 'Fim previsto', 'Início real', 'Fim real', 'Distância (km)', 'Tempo parado (min)', 'Status'];
  const values = options.rows.map((row) => [
    new Date(`${row.date}T12:00:00`), row.lineName, row.driverName, row.vehicleName,
    row.startTime, row.endTime, clock(row.actualStart), clock(row.actualEnd),
    Number(row.distanceKm.toFixed(2)), row.stoppedMinutes, row.status,
  ]);
  const sheet = XLSX.utils.aoa_to_sheet([
    ['RELATÓRIO DE JORNADAS POR LINHA'],
    ['Empresa', options.companyName],
    ['Período', `${new Date(`${options.start}T12:00:00`).toLocaleDateString('pt-BR')} a ${new Date(`${options.end}T12:00:00`).toLocaleDateString('pt-BR')}`],
    ['Filtros', options.filters],
    [],
    headers,
    ...values,
  ]);
  sheet['!cols'] = [12, 25, 28, 16, 16, 16, 13, 13, 16, 20, 15].map((wch) => ({ wch }));
  sheet['!autofilter'] = { ref: `A6:K${Math.max(6, values.length + 6)}` };
  sheet['!freeze'] = { xSplit: 0, ySplit: 6 };
  for (let row = 7; row <= values.length + 6; row += 1) {
    const dateCell = sheet[`A${row}`];
    if (dateCell) dateCell.z = 'dd/mm/yyyy';
    const distanceCell = sheet[`I${row}`];
    if (distanceCell) distanceCell.z = '0.00';
    const stoppedCell = sheet[`J${row}`];
    if (stoppedCell) stoppedCell.z = '0';
  }
  const book = XLSX.utils.book_new();
  book.Props = { Title: 'Jornadas por Linha', Subject: options.companyName, Author: 'Ponto Max' };
  XLSX.utils.book_append_sheet(book, sheet, 'Jornadas por linha');
  return book;
}