import { Module } from '@nestjs/common';
import { CatalogService, catalogController } from '../structure/catalog.factory.js';
import { EmployeesController } from './employees.controller.js';
import { EmployeesService } from './employees.service.js';
import { GROUPINGS, GroupingMembersController, GroupingMembersService } from './groupings.js';
import { EmployeeImportService } from './import.service.js';

@Module({
  // a rota de membros vem antes do CRUD genérico para "/:id/members" não ser lida como "/:id"
  controllers: [EmployeesController, GroupingMembersController, catalogController(GROUPINGS)],
  providers: [EmployeesService, EmployeeImportService, GroupingMembersService, CatalogService],
})
export class PeopleModule {}
