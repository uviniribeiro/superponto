import { Module } from '@nestjs/common';
import { CatalogService, catalogController } from './catalog.factory.js';
import { CATALOGS } from './catalogs.js';
import { DepartmentsController } from './departments.controller.js';
import { DepartmentsService } from './departments.service.js';

@Module({
  controllers: [DepartmentsController, ...CATALOGS.map(catalogController)],
  providers: [CatalogService, DepartmentsService],
})
export class StructureModule {}
