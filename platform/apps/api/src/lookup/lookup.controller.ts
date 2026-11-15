import { Controller, Get, Param } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { LookupService } from './lookup.service.js';

/** Preenchimento automático de formulários (qualquer usuário autenticado). */
@ApiTags('consultas')
@ApiBearerAuth()
@Controller('v1/lookup')
export class LookupController {
  constructor(private readonly lookup: LookupService) {}

  @Get('cep/:cep')
  @Throttle({ default: { ttl: 60_000, limit: 60 } })
  cep(@Param('cep') cep: string) {
    return this.lookup.cep(cep);
  }

  @Get('cnpj/:cnpj')
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  cnpj(@Param('cnpj') cnpj: string) {
    return this.lookup.cnpj(cnpj);
  }
}
