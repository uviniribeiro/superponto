import { Module } from '@nestjs/common';
import { TimesheetModule } from '../timesheet/timesheet.module.js';
import { EducationController, EducationService } from './education.js';
import { ShiftsController, ShiftsService } from './health.js';
import { OccurrencesController, OccurrencesService } from './operational.js';

/** Módulos especializados: saúde (plantões), educação (turmas, grade e aulas) e operacional (ocorrências). */
@Module({ imports: [TimesheetModule], controllers: [ShiftsController, EducationController, OccurrencesController], providers: [ShiftsService, EducationService, OccurrencesService] })
export class SpecializedModule {}
