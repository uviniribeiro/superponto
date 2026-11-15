import { Module } from '@nestjs/common';
import { LookupController } from './lookup.controller.js';
import { HTTP_FETCH, LookupService } from './lookup.service.js';

@Module({ controllers: [LookupController], providers: [LookupService, { provide: HTTP_FETCH, useValue: globalThis.fetch.bind(globalThis) }], exports: [LookupService] })
export class LookupModule {}
