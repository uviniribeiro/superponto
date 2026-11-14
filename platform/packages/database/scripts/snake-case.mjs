#!/usr/bin/env node
// Acrescenta @map/@@map em snake_case ao schema.prisma (idempotente).
// Modelos em camelCase no TypeScript, tabelas e colunas em snake_case no PostgreSQL.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const file = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../prisma/schema.prisma');
const TABLES = {
  Person: 'people', Company: 'companies', CompanyUnit: 'company_units', Employment: 'employment_relationships',
  EmploymentHistory: 'employment_history', EmploymentSpecialty: 'employment_specialties',
  Specialty: 'professional_specialties', ProfessionalRegistration: 'professional_registrations',
  JobPosition: 'job_positions', OperationalTeam: 'operational_teams', WorkScheduleDay: 'work_schedule_days',
  TimeCalculation: 'time_calculations', BankHourAccount: 'bank_hours', BankHourTransaction: 'bank_hour_transactions',
  AttendanceOccurrence: 'attendance_occurrences', TimeClosing: 'time_closings', TimeRequest: 'time_requests',
  SchoolClass: 'classes', ClassSchedule: 'class_schedules', ClassSession: 'class_sessions',
  TeachingAssignment: 'teaching_assignments', AcademicPeriod: 'academic_periods',
  MedicalShift: 'medical_shifts', MedicalShiftAssignment: 'medical_shift_assignments',
  ShiftSubstitution: 'shift_substitutions', ShiftHandoverEvent: 'shift_handover_events',
  ProfessionalAvailability: 'professional_availability', ConsultationRoom: 'consultation_rooms',
  AdministrativeAppointment: 'medical_appointments', OperationalActivity: 'operational_activities',
  OperationalAssignment: 'operational_assignments', OperationalOccurrence: 'operational_occurrences',
  OperationalEvent: 'operational_events', CommunicationServerCredential: 'communication_server_credentials',
  CommunicationSyncHistory: 'communication_sync_history', AuditLog: 'audit_logs', Calendar: 'calendars',
  CalendarEvent: 'calendar_events', Classroom: 'classrooms', Course: 'courses', Subject: 'subjects',
};
const snake = (s) => s.replace(/([a-z0-9])([A-Z])/g, '$1_$2').replace(/([A-Z])([A-Z][a-z])/g, '$1_$2').toLowerCase();
const plural = (s) => (s.endsWith('y') && !/[aeiou]y$/.test(s) ? s.slice(0, -1) + 'ies' : s.endsWith('s') ? s + 'es' : s + 's');

const src = readFileSync(file, 'utf8');
const models = new Set([...src.matchAll(/^model (\w+) \{/gm)].map((m) => m[1]));
const enums = new Set([...src.matchAll(/^enum (\w+) \{/gm)].map((m) => m[1]));
const out = [];
let block = null; // { kind, name, hasMap }
for (const line of src.split('\n')) {
  const open = line.match(/^(model|enum) (\w+) \{/);
  if (open) { block = { kind: open[1], name: open[2], hasMap: false }; out.push(line); continue; }
  if (block && line.startsWith('}')) {
    if (!block.hasMap) {
      const table = block.kind === 'enum' ? snake(block.name) : TABLES[block.name] ?? plural(snake(block.name));
      out.push(`\n  @@map("${table}")`);
    }
    block = null; out.push(line); continue;
  }
  if (block?.kind === 'model') {
    if (/^\s*@@map\(/.test(line)) block.hasMap = true;
    const field = line.match(/^(\s+)(\w+)(\s+)(\w+)(\[\])?(\?)?(.*)$/);
    if (field && !line.trim().startsWith('@@') && !line.trim().startsWith('//')) {
      const [, , name, , type, , , rest] = field;
      const isRelation = models.has(type);
      const col = snake(name);
      if (!isRelation && col !== name && !/@map\(/.test(rest)) {
        out.push(`${line.replace(/\s+$/, '')} @map("${col}")`);
        continue;
      }
    }
  }
  if (block?.kind === 'enum' && /^\s*@@map\(/.test(line)) block.hasMap = true;
  out.push(line);
}
writeFileSync(file, out.join('\n'));
console.log(`schema: ${models.size} modelos, ${enums.size} enums mapeados para snake_case`);
