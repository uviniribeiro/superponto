import { useCallback, useEffect, useState } from 'react';

/**
 * Armazenamento local temporário do módulo Controle Operacional.
 * Assim que o banco hospedado voltar, cada coleção aqui vira uma tabela (op_*)
 * e as funções de leitura/escrita passam a chamar o backend sem mudar as telas.
 */

export type OpDriverStatus = 'ativo' | 'ferias' | 'afastado' | 'inativo';
export type OpVehicleStatus = 'operando' | 'manutencao' | 'reserva' | 'inativo';
export type OpScheduleStatus = 'planejada' | 'em_andamento' | 'concluida' | 'cancelada';
export type OpOccurrenceSeverity = 'baixa' | 'media' | 'alta';

export interface OpDriver {
  id: string;
  name: string;
  registration: string;
  cnh: string;
  cnhCategory: string;
  cnhExpiry: string;
  phone: string;
  status: OpDriverStatus;
}

export interface OpVehicle {
  id: string;
  plate: string;
  number: string;
  model: string;
  capacity: number;
  status: OpVehicleStatus;
  garage: string;
}

export interface OpLine {
  id: string;
  code: string;
  name: string;
  origin: string;
  destination: string;
  km: number;
  active: boolean;
}

export interface OpService {
  id: string;
  lineId: string;
  code: string;
  name: string;
  startTime: string;
  endTime: string;
  trips: number;
}

export interface OpSchedule {
  id: string;
  date: string;
  driverId: string;
  vehicleId: string;
  lineId: string;
  serviceId: string;
  startTime: string;
  endTime: string;
  status: OpScheduleStatus;
  notes?: string;
}

export interface OpOccurrence {
  id: string;
  date: string;
  scheduleId?: string;
  driverId?: string;
  vehicleId?: string;
  type: string;
  severity: OpOccurrenceSeverity;
  description: string;
  resolved: boolean;
}

export interface OpPermission {
  id: string;
  userName: string;
  userEmail: string;
  role: string;
  canCreateSchedules: boolean;
  canSwapDrivers: boolean;
  canEditOccurrences: boolean;
  canViewReports: boolean;
}

export interface OperationalData {
  drivers: OpDriver[];
  vehicles: OpVehicle[];
  lines: OpLine[];
  services: OpService[];
  schedules: OpSchedule[];
  occurrences: OpOccurrence[];
  permissions: OpPermission[];
}

const STORAGE_KEY = 'pontomax.operational.v1';

const uid = () => Math.random().toString(36).slice(2, 10);

const today = () => new Date().toISOString().slice(0, 10);

const seed = (): OperationalData => {
  const drivers: OpDriver[] = [
    { id: 'd1', name: 'Carlos Almeida', registration: '10021', cnh: '01234567890', cnhCategory: 'D', cnhExpiry: '2027-04-18', phone: '(11) 98888-1010', status: 'ativo' },
    { id: 'd2', name: 'Marcos Pereira', registration: '10044', cnh: '09876543210', cnhCategory: 'D', cnhExpiry: '2026-11-02', phone: '(11) 97777-2020', status: 'ativo' },
    { id: 'd3', name: 'Fernanda Lima', registration: '10078', cnh: '05566778899', cnhCategory: 'E', cnhExpiry: '2028-01-30', phone: '(11) 96666-3030', status: 'ferias' },
  ];
  const vehicles: OpVehicle[] = [
    { id: 'v1', plate: 'ABC1D23', number: '4021', model: 'Marcopolo Torino', capacity: 42, status: 'operando', garage: 'Garagem Central' },
    { id: 'v2', plate: 'EFG4H56', number: '4088', model: 'Caio Apache', capacity: 45, status: 'operando', garage: 'Garagem Central' },
    { id: 'v3', plate: 'IJK7L89', number: '4102', model: 'Mascarello Gran Via', capacity: 40, status: 'manutencao', garage: 'Garagem Norte' },
  ];
  const lines: OpLine[] = [
    { id: 'l1', code: '201', name: 'Centro / Terminal Norte', origin: 'Centro', destination: 'Terminal Norte', km: 18.4, active: true },
    { id: 'l2', code: '355', name: 'Rodoviária / Zona Sul', origin: 'Rodoviária', destination: 'Zona Sul', km: 24.1, active: true },
  ];
  const services: OpService[] = [
    { id: 's1', lineId: 'l1', code: '201-A', name: 'Serviço manhã', startTime: '04:40', endTime: '13:00', trips: 8 },
    { id: 's2', lineId: 'l1', code: '201-B', name: 'Serviço tarde', startTime: '13:00', endTime: '21:20', trips: 8 },
    { id: 's3', lineId: 'l2', code: '355-A', name: 'Serviço integral', startTime: '05:10', endTime: '14:30', trips: 6 },
  ];
  const schedules: OpSchedule[] = [
    { id: 'e1', date: today(), driverId: 'd1', vehicleId: 'v1', lineId: 'l1', serviceId: 's1', startTime: '04:40', endTime: '13:00', status: 'em_andamento' },
    { id: 'e2', date: today(), driverId: 'd2', vehicleId: 'v2', lineId: 'l2', serviceId: 's3', startTime: '05:10', endTime: '14:30', status: 'planejada' },
  ];
  const occurrences: OpOccurrence[] = [
    { id: 'o1', date: today(), scheduleId: 'e1', driverId: 'd1', vehicleId: 'v1', type: 'Atraso na partida', severity: 'media', description: 'Trânsito intenso na saída da garagem.', resolved: false },
  ];
  const permissions: OpPermission[] = [
    { id: 'p1', userName: 'Ana Souza', userEmail: 'ana@empresa.com', role: 'Coordenação', canCreateSchedules: true, canSwapDrivers: true, canEditOccurrences: true, canViewReports: true },
    { id: 'p2', userName: 'Rafael Dias', userEmail: 'rafael@empresa.com', role: 'Tráfego', canCreateSchedules: false, canSwapDrivers: true, canEditOccurrences: true, canViewReports: true },
  ];
  return { drivers, vehicles, lines, services, schedules, occurrences, permissions };
};

const load = (): OperationalData => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...seed(), ...(JSON.parse(raw) as OperationalData) };
  } catch {
    /* ignora dados corrompidos e recomeça do exemplo */
  }
  return seed();
};

type Collection = keyof OperationalData;

export function useOperationalStore() {
  const [data, setData] = useState<OperationalData>(load);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [data]);

  const insert = useCallback(<K extends Collection>(key: K, item: Omit<OperationalData[K][number], 'id'>) => {
    setData((prev) => ({ ...prev, [key]: [...prev[key], { ...item, id: uid() }] } as OperationalData));
  }, []);

  const update = useCallback(<K extends Collection>(key: K, id: string, patch: Partial<OperationalData[K][number]>) => {
    setData((prev) => ({
      ...prev,
      [key]: (prev[key] as { id: string }[]).map((row) => (row.id === id ? { ...row, ...patch } : row)),
    } as OperationalData));
  }, []);

  const remove = useCallback((key: Collection, id: string) => {
    setData((prev) => ({
      ...prev,
      [key]: (prev[key] as { id: string }[]).filter((row) => row.id !== id),
    } as OperationalData));
  }, []);

  const reset = useCallback(() => setData(seed()), []);

  return { data, insert, update, remove, reset };
}
